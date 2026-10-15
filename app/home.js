import { getSessionIdFromCookie, getMenuRoute, getOrgDomainName, getResolvedApiVersion } from "./modules/salesforce-api.js";
import { apiVersionStorageKey, getStoredTheme, themeBroadcastChannel } from "./modules/preferences.js";
import { renderDataExport } from "./features/data-export.js";
import { renderDataImport } from "./features/data-import.js";
import { renderDownloadMetadata } from "./features/download-metadata.js";
import { renderDeveloperConsole } from "./features/developer-console.js";
import { renderDataView } from "./features/data-view.js";

const routeLabel = document.getElementById("route-label");
const sessionState = document.getElementById("session-state");
const featureContainer = document.getElementById("feature-container");
const organizationTypeBadge = document.getElementById("organization-type-badge");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const footerOrgLink = document.getElementById("footer-org-link");
const footerOrganizationName = document.getElementById("footer-organization-name");
const footerOrgSeparator = document.getElementById("footer-org-separator");
const footerOrgName = document.getElementById("footer-org-name");
const footerApiVersion = document.getElementById("footer-api-version");

function setSafeText(el, value) {
  if (!el) return;
  el.textContent = String(value ?? "");
}

function replaceSafeChildren(el, html) {
  if (!el) return;
  el.replaceChildren();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  el.append(...wrapper.childNodes);
}

function renderApiVersion(version) {
  const label = version ? `API v${version}` : "API v—";
  if (footerApiVersion) footerApiVersion.textContent = label;
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark-theme", theme === "dark");
}

function isExpiredSalesforceSession(error) {
  const message = String(error?.message || error || "");
  return /\b(?:INVALID_SESSION_ID|invalid session|session (?:has )?expired|session (?:is )?invalid)\b/i.test(message);
}

function renderExpiredSalesforceSession() {
  setSafeText(sessionState, "Salesforce session expired — sign in again");
  renderApiVersion(null);
  renderOrgDomain(null);
  renderOrganizationType(null);
  renderUserAvatar(null);
}

function renderOrgDomainLegacy(domain) {
  const displayDomain = domain ? String(domain).toUpperCase() : "";
  const label = displayDomain || "DOMAIN —";
  if (footerOrgLink) {
    if (footerOrgName) footerOrgName.textContent = displayDomain;
    footerOrgLink.hidden = !displayDomain;
    footerOrgLink.href = buildOrgUrl(domain);
    footerOrgLink.title = "Open Connected Org";
    footerOrgLink.setAttribute("aria-label", "Open Connected Org");
  }
}

function buildOrgUrl(domain) {
  const value = String(domain || "").trim();
  if (!value) return "#";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes(".")) return `https://${value}`;
  return `https://${value}.lightning.force.com`;
}

function renderOrgDomain(domain) {
  const displayDomain = domain ? String(domain).toUpperCase() : "";
  if (footerOrgLink) {
    if (footerOrgName) footerOrgName.textContent = displayDomain;
    footerOrgLink.hidden = !displayDomain;
    footerOrgLink.href = buildOrgUrl(domain);
    footerOrgLink.title = "Open Connected Org";
    footerOrgLink.setAttribute("aria-label", "Open Connected Org");
  }
}

function renderOrganizationType(organization) {
  const organizationName = String(organization?.Name || "").trim();
  if (footerOrganizationName) {
    footerOrganizationName.textContent = organizationName;
    footerOrganizationName.hidden = !organizationName;
  }
  if (footerOrgSeparator) footerOrgSeparator.hidden = !organizationName;
  if (!organizationTypeBadge) return;
  const organizationType = String(organization?.OrganizationType || "").trim();
  organizationTypeBadge.textContent = organizationType;
  organizationTypeBadge.hidden = !organizationType;
  organizationTypeBadge.setAttribute("aria-label", organizationType ? `Organization Type: ${organizationType}` : "Organization type unavailable");
  organizationTypeBadge.title = organizationType || "Organization type unavailable";
}

