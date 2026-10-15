import { renderPageChrome } from "../modules/page-chrome.js";
import { getSessionIdFromCookie, getSObjectDescribe, getSObjectList, requestSalesforceApi } from "../modules/salesforce-api.js";
import {
  dataImportPreferencesBroadcastChannel,
  getDefaultDataImportPreferences,
  getStoredDataImportPreferences
} from "../modules/preferences.js";
import * as XLSX from "xlsx";
import "./data-import.css";

const operationLabels = {
  create: { title: "Create records", action: "Run create", description: "Stage new records for the selected Salesforce object." },
  update: { title: "Update records", action: "Run update", description: "Match existing records by Id and stage field changes." },
  upsert: { title: "Upsert records", action: "Run upsert", description: "Create or update records using the selected match field." },
  delete: { title: "Delete records", action: "Run delete", description: "Review records that will be permanently deleted." }
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function parseDelimitedText(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === delimiter && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); value = "";
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = [];
    } else value += character;
  }
  row.push(value);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => String(header).trim());
  if (!headers.every(Boolean)) throw new Error("The CSV header row cannot contain blank column names.");
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function parseCsv(text) {
  return parseDelimitedText(text, ",");
}

function parsePastedTable(text) {
  return parseDelimitedText(text, text.includes("\t") ? "\t" : ",");
}

