import { getSessionIdFromCookie, getSObjectDescribe, getSObjectList, requestSalesforceApi } from "../modules/salesforce-api.js";
import { renderPageChrome } from "../modules/page-chrome.js";
import { dataExportColumnVisibilityStorageKey, dataExportPreferencesBroadcastChannel, dataExportPreferencesStorageKey, getDefaultDataExportPreferences, getStoredDataExportColumnVisibility, getStoredDataExportPreferences, getStoredTheme, setStoredDataExportColumnVisibility, themeBroadcastChannel } from "../modules/preferences.js";
import { SOQL_FUNCTIONS, SOQL_KEYWORDS, buildSoqlSuggestions, fieldMetadataText, fieldTypeBadge, formatSoql, getSoqlContext, validateSoql } from "../modules/soql-language.js";
import "./data-export.css";
import "monaco-editor/esm/vs/editor/editor.api.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
  function copyExcelResults() { setActionStatus(copyExcelStatus, "Copying..."); const transfer = buildTransferRows(); const html = excelTableMarkup(transfer); const plain = [transfer.columns, ...transfer.rows.map((row) => transfer.columns.map((column) => formatCellValue(row[column])))].map((line) => line.join("\t")).join("\n"); const finish = (success, detail) => { setActionStatus(copyExcelStatus, success ? "Copied" : "Failed", success ? "success" : "error", success ? 1400 : 2200); setStatus(success ? "Excel copied" : "Copy failed", detail, success ? "ready" : "error"); }; const fallback = () => { const textarea = document.createElement("textarea"); textarea.value = plain; textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.appendChild(textarea); textarea.select(); const copied = document.execCommand("copy"); textarea.remove(); finish(copied, copied ? "Tabular data copied for Excel" : "Clipboard permission was denied"); }; try { const timeout = (promise) => Promise.race([promise, new Promise((_, reject) => window.setTimeout(() => reject(new Error("Clipboard request timed out")), 1500))]); if (navigator.clipboard?.write && window.ClipboardItem) { const item = new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) }); timeout(navigator.clipboard.write([item])).then(() => finish(true, `${transfer.rows.length} parent-child rows copied with formatting`)).catch(fallback); return; } if (navigator.clipboard?.writeText) { timeout(navigator.clipboard.writeText(plain)).then(() => finish(true, "Tabular data copied for Excel")).catch(fallback); return; } fallback(); } catch (error) { finish(false, error.message); } }
const starterObject = "Account";
const starterQuery = "SELECT Id, Name FROM Account LIMIT 50";

