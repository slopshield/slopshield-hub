# Contributing to SlopShield

Thanks for wanting to help fight slop. This project is intentionally small, dependency-light, and readable — please keep it that way.

## Getting started

```bash
git clone https://github.com/<owner>/slopshield-hub
cd slopshield-hub
npm install
npm start          # http://localhost:3000
```

No build step, no framework. The backend is one file (`server.js`, Express + better-sqlite3), the frontend is vanilla HTML/CSS/JS in `public/`. Delete `hub.db` any time you want a fresh database.

## How to contribute

1. **Open an issue first** for anything non-trivial — describe the problem or proposal before writing code, so nobody wastes a weekend on something that won't be merged.
2. **Fork → branch → pull request.** Small, focused PRs get reviewed fast; 2000-line rewrites don't.
3. **Explain the why** in your PR description, not just the what.

## Where help is most wanted

In priority order (see README "Known limitations" for context):

- **Vote integrity** — design + implement account-based voting (GitHub OAuth is the leading idea) while keeping anonymous *browsing* of the list possible
- **Admin/moderation tools** — spam removal, duplicate merging, audit log of status changes
- **Detection rules** — heuristic patterns for more languages (the regex tables live in the extension repo, `content/detector.js`)
- **Platform adapters** — keeping YouTube/X/TikTok/Instagram/Facebook selectors alive as their DOMs change
- **Tests** — there are none yet; even a basic API test suite (node:test is fine) would be a great first PR

Issues labeled `good first issue` are deliberately scoped to be doable in an evening.

## Code style

- Plain modern JavaScript (Node 18+), no TypeScript, no transpilation
- No new dependencies without discussion in an issue first — every dependency is a maintenance and security liability
- Comments explain *why*, not *what*
- Frontend: no frameworks, CSS variables from `style.css`, keep it accessible (focus states, reduced-motion)

## Principles that are not up for debate

These are the project's spine. PRs that violate them will be declined regardless of code quality:

1. **Channel handles only — never personal data.** No real names, emails, faces, addresses. Ever.
2. **Every listing must remain appealable.** Due process is a feature, not overhead.
3. **No fully automated reporting/blocking on platforms.** The final click on a platform's report/block button always belongs to the human. This is both a ToS matter and an ethical one.
4. **Transparency over convenience.** Thresholds, decisions, and list contents stay publicly inspectable.

## Reporting security issues

Found a vulnerability (vote manipulation, injection, data leak)? Please don't open a public issue — contact the maintainer privately first via the email in the repo profile, and give us a reasonable window to fix it.
