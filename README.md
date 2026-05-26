# Cheddy AI Analytics — Frontend Test Deployment

Standalone Streamlit app that embeds the static team-view webapp prototype.
**No database, no scheduler, no OneDrive, no secrets.** Five sample reports
are bundled so the View / Download buttons actually work.

This exists to validate that Streamlit Cloud deploys cleanly from a brand-new
repo and that the embedded webapp UI renders + interacts correctly — before
we ship the real deployment with the scheduler + storage backends.

## File tour

```
streamlit_app.py             14 lines — just an iframe wrapper
requirements.txt             Just `streamlit`
runtime.txt                  python-3.11
.python-version              3.11 (for uv builder)
.gitignore
.streamlit/
  └─ config.toml             enableStaticServing = true
static/                      Everything below is served at /app/static/<path>
  ├─ index.html              The webapp shell (filters + cards + chrome)
  ├─ app.js                  Filter / sort / pagination logic
  ├─ reports_data.js         5-entry manifest (window.realReports = [...])
  ├─ reports_data.json       Same data, JSON form
  ├─ sample_report.html      Placeholder kept for completeness
  └─ reports/                The 5 sample reports
     ├─ bbf/boundless_hound/sales/weekly_snapshot_..._20260522.html
     ├─ bbf/canine_butcher_shop/inventory/report_..._adhoc_20260430_v3.html
     ├─ bbf/canine_butcher_shop/sales/weekly_snapshot_..._20260518.html
     ├─ cheddy/liteband/sales/weekly_snapshot_..._20260519.html
     └─ cheddy/zerowater/inventory/report_..._optA_projection_v10.html
```

## How it works

1. Streamlit Cloud builds the app with just one dependency (`streamlit`).
2. `streamlit_app.py` hides Streamlit's chrome and renders one iframe pointing at `./static/index.html`.
3. `enableStaticServing` makes the browser fetch `index.html` from `/app/static/`. The page's `<script>` tags resolve to `/app/static/app.js` and `/app/static/reports_data.js` automatically.
4. `app.js` reads `window.realReports`, renders the filter bar + card grid, and resolves View/Download buttons to `/app/static/reports/<path>` thanks to `REPORTS_BASE_PATH = "./reports/"`.

The only deviation from the original `webapp_prototype/` is line 31 of `app.js`:

```js
// Was: const REPORTS_BASE_PATH = "../reports/";
const REPORTS_BASE_PATH = "./reports/";
```

That single change lets the same code run under Streamlit static serving instead of `file://`.

## Deploy

1. Push this folder's contents to a new private GitHub repo (root of the repo = root of this folder).
2. https://share.streamlit.io → New app → pick the repo → branch `main` → main file `streamlit_app.py`.
3. Deploy. No secrets required.
4. Open the app URL — you should see the red header, filter bar, 5 cards. Click any View button to confirm reports open.

## Local preview

```bash
cd test_deployment/
python -m venv .venv
.venv\Scripts\activate         # Windows
pip install -r requirements.txt
streamlit run streamlit_app.py
```

Open http://localhost:8501.

## What this validates (and what it doesn't)

✅ Streamlit Cloud picks up a brand-new repo and builds it.
✅ Static serving works (`/app/static/<path>` resolves).
✅ Iframe-embedded webapps render correctly.
✅ Relative URLs inside the embedded webapp resolve back into static.
✅ HTML reports open in new tabs from inside the embedded UI.

❌ This does NOT exercise the scheduler, MySQL, Pacvue, or OneDrive. Those
   live in the separate `build/` deployment.