export function renderDataExport(container) {
  const body = renderPageChrome(container, `
    <div class="export-workspace" aria-label="Data Export workspace">
      <aside class="export-object-explorer" id="export-object-explorer" aria-label="Object and field Explorer">
        <div class="export-panel-heading"><div><h2>Object Explorer</h2></div><button class="export-icon-button" id="export-collapse-explorer" type="button" aria-label="Collapse Object Explorer" aria-expanded="true" title="Collapse Object Explorer"><span class="export-collapse-glyph export-glyph-collapse" aria-hidden="true">‹</span><span class="export-collapse-glyph export-glyph-expand" aria-hidden="true">›</span></button></div>
        <div class="export-explorer-tabs" role="tablist" aria-label="Explorer views"><button class="is-active" id="export-objects-tab" type="button" role="tab" aria-selected="true">Objects</button><button id="export-fields-tab" type="button" role="tab" aria-selected="false">Fields</button></div>
        <label class="export-search-label" for="export-object-search">Filter objects</label>
        <input class="export-control export-search" id="export-object-search" type="search" placeholder="Search objects" autocomplete="off" />
        <div class="export-object-tree" id="export-object-tree" role="tree" aria-label="Salesforce objects"><div class="export-explorer-message is-loading" role="status">Loading objects…</div></div>
        <div class="export-field-explorer" aria-label="Field Explorer">
          <div class="export-subpanel-heading"><span>Fields</span><span class="export-field-count" id="export-field-count">—</span></div>
          <input class="export-control export-search" id="export-field-search" type="search" placeholder="Search fields" autocomplete="off" aria-label="Search fields" />
          <div class="export-field-tree" id="export-field-tree" role="tree" aria-label="Fields for selected object"><div class="export-explorer-message">Select an object</div></div>
          <div class="export-relationship-tree" id="export-relationship-tree" aria-label="Child relationships"></div>
        </div>
        <div class="export-explorer-footer" id="export-explorer-footer">Connecting to Salesforce…</div>
      </aside>
      <div class="export-sidebar-resizer" id="export-left-resizer" role="separator" aria-label="Resize Object Explorer" aria-orientation="vertical" tabindex="0"></div>

      <main class="export-main" aria-label="Data Export editor and results">
        <div class="export-tabbar"><div id="export-query-tabs" class="export-query-tabs" role="tablist" aria-label="Open queries"></div><button class="export-tab-add" type="button" id="export-new-query" title="New query">+</button></div>
        <section class="export-toolbar" aria-label="Export controls">
          <div class="export-toolbar-group export-toolbar-title"><div><h1>Data Export</h1></div></div>
          <div class="export-toolbar-group export-toolbar-controls"><label class="export-field-label" for="export-object-picker-toggle">Object</label><div class="export-object-picker"><select class="export-control export-select export-object-select" id="export-object" aria-hidden="true" tabindex="-1"><option selected>Loading objects…</option></select><button class="export-control export-object-picker-toggle" id="export-object-picker-toggle" type="button" aria-haspopup="listbox" aria-expanded="false" title="Choose Salesforce object">Loading objects…<span aria-hidden="true">⌄</span></button><div class="export-object-picker-menu" id="export-object-picker-menu" hidden><input class="export-control export-object-picker-search" id="export-object-picker-search" type="search" placeholder="Search objects…" autocomplete="off" aria-label="Search Salesforce objects" /><div class="export-object-picker-list" id="export-object-picker-list" role="listbox" aria-label="Salesforce objects"></div></div></div><button class="export-button export-button-secondary" id="export-template" type="button" title="Insert a query template">Templates</button></div>
          <div class="export-toolbar-group export-toolbar-actions"><button class="export-button export-button-secondary" id="export-save" type="button" title="Save query (Ctrl + S)">Save query</button></div>
        </section>

        <section class="export-query-panel export-middle-draggable" aria-label="SOQL query editor"><span class="export-horizontal-drag-handle" title="Drag section horizontally" aria-hidden="true">⋮⋮</span>
          <div class="export-panel-heading export-query-heading"><div><h2>SOQL Editor</h2></div><div class="export-editor-actions"><span class="export-key-hint">Ctrl + Enter · Ctrl + Space · Ctrl + S</span><button class="export-button export-button-secondary" id="export-format" type="button" title="Format SOQL (Shift + Alt + F)">Format</button><button class="export-button export-button-secondary" id="export-validate" type="button" title="Run local SOQL validation">Validate</button><button class="export-button export-button-primary" id="export-editor-execute" type="button" title="Execute query">Execute</button></div></div>
          <div class="export-query-editor" id="export-query" aria-label="SOQL query editor"></div>
          <div class="export-suggestions" id="export-suggestions" aria-label="Field suggestions"><span class="export-suggestion-label">Fields</span><span class="export-suggestion-note">Loading metadata…</span></div>
          <div class="export-query-status" id="export-query-status" role="status" aria-live="polite"><span class="export-status-dot" aria-hidden="true"></span><span>Loading metadata</span><span class="export-status-detail">Authenticating with Salesforce</span></div>
        </section>
        <div class="export-resize-divider" id="export-query-resize-divider" role="separator" aria-label="Resize query editor and results" aria-orientation="horizontal" tabindex="0" title="Drag to resize query editor"><span aria-hidden="true"></span></div>
        <section class="export-progress-panel export-middle-draggable" id="export-progress-panel" aria-live="polite"><span class="export-horizontal-drag-handle" title="Drag section horizontally" aria-hidden="true">⋮⋮</span><div class="export-progress-top"><span class="export-status-dot" id="export-progress-dot"></span><strong id="export-progress-label">Ready to run</strong><span class="export-progress-detail" id="export-progress-detail">No query executed</span><span class="export-progress-metrics" id="export-progress-metrics"></span><button class="export-button export-button-danger" id="export-stop" type="button" disabled>Stop</button></div><div class="export-progress-track"><span id="export-progress-bar"></span></div></section>
        <div class="export-resize-divider" id="export-progress-resize-divider" role="separator" aria-label="Resize progress and results" aria-orientation="horizontal" tabindex="0" title="Drag to resize progress panel"><span aria-hidden="true"></span></div>
        <section class="export-results-panel" aria-label="Query results"><div class="export-panel-heading export-results-heading"><div><h2>Results</h2></div><div class="export-result-actions" aria-label="Result actions"><span class="export-action-with-status"><button class="export-button export-button-quiet" id="export-export" type="button" disabled title="Export CSV">Export CSV</button><span class="export-action-status" id="export-export-status" role="status" aria-live="polite" hidden></span></span><span class="export-action-with-status"><button class="export-button export-button-quiet" id="export-copy" type="button" disabled title="Copy CSV">Copy CSV</button><span class="export-action-status" id="export-copy-status" role="status" aria-live="polite" hidden></span></span><span class="export-action-with-status"><button class="export-button export-button-quiet" id="export-export-excel" type="button" disabled title="Export Excel">Export Excel</button><span class="export-action-status" id="export-export-excel-status" role="status" aria-live="polite" hidden></span></span><span class="export-action-with-status"><button class="export-button export-button-quiet" id="export-copy-excel" type="button" disabled title="Copy Excel">Copy Excel</button><span class="export-action-status" id="export-copy-excel-status" role="status" aria-live="polite" hidden></span></span><button class="export-button export-button-quiet" id="export-columns" type="button" disabled title="Choose visible columns">Columns</button><button class="export-button export-button-quiet" id="export-wrap" type="button" disabled aria-pressed="true" title="Toggle wrapped cells">Wrap text</button><button class="export-button export-button-quiet" id="export-fetch-more" type="button" disabled title="Load the next result page">Auto fetch</button><button class="export-button export-button-quiet export-maximize-button" id="export-maximize-results" type="button" aria-pressed="false" title="Maximize results">⛶</button></div></div><div class="export-table-wrap" id="export-table-wrap" tabindex="0" aria-label="Export result table"><table class="export-table" id="export-results-table"><thead></thead><tbody><tr class="export-empty-row"><td colspan="1"><span class="export-empty-icon" aria-hidden="true">⌁</span><strong>No results yet</strong><span>Run a query to see Salesforce records here.</span></td></tr></tbody></table></div></section>
        <footer class="export-status-footer" aria-label="Result metrics"><span>Fetched rows <strong id="export-footer-rows">0</strong></span><span>Total rows <strong id="export-footer-total-rows">—</strong></span><span>Columns <strong id="export-footer-columns">0</strong></span><span>Elapsed <strong id="export-footer-elapsed">—</strong></span></footer>
      </main>
      <div class="export-sidebar-resizer" id="export-right-resizer" role="separator" aria-label="Resize Query History" aria-orientation="vertical" tabindex="0"></div>
      <aside class="export-history-panel is-collapsed" id="export-history-panel" aria-label="Query History"><div class="export-panel-heading"><div><h2>Query History</h2></div><button class="export-icon-button is-collapsed" id="export-collapse-history" type="button" aria-label="Expand Query History" aria-expanded="false" title="Expand Query History"><span class="export-collapse-glyph export-glyph-collapse" aria-hidden="true">›</span><span class="export-collapse-glyph export-glyph-expand" aria-hidden="true">‹</span></button></div><label class="export-search-label" for="export-history-search">Search queries</label><input class="export-control export-search" id="export-history-search" type="search" placeholder="Search queries…" autocomplete="off" /><div class="export-history-list" id="export-history-list" role="list"><div class="export-explorer-message">No saved queries</div></div><div class="export-explorer-footer"><button class="export-button export-button-secondary" id="export-clear-history" type="button">Clear history</button></div></aside>
    </div>
  `, { headerHtml: "" });

  const sourceOrigin = new URLSearchParams(window.location.search).get("sourceOrigin") || window.location.origin;
  const objectTree = body.querySelector("#export-object-tree");
  const fieldTree = body.querySelector("#export-field-tree");
  const relationshipTree = body.querySelector("#export-relationship-tree");
  const objectSearch = body.querySelector("#export-object-search");
  const fieldSearch = body.querySelector("#export-field-search");
  const objectSelect = body.querySelector("#export-object");
  const objectPickerToggle = body.querySelector("#export-object-picker-toggle");
  const objectPickerMenu = body.querySelector("#export-object-picker-menu");
  const objectPickerSearch = body.querySelector("#export-object-picker-search");
  const objectPickerList = body.querySelector("#export-object-picker-list");
  const fieldCount = body.querySelector("#export-field-count");
  const status = body.querySelector("#export-query-status");
  const suggestions = body.querySelector("#export-suggestions");
  const resultsTable = body.querySelector("#export-results-table");
  const nameColumnObserver = new MutationObserver(() => {
    const header = [...(resultsTable.tHead?.rows[0]?.cells || [])].find((cell) => cell.textContent.trim() === "Name");
    if (!header) return;
    const nameIndex = header.cellIndex;
    header.classList.add("export-name-column");
    resultsTable.tBodies[0]?.querySelectorAll("tr:not(.export-nested-row)").forEach((row) => row.cells[nameIndex]?.classList.add("export-name-column"));
    const idHeader = [...(resultsTable.tHead?.rows[0]?.cells || [])].find((cell) => cell.textContent.trim() === "Id");
    if (idHeader) {
      const idIndex = idHeader.cellIndex;
      idHeader.classList.add("export-id-column");
      resultsTable.tBodies[0]?.querySelectorAll("tr:not(.export-nested-row)").forEach((row) => row.cells[idIndex]?.classList.add("export-id-column"));
    }
    body.querySelector(".export-search-results-button")?.toggleAttribute("disabled", !resultsTable.tBodies[0]?.querySelector("tr:not(.export-empty-row)"));
  });
  nameColumnObserver.observe(resultsTable, { childList: true, subtree: true });
  const tableWrap = body.querySelector("#export-table-wrap");
  const historyList = body.querySelector("#export-history-list");
  const historySearch = body.querySelector("#export-history-search");
  const historyPanel = body.querySelector("#export-history-panel");
  const objectExplorer = body.querySelector("#export-object-explorer");
  const queryTabsHost = body.querySelector("#export-query-tabs");
  const objectTab = body.querySelector("#export-objects-tab");
  const fieldsTab = body.querySelector("#export-fields-tab");
  const fieldExplorer = body.querySelector(".export-field-explorer");
  const exportButton = body.querySelector("#export-export");
  const copyButton = body.querySelector("#export-copy");
  const columnsButton = body.querySelector("#export-columns");
  const fetchMoreButton = body.querySelector("#export-fetch-more");
  const stopButton = body.querySelector("#export-stop");
  const wrapButton = body.querySelector("#export-wrap");
  const maximizeResultsButton = body.querySelector("#export-maximize-results");
  const exportExcelButton = body.querySelector("#export-export-excel");
  const copyExcelButton = body.querySelector("#export-copy-excel");
  const exportStatus = body.querySelector("#export-export-status");
  const copyStatus = body.querySelector("#export-copy-status");
  const exportExcelStatus = body.querySelector("#export-export-excel-status");
  const copyExcelStatus = body.querySelector("#export-copy-excel-status");
  const resultActions = body.querySelector(".export-result-actions");
  let resultSearchTerm = "";
  const resultSearchButton = document.createElement("button");
  resultSearchButton.type = "button";
  resultSearchButton.className = "export-button export-button-quiet export-search-results-button";
  resultSearchButton.textContent = "⌕";
  resultSearchButton.title = "Search result values";
  resultSearchButton.setAttribute("aria-label", "Search result values");
  resultSearchButton.setAttribute("aria-expanded", "false");
  resultSearchButton.disabled = true;
  const resultSearchInput = document.createElement("input");
  resultSearchInput.className = "export-control export-results-search";
  resultSearchInput.type = "search";
  resultSearchInput.placeholder = "Search results...";
  resultSearchInput.setAttribute("aria-label", "Search all result values");
  resultSearchInput.hidden = true;
  resultActions?.insertBefore(resultSearchButton, resultActions.firstChild);
  resultActions?.insertBefore(resultSearchInput, resultSearchButton.nextSibling);
  const progressLabel = body.querySelector("#export-progress-label");
  const progressDetail = body.querySelector("#export-progress-detail");
  const progressMetrics = body.querySelector("#export-progress-metrics");
  const progressBar = body.querySelector("#export-progress-bar");
  const footerRows = body.querySelector("#export-footer-rows");
  const footerTotalRows = body.querySelector("#export-footer-total-rows");
  const footerColumns = body.querySelector("#export-footer-columns");
  const footerElapsed = body.querySelector("#export-footer-elapsed");
  const objects = [];
  const schema = { objects: {} };
  const metadataCache = new Map();
  let sessionId = "";
  let editor = null;
  let editorLayoutFrame = 0;
  function scheduleEditorLayout() {
    if (!editor?.layout || editorLayoutFrame) return;
    editorLayoutFrame = window.requestAnimationFrame(() => {
      editorLayoutFrame = 0;
      editor?.layout();
    });
  }
  function applySoqlEditorTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark-theme", dark);
    window.monaco?.editor?.setTheme(dark ? "lightning-soql-dark" : "lightning-soql-light");
    scheduleEditorLayout();
  }
  let fields = [];
  let focusedFieldName = "";
  let childRelationships = [];
  let selectedObject = starterObject;
  let objectPickerVisibleCount = 80;
  const queryTabs = [{ id: "query-1", label: "Query 1", object: starterObject, query: starterQuery, records: [], nextRecordsUrl: "" }];
  let activeQueryId = "query-1";
  const editorModels = new Map();
  let resultRecords = [];
  let resultColumns = [];
  let allResultColumns = [];
  let nextRecordsUrl = "";
  let totalRecordCount = null;
  let activeRequest = null;
  let dataExportPreferences = getDefaultDataExportPreferences();
  const historyStorageKey = "lc-data-export-history";
  let queryHistory = loadQueryHistory();
  const collapsedRelatedRows = new Set();
  const initializedRelatedRows = new Set();
  let appliedRelatedRecordsExpanded = null;
  const hiddenColumns = new Set();
  let storedHiddenColumnsByObject = {};
  let autoFetchPageCount = 0;
  let autoFetchRunId = 0;
  function applyResultsSearch() { const term = resultSearchTerm.trim().toLowerCase(); let parentVisible = true; [...(resultsTable.tBodies[0]?.rows || [])].forEach((row) => { const nested = row.classList.contains("export-nested-row"); const matches = !term || row.textContent.toLowerCase().includes(term); if (!nested) parentVisible = matches; row.hidden = term ? (!matches && (!nested || !parentVisible)) : false; }); }

  const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  function activeTab() { return queryTabs.find((tab) => tab.id === activeQueryId); }
  function saveActiveTabState() {
    const tab = activeTab();
    if (!tab) return;
    tab.object = selectedObject;
    tab.query = currentQuery();
    tab.records = resultRecords;
    tab.nextRecordsUrl = nextRecordsUrl;
  }
  function renderQueryTabs() {
    queryTabsHost.replaceChildren();
    queryTabs.forEach((tab) => {
      const tabButton = document.createElement("button");
      tabButton.type = "button";
      const saved = tab.saved || queryHistory.some((item) => item.query === tab.query && item.object === tab.object);
      tabButton.className = `export-query-tab${tab.id === activeQueryId ? " is-active" : ""}${saved ? " is-saved" : ""}`;
      tabButton.id = `export-tab-${tab.id}`;
      tabButton.setAttribute("role", "tab");
      tabButton.setAttribute("aria-selected", String(tab.id === activeQueryId));
      tabButton.setAttribute("aria-controls", "export-query");
      tabButton.title = `Activate ${tab.label}`;
      tabButton.innerHTML = `<span class="export-tab-dot" aria-hidden="true"></span><span>${escapeText(tab.label)}</span>`;
      tabButton.addEventListener("click", () => void activateQueryTab(tab.id));
      const close = document.createElement("span");
      close.className = "export-tab-close";
      close.setAttribute("role", "button");
      close.setAttribute("tabindex", "0");
      close.setAttribute("aria-label", `Close ${tab.label}`);
      close.textContent = "×";
      close.addEventListener("click", (event) => { event.stopPropagation(); closeQueryTab(tab.id); });
      close.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); closeQueryTab(tab.id); } });
      tabButton.appendChild(close);
      queryTabsHost.appendChild(tabButton);
    });
  }
  function setStatus(label, detail, state = "ready") { status.innerHTML = `<span class="export-status-dot is-${state}" aria-hidden="true"></span><span>${escapeText(label)}</span><span class="export-status-detail">${escapeText(detail)}</span>`; }
  function setActionStatus(target, message, state = "running", hideAfter = 0) { if (!target) return; target.hidden = false; target.className = `export-action-status is-${state}`; target.textContent = message; if (hideAfter) window.setTimeout(() => { target.hidden = true; }, hideAfter); }
  function setProgress(label, detail, percent = 0, running = false) { const isError = /\b(failed|error)\b/i.test(label); const isSuccess = !isError && /\b(completed|passed|success)\b/i.test(label); progressLabel.textContent = label; progressDetail.textContent = detail; progressBar.style.width = `${isError || isSuccess ? 100 : Math.max(0, Math.min(100, percent))}%`; stopButton.disabled = !running; progressBar.classList.toggle("is-running", running); progressBar.classList.toggle("is-error", isError); progressBar.classList.toggle("is-success", isSuccess); }
  function getStarterQuery(objectName = selectedObject) { return `SELECT Id, Name FROM ${objectName || starterObject} LIMIT ${dataExportPreferences.starterQueryLimit}`; }
  function loadQueryHistory() { try { const entries = JSON.parse(localStorage.getItem(historyStorageKey) || "[]"); return Array.isArray(entries) ? entries.filter((item) => item?.query).slice(0, dataExportPreferences.queryHistoryLimit) : []; } catch { return []; } }
  function persistQueryHistory() { if (!dataExportPreferences.queryHistoryEnabled) return; queryHistory = queryHistory.slice(0, dataExportPreferences.queryHistoryLimit); try { localStorage.setItem(historyStorageKey, JSON.stringify(queryHistory)); } catch { /* storage is optional */ } }
  function clearQueryHistory() { queryHistory = []; try { localStorage.removeItem(historyStorageKey); } catch { /* storage is optional */ } }
  function restoreHiddenColumnsForObject(objectName = selectedObject) { hiddenColumns.clear(); if (!dataExportPreferences.rememberVisibleColumns || !objectName) return; (storedHiddenColumnsByObject[objectName] || []).forEach((column) => hiddenColumns.add(column)); }
  function persistHiddenColumnsForObject() { if (!dataExportPreferences.rememberVisibleColumns || !selectedObject) return; const next = { ...storedHiddenColumnsByObject }; if (hiddenColumns.size) next[selectedObject] = [...hiddenColumns]; else delete next[selectedObject]; storedHiddenColumnsByObject = next; void setStoredDataExportColumnVisibility(next).catch(() => {}); }
  function initializeRelatedRow(relatedId) { if (initializedRelatedRows.has(relatedId)) return; initializedRelatedRows.add(relatedId); if (dataExportPreferences.relatedRecordsExpanded) collapsedRelatedRows.delete(relatedId); else collapsedRelatedRows.add(relatedId); }
  function currentQuery() { return editor?.getValue?.() || ""; }
  function setQueryValue(value) { if (!editor) return; editor.setValue(String(value || "")); const tab = activeTab(); if (tab) tab.query = editor.getValue(); renderQueryTabs(); editor.focus(); }
  function renderHistory() {
    if (!dataExportPreferences.queryHistoryEnabled) { historyList.replaceChildren(); const message = document.createElement("div"); message.className = "export-explorer-message"; message.textContent = "Query history is disabled in Data Export preferences"; historyList.appendChild(message); return; }
    const term = String(historySearch.value || "").trim().toLowerCase(); const visible = queryHistory.filter((item) => `${item.label} ${item.query} ${item.object}`.toLowerCase().includes(term));
    historyList.replaceChildren(); if (!visible.length) { const message = document.createElement("div"); message.className = "export-explorer-message"; message.textContent = queryHistory.length ? "No matching queries" : "No saved queries"; historyList.appendChild(message); return; }
    visible.forEach((item) => { const row = document.createElement("div"); row.className = "export-history-item"; row.setAttribute("role", "listitem"); const button = document.createElement("button"); button.type = "button"; button.className = "export-history-load"; button.innerHTML = `<span class="export-history-star" aria-hidden="true">${item.favorite ? "★" : "☆"}</span><span class="export-history-copy"><strong>${escapeText(item.label)}</strong><small>${escapeText(formatHistoryDate(item.updatedAt))}</small></span>`; button.title = item.query; button.addEventListener("click", () => { void loadHistoryQuery(item); }); const menu = document.createElement("button"); menu.type = "button"; menu.className = "export-history-menu"; menu.textContent = "•••"; menu.title = "Delete query"; menu.addEventListener("click", () => { queryHistory = queryHistory.filter((entry) => entry.id !== item.id); persistQueryHistory(); renderHistory(); renderQueryTabs(); }); row.append(button, menu); historyList.appendChild(row); });
  }
  async function loadHistoryQuery(item) {
    const objectName = item.object || selectedObject;
    const tab = activeTab();
    if (tab) {
      tab.object = objectName;
      tab.query = String(item.query || "");
    }
    selectedObject = objectName;
    setQueryValue(item.query);
    objectSelect.value = objectName;
    await selectObject(objectName);
    setStatus("Query loaded", item.label);
  }
  function formatHistoryDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Saved query" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
  function saveCurrentQuery() { if (!dataExportPreferences.queryHistoryEnabled) { setStatus("Query history disabled", "Enable query history in Data Export preferences to save queries"); return; } const query = currentQuery().trim(); if (!query) { setStatus("Cannot save", "Enter a SOQL query first", "error"); return; } const label = window.prompt("Query name", `${selectedObject} query`); if (!label?.trim()) return; const existing = queryHistory.find((item) => item.label.toLowerCase() === label.trim().toLowerCase()); const item = { id: existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`, label: label.trim(), query, object: selectedObject, updatedAt: Date.now(), favorite: existing?.favorite === true }; queryHistory = [item, ...queryHistory.filter((entry) => entry.id !== item.id)]; persistQueryHistory(); renderHistory(); renderQueryTabs(); setStatus("Query saved", item.label); }
  function formatCellValue(value) { if (value === null || value === undefined) return "—"; if (typeof value === "object") return Array.isArray(value) ? `${value.length} related records` : Object.values(value).filter((entry) => entry !== null && typeof entry !== "object").join(" · ") || "—"; return String(value); }
  function flattenRecord(record, prefix = "", output = {}) { Object.entries(record || {}).forEach(([key, value]) => { if (key === "attributes") return; const name = prefix ? `${prefix}.${key}` : key; if (value && typeof value === "object" && !Array.isArray(value)) { if (Array.isArray(value.records)) output[name] = value.records; else flattenRecord(value, name, output); } else output[name] = value; }); return output; }
  function relationshipArrays(record, prefix = "", output = []) { Object.entries(record || {}).forEach(([key, value]) => { if (key === "attributes" || !value || typeof value !== "object" || Array.isArray(value)) return; const name = prefix ? `${prefix}.${key}` : key; if (Array.isArray(value.records)) output.push({ name, records: value.records }); else relationshipArrays(value, name, output); }); return output; }
  function buildTransferRows() { const rows = []; const columnSet = new Set(); let hasRelationships = false; resultRecords.forEach((record) => { const parent = flattenRecord(record); const relationships = relationshipArrays(record); const parentFields = Object.fromEntries(Object.entries(parent).filter(([, value]) => !Array.isArray(value))); relationships.length && (hasRelationships = true); if (!relationships.length) { rows.push(parentFields); Object.keys(parentFields).forEach((column) => columnSet.add(column)); return; } relationships.forEach(({ name, records }) => { if (!records.length) { const row = { ...parentFields, Relationship: name }; rows.push(row); Object.keys(row).forEach((column) => columnSet.add(column)); return; } records.forEach((child) => { const childFields = flattenRecord(child); const row = { ...parentFields, Relationship: name }; Object.entries(childFields).forEach(([column, value]) => { if (!Array.isArray(value)) row[`${name}.${column}`] = value; }); rows.push(row); Object.keys(row).forEach((column) => columnSet.add(column)); }); }); }); let columns = [...columnSet]; if (hasRelationships) columns = ["Relationship", ...columns.filter((column) => column !== "Relationship")]; columns = columns.filter((column) => !hiddenColumns.has(column)); return { columns, rows }; }
  function deriveColumns(records) { const columns = []; const seen = new Set(); records.forEach((record) => { Object.keys(flattenRecord(record)).forEach((key) => { if (!seen.has(key)) { seen.add(key); columns.push(key); } }); }); return columns; }
  function createQueryTab() {
    saveActiveTabState();
    const number = queryTabs.length + 1;
    const id = `query-${Date.now()}-${number}`;
    queryTabs.push({ id, label: `Query ${number}`, object: selectedObject, query: getStarterQuery(selectedObject), records: [], nextRecordsUrl: "" });
    void activateQueryTab(id);
  }
  function closeQueryTab(id) {
    if (queryTabs.length === 1) { setStatus("Query tab kept", "At least one query tab must remain open"); return; }
    const index = queryTabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    const wasActive = id === activeQueryId;
    const model = editorModels.get(id);
    model?.dispose();
    editorModels.delete(id);
    queryTabs.splice(index, 1);
    if (wasActive) {
      const next = queryTabs[Math.max(0, index - 1)] || queryTabs[0];
      void activateQueryTab(next.id);
    } else renderQueryTabs();
  }
  async function activateQueryTab(id) {
    const next = queryTabs.find((tab) => tab.id === id);
    if (!next) return;
    if (id !== activeQueryId) saveActiveTabState();
    activeQueryId = id;
    selectedObject = next.object || starterObject;
    restoreHiddenColumnsForObject(selectedObject);
    resultRecords = next.records || [];
    nextRecordsUrl = next.nextRecordsUrl || "";
    renderQueryTabs();
    if (editor && window.monaco) {
      let model = editorModels.get(id);
      if (!model || model.isDisposed()) {
        model = window.monaco.editor.createModel(next.query || getStarterQuery(selectedObject), "soql", window.monaco.Uri.parse(`inmemory://data-export/${id}`));
        editorModels.set(id, model);
      }
      editor.setModel(model);
    }
    renderObjectSelect();
    renderObjectTree();
    const cached = schema.objects[selectedObject];
    fields = cached?.fields || [];
    childRelationships = cached?.childRelationships || [];
    renderFields();
    renderSuggestions();
    renderChildRelationships();
    renderResults();
    fetchMoreButton.disabled = !nextRecordsUrl;
    if (!fields.length && sessionId) await selectObject(selectedObject);
    setStatus("Query active", `${next.label} · ${selectedObject}`);
  }
  function renderResults() {
    const hasResults = resultRecords.length > 0;
    exportButton.disabled = !hasResults;
    copyButton.disabled = !hasResults;
    exportExcelButton.disabled = !hasResults;
    copyExcelButton.disabled = !hasResults;
    columnsButton.disabled = !hasResults;
    wrapButton.disabled = !hasResults;
    allResultColumns = deriveColumns(resultRecords);
    resultColumns = deriveColumns(resultRecords).filter((column) => !hiddenColumns.has(column)); const head = resultsTable.tHead || resultsTable.createTHead(); head.replaceChildren(); const headerRow = head.insertRow(); const numberHeader = document.createElement("th"); numberHeader.scope = "col"; numberHeader.textContent = "#"; headerRow.appendChild(numberHeader); resultColumns.forEach((column) => { const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = column; headerRow.appendChild(cell); }); const bodyRows = resultsTable.tBodies[0] || resultsTable.createTBody(); bodyRows.replaceChildren(); if (!resultRecords.length) { const row = bodyRows.insertRow(); row.className = "export-empty-row"; const cell = row.insertCell(); cell.colSpan = Math.max(1, resultColumns.length + 1); cell.innerHTML = `<span class="export-empty-icon" aria-hidden="true">⌁</span><strong>No results yet</strong><span>Run a query to see Salesforce records here.</span>`; return; }
    resultRecords.forEach((record, rowIndex) => {
      const row = bodyRows.insertRow();
      const numberCell = row.insertCell();
      numberCell.textContent = String(rowIndex + 1);
      const flattened = flattenRecord(record);
      resultColumns.forEach((column) => {
        const cell = row.insertCell();
        const value = flattened[column];
        if (!Array.isArray(value)) { cell.textContent = formatCellValue(value); return; }
        const relatedId = relatedRowId(record, rowIndex, column);
        initializeRelatedRow(relatedId);
        const summary = document.createElement("span");
        summary.className = "export-related-summary";
        summary.setAttribute("role", "button");
        summary.tabIndex = 0;
        summary.setAttribute("aria-controls", relatedId);
        summary.setAttribute("aria-expanded", String(!collapsedRelatedRows.has(relatedId)));
        summary.title = `${collapsedRelatedRows.has(relatedId) ? "Expand" : "Collapse"} ${value.length} ${value.length === 1 ? "related record" : "related records"}`;
        summary.innerHTML = `<span class="export-related-icon" aria-hidden="true">↳</span><span>${value.length} ${value.length === 1 ? "related record" : "related records"}</span>`;
        const toggle = () => {
          const nestedRow = document.getElementById(relatedId);
          if (!nestedRow) return;
          const expanded = nestedRow.hidden;
          nestedRow.hidden = !expanded;
          if (expanded) collapsedRelatedRows.delete(relatedId); else collapsedRelatedRows.add(relatedId);
          summary.setAttribute("aria-expanded", String(expanded));
          summary.title = `${expanded ? "Collapse" : "Expand"} ${value.length} ${value.length === 1 ? "related record" : "related records"}`;
        };
        summary.addEventListener("click", toggle);
        summary.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } });
        cell.appendChild(summary);
      });
      relationshipArrays(record).forEach(({ name, records }) => { const relatedId = relatedRowId(record, rowIndex, name); initializeRelatedRow(relatedId); appendNestedRows(bodyRows, record, rowIndex, records, name, relatedId); });
    });
    footerRows.textContent = String(resultRecords.length); footerTotalRows.textContent = totalRecordCount === null ? "—" : String(totalRecordCount); footerColumns.textContent = String(resultColumns.length); exportButton.disabled = !resultRecords.length; copyButton.disabled = !resultRecords.length; columnsButton.disabled = !resultRecords.length; wrapButton.disabled = !resultRecords.length;
  }
  function relatedRowId(record, rowIndex, relationship) { return `export-related-${encodeURIComponent(record?.Id || rowIndex)}-${encodeURIComponent(relationship)}`; }
  function appendNestedRows(tbody, record, rowIndex, values, relationship, relatedId) { if (!Array.isArray(values)) return; const row = tbody.insertRow(); row.id = relatedId; row.hidden = collapsedRelatedRows.has(relatedId); row.className = "export-nested-row"; const cell = row.insertCell(); cell.colSpan = Math.max(1, resultColumns.length + 1); const panel = document.createElement("div"); panel.className = "export-nested-panel"; const heading = document.createElement("div"); heading.className = "export-nested-heading"; heading.innerHTML = `<span class="export-nested-icon" aria-hidden="true">↳</span><strong>${escapeText(relationship)}</strong><span class="export-nested-count">${values.length} ${values.length === 1 ? "related record" : "related records"}</span>`; panel.appendChild(heading); if (!values.length) { const empty = document.createElement("span"); empty.className = "export-nested-empty"; empty.textContent = "No related records"; panel.appendChild(empty); } else { const nestedTable = document.createElement("table"); nestedTable.className = "export-nested-table"; const nestedColumns = deriveColumns(values).filter((column) => !hiddenColumns.has(column)); const widths = nestedColumns.map((column) => { const longest = Math.max(column.length, ...values.slice(0, 50).map((value) => formatCellValue(flattenRecord(value)[column]).length)); return Math.max(120, Math.min(280, longest * 7 + 28)); }); nestedTable.style.width = `${widths.reduce((total, width) => total + width, 0)}px`; nestedTable.style.minWidth = "100%"; const colgroup = document.createElement("colgroup"); widths.forEach((width) => { const col = document.createElement("col"); col.style.width = `${width}px`; colgroup.appendChild(col); }); nestedTable.appendChild(colgroup); const nestedHead = nestedTable.createTHead().insertRow(); nestedColumns.forEach((column) => { const th = document.createElement("th"); th.textContent = column; nestedHead.appendChild(th); }); const nestedBody = nestedTable.createTBody(); values.forEach((value) => { const nestedRow = nestedBody.insertRow(); const flattened = flattenRecord(value); nestedColumns.forEach((column) => { const nestedCell = nestedRow.insertCell(); if (column === "Id") nestedCell.classList.add("export-child-id"); nestedCell.textContent = formatCellValue(flattened[column]); }); }); panel.appendChild(nestedTable); } cell.appendChild(panel); }
  function normalizeNextPath(url) { const value = String(url || ""); const match = value.match(/\/services\/data\/v[\d.]+(\/.*)$/); return match?.[1] || value; }
  async function executeQuery(loadMore = false) {
    let scheduleAutoFetch = false;
    let fetchRunId = autoFetchRunId;
    if (!loadMore) {
      const local = validateSoql(currentQuery());
      if (!local.valid) {
        applyLocalValidation();
        setProgress("Query blocked", "Fix local syntax issues before executing", 0, false);
        return;
      }
      autoFetchRunId += 1;
      fetchRunId = autoFetchRunId;
      autoFetchPageCount = 0;
      collapsedRelatedRows.clear();
      initializedRelatedRows.clear();
      resultRecords = [];
      nextRecordsUrl = "";
      totalRecordCount = null;
      const tab = activeTab();
      if (tab) {
        tab.records = [];
        tab.nextRecordsUrl = "";
      }
      renderResults();
    }
    if (!sessionId) {
      setProgress("Query blocked", "Salesforce session is unavailable", 0, false);
      return;
    }

    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    const started = performance.now();
    setProgress(loadMore ? "Loading more records" : "Executing query", loadMore ? "Fetching next result page" : "Requesting Salesforce records", 12, true);
    try {
      const path = loadMore && nextRecordsUrl ? nextRecordsUrl : `/query?q=${encodeURIComponent(currentQuery())}`;
      const response = await requestSalesforceApi(sessionId, sourceOrigin, path, { method: "GET", signal: request.signal }, { apiType: "" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.[0]?.message || payload?.message || response.statusText || "Salesforce query failed.");
      if (Number.isFinite(payload?.totalSize)) totalRecordCount = payload.totalSize;
      resultRecords = [...resultRecords, ...(payload?.records || [])];
      nextRecordsUrl = payload?.nextRecordsUrl ? normalizeNextPath(payload.nextRecordsUrl) : "";
      const tab = activeTab();
      if (tab) {
        tab.records = resultRecords;
        tab.nextRecordsUrl = nextRecordsUrl;
      }
      renderResults();
      const elapsed = ((performance.now() - started) / 1000).toFixed(1);
      footerElapsed.textContent = `${elapsed}s`;
      progressMetrics.textContent = `${resultRecords.length} loaded${payload?.totalSize ? ` of ${payload.totalSize}` : ""}`;
      const canAutoFetch = dataExportPreferences.autoFetchEnabled
        && Boolean(nextRecordsUrl)
        && autoFetchPageCount < dataExportPreferences.autoFetchMaxPages;
      if (canAutoFetch) autoFetchPageCount += 1;
      const detail = nextRecordsUrl
        ? canAutoFetch
          ? `Auto-fetching page ${autoFetchPageCount} of ${dataExportPreferences.autoFetchMaxPages}`
          : dataExportPreferences.autoFetchEnabled
            ? "Auto-fetch limit reached; load more manually"
            : "More records available"
        : "All available records loaded";
      setProgress("Query completed successfully", detail, nextRecordsUrl ? 82 : 100, false);
      fetchMoreButton.disabled = !nextRecordsUrl;
      scheduleAutoFetch = canAutoFetch;
    } catch (error) {
      if (error?.name === "AbortError") {
        setProgress("Query stopped", `${resultRecords.length} rows retained`, 0, false);
      } else {
        setProgress("Query failed", error?.message || "Salesforce query failed.", 0, false);
      }
    } finally {
      if (activeRequest === request) activeRequest = null;
      if (scheduleAutoFetch && autoFetchRunId === fetchRunId && nextRecordsUrl) {
        window.setTimeout(() => {
          if (autoFetchRunId === fetchRunId && nextRecordsUrl && !activeRequest) void executeQuery(true);
        }, 0);
      }
    }
  }
  /*
  function copyResults() { setActionStatus(copyStatus, "Copying…"); const transfer = buildTransferRows(); const lines = [transfer.columns, ...transfer.rows.map((row) => transfer.columns.map((column) => formatCellValue(row[column])))]; const text = lines.map((line) => line.join("\t")).join("\n"); if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).then(() => { setActionStatus(copyStatus, "Copied", "success", 1400); setStatus("Copied", `${transfer.rows.length} parent-child rows copied to clipboard`)}).catch(() => { setActionStatus(copyStatus, "Failed", "error", 2200); setStatus("Copy failed", "Clipboard permission was denied", "error")); return; } const fallback = document.createElement("textarea"); fallback.value = text; document.body.appendChild(fallback); fallback.select(); const copied = document.execCommand("copy"); fallback.remove(); setActionStatus(copyStatus, copied ? "Copied" : "Failed", copied ? "success" : "error", copied ? 1400 : 2200); setStatus(copied ? "Copied" : "Copy failed", copied ? `${transfer.rows.length} parent-child rows copied to clipboard` : "Clipboard permission was denied", copied ? "ready" : "error"); }
  function exportResults() { setActionStatus(exportStatus, "Exporting…"); const transfer = buildTransferRows(); const lines = [transfer.columns, ...transfer.rows.map((row) => transfer.columns.map((column) => `"${formatCellValue(row[column]).replace(/"/g, '""')}"`))]; const blob = new Blob([lines.map((line) => line.join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${selectedObject || "salesforce"}-export.csv`; link.click(); URL.revokeObjectURL(url); setActionStatus(exportStatus, "Downloaded", "success", 1400); setStatus("Export complete", `${transfer.rows.length} parent-child rows downloaded`); }
*/   function excelCell(value) { return escapeText(formatCellValue(value)); }
  function excelTableMarkup(transfer) { const header = transfer.columns.map((column) => `<th>${excelCell(column)}</th>`).join(""); const rows = transfer.rows.map((row) => `<tr>${transfer.columns.map((column) => `<td class="${column === "Relationship" ? "relationship" : ""}">${excelCell(row[column])}</td>`).join("")}</tr>`).join(""); return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:10pt}th{background:#0b66a1;color:#fff;font-weight:bold;padding:7px 10px;border:1px solid #7897ad;text-align:left;white-space:nowrap}td{padding:6px 10px;border:1px solid #cbd6e2;vertical-align:top;white-space:normal;mso-number-format:'\\@'}tr:nth-child(even) td{background:#f2f7fb}td.relationship{color:#24663f;font-weight:bold}</style></head><body><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`; } /*
  function exportExcelResults() { setActionStatus(exportExcelStatus, "Exporting…"); const transfer = buildTransferRows(); const blob = new Blob([excelTableMarkup(transfer)], { type: "application/vnd.ms-excel;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${selectedObject || "salesforce"}-export.xls`; link.click(); URL.revokeObjectURL(url); setActionStatus(exportExcelStatus, "Downloaded", "success", 1400); setStatus("Excel export complete", `${transfer.rows.length} parent-child rows downloaded`); }
  function copyExcelResults() { setActionStatus(copyExcelStatus, "Copying…"); const transfer = buildTransferRows(); const html = excelTableMarkup(transfer); const plain = [transfer.columns, ...transfer.rows.map((row) => transfer.columns.map((column) => formatCellValue(row[column])))].map((line) => line.join("\t")).join("\n"); if (navigator.clipboard?.write && window.ClipboardItem) { const item = new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) }); navigator.clipboard.write([item]).then(() => { setActionStatus(copyExcelStatus, "Copied", "success", 1400); setStatus("Excel copied", `${transfer.rows.length} parent-child rows copied with formatting`)}).catch(() => { setActionStatus(copyExcelStatus, "Failed", "error", 2200); setStatus("Copy failed", "Clipboard permission was denied", "error")); return; } if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(plain).then(() => { setActionStatus(copyExcelStatus, "Copied", "success", 1400); setStatus("Excel copied", "Tabular data copied for Excel")).catch(() => setStatus("Copy failed", "Clipboard permission was denied", "error")); return; } setActionStatus(copyExcelStatus, "Unavailable", "error", 2200); setStatus("Copy unavailable", "This browser does not support formatted clipboard data", "error"); }
*/   function toggleColumnMenu() { let menu = body.querySelector(".export-column-menu"); if (menu) { menu.remove(); return; } menu = document.createElement("div"); menu.className = "export-column-menu"; allResultColumns.forEach((column) => { const label = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = !hiddenColumns.has(column); checkbox.addEventListener("change", () => { checkbox.checked ? hiddenColumns.delete(column) : hiddenColumns.add(column); persistHiddenColumnsForObject(); renderResults(); }); label.append(checkbox, document.createTextNode(column)); menu.appendChild(label); }); body.querySelector(".export-result-actions")?.appendChild(menu); }
  function loadMoreOnScroll() { if (tableWrap.scrollTop + tableWrap.clientHeight >= tableWrap.scrollHeight - 80 && nextRecordsUrl && !activeRequest) void executeQuery(true); }
  function setExplorerTab(tab) { const fieldsView = tab === "fields"; objectTab.classList.toggle("is-active", !fieldsView); fieldsTab.classList.toggle("is-active", fieldsView); objectTab.setAttribute("aria-selected", String(!fieldsView)); fieldsTab.setAttribute("aria-selected", String(fieldsView)); objectTree.hidden = fieldsView; objectSearch.hidden = fieldsView; body.querySelector(".export-search-label").hidden = fieldsView; fieldExplorer.classList.toggle("is-tab-active", fieldsView); }
  function bindSideResizer(resizerId, panel, direction) { const resizer = body.querySelector(`#${resizerId}`); if (!resizer || !panel) return; let draggingSide = false; resizer.addEventListener("pointerdown", (event) => { if (panel.classList.contains("is-collapsed")) { const savedWidth = Number(panel.dataset.expandedWidth); panel.classList.remove("is-collapsed"); panel.style.width = `${savedWidth || (direction === "left" ? 226 : 270)}px`; panel.style.minWidth = panel.style.width; const button = body.querySelector(direction === "left" ? "#export-collapse-explorer" : "#export-collapse-history"); button?.classList.remove("is-collapsed"); button?.setAttribute("aria-expanded", "true"); } panel.classList.add("is-resizing"); draggingSide = true; resizer.setPointerCapture(event.pointerId); resizer.classList.add("is-dragging"); }); resizer.addEventListener("pointermove", (event) => { if (!draggingSide) return; const workspaceBounds = body.querySelector(".export-workspace").getBoundingClientRect(); const width = direction === "left" ? Math.max(180, Math.min(360, event.clientX - workspaceBounds.left)) : Math.max(190, Math.min(380, workspaceBounds.right - event.clientX)); panel.style.width = `${width}px`; panel.style.minWidth = `${width}px`; panel.dataset.expandedWidth = String(width); }); const stop = () => { draggingSide = false; panel.classList.remove("is-resizing"); resizer.classList.remove("is-dragging"); }; resizer.addEventListener("pointerup", stop); resizer.addEventListener("pointercancel", stop); resizer.addEventListener("keydown", (event) => { if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); if (panel.classList.contains("is-collapsed")) return; panel.classList.add("is-resizing"); const current = panel.getBoundingClientRect().width; const delta = (event.key === "ArrowRight" ? 16 : -16) * (direction === "left" ? 1 : -1); const width = Math.max(direction === "left" ? 180 : 190, Math.min(direction === "left" ? 360 : 380, current + delta)); panel.style.width = `${width}px`; panel.style.minWidth = `${width}px`; panel.dataset.expandedWidth = String(width); window.setTimeout(() => panel.classList.remove("is-resizing"), 120); }); }
  function bindMiddleDraggable() { body.querySelectorAll(".export-middle-draggable").forEach((section) => { const handle = section.querySelector(".export-horizontal-drag-handle"); if (!handle) return; let draggingSection = false; handle.addEventListener("pointerdown", (event) => { draggingSection = true; handle.setPointerCapture(event.pointerId); handle.classList.add("is-dragging"); }); handle.addEventListener("pointermove", (event) => { if (!draggingSection) return; const amount = Math.max(0, Math.min(72, event.clientX - section.getBoundingClientRect().left)); section.style.marginLeft = `${Math.max(7, amount)}px`; }); const stop = () => { draggingSection = false; handle.classList.remove("is-dragging"); }; handle.addEventListener("pointerup", stop); handle.addEventListener("pointercancel", stop); }); }
  function mixHexColor(base, target, targetAmount) {
    const toRgb = (color) => [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((value) => Number.parseInt(value, 16));
    const [baseRed, baseGreen, baseBlue] = toRgb(base);
    const [targetRed, targetGreen, targetBlue] = toRgb(target);
    const mix = (from, to) => Math.round(from + (to - from) * targetAmount).toString(16).padStart(2, "0");
    return `#${mix(baseRed, targetRed)}${mix(baseGreen, targetGreen)}${mix(baseBlue, targetBlue)}`;
  }

  function tableHeaderTextColor(color) {
    const [red, green, blue] = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((value) => Number.parseInt(value, 16) / 255);
    const linear = (channel) => (channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    const luminance = .2126 * linear(red) + .7152 * linear(green) + .0722 * linear(blue);
    return luminance < .42 ? "#f7fbff" : "#1f3f5c";
  }

  function applyTablePalette(kind, color) {
    const workspace = body.querySelector(".export-workspace");
    if (!workspace) return;
    const propertyNames = kind === "parent"
      ? ["--export-parent-header-bg", "--export-parent-header-text", "--export-parent-header-border", "--export-parent-row-bg", "--export-parent-row-alt-bg", "--export-parent-row-border", "--export-parent-row-text"]
      : ["--export-child-container-bg", "--export-child-panel-bg", "--export-child-heading-bg", "--export-child-header-bg", "--export-child-panel-border", "--export-child-heading-border", "--export-child-row-border", "--export-child-heading-text", "--export-child-header-text", "--export-child-row-text"];
    if (!/^#[\da-f]{6}$/i.test(color || "")) {
      propertyNames.forEach((property) => workspace.style.removeProperty(property));
      return;
    }

    const base = color.toLowerCase();
    const setProperties = kind === "parent"
      ? {
          "--export-parent-header-bg": base,
          "--export-parent-header-text": tableHeaderTextColor(base),
          "--export-parent-header-border": mixHexColor(base, "#4b6b85", .42),
          "--export-parent-row-bg": mixHexColor(base, "#ffffff", .91),
          "--export-parent-row-alt-bg": mixHexColor(base, "#ffffff", .82),
          "--export-parent-row-border": mixHexColor(base, "#6c8499", .58),
          "--export-parent-row-text": "#1f3f5c"
        }
      : {
          "--export-child-container-bg": mixHexColor(base, "#ffffff", .7),
          "--export-child-panel-bg": mixHexColor(base, "#ffffff", .9),
          "--export-child-heading-bg": base,
          "--export-child-header-bg": mixHexColor(base, "#315d46", .18),
          "--export-child-panel-border": mixHexColor(base, "#38634e", .44),
          "--export-child-heading-border": mixHexColor(base, "#38634e", .35),
          "--export-child-row-border": mixHexColor(base, "#38634e", .28),
          "--export-child-heading-text": tableHeaderTextColor(base),
          "--export-child-header-text": tableHeaderTextColor(mixHexColor(base, "#315d46", .18)),
          "--export-child-row-text": "#24513c"
        };
    Object.entries(setProperties).forEach(([property, value]) => workspace.style.setProperty(property, value));
  }

  function applyDataExportPreferences(preferences) {
    dataExportPreferences = preferences || getDefaultDataExportPreferences();
    const initialTab = queryTabs.length === 1 ? queryTabs[0] : null;
    if (initialTab?.query === starterQuery) {
      initialTab.query = getStarterQuery(initialTab.object || starterObject);
      if (editor?.getValue?.() === starterQuery) editor.setValue(initialTab.query);
    }
    queryHistory = dataExportPreferences.queryHistoryEnabled ? loadQueryHistory() : [];
    if (dataExportPreferences.queryHistoryEnabled) persistQueryHistory();
    restoreHiddenColumnsForObject();
    if (appliedRelatedRecordsExpanded !== dataExportPreferences.relatedRecordsExpanded) {
      collapsedRelatedRows.clear();
      initializedRelatedRows.clear();
      appliedRelatedRecordsExpanded = dataExportPreferences.relatedRecordsExpanded;
    }
    const setPanelState = (panel, button, expanded, width, label) => {
      if (!panel) return;
      const collapsed = !expanded;
      panel.dataset.expandedWidth = String(width);
      panel.classList.toggle("is-collapsed", collapsed);
      panel.style.width = collapsed ? "" : `${width}px`;
      panel.style.minWidth = collapsed ? "" : panel.style.width;
      button?.classList.toggle("is-collapsed", collapsed);
      button?.setAttribute("aria-expanded", String(expanded));
      button?.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${label}`);
      if (button) button.title = `${expanded ? "Collapse" : "Expand"} ${label}`;
    };

    setPanelState(objectExplorer, body.querySelector("#export-collapse-explorer"), dataExportPreferences.objectExplorerVisible, dataExportPreferences.objectExplorerWidth, "Object Explorer");
    setPanelState(historyPanel, body.querySelector("#export-collapse-history"), dataExportPreferences.queryHistoryVisible, dataExportPreferences.queryHistoryWidth, "Query History");
    applyTablePalette("parent", dataExportPreferences.parentTableColor);
    applyTablePalette("child", dataExportPreferences.childTableColor);
    tableWrap.classList.toggle("is-no-wrap", !dataExportPreferences.wrapText);
    wrapButton.setAttribute("aria-pressed", String(dataExportPreferences.wrapText));
    editor?.updateOptions?.({
      fontSize: dataExportPreferences.fontSize,
      wordWrap: dataExportPreferences.wordWrap,
      lineNumbers: dataExportPreferences.lineNumbers ? "on" : "off",
      minimap: { enabled: dataExportPreferences.minimap }
    });
    setExplorerTab(dataExportPreferences.defaultExplorerTab);
    renderHistory();
    renderResults();
    scheduleEditorLayout();
  }
  function bindWorkspaceActions() {
    body.querySelector("#export-execute")?.addEventListener("click", () => void executeQuery()); body.querySelector("#export-editor-execute")?.addEventListener("click", () => void executeQuery()); body.querySelector("#export-save")?.addEventListener("click", saveCurrentQuery); body.querySelector("#export-template")?.addEventListener("click", () => { setQueryValue(getStarterQuery(selectedObject)); setStatus("Template inserted", `${selectedObject} starter query`); }); body.querySelector("#export-new-query")?.addEventListener("click", createQueryTab);
    stopButton.addEventListener("click", () => { activeRequest?.abort(); }); fetchMoreButton.addEventListener("click", () => void executeQuery(true)); exportButton.addEventListener("click", exportResults); copyButton.addEventListener("click", copyResults); exportExcelButton?.addEventListener("click", exportExcelResults); copyExcelButton?.addEventListener("click", copyExcelResults); body.querySelector("#export-columns")?.addEventListener("click", toggleColumnMenu); wrapButton.addEventListener("click", () => { tableWrap.classList.toggle("is-no-wrap"); const wrapped = !tableWrap.classList.contains("is-no-wrap"); wrapButton.setAttribute("aria-pressed", String(wrapped)); }); maximizeResultsButton?.addEventListener("click", () => { const main = body.querySelector(".export-main"); const maximized = main.classList.toggle("is-results-maximized"); maximizeResultsButton.setAttribute("aria-pressed", String(maximized)); maximizeResultsButton.setAttribute("aria-label", maximized ? "Restore results" : "Maximize results"); maximizeResultsButton.title = maximized ? "Restore results" : "Maximize results"; maximizeResultsButton.textContent = maximized ? "⛶" : "⛶"; window.requestAnimationFrame(() => editor?.layout?.()); }); tableWrap.addEventListener("scroll", loadMoreOnScroll);
    stopButton.addEventListener("click", () => { autoFetchRunId += 1; });
    historySearch.addEventListener("input", renderHistory); body.querySelector("#export-clear-history")?.addEventListener("click", () => { clearQueryHistory(); renderHistory(); }); body.querySelector("#export-collapse-history")?.addEventListener("click", () => { const collapsed = historyPanel.classList.toggle("is-collapsed"); const button = body.querySelector("#export-collapse-history"); if (!collapsed) { historyPanel.style.width = `${historyPanel.dataset.expandedWidth || 270}px`; historyPanel.style.minWidth = historyPanel.style.width; } else { historyPanel.dataset.expandedWidth = String(historyPanel.getBoundingClientRect().width); historyPanel.style.width = ""; historyPanel.style.minWidth = ""; } button.classList.toggle("is-collapsed", collapsed); button.setAttribute("aria-expanded", String(!collapsed)); button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} Query History`); button.title = `${collapsed ? "Expand" : "Collapse"} Query History`; });
    bindSideResizer("export-left-resizer", body.querySelector("#export-object-explorer"), "left"); bindSideResizer("export-right-resizer", historyPanel, "right"); bindMiddleDraggable();
    historyList.addEventListener("click", (event) => { if (!event.target.closest(".export-history-load")) return; window.setTimeout(() => { restoreHiddenColumnsForObject(); renderResults(); }, 0); });
    objectTab?.addEventListener("click", () => setExplorerTab("objects")); fieldsTab?.addEventListener("click", () => setExplorerTab("fields"));
    setExplorerTab(dataExportPreferences.defaultExplorerTab); renderHistory();
  }
  function showMessage(target, message, state = "empty") { target.innerHTML = `<div class="export-explorer-message is-${state}" role="status">${escapeText(message)}</div>`; }
  function normalizeObject(item) { const name = item?.name || ""; const rawLabel = String(item?.label || "").trim(); const hasMissingLabel = /^__MISSING LABEL__/i.test(rawLabel); const label = !rawLabel || hasMissingLabel ? name : rawLabel; return { name, label, rawLabel, custom: item?.custom === true, queryable: item?.queryable === true, searchable: `${name} ${label}`.toLowerCase() }; }
  // Salesforce's SObject describe response supplies `filterable` at field level.
  // Keep only fields Salesforce explicitly marks as filterable for Explorer and completion.
  function isFilterableField(field) { return field?.filterable === true || field?.filterable === "true"; }
  function normalizeField(field) { return { name: field?.name || "", label: field?.label || field?.name || "", type: field?.type || "", relationshipName: field?.relationshipName || "", referenceTo: Array.isArray(field?.referenceTo) ? field.referenceTo : [], filterable: isFilterableField(field), nillable: field?.nillable === true, createable: field?.createable === true, updateable: field?.updateable === true, calculated: field?.calculated === true, custom: field?.custom === true, searchable: `${field?.name || ""} ${field?.label || ""} ${field?.type || ""}`.toLowerCase() }; }

  function renderObjectTree() {
    const term = String(objectSearch.value || "").trim().toLowerCase();
    const visible = objects.filter((item) => !term || item.searchable.includes(term));
    if (!visible.length) { showMessage(objectTree, objects.length ? "No matching objects" : "No accessible objects returned"); return; }
    objectTree.replaceChildren();
    visible.forEach((item) => { const button = document.createElement("button"); button.type = "button"; button.className = `export-tree-item${item.name === selectedObject ? " is-selected" : ""}`; button.setAttribute("role", "treeitem"); button.setAttribute("aria-selected", String(item.name === selectedObject)); button.title = `${item.label} (${item.name})`; button.innerHTML = `<span class="export-tree-icon">▦</span><span>${escapeText(item.label)}</span><small>${escapeText(item.name)}</small>`; button.addEventListener("click", () => { void selectObject(item.name); setExplorerTab("fields"); }); objectTree.appendChild(button); });
  }

  function renderObjectSelect() { objectSelect.replaceChildren(); objects.forEach((item) => { const option = document.createElement("option"); option.value = item.name; option.textContent = `${item.label} (${item.name})`; option.title = `${item.label} (${item.name})`; option.selected = item.name === selectedObject; objectSelect.appendChild(option); }); objectSelect.title = objectSelect.selectedOptions[0]?.textContent || "Select Salesforce object"; objectSelect.disabled = objects.length === 0; renderObjectPicker(); }
  function renderObjectPicker() { if (!objectPickerToggle || !objectPickerList) return; const selected = objects.find((item) => item.name === selectedObject); objectPickerToggle.replaceChildren(document.createTextNode(selected ? `${selected.label} (${selected.name})` : "Select object")); const arrow = document.createElement("span"); arrow.setAttribute("aria-hidden", "true"); arrow.textContent = "⌄"; objectPickerToggle.appendChild(arrow); const term = String(objectPickerSearch?.value || "").trim().toLowerCase(); const visible = objects.filter((item) => !term || item.searchable.includes(term)); const page = visible.slice(0, objectPickerVisibleCount); objectPickerList.replaceChildren(); if (!page.length) { const empty = document.createElement("div"); empty.className = "export-object-picker-empty"; empty.textContent = "No matching objects"; objectPickerList.appendChild(empty); return; } page.forEach((item) => { const option = document.createElement("button"); option.type = "button"; option.className = `export-object-picker-option${item.name === selectedObject ? " is-selected" : ""}`; option.setAttribute("role", "option"); option.setAttribute("aria-selected", String(item.name === selectedObject)); option.title = `${item.label} (${item.name})`; option.innerHTML = `<span class="export-object-picker-icon" aria-hidden="true">▦</span><span><strong>${escapeText(item.label)}</strong><small>${escapeText(item.name)}</small></span>`; option.addEventListener("click", () => { objectSelect.value = item.name; objectPickerMenu.hidden = true; objectPickerToggle.setAttribute("aria-expanded", "false"); void selectObject(item.name); }); objectPickerList.appendChild(option); }); }
  function renderFields() {
    const term = String(fieldSearch.value || "").trim().toLowerCase();
    const visible = fields.filter((item) => !term || item.searchable.includes(term));
    fieldCount.textContent = `${fields.length}`;
    if (!visible.length) { showMessage(fieldTree, fields.length ? "No matching fields" : "No fields available"); return; }
    fieldTree.replaceChildren();
    visible.forEach((field) => { const selected = field.name === focusedFieldName; const button = document.createElement("button"); button.type = "button"; button.className = `export-field-item${selected ? " is-selected" : ""}`; button.setAttribute("role", "treeitem"); button.setAttribute("aria-selected", String(selected)); button.title = `${field.label} · ${fieldTypeBadge(field)}${field.referenceTo.length ? ` · references ${field.referenceTo.join(", ")}` : ""}`; button.innerHTML = `<span class="export-field-type">${escapeText(fieldTypeBadge(field))}</span><span class="export-field-name"><strong>${escapeText(field.label)}</strong><small>${escapeText(field.name)}</small></span>`; button.addEventListener("click", () => insertField(field.name)); fieldTree.appendChild(button); });
  }
  function renderChildRelationships() {
    relationshipTree.replaceChildren();
    const heading = document.createElement("div"); heading.className = "export-subpanel-heading"; heading.innerHTML = `<span>Child relationships</span><span class="export-field-count">${childRelationships.length}</span>`; relationshipTree.appendChild(heading);
    if (!childRelationships.length) { const message = document.createElement("div"); message.className = "export-explorer-message"; message.textContent = "No child relationships"; relationshipTree.appendChild(message); return; }
    childRelationships.slice(0, 40).forEach((relationship) => { const item = document.createElement("div"); item.className = "export-relationship-item"; item.title = `${relationship.childSObject}.${relationship.field}`; item.innerHTML = `<strong>${escapeText(relationship.relationshipName || relationship.childSObject)}</strong><small>${escapeText(relationship.childSObject)} · ${escapeText(relationship.field)}</small>`; relationshipTree.appendChild(item); });
  }
  function currentSuggestionContext() {
    const query = currentQuery();
    const model = editor?.getModel?.();
    const selection = editor?.getSelection?.();
    const offset = model && selection ? model.getOffsetAt(selection.getPosition()) : query.length;
    const context = getSoqlContext(query, offset);
    const selectedFields = new Set((context.parsed.root.selectFields || []).map((field) => field.toLowerCase()));
    return { prefix: context.prefix.toLowerCase(), selectedFields };
  }
  function fieldSuggestionScore(field, prefix) {
    if (!prefix) return 0;
    const name = field.name.toLowerCase();
    const label = field.label.toLowerCase();
    if (name.startsWith(prefix)) return 0;
    if (label.startsWith(prefix)) return 1;
    if (name.includes(prefix)) return 2;
    if (label.includes(prefix)) return 3;
    return 4;
  }
  function renderSuggestions() {
    suggestions.replaceChildren();
    const label = document.createElement("span");
    label.className = "export-suggestion-label";
    label.textContent = "Fields";
    suggestions.appendChild(label);
    if (!fields.length) {
      const note = document.createElement("span");
      note.className = "export-suggestion-note";
      note.textContent = "No fields loaded";
      suggestions.appendChild(note);
      return;
    }
    const { prefix, selectedFields } = currentSuggestionContext();
    const availableFields = fields.filter((field) => !selectedFields.has(field.name.toLowerCase()));
    availableFields
      .map((field, index) => ({ field, index, score: fieldSuggestionScore(field, prefix) }))
      .sort((left, right) => left.score - right.score || left.index - right.index)
      .slice(0, 8)
      .forEach(({ field }) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "export-chip";
        chip.textContent = field.name;
        chip.title = `${field.label} · ${field.type}`;
        chip.addEventListener("click", () => insertField(field.name));
        suggestions.appendChild(chip);
      });
    if (!availableFields.length) {
      const note = document.createElement("span");
      note.className = "export-suggestion-note";
      note.textContent = "All fields are already in the query";
      suggestions.appendChild(note);
    }
  }
  function insertField(fieldName) {
    if (!editor) { setStatus("Editor unavailable", "SOQL editor is still loading", "error"); return; }
    const selection = editor.getSelection();
    const model = editor.getModel();
    if (!selection || !model) return;
    const query = editor.getValue();
    const offset = model.getOffsetAt(selection.getPosition());
    const context = getSoqlContext(query, offset);
    const selectedFields = new Set((context.parsed.root.selectFields || []).map((field) => field.toLowerCase()));
    const normalizedName = fieldName.toLowerCase();
    if (selectedFields.has(normalizedName)) { renderSuggestions(); return; }
    const prefix = context.clause === "SELECT" ? context.prefix : "";
    if (prefix && normalizedName.startsWith(prefix.toLowerCase())) {
      const start = model.getPositionAt(Math.max(0, offset - prefix.length));
      editor.executeEdits("metadata-completion", [{ range: new window.monaco.Range(start.lineNumber, start.column, selection.endLineNumber, selection.endColumn), text: fieldName, forceMoveMarkers: true }]);
    } else {
      const fromToken = context.parsed.tokens[context.parsed.root.fromIndex];
      if (!fromToken) { setStatus("Field not added", "Add a FROM clause before selecting fields", "error"); return; }
      const beforeFrom = query.slice(0, fromToken.start).trimEnd().replace(/,\s*$/, "");
      const afterFrom = query.slice(fromToken.start).trimStart();
      const separator = /\bSELECT$/i.test(beforeFrom) ? " " : ", ";
      editor.setValue(`${beforeFrom}${separator}${fieldName} ${afterFrom}`);
    }
    focusedFieldName = fieldName;
    renderFields();
    renderSuggestions();
    editor.focus();
    setStatus("Field inserted", `${fieldName} added to the SOQL editor`);
  }

  function registerSoqlLanguage(monaco) {
    if (!monaco.languages.getLanguages().some((language) => language.id === "soql")) monaco.languages.register({ id: "soql" });
    monaco.languages.setMonarchTokensProvider("soql", { keywords: SOQL_KEYWORDS, functions: SOQL_FUNCTIONS, tokenizer: { root: [[/[a-zA-Z_$][\w$]*/, { cases: { "@keywords": "keyword", "@functions": "predefined", "@default": "identifier" } }], [/\d+(\.\d+)?/, "number"], [/'([^'\\]|\\.)*'/, "string"], [/\/\*.*\*\//, "comment"], [/--.*$/, "comment"], [/[(),.=<>!]/, "delimiter"]] } });
    monaco.languages.setLanguageConfiguration("soql", { brackets: [["(", ")"]], autoClosingPairs: [{ open: "(", close: ")" }, { open: "'", close: "'" }], surroundingPairs: [{ open: "(", close: ")" }, { open: "'", close: "'" }], indentationRules: { increaseIndentPattern: /^\s*\(/, decreaseIndentPattern: /^\s*\)/ } });
    monaco.editor.defineTheme("lightning-soql-light", { base: "vs", inherit: true, rules: [{ token: "keyword", foreground: "075985", fontStyle: "bold" }, { token: "predefined", foreground: "7c3aed" }, { token: "string", foreground: "a33b45" }], colors: { "editor.background": "#fbfcfe" } });
    monaco.editor.defineTheme("lightning-soql-dark", { base: "vs-dark", inherit: true, rules: [{ token: "keyword", foreground: "7db7f0", fontStyle: "bold" }, { token: "predefined", foreground: "c4a7ff" }, { token: "string", foreground: "ff9ea6" }], colors: { "editor.background": "#101827" } });
  }

  async function hydrateRelatedObject(objectName) {
    if (!objectName || schema.objects[objectName]?.fields?.length || !sessionId || metadataCache.has(objectName)) return;
    metadataCache.set(objectName, "loading");
    try { const metadata = await getSObjectDescribe(sessionId, objectName, sourceOrigin); console.info("[Lightning Connect][Data Export] Describe response", { objectName, metadata }); const relatedFields = Array.isArray(metadata?.fields) ? metadata.fields.filter(isFilterableField).map(normalizeField) : []; schema.objects[objectName] = { ...(schema.objects[objectName] || {}), name: objectName, label: schema.objects[objectName]?.label || objectName, fields: relatedFields, childRelationships: Array.isArray(metadata?.childRelationships) ? metadata.childRelationships.map((relationship) => ({ childSObject: relationship?.childSObject || "", field: relationship?.field || "", relationshipName: relationship?.relationshipName || "" })).filter((relationship) => relationship.childSObject && relationship.field) : [] }; metadataCache.set(objectName, metadata); } catch { metadataCache.delete(objectName); }
  }

  async function hydrateCompletionRelationships(context) {
    let object = schema.objects[context.objectName];
    const relationshipPath = context.alias && context.path?.[0] === context.alias ? context.path.slice(1) : (context.path || []);
    for (const relationshipName of relationshipPath) { const relation = object?.fields?.find((field) => field.relationshipName === relationshipName || field.name === relationshipName); const target = relation?.referenceTo?.find((name) => schema.objects[name]); if (!target) return; await hydrateRelatedObject(target); object = schema.objects[target]; }
    if (!context.path?.length && object?.childRelationships?.length && ["SELECT", "UNKNOWN"].includes(context.clause)) await Promise.all(object.childRelationships.slice(0, 8).map((relationship) => hydrateRelatedObject(relationship.childSObject)));
  }

  function applyLocalValidation() {
    if (!editor) return;
    const model = editor.getModel(); const result = validateSoql(editor.getValue()); const markers = result.errors.map((error) => { const position = model.getPositionAt(Math.min(error.index || 0, model.getValueLength())); return { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: Math.max(position.column + 1, position.column), message: error.message, severity: error.severity === "warning" ? window.monaco.MarkerSeverity.Warning : window.monaco.MarkerSeverity.Error }; });
    window.monaco.editor.setModelMarkers(model, "soql-local", markers); const detail = result.errors.length ? result.errors.map((error) => error.message).join(" ") : "No syntax issues detected"; setStatus(result.valid ? "Local validation passed" : "Local validation found issues", detail, result.valid ? "ready" : "error"); setProgress(result.valid ? "Validation passed" : "Validation failed", detail, 0, false); return result;
  }

  async function initSoqlEditor() {
    if (typeof window !== "undefined") window.MonacoEnvironment = { getWorker(_, label) { if (label === "json") return new JsonWorker(); if (label === "css") return new CssWorker(); if (label === "html") return new HtmlWorker(); if (label === "typescript" || label === "javascript") return new TsWorker(); return new EditorWorker(); } };
    const monaco = window.monaco?.editor ? window.monaco : await import("monaco-editor"); window.monaco = monaco; registerSoqlLanguage(monaco); const dark = document.documentElement.classList.contains("dark-theme"); monaco.editor.setTheme(dark ? "lightning-soql-dark" : "lightning-soql-light");
    const initialModel = monaco.editor.createModel(activeTab()?.query || getStarterQuery(starterObject), "soql", monaco.Uri.parse("inmemory://data-export/query-1"));
    editorModels.set("query-1", initialModel);
    editor = monaco.editor.create(body.querySelector("#export-query"), { model: initialModel, theme: dark ? "lightning-soql-dark" : "lightning-soql-light", automaticLayout: false, fixedOverflowWidgets: true, lineNumbers: dataExportPreferences.lineNumbers ? "on" : "off", minimap: { enabled: dataExportPreferences.minimap }, fontSize: dataExportPreferences.fontSize, tabSize: 2, insertSpaces: true, wordWrap: dataExportPreferences.wordWrap, scrollBeyondLastLine: false, suggestOnTriggerCharacters: true, quickSuggestions: true, bracketPairColorization: { enabled: true }, padding: { top: 12, bottom: 12 } });
    void getStoredTheme().then(applySoqlEditorTheme);
    scheduleEditorLayout();
    editor.onDidChangeModelContent(renderSuggestions);
    editor.onDidChangeCursorSelection(renderSuggestions);
    renderSuggestions();
    monaco.languages.registerCompletionItemProvider("soql", { triggerCharacters: [".", " ", "(", ","], provideCompletionItems: async (model, position) => { const offset = model.getOffsetAt(position); const context = getSoqlContext(model.getValue(), offset); await hydrateCompletionRelationships(context); const suggestionsForContext = buildSoqlSuggestions(model.getValue(), offset, schema); const prefixLength = context.prefix.length; const range = new monaco.Range(position.lineNumber, Math.max(1, position.column - prefixLength), position.lineNumber, position.column); const kinds = { object: monaco.languages.CompletionItemKind.Class, field: monaco.languages.CompletionItemKind.Field, relationship: monaco.languages.CompletionItemKind.Reference, keyword: monaco.languages.CompletionItemKind.Keyword, function: monaco.languages.CompletionItemKind.Function }; return { suggestions: suggestionsForContext.map((item) => ({ label: item.label, kind: kinds[item.kind] || monaco.languages.CompletionItemKind.Value, detail: item.detail, documentation: item.documentation, insertText: item.insertText, filterText: item.label, range })) }; } });
    monaco.languages.registerHoverProvider("soql", { provideHover(model, position) { const offset = model.getOffsetAt(position); const context = getSoqlContext(model.getValue(), offset); const object = schema.objects[context.objectName]; const field = object?.fields?.find((item) => item.name.toLowerCase() === context.prefix.toLowerCase() || item.relationshipName?.toLowerCase() === context.prefix.toLowerCase()); if (!field) return null; return { range: new monaco.Range(position.lineNumber, Math.max(1, position.column - context.prefix.length), position.lineNumber, position.column), contents: [{ value: `**${field.label}**` }, { value: "```\\n" + fieldMetadataText(field) + "\\n```" }] }; } });
    editor.addAction({ id: "soql-execute", label: "Execute SOQL", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: () => executeQuery() });
    editor.addAction({ id: "soql-save", label: "Save SOQL query", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS], run: () => saveCurrentQuery() });
    editor.addAction({ id: "soql-autocomplete", label: "Trigger SOQL suggestions", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space], run: () => editor.trigger("soql", "editor.action.triggerSuggest", {}) });
    editor.addAction({ id: "soql-format", label: "Format SOQL", keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF], run: () => { const formatted = formatSoql(editor.getValue()); editor.setValue(formatted); setStatus("Formatted", "SOQL indentation and clauses normalized"); } });
    editor.onDidChangeModelContent(() => { const tab = activeTab(); if (tab) tab.query = editor.getValue(); const result = validateSoql(editor.getValue()); const model = editor.getModel(); if (model) { const markers = result.errors.map((error) => { const position = model.getPositionAt(Math.min(error.index || 0, model.getValueLength())); return { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: Math.max(position.column + 1, position.column), message: error.message, severity: error.severity === "warning" ? window.monaco.MarkerSeverity.Warning : window.monaco.MarkerSeverity.Error }; }); window.monaco.editor.setModelMarkers(model, "soql-local", markers); } progressMetrics.textContent = ""; fetchMoreButton.disabled = true; setProgress("Ready to run", "Query changed · ready to validate or execute", 0, false); setStatus(result.valid ? "Ready" : "Local syntax issue", result.errors[0]?.message || "Editing query", result.valid ? "ready" : "error"); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && editor?.hasTextFocus()) editor.trigger("soql", "closeSuggestWidget", {}); });
    body.querySelector("#export-format")?.addEventListener("click", () => editor.getAction("soql-format")?.run()); body.querySelector("#export-validate")?.addEventListener("click", applyLocalValidation); setStatus("Ready", "SOQL editor ready");
  }

  async function selectObject(objectName) {
    if (!objectName) return;
    const previousObject = selectedObject;
    selectedObject = objectName;
    restoreHiddenColumnsForObject(objectName);
    const tab = activeTab();
    if (tab) { tab.object = objectName; if (previousObject !== objectName && !currentQuery().trim()) tab.query = getStarterQuery(objectName); }
    renderQueryTabs();
    renderObjectPicker();
    selectedObject = objectName; renderObjectTree(); objectSelect.value = objectName; fields = []; childRelationships = []; renderFields(); renderSuggestions(); renderChildRelationships(); showMessage(fieldTree, `Loading ${objectName} fields…`, "loading"); setStatus("Loading metadata", `Describing ${objectName}`, "loading");
    try { sessionId = sessionId || await getSessionIdFromCookie(sourceOrigin); if (!sessionId) throw new Error("Salesforce session cookie not found. Open Data Export from a signed-in Salesforce page."); const metadata = await getSObjectDescribe(sessionId, objectName, sourceOrigin); console.info("[Lightning Connect][Data Export] Describe response", { objectName, metadata }); fields = Array.isArray(metadata?.fields) ? metadata.fields.filter(isFilterableField).map(normalizeField).filter((field) => field.name).sort((left, right) => left.label.localeCompare(right.label)) : []; childRelationships = Array.isArray(metadata?.childRelationships) ? metadata.childRelationships.map((relationship) => ({ childSObject: relationship?.childSObject || "", field: relationship?.field || "", relationshipName: relationship?.relationshipName || "", cascadeDelete: relationship?.cascadeDelete === true, restrictedDelete: relationship?.restrictedDelete === true })).filter((relationship) => relationship.childSObject && relationship.field) : []; schema.objects[objectName] = { ...(schema.objects[objectName] || {}), name: objectName, fields, childRelationships }; metadataCache.set(objectName, metadata); renderFields(); renderSuggestions(); renderChildRelationships(); setStatus("Ready", `${fields.length} fields · ${childRelationships.length} child relationships loaded for ${objectName}`); } catch (error) { fields = []; childRelationships = []; renderFields(); renderSuggestions(); renderChildRelationships(); showMessage(fieldTree, `Unable to load ${objectName}: ${error.message}`, "error"); setStatus("Metadata unavailable", error.message, "error"); }
  }
  async function loadObjects() {
    showMessage(objectTree, "Loading accessible objects…", "loading"); setStatus("Loading metadata", "Fetching Salesforce objects", "loading");
    try { sessionId = await getSessionIdFromCookie(sourceOrigin); if (!sessionId) throw new Error("Salesforce session cookie not found. Open Data Export from a signed-in Salesforce page."); const response = await getSObjectList(sessionId, sourceOrigin); objects.push(...response.map(normalizeObject).filter((item) => item.name && item.queryable).sort((left, right) => left.label.localeCompare(right.label))); objects.forEach((item) => { schema.objects[item.name] = { name: item.name, label: item.label, queryable: item.queryable, fields: [], childRelationships: [] }; }); if (!objects.length) throw new Error("Salesforce returned no queryable objects."); selectedObject = objects.some((item) => item.name === starterObject) ? starterObject : objects[0].name; renderObjectSelect(); renderObjectTree(); body.querySelector("#export-explorer-footer").textContent = `${objects.length} queryable objects`; await selectObject(selectedObject); } catch (error) { showMessage(objectTree, `Unable to load objects: ${error.message}`, "error"); objectSelect.replaceChildren(new Option("Metadata unavailable", "")); objectSelect.disabled = true; body.querySelector("#export-explorer-footer").textContent = "Connection unavailable"; setStatus("Metadata unavailable", error.message, "error"); }
  }

  objectSearch.addEventListener("input", renderObjectTree); fieldSearch.addEventListener("input", renderFields); objectSelect.addEventListener("change", () => { objectSelect.title = objectSelect.selectedOptions[0]?.textContent || "Select Salesforce object"; void selectObject(objectSelect.value); }); objectPickerToggle?.addEventListener("click", () => { objectPickerMenu.hidden = !objectPickerMenu.hidden; objectPickerToggle.setAttribute("aria-expanded", String(!objectPickerMenu.hidden)); if (!objectPickerMenu.hidden) { objectPickerVisibleCount = 80; objectPickerSearch.value = ""; renderObjectPicker(); objectPickerSearch.focus(); } }); objectPickerSearch?.addEventListener("input", () => { objectPickerVisibleCount = 80; renderObjectPicker(); }); objectPickerList?.addEventListener("scroll", () => { if (objectPickerList.scrollTop + objectPickerList.clientHeight >= objectPickerList.scrollHeight - 40) { objectPickerVisibleCount += 80; renderObjectPicker(); } }); document.addEventListener("click", (event) => { if (!objectPickerMenu?.hidden && !event.target.closest(".export-object-picker")) { objectPickerMenu.hidden = true; objectPickerToggle?.setAttribute("aria-expanded", "false"); } });
  body.querySelector("#export-collapse-explorer")?.addEventListener("click", () => { const explorer = body.querySelector("#export-object-explorer"); const collapsed = explorer.classList.toggle("is-collapsed"); const button = body.querySelector("#export-collapse-explorer"); if (!collapsed) { explorer.style.width = `${explorer.dataset.expandedWidth || 226}px`; explorer.style.minWidth = explorer.style.width; } else { explorer.dataset.expandedWidth = String(explorer.getBoundingClientRect().width); explorer.style.width = ""; explorer.style.minWidth = ""; } button.classList.toggle("is-collapsed", collapsed); button.setAttribute("aria-expanded", String(!collapsed)); button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} Object Explorer`); button.title = `${collapsed ? "Expand" : "Collapse"} Object Explorer`; });
  resultSearchButton.addEventListener("click", () => { const opening = resultSearchInput.hidden; resultSearchInput.hidden = !opening; resultSearchButton.setAttribute("aria-expanded", String(opening)); if (opening) resultSearchInput.focus(); else { resultSearchTerm = ""; resultSearchInput.value = ""; applyResultsSearch(); } });
  resultSearchInput.addEventListener("input", () => { resultSearchTerm = resultSearchInput.value; applyResultsSearch(); });
  document.addEventListener("pointerdown", (event) => { const menu = body.querySelector(".export-column-menu"); if (menu && !menu.contains(event.target) && event.target !== columnsButton) menu.remove(); });
  renderQueryTabs();
  bindWorkspaceActions();
  window.addEventListener("resize", scheduleEditorLayout);
  body.addEventListener("pointermove", () => { if (body.querySelector(".export-resize-divider.is-dragging, .export-sidebar-resizer.is-dragging")) scheduleEditorLayout(); });
  body.addEventListener("pointerup", scheduleEditorLayout);
  body.addEventListener("click", scheduleEditorLayout);
  body.addEventListener("keydown", (event) => { if (event.target.closest?.(".export-resize-divider, .export-sidebar-resizer")) scheduleEditorLayout(); });
  body.addEventListener("transitionend", (event) => { if (event.target.matches?.(".export-object-explorer, .export-history-panel")) scheduleEditorLayout(); });

  const queryPanel = body.querySelector(".export-query-panel");
  function bindHorizontalResize(dividerId, panel, minimum, maximum, direction = "query") {
    const divider = body.querySelector(`#${dividerId}`);
    if (!divider || !panel) return;
    let dragging = false;
    const resize = (clientY) => {
      const main = body.querySelector(".export-main").getBoundingClientRect();
      const current = panel.getBoundingClientRect().height;
      const value = direction === "query" ? clientY - main.top - 10 : main.bottom - clientY - 10;
      const limit = Math.max(minimum, Math.min(maximum, value));
      panel.style.flex = `0 1 ${limit}px`;
      panel.style.flexBasis = `${limit}px`;
      if (direction === "progress") panel.style.height = `${limit}px`;
      return current;
    };
    divider.addEventListener("pointerdown", (event) => { dragging = true; divider.setPointerCapture(event.pointerId); divider.classList.add("is-dragging"); });
    divider.addEventListener("pointermove", (event) => { if (dragging) resize(event.clientY); });
    const stop = () => { dragging = false; divider.classList.remove("is-dragging"); };
    divider.addEventListener("pointerup", stop); divider.addEventListener("pointercancel", stop);
    divider.addEventListener("keydown", (event) => { if (!["ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); const current = panel.getBoundingClientRect().height; const delta = (event.key === "ArrowDown" ? 24 : -24) * (direction === "progress" ? -1 : 1); const limit = Math.max(minimum, Math.min(maximum, current + delta)); panel.style.flex = `0 1 ${limit}px`; panel.style.flexBasis = `${limit}px`; if (direction === "progress") panel.style.height = `${limit}px`; });
  }
  function copyResults() {
    setActionStatus(copyStatus, "Copying...");
    const transfer = buildTransferRows();
    const lines = [transfer.columns, ...transfer.rows.map((row) => transfer.columns.map((column) => formatCellValue(row[column])))];
    const text = lines.map((line) => line.join("\t")).join("\n");
    const finish = (success) => setActionStatus(copyStatus, success ? "Copied" : "Failed", success ? "success" : "error", success ? 1400 : 2200);
    if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).then(() => { finish(true); setStatus("Copied", `${transfer.rows.length} parent-child rows copied to clipboard`); }).catch(() => { finish(false); setStatus("Copy failed", "Clipboard permission was denied", "error"); }); return; }
    const fallback = document.createElement("textarea"); fallback.value = text; document.body.appendChild(fallback); fallback.select(); const copied = document.execCommand("copy"); fallback.remove(); finish(copied); setStatus(copied ? "Copied" : "Copy failed", copied ? `${transfer.rows.length} parent-child rows copied to clipboard` : "Clipboard permission was denied", copied ? "ready" : "error");
  }
  function exportResults() { setActionStatus(exportStatus, "Exporting..."); const transfer = buildTransferRows(); const lines = [transfer.columns, ...transfer.rows.map((row) => transfer.columns.map((column) => `"${formatCellValue(row[column]).replace(/"/g, '""')}"`))]; const blob = new Blob([lines.map((line) => line.join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${selectedObject || "salesforce"}-export.csv`; link.click(); URL.revokeObjectURL(url); setActionStatus(exportStatus, "Downloaded", "success", 1400); setStatus("Export complete", `${transfer.rows.length} parent-child rows downloaded`); }
  function exportExcelResults() { setActionStatus(exportExcelStatus, "Exporting..."); try { const transfer = buildTransferRows(); const blob = new Blob([excelTableMarkup(transfer)], { type: "application/vnd.ms-excel;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${selectedObject || "salesforce"}-export.xls`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setActionStatus(exportExcelStatus, "Downloaded", "success", 1400); setStatus("Excel export complete", `${transfer.rows.length} parent-child rows downloaded`); } catch (error) { setActionStatus(exportExcelStatus, "Failed", "error", 2200); setStatus("Excel export failed", error.message, "error"); } }
  function copyExcelResults() { setActionStatus(copyExcelStatus, "Copying..."); const transfer = buildTransferRows(); const html = excelTableMarkup(transfer); const plain = [transfer.columns, ...transfer.rows.map((row) => transfer.columns.map((column) => formatCellValue(row[column])))].map((line) => line.join("\t")).join("\n"); const finish = (success, detail) => { setActionStatus(copyExcelStatus, success ? "Copied" : "Failed", success ? "success" : "error", success ? 1400 : 2200); setStatus(success ? "Excel copied" : "Copy failed", detail, success ? "ready" : "error"); }; try { if (navigator.clipboard?.write && window.ClipboardItem) { const item = new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) }); navigator.clipboard.write([item]).then(() => finish(true, `${transfer.rows.length} parent-child rows copied with formatting`)).catch(() => finish(false, "Clipboard permission was denied")); return; } if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(plain).then(() => finish(true, "Tabular data copied for Excel")).catch(() => finish(false, "Clipboard permission was denied")); return; } finish(false, "This browser does not support formatted clipboard data"); } catch (error) { finish(false, error.message); } }
  bindHorizontalResize("export-query-resize-divider", queryPanel, 220, 620, "query");
  bindHorizontalResize("export-progress-resize-divider", queryPanel, 220, 620, "query");
  void getStoredDataExportColumnVisibility().then((visibility) => {
    storedHiddenColumnsByObject = visibility;
    restoreHiddenColumnsForObject();
    renderResults();
  }).catch(() => {});
  void getStoredDataExportPreferences().then(applyDataExportPreferences).catch(() => applyDataExportPreferences(getDefaultDataExportPreferences()));
  const dataExportPreferencesChannel = typeof BroadcastChannel === "function"
    ? new BroadcastChannel(dataExportPreferencesBroadcastChannel)
    : null;
  dataExportPreferencesChannel?.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type === "preferences" && message.preferences && typeof message.preferences === "object") {
      applyDataExportPreferences(message.preferences);
    }
  });
  const themeChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(themeBroadcastChannel) : null;
  themeChannel?.addEventListener("message", (event) => {
    if (event.data?.type === "theme") applySoqlEditorTheme(event.data.theme === "dark" ? "dark" : "light");
  });
  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === "local" && changes["lc-theme"]) {
      applySoqlEditorTheme(changes["lc-theme"].newValue === "dark" ? "dark" : "light");
    }
    if (areaName === "local" && changes[dataExportPreferencesStorageKey]) {
      void getStoredDataExportPreferences().then(applyDataExportPreferences);
    }
    if (areaName === "local" && changes[dataExportColumnVisibilityStorageKey]) {
      void getStoredDataExportColumnVisibility().then((visibility) => {
        storedHiddenColumnsByObject = visibility;
        restoreHiddenColumnsForObject();
        renderResults();
      });
    }
  });
  initSoqlEditor().catch((error) => setStatus("Editor unavailable", error.message, "error"));
  loadObjects();
}
