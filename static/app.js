/* Cheddy Report Hub — webview logic.
 *
 * Loads window.realReports from reports_data.js if present (built by
 * tools/build_report_manifest.py from the actual reports/ folder).
 * Falls back to a small mock set if the manifest isn't generated yet.
 */

// ────────────────────────────────────────────────────────────────────
// Fallback mock data (only used if reports_data.js isn't loaded)
// ────────────────────────────────────────────────────────────────────
const fallbackReports = [
  { id: 1, type: "Weekly Snapshot", brand: "Boundless Hound", brand_slug: "boundless_hound", category: "sales", agency: "BBF", audience: "Internal", cadence: "Weekly", option: "", date: "2026-05-18", filename: "weekly_snapshot_boundless_hound_internal_bbf_20260518.html", path_html: "sample_report.html", path_pdf: "", path_pptx: "", size: "247 KB", version: 1, version_count: 1 },
  { id: 2, type: "Inventory Report", brand: "Primal Pet Foods", brand_slug: "primal_pet_foods", category: "inventory", agency: "BBF", audience: "Internal", cadence: "Adhoc", option: "", date: "2026-05-18", filename: "inventory_primal_pet_foods_internal_bbf_20260518.html", path_html: "sample_report.html", path_pdf: "", path_pptx: "", size: "412 KB", version: 1, version_count: 1 },
];

const reports = (typeof window !== "undefined" && Array.isArray(window.realReports) && window.realReports.length > 0)
  ? window.realReports
  : fallbackReports;

const USING_REAL_DATA = reports === window.realReports;

// ────────────────────────────────────────────────────────────────────
// Path resolution.
//
// The manifest (reports_data.js) stores paths relative to the `reports/`
// folder, e.g. "bbf/zupreem/sales/foo.html". To open them from inside
// webapp_prototype/index.html (file://), we need to climb out one level
// and into reports/. In production (FastAPI serving / from project root),
// change REPORTS_BASE_PATH to "/reports/" (or "" if the API streams them).
// ────────────────────────────────────────────────────────────────────
// test_deployment override: reports sit next to index.html under
// static/reports/<...>, so the prefix is "./reports/" relative to the
// page URL (/app/static/index.html on Streamlit Cloud).
const REPORTS_BASE_PATH = "./reports/";

function resolvePath(p) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p) || p.startsWith("/")) return p;
  // Build URL relative to the directory the page is loaded from, so it works
  // identically whether opened as file:// or served over HTTP.
  return new URL(REPORTS_BASE_PATH + p, document.baseURI).href;
}

// ────────────────────────────────────────────────────────────────────
// Color palette for brand accent bars — Cheddy chart colors, cycled.
// ────────────────────────────────────────────────────────────────────
const BRAND_COLORS = {
  "Primal Pet Foods":    "#F19E39",
  "Canine Butcher Shop": "#D32229",
  "Boundless Hound":     "#2E3090",
  "Charlee Bear":        "#5B62C0",
  "Kinn":                "#60646D",
  "Dave's Pet Food":     "#196B24",
  "Fruitables":          "#FFB86C",
  "Finfare":             "#7B83D3",
  "Vet's Plus":          "#A55A1F",
  "ZuPreem":             "#0F4F1B",
  "Liteband":            "#D32229",
  "Zerowater":           "#2E3090",
  "Culligan":            "#F19E39",
  "Fidobiotics":         "#5B62C0",
  "Happy Jack":          "#A0522D",
  "Himalayan":           "#8B4513",
  "Maple Valley Coop":   "#2E8B57",
  "Natoo":               "#9370DB",
  "Oxbow":               "#CD853F",
  "Poochpad":            "#FF6347",
  "Diggin Your Dog":     "#4682B4",
  "BBF Agency":          "#2E3090",
  "Agency-wide":         "#60646D",
  "Cross-agency":        "#60646D",
};