export function renderDataImport(container) {
  const body = renderPageChrome(container, `
    <div class="record-workspace" data-operation="create" data-input-mode="manual">
      <aside class="record-operation-sidebar" aria-labelledby="record-operation-sidebar-title">
        <section class="record-left-operation">
          <header class="record-operation-sidebar-heading"><div><span class="record-eyebrow">Step 1</span><h2 id="record-operation-sidebar-title">Choose operation</h2><p>Select how the staged records will be handled.</p></div></header>
          <div class="record-operation-grid" role="radiogroup" aria-label="Record operation">
            <button class="record-operation-card is-active" type="button" data-operation="create" role="radio" aria-checked="true"><span class="record-operation-icon" aria-hidden="true">+</span><span><strong>Create</strong><small>Insert new records</small></span></button>
            <button class="record-operation-card" type="button" data-operation="update" role="radio" aria-checked="false"><span class="record-operation-icon" aria-hidden="true">↻</span><span><strong>Update</strong><small>Change existing records</small></span></button>
            <button class="record-operation-card" type="button" data-operation="upsert" role="radio" aria-checked="false"><span class="record-operation-icon" aria-hidden="true">⇄</span><span><strong>Upsert</strong><small>Match by external ID</small></span></button>
            <button class="record-operation-card is-danger" type="button" data-operation="delete" role="radio" aria-checked="false"><span class="record-operation-icon" aria-hidden="true">−</span><span><strong>Delete</strong><small>Remove matching records</small></span></button>
          </div>
          <section class="record-processing-settings" aria-labelledby="record-processing-settings-title">
            <header><h3 id="record-processing-settings-title">Processing settings</h3><p>Used when record operations are enabled.</p></header>
            <div class="record-processing-fields"><label for="record-batch-size">Batch size<input class="record-control" id="record-batch-size" type="number" value="200" min="1" max="200" inputmode="numeric" /></label><label for="record-threads">Threads<input class="record-control" id="record-threads" type="number" value="5" min="1" max="5" inputmode="numeric" /></label></div>
          </section>
        </section>
        <footer class="record-operation-sidebar-footer"><span class="record-ui-badge">UI only · no Salesforce changes</span></footer>
        <div class="record-explorer-heading"><div><span class="record-eyebrow">Salesforce</span><h2>Object Explorer</h2></div><button class="record-icon-button" type="button" aria-label="Collapse Object Explorer" title="Collapse Object Explorer">‹</button></div>
        <div class="record-explorer-tabs" role="tablist" aria-label="Object Explorer tabs"><button class="is-active" type="button" data-explorer-tab="objects" role="tab" aria-selected="true">Objects</button><button type="button" data-explorer-tab="fields" role="tab" aria-selected="false">Fields</button></div>
        <label class="record-search-label" for="record-object-search">Filter objects</label><input class="record-control record-search" id="record-object-search" type="search" placeholder="Search objects…" autocomplete="off" />
        <div class="record-object-list" data-explorer-panel="objects" role="tree" aria-label="Available objects">
          <button class="record-object-item is-selected" type="button" data-object="Account" role="treeitem" aria-selected="true"><span class="record-object-icon" aria-hidden="true">▦</span><span><strong>Account</strong><small>Account</small></span></button>
          <button class="record-object-item" type="button" data-object="Contact" role="treeitem" aria-selected="false"><span class="record-object-icon" aria-hidden="true">▦</span><span><strong>Contact</strong><small>Contact</small></span></button>
          <button class="record-object-item" type="button" data-object="Lead" role="treeitem" aria-selected="false"><span class="record-object-icon" aria-hidden="true">▦</span><span><strong>Lead</strong><small>Lead</small></span></button>
          <button class="record-object-item" type="button" data-object="Opportunity" role="treeitem" aria-selected="false"><span class="record-object-icon" aria-hidden="true">▦</span><span><strong>Opportunity</strong><small>Opportunity</small></span></button>
        </div>
        <div class="record-field-list" data-explorer-panel="fields" role="tree" aria-label="Account fields" hidden>
          <div class="record-field-list-heading"><span>Account fields</span><span>5</span></div>
          <button class="record-field-item" type="button" role="treeitem"><span>Text</span><strong>Name</strong><small>Name</small></button><button class="record-field-item" type="button" role="treeitem"><span>Text</span><strong>Account Number</strong><small>AccountNumber</small></button><button class="record-field-item" type="button" role="treeitem"><span>Phone</span><strong>Phone</strong><small>Phone</small></button><button class="record-field-item" type="button" role="treeitem"><span>Picklist</span><strong>Industry</strong><small>Industry</small></button><button class="record-field-item" type="button" role="treeitem"><span>URL</span><strong>Website</strong><small>Website</small></button>
        </div>
        <div class="record-explorer-footer"><span class="record-status-dot" aria-hidden="true"></span><span>UI preview · object metadata loads later</span></div>
      </aside>
      <div class="record-sidebar-resizer" id="record-operation-resizer" role="separator" aria-label="Resize Step 1" aria-orientation="vertical" tabindex="0"></div>
      <main class="record-main" aria-label="Salesforce record operations">
        <section class="record-toolbar" aria-label="Record manager controls"><div class="record-toolbar-title"><div><h1>Record Manager</h1></div></div><div class="record-toolbar-controls"><span class="record-toolbar-label">Object</span><button class="record-object-select" type="button" aria-label="Selected Salesforce object"><span data-selected-object>Account</span><small>(Account)</small><span aria-hidden="true">⌄</span></button><button class="record-button record-button-secondary" type="button">New operation</button></div></section>

        <section class="record-operation-panel" aria-labelledby="record-operation-title"><header class="record-panel-heading"><div><span class="record-eyebrow">Step 1</span><h2 id="record-operation-title">Choose an operation</h2></div><span class="record-ui-badge">UI only · no Salesforce changes</span></header><div class="record-operation-grid" role="radiogroup" aria-label="Record operation"><button class="record-operation-card is-active" type="button" data-operation="create" role="radio" aria-checked="true"><span class="record-operation-icon" aria-hidden="true">＋</span><span><strong>Create</strong><small>Insert new records</small></span></button><button class="record-operation-card" type="button" data-operation="update" role="radio" aria-checked="false"><span class="record-operation-icon" aria-hidden="true">↻</span><span><strong>Update</strong><small>Change existing records</small></span></button><button class="record-operation-card" type="button" data-operation="upsert" role="radio" aria-checked="false"><span class="record-operation-icon" aria-hidden="true">⇄</span><span><strong>Upsert</strong><small>Match by external ID</small></span></button><button class="record-operation-card is-danger" type="button" data-operation="delete" role="radio" aria-checked="false"><span class="record-operation-icon" aria-hidden="true">−</span><span><strong>Delete</strong><small>Remove matching records</small></span></button></div></section>

        <div class="record-work-area">
          <section class="record-input-panel" aria-labelledby="record-input-title"><header class="record-panel-heading"><div><span class="record-eyebrow">Step 2</span><h2 id="record-input-title">Record input</h2></div><span class="record-panel-note" data-operation-description>Stage new records for the selected Salesforce object.</span></header><div class="record-input-tabs" role="tablist" aria-label="Record input format"><button class="is-active" type="button" data-input-mode="manual" role="tab" aria-selected="true">Manual Fields</button><button type="button" data-input-mode="csv" role="tab" aria-selected="false">File Upload</button><button type="button" data-input-mode="paste" role="tab" aria-selected="false">Paste Data</button></div>
            <div class="record-input-content" data-input-panel="manual"><div class="record-input-grid"><label><span>Name <em>*</em></span><input class="record-control" type="text" placeholder="Example Account" /></label><label><span>Account Number</span><input class="record-control" type="text" placeholder="ACC-1001" /></label><label><span>Phone</span><input class="record-control" type="tel" placeholder="(555) 010-1000" /></label><label><span>Industry</span><select class="record-control"><option>Select an industry</option><option>Technology</option><option>Finance</option><option>Retail</option></select></label><label class="record-input-grid-wide"><span>Website</span><input class="record-control" type="url" placeholder="https://example.com" /></label></div><button class="record-add-field" type="button">＋ Add field</button></div>
            <div class="record-input-content" data-input-panel="csv" hidden><button class="record-dropzone" type="button"><span aria-hidden="true">⇧</span><strong>Drop a CSV or Excel file here</strong><small>or choose a .csv, .xls, or .xlsx file to read its first worksheet</small><span>Choose file</span></button><div class="record-file-status" data-file-status role="status" aria-live="polite">No file selected.</div><div class="record-input-actions record-file-actions"><button class="record-button record-button-primary" type="button" data-stage-file disabled>Stage Records</button></div></div>
            <div class="record-input-content" data-input-panel="paste" hidden><label class="record-paste-label" for="record-paste-input">Paste CSV or Excel data</label><textarea class="record-paste-input" id="record-paste-input" spellcheck="false" placeholder="Name,Phone,Industry&#10;Example Account,(555) 010-1000,Technology"></textarea><p class="record-input-help">Paste CSV text, or copy cells directly from Excel. The first row must contain Salesforce field API names.</p><div class="record-file-status" data-paste-status role="status" aria-live="polite">Paste data to prepare records for staging.</div><div class="record-input-actions record-file-actions"><button class="record-button record-button-primary" type="button" data-stage-paste disabled>Stage Records</button></div></div>
          </section>
          <aside class="record-review-panel" aria-labelledby="record-review-title"><header><span class="record-eyebrow">Step 3</span><h2 id="record-review-title">Review changes</h2></header><div class="record-review-operation"><span class="record-review-icon" aria-hidden="true">＋</span><div><strong data-operation-title>Create records</strong><small data-operation-object>Account · 0 records staged</small></div></div><ol class="record-checklist"><li class="is-current"><span>1</span><div><strong>Choose object</strong><small>Account is selected</small></div></li><li><span>2</span><div><strong>Stage records</strong><small>Add records from a form, file, or pasted data</small></div></li><li><span>3</span><div><strong>Validate changes</strong><small>Permissions and required fields are checked later</small></div></li><li><span>4</span><div><strong>Confirm operation</strong><small>Salesforce changes require confirmation</small></div></li></ol><label class="record-confirmation"><input type="checkbox" disabled /><span>I understand this operation can change Salesforce data</span></label></aside>
        </div>

        <section class="record-stage-panel" aria-labelledby="record-stage-title"><header class="record-panel-heading record-stage-heading"><div><span class="record-eyebrow">Staging area</span><h2 id="record-stage-title">Records to process</h2></div><div><button class="record-button record-button-secondary" type="button">Columns</button><button class="record-button record-button-secondary" type="button">Clear staged records</button></div></header><div class="record-stage-table-wrap"><table class="record-stage-table"><thead><tr><th><input type="checkbox" aria-label="Select all staged records" disabled /></th><th>Record</th><th>Match key</th><th>Changed fields</th><th>Operation</th><th>Status</th></tr></thead><tbody><tr class="record-stage-empty"><td colspan="6"><span aria-hidden="true">⌁</span><strong>No records staged</strong><small>Use Manual Fields, File Upload, or Paste Data to prepare changes.</small></td></tr></tbody></table></div><footer class="record-stage-footer"><span>Staged <strong>0</strong></span><span>Valid <strong>0</strong></span><span>Needs review <strong>0</strong></span><span class="record-ui-preview-note" role="status" aria-live="polite">UI preview is ready</span><div><button class="record-button record-button-secondary" type="button" data-ui-action="validate">Validate records</button><button class="record-button record-button-primary" type="button" data-ui-action="commit">Run create</button></div></footer></section>
      </main>
      <div class="record-mappings-resizer" id="record-mappings-resizer" role="separator" aria-label="Resize Saved Mappings" aria-orientation="vertical" tabindex="0"></div>
      <aside class="record-mappings-panel is-collapsed" id="record-mappings-panel" aria-label="Saved data mappings">
        <div class="record-mappings-heading"><div><h2>Saved mappings</h2></div><button class="record-icon-button is-collapsed" id="record-collapse-mappings" type="button" aria-label="Expand saved mappings" aria-expanded="false" title="Expand saved mappings"><span class="record-mappings-glyph record-mappings-glyph-collapse" aria-hidden="true">&gt;</span><span class="record-mappings-glyph record-mappings-glyph-expand" aria-hidden="true">&lt;</span></button></div>
        <div class="record-mappings-search"><input class="record-control" id="record-mappings-search" type="search" placeholder="Search mappings…" autocomplete="off" /></div>
        <div class="record-mappings-list" id="record-mappings-list" role="list"><div class="record-mappings-empty">No saved mappings</div></div>
        <footer class="record-mappings-footer"><button class="record-button record-button-secondary" id="record-save-mapping" type="button">Save mapping</button><button class="record-button record-button-danger" id="record-clear-mappings" type="button">Clear mappings</button></footer>
      </aside>
    </div>
    <div class="record-field-modal" id="record-field-modal" hidden>
      <section class="record-field-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="record-field-modal-title">
        <header class="record-field-modal-heading"><div><span class="record-eyebrow">Step 2</span><h2 id="record-field-modal-title">Field explorer</h2><p>Choose an available field to add to this record.</p></div><button class="record-icon-button" type="button" data-close-field-modal aria-label="Close field explorer" title="Close">×</button></header>
        <div class="record-field-modal-body">
          <section class="record-field-browser" aria-label="Available fields"><label for="record-field-modal-search">Search fields</label><input class="record-control" id="record-field-modal-search" type="search" placeholder="Search by label, API name, or type" autocomplete="off" /><div class="record-field-modal-list" id="record-field-modal-list" role="listbox" aria-label="Available fields"></div></section>
          <aside class="record-field-details" id="record-field-details" aria-live="polite"></aside>
        </div>
      </section>
    </div>
  `, { headerHtml: "" });

  const workspace = body.querySelector(".record-workspace");
  const uiNote = body.querySelector(".record-ui-preview-note");
  const selectedObject = body.querySelector("[data-selected-object]");
  const stagePanel = body.querySelector(".record-stage-panel");
  const workArea = body.querySelector(".record-work-area");
  const reviewPanel = body.querySelector(".record-review-panel");
  const inputPanel = body.querySelector(".record-input-panel");
  if (stagePanel) reviewPanel?.before(stagePanel);
  if (workArea && inputPanel && stagePanel && reviewPanel) {
    const createSectionResizer = (id, label) => {
      const divider = document.createElement("div");
      divider.className = "record-section-resizer";
      divider.id = id;
      divider.setAttribute("role", "separator");
      divider.setAttribute("aria-label", label);
      divider.setAttribute("aria-orientation", "vertical");
      divider.tabIndex = 0;
      return divider;
    };
    inputPanel.after(createSectionResizer("record-step-two-resizer", "Resize Step 2 and Step 3"));
    stagePanel.after(createSectionResizer("record-step-three-resizer", "Resize Step 3 and Step 4"));
  }
  const stageEyebrow = body.querySelector(".record-stage-heading .record-eyebrow");
  if (stageEyebrow) stageEyebrow.textContent = "Step 3";
  const stageTitle = body.querySelector("#record-stage-title");
  if (stageTitle) stageTitle.textContent = "Stage records";
  const reviewEyebrow = body.querySelector(".record-review-panel .record-eyebrow");
  if (reviewEyebrow) reviewEyebrow.textContent = "Step 4";
  const commitAction = body.querySelector("[data-ui-action='commit']");
  const confirmation = body.querySelector(".record-confirmation");
  if (commitAction && confirmation) {
    commitAction.classList.add("record-step-four-action");
    commitAction.disabled = true;
    commitAction.setAttribute("aria-disabled", "true");
    confirmation.after(commitAction);
  }
  const sourceOrigin = new URLSearchParams(window.location.search).get("sourceOrigin") || window.location.origin;
  const state = { sessionId: null, objectName: "Account", objects: [], describe: null, staged: [], selectedFields: [], manualFieldsInitialized: false, matchField: "", upsertMatchMode: "externalId", preferences: getDefaultDataImportPreferences(), preferencesInitialized: false, validated: false, loading: false, compactColumns: false, wrapTableText: false, stageMaximized: false, statusFilter: "all", resultActionsVisible: false, uploadedFile: null, pendingColumnMappings: {} };
  const dataImportPreferencesChannel = typeof BroadcastChannel === "function"
    ? new BroadcastChannel(dataImportPreferencesBroadcastChannel)
    : null;
  const confirmationInput = confirmation?.querySelector("input");
  const objectPicker = body.querySelector(".record-object-select");
  const objectSelect = document.createElement("select");
  objectSelect.className = "record-object-select";
  objectSelect.id = "record-object-select";
  objectSelect.setAttribute("aria-label", "Salesforce object");
  objectSelect.setAttribute("aria-hidden", "true");
  objectSelect.tabIndex = -1;
  objectSelect.disabled = true;
  const objectPickerControl = document.createElement("div");
  objectPickerControl.className = "record-object-picker";
  const objectPickerToggle = document.createElement("button");
  objectPickerToggle.className = "record-control record-object-picker-toggle";
  objectPickerToggle.type = "button";
  objectPickerToggle.setAttribute("aria-haspopup", "listbox");
  objectPickerToggle.setAttribute("aria-expanded", "false");
  objectPickerToggle.disabled = true;
  const objectPickerMenu = document.createElement("div");
  objectPickerMenu.className = "record-object-picker-menu";
  objectPickerMenu.hidden = true;
  const objectPickerSearch = document.createElement("input");
  objectPickerSearch.className = "record-control record-object-picker-search";
  objectPickerSearch.type = "search";
  objectPickerSearch.placeholder = "Search objects…";
  objectPickerSearch.autocomplete = "off";
  objectPickerSearch.setAttribute("aria-label", "Search Salesforce objects");
  const objectPickerList = document.createElement("div");
  objectPickerList.className = "record-object-picker-list";
  objectPickerList.setAttribute("role", "listbox");
  objectPickerList.setAttribute("aria-label", "Salesforce objects");
  objectPickerMenu.append(objectPickerSearch, objectPickerList);
  objectPickerControl.append(objectSelect, objectPickerToggle, objectPickerMenu);
  objectPicker?.replaceWith(objectPickerControl);
  const mappingsPanel = body.querySelector("#record-mappings-panel");
  const mappingsList = body.querySelector("#record-mappings-list");
  const mappingsSearch = body.querySelector("#record-mappings-search");
  const collapseMappingsButton = body.querySelector("#record-collapse-mappings");
  const saveMappingButton = body.querySelector("#record-save-mapping");
  const clearMappingsButton = body.querySelector("#record-clear-mappings");
  if (saveMappingButton) { saveMappingButton.disabled = true; saveMappingButton.setAttribute("aria-disabled", "true"); }
  const operationSidebar = body.querySelector(".record-operation-sidebar");
  const fieldModal = body.querySelector("#record-field-modal");
  const fieldModalSearch = body.querySelector("#record-field-modal-search");
  const fieldModalList = body.querySelector("#record-field-modal-list");
  const fieldModalDetails = body.querySelector("#record-field-details");
  const stageTableWrap = body.querySelector(".record-stage-table-wrap");
  const stageHeaderActions = body.querySelector(".record-stage-heading > div:last-child");
  body.querySelector("[data-input-panel='manual'] .record-button-primary")?.replaceChildren("Stage Records");
  if (stageHeaderActions) {
    stageHeaderActions.innerHTML = `<button class="record-button record-button-secondary" type="button" data-stage-compact>Compact columns</button><button class="record-button record-button-secondary" type="button" data-stage-wrap title="Wrap long values">↪ Wrap text</button><button class="record-button record-button-secondary" type="button" data-map-columns>Map columns</button><button class="record-button record-button-secondary" type="button" data-clear-staged>Clear staged records</button><span class="record-stage-result-actions" data-stage-result-actions hidden><span class="record-stage-export-control"><select class="record-stage-export-format" data-stage-export-format aria-label="Download format"><option value="csv">CSV</option><option value="xlsx">Excel</option></select></span><span class="record-stage-export-control"><button class="record-icon-button record-stage-download-icon" type="button" data-stage-download aria-label="Download table data" title="Download table data"><span aria-hidden="true"></span></button><span class="record-stage-action-status" data-stage-download-status role="status" aria-live="polite" hidden></span></span><span class="record-stage-export-control"><button class="record-icon-button record-stage-copy-icon" type="button" data-stage-copy aria-label="Copy table data" title="Copy table data"><span aria-hidden="true"></span></button><span class="record-stage-action-status" data-stage-copy-status role="status" aria-live="polite" hidden></span></span></span><button class="record-icon-button record-stage-maximize" type="button" data-stage-maximize aria-label="Maximize staging area" title="Maximize staging area">⛶</button>`;
    stageHeaderActions.className = "record-stage-actions";
    stageHeaderActions.querySelectorAll("[data-stage-compact], [data-stage-wrap], [data-map-columns], [data-clear-staged], [data-stage-maximize]").forEach((button) => { button.disabled = true; button.setAttribute("aria-disabled", "true"); });
  }
  const columnMapModal = document.createElement("div");
  columnMapModal.className = "record-field-modal record-column-map-modal";
  columnMapModal.hidden = true;
  columnMapModal.innerHTML = `<section class="record-field-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="record-column-map-title"><header class="record-field-modal-heading"><div><span class="record-eyebrow">Step 3</span><h2 id="record-column-map-title">Map columns</h2><p>Match every imported column to an available Salesforce field.</p></div><button class="record-icon-button" type="button" data-close-column-map aria-label="Close column mapping" title="Close">×</button></header><div class="record-column-map-body"><p class="record-column-map-help">Only exact API-name matches are mapped automatically. Select a Salesforce field for each remaining column.</p><div class="record-column-map-list" data-column-map-list></div></div><footer class="record-column-map-footer"><span data-column-map-summary aria-live="polite"></span><button class="record-button record-button-primary" type="button" data-apply-column-map disabled>Done</button></footer></section>`;
  body.append(columnMapModal);

  const setNote = (message) => {
    if (!uiNote) return;
    uiNote.textContent = message;
    uiNote.classList.toggle("is-error", /\b(error|failed|invalid|unable|could not|expired|rejected)\b/i.test(String(message || "")));
  };
  const mappingStorageKey = `lightning-connect:data-import:mappings:${sourceOrigin}`;
  const loadMappings = () => { try { const mappings = JSON.parse(localStorage.getItem(mappingStorageKey) || "[]"); return Array.isArray(mappings) ? mappings : []; } catch { return []; } };
  const saveMappings = (mappings) => { try { localStorage.setItem(mappingStorageKey, JSON.stringify(mappings)); } catch { setNote("The browser could not save this mapping."); } };
  let objectPickerVisibleCount = 80;
  const closeObjectPicker = () => { objectPickerMenu.hidden = true; objectPickerToggle.setAttribute("aria-expanded", "false"); };
  const renderObjectPicker = () => {
    const selected = state.objects.find((item) => item.name === state.objectName);
    objectPickerToggle.replaceChildren(document.createTextNode(selected ? `${selected.label || selected.name} (${selected.name})` : "Select object"));
    const chevron = document.createElement("span"); chevron.setAttribute("aria-hidden", "true"); objectPickerToggle.append(chevron);
    const term = String(objectPickerSearch.value || "").trim().toLowerCase();
    const visible = state.objects.filter((item) => !term || `${item.label || item.name} ${item.name}`.toLowerCase().includes(term)).slice(0, objectPickerVisibleCount);
    objectPickerList.replaceChildren();
    if (!visible.length) { const empty = document.createElement("div"); empty.className = "record-object-picker-empty"; empty.textContent = "No matching objects"; objectPickerList.append(empty); return; }
    visible.forEach((item) => {
      const option = document.createElement("button"); option.type = "button"; option.className = `record-object-picker-option${item.name === state.objectName ? " is-selected" : ""}`; option.setAttribute("role", "option"); option.setAttribute("aria-selected", String(item.name === state.objectName)); option.title = `${item.label || item.name} (${item.name})`;
      option.innerHTML = `<span class="record-object-picker-icon" aria-hidden="true">▦</span><span><strong>${escapeHtml(item.label || item.name)}</strong><small>${escapeHtml(item.name)}</small></span>`;
      option.addEventListener("click", () => { objectSelect.value = item.name; closeObjectPicker(); void selectObject(item.name); });
      objectPickerList.append(option);
    });
  };
  const availableFields = () => {
    const operation = workspace.dataset.operation || "create";
    return (state.describe?.fields || []).filter((field) => {
      if (!field?.name || field.name === "attributes" || field.calculated || field.autoNumber) return false;
      if (field.name === "Id") return operation !== "create";
      return operation === "create" ? field.createable : operation === "delete" ? field.name === "Id" : field.updateable;
    });
  };
  const operationAvailability = () => {
    const object = state.objects.find((item) => item.name === state.objectName);
    return {
      create: object?.createable === true,
      update: object?.updateable === true,
      upsert: object?.createable === true && object?.updateable === true,
      delete: object?.deletable === true
    };
  };
  const renderOperationAvailability = () => {
    const availability = operationAvailability();
    body.querySelectorAll(".record-operation-card[data-operation]").forEach((button) => {
      const allowed = availability[button.dataset.operation] === true;
      button.disabled = !allowed;
      button.setAttribute("aria-disabled", String(!allowed));
      button.title = allowed ? "" : `This object does not allow ${button.dataset.operation} operations.`;
    });
    return availability;
  };
  const fieldByName = (name) => (state.describe?.fields || []).find((field) => field.name === name);
  const requiredFieldForOperation = (field) => {
    const operation = workspace.dataset.operation || "create";
    if (!field?.name) return false;
    if (operation === "delete") return field.name === "Id";
    if (operation === "update") return field.name === "Id";
    if (operation === "upsert") {
      if (state.upsertMatchMode === "id") return field.name === "Id";
      return field.name === state.matchField;
    }
    return field.createable && field.nillable === false && field.defaultedOnCreate !== true && !field.autoNumber;
  };
  const defaultFields = () => {
    const allowed = availableFields();
    const operation = workspace.dataset.operation || "create";
    if (operation === "delete") return allowed.some((field) => field.name === "Id") ? ["Id"] : [];
    const required = allowed.filter(requiredFieldForOperation).map((field) => field.name);
    if (state.preferences.requiredFieldsOnly) return required;
    const preferred = ["Name", "AccountNumber", "Phone", "Industry", "Website"];
    const names = [...required, ...preferred, ...(operation === "update" ? ["Id"] : []), ...(operation === "upsert" && state.upsertMatchMode === "id" ? ["Id"] : []), ...(operation === "upsert" && state.upsertMatchMode === "externalId" && state.matchField ? [state.matchField] : [])];
    return [...new Set(names)].filter((name) => allowed.some((field) => field.name === name)).slice(0, Math.max(5, required.length));
  };
  const inputMarkup = (field) => {
    const name = escapeHtml(field.name);
    const label = escapeHtml(field.label || field.name);
    const required = requiredFieldForOperation(field);
    const requiredMark = required ? " <em>*</em>" : "";
    if (field.type === "picklist" || field.type === "multipicklist") {
      const options = (field.picklistValues || []).filter((item) => item.active !== false).map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label || item.value)}</option>`).join("");
      return `<label><span>${label}${requiredMark}</span><select class="record-control" data-record-field="${name}"><option value="">Select ${label}</option>${options}</select></label>`;
    }
    if (field.type === "boolean") return `<label class="record-boolean-field"><input data-record-field="${name}" type="checkbox" /><span>${label}${requiredMark}</span></label>`;
    const type = ["int", "double", "currency", "percent", "long"].includes(field.type) ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text";
    const inputMode = type === "number" ? ' inputmode="decimal"' : "";
    return `<label><span>${label}${requiredMark}</span><input class="record-control" data-record-field="${name}" type="${type}"${inputMode} /></label>`;
  };
  const renderFieldDetails = (field) => {
    if (!fieldModalDetails) return;
    if (!field) {
      fieldModalDetails.innerHTML = `<div class="record-field-details-empty"><strong>Select a field</strong><span>Its Salesforce metadata and input type will appear here.</span></div>`;
      return;
    }
    const required = workspace.dataset.operation === "create" && field.nillable === false && field.defaultedOnCreate !== true;
    const picklistValues = (field.picklistValues || []).filter((item) => item.active !== false);
    const rows = [
      ["API name", field.name],
      ["Field type", field.type || "Unknown"],
      ["Input", picklistValues.length ? `Picklist (${picklistValues.length} values)` : field.type === "boolean" ? "Checkbox" : "Text value"],
      ["Required", required ? "Yes" : "No"],
      ["Create access", field.createable ? "Available" : "Unavailable"],
      ["Update access", field.updateable ? "Available" : "Unavailable"],
      ...(field.externalId ? [["External ID", "Yes"]] : []),
      ...(field.length ? [["Max length", field.length]] : [])
    ];
    fieldModalDetails.innerHTML = `<span class="record-field-type-badge">${escapeHtml(field.type || "Field")}</span><h3>${escapeHtml(field.label || field.name)}</h3><dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>${picklistValues.length ? `<div class="record-field-picklist-preview"><strong>Picklist values</strong><span>${picklistValues.slice(0, 8).map((item) => escapeHtml(item.label || item.value)).join(" · ")}${picklistValues.length > 8 ? " · …" : ""}</span></div>` : ""}`;
  };
  const closeFieldModal = () => {
    if (!fieldModal) return;
    fieldModal.hidden = true;
  };
  const renderFieldModal = () => {
    if (!fieldModalList) return;
    const term = String(fieldModalSearch?.value || "").trim().toLowerCase();
    const fields = availableFields().filter((field) => !state.selectedFields.includes(field.name)).filter((field) => !term || `${field.label || ""} ${field.name || ""} ${field.type || ""}`.toLowerCase().includes(term));
    fieldModalList.replaceChildren();
    if (!fields.length) {
      const empty = document.createElement("div");
      empty.className = "record-field-modal-empty";
      empty.textContent = term ? "No available fields match your search." : "All available fields are already on this record.";
      fieldModalList.append(empty);
      renderFieldDetails(null);
      return;
    }
    const selected = fields[0];
    fields.forEach((field) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "record-field-modal-option";
      option.setAttribute("role", "option");
      option.innerHTML = `<span class="record-field-modal-option-type">${escapeHtml(field.type || "Field")}</span><span><strong>${escapeHtml(field.label || field.name)}</strong><small>${escapeHtml(field.name)}</small></span>`;
      option.addEventListener("mouseenter", () => renderFieldDetails(field));
      option.addEventListener("focus", () => renderFieldDetails(field));
      option.addEventListener("click", () => {
        state.selectedFields.push(field.name);
        closeFieldModal();
        renderManualForm();
        setNote(`${field.label || field.name} was added to the manual record.`);
      });
      fieldModalList.append(option);
    });
    renderFieldDetails(selected);
  };
  const openFieldModal = () => {
    if (!fieldModal) return;
    fieldModal.hidden = false;
    if (fieldModalSearch) fieldModalSearch.value = "";
    renderFieldModal();
    fieldModalSearch?.focus();
  };
  const renderManualForm = () => {
    const panel = body.querySelector("[data-input-panel='manual']");
    if (!panel) return;
    const allowed = availableFields();
    if (!state.manualFieldsInitialized) { state.selectedFields = defaultFields(); state.manualFieldsInitialized = true; }
    state.selectedFields = state.selectedFields.filter((name) => allowed.some((field) => field.name === name));
    if (workspace.dataset.operation === "delete") state.selectedFields = allowed.some((field) => field.name === "Id") ? ["Id"] : [];
    else state.selectedFields = [...new Set([...allowed.filter(requiredFieldForOperation).map((field) => field.name), ...state.selectedFields])];
    const fields = state.selectedFields.map(fieldByName).filter(Boolean);
    panel.innerHTML = `<div class="record-manual-fields-scroll"><div class="record-input-grid">${fields.map(inputMarkup).join("")}</div></div><div class="record-input-actions"><button class="record-add-field" type="button" data-add-field><span aria-hidden="true">+</span> Add Field</button><button class="record-button record-button-primary" type="button" data-stage-manual>Stage Records</button></div>`;
    panel.querySelectorAll(".record-input-grid > label").forEach((label, index) => {
      const caption = label.querySelector("span");
      const field = fields[index];
      if (!caption || !field) return;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "record-remove-field";
      remove.setAttribute("aria-label", `Remove ${field.label || field.name}`);
      remove.title = `Remove ${field.label || field.name}`;
      remove.textContent = "×";
      remove.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); state.selectedFields = state.selectedFields.filter((name) => name !== field.name); renderManualForm(); });
      caption.append(remove);
    });
    panel.querySelector("[data-add-field]")?.addEventListener("click", openFieldModal);
    panel.querySelector("[data-stage-manual]")?.addEventListener("click", () => {
      const data = {};
      panel.querySelectorAll("[data-record-field]").forEach((input) => { data[input.dataset.recordField] = input.type === "checkbox" ? input.checked : input.value; });
      stageRecords([data], "Manual record");
    });
  };
  const renderMatchFieldControl = () => {
    const settings = body.querySelector(".record-processing-settings");
    settings?.querySelector("[data-upsert-match]")?.remove();
    if (workspace.dataset.operation !== "upsert" || !settings) return;
    const fields = (state.describe?.fields || []).filter((field) => field.externalId === true && field.createable && field.updateable);
    if (!fields.some((field) => field.name === state.matchField)) state.matchField = fields[0]?.name || "";
    const row = document.createElement("div");
    row.className = "record-upsert-match";
    row.dataset.upsertMatch = "";
    row.innerHTML = `<label><span>Match using</span><select class="record-control" data-upsert-match-mode aria-label="Upsert match mode"><option value="id" ${state.upsertMatchMode === "id" ? "selected" : ""}>Id</option><option value="externalId" ${state.upsertMatchMode === "externalId" ? "selected" : ""}>External Id</option></select></label><label><span>External Id field</span><select class="record-control" data-upsert-match-field aria-label="Upsert external ID" ${state.upsertMatchMode === "id" ? "disabled" : ""}><option value="">Select field</option>${fields.map((field) => `<option value="${escapeHtml(field.name)}" ${field.name === state.matchField ? "selected" : ""}>${escapeHtml(field.label || field.name)} (${escapeHtml(field.name)})</option>`).join("")}</select></label>`;
    row.querySelector("[data-upsert-match-mode]")?.addEventListener("change", (event) => { state.upsertMatchMode = event.target.value === "id" ? "id" : "externalId"; state.validated = false; renderManualForm(); renderMatchFieldControl(); renderStageTable(); });
    row.querySelector("[data-upsert-match-field]")?.addEventListener("change", (event) => { state.matchField = event.target.value; state.validated = false; renderManualForm(); renderStageTable(); });
    settings.append(row);
  };
  const stageRecords = (records, source) => {
    const apiNames = new Map((state.describe?.fields || []).map((field) => [String(field.name).toLowerCase(), field.name]));
    const normalized = records.map((record) => {
      const rawData = Object.fromEntries(Object.entries(record || {}).filter(([, value]) => value !== "" && value !== undefined && value !== null));
      const columnMap = Object.fromEntries(Object.keys(rawData).map((column) => [column, apiNames.get(String(column).toLowerCase())]).filter(([, field]) => field));
      const data = Object.fromEntries(Object.entries(rawData).map(([column, value]) => [columnMap[column], value]).filter(([field]) => field));
      return { rawData, columnMap, data, unmatchedColumns: Object.keys(rawData).filter((column) => !columnMap[column]) };
    }).filter((record) => Object.keys(record.rawData).length);
    if (!normalized.length) { setNote("No values were found to stage."); return; }
    state.staged.push(...normalized.map((record) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ...record, source, selected: state.preferences.autoSelectStagedRecords, valid: null, errors: [], status: "Pending" })));
    state.validated = false;
    renderStageTable();
    const unmatched = new Set(normalized.flatMap((record) => record.unmatchedColumns)).size;
    setNote(unmatched ? `${normalized.length} record${normalized.length === 1 ? "" : "s"} staged from ${source}. ${unmatched} column${unmatched === 1 ? " needs" : "s need"} mapping.` : `${normalized.length} record${normalized.length === 1 ? "" : "s"} staged from ${source}.`);
  };
  const mappingErrorsFor = (row) => (row.unmatchedColumns || []).map((column) => `${column} must be mapped to an exact Salesforce field.`);
  const rowErrorsFor = (row) => [...new Set([...mappingErrorsFor(row), ...(row.errors || [])])];
  const updateSaveMappingAvailability = () => {
    const ready = state.staged.length > 0 && state.staged.every((row) => !(row.unmatchedColumns || []).length);
    if (saveMappingButton) {
      saveMappingButton.disabled = !ready;
      saveMappingButton.setAttribute("aria-disabled", String(!ready));
      saveMappingButton.title = ready ? "Save this Salesforce field mapping" : "Stage records and map every imported column to a Salesforce API field first.";
    }
  };
  const updateStageActionAvailability = () => {
    const hasRecords = state.staged.length > 0;
    body.querySelectorAll("[data-stage-compact], [data-stage-wrap], [data-map-columns], [data-clear-staged], [data-stage-maximize]").forEach((button) => {
      button.disabled = !hasRecords;
      button.setAttribute("aria-disabled", String(!hasRecords));
    });
  };
  const updateResultActionVisibility = () => {
    const actions = body.querySelector("[data-stage-result-actions]");
    if (actions) actions.hidden = !state.resultActionsVisible;
  };
  const stageExportRows = () => state.staged.map((row) => ({
    ...(row.rawData || {}),
    Operation: workspace.dataset.operation || "create",
    Status: row.status || "Pending",
    Error: rowErrorsFor(row).join(" ")
  }));
  const setStageActionStatus = (selector, message, stateName = "success", hideAfter = 1600) => {
    const target = body.querySelector(selector);
    if (!target) return;
    target.hidden = false;
    target.className = `record-stage-action-status is-${stateName}`;
    target.textContent = message;
    if (hideAfter) window.setTimeout(() => { target.hidden = true; }, hideAfter);
  };
  const downloadStageData = () => {
    const rows = stageExportRows();
    if (!rows.length) { setStageActionStatus("[data-stage-download-status]", "No data", "error", 2200); setNote("There is no staged table data to download."); return; }
    const format = body.querySelector("[data-stage-export-format]")?.value || "csv";
    const fileBase = `${state.objectName || "salesforce"}-import-results`;
    let blob;
    let filename;
    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Results");
      blob = new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      filename = `${fileBase}.xlsx`;
    } else {
      const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      const csv = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      filename = `${fileBase}.csv`;
    }
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    const label = format === "xlsx" ? "Excel" : "CSV";
    setStageActionStatus("[data-stage-download-status]", "Downloaded");
    setNote(`Downloaded ${rows.length} table row${rows.length === 1 ? "" : "s"} as ${label}.`);
  };
  const copyStageData = async () => {
    const rows = stageExportRows();
    if (!rows.length) { setStageActionStatus("[data-stage-copy-status]", "No data", "error", 2200); setNote("There is no staged table data to copy."); return; }
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const text = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))].map((line) => line.join("\t")).join("\n");
    try { await navigator.clipboard.writeText(text); setStageActionStatus("[data-stage-copy-status]", "Copied"); setNote(`Copied ${rows.length} table row${rows.length === 1 ? "" : "s"} to the clipboard.`); } catch { setStageActionStatus("[data-stage-copy-status]", "Failed", "error", 2200); setNote("Unable to copy table data. Allow clipboard access and try again."); }
  };
  const renderReviewProgress = () => {
    const operation = workspace.dataset.operation || "create";
    const reviewOperation = body.querySelector(".record-review-operation");
    const reviewIcon = reviewOperation?.querySelector(".record-review-icon");
    const reviewTitle = reviewOperation?.querySelector("[data-operation-title]");
    const presentation = { create: ["+", "Create records"], update: ["↻", "Update records"], upsert: ["⇄", "Upsert records"], delete: ["−", "Delete records"] }[operation] || ["+", "Create records"];
    reviewOperation?.classList.toggle("is-danger", operation === "delete");
    if (reviewIcon) reviewIcon.textContent = presentation[0];
    if (reviewTitle) reviewTitle.textContent = presentation[1];
    const canConfirm = Boolean(state.describe) && state.staged.some((row) => row.selected) && Boolean(state.validated);
    if (confirmationInput) {
      confirmationInput.disabled = !canConfirm;
      if (!canConfirm) confirmationInput.checked = false;
    }
    const complete = [Boolean(state.describe), state.staged.length > 0, Boolean(state.validated), Boolean(confirmationInput?.checked)];
    const firstPending = complete.findIndex((value) => !value);
    body.querySelectorAll(".record-checklist li").forEach((item, index) => {
      const done = complete[index];
      item.classList.toggle("is-complete", done);
      item.classList.toggle("is-current", !done && index === firstPending);
      const icon = item.querySelector("span");
      if (icon) icon.textContent = done ? "✓" : String(index + 1);
      const label = item.querySelector("strong");
      if (label && !label.querySelector(".record-required-mark")) label.insertAdjacentHTML("beforeend", '<em class="record-required-mark">Required</em>');
      const help = item.querySelector("small");
      if (help) {
        const selectedCount = state.staged.filter((row) => row.selected).length;
        const messages = [
          `${state.objectName} is selected`,
          selectedCount ? `${selectedCount} staged record${selectedCount === 1 ? " is" : "s are"} selected` : "Stage and select one or more records",
          state.validated ? `${selectedCount} selected record${selectedCount === 1 ? " has" : "s have"} passed validation` : "Validate the selected staged records",
          confirmationInput?.checked ? "Acknowledgment complete — ready to run" : "Confirm the operation to enable the Run button"
        ];
        help.textContent = messages[index];
      }
    });
    if (commitAction) {
      commitAction.disabled = state.executing || !canConfirm || !confirmationInput?.checked || !state.staged.some((row) => row.selected);
      commitAction.setAttribute("aria-disabled", String(commitAction.disabled));
    }
  };
  const renderStageTable = () => {
    const table = body.querySelector(".record-stage-table");
    if (!table) return;
    table.classList.toggle("is-compact", state.compactColumns);
    const selectedRows = state.staged.filter((row) => row.selected);
    const allSelected = state.staged.length > 0 && selectedRows.length === state.staged.length;
    table.innerHTML = `<thead><tr><th><input type="checkbox" data-stage-select-all aria-label="Select all staged records" ${allSelected ? "checked" : ""} ${state.staged.length ? "" : "disabled"} /></th><th>Record</th><th>Match key</th><th>Changed fields</th><th>Operation</th><th>Status</th></tr></thead><tbody>${state.staged.length ? state.staged.map((row, index) => { const fields = Object.keys(row.data); const key = row.data.Id || (state.matchField && row.data[state.matchField]) || "—"; const tone = row.valid === false ? "error" : row.valid === true ? "success" : "pending"; return `<tr data-stage-row="${row.id}"><td><input type="checkbox" data-stage-select="${row.id}" aria-label="Select staged row ${index + 1}" ${row.selected ? "checked" : ""} /></td><td>${escapeHtml(row.data.Name || row.source || `Record ${index + 1}`)}</td><td>${escapeHtml(key)}</td><td>${escapeHtml(fields.filter((field) => field !== "Id").join(", ") || "Id")}</td><td>${escapeHtml(workspace.dataset.operation || "create")}</td><td><span class="record-stage-status is-${tone}" title="${escapeHtml(row.errors.join(" "))}">${escapeHtml(row.status)}</span></td></tr>`; }).join("") : `<tr class="record-stage-empty"><td colspan="6"><span aria-hidden="true">⌁</span><strong>No records staged</strong><small>Use Manual Fields, File Upload, or Paste Data to prepare changes.</small></td></tr>`}</tbody>`;
    table.querySelector("[data-stage-select-all]")?.addEventListener("change", (event) => { state.staged.forEach((row) => { row.selected = event.target.checked; }); state.validated = false; renderStageTable(); });
    table.querySelectorAll("[data-stage-select]").forEach((input) => input.addEventListener("change", () => { const row = state.staged.find((item) => item.id === input.dataset.stageSelect); if (row) row.selected = input.checked; state.validated = false; renderStageTable(); }));
    if (!state.staged.length) {
      table.hidden = true;
      let placeholder = stageTableWrap?.querySelector(".record-stage-placeholder");
      if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.className = "record-stage-placeholder";
        placeholder.innerHTML = `<span aria-hidden="true">⌁</span><strong>No records staged</strong><small>Use Manual Fields, File Upload, or Paste Data to prepare changes.</small>`;
        stageTableWrap?.append(placeholder);
      }
    } else {
      table.hidden = false;
      stageTableWrap?.querySelector(".record-stage-placeholder")?.remove();
      const columns = [...new Set(state.staged.flatMap((row) => Object.keys(row.rawData || row.data || {})))];
      const showErrors = state.staged.some((row) => rowErrorsFor(row).length);
      table.classList.toggle("is-compact", state.compactColumns);
      table.classList.toggle("is-wrapped", state.wrapTableText);
      table.innerHTML = `<thead><tr><th><input type="checkbox" data-stage-select-all aria-label="Select all staged records" ${allSelected ? "checked" : ""} /></th>${columns.map((column) => `<th><span>${escapeHtml(column)}</span>${state.preferences.showFieldApiNames ? `<small class="record-stage-field-tag${state.staged.some((row) => !row.columnMap?.[column]) ? " is-unmapped" : ""}">${escapeHtml(state.staged.find((row) => row.columnMap?.[column])?.columnMap?.[column] || "Not mapped")}</small>` : ""}</th>`).join("")}<th>Operation</th><th>Status</th>${showErrors ? "<th>Error</th>" : ""}</tr></thead><tbody>${state.staged.map((row, index) => { const errors = rowErrorsFor(row); const tone = errors.length || row.valid === false ? "error" : row.valid === true ? "success" : "pending"; return `<tr><td><input type="checkbox" data-stage-select="${escapeHtml(row.id)}" aria-label="Select staged row ${index + 1}" ${row.selected ? "checked" : ""} /></td>${columns.map((column) => `<td class="${row.columnMap?.[column] ? "" : "is-unmapped"}">${escapeHtml(row.rawData?.[column] ?? "")}</td>`).join("")}<td>${escapeHtml(workspace.dataset.operation || "create")}</td><td><span class="record-stage-status is-${tone}" title="${escapeHtml(errors.join(" "))}">${escapeHtml(row.status)}</span></td>${showErrors ? `<td class="record-stage-error">${escapeHtml(errors.join(" ") || "—")}</td>` : ""}</tr>`; }).join("")}</tbody>`;
      table.querySelector("[data-stage-select-all]")?.addEventListener("change", (event) => { state.staged.forEach((row) => { row.selected = event.target.checked; }); state.validated = false; renderStageTable(); });
      table.querySelectorAll("[data-stage-select]").forEach((input) => input.addEventListener("change", () => { const row = state.staged.find((item) => item.id === input.dataset.stageSelect); if (row) row.selected = input.checked; state.validated = false; renderStageTable(); }));
      const statusHeader = [...table.querySelectorAll("thead th")].find((header) => header.textContent.trim().startsWith("Status"));
      if (statusHeader) {
        const statuses = [...new Set(state.staged.map((row) => row.status || "Pending"))];
        if (state.statusFilter !== "all" && !statuses.includes(state.statusFilter)) state.statusFilter = "all";
        const filter = document.createElement("div");
        filter.className = "record-stage-status-filter";
        filter.innerHTML = `<button class="record-stage-filter-toggle" type="button" aria-label="Filter status" title="Filter status" aria-expanded="false"><span aria-hidden="true"></span></button><div class="record-stage-filter-menu" role="menu"><button type="button" role="menuitem" data-stage-status-filter="all" class="${state.statusFilter === "all" ? "is-active" : ""}">All</button>${statuses.map((status) => `<button type="button" role="menuitem" data-stage-status-filter="${escapeHtml(status)}" class="${state.statusFilter === status ? "is-active" : ""}">${escapeHtml(status)}</button>`).join("")}</div>`;
        const toggle = filter.querySelector(".record-stage-filter-toggle");
        toggle?.addEventListener("click", () => { const open = filter.classList.toggle("is-open"); toggle.setAttribute("aria-expanded", String(open)); });
        filter.querySelectorAll("[data-stage-status-filter]").forEach((option) => option.addEventListener("click", () => { state.statusFilter = option.dataset.stageStatusFilter || "all"; renderStageTable(); }));
        statusHeader.append(filter);
      }
      const compactVisibleColumns = new Set([0, 1, columns.length + 1, columns.length + 2]);
      if (showErrors) compactVisibleColumns.add(columns.length + 3);
      table.querySelectorAll("tr").forEach((row) => {
        [...row.children].forEach((cell, index) => {
          cell.hidden = state.compactColumns && !compactVisibleColumns.has(index);
        });
      });
      table.querySelectorAll("tbody tr").forEach((element, index) => {
        const row = state.staged[index];
        element.hidden = state.statusFilter !== "all" && (row.status || "Pending") !== state.statusFilter;
      });
    }
    const footerParts = body.querySelectorAll(".record-stage-footer > span");
    if (footerParts[0]) footerParts[0].innerHTML = `Staged <strong>${state.staged.length}</strong>`;
    if (footerParts[1]) footerParts[1].innerHTML = `Valid <strong>${selectedRows.filter((row) => row.valid === true).length}</strong>`;
    if (footerParts[2]) footerParts[2].innerHTML = `Needs review <strong>${selectedRows.filter((row) => row.valid === false).length}</strong>`;
    renderReviewProgress();
    updateSaveMappingAvailability();
    updateStageActionAvailability();
    updateResultActionVisibility();
    renderMappings();
    const reviewObject = body.querySelector("[data-operation-object]");
    if (reviewObject) reviewObject.textContent = `${state.objectName} · ${selectedRows.length} records selected`;
  };
  const validateStagedRecords = () => {
    const selectedRows = state.staged.filter((row) => row.selected);
    if (!selectedRows.length) { state.validated = false; renderStageTable(); setNote("Select one or more staged records to validate."); return; }
    const operation = workspace.dataset.operation || "create";
    const required = operation === "create" ? (state.describe?.fields || []).filter((field) => field.createable && field.nillable === false && field.defaultedOnCreate !== true && !field.autoNumber).map((field) => field.name) : [];
    const externalId = state.matchField;
    selectedRows.forEach((row) => {
      const errors = [...mappingErrorsFor(row)];
      if (operation === "create" && Object.hasOwn(row.data, "Id")) errors.push("Id is not allowed when creating records.");
      if (["update", "delete"].includes(operation) && !row.data.Id) errors.push(`Id is required for ${operation}.`);
      if (operation === "upsert" && state.upsertMatchMode === "id" && !row.data.Id) errors.push("Id is required when Upsert matches by Id.");
      if (operation === "upsert" && state.upsertMatchMode === "externalId" && (!externalId || !row.data[externalId])) errors.push(`${externalId || "An external ID field"} is required when Upsert matches by External Id.`);
      required.forEach((field) => { if (!row.data[field]) errors.push(`${field} is required.`); });
      Object.entries(row.data).forEach(([name, value]) => { const field = fieldByName(name); if (!field) errors.push(`${name} is not a field on ${state.objectName}.`); if (field?.type === "picklist" && value && !(field.picklistValues || []).some((item) => item.value === value && item.active !== false)) errors.push(`${name} has an invalid picklist value.`); });
      row.errors = errors; row.valid = !errors.length; row.status = errors.length ? "Needs review" : "Ready";
    });
    state.validated = selectedRows.every((row) => row.valid);
    renderStageTable();
    setNote(state.validated ? "All staged records passed local validation. Confirm the operation to continue." : "Some staged records need review. Hover the status to see each error.");
  };
  const runWithConcurrency = async (items, limit, worker) => {
    const queue = [...items];
    await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), queue.length) }, async () => {
      while (queue.length) await worker(queue.shift());
    }));
  };
  const writeBatch = async (rows) => {
    const operation = workspace.dataset.operation || "create";
    let path = "/composite/sobjects";
    let method = "POST";
    let body = null;
    if (operation === "delete") {
      path = `/composite/sobjects?ids=${encodeURIComponent(rows.map((row) => row.data.Id).join(","))}&allOrNone=false`;
      method = "DELETE";
    } else {
      const records = rows.map((row) => {
        const values = { ...row.data, attributes: { type: state.objectName } };
        if (operation === "create") delete values.Id;
        if (operation === "update") { values.id = values.Id; delete values.Id; }
        if (operation === "upsert" && state.upsertMatchMode === "id") { values.id = values.Id; delete values.Id; }
        if (operation === "upsert" && state.upsertMatchMode === "externalId") delete values.Id;
        return values;
      });
      if (operation === "update") method = "PATCH";
      if (operation === "upsert" && state.upsertMatchMode === "externalId") { method = "PATCH"; path = `/composite/sobjects/${encodeURIComponent(state.objectName)}/${encodeURIComponent(state.matchField)}`; }
      if (operation === "upsert" && state.upsertMatchMode === "id") method = "PATCH";
      body = JSON.stringify({ allOrNone: false, records });
    }
    const response = await requestSalesforceApi(state.sessionId, sourceOrigin, path, { method, ...(body ? { body } : {}) }, { apiType: "" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.[0]?.message || payload?.message || response.statusText || "Salesforce rejected the batch.");
    const results = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload) ? payload : [];
    rows.forEach((row, index) => {
      const result = results[index] || {};
      const errors = Array.isArray(result.errors) ? result.errors.map((error) => error?.message || String(error)) : [];
      row.errors = errors;
      row.status = result.success === false || errors.length ? "Failed" : "Completed";
      row.valid = row.status === "Completed";
    });
  };
  const executeOperation = async () => {
    const rows = state.staged.filter((row) => row.selected);
    if (!state.validated || !confirmationInput?.checked || !rows.length) { setNote("Validate the selected rows and acknowledge the Salesforce change first."); return; }
    const batchSize = Math.min(200, Math.max(1, Number(body.querySelector("#record-batch-size")?.value) || 200));
    const threads = Math.min(5, Math.max(1, Number(body.querySelector("#record-threads")?.value) || 5));
    const batches = Array.from({ length: Math.ceil(rows.length / batchSize) }, (_, index) => rows.slice(index * batchSize, (index + 1) * batchSize));
    rows.forEach((row) => { row.status = "Processing"; row.errors = []; });
    state.resultActionsVisible = true;
    state.executing = true; renderStageTable(); setNote(`Sending ${rows.length} record${rows.length === 1 ? "" : "s"} to Salesforce in ${batches.length} batch${batches.length === 1 ? "" : "es"}…`);
    await runWithConcurrency(batches, threads, async (batch) => {
      try { await writeBatch(batch); } catch (error) { batch.forEach((row) => { row.status = "Failed"; row.errors = [error.message]; row.valid = false; }); }
      renderStageTable();
    });
    state.executing = false;
    const completed = rows.filter((row) => row.status === "Completed").length;
    const failed = rows.length - completed;
    confirmationInput.checked = false;
    renderStageTable();
    setNote(failed ? `${completed} completed; ${failed} failed. Hover Failed statuses for details.` : `${completed} Salesforce record${completed === 1 ? " was" : "s were"} processed successfully.`);
  };
  const wirePasteInput = () => {
    const panel = body.querySelector("[data-input-panel='paste']");
    const textarea = panel?.querySelector("textarea");
    const status = panel?.querySelector("[data-paste-status]");
    const stageButton = panel?.querySelector("[data-stage-paste]");
    if (!panel || !textarea || !status || !stageButton || panel.dataset.wired === "true") return;
    panel.dataset.wired = "true";
    const setPasteStatus = (message, kind = "") => { status.textContent = message; status.dataset.status = kind; };
    const readPastedData = () => {
      const text = textarea.value.trim();
      if (!text) throw new Error("Paste CSV text or cells copied from Excel first.");
      const records = parsePastedTable(text);
      if (!records.length) throw new Error("No data rows were found. Include a header row and at least one record.");
      const columns = Object.keys(records[0] || {}).filter(Boolean);
      if (!columns.length) throw new Error("No field API name headers were found.");
      return { records, columns };
    };
    textarea.addEventListener("input", () => {
      stageButton.disabled = !textarea.value.trim();
      if (!textarea.value.trim()) setPasteStatus("Paste data to prepare records for staging.");
      else setPasteStatus("Data pasted. Click Stage Records to parse and add it to the staging area.", "loading");
    });
    stageButton.addEventListener("click", () => {
      try {
        const { records, columns } = readPastedData();
        const before = state.staged.length;
        stageRecords(records, "Pasted data");
        const added = state.staged.length - before;
        setPasteStatus(added ? `${added} record${added === 1 ? "" : "s"} staged successfully from ${columns.length} column${columns.length === 1 ? "" : "s"}.` : "No recognized Salesforce field values were found to stage.", added ? "success" : "error");
      } catch (error) { setPasteStatus(`Could not stage pasted data: ${error.message}`, "error"); }
    });
  };
  const wireCsvInput = () => {
    const panel = body.querySelector("[data-input-panel='csv']");
    const dropzone = panel?.querySelector(".record-dropzone");
    if (!panel || !dropzone || panel.querySelector("[data-csv-file]")) return;
    const status = panel.querySelector("[data-file-status]");
    const stageButton = panel.querySelector("[data-stage-file]");
    const input = document.createElement("input"); input.type = "file"; input.accept = ".csv,text/csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; input.hidden = true; input.dataset.csvFile = ""; panel.append(input);
    const setFileStatus = (message, kind = "") => { if (status) { status.textContent = message; status.dataset.status = kind; } };
    const clearLoadedFile = () => { state.uploadedFile = null; if (stageButton) stageButton.disabled = true; };
    const readFile = async (file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!file || !["csv", "xls", "xlsx"].includes(extension)) { clearLoadedFile(); setFileStatus("Choose a CSV, XLS, or XLSX file.", "error"); return; }
      clearLoadedFile(); setFileStatus(`Reading ${file.name}…`, "loading");
      try {
        let records;
        let sheetName = "";
        if (extension === "csv") records = parseCsv(await file.text());
        else {
          const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
          sheetName = workbook.SheetNames[0] || "";
          if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
          records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false });
        }
        if (!records.length) throw new Error("No data rows were found. Ensure the first row contains field API names.");
        const columns = Object.keys(records[0] || {}).filter(Boolean);
        if (!columns.length) throw new Error("No column headers were found in the file.");
        state.uploadedFile = { name: file.name, records, source: sheetName ? `${file.name} · ${sheetName}` : file.name };
        if (stageButton) stageButton.disabled = false;
        setFileStatus(`Loaded ${file.name}${sheetName ? ` · ${sheetName}` : ""}: ${records.length} record${records.length === 1 ? "" : "s"}, ${columns.length} column${columns.length === 1 ? "" : "s"}. Ready to stage.`, "success");
      } catch (error) { clearLoadedFile(); setFileStatus(`Could not read ${file.name}: ${error.message}`, "error"); }
    };
    dropzone.addEventListener("click", () => input.click());
    dropzone.addEventListener("dragover", (event) => event.preventDefault());
    dropzone.addEventListener("drop", (event) => { event.preventDefault(); const [file] = event.dataTransfer?.files || []; if (file) void readFile(file); });
    input.addEventListener("change", () => { if (input.files?.[0]) void readFile(input.files[0]); input.value = ""; });
    stageButton?.addEventListener("click", () => {
      if (!state.uploadedFile) { setFileStatus("Choose a file and wait for it to finish loading first.", "error"); return; }
      const before = state.staged.length;
      stageRecords(state.uploadedFile.records, state.uploadedFile.source);
      const added = state.staged.length - before;
      setFileStatus(added ? `${state.uploadedFile.name}: ${added} record${added === 1 ? "" : "s"} staged successfully.` : "No recognized Salesforce field values were found to stage.", added ? "success" : "error");
    });
  };
  const selectObject = async (objectName) => {
    state.objectName = objectName;
    selectedObject.textContent = objectName;
    renderObjectPicker();
    renderOperationAvailability();
    state.describe = null; state.selectedFields = []; state.manualFieldsInitialized = false; state.staged = []; state.resultActionsVisible = false; state.uploadedFile = null; state.validated = false;
    const stageFileButton = body.querySelector("[data-stage-file]");
    if (stageFileButton) stageFileButton.disabled = true;
    const fileStatus = body.querySelector("[data-file-status]");
    if (fileStatus) { fileStatus.textContent = "No file selected."; fileStatus.dataset.status = ""; }
    const pasteInput = body.querySelector("#record-paste-input");
    const stagePasteButton = body.querySelector("[data-stage-paste]");
    const pasteStatus = body.querySelector("[data-paste-status]");
    if (pasteInput) pasteInput.value = "";
    if (stagePasteButton) stagePasteButton.disabled = true;
    if (pasteStatus) { pasteStatus.textContent = "Paste data to prepare records for staging."; pasteStatus.dataset.status = ""; }
    renderStageTable(); setNote(`Loading ${objectName} fields…`);
    try { state.describe = await getSObjectDescribe(state.sessionId, objectName, sourceOrigin); const externalId = state.describe.fields?.find((field) => field.externalId === true); state.matchField = externalId?.name || ""; state.upsertMatchMode = state.preferences.defaultUpsertMatchMode; renderManualForm(); renderMatchFieldControl(); wirePasteInput(); wireCsvInput(); const availability = renderOperationAvailability(); const currentOperation = workspace.dataset.operation || "create"; if (!availability[currentOperation]) selectOperation(Object.keys(availability).find((operation) => availability[operation]) || "create"); renderStageTable(); setNote(`${objectName} metadata loaded. Select fields and stage records.`); } catch (error) { setNote(`Unable to load ${objectName}: ${error.message}`); }
  };
  const setMappingsStatus = (message) => { if (message) setNote(message); };
  const setMappingsCollapsed = (collapsed) => {
    if (collapsed && mappingsPanel && !mappingsPanel.classList.contains("is-collapsed")) mappingsPanel.dataset.expandedWidth = String(mappingsPanel.getBoundingClientRect().width);
    mappingsPanel?.classList.toggle("is-collapsed", collapsed);
    workspace.classList.toggle("has-expanded-mappings", !collapsed);
    workArea?.style.removeProperty("grid-template-columns");
    if (mappingsPanel) {
      if (collapsed) { mappingsPanel.style.width = ""; mappingsPanel.style.minWidth = ""; mappingsPanel.style.flexBasis = ""; }
      else { const width = Number(mappingsPanel.dataset.expandedWidth) || 270; mappingsPanel.style.width = `${width}px`; mappingsPanel.style.minWidth = `${width}px`; mappingsPanel.style.flexBasis = `${width}px`; }
    }
    collapseMappingsButton?.classList.toggle("is-collapsed", collapsed);
    collapseMappingsButton?.setAttribute("aria-expanded", String(!collapsed));
    collapseMappingsButton?.setAttribute("aria-label", collapsed ? "Expand saved mappings" : "Collapse saved mappings");
    collapseMappingsButton?.setAttribute("title", collapsed ? "Expand saved mappings" : "Collapse saved mappings");
  };
  const mixHexColor = (base, target, amount) => {
    const rgb = (color) => [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((value) => Number.parseInt(value, 16));
    const [baseRed, baseGreen, baseBlue] = rgb(base);
    const [targetRed, targetGreen, targetBlue] = rgb(target);
    const mix = (from, to) => Math.round(from + (to - from) * amount).toString(16).padStart(2, "0");
    return `#${mix(baseRed, targetRed)}${mix(baseGreen, targetGreen)}${mix(baseBlue, targetBlue)}`;
  };
  const stageTableTextColor = (color) => {
    const [red, green, blue] = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((value) => Number.parseInt(value, 16) / 255);
    const linear = (channel) => (channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    const luminance = .2126 * linear(red) + .7152 * linear(green) + .0722 * linear(blue);
    return luminance < .42 ? "#f7fbff" : "#1f3f5c";
  };
  const applyStageTablePalette = (color) => {
    const properties = ["--ri-stage-table-color", "--ri-stage-table-header-text", "--ri-stage-table-header-border", "--ri-stage-table-row-bg", "--ri-stage-table-row-alt-bg", "--ri-stage-table-row-hover-bg", "--ri-stage-table-row-border", "--ri-stage-table-row-text"];
    if (!/^#[\da-f]{6}$/i.test(color || "")) {
      properties.forEach((property) => workspace.style.removeProperty(property));
      return;
    }
    const base = color.toLowerCase();
    const palette = {
      "--ri-stage-table-color": base,
      "--ri-stage-table-header-text": stageTableTextColor(base),
      "--ri-stage-table-header-border": mixHexColor(base, "#4b6b85", .42),
      "--ri-stage-table-row-bg": mixHexColor(base, "#ffffff", .91),
      "--ri-stage-table-row-alt-bg": mixHexColor(base, "#ffffff", .82),
      "--ri-stage-table-row-hover-bg": mixHexColor(base, "#ffffff", .68),
      "--ri-stage-table-row-border": mixHexColor(base, "#6c8499", .58),
      "--ri-stage-table-row-text": "#1f3f5c"
    };
    Object.entries(palette).forEach(([property, value]) => workspace.style.setProperty(property, value));
  };
  const applyDataImportPreferences = (preferences, applyInputMode = false) => {
    const firstLoad = !state.preferencesInitialized;
    state.preferences = { ...getDefaultDataImportPreferences(), ...(preferences || {}) };
    state.preferencesInitialized = true;
    if (firstLoad) state.upsertMatchMode = state.preferences.defaultUpsertMatchMode;
    state.compactColumns = state.preferences.compactColumns;
    state.wrapTableText = state.preferences.wrapTableText;
    applyStageTablePalette(state.preferences.stageTableColor);
    const batchSize = body.querySelector("#record-batch-size");
    const threads = body.querySelector("#record-threads");
    const format = body.querySelector("[data-stage-export-format]");
    const compactButton = body.querySelector("[data-stage-compact]");
    const wrapButton = body.querySelector("[data-stage-wrap]");
    if (batchSize) batchSize.value = String(state.preferences.batchSize);
    if (threads) threads.value = String(state.preferences.threads);
    if (format) format.value = state.preferences.defaultDownloadFormat;
    if (compactButton) compactButton.textContent = state.compactColumns ? "All columns" : "Compact columns";
    if (wrapButton) {
      wrapButton.textContent = state.wrapTableText ? "↩ Single line" : "↪ Wrap text";
      wrapButton.title = state.wrapTableText ? "Keep values on one line" : "Wrap long values";
    }
    if (operationSidebar) {
      operationSidebar.style.width = `${state.preferences.operationPanelWidth}px`;
      operationSidebar.style.minWidth = `${state.preferences.operationPanelWidth}px`;
      operationSidebar.style.flexBasis = `${state.preferences.operationPanelWidth}px`;
    }
    if (mappingsPanel) {
      mappingsPanel.dataset.expandedWidth = String(state.preferences.savedMappingsWidth);
      if (state.preferences.savedMappingsVisible) {
        mappingsPanel.style.width = `${state.preferences.savedMappingsWidth}px`;
        mappingsPanel.style.minWidth = `${state.preferences.savedMappingsWidth}px`;
        mappingsPanel.style.flexBasis = `${state.preferences.savedMappingsWidth}px`;
      }
    }
    setMappingsCollapsed(!state.preferences.savedMappingsVisible);
    if (applyInputMode) {
      const mode = state.preferences.defaultInputMode;
      workspace.dataset.inputMode = mode;
      body.querySelectorAll(".record-input-tabs [data-input-mode]").forEach((button) => {
        const active = button.dataset.inputMode === mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
      body.querySelectorAll("[data-input-panel]").forEach((panel) => { panel.hidden = panel.dataset.inputPanel !== mode; });
    }
    if (state.staged.length) renderStageTable();
  };
  dataImportPreferencesChannel?.addEventListener("message", (event) => {
    if (event.data?.type === "preferences") applyDataImportPreferences(event.data.preferences, true);
  });
  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes["lc-data-import-preferences"]) return;
    void getStoredDataImportPreferences().then((preferences) => applyDataImportPreferences(preferences, true));
  });
  const renderMappings = () => {
    if (!mappingsList) return;
    const mappings = loadMappings();
    if (!mappings.length) { mappingsList.innerHTML = '<div class="record-mappings-empty">No saved mappings</div>'; return; }
    const term = String(mappingsSearch?.value || "").trim().toLowerCase();
    const visible = mappings.filter((mapping) => !term || `${mapping.name || ""} ${mapping.objectName || ""} ${mapping.operation || ""}`.toLowerCase().includes(term));
    if (!visible.length) { mappingsList.innerHTML = '<div class="record-mappings-empty">No matching mappings</div>'; return; }
    mappingsList.innerHTML = visible.sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0)).map((mapping) => {
      const count = Array.isArray(mapping.fields) ? mapping.fields.length : 0;
      const savedAt = mapping.updatedAt ? new Date(mapping.updatedAt).toLocaleString() : "Saved mapping";
      return `<div class="record-mapping-item" role="listitem"><button class="record-mapping-load" type="button" data-load-mapping="${escapeHtml(mapping.id)}"><span class="record-mapping-star" aria-hidden="true">☆</span><span class="record-mapping-copy"><strong>${escapeHtml(mapping.name)}</strong><small>${escapeHtml(mapping.objectName)} · ${escapeHtml(mapping.operation)} · ${count} fields</small><small>${escapeHtml(savedAt)}</small></span></button><button class="record-mapping-delete" type="button" data-delete-mapping="${escapeHtml(mapping.id)}" aria-label="Delete ${escapeHtml(mapping.name)}" title="Delete mapping">⌫</button></div>`;
    }).join("");
    mappingsList.querySelectorAll("[data-delete-mapping]").forEach((button) => { button.textContent = ""; });
    mappingsList.querySelectorAll("[data-load-mapping]").forEach((button) => {
      const mapping = mappings.find((entry) => entry.id === button.dataset.loadMapping);
      const canLoad = state.staged.length > 0 && mapping?.objectName === state.objectName;
      button.disabled = !canLoad;
      button.setAttribute("aria-disabled", String(!canLoad));
      button.title = canLoad ? "Apply this mapping to the staged records" : state.staged.length ? `This mapping is for ${mapping?.objectName || "another object"}; the staged records are ${state.objectName}.` : "Stage records before applying a saved mapping.";
    });
    mappingsList.querySelectorAll("[data-load-mapping]").forEach((button) => button.addEventListener("click", () => void loadSavedMapping(button.dataset.loadMapping)));
    mappingsList.querySelectorAll("[data-delete-mapping]").forEach((button) => button.addEventListener("click", () => { saveMappings(loadMappings().filter((mapping) => mapping.id !== button.dataset.deleteMapping)); renderMappings(); setNote("Saved mapping deleted."); }));
  };
  const saveCurrentMapping = () => {
    if (saveMappingButton?.disabled) { setNote("Stage records and map every imported column to Salesforce API fields before saving this mapping."); return; }
    const name = window.prompt("Name this field mapping", `${state.objectName} ${workspace.dataset.operation || "create"}`);
    if (!name?.trim()) return;
    const existing = loadMappings();
    const mappedFields = [...new Set(state.staged.flatMap((row) => Object.values(row.columnMap || {})))];
    const columnMappings = {};
    state.staged.forEach((row) => Object.entries(row.columnMap || {}).forEach(([sourceColumn, targetField]) => { if (sourceColumn && targetField && !columnMappings[sourceColumn]) columnMappings[sourceColumn] = targetField; }));
    const next = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: name.trim(), objectName: state.objectName, operation: workspace.dataset.operation || "create", fields: mappedFields, columnMappings, matchField: state.matchField, upsertMatchMode: state.upsertMatchMode, updatedAt: Date.now() };
    saveMappings([next, ...existing.filter((mapping) => mapping.name.toLowerCase() !== next.name.toLowerCase())].slice(0, state.preferences.savedMappingLimit));
    renderMappings(); setMappingsStatus(`Saved ${next.name}.`);
  };
  const loadSavedMapping = async (mappingId) => {
    const mapping = loadMappings().find((entry) => entry.id === mappingId);
    if (!mapping) { setMappingsStatus("This mapping is no longer available."); return; }
    if (!state.objects.some((object) => object.name === mapping.objectName)) { setMappingsStatus(`You no longer have access to ${mapping.objectName}.`); return; }
    if (!state.staged.length) { setMappingsStatus("Stage records before applying a saved mapping."); return; }
    if (mapping.objectName !== state.objectName) { setMappingsStatus(`This mapping is for ${mapping.objectName}; select staged ${mapping.objectName} records first.`); return; }
    setMappingsStatus(`Loading ${mapping.name}…`);
    selectOperation(mapping.operation);
    state.selectedFields = Array.isArray(mapping.fields) ? mapping.fields : [];
    state.manualFieldsInitialized = true;
    state.matchField = mapping.matchField || state.matchField;
    state.upsertMatchMode = mapping.upsertMatchMode === "id" ? "id" : "externalId";
    const savedColumns = mapping.columnMappings && typeof mapping.columnMappings === "object" ? mapping.columnMappings : {};
    const savedColumnsLowerCase = new Map(Object.entries(savedColumns).map(([sourceColumn, targetField]) => [String(sourceColumn).toLowerCase(), targetField]));
    const availableNames = new Set((state.describe?.fields || []).map((field) => field.name));
    state.staged.forEach((row) => {
      Object.keys(row.rawData || {}).forEach((sourceColumn) => {
        const targetField = savedColumns[sourceColumn] || savedColumnsLowerCase.get(String(sourceColumn).toLowerCase());
        if (targetField && availableNames.has(targetField)) row.columnMap[sourceColumn] = targetField;
      });
      row.data = Object.fromEntries(Object.entries(row.rawData || {}).map(([sourceColumn, value]) => [row.columnMap?.[sourceColumn], value]).filter(([targetField]) => targetField));
      row.unmatchedColumns = Object.keys(row.rawData || {}).filter((sourceColumn) => !row.columnMap?.[sourceColumn]);
      row.errors = [];
      row.valid = null;
      row.status = "Pending";
    });
    state.validated = false;
    renderManualForm(); renderMatchFieldControl(); renderStageTable();
    const status = `Loaded ${mapping.name}: ${mapping.objectName} ${mapping.operation}.`;
    setMappingsStatus(status); setNote(status);
  };
  const chooseSavedMapping = () => { setMappingsCollapsed(false); renderMappings(); setMappingsStatus("Click a mapping to load it, or save the current setup."); };
  const resetOperation = () => {
    state.staged = []; state.selectedFields = []; state.manualFieldsInitialized = false; state.resultActionsVisible = false; state.uploadedFile = null; state.validated = false; state.upsertMatchMode = state.preferences.defaultUpsertMatchMode; state.matchField = state.describe?.fields?.find((field) => field.externalId === true)?.name || "";
    const stageFileButton = body.querySelector("[data-stage-file]");
    if (stageFileButton) stageFileButton.disabled = true;
    const fileStatus = body.querySelector("[data-file-status]");
    if (fileStatus) { fileStatus.textContent = "No file selected."; fileStatus.dataset.status = ""; }
    const pasteInput = body.querySelector("#record-paste-input");
    const stagePasteButton = body.querySelector("[data-stage-paste]");
    const pasteStatus = body.querySelector("[data-paste-status]");
    if (pasteInput) pasteInput.value = "";
    if (stagePasteButton) stagePasteButton.disabled = true;
    if (pasteStatus) { pasteStatus.textContent = "Paste data to prepare records for staging."; pasteStatus.dataset.status = ""; }
    if (confirmationInput) confirmationInput.checked = false;
    selectOperation(state.preferences.defaultOperation); renderManualForm(); renderMatchFieldControl(); renderStageTable();
    setNote("New operation ready. Choose an input method and stage records.");
  };
  const initialize = async () => {
    state.loading = true; setNote("Connecting to Salesforce…");
    try {
      applyDataImportPreferences(await getStoredDataImportPreferences(), true);
      state.sessionId = await getSessionIdFromCookie(sourceOrigin);
      if (!state.sessionId) throw new Error("Salesforce session cookie not found. Open Data Import from a signed-in Salesforce page.");
      state.objects = (await getSObjectList(state.sessionId, sourceOrigin)).filter((item) => item?.name && (item.createable || item.updateable || item.deletable)).sort((left, right) => String(left.label || left.name).localeCompare(String(right.label || right.name)));
      if (!state.objects.length) throw new Error("Salesforce returned no accessible objects for record operations.");
      objectSelect.innerHTML = state.objects.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.label || item.name)} (${escapeHtml(item.name)})</option>`).join("");
      state.objectName = state.objects.some((item) => item.name === "Account") ? "Account" : state.objects[0].name;
      objectSelect.value = state.objectName; objectSelect.disabled = false; objectPickerToggle.disabled = false; renderObjectPicker();
      await selectObject(state.objectName);
      state.selectedFields = [];
      state.manualFieldsInitialized = false;
      selectOperation(state.preferences.defaultOperation);
    } catch (error) { objectSelect.innerHTML = '<option>Connection unavailable</option>'; objectPickerToggle.disabled = true; renderObjectPicker(); setNote(error.message); }
    finally { state.loading = false; }
  };
  objectSelect.addEventListener("change", () => void selectObject(objectSelect.value));
  objectPickerToggle.addEventListener("click", () => {
    const opening = objectPickerMenu.hidden;
    objectPickerMenu.hidden = !opening;
    objectPickerToggle.setAttribute("aria-expanded", String(opening));
    if (opening) { objectPickerVisibleCount = 80; objectPickerSearch.value = ""; renderObjectPicker(); objectPickerSearch.focus(); }
  });
  objectPickerSearch.addEventListener("input", () => { objectPickerVisibleCount = 80; renderObjectPicker(); });
  objectPickerList.addEventListener("scroll", () => { if (objectPickerList.scrollTop + objectPickerList.clientHeight >= objectPickerList.scrollHeight - 40) { objectPickerVisibleCount += 80; renderObjectPicker(); } });
  document.addEventListener("click", (event) => { if (!objectPickerMenu.hidden && !event.target.closest(".record-object-picker")) closeObjectPicker(); });
  const bindOperationResizer = () => {
    const resizer = body.querySelector("#record-operation-resizer");
    if (!resizer || !operationSidebar) return;
    let dragging = false;
    const resize = (clientX) => {
      const bounds = workspace.getBoundingClientRect();
      const width = Math.max(170, Math.min(320, clientX - bounds.left));
      operationSidebar.style.width = `${width}px`; operationSidebar.style.minWidth = `${width}px`; operationSidebar.dataset.expandedWidth = String(width);
    };
    resizer.addEventListener("pointerdown", (event) => { dragging = true; resizer.setPointerCapture(event.pointerId); resizer.classList.add("is-dragging"); });
    resizer.addEventListener("pointermove", (event) => { if (dragging) resize(event.clientX); });
    const stop = () => { dragging = false; resizer.classList.remove("is-dragging"); };
    resizer.addEventListener("pointerup", stop); resizer.addEventListener("pointercancel", stop);
    resizer.addEventListener("keydown", (event) => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); resize(operationSidebar.getBoundingClientRect().right + (event.key === "ArrowRight" ? 16 : -16)); });
  };
  const bindSectionResizer = (resizerId, beforePanel, afterPanel, beforeMinimum, afterMinimum) => {
    const resizer = body.querySelector(`#${resizerId}`);
    if (!resizer || !workArea || !beforePanel || !afterPanel) return;
    let dragging = false;
    const resize = (clientX) => {
      const beforeBounds = beforePanel.getBoundingClientRect();
      const afterBounds = afterPanel.getBoundingClientRect();
      const delta = clientX - resizer.getBoundingClientRect().left;
      const beforeWidth = Math.max(beforeMinimum, Math.min(beforeBounds.width + afterBounds.width - afterMinimum, beforeBounds.width + delta));
      const afterWidth = Math.max(afterMinimum, beforeBounds.width + afterBounds.width - beforeWidth);
      const inputWidth = inputPanel.getBoundingClientRect().width;
      const stageWidth = stagePanel.getBoundingClientRect().width;
      const reviewWidth = reviewPanel.getBoundingClientRect().width;
      if (beforePanel === inputPanel) workArea.style.gridTemplateColumns = `${beforeWidth}px 5px ${afterWidth}px 5px ${reviewWidth}px`;
      else workArea.style.gridTemplateColumns = `${inputWidth}px 5px ${beforeWidth}px 5px ${afterWidth}px`;
    };
    resizer.addEventListener("pointerdown", (event) => { dragging = true; resizer.setPointerCapture(event.pointerId); resizer.classList.add("is-dragging"); });
    resizer.addEventListener("pointermove", (event) => { if (dragging) resize(event.clientX); });
    const stop = () => { dragging = false; resizer.classList.remove("is-dragging"); };
    resizer.addEventListener("pointerup", stop); resizer.addEventListener("pointercancel", stop);
    resizer.addEventListener("keydown", (event) => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); resize(resizer.getBoundingClientRect().left + (event.key === "ArrowRight" ? 20 : -20)); });
  };
  const bindMappingsResizer = () => {
    const resizer = body.querySelector("#record-mappings-resizer");
    if (!resizer || !mappingsPanel) return;
    let dragging = false;
    const resize = (clientX) => {
      const bounds = workspace.getBoundingClientRect();
      const width = Math.max(220, Math.min(420, bounds.right - clientX));
      mappingsPanel.style.width = `${width}px`; mappingsPanel.style.minWidth = `${width}px`; mappingsPanel.style.flexBasis = `${width}px`; mappingsPanel.dataset.expandedWidth = String(width);
    };
    resizer.addEventListener("pointerdown", (event) => { if (mappingsPanel.classList.contains("is-collapsed")) setMappingsCollapsed(false); dragging = true; resizer.setPointerCapture(event.pointerId); resizer.classList.add("is-dragging"); });
    resizer.addEventListener("pointermove", (event) => { if (dragging) resize(event.clientX); });
    const stop = () => { dragging = false; resizer.classList.remove("is-dragging"); };
    resizer.addEventListener("pointerup", stop); resizer.addEventListener("pointercancel", stop);
    resizer.addEventListener("keydown", (event) => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); resize(mappingsPanel.getBoundingClientRect().left + (event.key === "ArrowLeft" ? 16 : -16)); });
  };
  const unmatchedStageColumns = () => [...new Set(state.staged.flatMap((row) => row.unmatchedColumns || []))];
  const closeColumnMapModal = () => { columnMapModal.hidden = true; };
  const renderColumnMapModal = () => {
    const list = columnMapModal.querySelector("[data-column-map-list]");
    const summary = columnMapModal.querySelector("[data-column-map-summary]");
    const done = columnMapModal.querySelector("[data-apply-column-map]");
    const columns = unmatchedStageColumns();
    const fields = availableFields();
    if (!columns.length) {
      list.innerHTML = '<div class="record-column-map-empty">All staged columns are already mapped to Salesforce fields.</div>';
      summary.textContent = "No mapping changes are needed.";
      done.disabled = false;
      return;
    }
    list.innerHTML = columns.map((column) => `<div class="record-column-map-row"><div><strong>${escapeHtml(column)}</strong><small>Unmatched imported column</small></div><div><input class="record-control" type="search" data-column-filter="${escapeHtml(column)}" placeholder="Search Salesforce fields" autocomplete="off" /><select class="record-control" data-column-target="${escapeHtml(column)}"><option value="">Select Salesforce field</option>${fields.map((field) => `<option value="${escapeHtml(field.name)}" ${state.pendingColumnMappings[column] === field.name ? "selected" : ""}>${escapeHtml(field.label || field.name)} (${escapeHtml(field.name)})</option>`).join("")}</select></div></div>`).join("");
    const mapped = columns.filter((column) => state.pendingColumnMappings[column]).length;
    summary.textContent = `${mapped} of ${columns.length} columns mapped`;
    done.disabled = mapped !== columns.length;
    list.querySelectorAll("[data-column-target]").forEach((select) => select.addEventListener("change", () => { state.pendingColumnMappings[select.dataset.columnTarget] = select.value; renderColumnMapModal(); }));
    list.querySelectorAll("[data-column-filter]").forEach((input) => input.addEventListener("input", () => {
      const term = input.value.trim().toLowerCase();
      const select = list.querySelector(`[data-column-target="${CSS.escape(input.dataset.columnFilter)}"]`);
      if (!select) return;
      [...select.options].forEach((option, index) => { option.hidden = index > 0 && !option.text.toLowerCase().includes(term); });
    }));
  };
  const openColumnMapModal = () => {
    if (!state.staged.length) { setNote("Stage one or more records before mapping columns."); return; }
    state.pendingColumnMappings = {};
    columnMapModal.hidden = false;
    renderColumnMapModal();
  };
  const applyColumnMappings = () => {
    Object.entries(state.pendingColumnMappings).forEach(([column, field]) => {
      if (!field) return;
      state.staged.forEach((row) => {
        if (!(column in (row.rawData || {}))) return;
        row.columnMap[column] = field;
        row.data = Object.fromEntries(Object.entries(row.rawData).map(([source, value]) => [row.columnMap[source], value]).filter(([target]) => target));
        row.unmatchedColumns = Object.keys(row.rawData).filter((source) => !row.columnMap[source]);
        row.errors = [];
        row.valid = null;
        row.status = "Pending";
      });
    });
    state.validated = false;
    closeColumnMapModal();
    renderStageTable();
    setNote("Column mappings applied to the staged records.");
  };
  bindOperationResizer();
  bindSectionResizer("record-step-two-resizer", inputPanel, stagePanel, 250, 300);
  bindSectionResizer("record-step-three-resizer", stagePanel, reviewPanel, 300, 225);
  bindMappingsResizer();
  body.querySelector("[data-close-field-modal]")?.addEventListener("click", closeFieldModal);
  fieldModal?.addEventListener("click", (event) => { if (event.target === fieldModal) closeFieldModal(); });
  fieldModalSearch?.addEventListener("input", renderFieldModal);
  columnMapModal.querySelector("[data-close-column-map]")?.addEventListener("click", closeColumnMapModal);
  columnMapModal.querySelector("[data-apply-column-map]")?.addEventListener("click", applyColumnMappings);
  columnMapModal.addEventListener("click", (event) => { if (event.target === columnMapModal) closeColumnMapModal(); });
  document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; if (!fieldModal?.hidden) closeFieldModal(); if (!columnMapModal.hidden) closeColumnMapModal(); });
  collapseMappingsButton?.addEventListener("click", () => setMappingsCollapsed(!mappingsPanel?.classList.contains("is-collapsed")));
  mappingsSearch?.addEventListener("input", renderMappings);
  saveMappingButton?.addEventListener("click", saveCurrentMapping);
  clearMappingsButton?.addEventListener("click", () => {
    if (!loadMappings().length || !window.confirm("Clear all saved data mappings for this Salesforce org?")) return;
    saveMappings([]); renderMappings(); setMappingsStatus("Saved mappings cleared.");
  });
  renderMappings();
  body.querySelector(".record-toolbar-controls .record-button")?.addEventListener("click", resetOperation);
  const compactColumnsButton = body.querySelector("[data-stage-compact]");
  compactColumnsButton?.addEventListener("click", () => { state.compactColumns = !state.compactColumns; compactColumnsButton.textContent = state.compactColumns ? "All columns" : "Compact columns"; renderStageTable(); });
  const wrapTableButton = body.querySelector("[data-stage-wrap]");
  wrapTableButton?.addEventListener("click", () => { state.wrapTableText = !state.wrapTableText; wrapTableButton.textContent = state.wrapTableText ? "↩ Single line" : "↪ Wrap text"; wrapTableButton.title = state.wrapTableText ? "Keep values on one line" : "Wrap long values"; renderStageTable(); });
  const maximizeStageButton = body.querySelector("[data-stage-maximize]");
  maximizeStageButton?.addEventListener("click", () => { state.stageMaximized = !state.stageMaximized; workArea?.classList.toggle("is-stage-maximized", state.stageMaximized); maximizeStageButton.textContent = "⛶"; maximizeStageButton.setAttribute("aria-label", state.stageMaximized ? "Restore staging area" : "Maximize staging area"); maximizeStageButton.title = state.stageMaximized ? "Restore staging area" : "Maximize staging area"; });
  body.querySelector("[data-stage-download]")?.addEventListener("click", downloadStageData);
  body.querySelector("[data-stage-copy]")?.addEventListener("click", () => void copyStageData());
  body.querySelector("[data-map-columns]")?.addEventListener("click", openColumnMapModal);
  body.querySelector("[data-ui-action='validate']")?.addEventListener("click", validateStagedRecords);
  body.querySelector("[data-clear-staged]")?.addEventListener("click", () => { state.staged = []; state.validated = false; state.resultActionsVisible = false; if (state.stageMaximized) { state.stageMaximized = false; workArea?.classList.remove("is-stage-maximized"); } renderStageTable(); setNote("Staged records cleared."); });
  confirmationInput?.addEventListener("change", renderStageTable);
  commitAction?.addEventListener("click", () => void executeOperation());
  void initialize();
  const selectOperation = (operation) => {
    const availability = renderOperationAvailability();
    if (!availability[operation]) {
      const fallback = Object.keys(availability).find((candidate) => availability[candidate]);
      if (fallback && fallback !== operation) { selectOperation(fallback); return; }
      setNote(`The selected object does not allow ${operation} operations.`);
      return;
    }
    const details = operationLabels[operation] || operationLabels.create;
    workspace.dataset.operation = operation;
    body.querySelectorAll(".record-operation-card[data-operation]").forEach((button) => { const active = button.dataset.operation === operation; button.classList.toggle("is-active", active); button.setAttribute("aria-checked", String(active)); });
    body.querySelector("[data-operation-title]").textContent = details.title;
    body.querySelector("[data-operation-description]").textContent = details.description;
    body.querySelector("[data-operation-object]").textContent = `${selectedObject.textContent} · 0 records staged`;
    body.querySelector("[data-ui-action='commit']").textContent = details.action;
    state.validated = false;
    if (confirmationInput) confirmationInput.checked = false;
    renderManualForm();
    renderMatchFieldControl();
    renderStageTable();
    uiNote.textContent = `${details.title} UI selected — Salesforce actions are not connected yet`;
  };
  const selectInputMode = (mode) => {
    workspace.dataset.inputMode = mode;
    body.querySelectorAll(".record-input-tabs [data-input-mode]").forEach((button) => { const active = button.dataset.inputMode === mode; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active)); });
    body.querySelectorAll("[data-input-panel]").forEach((panel) => { panel.hidden = panel.dataset.inputPanel !== mode; });
    uiNote.textContent = `${mode === "manual" ? "Manual Fields" : mode === "csv" ? "File Upload" : "Paste Data"} selected.`;
  };
  body.querySelectorAll(".record-operation-card[data-operation]").forEach((button) => button.addEventListener("click", () => selectOperation(button.dataset.operation)));
  body.querySelectorAll(".record-input-tabs [data-input-mode]").forEach((button) => button.addEventListener("click", () => selectInputMode(button.dataset.inputMode)));
  body.querySelectorAll("[data-explorer-tab]").forEach((button) => button.addEventListener("click", () => { const tab = button.dataset.explorerTab; body.querySelectorAll("[data-explorer-tab]").forEach((item) => { const active = item === button; item.classList.toggle("is-active", active); item.setAttribute("aria-selected", String(active)); }); body.querySelectorAll("[data-explorer-panel]").forEach((panel) => { panel.hidden = panel.dataset.explorerPanel !== tab; }); body.querySelector(".record-search-label").hidden = tab === "fields"; body.querySelector("#record-object-search").hidden = tab === "fields"; }));
  body.querySelectorAll("[data-object]").forEach((button) => button.addEventListener("click", () => { body.querySelectorAll("[data-object]").forEach((item) => { const active = item === button; item.classList.toggle("is-selected", active); item.setAttribute("aria-selected", String(active)); }); selectedObject.textContent = button.dataset.object; body.querySelector("[data-operation-object]").textContent = `${button.dataset.object} · 0 records staged`; uiNote.textContent = `${button.dataset.object} selected — live object metadata will load later`; }));
  // Input, validation, and execution controls are wired above; no preview-only handler remains.
}
