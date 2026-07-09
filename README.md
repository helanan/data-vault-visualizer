# Data Vault Visualizer

Two self-contained HTML references for learning/reviewing Data Vault (Hub / Link / Satellite / Hashdiff) concepts, built around a real incident (a 35-day Ascension denials reporting gap caused by a NULL FILE_DATE / stuck watermark).

- **index.html** — static visual reference card for each Data Vault concept, with a memory hook and an anchor phrase for each.
- **simulator.html** — interactive simulator. Pick a claim, edit a field, run a load, and watch the hashdiff decide whether to insert a new satellite row or skip it. Includes a "Replay the Ascension bug" button that reproduces the real incident.

Open either file directly in a browser — no build step, no dependencies.