// Deterministic color for any unmapped brand (consistent across reloads)
function colorForBrand(brand) {
  if (BRAND_COLORS[brand]) return BRAND_COLORS[brand];
  const palette = ["#2E3090", "#F19E39", "#D32229", "#5B62C0", "#60646D", "#196B24", "#7B83D3", "#FFB86C"];
  let h = 0;
  for (const ch of brand) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

// ────────────────────────────────────────────────────────────────────
// Content tags — what topics each report type covers. Helps the reader
// scan a card and know whether it has Sales, Advertising, Inventory, etc.
// Keyed by report type; falls back to the report's `category` field.
// ────────────────────────────────────────────────────────────────────
const TYPE_TAGS = {
  "Weekly Snapshot":  ["Sales", "Advertising", "Traffic", "Conversion"],
  "Inventory Report": ["Inventory", "Forecast", "Reorder", "Low Stock"],
};

function tagsFor(report) {
  if (TYPE_TAGS[report.type]) return TYPE_TAGS[report.type];
  if (report.category) {
    return [report.category.charAt(0).toUpperCase() + report.category.slice(1)];
  }
  return [];
}

function tagClass(tag) {
  return tag.toLowerCase().replace(/\s+/g, "");
}

// ────────────────────────────────────────────────────────────────────
// Report kind + frequency classification
// "Kind" = Snapshot vs Adhoc (Snapshot if the report type contains
// "Snapshot"; everything else is Adhoc).
// "Frequency" = Daily / Weekly / Monthly. Comes from the report's
// `cadence` field. Reports with cadence "Adhoc" don't carry granular
// timing yet, so they match any frequency choice (wildcard) until the
// manifest gains a dedicated `frequency` field.
// ────────────────────────────────────────────────────────────────────
function isSnapshotReport(report) {
  return /snapshot/i.test(report.type || "");
}

function matchesKind(report, value) {
  if (!value) return true;
  if (value === "snapshot") return isSnapshotReport(report);
  if (value === "adhoc") return !isSnapshotReport(report);
  return true;
}

function matchesFrequency(report, value) {
  if (!value) return true;
  const cadence = (report.cadence || "").toLowerCase();
  const freq = (report.frequency || "").toLowerCase(); // future-proofing
  if (freq) return freq === value;
  if (cadence === "adhoc") return true; // wildcard — unknown granularity
  return cadence === value;
}

// ────────────────────────────────────────────────────────────────────
// Pagination
// ────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

// ────────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────────
let state = {
  search: "",
  brand: "",
  type: "",
  tag: "",
  kind: "",
  frequency: "",
  agency: "",
  fromDate: "",
  toDate: "",
  sortNewest: true,
  page: 1,
};

// ────────────────────────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────────────────────────
function init() {
  populateDropdown("brandFilter", uniqueValues("brand"));
  populateDropdown("typeFilter", uniqueValues("type"));
  populateDropdown("tagFilter", uniqueTags());

  const totalLine = USING_REAL_DATA
    ? `${reports.length} reports • from <code style="background:rgba(255,255,255,0.18); padding:2px 6px; border-radius:3px;">reports/</code>`
    : `${reports.length} reports (mock)`;
  document.getElementById("totalCount").innerHTML = totalLine;

  bindEvents();
  render();
}

function uniqueValues(field) {
  return [...new Set(reports.map(r => r[field]).filter(Boolean))].sort();
}

function uniqueTags() {
  const set = new Set();
  reports.forEach(r => tagsFor(r).forEach(t => set.add(t)));
  return [...set].sort();
}

function populateDropdown(id, values) {
  const sel = document.getElementById(id);
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function bindEvents() {
  // Any filter change resets to page 1 so the user doesn't end up on an empty page.
  const onFilterChange = (key) => (e) => { state[key] = e.target.value; state.page = 1; render(); };
  document.getElementById("search").addEventListener("input", e => { state.search = e.target.value.toLowerCase(); state.page = 1; render(); });
  document.getElementById("brandFilter").addEventListener("change", onFilterChange("brand"));
  document.getElementById("typeFilter").addEventListener("change", onFilterChange("type"));
  document.getElementById("tagFilter").addEventListener("change", onFilterChange("tag"));
  document.getElementById("kindFilter").addEventListener("change", onFilterChange("kind"));
  document.getElementById("frequencyFilter").addEventListener("change", onFilterChange("frequency"));
  document.getElementById("agencyFilter").addEventListener("change", onFilterChange("agency"));
  document.getElementById("fromDate").addEventListener("change", onFilterChange("fromDate"));
  document.getElementById("toDate").addEventListener("change", onFilterChange("toDate"));
  document.getElementById("sortToggle").addEventListener("click", e => {
    state.sortNewest = !state.sortNewest;
    state.page = 1;
    e.target.textContent = state.sortNewest ? "Newest first ↓" : "Oldest first ↑";
    render();
  });
  document.getElementById("clearFilters").addEventListener("click", () => {
    state = { search: "", brand: "", type: "", tag: "", kind: "", frequency: "", agency: "", fromDate: "", toDate: "", sortNewest: true, page: 1 };
    document.getElementById("search").value = "";
    document.getElementById("brandFilter").value = "";
    document.getElementById("typeFilter").value = "";
    document.getElementById("tagFilter").value = "";
    document.getElementById("kindFilter").value = "";
    document.getElementById("frequencyFilter").value = "";
    document.getElementById("agencyFilter").value = "";
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
    document.getElementById("sortToggle").textContent = "Newest first ↓";
    render();
  });
}

// ────────────────────────────────────────────────────────────────────
// Filter + sort + render
// ────────────────────────────────────────────────────────────────────
function applyFilters(items) {
  return items.filter(r => {
    const rTags = tagsFor(r);
    if (state.search) {
      const hay = `${r.brand} ${r.type} ${r.filename} ${r.audience} ${r.agency} ${r.category || ""} ${r.option || ""} ${rTags.join(" ")}`.toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    if (state.brand && r.brand !== state.brand) return false;
    if (state.type && r.type !== state.type) return false;
    if (state.tag && !rTags.includes(state.tag)) return false;
    if (state.kind && !matchesKind(r, state.kind)) return false;
    if (state.frequency && !matchesFrequency(r, state.frequency)) return false;
    if (state.agency && r.agency !== state.agency) return false;
    if (state.fromDate && r.date < state.fromDate) return false;
    if (state.toDate && r.date > state.toDate) return false;
    return true;
  });
}

function sortReports(items) {
  return [...items].sort((a, b) =>
    state.sortNewest ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
  );
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ────────────────────────────────────────────────────────────────────
// Schedule helpers — compute Last / Next Scheduled Run from existing
// manifest fields (date + cadence). Pure client-side; no manifest changes.
// When real scheduling lands, replace these with values from the API.
// ────────────────────────────────────────────────────────────────────
const CADENCE_INTERVAL_DAYS = { Daily: 1, Weekly: 7, Monthly: 30 };
const SCHEDULED_HOUR = 6; // default run hour for the prototype

function computeLastRun(report) {
  // Use the report's date (YYYY-MM-DD from filename) at the standard run hour.
  if (!report.date) return null;
  const [y, m, d] = report.date.split("-").map(Number);
  return new Date(y, m - 1, d, SCHEDULED_HOUR, 0, 0);
}

function computeNextRun(report) {
  const interval = CADENCE_INTERVAL_DAYS[report.cadence];
  if (!interval) return null; // Adhoc / unknown → no next run
  const last = computeLastRun(report);
  if (!last) return null;
  const now = new Date();
  const next = new Date(last);
  while (next <= now) next.setDate(next.getDate() + interval);
  return next;
}

function formatTimestamp(d) {
  if (!d) return "";
  return d.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function renderCard(r) {
  const accent = colorForBrand(r.brand);
  const agencyClass = r.agency === "Cheddy" ? "cheddy" : "bbf";
  const audienceClass = r.audience === "Client" ? "client" : "internal";

  // Format badges + action buttons depend on what's available
  const hasHtml  = !!r.path_html;
  const hasPdf   = !!r.path_pdf;
  const hasPptx  = !!r.path_pptx;

  // Only show non-HTML format badges (HTML is implicit — every report has it).
  const formatBadges = [
    hasPdf   ? '<span class="badge format pdf">PDF</span>'    : "",
    hasPptx  ? '<span class="badge format pptx">PPTX</span>'  : "",
  ].filter(Boolean).join("");

  // View prefers HTML; Download prefers PDF, then HTML, then PPTX
  const viewPath = resolvePath(r.path_html || r.path_pdf || r.path_pptx);
  const downloadPath = resolvePath(r.path_pdf || r.path_html || r.path_pptx);
  const downloadName = (r.path_pdf || r.path_html || r.path_pptx).split("/").pop() || r.filename;

  // Optional pill for inventory option (optA/optB) and version count
  const optionPill = r.option ? `<span class="badge option">${escapeHtml(r.option)}</span>` : "";
  const versionPill = (r.version_count && r.version_count > 1)
    ? `<span class="badge version" title="${r.version_count} versions exist on this date">v${r.version_count}</span>`
    : "";
  const cadencePill = r.cadence ? `<span class="badge cadence">${escapeHtml(r.cadence)}</span>` : "";

  // Content tags — what topics the report covers (Sales, Advertising, etc.)
  const tags = tagsFor(r);
  const contentTags = tags.length
    ? `<div class="content-tags" title="What this report covers">
         ${tags.map(t => `<span class="tag ${tagClass(t)}">${escapeHtml(t)}</span>`).join("")}
       </div>`
    : "";

  // Schedule strip — last/next scheduled run
  const lastRun = computeLastRun(r);
  const nextRun = computeNextRun(r);
  const nextLabel = nextRun ? formatTimestamp(nextRun) : "Pending schedule";
  const nextClass = nextRun ? "schedule-value" : "schedule-value pending";
  const scheduleStrip = `
    <div class="schedule-strip">
      <span class="schedule-cell">
        <span class="schedule-icon">⏱</span>
        <span class="schedule-label">Last Scheduled Run</span>
        <span class="schedule-value">${escapeHtml(formatTimestamp(lastRun))}</span>
      </span>
      <span class="schedule-cell">
        <span class="schedule-icon">⏭</span>
        <span class="schedule-label">Next Scheduled Run</span>
        <span class="${nextClass}">${escapeHtml(nextLabel)}</span>
      </span>
    </div>
  `;

  return `
    <div class="report-card" style="--accent: ${accent}">
      <div class="accent-bar"></div>
      <div class="body">
        <div class="title">${escapeHtml(r.type)} — ${escapeHtml(r.brand)}</div>
        ${contentTags}
        <div class="meta">
          <span>${formatDate(r.date)}</span>
          <span class="dot"></span>
          <span class="badge ${agencyClass}">${escapeHtml(r.agency)}</span>
          <span class="badge ${audienceClass}">${escapeHtml(r.audience)}</span>
          ${cadencePill}
          ${optionPill}
          ${versionPill}
          <span class="dot"></span>
          <span>${escapeHtml(r.size || "")}</span>
        </div>
        <div class="formats">${formatBadges}</div>
        ${scheduleStrip}
        <div class="filename">${escapeHtml(r.filename)}</div>
      </div>
      <div class="actions">
        <a class="btn btn-view" href="${viewPath}" target="_blank" rel="noopener">View</a>
        <a class="btn btn-download" href="${downloadPath}" download="${escapeHtml(downloadName)}">Download</a>
      </div>
    </div>
  `;
}

function render() {
  const filtered = sortReports(applyFilters(reports));
  const list = document.getElementById("reportsList");
  const pagerEl = document.getElementById("pagination");
  const pagerInfoEl = document.getElementById("paginationInfo");

  const total = reports.length;
  const count = filtered.length;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (state.page > pageCount) state.page = pageCount;
  if (state.page < 1) state.page = 1;

  if (count === 0) {
    list.innerHTML = `
      <div class="empty">
        <h3>No reports match your filters</h3>
        <div>Try clearing filters or broadening your date range.</div>
      </div>
    `;
    pagerEl.innerHTML = "";
    pagerInfoEl.textContent = "";
  } else {
    const start = (state.page - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, count);
    list.innerHTML = filtered.slice(start, end).map(renderCard).join("");
    renderPagination(pageCount);
    pagerInfoEl.textContent = pageCount > 1
      ? `Page ${state.page} of ${pageCount} — showing ${start + 1}–${end} of ${count}`
      : "";
  }

  document.getElementById("resultCount").textContent =
    count === total
      ? `Showing all ${total} reports`
      : `Showing ${count} of ${total} reports`;
}

// ────────────────────────────────────────────────────────────────────
// Pagination renderer — Prev / page numbers (with ellipses) / Next.
// Keeps the control compact even with many pages.
// ────────────────────────────────────────────────────────────────────
function renderPagination(pageCount) {
  const pagerEl = document.getElementById("pagination");
  if (pageCount <= 1) { pagerEl.innerHTML = ""; return; }

  const current = state.page;
  const pages = [];

  // Always show: 1, current-1, current, current+1, last, with ellipses for gaps.
  const wanted = new Set([1, pageCount, current - 1, current, current + 1]);
  const visible = [...wanted].filter(p => p >= 1 && p <= pageCount).sort((a, b) => a - b);

  let prev = 0;
  for (const p of visible) {
    if (p - prev > 1) pages.push("ellipsis");
    pages.push(p);
    prev = p;
  }

  const parts = [];
  parts.push(`<button id="prevPage" ${current === 1 ? "disabled" : ""}>‹ Prev</button>`);
  for (const p of pages) {
    if (p === "ellipsis") {
      parts.push(`<span class="ellipsis">…</span>`);
    } else {
      parts.push(`<button class="page-btn ${p === current ? "active" : ""}" data-page="${p}">${p}</button>`);
    }
  }
  parts.push(`<button id="nextPage" ${current === pageCount ? "disabled" : ""}>Next ›</button>`);
  pagerEl.innerHTML = parts.join("");

  pagerEl.querySelectorAll(".page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.page = parseInt(btn.dataset.page, 10);
      render();
      window.scrollTo({ top: document.querySelector(".filters").offsetTop - 16, behavior: "smooth" });
    });
  });
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  if (prevBtn) prevBtn.addEventListener("click", () => { if (state.page > 1) { state.page--; render(); window.scrollTo({ top: document.querySelector(".filters").offsetTop - 16, behavior: "smooth" }); } });
  if (nextBtn) nextBtn.addEventListener("click", () => { if (state.page < pageCount) { state.page++; render(); window.scrollTo({ top: document.querySelector(".filters").offsetTop - 16, behavior: "smooth" }); } });
}

document.addEventListener("DOMContentLoaded", init);
