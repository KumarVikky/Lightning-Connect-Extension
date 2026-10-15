import { getSessionIdFromCookie, getFieldDefinitions, getSObjectRecord } from "../modules/salesforce-api.js";
import { renderPageChrome } from "../modules/page-chrome.js";
import "./data-view.css";

export function renderDataView(container) {
  const url = new URL(window.location.href);
  const objectApiName = url.searchParams.get("object") || "Account";
  const recordId = url.searchParams.get("recordId") || "";
  const sourceOrigin = url.searchParams.get("sourceOrigin") || "";
  const hasRecord = Boolean(recordId);
  const colspan = hasRecord ? 4 : 3;
  const body = renderPageChrome(container, `<div class="data-view-page"><div class="data-view-toolbar"><h2><span id="data-view-title">${escapeHtml(objectApiName)} Fields</span></h2><input id="data-view-search" class="data-view-search" type="search" placeholder="Search Label or API Name" /></div><div class="data-view-table-wrap"><table class="data-view-table ${hasRecord ? "has-record" : "no-record"}"><colgroup><col class="data-view-col-label" /><col class="data-view-col-api" /><col class="data-view-col-type" />${hasRecord ? "<col class=\"data-view-col-value\" />" : ""}</colgroup><thead><tr><th>Label</th><th>API Name</th><th>Type</th>${hasRecord ? "<th>Value</th>" : ""}</tr></thead><tbody id="data-view-rows"><tr><td colspan="${colspan}">Loading fields...</td></tr></tbody></table></div><div id="data-view-editor-actions" class="data-view-editor-actions" hidden><button id="data-view-cancel" type="button">Cancel</button><button id="data-view-save" type="button">Save</button></div><div id="data-view-toast" class="data-view-toast" role="status" aria-live="polite"></div></div>`, { headerHtml: "" });
  const rows = body.querySelector("#data-view-rows"), search = body.querySelector("#data-view-search"), actions = body.querySelector("#data-view-editor-actions"), toast = body.querySelector("#data-view-toast"), title = body.querySelector("#data-view-title");
  let fields = [], values = {}, editing = null;
  const valueFor = (field) => !Object.prototype.hasOwnProperty.call(values, field.QualifiedApiName) ? "(Unknown)" : values[field.QualifiedApiName] == null || String(values[field.QualifiedApiName]).trim() === "" ? "(Blank)" : typeof values[field.QualifiedApiName] === "object" ? JSON.stringify(values[field.QualifiedApiName]) : String(values[field.QualifiedApiName]);
  const renderRows = () => {
    const query = search.value.toLowerCase().trim();
    const visible = fields.filter((field) => `${field.Label} ${field.QualifiedApiName}`.toLowerCase().includes(query));
    rows.innerHTML = visible.length ? visible.map((field) => {
      const value = valueFor(field), isEditing = editing?.field === field.QualifiedApiName, editable = hasRecord && field.IsUpdatable === true && value !== "(Unknown)";
      const valueCell = hasRecord ? `<td class="data-view-value ${editable ? "editable" : ""}" data-field="${escapeHtml(field.QualifiedApiName)}">${isEditing ? `<div class="data-view-editor"><textarea id="data-view-input">${escapeHtml(editing.value)}</textarea><button class="data-view-restore" id="data-view-restore" type="button" title="Restore saved value">↶</button></div>` : escapeHtml(value)}</td>` : "";
      return `<tr><td>${escapeHtml(field.Label)}</td><td>${escapeHtml(field.QualifiedApiName)}</td><td>${escapeHtml(field.DataType)}</td>${valueCell}</tr>`;
    }).join("") : `<tr><td colspan="${colspan}">No matching fields.</td></tr>`;
    actions.hidden = !editing?.dirty;
    const input = body.querySelector("#data-view-input");
    input?.addEventListener("input", () => { editing.value = input.value; editing.dirty = input.value !== editing.original; actions.hidden = !editing.dirty; });
  };
  const finishEdit = () => { editing = null; actions.hidden = true; renderRows(); };
  const showToast = (message, error = false) => { toast.textContent = message; toast.className = `data-view-toast ${error ? "error" : "success"}`; window.setTimeout(() => { toast.textContent = ""; toast.className = "data-view-toast"; }, 3500); };
  search.addEventListener("input", renderRows);
  rows.addEventListener("dblclick", (event) => { if (!hasRecord) return; const cell = event.target.closest(".data-view-value"), field = fields.find((item) => item.QualifiedApiName === cell?.dataset.field); if (!field || field.IsUpdatable !== true || valueFor(field) === "(Unknown)") return; const saved = valueFor(field) === "(Blank)" ? "" : valueFor(field); editing = { field: field.QualifiedApiName, original: saved, value: saved, dirty: false }; renderRows(); body.querySelector("#data-view-input")?.focus(); });
  rows.addEventListener("click", (event) => { if (event.target.id === "data-view-restore") finishEdit(); });
  body.querySelector("#data-view-cancel").addEventListener("click", finishEdit);
  body.querySelector("#data-view-save").addEventListener("click", async () => { if (!editing?.dirty) return; const value = body.querySelector("#data-view-input").value; try { const response = await chrome.runtime.sendMessage({ type: "UPDATE_RECORD_FIELD", sourceOrigin, objectApiName, recordId, fieldName: editing.field, value: value === "" ? null : value }); if (!response?.ok) throw new Error(response?.error || "Unable to save field."); values[editing.field] = value === "" ? null : value; finishEdit(); showToast("Record updated successfully."); } catch (error) { showToast(error.message, true); } });
  getSessionIdFromCookie(sourceOrigin).then(async (sessionId) => { if (!sessionId) throw new Error("Salesforce session cookie not found."); fields = await getFieldDefinitions(sessionId, objectApiName, sourceOrigin); title.textContent = `${objectApiName} Fields (${fields.length})`; values = hasRecord ? (await getSObjectRecord(sessionId, objectApiName, recordId, sourceOrigin)) || {} : {}; renderRows(); }).catch((error) => { rows.innerHTML = `<tr><td colspan="${colspan}">${escapeHtml(error.message)}</td></tr>`; });
}

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
