# SlopShield Hub

**A community-curated blocklist for AI slop channels on social media — voted on by humans, with a fair appeal process for creators, and one-click loading into the SlopShield browser extension.**

AI slop — mass-generated, zero-effort synthetic content optimized for algorithms instead of people — is drowning out human creators, eroding trust in everything we see, and targeting the most vulnerable audiences (fake kids' content, elderly-bait). Platforms enforce slowly. We can clean our own feeds now: together, transparently, and with due process for anyone listed unfairly.

## How it works

1. **Hunters** flag slop channels in the SlopShield extension and upload their exported JSON here (duplicates are detected automatically, case-insensitive, including previously rejected entries)
2. **The community votes** in the curation queue: net **+5 "slop" votes → published**, net **−5 → rejected**. One vote per item per person.
3. **Everyone subscribes once** to `/api/list.json` in the extension — updates sync automatically every 6 hours, or instantly via "Sync now"
4. **Channel owners can appeal.** An appeal puts the channel back in the queue with the owner's motivation visible to voters. If the community votes it down (net −5 "not slop"), the channel is removed from the list — and from every subscriber's extension on the next sync.

**Principles:** channel handles only, never personal data. Every listing is appealable. All thresholds are configurable and all decisions are vote-based — no single moderator decides.

## Running locally

Requires Node.js 18+.

```bash
npm install
npm start
# → http://localhost:3000
```

The SQLite database (`hub.db`) is created automatically on first run.

## Deploying

Works on any Node host (Render, Railway, Fly.io, a VPS). On Render: New Web Service → connect this repo → defaults work. **Important:** SQLite needs a persistent disk or your data is wiped on redeploy — mount a disk (e.g. at `/var/data`) and set `DB_PATH=/var/data/hub.db`.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | server port |
| `DB_PATH` | `./hub.db` | SQLite file location (point at your persistent disk) |
| `PROMOTE_AT` | 5 | net "slop" votes to publish a submission |
| `REJECT_AT` | 5 | net "not slop" votes to reject a submission |
| `DELIST_AT` | 5 | on appeal: net "not slop" votes to remove from list |
| `LIST_NAME` | SlopShield Community List | name field in the published JSON |

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/list.json` | GET | The published blocklist (SlopShield subscription format, CORS open) |
| `/api/queue` | GET | Pending submissions + active appeals |
| `/api/stats` | GET | Counters |
| `/api/submit` | POST | Submit entries — single `{platform, handle, reason}` or `{entries: [...]}` |
| `/api/vote` | POST | `{id, vote: 1\|-1}` with `x-voter` header (UUID) |
| `/api/appeal` | POST | `{platform, handle, motivation}` — motivation min. 20 chars |

## The SlopShield ecosystem

- **slopshield** (browser extension, Manifest V3): scans feeds on YouTube/X/TikTok/Instagram/Facebook, heuristic + C2PA + optional vision detection, personal blocklist, assisted native block/report, list subscriptions
- **slopshield-hub** (this repo): community curation, voting, appeals, list publishing

## Known limitations — help wanted

This is an early, honest prototype. The biggest open problems, in rough priority order:

1. **Vote integrity.** Voting uses anonymous browser tokens + IP rate limits. Fine against casual abuse, useless against organized brigading — in *both* directions (mass-listing innocent channels, or slop farms voting themselves clean). Account-based auth (GitHub OAuth?) is the obvious next step.
2. **Moderation tooling.** There is no admin role: no way to remove spam submissions, merge duplicates with different spellings, or handle bad-faith appeals beyond voting.
3. **Detection quality.** The extension's heuristics are regex-based and English/Dutch only. More languages, smarter patterns, and better C2PA coverage are all wide open.
4. **Platform adapter fragility.** Social sites change their DOM constantly; adapters need maintainers per platform.
5. **Federation.** One hub = one community's judgment. Multiple subscribable lists already work in the extension; tooling for list discovery and reputation would make this an ecosystem.

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[MIT](LICENSE) — use it, fork it, build on it.