const route = getMenuRoute();
getStoredTheme().then(applyTheme);
const themeChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(themeBroadcastChannel) : null;
themeChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "theme") applyTheme(event.data.theme === "dark" ? "dark" : "light");
});
chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes["lc-theme"]) applyTheme(changes["lc-theme"].newValue === "dark" ? "dark" : "light");
  if (changes[apiVersionStorageKey]) renderApiVersion(changes[apiVersionStorageKey].newValue || null);
});
setSafeText(routeLabel, route.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()));

const featureMap = {
  "data-export": renderDataExport,
  "data-import": renderDataImport,
  "download-metadata": renderDownloadMetadata,
  "developer-console": renderDeveloperConsole,
  "data-view": renderDataView,
  home: (container) => {
    replaceSafeChildren(container, `<div class="empty-state"><h2>Home</h2><p>Select a workflow from the floating launcher to begin.</p></div>`);
  }
};

featureMap[route]?.(featureContainer);

async function init() {
  const sessionId = await getSessionIdFromCookie();
  const sourceOrigin = new URLSearchParams(window.location.search).get("sourceOrigin") || window.location.origin;
  if (sessionId) {
    setSafeText(sessionState, "Session cookie found");
    try {
      const [apiVersion, orgDomain] = await Promise.all([
        getResolvedApiVersion(sessionId, sourceOrigin).catch(() => null),
        getOrgDomainName(sessionId, sourceOrigin).catch(() => null)
      ]);
      renderApiVersion(apiVersion);
      renderOrgDomain(orgDomain);
      const organizationResponse = await chrome.runtime.sendMessage({
        type: "LOAD_ORGANIZATION",
        sourceOrigin
      }).catch(() => null);
      renderOrganizationType(organizationResponse?.ok ? organizationResponse.organization : null);
      const response = await chrome.runtime.sendMessage({
        type: "LOAD_CURRENT_USER_DETAILS",
        sourceOrigin
      });
      if (!response?.ok) {
        const error = new Error(response?.error || "Unable to load the current user details.");
        if (isExpiredSalesforceSession(error)) {
          renderExpiredSalesforceSession();
          return;
        }
        throw error;
      }
      renderUserAvatar(response.user);
    } catch (error) {
      if (isExpiredSalesforceSession(error)) {
        renderExpiredSalesforceSession();
        return;
      }
      console.error("[Lightning Connect][Avatar] Home avatar load failed", error);
      renderUserAvatar(null);
    }
  } else {
    setSafeText(sessionState, "Session cookie not found");
    renderApiVersion(null);
    renderOrgDomain(null);
    renderOrganizationType(null);
    renderUserAvatar(null);
  }
}

function getUserInitials(profile) {
  const firstName = String(profile?.firstName || "").trim();
  const lastName = String(profile?.lastName || "").trim();
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();

  const nameParts = String(profile?.name || "").trim().split(/\s+/).filter(Boolean);
  if (nameParts.length > 1) return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
  if (nameParts[0]) return nameParts[0].slice(0, 2).toUpperCase();
  return "LC";
}

function renderUserAvatar(profile) {
  if (!userAvatar) return;
  const initials = getUserInitials(profile);
  const displayName = String(profile?.name || "").trim();
  userAvatar.style.visibility = "visible";
  userAvatar.replaceChildren();
  userAvatar.setAttribute("aria-label", displayName ? `${displayName} profile` : "User profile");
  userAvatar.title = displayName || "User profile";
  if (userName) {
    userName.textContent = displayName;
    userName.hidden = !displayName;
    userName.title = displayName || "Signed-in user";
  }

  if (profile?.photoUrl) {
    const image = document.createElement("img");
    image.className = "header-avatar-image";
    image.alt = displayName ? `${displayName} profile` : "User profile";
    image.src = profile.photoUrl;
    image.addEventListener("error", () => {
      userAvatar.replaceChildren();
      userAvatar.textContent = initials;
    }, { once: true });
    userAvatar.appendChild(image);
    return;
  }

  userAvatar.textContent = initials;
}

init();
