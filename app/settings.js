import {
  clearSalesforceApiCache,
  getSessionIdFromCookie,
  listSupportedApiVersions
} from "./modules/salesforce-api.js";
import {
  clearExtensionCache,
  clearStoredDeveloperConsoleLocalFiles,
  dataImportPreferencesBroadcastChannel,
  dataImportPreferencesStorageKey,
  dataExportPreferencesBroadcastChannel,
  dataExportPreferencesStorageKey,
  developerConsolePreferencesBroadcastChannel,
  developerConsolePreferencesStorageKey,
  getExtensionCacheUsage,
  getStoredApiVersion,
  getStoredDataExportPreferences,
  getStoredDataImportPreferences,
  getStoredDeveloperConsolePreferences,
  getStoredTheme,
  requestDeveloperConsoleLogClear,
  resetStoredDataExportPreferences,
  resetStoredDataImportPreferences,
  resetStoredDeveloperConsolePreferences,
  setStoredApiVersion,
  setStoredDataExportPreferences,
  setStoredDataImportPreferences,
  setStoredDeveloperConsolePreferences,
  setStoredTheme,
  themeBroadcastChannel
} from "./modules/preferences.js";

const apiVersionSelect = document.getElementById("api-version");
const apiVersionStatus = document.getElementById("api-version-status");
const clearCacheButton = document.getElementById("clear-cache");
const cacheStatus = document.getElementById("cache-status");
const cacheUsage = document.getElementById("cache-usage");
const clearCacheModal = document.getElementById("clear-cache-modal");
const clearCacheYesButton = document.getElementById("clear-cache-yes");
const clearCacheNoButton = document.getElementById("clear-cache-no");
const clearLocalFilesModal = document.getElementById("clear-local-files-modal");
const clearLocalFilesYesButton = document.getElementById("clear-local-files-yes");
const clearLocalFilesNoButton = document.getElementById("clear-local-files-no");
const themeToggle = document.getElementById("theme-toggle");
const themeStatus = document.getElementById("theme-status");
const dataExportStatus = document.getElementById("data-export-status");
const dataImportStatus = document.getElementById("data-import-status");
const developerConsoleStatus = document.getElementById("developer-console-status");
const skipSaveDeployConfirmationKey = "lc-skip-save-deploy-confirmation";
const dataExportPreferencesChannel = typeof BroadcastChannel === "function"
  ? new BroadcastChannel(dataExportPreferencesBroadcastChannel)
  : null;
const dataImportPreferencesChannel = typeof BroadcastChannel === "function"
  ? new BroadcastChannel(dataImportPreferencesBroadcastChannel)
  : null;
const developerConsolePreferencesChannel = typeof BroadcastChannel === "function"
  ? new BroadcastChannel(developerConsolePreferencesBroadcastChannel)
  : null;
const themeChannel = typeof BroadcastChannel === "function"
  ? new BroadcastChannel(themeBroadcastChannel)
  : null;
let currentDataExportPreferences = null;
let dataExportPreferenceRevision = 0;
let dataExportPreferenceSaveInProgress = false;
let dataExportPreferenceSaveQueued = false;
let currentDataImportPreferences = null;
let dataImportPreferenceRevision = 0;
let dataImportPreferenceSaveInProgress = false;
let dataImportPreferenceSaveQueued = false;
let currentDeveloperConsolePreferences = null;
let developerConsolePreferenceRevision = 0;
let developerConsolePreferenceSaveInProgress = false;
let developerConsolePreferenceSaveQueued = false;

const dataExportControls = {
  fontSize: document.getElementById("de-font-size"),
  wordWrap: document.getElementById("de-word-wrap"),
  lineNumbers: document.getElementById("de-line-numbers"),
  minimap: document.getElementById("de-minimap"),
  objectExplorerVisible: document.getElementById("de-object-explorer-visible"),
  queryHistoryVisible: document.getElementById("de-query-history-visible"),
  objectExplorerWidth: document.getElementById("de-object-explorer-width"),
  queryHistoryWidth: document.getElementById("de-query-history-width"),
  defaultExplorerTab: document.getElementById("de-default-explorer-tab"),
  starterQueryLimit: document.getElementById("de-starter-query-limit"),
  wrapText: document.getElementById("de-wrap-text"),
  relatedRecordsExpanded: document.getElementById("de-related-records-expanded"),
  rememberVisibleColumns: document.getElementById("de-remember-visible-columns"),
  queryHistoryEnabled: document.getElementById("de-query-history-enabled"),
  queryHistoryLimit: document.getElementById("de-query-history-limit"),
  autoFetchEnabled: document.getElementById("de-auto-fetch-enabled"),
  autoFetchMaxPages: document.getElementById("de-auto-fetch-max-pages"),
  parentTableColor: document.getElementById("de-parent-table-color"),
  childTableColor: document.getElementById("de-child-table-color")
};

