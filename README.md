# SlopShield Hub — community-curatie voor de blocklist

Website + API waar de community AI-slopkanalen indient, beoordeelt en publiceert — met appeal-recht voor kanaaleigenaren. De gepubliceerde lijst is direct te laden in de SlopShield-extensie.

## Lokaal draaien

```bash
npm install
node server.js
# → http://localhost:3000
```

## Online zetten (gratis kan)

**Render.com** (simpelst): nieuwe "Web Service" → koppel je GitHub-repo → build command `npm install`, start command `node server.js`. Klaar. Zelfde recept werkt op Railway, Fly.io of een eigen VPS achter nginx.

Let op: SQLite schrijft naar `hub.db` naast `server.js` — gebruik op Render/Railway een persistent disk/volume, anders is de database weg bij elke deploy.

## Configuratie (omgevingsvariabelen)

| Variabele | Default | Betekenis |
|---|---|---|
| `PORT` | 3000 | poort |
| `PROMOTE_AT` | 5 | netto "slop"-stemmen waarna een inzending op de lijst komt |
| `REJECT_AT` | 5 | netto "geen slop"-stemmen waarna afgewezen |
| `DELIST_AT` | 5 | bij appeal: netto "geen slop" waarna van de lijst |
| `LIST_NAME` | SlopShield Community List | naam in de gepubliceerde JSON |

## De cyclus

1. Jagers exporteren hun vangst uit SlopShield en uploaden de JSON op de site (duplicaten worden automatisch overgeslagen)
2. De community stemt in de curatiewachtrij: +5 → gepubliceerd, −5 → afgewezen
3. Iedereen met de extensie abonneert zich éénmalig op `https://jouwdomein/api/list.json` — sync elke 6 uur of direct via "Sync nu" in de popup
4. Kanaaleigenaren die het oneens zijn dienen een appeal in met motivatie → het kanaal komt terug in de wachtrij → bij −5 wordt het verwijderd en verdwijnt het bij de eerstvolgende sync uit ieders extensie

## Eerlijke beperkingen

- Stemmen = anoniem browser-token + IP-limiet. Goed genoeg tegen casual misbruik; niet tegen georganiseerde brigades. Wil je dat dichttimmeren, dan zijn accounts (bijv. GitHub-OAuth) de volgende stap.
- Eén appeal tegelijk per kanaal; na een mislukt appeal kan een nieuwe poging gedaan worden.
- De site bewaart uitsluitend platform + kanaal-handle + reden. Geen namen, geen e-mails, geen persoonsgegevens — hou dat zo.
