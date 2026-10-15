import { getStoredApiVersion } from "./preferences.js";

const apiVersionCache = new Map();

export function getMenuRoute() {
  return new URL(window.location.href).searchParams.get("menu") || "home";
}

export async function getSessionIdFromCookie(sourceOriginOverride = "") {
  const sourceOrigin = sourceOriginOverride || (typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("sourceOrigin") : "");
  if (!sourceOrigin) return null;
  const candidates = buildSessionCookieOrigins(sourceOrigin);

  for (const url of candidates) {
    const cookie = await chrome.cookies.get({ url, name: "sid" });
    if (cookie?.value) {
      return cookie.value;
    }
  }

  return null;
}

export async function getOrganizationDetails(sessionId, baseOrigin, options = {}) {
  const normalizedOptions = typeof options === "string" ? { query: options } : (options || {});
  const query = normalizedOptions.query || "SELECT Id FROM Organization LIMIT 1";
  // Organization is available through the standard REST query endpoint, not Tooling API.
  const result = await querySalesforceApi(sessionId, query, baseOrigin);
  const organization = result.records?.[0] || null;
  return normalizedOptions.returnRecord ? organization : organization?.Id || null;
}

export async function getOrgDomainName(sessionId, baseOrigin) {
  const result = await callToolingApi(
    sessionId,
    "SELECT Id, MyDomainName FROM OrgDomainLog ORDER BY CreatedDate DESC LIMIT 1",
    baseOrigin
  );
  return result.records?.find((record) => record?.MyDomainName)?.MyDomainName || null;
}

