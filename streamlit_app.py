"""
Test deployment — frontend smoke test.

Standalone Streamlit app that does ONE thing: embeds the existing
static webapp_prototype (HTML + CSS + JS) inside a Streamlit page,
served via Streamlit Cloud's static-files mechanism at /app/static/.

No database, no scheduler, no OneDrive, no secrets. Five sample reports
under static/reports/ make the View/Download buttons actually work.

Goal: validate that:
  1. Streamlit Cloud deploys cleanly from a brand-new repo.
  2. enableStaticServing serves files at /app/static/<path>.
  3. The webapp_prototype renders inside an iframe component.
  4. View/Download buttons resolve to the static URLs and open reports.

Once this works, the real `build/` deployment (with scheduler + storage
backends) can reuse the same patterns with confidence.
"""

import streamlit as st

st.set_page_config(
    page_title="Reports — Team View Prototype",
    page_icon="📁",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Hide Streamlit's default chrome so the embedded webapp feels like the
# whole page. The "Made with Streamlit" footer + hamburger menu would
# otherwise sit next to our brand header and look messy.
st.markdown(
    """
    <style>
      #MainMenu, footer, header {visibility: hidden;}
      .block-container {padding: 0 !important; max-width: 100% !important;}
      iframe {border: 0 !important;}
    </style>
    """,
    unsafe_allow_html=True,
)

# Render the static webapp_prototype inside an iframe component. The URL
# MUST be "/app/static/index.html" (absolute) — not "./static/index.html"
# — because Streamlit's own SPA shell lives at /static/, and a relative
# "./static/" path collides with that. Pointing at /app/static/ uses the
# enableStaticServing-exposed user directory instead.
st.iframe(
    "/app/static/index.html",
    height=1600,
)