const dataImportControls = {
  defaultOperation: document.getElementById("di-default-operation"),
  defaultUpsertMatchMode: document.getElementById("di-default-upsert-match-mode"),
  defaultInputMode: document.getElementById("di-default-input-mode"),
  requiredFieldsOnly: document.getElementById("di-required-fields-only"),
  autoSelectStagedRecords: document.getElementById("di-auto-select-staged-records"),
  compactColumns: document.getElementById("di-compact-columns"),
  wrapTableText: document.getElementById("di-wrap-table-text"),
  showFieldApiNames: document.getElementById("di-show-field-api-names"),
  stageTableColor: document.getElementById("di-stage-table-color"),
  defaultDownloadFormat: document.getElementById("di-default-download-format"),
  batchSize: document.getElementById("di-batch-size"),
  threads: document.getElementById("di-threads"),
  operationPanelWidth: document.getElementById("di-operation-panel-width"),
  savedMappingsVisible: document.getElementById("di-saved-mappings-visible"),
  savedMappingsWidth: document.getElementById("di-saved-mappings-width"),
  savedMappingLimit: document.getElementById("di-saved-mapping-limit")
};

const developerConsoleControls = {
  fontSize: document.getElementById("dc-font-size"),
  wordWrap: document.getElementById("dc-word-wrap"),
  minimap: document.getElementById("dc-minimap"),
  lineNumbers: document.getElementById("dc-line-numbers"),
  renderWhitespace: document.getElementById("dc-render-whitespace"),
  tabSize: document.getElementById("dc-tab-size"),
  insertSpaces: document.getElementById("dc-insert-spaces"),
  formatOnPaste: document.getElementById("dc-format-on-paste"),
  formatOnType: document.getElementById("dc-format-on-type"),
  sidebarVisible: document.getElementById("dc-sidebar-visible"),
  logsVisible: document.getElementById("dc-logs-visible"),
  sidebarWidth: document.getElementById("dc-sidebar-width"),
  logsHeight: document.getElementById("dc-logs-height"),
  showClearLogsButton: document.getElementById("dc-show-clear-logs"),
  showLogPanelToggleButton: document.getElementById("dc-show-log-toggle"),
  showFileExplorerToggleButton: document.getElementById("dc-show-explorer-toggle"),
  showLogTimestamps: document.getElementById("dc-log-timestamps"),
  autoScrollLogs: document.getElementById("dc-auto-scroll-logs"),
  maxLogEntries: document.getElementById("dc-max-log-entries"),
  rememberExpandedFolders: document.getElementById("dc-remember-expanded"),
  revealActiveFile: document.getElementById("dc-reveal-active-file"),
  explorerRootTextColor: document.getElementById("dc-explorer-root-text-color"),
  explorerNodeTextColor: document.getElementById("dc-explorer-node-text-color"),
  explorerResourceTextColor: document.getElementById("dc-explorer-resource-text-color")
};

function setStatus(message, tone = "info") {
  if (!apiVersionStatus) return;
  apiVersionStatus.textContent = String(message || "");
  apiVersionStatus.dataset.tone = tone;
}

function setCacheStatus(message, tone = "info") {
  if (!cacheStatus) return;
  cacheStatus.textContent = String(message || "");
  cacheStatus.dataset.tone = tone;
}

