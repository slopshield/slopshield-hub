// SlopShield Hub — frontend
const $ = (s) => document.querySelector(s);

// anonymous voter token (one vote per item per browser)
let voter = localStorage.getItem("ss-voter");
if (!voter) { voter = crypto.randomUUID(); localStorage.setItem("ss-voter", voter); }

const api = (path, opts = {}) =>
  fetch(path, { ...opts, headers: { "content-type": "application/json", "x-voter": voter, ...(opts.headers || {}) } })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status); return j; });

init();

async function init() {
  $("#listUrl").textContent = location.origin + "/api/list.json";
  $("#copyUrl").addEventListener("click", async () => {
    await navigator.clipboard.writeText(location.origin + "/api/list.json");
    $("#copyUrl").textContent = "Gekopieerd ✓";
    setTimeout(() => ($("#copyUrl").textContent = "Kopieer URL"), 2000);
  });

  refreshStats(); refreshList(); refreshQueue();

  // nav highlight
  document.querySelectorAll("header.site a").forEach((a) =>
    a.addEventListener("click", () => {
      document.querySelectorAll("header.site a").forEach((x) => x.classList.toggle("on", x === a));
    })
  );

  // upload
  const drop = $("#drop"), fi = $("#fileInput");
  drop.addEventListener("click", () => fi.click());
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  fi.addEventListener("change", () => fi.files[0] && handleFile(fi.files[0]));

  $("#mSubmit").addEventListener("click", async () => {
    try {
      const r = await api("/api/submit", { method: "POST", body: JSON.stringify({ platform: $("#mPlatform").value, handle: $("#mHandle").value, reason: $("#mReason").value }) });
      showResult("#uploadResult", resultText(r));
      $("#mHandle").value = ""; $("#mReason").value = "";
      refreshQueue(); refreshStats();
    } catch (e) { showResult("#uploadResult", e.message, true); }
  });

  $("#aSubmit").addEventListener("click", async () => {
    try {
      const r = await api("/api/appeal", { method: "POST", body: JSON.stringify({ platform: $("#aPlatform").value, handle: $("#aHandle").value, motivation: $("#aMotivation").value }) });
      showResult("#appealResult", r.message);
      $("#aHandle").value = ""; $("#aMotivation").value = "";
      refreshQueue(); refreshStats();
    } catch (e) { showResult("#appealResult", e.message, true); }
  });
}

async function handleFile(file) {
  try {
    const data = JSON.parse(await file.text());
    const r = await api("/api/submit", { method: "POST", body: JSON.stringify({ entries: data.entries || [] }) });
    showResult("#uploadResult", resultText(r));
    refreshQueue(); refreshStats();
  } catch (e) { showResult("#uploadResult", "Upload mislukt: " + e.message, true); }
}

function resultText(r) {
  let t = `${r.added} toegevoegd aan de wachtrij.`;
  if (r.duplicates?.length) t += ` ${r.duplicates.length} duplicaten overgeslagen (al bekend: ${r.duplicates.slice(0, 5).map((d) => "@" + d.handle).join(", ")}${r.duplicates.length > 5 ? "…" : ""}).`;
  return t;
}

async function refreshStats() {
  try {
    const s = await api("/api/stats");
    $("#sListed").textContent = s.listed; $("#sPending").textContent = s.pending;
    $("#sAppeals").textContent = s.appeals; $("#sVotes").textContent = s.votes;
  } catch {}
}

async function refreshList() {
  try {
    const d = await fetch("/api/list.json").then((r) => r.json());
    const box = $("#listTable");
    if (!d.entries.length) { box.innerHTML = `<div class="empty">De lijst is nog leeg — de eerste inzendingen staan in de curatiewachtrij.</div>`; return; }
    box.innerHTML = d.entries.map((e) => `
      <div class="entry">
        <span class="plat">${esc(e.platform)}</span>
        <div class="h"><b>@${esc(e.handle)}</b><span class="reason">${esc(e.reason || "")}</span></div>
      </div>`).join("");
  } catch {}
}

async function refreshQueue() {
  try {
    const d = await api("/api/queue");
    document.querySelectorAll(".promoteAt").forEach((el) => (el.textContent = d.promoteAt));
    const box = $("#queue");
    if (!d.items.length) { box.innerHTML = `<div class="empty">Wachtrij is leeg. Upload je vangst hieronder.</div>`; return; }
    box.innerHTML = "";
    for (const it of d.items) {
      const row = document.createElement("div");
      row.className = "entry";
      row.innerHTML = `
        <span class="plat">${esc(it.platform)}</span>
        <div class="h">
          <b>@${esc(it.handle)} ${it.status === "appeal" ? '<span class="tag">APPEAL</span>' : ""}</b>
          <span class="reason">${esc(it.reason || "")}</span>
          ${it.status === "appeal" && it.motivation ? `<div class="motivation">Motivatie eigenaar: ${esc(it.motivation)}</div>` : ""}
        </div>
        <div class="votes">
          <button class="slop">Slop ▲</button>
          <div class="score">${it.score > 0 ? "+" : ""}${it.score}</div>
          <button class="noslop">Geen slop ▼</button>
        </div>`;
      row.querySelector(".slop").addEventListener("click", () => vote(it.id, 1, row));
      row.querySelector(".noslop").addEventListener("click", () => vote(it.id, -1, row));
      box.appendChild(row);
    }
  } catch {}
}

async function vote(id, v, row) {
  try {
    const r = await api("/api/vote", { method: "POST", body: JSON.stringify({ id, vote: v }) });
    row.querySelector(".score").textContent = (r.score > 0 ? "+" : "") + r.score;
    if (r.status !== "pending" && r.status !== "appeal") {
      row.style.opacity = 0.4;
      setTimeout(() => { refreshQueue(); refreshList(); refreshStats(); }, 600);
    }
  } catch (e) {
    row.querySelector(".score").textContent = "✕";
    setTimeout(() => refreshQueue(), 900);
    alert(e.message);
  }
}

function showResult(sel, msg, err = false) {
  const el = $(sel);
  el.textContent = msg;
  el.classList.toggle("err", err);
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
