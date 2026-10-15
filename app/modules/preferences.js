const settingsStorageKey = "lc-settings";
export const apiVersionStorageKey = "lc-api-version";
const themeStorageKey = "lc-theme";
export const themeBroadcastChannel = "lc-theme";

export const developerConsolePreferencesStorageKey = "lc-developer-console-preferences";
export const developerConsolePreferencesBroadcastChannel = "lc-developer-console-preferences";
export const developerConsoleExplorerStateStorageKey = "lc-developer-console-explorer-state";
export const developerConsoleLocalFilesStorageKey = "lc-developer-console-local-files";
export const developerConsoleClearLogsRequestStorageKey = "lc-developer-console-clear-logs-request";
export const dataExportPreferencesStorageKey = "lc-data-export-preferences";
export const dataExportColumnVisibilityStorageKey = "lc-data-export-column-visibility";
export const dataExportPreferencesBroadcastChannel = "lc-data-export-preferences";
export const dataImportPreferencesStorageKey = "lc-data-import-preferences";
export const dataImportPreferencesBroadcastChannel = "lc-data-import-preferences";

const developerConsolePreferenceDefaults = Object.freeze({
  fontSize: 13,
  wordWrap: "on",
  minimap: false,
  lineNumbers: true,
  renderWhitespace: "selection",
  tabSize: 2,
  insertSpaces: true,
  formatOnPaste: true,
  formatOnType: true,
  sidebarVisible: true,
  logsVisible: true,
  sidebarWidth: 320,
  logsHeight: 160,
  showClearLogsButton: true,
  showLogPanelToggleButton: true,
  showFileExplorerToggleButton: true,
  showLogTimestamps: true,
  autoScrollLogs: true,
  maxLogEntries: 100,
  rememberExpandedFolders: false,
  revealActiveFile: true,
  explorerRootTextColor: null,
  explorerNodeTextColor: null,
  explorerResourceTextColor: null
});

const dataExportPreferenceDefaults = Object.freeze({
  fontSize: 13,
  wordWrap: "on",
  lineNumbers: true,
  minimap: false,
  objectExplorerVisible: true,
  queryHistoryVisible: false,
  objectExplorerWidth: 226,
  queryHistoryWidth: 270,
  wrapText: true,
  parentTableColor: null,
  childTableColor: null,
  defaultExplorerTab: "objects",
  starterQueryLimit: 50,
  relatedRecordsExpanded: true,
  rememberVisibleColumns: true,
  queryHistoryEnabled: true,
  queryHistoryLimit: 100,
  autoFetchEnabled: false,
  autoFetchMaxPages: 3
});

const dataImportPreferenceDefaults = Object.freeze({
  defaultOperation: "create",
  defaultUpsertMatchMode: "externalId",
  defaultInputMode: "manual",
  requiredFieldsOnly: false,
  autoSelectStagedRecords: true,
  compactColumns: false,
  wrapTableText: false,
  showFieldApiNames: true,
  stageTableColor: null,
  defaultDownloadFormat: "csv",
  batchSize: 200,
  threads: 5,
  operationPanelWidth: 198,
  savedMappingsVisible: false,
  savedMappingsWidth: 270,
  savedMappingLimit: 100
});

export async function setStoredApiVersion(version) {
  const normalizedVersion = normalizeApiVersion(version);
  if (!normalizedVersion || typeof chrome === "undefined" || !chrome.storage?.local) return;
  await chrome.storage.local.set({
    [settingsStorageKey]: { apiVersion: normalizedVersion },
    [apiVersionStorageKey]: normalizedVersion
  });
}

export async function getStoredApiVersion() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
  const stored = await chrome.storage.local.get([settingsStorageKey, apiVersionStorageKey]);
  return normalizeApiVersion(stored?.[apiVersionStorageKey] ?? stored?.[settingsStorageKey]?.apiVersion);
}

export async function getStoredTheme() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return "light";
  const stored = await chrome.storage.local.get(themeStorageKey);
  return stored?.[themeStorageKey] === "dark" ? "dark" : "light";
}

export async function setStoredTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [themeStorageKey]: normalizedTheme });
}

export async function clearExtensionCache() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.clear();
  }
  if (typeof localStorage !== "undefined") localStorage.clear();
  if (typeof sessionStorage !== "undefined") sessionStorage.clear();
}

export async function getExtensionCacheUsage() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return { bytes: 0, itemCount: 0 };
  }

  const stored = await chrome.storage.local.get(null);
  let bytes = 0;
  try {
    bytes = await chrome.storage.local.getBytesInUse(null);
  } catch {
    bytes = new Blob([JSON.stringify(stored)]).size;
  }
  return {
    bytes: Number.isFinite(bytes) ? bytes : 0,
    itemCount: Object.keys(stored || {}).length
  };
}