export async function getCurrentUserId(sessionId, baseOrigin) {
  const response = await requestSalesforceApi(sessionId, baseOrigin, "/users/me", { method: "GET" }, { apiType: "chatter" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unable to load the current user.";
    throw new Error(message);
  }
  return payload?.id || payload?.user?.id || null;
}

export async function getCurrentUserDetails(sessionId, baseOrigin) {
  const userId = await getCurrentUserId(sessionId, baseOrigin);
  if (!userId) throw new Error("Unable to identify the current Salesforce user.");

  const safeUserId = String(userId).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const result = await querySalesforceApi(
    sessionId,
    `SELECT Id, Name FROM User WHERE Id = '${safeUserId}' LIMIT 1`,
    baseOrigin
  );
  const user = result.records?.[0] || {};
  const nameParts = String(user.Name || "").trim().split(/\s+/).filter(Boolean);
  const photoBlob = await loadPhotoBlob(sessionId, baseOrigin, userId);

  return {
    id: user.Id || "",
    name: user.Name || "",
    firstName: nameParts[0] || "",
    lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : "",
    photoUrl: await blobToDataUrl(photoBlob)
  };
}

async function loadPhotoBlob(sessionId, baseOrigin, userId) {
  if (!userId) return null;
  try {
    const safeUserId = encodeURIComponent(String(userId));
    const photoResourceResponse = await requestSalesforceApi(
      sessionId,
      baseOrigin,
      `/user-profiles/${safeUserId}/photo`,
      { method: "GET" },
      { apiType: "connect" }
    );
    const resourceContentType = photoResourceResponse.headers.get("content-type") || "";
    if (!photoResourceResponse.ok) return null;

    if (resourceContentType.startsWith("image/")) {
      return photoResourceResponse.blob();
    }

    const photoResource = await photoResourceResponse.json().catch(() => null);
    const photoUrl = photoResource?.fullEmailPhotoUrl || photoResource?.largePhotoUrl || photoResource?.mediumPhotoUrl || photoResource?.smallPhotoUrl || "";
    if (!photoUrl) return null;

    const response = await fetch(photoUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${sessionId}` }
    });
    if (!response.ok) return null;
    return response.blob();
  } catch (error) {
    console.error("[Lightning Connect][Avatar] Photo blob fetch failed", error);
    return null;
  }
}

async function blobToDataUrl(blob) {
  if (!blob) return "";
  try {
    const contentType = blob.type || "image/jpeg";
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch (error) {
    console.error("[Lightning Connect][Avatar] Photo blob conversion failed", error);
    return "";
  }
}

export async function querySalesforceApi(sessionId, soql, baseOrigin) {
  const response = await requestSalesforceApi(sessionId, baseOrigin, `/query?q=${encodeURIComponent(soql)}`, { method: "GET" }, { apiType: "" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unable to query Salesforce data.";
    const errorCode = payload?.[0]?.errorCode || payload?.errorCode;
    throw new Error(`${message}${errorCode ? ` (${errorCode})` : ""}`.trim());
  }
  return payload;
}

export async function getFieldDefinitions(sessionId, objectApiName, baseOrigin) {
  const safeName = encodeURIComponent(String(objectApiName || "").trim());
  if (!safeName) return [];
  const response = await requestSalesforceApi(sessionId, baseOrigin, `/sobjects/${safeName}/describe`, { method: "GET" }, { apiType: "" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unable to load object fields.";
    throw new Error(message);
  }
  return (payload?.fields || []).map((field) => ({
    Label: field.label || field.name,
    QualifiedApiName: field.name,
    DataType: field.type || "",
    IsUpdatable: field.updateable === true
  })).sort((left, right) => String(left.Label).localeCompare(String(right.Label)));
}

export async function getSObjectList(sessionId, baseOrigin) {
  const response = await requestSalesforceApi(sessionId, baseOrigin, "/sobjects", { method: "GET" }, { apiType: "" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unable to load Salesforce objects.";
    const errorCode = payload?.[0]?.errorCode || payload?.errorCode;
    throw new Error(`${message}${errorCode ? ` (${errorCode})` : ""}`.trim());
  }
  return Array.isArray(payload?.sobjects) ? payload.sobjects : [];
}

export async function getSObjectDescribe(sessionId, objectApiName, baseOrigin) {
  const safeName = encodeURIComponent(String(objectApiName || "").trim());
  if (!safeName) throw new Error("A Salesforce object is required.");
  const response = await requestSalesforceApi(sessionId, baseOrigin, `/sobjects/${safeName}/describe`, { method: "GET" }, { apiType: "" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.[0]?.message || payload?.message || response.statusText || `Unable to describe ${objectApiName}.`;
    const errorCode = payload?.[0]?.errorCode || payload?.errorCode;
    throw new Error(`${message}${errorCode ? ` (${errorCode})` : ""}`.trim());
  }
  return payload;
}

export async function updateSObjectRecord(sessionId, objectApiName, recordId, fieldName, value, baseOrigin) {
  const safeObject = encodeURIComponent(String(objectApiName || ""));
  const safeId = encodeURIComponent(String(recordId || ""));
  const safeField = String(fieldName || "").trim();
  if (!safeObject || !safeId || !safeField) throw new Error("Object, record, and field are required.");
  const response = await requestSalesforceApi(sessionId, baseOrigin, `/sobjects/${safeObject}/${safeId}`, {
    method: "PATCH",
    body: JSON.stringify({ [safeField]: value })
  }, { apiType: "" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.[0]?.message || payload?.message || response.statusText || "Unable to update record.");
  }
}

export async function getSObjectRecord(sessionId, objectApiName, recordId, baseOrigin, fields = null) {
  const safeObject = encodeURIComponent(String(objectApiName || ""));
  const safeId = encodeURIComponent(String(recordId || ""));
  if (!safeObject || !safeId) return null;
  const fieldList = Array.isArray(fields) ? fields.map((field) => String(field || "").trim()).filter(Boolean).join(",") : "";
  const fieldQuery = fieldList ? `?fields=${encodeURIComponent(fieldList)}` : "";
  const response = await requestSalesforceApi(sessionId, baseOrigin, `/sobjects/${safeObject}/${safeId}${fieldQuery}`, { method: "GET" }, { apiType: "" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unable to load Salesforce record.";
    throw new Error(message);
  }
  return payload;
}

export async function listSupportedApiVersions(sessionId, baseOrigin) {
  const sourceOrigin = getSourceOrigin(baseOrigin);
  if (apiVersionCache.has(sourceOrigin)) return apiVersionCache.get(sourceOrigin);

  const versions = await requestSupportedApiVersions(sessionId, sourceOrigin);
  apiVersionCache.set(sourceOrigin, versions);
  return versions;
}

export async function getResolvedApiVersion(sessionId, baseOrigin) {
  const storedVersion = await getStoredApiVersion();
  try {
    const versions = await listSupportedApiVersions(sessionId, baseOrigin);
    if (storedVersion && versions.includes(storedVersion)) return storedVersion;
    return versions[0] || storedVersion || "60.0";
  } catch {
    return storedVersion || "60.0";
  }
}

async function getSalesforceApiBaseUrl(sessionId, baseOrigin, apiType = "") {
  const sourceOrigin = getSourceOrigin(baseOrigin);
  const apiVersion = await getResolvedApiVersion(sessionId, sourceOrigin);
  const normalizedApiType = normalizeApiType(apiType);
  return normalizedApiType
    ? `${sourceOrigin}/services/data/v${apiVersion}/${normalizedApiType}`
    : `${sourceOrigin}/services/data/v${apiVersion}`;
}

export async function requestSalesforceApi(sessionId, baseOrigin, path, init = {}, options = {}) {
  const apiType = Object.prototype.hasOwnProperty.call(options, "apiType") ? options.apiType : "tooling";
  const baseUrl = await getSalesforceApiBaseUrl(sessionId, baseOrigin, apiType);
  const normalizedPath = String(path || "");
  const prefixedPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;

  return fetch(`${baseUrl}${prefixedPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${sessionId}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
}

export function clearSalesforceApiCache() {
  apiVersionCache.clear();
}

function normalizeApiVersion(version) {
  const normalized = String(version ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : normalized;
}

function normalizeApiType(apiType) {
  return String(apiType || "").trim().replace(/^\/+|\/+$/g, "");
}

function sortVersionsDescending(versions) {
  return [...versions].sort((left, right) => Number(right) - Number(left));
}

async function requestSupportedApiVersions(sessionId, sourceOrigin) {
  if (!sessionId) return [];
  const response = await fetch(`${sourceOrigin}/services/data/`, {
    headers: {
      Authorization: `Bearer ${sessionId}`,
      "Content-Type": "application/json"
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unable to load supported API versions.";
    const errorCode = payload?.[0]?.errorCode || payload?.errorCode;
    throw new Error(`${message}${errorCode ? ` (${errorCode})` : ""}`.trim());
  }

  const versions = Array.isArray(payload)
    ? payload.map((item) => normalizeApiVersion(item?.version)).filter(Boolean)
    : [];

  return sortVersionsDescending(versions);
}

export async function callToolingApi(sessionId, soql, baseOrigin) {
  const response = await requestSalesforceApi(sessionId, baseOrigin, `/query?q=${encodeURIComponent(soql)}`, {
    method: "GET"
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unknown error - please refresh the page and try again!";
    const errorCode = payload?.[0]?.errorCode || payload?.errorCode;
    const details = `${message}${errorCode ? ` (${errorCode})` : ""}`.trim();
    throw new Error(details || `Request failed: ${response.status}`);
  }

  return payload;
}

export async function createToolingRecord(sessionId, sobjectType, body, baseOrigin) {
  const response = await requestSalesforceApi(sessionId, baseOrigin, `/sobjects/${sobjectType}`, {
    method: "POST",
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unknown error - please refresh the page and try again!";
    const errorCode = payload?.[0]?.errorCode || payload?.errorCode;
    const details = `${message}${errorCode ? ` (${errorCode})` : ""}`.trim();
    throw new Error(details || `Request failed: ${response.status}`);
  }

  return payload;
}

export async function updateToolingRecord(sessionId, sobjectType, recordId, body, baseOrigin) {
  const safeRecordId = encodeURIComponent(String(recordId || "").trim());
  if (!safeRecordId) throw new Error("A Tooling API record Id is required.");

  const response = await requestSalesforceApi(sessionId, baseOrigin, `/sobjects/${sobjectType}/${safeRecordId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unknown error - please refresh the page and try again!";
    const errorCode = payload?.[0]?.errorCode || payload?.errorCode;
    const details = `${message}${errorCode ? ` (${errorCode})` : ""}`.trim();
    throw new Error(details || `Request failed: ${response.status}`);
  }
}

export async function deleteToolingRecord(sessionId, sobjectType, recordId, baseOrigin) {
  const safeRecordId = String(recordId || "").replace(/'/g, "\\'");
  const response = await requestSalesforceApi(sessionId, baseOrigin, `/sobjects/${sobjectType}/${safeRecordId}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.[0]?.message || payload?.message || response.statusText || "Unknown error - please refresh the page and try again!";
    const errorCode = payload?.[0]?.errorCode || payload?.errorCode;
    const details = `${message}${errorCode ? ` (${errorCode})` : ""}`.trim();
    throw new Error(details || `Request failed: ${response.status}`);
  }
}

const metadataSoapNamespace = "http://soap.sforce.com/2006/04/metadata";
const soapEnvelopeNamespace = "http://schemas.xmlsoap.org/soap/envelope/";

export async function listLightningMessageChannels(sessionId, baseOrigin) {
  const apiVersion = await getResolvedApiVersion(sessionId, baseOrigin);
  const document = await callMetadataSoapApi(
    sessionId,
    baseOrigin,
    "listMetadata",
    `<met:listMetadata>
      <met:queries><met:type>LightningMessageChannel</met:type></met:queries>
      <met:asOfVersion>${escapeXml(apiVersion)}</met:asOfVersion>
    </met:listMetadata>`
  );

  return getElementsByLocalName(document, "result")
    .map((result) => ({
      FullName: getFirstChildText(result, "fullName"),
      FileName: getFirstChildText(result, "fileName"),
      LastModifiedDate: getFirstChildText(result, "lastModifiedDate")
    }))
    .filter((channel) => channel.FullName);
}

export async function getLightningMessageChannelMetadata(sessionId, fullName, baseOrigin) {
  const normalizedFullName = String(fullName || "").trim();
  if (!normalizedFullName) throw new Error("Lightning Message Channel name is required.");

  const document = await callMetadataSoapApi(
    sessionId,
    baseOrigin,
    "readMetadata",
    `<met:readMetadata>
      <met:type>LightningMessageChannel</met:type>
      <met:fullNames>${escapeXml(normalizedFullName)}</met:fullNames>
    </met:readMetadata>`
  );
  const result = getElementsByLocalName(document, "result")[0];
  const record = getDirectChildrenByLocalName(result, "records")[0] || result;
  if (!record) throw new Error(`Lightning Message Channel ${normalizedFullName} was not found.`);

  return {
    fullName: getFirstChildText(record, "fullName") || normalizedFullName,
    masterLabel: getFirstChildText(record, "masterLabel"),
    description: getFirstChildText(record, "description"),
    isExposed: getFirstChildText(record, "isExposed").toLowerCase() === "true",
    lightningMessageFields: getDirectChildrenByLocalName(record, "lightningMessageFields")
      .map((field) => ({
        fieldName: getFirstChildText(field, "fieldName"),
        description: getFirstChildText(field, "description")
      }))
      .filter((field) => field.fieldName)
  };
}

export async function createLightningMessageChannelMetadata(sessionId, fullName, metadata, baseOrigin, apiVersion) {
  const normalizedMetadata = normalizeLightningMessageChannelMetadata(fullName, metadata);
  const document = await callMetadataSoapApi(
    sessionId,
    baseOrigin,
    "createMetadata",
    `<met:createMetadata>${renderLightningMessageChannelMetadata(normalizedMetadata)}</met:createMetadata>`,
    { apiVersion }
  );
  assertMetadataSaveResult(document, "Lightning Message Channel creation failed.");
}

export async function updateLightningMessageChannelMetadata(sessionId, fullName, metadata, baseOrigin) {
  const normalizedMetadata = normalizeLightningMessageChannelMetadata(fullName, metadata);
  const document = await callMetadataSoapApi(
    sessionId,
    baseOrigin,
    "updateMetadata",
    `<met:updateMetadata>${renderLightningMessageChannelMetadata(normalizedMetadata)}</met:updateMetadata>`
  );
  assertMetadataSaveResult(document, "Lightning Message Channel deployment failed.");
}

export async function deleteLightningMessageChannelMetadata(sessionId, fullName, baseOrigin) {
  const normalizedFullName = String(fullName || "").trim();
  if (!normalizedFullName) throw new Error("Lightning Message Channel name is required.");

  const document = await callMetadataSoapApi(
    sessionId,
    baseOrigin,
    "deleteMetadata",
    `<met:deleteMetadata>
      <met:type>LightningMessageChannel</met:type>
      <met:fullNames>${escapeXml(normalizedFullName)}</met:fullNames>
    </met:deleteMetadata>`
  );
  assertMetadataSaveResult(document, "Lightning Message Channel deletion failed.");
}

function normalizeLightningMessageChannelMetadata(fullName, metadata) {
  const normalizedFullName = String(fullName || "").trim();
  if (!normalizedFullName) throw new Error("Lightning Message Channel name is required.");

  const normalizedMetadata = metadata || {};
  const fields = Array.isArray(normalizedMetadata.lightningMessageFields)
    ? normalizedMetadata.lightningMessageFields
      .map((field) => ({
        fieldName: String(field?.fieldName || "").trim(),
        description: String(field?.description || "").trim()
      }))
      .filter((field) => field.fieldName)
    : [];

  return {
    fullName: normalizedFullName,
    masterLabel: String(normalizedMetadata.masterLabel || normalizedFullName).trim(),
    isExposed: normalizedMetadata.isExposed === true,
    description: String(normalizedMetadata.description || "").trim(),
    lightningMessageFields: fields
  };
}

function renderLightningMessageChannelMetadata(metadata) {
  const fieldMarkup = metadata.lightningMessageFields.map((field) => `
        <met:lightningMessageFields>
          <met:fieldName>${escapeXml(field.fieldName)}</met:fieldName>${field.description ? `
          <met:description>${escapeXml(field.description)}</met:description>` : ""}
        </met:lightningMessageFields>`).join("");

  return `<met:metadata xsi:type="met:LightningMessageChannel">
      <met:fullName>${escapeXml(metadata.fullName)}</met:fullName>
      <met:masterLabel>${escapeXml(metadata.masterLabel)}</met:masterLabel>
      <met:isExposed>${metadata.isExposed ? "true" : "false"}</met:isExposed>${metadata.description ? `
      <met:description>${escapeXml(metadata.description)}</met:description>` : ""}${fieldMarkup}
    </met:metadata>`;
}

function assertMetadataSaveResult(document, fallbackMessage) {
  const result = getElementsByLocalName(document, "result")[0];
  const success = getFirstChildText(result, "success").toLowerCase() === "true";
  if (success) return;

  const failureMessages = getDirectChildrenByLocalName(result, "errors")
    .map((error) => {
      const statusCode = getFirstChildText(error, "statusCode");
      const message = getFirstChildText(error, "message");
      return [statusCode, message].filter(Boolean).join(": ");
    })
    .filter(Boolean);
  const error = new Error(failureMessages.join(" | ") || fallbackMessage);
  error.deployKind = "metadata";
  error.failureMessages = failureMessages;
  throw error;
}

async function callMetadataSoapApi(sessionId, baseOrigin, operation, operationBody, options = {}) {
  const sourceOrigin = getSourceOrigin(baseOrigin);
  const requestedApiVersion = String(options?.apiVersion || "").trim();
  const apiVersion = requestedApiVersion || await getResolvedApiVersion(sessionId, sourceOrigin);
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
    <env:Envelope xmlns:env="${soapEnvelopeNamespace}" xmlns:met="${metadataSoapNamespace}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <env:Header>
        <met:SessionHeader><met:sessionId>${escapeXml(sessionId)}</met:sessionId></met:SessionHeader>
      </env:Header>
      <env:Body>${operationBody}</env:Body>
    </env:Envelope>`;
  const response = await fetch(`${sourceOrigin}/services/Soap/m/${encodeURIComponent(apiVersion)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionId}`,
      "Content-Type": "text/xml; charset=UTF-8",
      // Salesforce requires this header. An empty JavaScript value can be omitted by fetch,
      // so send the SOAP empty-string literal instead.
      SOAPAction: '""'
    },
    body: envelope
  });
  const responseText = await response.text();
  const document = new DOMParser().parseFromString(responseText, "text/xml");
  const parserError = getElementsByLocalName(document, "parsererror")[0];
  const fault = getElementsByLocalName(document, "Fault")[0];
  if (!response.ok || parserError || fault) {
    const message = getFirstDescendantText(fault, "faultstring")
      || getFirstDescendantText(fault, "faultcode")
      || parserError?.textContent?.trim()
      || response.statusText
      || `Metadata API ${operation} failed.`;
    const error = new Error(message);
    error.status = response.status;
    error.operation = operation;
    error.responseText = responseText;
    throw error;
  }
  return document;
}

function getElementsByLocalName(root, localName) {
  if (!root?.getElementsByTagNameNS) return [];
  return Array.from(root.getElementsByTagNameNS("*", localName));
}

function getDirectChildrenByLocalName(element, localName) {
  return Array.from(element?.children || []).filter((child) => child.localName === localName);
}

function getFirstChildText(element, localName) {
  return getDirectChildrenByLocalName(element, localName)[0]?.textContent?.trim() || "";
}

function getFirstDescendantText(element, localName) {
  return getElementsByLocalName(element, localName)[0]?.textContent?.trim() || "";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getSourceOrigin(explicitOrigin) {
  const sourceOrigin = explicitOrigin || new URL(window.location.href).searchParams.get("sourceOrigin");
  if (!sourceOrigin) return window.location.origin;
  try {
    const url = new URL(sourceOrigin);
    const host = url.hostname;
    if (host.endsWith(".lightning.force.com")) {
      return url.origin.replace(".lightning.force.com", ".my.salesforce.com");
    }
    if (host.endsWith(".my.salesforce-setup.com")) {
      return url.origin.replace(".my.salesforce-setup.com", ".my.salesforce.com");
    }
    return url.origin;
  } catch {
    return sourceOrigin;
  }
}

function buildSessionCookieOrigins(sourceOrigin) {
  const origins = new Set();

  try {
    const parsed = new URL(sourceOrigin);
    origins.add(parsed.origin);

    const host = parsed.hostname;
    if (host.includes(".my.salesforce-setup.com")) {
      origins.add(parsed.origin.replace(".my.salesforce-setup.com", ".my.salesforce.com"));
      origins.add(parsed.origin.replace(".my.salesforce-setup.com", ".lightning.force.com"));
    } else if (host.includes(".my.salesforce.com")) {
      origins.add(parsed.origin.replace(".my.salesforce.com", ".my.salesforce-setup.com"));
      origins.add(parsed.origin.replace(".my.salesforce.com", ".lightning.force.com"));
    } else if (host.includes(".lightning.force.com")) {
      origins.add(parsed.origin.replace(".lightning.force.com", ".my.salesforce.com"));
      origins.add(parsed.origin.replace(".lightning.force.com", ".my.salesforce-setup.com"));
    }
  } catch {
    origins.add(sourceOrigin);
  }

  return Array.from(origins);
}

export async function listLwcComponents(sessionId) {
  const result = await callToolingApi(
    sessionId,
    "SELECT Id, DeveloperName, NamespacePrefix, MasterLabel, ApiVersion, IsExposed FROM LightningComponentBundle ORDER BY DeveloperName"
  );

  return result.records || [];
}

export async function listLwcComponentResources(sessionId, bundleId) {
  if (!bundleId) return [];

  const safeBundleId = String(bundleId).replace(/'/g, "\\'");
  const result = await callToolingApi(
    sessionId,
    `SELECT Id, FilePath, Source, Format, LightningComponentBundleId
     FROM LightningComponentResource
     WHERE LightningComponentBundleId = '${safeBundleId}'
     ORDER BY FilePath`
  );

  return result.records || [];
}

export async function listAuraBundles(sessionId, definitionTypes = []) {
  const normalizedDefinitionTypes = [...new Set(
    (Array.isArray(definitionTypes) ? definitionTypes : [definitionTypes])
      .map((type) => String(type || "").trim().toUpperCase())
      .filter((type) => /^[A-Z_]+$/.test(type))
  )];

  if (normalizedDefinitionTypes.length > 0) {
    const typeFilter = normalizedDefinitionTypes.map((type) => `'${type}'`).join(", ");
    const result = await callToolingApi(
      sessionId,
      `SELECT DefType, AuraDefinitionBundle.Id, AuraDefinitionBundle.DeveloperName, AuraDefinitionBundle.NamespacePrefix, AuraDefinitionBundle.MasterLabel, AuraDefinitionBundle.ApiVersion
       FROM AuraDefinition
       WHERE AuraDefinitionBundle.NamespacePrefix = null
       AND DefType IN (${typeFilter})
       ORDER BY AuraDefinitionBundle.DeveloperName`
    );
    const bundlesById = new Map();
    (result.records || []).forEach((definition) => {
      const bundle = definition?.AuraDefinitionBundle;
      if (!bundle?.Id || bundlesById.has(bundle.Id)) return;
      bundlesById.set(bundle.Id, { ...bundle, AuraPrimaryDefType: definition.DefType || "" });
    });
    return [...bundlesById.values()];
  }

  const result = await callToolingApi(
    sessionId,
    "SELECT Id, DeveloperName, NamespacePrefix, MasterLabel, ApiVersion FROM AuraDefinitionBundle WHERE NamespacePrefix = null ORDER BY DeveloperName"
  );

  return result.records || [];
}

export async function listAuraDefinitionsForBundle(sessionId, bundleId) {
  if (!bundleId) return [];

  const safeBundleId = String(bundleId).replace(/'/g, "\\'");
  const result = await callToolingApi(
    sessionId,
    `SELECT Id, DefType, Format, Source, AuraDefinitionBundleId
     FROM AuraDefinition
     WHERE AuraDefinitionBundleId = '${safeBundleId}'
     ORDER BY DefType, Format, Id`
  );

  return result.records || [];
}

export async function listApexClasses(sessionId) {
  const result = await callToolingApi(
    sessionId,
    "SELECT Id, Name, NamespacePrefix, ApiVersion, Status FROM ApexClass WHERE NamespacePrefix = null AND Status = 'Active' ORDER BY Name"
  );

  return result.records || [];
}

export async function listApexTriggers(sessionId) {
  const result = await callToolingApi(
    sessionId,
    "SELECT Id, Name, TableEnumOrId, ApiVersion, Status FROM ApexTrigger WHERE NamespacePrefix = null AND Status = 'Active' ORDER BY Name"
  );

  return result.records || [];
}

export async function listVisualforcePages(sessionId) {
  const result = await callToolingApi(
    sessionId,
    "SELECT Id, Name, ApiVersion, MasterLabel, NamespacePrefix FROM ApexPage WHERE NamespacePrefix = null ORDER BY Name"
  );

  return result.records || [];
}

export async function listVisualforceComponents(sessionId) {
  const result = await callToolingApi(
    sessionId,
    "SELECT Id, Name, ApiVersion, MasterLabel, NamespacePrefix FROM ApexComponent WHERE NamespacePrefix = null ORDER BY Name"
  );

  return result.records || [];
}
