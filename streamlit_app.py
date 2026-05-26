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

# Strip Streamlit's chrome and force the iframe to fill the viewport
# edge-to-edge. The embedded webapp does its own internal centering
# (max-width: 1300px on .page), so it'll look identical to opening the
# raw index.html in a browser tab.
st.markdown(
    """
    <style>
      /* Hide Streamlit menu + footer + branded header. */
      #MainMenu, footer, header { visibility: hidden; height: 0; }

      /* Kill the centered narrow-column container so the iframe
         can stretch all the way across. Different Streamlit versions
         use different data-testid + class names, so we target several. */
      .main .block-container,
      .stMain .block-container,
      [data-testid="stMain"] .block-container,
      .stMainBlockContainer,
      [data-testid="stMainBlockContainer"] {
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .stApp { background: #FFFFFF; }

      /* Make any iframe component fill its row. */
      [data-testid="stIFrame"],
      [data-testid="stComponent"],
      [data-testid="stHtml"] {
        width: 100% !important;
      }
      [data-testid="stIFrame"] iframe,
      [data-testid="stComponent"] iframe,
      [data-testid="stHtml"] iframe,
      iframe {
        width: 100% !important;
        border: 0 !important;
        display: block !important;
      }
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