export function getDefaultDeveloperConsolePreferences() {
  return { ...developerConsolePreferenceDefaults };
}

export async function getStoredDeveloperConsolePreferences() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return getDefaultDeveloperConsolePreferences();
  const stored = await chrome.storage.local.get(developerConsolePreferencesStorageKey);
  return normalizeDeveloperConsolePreferences(stored?.[developerConsolePreferencesStorageKey]);
}

export async function setStoredDeveloperConsolePreferences(preferences) {
  const current = await getStoredDeveloperConsolePreferences();
  const next = normalizeDeveloperConsolePreferences({ ...current, ...(preferences || {}) });
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [developerConsolePreferencesStorageKey]: next });
  }
  return next;
}

export async function resetStoredDeveloperConsolePreferences() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.remove([
      developerConsolePreferencesStorageKey,
      developerConsoleExplorerStateStorageKey
    ]);
  }
  return getDefaultDeveloperConsolePreferences();
}

export function getDefaultDataExportPreferences() {
  return { ...dataExportPreferenceDefaults };
}

export async function getStoredDataExportPreferences() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return getDefaultDataExportPreferences();
  const stored = await chrome.storage.local.get(dataExportPreferencesStorageKey);
  return normalizeDataExportPreferences(stored?.[dataExportPreferencesStorageKey]);
}

export async function setStoredDataExportPreferences(preferences) {
  const current = await getStoredDataExportPreferences();
  const next = normalizeDataExportPreferences({ ...current, ...(preferences || {}) });
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [dataExportPreferencesStorageKey]: next });
  }
  return next;
}

export async function resetStoredDataExportPreferences() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.remove([dataExportPreferencesStorageKey, dataExportColumnVisibilityStorageKey]);
  }
  return getDefaultDataExportPreferences();
}

export function getDefaultDataImportPreferences() {
  return { ...dataImportPreferenceDefaults };
}

export async function getStoredDataImportPreferences() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return getDefaultDataImportPreferences();
  const stored = await chrome.storage.local.get(dataImportPreferencesStorageKey);
  return normalizeDataImportPreferences(stored?.[dataImportPreferencesStorageKey]);
}

export async function setStoredDataImportPreferences(preferences) {
  const current = await getStoredDataImportPreferences();
  const next = normalizeDataImportPreferences({ ...current, ...(preferences || {}) });
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [dataImportPreferencesStorageKey]: next });
  }
  return next;
}

export async function resetStoredDataImportPreferences() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.remove(dataImportPreferencesStorageKey);
  }
  return getDefaultDataImportPreferences();
}

export async function getStoredDataExportColumnVisibility() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return {};
  const stored = await chrome.storage.local.get(dataExportColumnVisibilityStorageKey);
  return normalizeDataExportColumnVisibility(stored?.[dataExportColumnVisibilityStorageKey]);
}

export async function setStoredDataExportColumnVisibility(visibility) {
  const normalized = normalizeDataExportColumnVisibility(visibility);
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [dataExportColumnVisibilityStorageKey]: normalized });
  }
  return normalized;
}

export async function getStoredDeveloperConsoleExplorerState() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return normalizeDeveloperConsoleExplorerState(null);
  const stored = await chrome.storage.local.get(developerConsoleExplorerStateStorageKey);
  return normalizeDeveloperConsoleExplorerState(stored?.[developerConsoleExplorerStateStorageKey]);
}

export async function setStoredDeveloperConsoleExplorerState(state) {
  const normalizedState = normalizeDeveloperConsoleExplorerState(state);
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [developerConsoleExplorerStateStorageKey]: normalizedState });
  }
  return normalizedState;
}

export async function clearStoredDeveloperConsoleLocalFiles() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.remove(developerConsoleLocalFilesStorageKey);
  }
  if (typeof localStorage !== "undefined") localStorage.removeItem(developerConsoleLocalFilesStorageKey);
}

export async function requestDeveloperConsoleLogClear() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [developerConsoleClearLogsRequestStorageKey]: Date.now() });
}

