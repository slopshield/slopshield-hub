// SlopShield Hub — community curation server
// Express + SQLite. Endpoints:
//   GET  /api/list.json   — published blocklist (SlopShield subscription format, CORS open)
//   GET  /api/queue       — pending submissions + active appeals
//   GET  /api/stats       — counters for the homepage
//   POST /api/submit      — upload entries (single or exported SlopShield JSON); dedupes
//   POST /api/vote        — {id, vote: 1|-1}; thresholds promote/reject/delist
//   POST /api/appeal      — {platform, handle, motivation} by channel owner
//
// Voting identity = anonymous voter token (localStorage UUID) + per-IP rate cap.
// Honest limitation: this resists casual abuse, not determined brigading.

const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PROMOTE_AT = Number(process.env.PROMOTE_AT || 5);   // net "slop" votes → listed
const REJECT_AT = -Number(process.env.REJECT_AT || 5);    // net "geen slop"   → rejected
const DELIST_AT = -Number(process.env.DELIST_AT || 5);    // appeal: net "geen slop" → removed
const LIST_NAME = process.env.LIST_NAME || "SlopShield Community List";

const db = new Database(process.env.DB_PATH || path.join(__dirname, "hub.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL,
    reason TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending', -- pending | listed | rejected | appeal | delisted
    motivation TEXT DEFAULT '',             -- appeal motivation from channel owner
    score INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    decided_at INTEGER,
    UNIQUE(platform, handle)
  );
  CREATE TABLE IF NOT EXISTS votes (
    entry_id INTEGER NOT NULL,
    voter TEXT NOT NULL,
    vote INTEGER NOT NULL,
    phase TEXT NOT NULL DEFAULT 'curation', -- curation | appeal
    created_at INTEGER NOT NULL,
    UNIQUE(entry_id, voter, phase)
  );
`);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- crude per-IP rate limiting ---------------------------------------------
const hits = new Map();
app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60_000) { rec.n = 0; rec.t = now; }
  rec.n++;
  hits.set(ip, rec);
  if (rec.n > 120) return res.status(429).json({ error: "Rustig aan — te veel verzoeken." });
  next();
});

const norm = (h) => String(h || "").trim().toLowerCase().replace(/^@/, "");
const PLATFORMS = new Set(["youtube", "x", "tiktok", "instagram", "facebook"]);

// ---- the subscribable blocklist ----------------------------------------------
app.get("/api/list.json", (req, res) => {
  const rows = db.prepare("SELECT platform, handle, reason FROM entries WHERE status='listed'").all();
  res.set("Access-Control-Allow-Origin", "*"); // SlopShield's background worker must be able to fetch this
  res.set("Cache-Control", "public, max-age=300");
  res.json({ name: LIST_NAME, version: 1, generated: new Date().toISOString(), entries: rows });
});

app.get("/api/stats", (req, res) => {
  const c = (s) => db.prepare("SELECT COUNT(*) n FROM entries WHERE status=?").get(s).n;
  const votes = db.prepare("SELECT COUNT(*) n FROM votes").get().n;
  res.json({ listed: c("listed"), pending: c("pending"), appeals: c("appeal"), rejected: c("rejected"), delisted: c("delisted"), votes });
});

app.get("/api/queue", (req, res) => {
  const rows = db.prepare(
    "SELECT id, platform, handle, reason, status, motivation, score, created_at FROM entries WHERE status IN ('pending','appeal') ORDER BY created_at DESC LIMIT 200"
  ).all();
  res.json({ promoteAt: PROMOTE_AT, rejectAt: REJECT_AT, delistAt: DELIST_AT, items: rows });
});

// ---- submissions (single entry or whole exported SlopShield JSON) -------------
app.post("/api/submit", (req, res) => {
  let entries = [];
  if (Array.isArray(req.body.entries)) entries = req.body.entries;
  else if (req.body.handle) entries = [req.body];
  if (!entries.length) return res.status(400).json({ error: "Geen entries gevonden in upload." });
  if (entries.length > 200) return res.status(400).json({ error: "Max 200 entries per upload." });

  const insert = db.prepare("INSERT INTO entries (platform, handle, reason, status, created_at) VALUES (?,?,?,'pending',?)");
  const exists = db.prepare("SELECT status FROM entries WHERE platform=? AND handle=?");
  let added = 0; const duplicates = [];
  for (const e of entries) {
    const platform = String(e.platform || "").toLowerCase();
    const handle = norm(e.handle);
    if (!PLATFORMS.has(platform) || !handle || handle.length > 100) continue;
    const cur = exists.get(platform, handle);
    if (cur) { duplicates.push({ platform, handle, status: cur.status }); continue; } // dedupe: already known in ANY status
    insert.run(platform, handle, String(e.reason || "").slice(0, 300), Date.now());
    added++;
  }
  res.json({ added, duplicates });
});

// ---- voting --------------------------------------------------------------------
app.post("/api/vote", (req, res) => {
  const { id, vote } = req.body;
  const voter = String(req.headers["x-voter"] || "");
  if (!/^[0-9a-f-]{20,40}$/.test(voter)) return res.status(400).json({ error: "Geen geldig stem-token." });
  if (vote !== 1 && vote !== -1) return res.status(400).json({ error: "Stem moet 1 (slop) of -1 (geen slop) zijn." });

  const entry = db.prepare("SELECT * FROM entries WHERE id=?").get(id);
  if (!entry || !["pending", "appeal"].includes(entry.status)) return res.status(404).json({ error: "Item staat niet (meer) in de wachtrij." });

  const phase = entry.status === "appeal" ? "appeal" : "curation";
  try {
    db.prepare("INSERT INTO votes (entry_id, voter, vote, phase, created_at) VALUES (?,?,?,?,?)").run(id, voter, vote, phase, Date.now());
  } catch {
    return res.status(409).json({ error: "Je hebt al gestemd op dit item." });
  }

  const score = entry.score + vote;
  let status = entry.status;
  if (entry.status === "pending") {
    if (score >= PROMOTE_AT) status = "listed";
    else if (score <= REJECT_AT) status = "rejected";
  } else { // appeal phase: positive = blijft slop, negative = geen slop
    if (score <= DELIST_AT) status = "delisted";
    else if (score >= PROMOTE_AT) status = "listed"; // community bevestigt: blijft op de lijst
  }
  db.prepare("UPDATE entries SET score=?, status=?, decided_at=? WHERE id=?")
    .run(score, status, status !== entry.status ? Date.now() : entry.decided_at, id);
  res.json({ score, status });
});

// ---- appeals --------------------------------------------------------------------
app.post("/api/appeal", (req, res) => {
  const platform = String(req.body.platform || "").toLowerCase();
  const handle = norm(req.body.handle);
  const motivation = String(req.body.motivation || "").trim().slice(0, 1000);
  if (!PLATFORMS.has(platform) || !handle) return res.status(400).json({ error: "Platform en handle zijn verplicht." });
  if (motivation.length < 20) return res.status(400).json({ error: "Geef een serieuze motivatie (minimaal 20 tekens)." });

  const entry = db.prepare("SELECT * FROM entries WHERE platform=? AND handle=?").get(platform, handle);
  if (!entry) return res.status(404).json({ error: "Dit kanaal staat niet op de lijst." });
  if (entry.status === "appeal") return res.status(409).json({ error: "Er loopt al een appeal voor dit kanaal." });
  if (entry.status !== "listed") return res.status(400).json({ error: `Kanaal heeft status '${entry.status}' — appeal kan alleen voor gepubliceerde vermeldingen.` });

  // back to the queue with reset score; old appeal-phase votes cleared so it's a fresh hearing
  db.prepare("DELETE FROM votes WHERE entry_id=? AND phase='appeal'").run(entry.id);
  db.prepare("UPDATE entries SET status='appeal', motivation=?, score=0, decided_at=NULL WHERE id=?").run(motivation, entry.id);
  res.json({ ok: true, message: "Appeal geplaatst — het kanaal staat opnieuw in de curatiewachtrij." });
});

app.listen(PORT, () => console.log(`SlopShield Hub draait op http://localhost:${PORT}`));
