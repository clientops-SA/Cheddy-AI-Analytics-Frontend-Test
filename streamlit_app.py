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

# Embed the static webapp_prototype via raw iframe HTML so the browser
# handles URL resolution directly. We can't use st.iframe() with a bare
# relative path ("app/static/index.html") — it treats it as plain text.
# We can't use st.iframe() with an absolute path ("/app/static/...")
# either — on Cloud private apps it bypasses the /~/+/ auth prefix and
# 303-redirects to the login gate.
#
# Solution: emit raw <iframe src="app/static/..."> markup. The browser
# resolves that relative to the parent document URL, which is "/" on
# localhost and "/~/+/" on Cloud private — both land on our static
# directory without any auth-gate detour.
st.components.v1.html(
    """
    <iframe
        src="app/static/index.html"
        style="width:100%; height:1600px; border:0; display:block;"
        allow="fullscreen; clipboard-read; clipboard-write"
        loading="eager"
    ></iframe>
    """,
    height=1620,
)