function normalizeApiVersion(version) {
  const normalized = String(version ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed.toFixed(1);
  return normalized;
}

function normalizeDeveloperConsolePreferences(preferences) {
  const source = preferences && typeof preferences === "object" ? preferences : {};
  const asBoolean = (key, fallback) => (typeof source[key] === "boolean" ? source[key] : fallback);
  const asNumber = (key, fallback, minimum, maximum, allowed = null) => {
    const value = Number(source[key]);
    if (!Number.isFinite(value)) return fallback;
    const rounded = Math.round(value);
    if (Array.isArray(allowed)) return allowed.includes(rounded) ? rounded : fallback;
    return Math.max(minimum, Math.min(maximum, rounded));
  };
  const whitespaceValues = ["none", "selection", "boundary", "all"];

  return {
    fontSize: asNumber("fontSize", developerConsolePreferenceDefaults.fontSize, 10, 24),
    wordWrap: source.wordWrap === "off" ? "off" : "on",
    minimap: asBoolean("minimap", developerConsolePreferenceDefaults.minimap),
    lineNumbers: asBoolean("lineNumbers", developerConsolePreferenceDefaults.lineNumbers),
    renderWhitespace: whitespaceValues.includes(source.renderWhitespace)
      ? source.renderWhitespace
      : developerConsolePreferenceDefaults.renderWhitespace,
    tabSize: asNumber("tabSize", developerConsolePreferenceDefaults.tabSize, 2, 4, [2, 4]),
    insertSpaces: asBoolean("insertSpaces", developerConsolePreferenceDefaults.insertSpaces),
    formatOnPaste: asBoolean("formatOnPaste", developerConsolePreferenceDefaults.formatOnPaste),
    formatOnType: asBoolean("formatOnType", developerConsolePreferenceDefaults.formatOnType),
    sidebarVisible: asBoolean("sidebarVisible", developerConsolePreferenceDefaults.sidebarVisible),
    logsVisible: asBoolean("logsVisible", developerConsolePreferenceDefaults.logsVisible),
    sidebarWidth: asNumber("sidebarWidth", developerConsolePreferenceDefaults.sidebarWidth, 240, 560),
    logsHeight: asNumber("logsHeight", developerConsolePreferenceDefaults.logsHeight, 140, 420),
    showClearLogsButton: asBoolean("showClearLogsButton", developerConsolePreferenceDefaults.showClearLogsButton),
    showLogPanelToggleButton: asBoolean("showLogPanelToggleButton", developerConsolePreferenceDefaults.showLogPanelToggleButton),
    showFileExplorerToggleButton: asBoolean("showFileExplorerToggleButton", developerConsolePreferenceDefaults.showFileExplorerToggleButton),
    showLogTimestamps: asBoolean("showLogTimestamps", developerConsolePreferenceDefaults.showLogTimestamps),
    autoScrollLogs: asBoolean("autoScrollLogs", developerConsolePreferenceDefaults.autoScrollLogs),
    maxLogEntries: asNumber("maxLogEntries", developerConsolePreferenceDefaults.maxLogEntries, 50, 250, [50, 100, 250]),
    rememberExpandedFolders: asBoolean("rememberExpandedFolders", developerConsolePreferenceDefaults.rememberExpandedFolders),
    revealActiveFile: asBoolean("revealActiveFile", developerConsolePreferenceDefaults.revealActiveFile),
    explorerRootTextColor: normalizeHexColor(source.explorerRootTextColor),
    explorerNodeTextColor: normalizeHexColor(source.explorerNodeTextColor),
    explorerResourceTextColor: normalizeHexColor(source.explorerResourceTextColor)
  };
}

function normalizeDataExportPreferences(preferences) {
  const source = preferences && typeof preferences === "object" ? preferences : {};
  const asBoolean = (key, fallback) => (typeof source[key] === "boolean" ? source[key] : fallback);
  const asNumber = (key, fallback, minimum, maximum, allowed = null) => {
    const value = Number(source[key]);
    if (!Number.isFinite(value)) return fallback;
    const rounded = Math.round(value);
    if (Array.isArray(allowed)) return allowed.includes(rounded) ? rounded : fallback;
    return Math.max(minimum, Math.min(maximum, rounded));
  };

  return {
    fontSize: asNumber("fontSize", dataExportPreferenceDefaults.fontSize, 10, 24),
    wordWrap: source.wordWrap === "off" ? "off" : "on",
    lineNumbers: asBoolean("lineNumbers", dataExportPreferenceDefaults.lineNumbers),
    minimap: asBoolean("minimap", dataExportPreferenceDefaults.minimap),
    objectExplorerVisible: asBoolean("objectExplorerVisible", dataExportPreferenceDefaults.objectExplorerVisible),
    queryHistoryVisible: asBoolean("queryHistoryVisible", dataExportPreferenceDefaults.queryHistoryVisible),
    objectExplorerWidth: asNumber("objectExplorerWidth", dataExportPreferenceDefaults.objectExplorerWidth, 180, 360),
    queryHistoryWidth: asNumber("queryHistoryWidth", dataExportPreferenceDefaults.queryHistoryWidth, 190, 380),
    wrapText: asBoolean("wrapText", dataExportPreferenceDefaults.wrapText),
    parentTableColor: normalizeHexColor(source.parentTableColor),
    childTableColor: normalizeHexColor(source.childTableColor),
    defaultExplorerTab: source.defaultExplorerTab === "fields" ? "fields" : "objects",
    starterQueryLimit: asNumber("starterQueryLimit", dataExportPreferenceDefaults.starterQueryLimit, 1, 2000),
    relatedRecordsExpanded: asBoolean("relatedRecordsExpanded", dataExportPreferenceDefaults.relatedRecordsExpanded),
    rememberVisibleColumns: asBoolean("rememberVisibleColumns", dataExportPreferenceDefaults.rememberVisibleColumns),
    queryHistoryEnabled: asBoolean("queryHistoryEnabled", dataExportPreferenceDefaults.queryHistoryEnabled),
    queryHistoryLimit: asNumber("queryHistoryLimit", dataExportPreferenceDefaults.queryHistoryLimit, 10, 250, [10, 25, 50, 100, 250]),
    autoFetchEnabled: asBoolean("autoFetchEnabled", dataExportPreferenceDefaults.autoFetchEnabled),
    autoFetchMaxPages: asNumber("autoFetchMaxPages", dataExportPreferenceDefaults.autoFetchMaxPages, 1, 10, [1, 3, 5, 10])
  };
}

function normalizeDataImportPreferences(preferences) {
  const source = preferences && typeof preferences === "object" ? preferences : {};
  const asBoolean = (key, fallback) => (typeof source[key] === "boolean" ? source[key] : fallback);
  const asNumber = (key, fallback, minimum, maximum, allowed = null) => {
    const value = Number(source[key]);
    if (!Number.isFinite(value)) return fallback;
    const rounded = Math.round(value);
    if (Array.isArray(allowed)) return allowed.includes(rounded) ? rounded : fallback;
    return Math.max(minimum, Math.min(maximum, rounded));
  };

  return {
    defaultOperation: ["create", "update", "upsert", "delete"].includes(source.defaultOperation) ? source.defaultOperation : dataImportPreferenceDefaults.defaultOperation,
    defaultUpsertMatchMode: source.defaultUpsertMatchMode === "id" ? "id" : "externalId",
    defaultInputMode: ["manual", "csv", "paste"].includes(source.defaultInputMode) ? source.defaultInputMode : dataImportPreferenceDefaults.defaultInputMode,
    requiredFieldsOnly: asBoolean("requiredFieldsOnly", dataImportPreferenceDefaults.requiredFieldsOnly),
    autoSelectStagedRecords: asBoolean("autoSelectStagedRecords", dataImportPreferenceDefaults.autoSelectStagedRecords),
    compactColumns: asBoolean("compactColumns", dataImportPreferenceDefaults.compactColumns),
    wrapTableText: asBoolean("wrapTableText", dataImportPreferenceDefaults.wrapTableText),
    showFieldApiNames: asBoolean("showFieldApiNames", dataImportPreferenceDefaults.showFieldApiNames),
    stageTableColor: normalizeHexColor(source.stageTableColor),
    defaultDownloadFormat: source.defaultDownloadFormat === "xlsx" ? "xlsx" : "csv",
    batchSize: asNumber("batchSize", dataImportPreferenceDefaults.batchSize, 1, 200),
    threads: asNumber("threads", dataImportPreferenceDefaults.threads, 1, 5),
    operationPanelWidth: asNumber("operationPanelWidth", dataImportPreferenceDefaults.operationPanelWidth, 170, 320),
    savedMappingsVisible: asBoolean("savedMappingsVisible", dataImportPreferenceDefaults.savedMappingsVisible),
    savedMappingsWidth: asNumber("savedMappingsWidth", dataImportPreferenceDefaults.savedMappingsWidth, 220, 420),
    savedMappingLimit: asNumber("savedMappingLimit", dataImportPreferenceDefaults.savedMappingLimit, 10, 250, [10, 25, 50, 100, 250])
  };
}

function normalizeDataExportColumnVisibility(visibility) {
  const source = visibility && typeof visibility === "object" ? visibility : {};
  const normalized = {};
  Object.entries(source).slice(0, 200).forEach(([objectName, columns]) => {
    const key = String(objectName || "").trim();
    if (!key || !Array.isArray(columns)) return;
    const hiddenColumns = [...new Set(columns.map((column) => String(column || "").trim()).filter(Boolean))].slice(0, 250);
    if (hiddenColumns.length) normalized[key] = hiddenColumns;
  });
  return normalized;
}

function normalizeHexColor(value) {
  const normalized = String(value ?? "").trim();
  return /^#[\da-f]{6}$/i.test(normalized) ? normalized.toLowerCase() : null;
}

function normalizeDeveloperConsoleExplorerState(state) {
  const source = state && typeof state === "object" ? state : {};
  const groupKeys = Array.isArray(source.groupKeys)
    ? [...new Set(source.groupKeys.map((key) => String(key || "").trim()).filter(Boolean))]
    : [];
  const localFolderIds = Array.isArray(source.localFolderIds)
    ? [...new Set(source.localFolderIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];
  return { groupKeys, localFolderIds };
}