function formatCacheUsage(bytes) {
  const normalizedBytes = Math.max(0, Number(bytes) || 0);
  if (normalizedBytes < 1024) return `${normalizedBytes} B`;
  if (normalizedBytes < 1024 * 1024) return `${(normalizedBytes / 1024).toFixed(1)} KB`;
  return `${(normalizedBytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function refreshCacheUsage() {
  if (!cacheUsage) return;
  cacheUsage.textContent = "Storage used: Loading…";
  try {
    const { bytes, itemCount } = await getExtensionCacheUsage();
    const entryLabel = itemCount === 1 ? "entry" : "entries";
    cacheUsage.textContent = `Storage used: ${formatCacheUsage(bytes)} (${itemCount} ${entryLabel})`;
  } catch (error) {
    cacheUsage.textContent = "Storage usage unavailable";
  }
}

let clearCacheModalTrigger = null;

function setClearCacheModalOpen(open) {
  if (!clearCacheModal) return;
  clearCacheModal.hidden = !open;
  if (open) {
    clearCacheModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => clearCacheNoButton?.focus());
  } else {
    clearCacheModalTrigger?.focus?.();
    clearCacheModalTrigger = null;
  }
}

async function clearAllExtensionCache() {
  setClearCacheModalOpen(false);
  clearCacheButton.disabled = true;
  setCacheStatus("Clearing extension cache...");
  try {
    clearSalesforceApiCache();
    await clearExtensionCache();
    setCacheStatus("All extension cache cleared.", "success");
    await init();
    await refreshCacheUsage();
  } catch (error) {
    setCacheStatus(`Unable to clear extension cache: ${error.message}`, "error");
  } finally {
    clearCacheButton.disabled = false;
  }
}

let clearLocalFilesModalTrigger = null;

function setClearLocalFilesModalOpen(open) {
  if (!clearLocalFilesModal) return;
  clearLocalFilesModal.hidden = !open;
  if (open) {
    clearLocalFilesModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => clearLocalFilesNoButton?.focus());
  } else {
    clearLocalFilesModalTrigger?.focus?.();
    clearLocalFilesModalTrigger = null;
  }
}

async function clearAllLocalFiles() {
  setClearLocalFilesModalOpen(false);
  try {
    await clearStoredDeveloperConsoleLocalFiles();
    setDeveloperConsoleStatus("Local Files cleared.", "success");
  } catch (error) {
    setDeveloperConsoleStatus(`Unable to clear Local Files: ${error.message}`, "error");
  }
}

function setDeveloperConsoleStatus(message, tone = "info") {
  if (!developerConsoleStatus) return;
  developerConsoleStatus.textContent = String(message || "");
  developerConsoleStatus.dataset.tone = tone;
}

function setDataExportStatus(message, tone = "info") {
  if (!dataExportStatus) return;
  dataExportStatus.textContent = String(message || "");
  dataExportStatus.dataset.tone = tone;
}

function setDataImportStatus(message, tone = "info") {
  if (!dataImportStatus) return;
  dataImportStatus.textContent = String(message || "");
  dataImportStatus.dataset.tone = tone;
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark-theme", isDark);
  if (themeToggle) themeToggle.checked = isDark;
  if (themeStatus) themeStatus.textContent = isDark ? "Enabled" : "Disabled";
  void getStoredDataExportPreferences().then(renderDataExportPreferences);
  void getStoredDeveloperConsolePreferences().then(renderDeveloperConsolePreferences);
}

function setSelectEnabled(enabled) {
  if (!apiVersionSelect) return;
  apiVersionSelect.disabled = !enabled;
}

function populateVersionOptions(versions, selectedVersion) {
  if (!apiVersionSelect) return;
  apiVersionSelect.replaceChildren();
  for (const version of versions) {
    const option = document.createElement("option");
    option.value = version;
    option.textContent = `v${version}`;
    apiVersionSelect.appendChild(option);
  }
  const fallback = versions[0] || "";
  apiVersionSelect.value = versions.includes(selectedVersion) ? selectedVersion : fallback;
}

function selectSettingsTab(tabName) {
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    const active = button.dataset.settingsTab === tabName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== tabName;
  });
}

function renderDeveloperConsolePreferences(preferences) {
  currentDeveloperConsolePreferences = { ...preferences };
  const setValue = (key, value) => {
    const control = developerConsoleControls[key];
    if (control) control.value = String(value);
  };
  const setChecked = (key, checked) => {
    const control = developerConsoleControls[key];
    if (control) control.checked = Boolean(checked);
  };
  const setColor = (key, color, lightFallback) => {
    const control = developerConsoleControls[key];
    if (!control) return;
    const fallback = document.documentElement.classList.contains("dark-theme") ? "#f4f7fb" : lightFallback;
    control.value = color || fallback;
  };

  setValue("fontSize", preferences.fontSize);
  setValue("wordWrap", preferences.wordWrap);
  setChecked("minimap", preferences.minimap);
  setChecked("lineNumbers", preferences.lineNumbers);
  setValue("renderWhitespace", preferences.renderWhitespace);
  setValue("tabSize", preferences.tabSize);
  setValue("insertSpaces", preferences.insertSpaces);
  setChecked("formatOnPaste", preferences.formatOnPaste);
  setChecked("formatOnType", preferences.formatOnType);
  setChecked("sidebarVisible", preferences.sidebarVisible);
  setChecked("logsVisible", preferences.logsVisible);
  setValue("sidebarWidth", preferences.sidebarWidth);
  setValue("logsHeight", preferences.logsHeight);
  setChecked("showClearLogsButton", preferences.showClearLogsButton);
  setChecked("showLogPanelToggleButton", preferences.showLogPanelToggleButton);
  setChecked("showFileExplorerToggleButton", preferences.showFileExplorerToggleButton);
  setChecked("showLogTimestamps", preferences.showLogTimestamps);
  setChecked("autoScrollLogs", preferences.autoScrollLogs);
  setValue("maxLogEntries", preferences.maxLogEntries);
  setChecked("rememberExpandedFolders", preferences.rememberExpandedFolders);
  setChecked("revealActiveFile", preferences.revealActiveFile);
  setColor("explorerRootTextColor", preferences.explorerRootTextColor, "#24364b");
  setColor("explorerNodeTextColor", preferences.explorerNodeTextColor, "#1f2d3d");
  setColor("explorerResourceTextColor", preferences.explorerResourceTextColor, "#273444");
}

function renderDataExportPreferences(preferences) {
  currentDataExportPreferences = { ...preferences };
  const setValue = (key, value) => {
    const control = dataExportControls[key];
    if (control) control.value = String(value);
  };
  const setChecked = (key, checked) => {
    const control = dataExportControls[key];
    if (control) control.checked = Boolean(checked);
  };
  const setColor = (key, color, fallback) => {
    const control = dataExportControls[key];
    if (control) control.value = color || fallback;
  };

  setValue("fontSize", preferences.fontSize);
  setValue("wordWrap", preferences.wordWrap);
  setChecked("lineNumbers", preferences.lineNumbers);
  setChecked("minimap", preferences.minimap);
  setChecked("objectExplorerVisible", preferences.objectExplorerVisible);
  setChecked("queryHistoryVisible", preferences.queryHistoryVisible);
  setValue("objectExplorerWidth", preferences.objectExplorerWidth);
  setValue("queryHistoryWidth", preferences.queryHistoryWidth);
  setValue("defaultExplorerTab", preferences.defaultExplorerTab);
  setValue("starterQueryLimit", preferences.starterQueryLimit);
  setChecked("wrapText", preferences.wrapText);
  setChecked("relatedRecordsExpanded", preferences.relatedRecordsExpanded);
  setChecked("rememberVisibleColumns", preferences.rememberVisibleColumns);
  setChecked("queryHistoryEnabled", preferences.queryHistoryEnabled);
  setValue("queryHistoryLimit", preferences.queryHistoryLimit);
  setChecked("autoFetchEnabled", preferences.autoFetchEnabled);
  setValue("autoFetchMaxPages", preferences.autoFetchMaxPages);
  setColor("parentTableColor", preferences.parentTableColor, "#dceef9");
  setColor("childTableColor", preferences.childTableColor, "#e1f2e8");
}

function renderDataImportPreferences(preferences) {
  currentDataImportPreferences = { ...preferences };
  const setValue = (key, value) => {
    const control = dataImportControls[key];
    if (control) control.value = String(value);
  };
  const setChecked = (key, checked) => {
    const control = dataImportControls[key];
    if (control) control.checked = Boolean(checked);
  };
  const setColor = (key, color, lightFallback) => {
    const control = dataImportControls[key];
    if (!control) return;
    const fallback = document.documentElement.classList.contains("dark-theme") ? "#233b55" : lightFallback;
    control.value = color || fallback;
  };

  setValue("defaultOperation", preferences.defaultOperation);
  setValue("defaultUpsertMatchMode", preferences.defaultUpsertMatchMode);
  setValue("defaultInputMode", preferences.defaultInputMode);
  setChecked("requiredFieldsOnly", preferences.requiredFieldsOnly);
  setChecked("autoSelectStagedRecords", preferences.autoSelectStagedRecords);
  setChecked("compactColumns", preferences.compactColumns);
  setChecked("wrapTableText", preferences.wrapTableText);
  setChecked("showFieldApiNames", preferences.showFieldApiNames);
  setColor("stageTableColor", preferences.stageTableColor, "#e5f1f9");
  setValue("defaultDownloadFormat", preferences.defaultDownloadFormat);
  setValue("batchSize", preferences.batchSize);
  setValue("threads", preferences.threads);
  setValue("operationPanelWidth", preferences.operationPanelWidth);
  setChecked("savedMappingsVisible", preferences.savedMappingsVisible);
  setValue("savedMappingsWidth", preferences.savedMappingsWidth);
  setValue("savedMappingLimit", preferences.savedMappingLimit);
}

async function renderSaveDeployConfirmationPreference() {
  const stored = typeof chrome !== "undefined" && chrome.storage?.local
    ? await chrome.storage.local.get(skipSaveDeployConfirmationKey)
    : {};
  const control = document.getElementById("dc-confirm-deploy");
  if (control) control.checked = stored?.[skipSaveDeployConfirmationKey] !== true;
}

function publishDeveloperConsolePreferences(preferences) {
  developerConsolePreferencesChannel?.postMessage({ type: "preferences", preferences });
}

async function persistDeveloperConsolePreferences() {
  developerConsolePreferenceSaveInProgress = true;
  do {
    developerConsolePreferenceSaveQueued = false;
    const revision = developerConsolePreferenceRevision;
    const snapshot = { ...(currentDeveloperConsolePreferences || {}) };
    try {
      const savedPreferences = await setStoredDeveloperConsolePreferences(snapshot);
      if (revision === developerConsolePreferenceRevision) {
        renderDeveloperConsolePreferences(savedPreferences);
        publishDeveloperConsolePreferences(savedPreferences);
        setDeveloperConsoleStatus("Developer Console preference saved.", "success");
      }
    } catch (error) {
      setDeveloperConsoleStatus(`Unable to save preference: ${error.message}`, "error");
    }
  } while (developerConsolePreferenceSaveQueued);
  developerConsolePreferenceSaveInProgress = false;
}

function saveDeveloperConsolePreference(key, value) {
  currentDeveloperConsolePreferences = { ...(currentDeveloperConsolePreferences || {}), [key]: value };
  developerConsolePreferenceRevision += 1;
  publishDeveloperConsolePreferences(currentDeveloperConsolePreferences);
  if (developerConsolePreferenceSaveInProgress) {
    developerConsolePreferenceSaveQueued = true;
    return;
  }
  void persistDeveloperConsolePreferences();
}

function publishDataExportPreferences(preferences) {
  dataExportPreferencesChannel?.postMessage({ type: "preferences", preferences });
}

function publishDataImportPreferences(preferences) {
  dataImportPreferencesChannel?.postMessage({ type: "preferences", preferences });
}

async function persistDataExportPreferences() {
  dataExportPreferenceSaveInProgress = true;
  do {
    dataExportPreferenceSaveQueued = false;
    const revision = dataExportPreferenceRevision;
    const snapshot = { ...(currentDataExportPreferences || {}) };
    try {
      const savedPreferences = await setStoredDataExportPreferences(snapshot);
      if (revision === dataExportPreferenceRevision) {
        renderDataExportPreferences(savedPreferences);
        publishDataExportPreferences(savedPreferences);
        setDataExportStatus("Data Export preference saved.", "success");
      }
    } catch (error) {
      setDataExportStatus(`Unable to save preference: ${error.message}`, "error");
    }
  } while (dataExportPreferenceSaveQueued);
  dataExportPreferenceSaveInProgress = false;
}

function saveDataExportPreference(key, value) {
  currentDataExportPreferences = { ...(currentDataExportPreferences || {}), [key]: value };
  dataExportPreferenceRevision += 1;
  publishDataExportPreferences(currentDataExportPreferences);
  if (dataExportPreferenceSaveInProgress) {
    dataExportPreferenceSaveQueued = true;
    return;
  }
  void persistDataExportPreferences();
}

async function persistDataImportPreferences() {
  dataImportPreferenceSaveInProgress = true;
  do {
    dataImportPreferenceSaveQueued = false;
    const revision = dataImportPreferenceRevision;
    const snapshot = { ...(currentDataImportPreferences || {}) };
    try {
      const savedPreferences = await setStoredDataImportPreferences(snapshot);
      if (revision === dataImportPreferenceRevision) {
        renderDataImportPreferences(savedPreferences);
        publishDataImportPreferences(savedPreferences);
        setDataImportStatus("Data Import preference saved.", "success");
      }
    } catch (error) {
      setDataImportStatus(`Unable to save preference: ${error.message}`, "error");
    }
  } while (dataImportPreferenceSaveQueued);
  dataImportPreferenceSaveInProgress = false;
}

function saveDataImportPreference(key, value) {
  currentDataImportPreferences = { ...(currentDataImportPreferences || {}), [key]: value };
  dataImportPreferenceRevision += 1;
  publishDataImportPreferences(currentDataImportPreferences);
  if (dataImportPreferenceSaveInProgress) {
    dataImportPreferenceSaveQueued = true;
    return;
  }
  void persistDataImportPreferences();
}

async function initDeveloperConsolePreferences() {
  try {
    renderDeveloperConsolePreferences(await getStoredDeveloperConsolePreferences());
    await renderSaveDeployConfirmationPreference();
  } catch (error) {
    setDeveloperConsoleStatus(`Unable to load Developer Console preferences: ${error.message}`, "error");
  }
}

async function initDataExportPreferences() {
  try {
    renderDataExportPreferences(await getStoredDataExportPreferences());
  } catch (error) {
    setDataExportStatus(`Unable to load Data Export preferences: ${error.message}`, "error");
  }
}

async function initDataImportPreferences() {
  try {
    renderDataImportPreferences(await getStoredDataImportPreferences());
  } catch (error) {
    setDataImportStatus(`Unable to load Data Import preferences: ${error.message}`, "error");
  }
}

async function init() {
  applyTheme(await getStoredTheme());
  await initDataExportPreferences();
  await initDataImportPreferences();
  await initDeveloperConsolePreferences();
  await refreshCacheUsage();
  const sourceOrigin = new URLSearchParams(window.location.search).get("sourceOrigin");
  if (!sourceOrigin) {
    setStatus("Open settings from a Salesforce page so we can load supported API versions.", "error");
    setSelectEnabled(false);
    return;
  }

  setStatus("Loading supported versions...");
  setSelectEnabled(false);
  try {
    const sessionId = await getSessionIdFromCookie();
    if (!sessionId) throw new Error("Unable to locate the Salesforce session cookie for this org.");
    const versions = await listSupportedApiVersions(sessionId, sourceOrigin);
    const storedVersion = await getStoredApiVersion();
    if (!versions.length) throw new Error("Salesforce did not return any supported API versions.");
    populateVersionOptions(versions, storedVersion);
    setSelectEnabled(true);
    const selectedVersion = apiVersionSelect?.value || versions[0];
    setStatus(`Loaded ${versions.length} supported versions. Defaulting to v${selectedVersion}.`);
  } catch (error) {
    setStatus(`Unable to load supported versions: ${error.message}`, "error");
    setSelectEnabled(false);
  }
}

document.querySelectorAll("[data-settings-tab]").forEach((button) => {
  button.addEventListener("click", () => selectSettingsTab(button.dataset.settingsTab || "general"));
});

themeToggle.addEventListener("change", async () => {
  const theme = themeToggle.checked ? "dark" : "light";
  applyTheme(theme);
  themeChannel?.postMessage({ type: "theme", theme });
  void chrome.runtime?.sendMessage?.({ type: "THEME_UPDATED", theme }).catch(() => {});
  await setStoredTheme(theme);
});

apiVersionSelect.addEventListener("change", async () => {
  if (!apiVersionSelect?.value) return;
  const versionValue = String(apiVersionSelect.value || "").trim();
  try {
    await setStoredApiVersion(versionValue);
    setStatus(`Saved API version v${versionValue}.`, "success");
  } catch (error) {
    setStatus(`Unable to save API version: ${error.message}`, "error");
  }
});

clearCacheButton.addEventListener("click", () => {
  setClearCacheModalOpen(true);
});

clearCacheYesButton?.addEventListener("click", () => {
  void clearAllExtensionCache();
});
clearCacheNoButton?.addEventListener("click", () => setClearCacheModalOpen(false));
document.querySelector("[data-clear-cache-cancel]")?.addEventListener("click", () => setClearCacheModalOpen(false));
clearLocalFilesYesButton?.addEventListener("click", () => {
  void clearAllLocalFiles();
});
clearLocalFilesNoButton?.addEventListener("click", () => setClearLocalFilesModalOpen(false));
document.querySelector("[data-clear-local-files-cancel]")?.addEventListener("click", () => setClearLocalFilesModalOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !clearCacheModal?.hidden) setClearCacheModalOpen(false);
  if (event.key === "Escape" && !clearLocalFilesModal?.hidden) setClearLocalFilesModalOpen(false);
});

[
  ["fontSize", "change", (control) => Number(control.value)],
  ["wordWrap", "change", (control) => control.value],
  ["lineNumbers", "change", (control) => control.checked],
  ["minimap", "change", (control) => control.checked],
  ["objectExplorerVisible", "change", (control) => control.checked],
  ["queryHistoryVisible", "change", (control) => control.checked],
  ["objectExplorerWidth", "change", (control) => Number(control.value)],
  ["queryHistoryWidth", "change", (control) => Number(control.value)],
  ["defaultExplorerTab", "change", (control) => control.value],
  ["starterQueryLimit", "change", (control) => Number(control.value)],
  ["wrapText", "change", (control) => control.checked],
  ["relatedRecordsExpanded", "change", (control) => control.checked],
  ["rememberVisibleColumns", "change", (control) => control.checked],
  ["queryHistoryEnabled", "change", (control) => control.checked],
  ["queryHistoryLimit", "change", (control) => Number(control.value)],
  ["autoFetchEnabled", "change", (control) => control.checked],
  ["autoFetchMaxPages", "change", (control) => Number(control.value)],
  ["parentTableColor", "input", (control) => control.value],
  ["childTableColor", "input", (control) => control.value]
].forEach(([key, eventName, getValue]) => {
  const control = dataExportControls[key];
  control?.addEventListener(eventName, () => saveDataExportPreference(key, getValue(control)));
});

[
  ["defaultOperation", "change", (control) => control.value],
  ["defaultUpsertMatchMode", "change", (control) => control.value],
  ["defaultInputMode", "change", (control) => control.value],
  ["requiredFieldsOnly", "change", (control) => control.checked],
  ["autoSelectStagedRecords", "change", (control) => control.checked],
  ["compactColumns", "change", (control) => control.checked],
  ["wrapTableText", "change", (control) => control.checked],
  ["showFieldApiNames", "change", (control) => control.checked],
  ["stageTableColor", "input", (control) => control.value],
  ["defaultDownloadFormat", "change", (control) => control.value],
  ["batchSize", "change", (control) => Number(control.value)],
  ["threads", "change", (control) => Number(control.value)],
  ["operationPanelWidth", "change", (control) => Number(control.value)],
  ["savedMappingsVisible", "change", (control) => control.checked],
  ["savedMappingsWidth", "change", (control) => Number(control.value)],
  ["savedMappingLimit", "change", (control) => Number(control.value)]
].forEach(([key, eventName, getValue]) => {
  const control = dataImportControls[key];
  control?.addEventListener(eventName, () => saveDataImportPreference(key, getValue(control)));
});

[
  ["fontSize", "change", (control) => Number(control.value)],
  ["wordWrap", "change", (control) => control.value],
  ["minimap", "change", (control) => control.checked],
  ["lineNumbers", "change", (control) => control.checked],
  ["renderWhitespace", "change", (control) => control.value],
  ["tabSize", "change", (control) => Number(control.value)],
  ["insertSpaces", "change", (control) => control.value === "true"],
  ["formatOnPaste", "change", (control) => control.checked],
  ["formatOnType", "change", (control) => control.checked],
  ["sidebarVisible", "change", (control) => control.checked],
  ["logsVisible", "change", (control) => control.checked],
  ["sidebarWidth", "change", (control) => Number(control.value)],
  ["logsHeight", "change", (control) => Number(control.value)],
  ["showClearLogsButton", "change", (control) => control.checked],
  ["showLogPanelToggleButton", "change", (control) => control.checked],
  ["showFileExplorerToggleButton", "change", (control) => control.checked],
  ["showLogTimestamps", "change", (control) => control.checked],
  ["autoScrollLogs", "change", (control) => control.checked],
  ["maxLogEntries", "change", (control) => Number(control.value)],
  ["rememberExpandedFolders", "change", (control) => control.checked],
  ["revealActiveFile", "change", (control) => control.checked],
  ["explorerRootTextColor", "input", (control) => control.value],
  ["explorerNodeTextColor", "input", (control) => control.value],
  ["explorerResourceTextColor", "input", (control) => control.value]
].forEach(([key, eventName, getValue]) => {
  const control = developerConsoleControls[key];
  control?.addEventListener(eventName, () => saveDeveloperConsolePreference(key, getValue(control)));
});

document.getElementById("de-reset-preferences")?.addEventListener("click", async () => {
  try {
    const preferences = await resetStoredDataExportPreferences();
    renderDataExportPreferences(preferences);
    publishDataExportPreferences(preferences);
    setDataExportStatus("Data Export preferences reset.", "success");
  } catch (error) {
    setDataExportStatus(`Unable to reset preferences: ${error.message}`, "error");
  }
});

document.getElementById("di-reset-preferences")?.addEventListener("click", async () => {
  try {
    const preferences = await resetStoredDataImportPreferences();
    renderDataImportPreferences(preferences);
    publishDataImportPreferences(preferences);
    setDataImportStatus("Data Import preferences reset.", "success");
  } catch (error) {
    setDataImportStatus(`Unable to reset preferences: ${error.message}`, "error");
  }
});

document.getElementById("dc-reset-layout")?.addEventListener("click", async () => {
  try {
    const preferences = await setStoredDeveloperConsolePreferences({ sidebarVisible: true, logsVisible: true, sidebarWidth: 320, logsHeight: 160 });
    renderDeveloperConsolePreferences(preferences);
    publishDeveloperConsolePreferences(preferences);
    setDeveloperConsoleStatus("Developer Console layout reset.", "success");
  } catch (error) {
    setDeveloperConsoleStatus(`Unable to reset layout: ${error.message}`, "error");
  }
});

document.getElementById("dc-confirm-deploy")?.addEventListener("change", async (event) => {
  try {
    await chrome.storage.local.set({ [skipSaveDeployConfirmationKey]: !event.currentTarget.checked });
    setDeveloperConsoleStatus("Deployment confirmation preference saved.", "success");
  } catch (error) {
    setDeveloperConsoleStatus(`Unable to save confirmation preference: ${error.message}`, "error");
  }
});

document.getElementById("dc-reset-deploy-confirmation")?.addEventListener("click", async () => {
  try {
    await chrome.storage.local.set({ [skipSaveDeployConfirmationKey]: false });
    await renderSaveDeployConfirmationPreference();
    setDeveloperConsoleStatus("Deployment confirmation restored.", "success");
  } catch (error) {
    setDeveloperConsoleStatus(`Unable to reset confirmation: ${error.message}`, "error");
  }
});

document.getElementById("dc-clear-logs")?.addEventListener("click", async () => {
  try {
    await requestDeveloperConsoleLogClear();
    setDeveloperConsoleStatus("Open logs cleared.", "success");
  } catch (error) {
    setDeveloperConsoleStatus(`Unable to clear logs: ${error.message}`, "error");
  }
});

document.getElementById("dc-clear-local-files")?.addEventListener("click", () => setClearLocalFilesModalOpen(true));

document.getElementById("dc-reset-preferences")?.addEventListener("click", async () => {
  try {
    const preferences = await resetStoredDeveloperConsolePreferences();
    await chrome.storage.local.set({ [skipSaveDeployConfirmationKey]: false });
    renderDeveloperConsolePreferences(preferences);
    publishDeveloperConsolePreferences(preferences);
    await renderSaveDeployConfirmationPreference();
    setDeveloperConsoleStatus("Developer Console preferences reset.", "success");
  } catch (error) {
    setDeveloperConsoleStatus(`Unable to reset preferences: ${error.message}`, "error");
  }
});

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  void refreshCacheUsage();
  if (changes["lc-theme"]) applyTheme(changes["lc-theme"].newValue === "dark" ? "dark" : "light");
  if (changes[developerConsolePreferencesStorageKey]) {
    void getStoredDeveloperConsolePreferences().then(renderDeveloperConsolePreferences);
  }
  if (changes[dataExportPreferencesStorageKey]) {
    void getStoredDataExportPreferences().then(renderDataExportPreferences);
  }
  if (changes[dataImportPreferencesStorageKey]) {
    void getStoredDataImportPreferences().then(renderDataImportPreferences);
  }
  if (changes[skipSaveDeployConfirmationKey]) void renderSaveDeployConfirmationPreference();
});

init();
