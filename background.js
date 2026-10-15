import { getSessionIdFromCookie, callToolingApi, getOrganizationDetails, getOrgDomainName, getFieldDefinitions, getSObjectRecord, updateSObjectRecord, getCurrentUserId, getCurrentUserDetails, getResolvedApiVersion, querySalesforceApi } from "./app/modules/salesforce-api.js";
import { getStoredApiVersion } from "./app/modules/preferences.js";

const MENU_ROUTE_MAP = {
  dataImport: "data-import",
  dataExport: "data-export",
  downloadMetadata: "download-metadata",
  developerConsole: "developer-console",
  dataView: "data-view",
  settings: "settings"
};

const developerConsoleWindowsByOrg = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "THEME_UPDATED") {
    broadcastThemeToLaunchers(message.theme === "dark" ? "dark" : "light")
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "CHECK_SID_COOKIE") {
    checkSidCookie(message.sourceOrigin)
      .then((hasSid) => sendResponse({ ok: true, hasSid }))
      .catch(() => sendResponse({ ok: true, hasSid: false }));
    return true;
  }
  if (message?.type === "GET_SELECTED_API_VERSION") {
    loadSelectedApiVersion(message.sourceOrigin, sender?.url)
      .then((apiVersion) => sendResponse({ ok: true, apiVersion }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to load the selected API version" }));
    return true;
  }
  if (message?.type === "OPEN_APP_TAB") {
    openAppTab(message.menuKey, message.sourceOrigin, message.objectApiName, message.recordId).then((tabId) => sendResponse({ ok: true, tabId })).catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Failed to open app tab" });
    });
    return true;
  }
  if (message?.type === "OPEN_EXTERNAL_TAB") {
    chrome.tabs.create({ url: String(message.url || "") })
      .then((tab) => sendResponse({ ok: true, tabId: tab?.id }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to open the new tab" }));
    return true;
  }
  if (message?.type === "LOAD_OBJECT_METADATA") {
    loadObjectMetadata(message.sourceOrigin, message.objectApiName)
      .then((metadata) => sendResponse({ ok: true, metadata }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to load object metadata" }));
    return true;
  }
  if (message?.type === "SEARCH_OBJECTS") {
    searchObjects(message.sourceOrigin, message.query)
      .then((objects) => sendResponse({ ok: true, objects }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to search objects" }));
    return true;
  }
  if (message?.type === "LOAD_CURRENT_USER") {
    loadCurrentUser(message.sourceOrigin)
      .then((user) => sendResponse({ ok: true, user }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to load current user" }));
    return true;
  }
  if (message?.type === "LOAD_CURRENT_USER_DETAILS") {
    loadCurrentUserDetails(message.sourceOrigin)
      .then((user) => sendResponse({ ok: true, user }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to load the current user details" }));
    return true;
  }
  if (message?.type === "LOAD_ORGANIZATION") {
    loadOrganization(message.sourceOrigin)
      .then((organization) => sendResponse({ ok: true, organization }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to load organization details" }));
    return true;
  }
  if (message?.type === "SEARCH_USERS") {
    searchUsers(message.sourceOrigin, message.query)
      .then((users) => sendResponse({ ok: true, users }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to search users" }));
    return true;
  }
  if (message?.type === "LOAD_USER") {
    loadUser(message.sourceOrigin, message.userId)
      .then((user) => sendResponse({ ok: true, user }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to load user" }));
    return true;
  }
  if (message?.type === "LOAD_RECORD_DATA") {
    loadRecordData(message.sourceOrigin, message.objectApiName, message.recordId, message.fields)
      .then((record) => sendResponse({ ok: true, record }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to load record data" }));
    return true;
  }
  if (message?.type === "UPDATE_RECORD_FIELD") {
    updateRecordField(message.sourceOrigin, message.objectApiName, message.recordId, message.fieldName, message.value)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to update record field" }));
    return true;
  }
  if (message?.type === "REGISTER_DEVELOPER_CONSOLE_WINDOW") {
    const orgKey = String(message.orgId || "");
    const windowId = sender?.tab?.windowId;
    if (orgKey && Number.isFinite(windowId)) developerConsoleWindowsByOrg.set(orgKey, windowId);
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "OPEN_DEVELOPER_CONSOLE_WINDOW") {
    openDeveloperConsoleWindow(message.sourceOrigin, message.orgKey).then((windowId) => sendResponse({ ok: true, windowId })).catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Failed to open developer console window" });
    });
    return true;
  }
  return false;
});

async function broadcastThemeToLaunchers(theme) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => {
    if (!Number.isFinite(tab?.id)) return null;
    return chrome.tabs.sendMessage(tab.id, { type: "THEME_UPDATED", theme }).catch(() => null);
  }));
}

async function checkSidCookie(sourceOrigin) {
  const origins = buildSidCookieCheckOrigins(sourceOrigin);
  for (const origin of origins) {
    try {
      const cookie = await chrome.cookies.get({ url: origin, name: "sid" });
      if (cookie?.value) return true;
    } catch {
      // Continue checking the equivalent Salesforce host without exposing the cookie value.
    }
  }
  return false;
}

function buildSidCookieCheckOrigins(sourceOrigin) {
  try {
    const parsed = new URL(String(sourceOrigin || ""));
    return [parsed.origin];
  } catch {
    return [];
  }
}

async function loadSelectedApiVersion(sourceOrigin, senderUrl = "") {
  const storedVersion = await getStoredApiVersion();
  const originCandidates = [sourceOrigin, senderUrl].filter(Boolean);

  for (const origin of originCandidates) {
    const sessionId = await getSessionIdFromCookie(origin);
    if (!sessionId) continue;

    return getResolvedApiVersion(sessionId, origin);
  }

  return storedVersion || "60.0";
}

async function loadObjectMetadata(sourceOrigin, objectApiName) {
  const safeObjectApiName = String(objectApiName || "").trim();
  if (!safeObjectApiName) throw new Error("Object API name is required.");

  const sessionId = await getSessionIdFromCookie(sourceOrigin);
  if (!sessionId) throw new Error("Salesforce session cookie not found.");

  const escapedName = safeObjectApiName.replace(/'/g, "\\'");
  const [domainName, entityResult] = await Promise.all([
    getOrgDomainName(sessionId, sourceOrigin),
    callToolingApi(sessionId, `SELECT QualifiedApiName, Label, KeyPrefix FROM EntityDefinition WHERE QualifiedApiName = '${escapedName}' LIMIT 1`, sourceOrigin)
  ]);

  const entity = entityResult.records?.[0] || null;
  return {
    domainName,
    entity
  };
}

async function searchObjects(sourceOrigin, query) {
  const sessionId = await getSessionIdFromCookie(sourceOrigin);
  if (!sessionId) throw new Error("Salesforce session cookie not found.");
  const result = await callToolingApi(sessionId, "SELECT QualifiedApiName, Label, KeyPrefix FROM EntityDefinition LIMIT 2000", sourceOrigin);
  const normalized = String(query || "").trim().toLowerCase();
  return (result.records || []).filter((record) => {
    if (!normalized) return true;
    return [record?.QualifiedApiName, record?.Label, record?.KeyPrefix].some((value) => String(value || "").toLowerCase().includes(normalized));
  }).slice(0, 50);
}

const USER_FIELDS = "Id, Name, Username, Email, Alias, IsActive, Profile.Name, UserRole.Name";

async function loadCurrentUser(sourceOrigin) {
  const sessionId = await getSessionIdFromCookie(sourceOrigin);
  if (!sessionId) throw new Error("Salesforce session cookie not found.");
  const userId = await getCurrentUserId(sessionId, sourceOrigin);
  if (!userId) throw new Error("Unable to identify the current Salesforce user.");
  return loadUserWithSession(sessionId, sourceOrigin, userId);
}

async function loadCurrentUserDetails(sourceOrigin) {
  const sessionId = await getSessionIdFromCookie(sourceOrigin);
  if (!sessionId) throw new Error("Salesforce session cookie not found.");
  return getCurrentUserDetails(sessionId, sourceOrigin);
}

const ORGANIZATION_QUERY = "SELECT Id, Name, InstanceName, TimeZoneSidKey, LanguageLocaleKey, OrganizationType, IsSandbox FROM Organization LIMIT 1";

async function loadOrganization(sourceOrigin) {
  const sessionId = await getSessionIdFromCookie(sourceOrigin);
  if (!sessionId) throw new Error("Salesforce session cookie not found.");
  return getOrganizationDetails(sessionId, sourceOrigin, { query: ORGANIZATION_QUERY, returnRecord: true });
}

async function loadUser(sourceOrigin, userId) {
  const sessionId = await getSessionIdFromCookie(sourceOrigin);
  if (!sessionId) throw new Error("Salesforce session cookie not found.");
  return loadUserWithSession(sessionId, sourceOrigin, userId);
}

async function loadUserWithSession(sessionId, sourceOrigin, userId) {
  const safeUserId = String(userId || "").trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  if (!safeUserId) throw new Error("User Id is required.");
  const result = await querySalesforceApi(sessionId, `SELECT ${USER_FIELDS} FROM User WHERE Id = '${safeUserId}' LIMIT 1`, sourceOrigin);
  return normalizeUserRecord(result.records?.[0]);
}

async function searchUsers(sourceOrigin, query) {
  const sessionId = await getSessionIdFromCookie(sourceOrigin);
  if (!sessionId) throw new Error("Salesforce session cookie not found.");
  const normalized = String(query || "").trim();
  if (!normalized) return [];
  const safeQuery = normalized.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const result = await querySalesforceApi(sessionId, `SELECT ${USER_FIELDS} FROM User WHERE Name LIKE '%${safeQuery}%' OR Username LIKE '%${safeQuery}%' OR Email LIKE '%${safeQuery}%' OR Alias LIKE '%${safeQuery}%' ORDER BY Name LIMIT 50`, sourceOrigin);
  return (result.records || []).map(normalizeUserRecord);
}

function normalizeUserRecord(record) {
  if (!record) return null;
  return {
    id: record.Id || "",
    name: record.Name || "",
    username: record.Username || "",
    email: record.Email || "",
    profile: record.Profile?.Name || "",
    role: record.UserRole?.Name || "",
    alias: record.Alias || "",
    status: record.IsActive === true ? "Active" : "In-Active"
  };
}

async function loadRecordData(sourceOrigin, objectApiName, recordId, fields) {
  const sessionId = await getSessionIdFromCookie(sourceOrigin);
  if (!sessionId) throw new Error("Salesforce session cookie not found.");
  const definitions = await getFieldDefinitions(sessionId, objectApiName, sourceOrigin);
  const available = new Set(definitions.map((field) => field.QualifiedApiName));
  const requested = (fields || []).filter((field) => !["Name"].includes(field) || available.has(field));
  const record = await getSObjectRecord(sessionId, objectApiName, recordId, sourceOrigin, requested);
  return { record, fields: requested };
}

async function updateRecordField(sourceOrigin, objectApiName, recordId, fieldName, value) {
  const sessionId = await getSessionIdFromCookie(sourceOrigin);
  if (!sessionId) throw new Error("Salesforce session cookie not found.");
  await updateSObjectRecord(sessionId, objectApiName, recordId, fieldName, value, sourceOrigin);
}

chrome.windows.onRemoved.addListener((windowId) => {
  for (const [orgKey, trackedWindowId] of developerConsoleWindowsByOrg.entries()) {
    if (trackedWindowId === windowId) developerConsoleWindowsByOrg.delete(orgKey);
  }
});

async function openAppTab(menuKey, sourceOrigin, objectApiName, recordId) {
  const route = MENU_ROUTE_MAP[menuKey] || "home";
  const targetPage = route === "settings" ? "settings.html" : "home.html";
  const objectQuery = objectApiName ? `&object=${encodeURIComponent(objectApiName)}` : "";
  const recordQuery = recordId ? `&recordId=${encodeURIComponent(recordId)}` : "";
  const url = chrome.runtime.getURL(`dist/${targetPage}?menu=${encodeURIComponent(route)}&sourceOrigin=${encodeURIComponent(sourceOrigin || "")}${objectQuery}${recordQuery}`);
  const tab = await chrome.tabs.create({ url, active: true });
  return tab.id;
}

async function openDeveloperConsoleWindow(sourceOrigin, orgKey) {
  const normalizedOrgKey = String(orgKey || sourceOrigin || "unknown-org");
  const trackedWindowId = developerConsoleWindowsByOrg.get(normalizedOrgKey);
  if (trackedWindowId) {
    const existingWindow = await safeGetWindow(trackedWindowId);
    if (existingWindow?.id) {
      await chrome.windows.update(existingWindow.id, { focused: true });
      return existingWindow.id;
    }
    developerConsoleWindowsByOrg.delete(normalizedOrgKey);
  }

  const existingOpenWindow = await findExistingDeveloperConsoleWindow(normalizedOrgKey);
  if (existingOpenWindow?.id) {
    developerConsoleWindowsByOrg.set(normalizedOrgKey, existingOpenWindow.id);
    await chrome.windows.update(existingOpenWindow.id, { focused: true });
    return existingOpenWindow.id;
  }

  const iconUrl = chrome.runtime.getURL("icons/icon128.png");
  const url = chrome.runtime.getURL(`dist/home.html?menu=developer-console&sourceOrigin=${encodeURIComponent(sourceOrigin || "")}&orgKey=${encodeURIComponent(normalizedOrgKey)}&standalone=1&autoFullscreen=1&appIcon=${encodeURIComponent(iconUrl)}`);
  const win = await chrome.windows.create({
    url,
    type: "popup",
    focused: true,
    state: "maximized"
  });
  if (win?.id) developerConsoleWindowsByOrg.set(normalizedOrgKey, win.id);
  return win.id;
}

async function safeGetWindow(windowId) {
  try {
    return await chrome.windows.get(windowId);
  } catch {
    return null;
  }
}

async function findExistingDeveloperConsoleWindow(orgKey) {
  const windows = await chrome.windows.getAll({ populate: true });
  for (const win of windows) {
    for (const tab of win.tabs || []) {
      const url = tab.url || "";
      if (!url.includes("menu=developer-console")) continue;
      const parsed = new URL(url);
      const tabOrgKey = parsed.searchParams.get("orgKey");
      if (tabOrgKey === orgKey) return win;
    }
  }
  return null;
}
