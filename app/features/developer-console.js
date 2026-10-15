import { callToolingApi, createLightningMessageChannelMetadata, createToolingRecord, deleteLightningMessageChannelMetadata, deleteToolingRecord, getLightningMessageChannelMetadata, getOrganizationDetails, getSessionIdFromCookie, listApexClasses, listApexTriggers, listAuraBundles, listAuraDefinitionsForBundle, listLightningMessageChannels, listLwcComponents, listLwcComponentResources, listVisualforceComponents, listVisualforcePages, requestSalesforceApi, updateLightningMessageChannelMetadata, updateToolingRecord } from "../modules/salesforce-api.js";
import { developerConsoleClearLogsRequestStorageKey, developerConsolePreferencesBroadcastChannel, developerConsolePreferencesStorageKey, getDefaultDeveloperConsolePreferences, getStoredDeveloperConsoleExplorerState, getStoredDeveloperConsolePreferences, getStoredTheme, setStoredDeveloperConsoleExplorerState, setStoredDeveloperConsolePreferences, themeBroadcastChannel } from "../modules/preferences.js";
import { renderPageChrome } from "../modules/page-chrome.js";
import "./developer-console.css";
import "monaco-editor/esm/vs/editor/editor.api.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

export function renderDeveloperConsole(container) {
  if (!container) return;
  if (typeof window !== "undefined") {
    window.MonacoEnvironment = {
      getWorker(_, label) {
        if (label === "json") return new JsonWorker();
        if (label === "css" || label === "scss" || label === "less") return new CssWorker();
        if (label === "html" || label === "handlebars" || label === "razor") return new HtmlWorker();
        if (label === "typescript" || label === "javascript") return new TsWorker();
        return new EditorWorker();
      }
    };
  }
  const isStandalone = new URLSearchParams(window.location.search).get("standalone") === "1";
  const appIcon = new URLSearchParams(window.location.search).get("appIcon");
  if (isStandalone && appIcon) {
    document.title = "Lightning Connect";
    const existingIcon = document.querySelector('link[rel="icon"]');
    if (existingIcon) existingIcon.remove();
    const iconLink = document.createElement("link");
    iconLink.rel = "icon";
    iconLink.type = "image/png";
    iconLink.href = appIcon;
    document.head.appendChild(iconLink);
  }
  // Prevent accidental navigation away from the page in standalone mode.
  if (isStandalone) {
    window.addEventListener("beforeunload", (event) => {
      event.preventDefault();
    });
  }

  const body = renderPageChrome(container, `
    <div class="developer-console-page">
      <section class="dc-workspace">
        <aside class="dc-sidebar" style="--dc-sidebar-width: 320px;">
          <div class="dc-searchbar">
            <input id="dc-search" type="search" placeholder="Search Component..." />
            <button type="button" aria-label="Search">⌕</button>
          </div>

          <div class="dc-tree" id="dc-tree">
            <section class="dc-file-explorer-card dc-salesforce-files-card" aria-label="Salesforce Files">
            <div class="dc-tree-section-header dc-tree-section-header-salesforce">
              <span>Salesforce Files</span>
              <button type="button" class="dc-tree-section-action" data-refresh-salesforce-files aria-label="Refresh Salesforce files" title="Refresh Salesforce files">${iconRefresh()}</button>
            </div>
            <div class="dc-tree-group" data-tree-group="lwc">
              <div class="dc-tree-group-row">
                <button type="button" class="dc-tree-group-title" data-tree-toggle="lwc" aria-expanded="false">
                  <span class="dc-tree-group-icon" aria-hidden="true"></span>
                  <span class="dc-tree-group-label">LIGHTNING WEB COMPONENTS <span class="dc-tree-group-count" data-tree-count="lwc"></span></span>
                </button>
                <button type="button" class="dc-tree-actions-trigger" data-lwc-root-actions aria-label="Lightning Web Components actions" title="Lightning Web Components actions">${iconMoreVertical()}</button>
              </div>
              <ul data-tree-list="lwc" hidden></ul>
            </div>
            <div class="dc-tree-group" data-tree-group="aura">
              <div class="dc-tree-group-row">
                <button type="button" class="dc-tree-group-title" data-tree-toggle="aura" aria-expanded="false">
                  <span class="dc-tree-group-icon" aria-hidden="true"></span>
                  <span class="dc-tree-group-label">AURA COMPONENTS <span class="dc-tree-group-count" data-tree-count="aura"></span></span>
                </button>
                <button type="button" class="dc-tree-actions-trigger" data-aura-root-actions aria-label="Aura Components actions" title="Aura Components actions">${iconMoreVertical()}</button>
              </div>
              <ul data-tree-list="aura" hidden></ul>
            </div>
            <div class="dc-tree-group" data-tree-group="auraApplication">
              <div class="dc-tree-group-row">
                <button type="button" class="dc-tree-group-title" data-tree-toggle="auraApplication" aria-expanded="false">
                  <span class="dc-tree-group-icon" aria-hidden="true"></span>
                  <span class="dc-tree-group-label">AURA APPLICATIONS <span class="dc-tree-group-count" data-tree-count="auraApplication"></span></span>
                </button>
                <button type="button" class="dc-tree-actions-trigger" data-aura-application-root-actions aria-label="Aura Applications actions" title="Aura Applications actions">${iconMoreVertical()}</button>
              </div>
              <ul data-tree-list="auraApplication" hidden></ul>
            </div>
            <div class="dc-tree-group" data-tree-group="auraEvent">
              <div class="dc-tree-group-row">
                <button type="button" class="dc-tree-group-title" data-tree-toggle="auraEvent" aria-expanded="false">
                  <span class="dc-tree-group-icon" aria-hidden="true"></span>
                  <span class="dc-tree-group-label">LIGHTNING EVENTS <span class="dc-tree-group-count" data-tree-count="auraEvent"></span></span>
                </button>
                <button type="button" class="dc-tree-actions-trigger" data-aura-event-root-actions aria-label="Lightning Events actions" title="Lightning Events actions">${iconMoreVertical()}</button>
              </div>
              <ul data-tree-list="auraEvent" hidden></ul>
            </div>
            <div class="dc-tree-group" data-tree-group="auraInterface">
              <div class="dc-tree-group-row">
                <button type="button" class="dc-tree-group-title" data-tree-toggle="auraInterface" aria-expanded="false">
                  <span class="dc-tree-group-icon" aria-hidden="true"></span>
                  <span class="dc-tree-group-label">LIGHTNING INTERFACES <span class="dc-tree-group-count" data-tree-count="auraInterface"></span></span>
                </button>
                <button type="button" class="dc-tree-actions-trigger" data-aura-interface-root-actions aria-label="Lightning Interfaces actions" title="Lightning Interfaces actions">${iconMoreVertical()}</button>
              </div>
              <ul data-tree-list="auraInterface" hidden></ul>
            </div>
            <div class="dc-tree-group" data-tree-group="auraToken">
              <div class="dc-tree-group-row">
                <button type="button" class="dc-tree-group-title" data-tree-toggle="auraToken" aria-expanded="false">
                  <span class="dc-tree-group-icon" aria-hidden="true"></span>
                  <span class="dc-tree-group-label">LIGHTNING TOKENS <span class="dc-tree-group-count" data-tree-count="auraToken"></span></span>
                </button>
                <button type="button" class="dc-tree-actions-trigger" data-aura-token-root-actions aria-label="Lightning Tokens actions" title="Lightning Tokens actions">${iconMoreVertical()}</button>
              </div>
              <ul data-tree-list="auraToken" hidden></ul>
            </div>
            <div class="dc-tree-group" data-tree-group="lightningMessageChannel">
              <div class="dc-tree-group-row">
                <button type="button" class="dc-tree-group-title" data-tree-toggle="lightningMessageChannel" aria-expanded="false">
                  <span class="dc-tree-group-icon" aria-hidden="true"></span>
                  <span class="dc-tree-group-label">LIGHTNING MESSAGE CHANNELS <span class="dc-tree-group-count" data-tree-count="lightningMessageChannel"></span></span>
                </button>
                <button type="button" class="dc-tree-actions-trigger" data-lightning-message-channel-root-actions aria-label="Lightning Message Channels actions" title="Lightning Message Channels actions">${iconMoreVertical()}</button>
              </div>
              <ul data-tree-list="lightningMessageChannel" hidden></ul>
            </div>
            <div class="dc-tree-group" data-tree-group="apex">
              <div class="dc-tree-group-row">
                <button type="button" class="dc-tree-group-title" data-tree-toggle="apex" aria-expanded="false">
                  <span class="dc-tree-group-icon" aria-hidden="true"></span>
                  <span class="dc-tree-group-label">APEX CLASSES <span class="dc-tree-group-count" data-tree-count="apex"></span></span>
                </button>
                <button type="button" class="dc-tree-actions-trigger" data-apex-root-actions aria-label="Apex Classes actions" title="Apex Classes actions">${iconMoreVertical()}</button>
              </div>
              <ul data-tree-list="apex" hidden></ul>
            </div>
      <div class="dc-tree-group" data-tree-group="trigger">
        <div class="dc-tree-group-row">
          <button type="button" class="dc-tree-group-title" data-tree-toggle="trigger" aria-expanded="false">
            <span class="dc-tree-group-icon" aria-hidden="true"></span>
            <span class="dc-tree-group-label">APEX TRIGGERS <span class="dc-tree-group-count" data-tree-count="trigger"></span></span>
          </button>
          <button type="button" class="dc-tree-actions-trigger" data-apex-trigger-root-actions aria-label="Apex Triggers actions" title="Apex Triggers actions">${iconMoreVertical()}</button>
        </div>
              <ul data-tree-list="trigger" hidden></ul>
            </div>
            <div class="dc-tree-group" data-tree-group="vf">
        <div class="dc-tree-group-row">
          <button type="button" class="dc-tree-group-title" data-tree-toggle="vf" aria-expanded="false">
            <span class="dc-tree-group-icon" aria-hidden="true"></span>
            <span class="dc-tree-group-label">VISUALFORCE PAGES <span class="dc-tree-group-count" data-tree-count="vf"></span></span>
          </button>
          <button type="button" class="dc-tree-actions-trigger" data-visualforce-page-root-actions aria-label="Visualforce Pages actions" title="Visualforce Pages actions">${iconMoreVertical()}</button>
        </div>
        <ul data-tree-list="vf" hidden></ul>
      </div>
            <div class="dc-tree-group" data-tree-group="vfc">
              <div class="dc-tree-group-row">
                <button type="button" class="dc-tree-group-title" data-tree-toggle="vfc" aria-expanded="false">
                  <span class="dc-tree-group-icon" aria-hidden="true"></span>
                  <span class="dc-tree-group-label">VISUALFORCE COMPONENTS <span class="dc-tree-group-count" data-tree-count="vfc"></span></span>
                </button>
                <button type="button" class="dc-tree-actions-trigger" data-visualforce-component-root-actions aria-label="Visualforce Components actions" title="Visualforce Components actions">${iconMoreVertical()}</button>
              </div>
              <ul data-tree-list="vfc" hidden></ul>
            </div>
            </section>
            <section class="dc-file-explorer-card dc-local-files-card" aria-label="Local Files">
            <div class="dc-tree-section-header dc-tree-section-header-local">
              <span>Local Files</span>
              <div class="dc-tree-section-actions" aria-label="Create local file or folder">
                <button type="button" class="dc-tree-section-action" data-create-local-folder aria-label="Create local folder" title="Create local folder">${iconFolderAdd()}</button>
                <button type="button" class="dc-tree-section-action" data-create-local-file aria-label="Create local file" title="Create local file">${iconFileAdd()}</button>
                <button type="button" class="dc-tree-section-action" data-import-local-files aria-label="Import local files" title="Import local files">${iconImport()}</button>
              </div>
            </div>
            <ul class="dc-local-tree" data-local-tree aria-label="Local files"></ul>
            </section>
          </div>
        </aside>

        <div class="dc-sidebar-resizer" data-sidebar-resizer aria-label="Resize sidebar" role="separator" tabindex="0"></div>

        <section class="dc-main-panel" style="--dc-logs-height: 160px;">
          <section class="dc-editor-area">
            <div id="dc-tabs" class="dc-tabs" aria-label="Open files tabs"></div>

            <div class="dc-editor-toolbar" aria-label="Editor tools" hidden>
              <div class="dc-editor-path" id="dc-editor-path"><span class="dc-editor-path-bundle">No file selected</span></div>
              <div class="dc-editor-actions" aria-label="Editor action buttons">
                <button type="button" class="dc-editor-action" data-editor-action="save" aria-label="Save and deploy"><span class="dc-editor-tooltip">Save and deploy</span>${iconSave()}</button>
                <button type="button" class="dc-editor-action" data-editor-action="format" aria-label="Format document"><span class="dc-editor-tooltip">Format document</span>${iconFormat()}</button>
                <button type="button" class="dc-editor-action" data-editor-action="word-wrap" aria-label="Toggle word wrap"><span class="dc-editor-tooltip">Toggle word wrap</span>${iconWordWrap()}</button>
                <button type="button" class="dc-editor-action" data-editor-action="palette" aria-label="Command palette"><span class="dc-editor-tooltip">Command palette</span>${iconCommandPalette()}</button>
                <button type="button" class="dc-editor-action" data-editor-action="minimap" aria-label="Toggle minimap"><span class="dc-editor-tooltip">Toggle minimap</span>${iconMinimap()}</button>
                <button type="button" class="dc-editor-action" data-editor-action="zoom-in" aria-label="Zoom in"><span class="dc-editor-tooltip">Zoom in</span>${iconZoomIn()}</button>
                <button type="button" class="dc-editor-action" data-editor-action="zoom-out" aria-label="Zoom out"><span class="dc-editor-tooltip">Zoom out</span>${iconZoomOut()}</button>
                <button type="button" class="dc-editor-action" data-editor-action="fullscreen" aria-label="Enter fullscreen" data-fullscreen-toggle><span class="dc-editor-tooltip">Enter fullscreen</span>${iconFullscreen()}</button>
              </div>
            </div>

            <div class="dc-editor-surface dc-editor-monaco-shell" aria-label="Editor preview">
              <div id="dc-editor-container" class="dc-editor-monaco"></div>
            </div>
          </section>

          <div class="dc-logs-resizer" data-logs-resizer aria-label="Resize logs panel" role="separator" tabindex="0"></div>

          <section class="dc-logs-panel">
            <div class="dc-logs-header">
              <h2>Logs</h2>
              <button id="dc-clear-logs" type="button" class="dc-link-button">Clear Logs</button>
            </div>
            <div id="dc-log" class="dc-log-list"></div>
          </section>
        </section>
      </section>
    </div>
  `, {
    headerHtml: `
      <div class="header-action-group dc-new-menu-group">
        <button type="button" class="dc-new-menu-button" data-header-action="new" aria-expanded="false">
          <span class="dc-new-menu-label">New</span>
          <span class="dc-new-menu-caret" aria-hidden="true"></span>
        </button>
        <div class="dc-new-menu" hidden>
          <button type="button" class="dc-new-menu-item" data-create-menu="lwc">Lightning Web Component</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="aura">Lightning Aura Component</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="aura-application">Lightning Aura Application</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="lightning-event">Lightning Event</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="lightning-interface">Lightning Interface</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="lightning-token">Lightning Token</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="lightning-message-channel">Lightning Message Channel</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="apex-class">Apex Class</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="apex-trigger">Apex Trigger</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="vf-page">Visualforce Page</button>
          <button type="button" class="dc-new-menu-item" data-create-menu="vf-component">Visualforce Component</button>
        </div>
      </div>
    `,
    footerHtml: `
      <div class="dc-footer-toggles" aria-label="Developer Console panels">
        <button type="button" class="dc-footer-toggle" data-dc-toggle-logs aria-pressed="true">Hide Log Panel</button>
        <span class="dc-footer-toggle-separator" data-dc-toggle-separator aria-hidden="true">|</span>
        <button type="button" class="dc-footer-toggle" data-dc-toggle-sidebar aria-pressed="true">Hide File Explorer</button>
      </div>
    `
  });

  const searchInput = body.querySelector("#dc-search");
  const headerHost = document.getElementById("page-header-content");
  const getHeaderMenuButton = () => headerHost?.querySelector('[data-header-action="new"]') || body.querySelector('[data-header-action="new"]');
  const getHeaderMenu = () => headerHost?.querySelector(".dc-new-menu") || body.querySelector(".dc-new-menu");
  const setMenuOpen = (open) => {
    const headerMenu = getHeaderMenu();
    const headerMenuButton = getHeaderMenuButton();
    if (headerMenu) headerMenu.hidden = !open;
    if (headerMenu) {
      headerMenu.style.display = open ? "grid" : "none";
      headerMenu.classList.toggle("is-open", open);
    }
    if (headerMenuButton) headerMenuButton.setAttribute("aria-expanded", String(Boolean(open)));
    headerMenuButton?.classList.toggle("is-open", open);
    headerHost?.classList.toggle("is-open", open);
  };
  const handleHeaderMenuAction = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const headerMenu = getHeaderMenu();
    const headerMenuButton = getHeaderMenuButton();
    const isOpen = !!headerMenuButton && headerMenuButton.getAttribute("aria-expanded") === "true";
    setMenuOpen(!isOpen);
  };
  getHeaderMenuButton()?.addEventListener("click", handleHeaderMenuAction);
  headerHost?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("[data-header-action=\"new\"]")) return;
    event.preventDefault();
    event.stopPropagation();
    handleHeaderMenuAction(event);
  });
  getHeaderMenu()?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-create-menu]");
    if (!item) return;
    const menu = item.getAttribute("data-create-menu");
    setMenuOpen(false);
    if (menu === "lwc") openCreateLwcModal();
    else if (menu === "aura") openCreateAuraModal();
    else if (menu === "aura-application") openCreateAuraApplicationModal();
    else if (menu === "lightning-event") openCreateLightningEventModal();
    else if (menu === "lightning-interface") openCreateLightningInterfaceModal();
    else if (menu === "lightning-token") openCreateLightningTokenModal();
    else if (menu === "lightning-message-channel") openCreateLightningMessageChannelModal();
    else if (menu === "apex-class") openCreateApexClassModal();
    else if (menu === "apex-trigger") openCreateApexTriggerModal();
    else if (menu === "vf-page") openCreateVisualforcePageModal();
    else if (menu === "vf-component") openCreateVisualforceComponentModal();
  });
  document.addEventListener("click", (event) => {
    const headerMenu = getHeaderMenu();
    if (!headerMenu?.contains(event.target) && !getHeaderMenuButton()?.contains(event.target)) {
      setMenuOpen(false);
    }
  });
  const editorToolbar = body.querySelector(".dc-editor-toolbar");
  const treeEl = body.querySelector("#dc-tree");
  const editorPathEl = body.querySelector("#dc-editor-path");
  const logEl = body.querySelector("#dc-log");
  const clearButton = body.querySelector("#dc-clear-logs");
  const editorContainer = body.querySelector("#dc-editor-container");
  const tabsEl = body.querySelector("#dc-tabs");
  const localTreeEl = body.querySelector("[data-local-tree]");
  const treeGroups = {
    lwc: { button: body.querySelector('[data-tree-toggle="lwc"]'), list: body.querySelector('[data-tree-list="lwc"]'), count: body.querySelector('[data-tree-count="lwc"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0 },
    aura: { button: body.querySelector('[data-tree-toggle="aura"]'), list: body.querySelector('[data-tree-list="aura"]'), count: body.querySelector('[data-tree-count="aura"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0, definitionTypes: ["COMPONENT"], logTag: "AURACOMPONENT", displayName: "Aura Components" },
    auraApplication: { button: body.querySelector('[data-tree-toggle="auraApplication"]'), list: body.querySelector('[data-tree-list="auraApplication"]'), count: body.querySelector('[data-tree-count="auraApplication"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0, definitionTypes: ["APPLICATION"], logTag: "AURAAPPLICATION", displayName: "Aura Applications" },
    auraEvent: { button: body.querySelector('[data-tree-toggle="auraEvent"]'), list: body.querySelector('[data-tree-list="auraEvent"]'), count: body.querySelector('[data-tree-count="auraEvent"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0, definitionTypes: ["EVENT"], logTag: "LIGHTNINGEVENT", displayName: "Lightning Events" },
    auraInterface: { button: body.querySelector('[data-tree-toggle="auraInterface"]'), list: body.querySelector('[data-tree-list="auraInterface"]'), count: body.querySelector('[data-tree-count="auraInterface"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0, definitionTypes: ["INTERFACE"], logTag: "LIGHTNINGINTERFACE", displayName: "Lightning Interfaces" },
    auraToken: { button: body.querySelector('[data-tree-toggle="auraToken"]'), list: body.querySelector('[data-tree-list="auraToken"]'), count: body.querySelector('[data-tree-count="auraToken"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0, definitionTypes: ["TOKEN", "TOKENS"], logTag: "LIGHTNINGTOKEN", displayName: "Lightning Tokens" },
    lightningMessageChannel: { button: body.querySelector('[data-tree-toggle="lightningMessageChannel"]'), list: body.querySelector('[data-tree-list="lightningMessageChannel"]'), count: body.querySelector('[data-tree-count="lightningMessageChannel"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0 },
    apex: { button: body.querySelector('[data-tree-toggle="apex"]'), list: body.querySelector('[data-tree-list="apex"]'), count: body.querySelector('[data-tree-count="apex"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0 },
    trigger: { button: body.querySelector('[data-tree-toggle="trigger"]'), list: body.querySelector('[data-tree-list="trigger"]'), count: body.querySelector('[data-tree-count="trigger"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0 },
    vf: { button: body.querySelector('[data-tree-toggle="vf"]'), list: body.querySelector('[data-tree-list="vf"]'), count: body.querySelector('[data-tree-count="vf"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0 },
    vfc: { button: body.querySelector('[data-tree-toggle="vfc"]'), list: body.querySelector('[data-tree-list="vfc"]'), count: body.querySelector('[data-tree-count="vfc"]'), loaded: false, loading: false, items: [], visibleItems: [], total: 0 }
  };
  const auraTreeGroupKeys = ["aura", "auraApplication", "auraEvent", "auraInterface", "auraToken"];
  const localFilesStorageKey = "lc-developer-console-local-files";
  let sessionId = null;
  let sessionApiOrigin = null;
  let currentFileButton = null;
  let currentApexFileName = null;
  let currentApexTriggerFileName = null;
  let currentVisualforcePageFileName = null;
  let currentVisualforceComponentFileName = null;
  let currentLightningMessageChannelFileName = null;
  let activeLocalFolderId = null;
  let localFilesState = { folders: [], files: [] };
  const expandedLocalFolderIds = new Set();
  let localFilesImportInput = null;
  let selectedFile = null;
  let comparisonReferenceFileId = null;
  const openFiles = [];
  const fileModels = new Map();
  let editor = null;
  let editorModel = null;
  let editorReady = false;
  let suppressEditorChange = false;
  let editorContextMenu = null;
  let editorContextMenuDismiss = null;
  let explorerActionsMenu = null;
  let explorerActionsMenuDismiss = null;
  let explorerActionsMenuTrigger = null;
  const skipSaveDeployConfirmationKey = "lc-skip-save-deploy-confirmation";
  let developerConsolePreferences = getDefaultDeveloperConsolePreferences();
  const developerConsolePreferencesChannel = typeof BroadcastChannel === "function"
    ? new BroadcastChannel(developerConsolePreferencesBroadcastChannel)
    : null;
  let developerConsoleExplorerState = { groupKeys: [], localFolderIds: [] };
  const developerConsolePreferencesPromise = getStoredDeveloperConsolePreferences().catch(() => null);
  const developerConsoleExplorerStatePromise = getStoredDeveloperConsoleExplorerState().catch(() => null);
  const sidebarMinWidth = 240;
  const sidebarMaxWidth = 560;
  let sidebarWidth = developerConsolePreferences.sidebarWidth;
  let logsHeight = developerConsolePreferences.logsHeight;
  let editorWordWrap = developerConsolePreferences.wordWrap;
  let editorFontSize = developerConsolePreferences.fontSize;
  let editorMinimapEnabled = developerConsolePreferences.minimap;

  const defaultEditorValue = "Developer Console workspace ready.\nSelect a bundle from the left to load its files.";
  let currentSearchQuery = "";

  function closeEditorContextMenu() {
    if (editorContextMenuDismiss) {
      document.removeEventListener("pointerdown", editorContextMenuDismiss, true);
      document.removeEventListener("keydown", editorContextMenuDismiss, true);
      editorContextMenuDismiss = null;
    }
    editorContextMenu?.remove();
    editorContextMenu = null;
  }

  function openEditorContextMenu(event, sourceEditor = editor, isReadOnly = false) {
    event.preventDefault();
    event.stopPropagation();
    closeEditorContextMenu();

    const hasFile = Boolean(selectedFile);
    const isSalesforceFile = hasFile && selectedFile.sourceType !== "local";
    const canDeploy = hasFile && Boolean(selectedFile.dirty);
    const isOpenedFileEditor = sourceEditor === editor;
    const comparisonReference = openFiles.find((file) => file.id === comparisonReferenceFileId) || null;
    const canSelectForComparison = isOpenedFileEditor && hasFile;
    const canCompareWithSelected = canSelectForComparison
      && comparisonReference
      && comparisonReference.id !== selectedFile.id;
    const editDisabled = isReadOnly ? "disabled" : "";
    const menu = document.createElement("div");
    menu.className = "dc-editor-context-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      ${isSalesforceFile ? `
        <button type="button" role="menuitem" data-dc-context-action="deploy" ${canDeploy ? "" : "disabled"}><span>Deploy to Org</span><kbd>Ctrl+S</kbd></button>
        <button type="button" role="menuitem" data-dc-context-action="retrieve"><span>Retrieve from Org</span><kbd>Ctrl+Shift+R</kbd></button>
        <button type="button" role="menuitem" data-dc-context-action="diff"><span>Diff from Org</span><kbd>Ctrl+Shift+D</kbd></button>
      ` : ""}
      ${canSelectForComparison ? `
        <button type="button" role="menuitem" data-dc-context-action="select-for-compare"><span>Select for Compare</span></button>
        <button type="button" role="menuitem" data-dc-context-action="compare-with-selected" ${canCompareWithSelected ? "" : "disabled"}><span>Compare with Selected</span></button>
        <span class="dc-editor-context-menu-separator" role="separator"></span>
      ` : ""}
      <button type="button" role="menuitem" data-dc-context-action="go-to-symbol"><span>Go to Symbol...</span><kbd>Ctrl+Shift+O</kbd></button>
      <button type="button" role="menuitem" data-dc-context-action="rename-symbol" ${editDisabled}><span>Rename Symbol</span><kbd>F2</kbd></button>
      <button type="button" role="menuitem" data-dc-context-action="change-all" ${editDisabled}><span>Change All Occurrences</span><kbd>Ctrl+F2</kbd></button>
      <span class="dc-editor-context-menu-separator" role="separator"></span>
      <button type="button" role="menuitem" data-dc-context-action="cut" ${editDisabled}><span>Cut</span><kbd>Ctrl+X</kbd></button>
      <button type="button" role="menuitem" data-dc-context-action="copy"><span>Copy</span><kbd>Ctrl+C</kbd></button>
      <button type="button" role="menuitem" data-dc-context-action="paste" ${editDisabled}><span>Paste</span><kbd>Ctrl+V</kbd></button>
      <span class="dc-editor-context-menu-separator" role="separator"></span>
      <button type="button" role="menuitem" data-dc-context-action="command-palette"><span>Command Palette...</span><kbd>F1</kbd></button>
    `;
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    document.body.appendChild(menu);
    editorContextMenu = menu;

    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8))}px`;

    menu.addEventListener("click", (menuEvent) => {
      const button = menuEvent.target instanceof Element
        ? menuEvent.target.closest("[data-dc-context-action]")
        : null;
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      const action = button.dataset.dcContextAction;
      closeEditorContextMenu();
      if (action === "deploy") void requestSaveSelectedFile();
      if (action === "retrieve") void retrieveSelectedFileFromOrg();
      if (action === "diff") void showSelectedFileDiffFromOrg();
      if (action === "select-for-compare") selectCurrentFileForComparison();
      if (action === "compare-with-selected") showSelectedFileComparison();
      const monacoActions = {
        "go-to-symbol": "editor.action.quickOutline",
        "rename-symbol": "editor.action.rename",
        "change-all": "editor.action.changeAll",
        cut: "editor.action.clipboardCutAction",
        copy: "editor.action.clipboardCopyAction",
        paste: "editor.action.clipboardPasteAction",
        "command-palette": "editor.action.quickCommand"
      };
      const monacoAction = monacoActions[action];
      if (monacoAction) {
        sourceEditor?.focus?.();
        setTimeout(() => {
          const actionToRun = sourceEditor?.getAction?.(monacoAction);
          if (actionToRun?.run) void actionToRun.run();
          else sourceEditor?.trigger?.("dc-editor-context-menu", monacoAction, null);
        }, 0);
      }
    });

    editorContextMenuDismiss = (dismissEvent) => {
      if (dismissEvent.type === "keydown" && dismissEvent.key !== "Escape") return;
      if (dismissEvent.type === "pointerdown" && menu.contains(dismissEvent.target)) return;
      closeEditorContextMenu();
    };
    document.addEventListener("pointerdown", editorContextMenuDismiss, true);
    document.addEventListener("keydown", editorContextMenuDismiss, true);
  }

  addLog("SYSTEM", "Developer Console shell loaded.");
  if (editorContainer) {
    loadMonaco().then((monaco) => {
      if (monaco?.editor) {
        initEditor(monaco);
        if (selectedFile) loadSelectedFileIntoEditor(selectedFile.bundleName, selectedFile.path, selectedFile.content);
        queueEditorLayout();
        return;
      }
      addLog("SYSTEM", "Monaco editor unavailable.");
    }, sessionApiOrigin);
  }

  const sidebar = body.querySelector(".dc-sidebar");
  const sidebarResizer = body.querySelector("[data-sidebar-resizer]");
  const logsPanel = body.querySelector(".dc-logs-panel");
  const logsResizer = body.querySelector("[data-logs-resizer]");
  const workspace = body.querySelector(".dc-workspace");
  const mainPanel = body.querySelector(".dc-main-panel");
  const toggleLogsButton = document.querySelector("[data-dc-toggle-logs]");
  const toggleSidebarButton = document.querySelector("[data-dc-toggle-sidebar]");
  const toggleButtonsSeparator = document.querySelector("[data-dc-toggle-separator]");
  let logsVisible = developerConsolePreferences.logsVisible;
  let sidebarVisible = developerConsolePreferences.sidebarVisible;

  function updatePanelToggleButtons() {
    if (toggleLogsButton) {
      toggleLogsButton.hidden = !developerConsolePreferences.showLogPanelToggleButton;
      toggleLogsButton.textContent = logsVisible ? "Hide Log Panel" : "Show Log Panel";
      toggleLogsButton.setAttribute("aria-pressed", String(logsVisible));
    }
    if (toggleSidebarButton) {
      toggleSidebarButton.hidden = !developerConsolePreferences.showFileExplorerToggleButton;
      toggleSidebarButton.textContent = sidebarVisible ? "Hide File Explorer" : "Show File Explorer";
      toggleSidebarButton.setAttribute("aria-pressed", String(sidebarVisible));
    }
    if (toggleButtonsSeparator) {
      toggleButtonsSeparator.hidden = !(developerConsolePreferences.showLogPanelToggleButton && developerConsolePreferences.showFileExplorerToggleButton);
    }
  }

  function applyPanelVisibility() {
    workspace?.classList.toggle("dc-sidebar-hidden", !sidebarVisible);
    if (workspace) {
      workspace.style.gridTemplateColumns = sidebarVisible
        ? `${sidebarWidth}px 8px minmax(0, 1fr)`
        : "minmax(0, 1fr)";
    }
    mainPanel?.classList.toggle("dc-logs-hidden", !logsVisible);
    updatePanelToggleButtons();
    queueEditorLayout();
  }

  toggleLogsButton?.addEventListener("click", () => {
    logsVisible = !logsVisible;
    applyPanelVisibility();
    persistDeveloperConsolePreferences({ logsVisible });
  });
  toggleSidebarButton?.addEventListener("click", () => {
    sidebarVisible = !sidebarVisible;
    applyPanelVisibility();
    persistDeveloperConsolePreferences({ sidebarVisible });
  });

  function applySidebarWidth(nextWidth) {
    const clamped = Math.max(sidebarMinWidth, Math.min(sidebarMaxWidth, Math.round(nextWidth)));
    sidebarWidth = clamped;
    sidebar?.style.setProperty("--dc-sidebar-width", `${clamped}px`);
    if (workspace) {
      workspace.style.gridTemplateColumns = `${clamped}px 8px minmax(0, 1fr)`;
    }
    queueEditorLayout();
  }

  const logsMinHeight = 140;
  const logsMaxHeight = 420;

  function applyLogsHeight(nextHeight) {
    const clamped = Math.max(logsMinHeight, Math.min(logsMaxHeight, Math.round(nextHeight)));
    logsHeight = clamped;
    if (logsPanel) {
      logsPanel.style.height = `${clamped}px`;
      logsPanel.style.flexBasis = `${clamped}px`;
    }
    queueEditorLayout();
  }

  function persistDeveloperConsolePreferences(changes) {
    void setStoredDeveloperConsolePreferences(changes)
      .then((preferences) => developerConsolePreferencesChannel?.postMessage({ type: "preferences", preferences }))
      .catch((error) => addLog("ERROR", `Unable to save Developer Console preference: ${getErrorDetails(error)}`));
  }

  function applyDeveloperConsolePreferences(preferences) {
    developerConsolePreferences = { ...getDefaultDeveloperConsolePreferences(), ...(preferences || {}) };
    sidebarWidth = developerConsolePreferences.sidebarWidth;
    logsHeight = developerConsolePreferences.logsHeight;
    sidebarVisible = developerConsolePreferences.sidebarVisible;
    logsVisible = developerConsolePreferences.logsVisible;
    editorWordWrap = developerConsolePreferences.wordWrap;
    editorFontSize = developerConsolePreferences.fontSize;
    editorMinimapEnabled = developerConsolePreferences.minimap;
    const applyExplorerTextColor = (propertyName, color) => {
      if (!sidebar) return;
      if (color) sidebar.style.setProperty(propertyName, color);
      else sidebar.style.removeProperty(propertyName);
    };
    applyExplorerTextColor("--dc-explorer-root-text-color", developerConsolePreferences.explorerRootTextColor);
    applyExplorerTextColor("--dc-explorer-node-text-color", developerConsolePreferences.explorerNodeTextColor);
    applyExplorerTextColor("--dc-explorer-resource-text-color", developerConsolePreferences.explorerResourceTextColor);
    if (clearButton) clearButton.hidden = !developerConsolePreferences.showClearLogsButton;
    applySidebarWidth(sidebarWidth);
    applyLogsHeight(logsHeight);
    applyPanelVisibility();
    editor?.updateOptions?.({
      fontSize: editorFontSize,
      wordWrap: editorWordWrap,
      minimap: { enabled: editorMinimapEnabled },
      lineNumbers: developerConsolePreferences.lineNumbers ? "on" : "off",
      renderWhitespace: developerConsolePreferences.renderWhitespace,
      tabSize: developerConsolePreferences.tabSize,
      insertSpaces: developerConsolePreferences.insertSpaces,
      formatOnPaste: developerConsolePreferences.formatOnPaste,
      formatOnType: developerConsolePreferences.formatOnType
    });
    editor?.getModel?.()?.updateOptions?.({
      tabSize: developerConsolePreferences.tabSize,
      insertSpaces: developerConsolePreferences.insertSpaces
    });
    const maxLogEntries = Number(developerConsolePreferences.maxLogEntries) || 100;
    while (logEl?.children.length > maxLogEntries) logEl.firstElementChild?.remove();
  }

  function persistExplorerState() {
    if (!developerConsolePreferences.rememberExpandedFolders) return;
    developerConsoleExplorerState = {
      groupKeys: Object.entries(treeGroups)
        .filter(([, group]) => group.button?.getAttribute("aria-expanded") === "true")
        .map(([key]) => key),
      localFolderIds: [...expandedLocalFolderIds]
    };
    void setStoredDeveloperConsoleExplorerState(developerConsoleExplorerState).catch((error) => {
      addLog("ERROR", `Unable to remember Explorer state: ${getErrorDetails(error)}`);
    });
  }

  function restoreExplorerState() {
    if (!developerConsolePreferences.rememberExpandedFolders) return;
    const groupKeys = developerConsoleExplorerState?.groupKeys || [];
    const localFolderIds = developerConsoleExplorerState?.localFolderIds || [];
    expandedLocalFolderIds.clear();
    localFolderIds
      .filter((folderId) => localFilesState.folders.some((folder) => folder.id === folderId))
      .forEach((folderId) => expandedLocalFolderIds.add(folderId));
    renderLocalFilesTree();
    groupKeys.forEach((key) => setTreeGroupExpanded(key, true, false));
  }

  applySidebarWidth(sidebarWidth);
  applyLogsHeight(logsHeight);
  applyPanelVisibility();

  void developerConsolePreferencesPromise.then((preferences) => {
    if (preferences) applyDeveloperConsolePreferences(preferences);
  });
  void developerConsoleExplorerStatePromise.then((state) => {
    if (state) developerConsoleExplorerState = state;
  });

  developerConsolePreferencesChannel?.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type === "preferences" && message.preferences && typeof message.preferences === "object") {
      applyDeveloperConsolePreferences(message.preferences);
    }
  });

  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[developerConsolePreferencesStorageKey]) {
      applyDeveloperConsolePreferences(changes[developerConsolePreferencesStorageKey].newValue || getDefaultDeveloperConsolePreferences());
    }
    if (changes[developerConsoleClearLogsRequestStorageKey] && logEl) {
      logEl.replaceChildren();
    }
  });

  if (sidebarResizer) {
    let dragging = false;
    let startX = 0;
    let startWidth = sidebarWidth;

    const onPointerMove = (event) => {
      if (!dragging) return;
      applySidebarWidth(startWidth + (event.clientX - startX));
    };

    const stopDragging = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("dc-sidebar-resizing");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
      persistDeveloperConsolePreferences({ sidebarWidth });
    };

    sidebarResizer.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dragging = true;
      startX = event.clientX;
      startWidth = sidebar?.getBoundingClientRect?.().width || sidebarWidth;
      document.body.classList.add("dc-sidebar-resizing");
      sidebarResizer.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDragging);
      window.addEventListener("pointercancel", stopDragging);
      event.preventDefault();
    });

    sidebarResizer.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const delta = event.key === "ArrowLeft" ? -24 : 24;
      applySidebarWidth(sidebarWidth + delta);
      event.preventDefault();
    });
  }

  if (logsResizer) {
    let dragging = false;
    let startY = 0;
    let startHeight = logsHeight;

    const onPointerMove = (event) => {
      if (!dragging) return;
      applyLogsHeight(startHeight + (startY - event.clientY));
    };

    const stopDragging = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("dc-logs-resizing");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
      persistDeveloperConsolePreferences({ logsHeight });
    };

    logsResizer.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dragging = true;
      startY = event.clientY;
      startHeight = logsPanel?.getBoundingClientRect?.().height || logsHeight;
      document.body.classList.add("dc-logs-resizing");
      logsResizer.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDragging);
      window.addEventListener("pointercancel", stopDragging);
      event.preventDefault();
    });

    logsResizer.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const delta = event.key === "ArrowUp" ? 24 : -24;
      applyLogsHeight(logsHeight + delta);
      event.preventDefault();
    });
  }

  clearButton.addEventListener("click", () => {
    logEl.innerHTML = "";
  });

  searchInput?.addEventListener("input", () => {
    currentSearchQuery = String(searchInput.value || "").toLowerCase().trim();
    applySearchFilter();
  });

  Object.entries(treeGroups).forEach(([key, group]) => {
    group.button?.addEventListener("click", async () => {
      const isExpanded = group.button.getAttribute("aria-expanded") === "true";
      const nextExpanded = !isExpanded;
      setTreeGroupExpanded(key, nextExpanded);
      if (nextExpanded) {
        if (key === "lwc") await ensureLwcTreeLoaded();
        if (isAuraTreeGroup(key)) await ensureAuraTreeLoaded(key);
        if (key === "apex") await ensureApexTreeLoaded();
        if (key === "trigger") await ensureTriggerTreeLoaded();
        if (key === "vf") await ensureVisualforceTreeLoaded();
        if (key === "vfc") await ensureVisualforceComponentTreeLoaded();
        if (key === "lightningMessageChannel") await ensureLightningMessageChannelTreeLoaded();
      }
    }, sessionApiOrigin);
  });

  body.querySelector("[data-refresh-salesforce-files]")?.addEventListener("click", () => {
    void refreshSalesforceFiles();
  });
  body.querySelector("[data-lwc-root-actions]")?.addEventListener("click", (event) => {
    const trigger = event.currentTarget;
    event.preventDefault();
    event.stopPropagation();
    openExplorerActionsMenu(trigger, [
      { label: "Refresh", icon: iconRefresh(), onSelect: () => void refreshLwcBundles() }
    ]);
  });
  body.querySelector("[data-aura-root-actions]")?.addEventListener("click", (event) => {
    const trigger = event.currentTarget;
    event.preventDefault();
    event.stopPropagation();
    openExplorerActionsMenu(trigger, [
      { label: "Refresh", icon: iconRefresh(), onSelect: () => void refreshAuraBundles("aura") }
    ]);
  });
  body.querySelector("[data-aura-application-root-actions]")?.addEventListener("click", (event) => {
    const trigger = event.currentTarget;
    event.preventDefault();
    event.stopPropagation();
    openExplorerActionsMenu(trigger, [
      { label: "Refresh", icon: iconRefresh(), onSelect: () => void refreshAuraBundles("auraApplication") }
    ]);
  });
  [
    ["[data-aura-event-root-actions]", "auraEvent"],
    ["[data-aura-interface-root-actions]", "auraInterface"],
    ["[data-aura-token-root-actions]", "auraToken"]
  ].forEach(([selector, groupKey]) => {
    body.querySelector(selector)?.addEventListener("click", (event) => {
      const trigger = event.currentTarget;
      event.preventDefault();
      event.stopPropagation();
      openExplorerActionsMenu(trigger, [
        { label: "Refresh", icon: iconRefresh(), onSelect: () => void refreshAuraBundles(groupKey) }
      ]);
    });
  });
  [
    ["[data-apex-root-actions]", "apex"],
    ["[data-apex-trigger-root-actions]", "trigger"],
    ["[data-visualforce-page-root-actions]", "vf"],
    ["[data-visualforce-component-root-actions]", "vfc"]
  ].forEach(([selector, groupKey]) => {
    body.querySelector(selector)?.addEventListener("click", (event) => {
      const trigger = event.currentTarget;
      event.preventDefault();
      event.stopPropagation();
      openExplorerActionsMenu(trigger, [
        { label: "Refresh", icon: iconRefresh(), onSelect: () => void refreshDeveloperResourceGroup(groupKey) }
      ]);
    });
  });
  body.querySelector("[data-lightning-message-channel-root-actions]")?.addEventListener("click", (event) => {
    const trigger = event.currentTarget;
    event.preventDefault();
    event.stopPropagation();
    openExplorerActionsMenu(trigger, [
      { label: "Refresh", icon: iconRefresh(), onSelect: () => void refreshLightningMessageChannels() }
    ]);
  });
  body.querySelector("[data-create-local-folder]")?.addEventListener("click", () => {
    createLocalFolder();
  });
  body.querySelector("[data-create-local-file]")?.addEventListener("click", () => {
    createLocalTextFile();
  });
  body.querySelector("[data-import-local-files]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openLocalFilesImportPicker();
  });

  function normalizeLocalFilesState(value) {
    const folders = Array.isArray(value?.folders)
      ? value.folders
        .filter((folder) => folder && folder.id && String(folder.name || "").trim())
        .map((folder) => ({ id: String(folder.id), name: String(folder.name).trim() }))
      : [];
    const folderIds = new Set(folders.map((folder) => folder.id));
    const files = Array.isArray(value?.files)
      ? value.files
        .filter((file) => file && file.id && String(file.name || "").trim())
        .map((file) => ({
          id: String(file.id),
          name: String(file.name).trim(),
          folderId: folderIds.has(String(file.folderId || "")) ? String(file.folderId) : null,
          content: String(file.content ?? "")
        }))
      : [];
    return { folders, files };
  }

  function isSameLocalFilesState(left, right) {
    return JSON.stringify(normalizeLocalFilesState(left)) === JSON.stringify(normalizeLocalFilesState(right));
  }

  async function loadLocalFilesState() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(localFilesStorageKey);
        localFilesState = normalizeLocalFilesState(stored?.[localFilesStorageKey]);
      } else {
        localFilesState = normalizeLocalFilesState(JSON.parse(localStorage.getItem(localFilesStorageKey) || "{}"));
      }
    } catch (error) {
      localFilesState = { folders: [], files: [] };
      addLog("ERROR", `Unable to load local files: ${getErrorDetails(error)}`);
    }
    renderLocalFilesTree();
  }

  async function persistLocalFilesState() {
    const state = normalizeLocalFilesState(localFilesState);
    localFilesState = state;
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [localFilesStorageKey]: state });
      } else {
        localStorage.setItem(localFilesStorageKey, JSON.stringify(state));
      }
    } catch (error) {
      addLog("ERROR", `Unable to save local files: ${getErrorDetails(error)}`);
    }
  }

  function createLocalItemId(prefix) {
    const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${randomPart}`;
  }

  function getNextLocalName(prefix, extension = "", collection = []) {
    let index = 1;
    const names = new Set(collection.map((item) => String(item.name || "").toLowerCase()));
    while (names.has(`${prefix}${index}${extension}`.toLowerCase())) index += 1;
    return `${prefix}${index}${extension}`;
  }

  function normalizeLocalFileName(value, fallback) {
    const normalized = String(value || "").trim().replace(/[\\/:*?"<>|]/g, "_");
    if (!normalized) return fallback;
    return normalized.includes(".") ? normalized : `${normalized}.txt`;
  }

  function getLocalFileExtensionLabel(fileName) {
    const normalizedName = String(fileName || "").trim();
    const extensionIndex = normalizedName.lastIndexOf(".");
    if (extensionIndex <= 0 || extensionIndex === normalizedName.length - 1) return "TXT";
    const extension = normalizedName.slice(extensionIndex + 1).replace(/[^a-z0-9]/gi, "");
    return extension ? extension.toUpperCase() : "TXT";
  }

  function renderLocalFilesTree(editing = null) {
    if (!localTreeEl) return;
    localTreeEl.replaceChildren();
    const query = String(currentSearchQuery || "").trim().toLowerCase();
    const folderFiles = (folderId) => localFilesState.files
      .filter((file) => (file.folderId || null) === folderId)
      .filter((file) => !query || file.name.toLowerCase().includes(query))
      .sort((left, right) => left.name.localeCompare(right.name));
    const appendFile = (file, parent) => {
      const item = document.createElement("li");
      item.className = "dc-local-file-row";
      const fileButton = document.createElement("button");
      fileButton.type = "button";
      fileButton.className = "dc-local-node-button dc-local-file-button";
      fileButton.dataset.localFileId = file.id;
      fileButton.innerHTML = `<span class="dc-local-file-icon" aria-hidden="true">${escapeHtml(getLocalFileExtensionLabel(file.name))}</span>`;
      if (editing?.type === "file" && editing.id === file.id) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "dc-local-rename-input";
        input.value = file.name;
        input.dataset.localRenameFile = file.id;
        fileButton.appendChild(input);
        bindLocalRenameInput(input, "file", file.id, file.name);
      } else {
        const label = document.createElement("span");
        label.className = "dc-local-node-label";
        label.textContent = file.name;
        fileButton.appendChild(label);
      }
      fileButton.addEventListener("click", (event) => {
        if (event.target instanceof HTMLInputElement) return;
        void openLocalFileInEditor(file.id);
      });
      fileButton.addEventListener("dblclick", (event) => {
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        event.stopPropagation();
        renderLocalFilesTree({ type: "file", id: file.id });
      });
      const renameButton = createLocalRenameButton("file", file.id, file.name);
      const downloadButton = createLocalDownloadButton(file.id, file.name);
      const deleteButton = createLocalDeleteButton("file", file.id, file.name);
      item.append(fileButton, renameButton, downloadButton, deleteButton);
      parent.appendChild(item);
    };

    folderFiles(null).forEach((file) => appendFile(file, localTreeEl));
    localFilesState.folders
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((folder) => {
        const files = folderFiles(folder.id);
        const folderMatches = !query || folder.name.toLowerCase().includes(query) || files.length > 0;
        if (!folderMatches) return;
        const item = document.createElement("li");
        item.className = `dc-local-folder${activeLocalFolderId === folder.id ? " dc-local-folder-active" : ""}`;
        const row = document.createElement("div");
        row.className = "dc-local-folder-row";
        const folderButton = document.createElement("button");
        folderButton.type = "button";
        folderButton.className = "dc-local-node-button dc-local-folder-button";
        folderButton.dataset.localFolderId = folder.id;
        folderButton.setAttribute("aria-expanded", String(expandedLocalFolderIds.has(folder.id)));
        folderButton.innerHTML = `<span class="dc-local-folder-icon" aria-hidden="true">📁</span>`;
        if (editing?.type === "folder" && editing.id === folder.id) {
          const input = document.createElement("input");
          input.type = "text";
          input.className = "dc-local-rename-input";
          input.value = folder.name;
          input.dataset.localRenameFolder = folder.id;
          folderButton.appendChild(input);
          bindLocalRenameInput(input, "folder", folder.id, folder.name);
        } else {
          const label = document.createElement("span");
          label.className = "dc-local-node-label";
          label.textContent = folder.name;
          folderButton.appendChild(label);
        }
        folderButton.addEventListener("click", (event) => {
          if (event.target instanceof HTMLInputElement) return;
          activeLocalFolderId = folder.id;
          if (expandedLocalFolderIds.has(folder.id)) expandedLocalFolderIds.delete(folder.id);
          else expandedLocalFolderIds.add(folder.id);
          persistExplorerState();
          renderLocalFilesTree();
        });
        folderButton.addEventListener("dblclick", (event) => {
          if (event.target instanceof HTMLInputElement) return;
          event.preventDefault();
          event.stopPropagation();
          renderLocalFilesTree({ type: "folder", id: folder.id });
        });
        row.append(
          folderButton,
          createLocalRenameButton("folder", folder.id, folder.name),
          createLocalDeleteButton("folder", folder.id, folder.name)
        );
        item.appendChild(row);
        const children = document.createElement("ul");
        children.className = "dc-local-folder-children";
        children.hidden = !expandedLocalFolderIds.has(folder.id);
        files.forEach((file) => appendFile(file, children));
        item.appendChild(children);
        localTreeEl.appendChild(item);
      });

    if (editing) {
      const selector = editing.type === "folder"
        ? `[data-local-rename-folder="${editing.id}"]`
        : `[data-local-rename-file="${editing.id}"]`;
      const input = localTreeEl.querySelector(selector);
      requestAnimationFrame(() => {
        input?.focus();
        input?.select();
      });
    }
  }

  function createLocalDeleteButton(type, id, name) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dc-local-delete-button";
    button.setAttribute("aria-label", `Delete ${type} ${name}`);
    button.title = `Delete ${name}`;
    button.innerHTML = iconTrash();
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openDeleteExplorerItemConfirmationModal(() => {
        if (type === "folder") deleteLocalFolder(id);
        else deleteLocalFile(id);
      });
    });
    return button;
  }

  function createLocalRenameButton(type, id, name) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dc-local-rename-button";
    button.setAttribute("aria-label", `Rename ${type} ${name}`);
    button.title = `Rename ${name}`;
    button.innerHTML = iconRename();
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      renderLocalFilesTree({ type, id });
    });
    return button;
  }

  function createLocalDownloadButton(fileId, name) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dc-local-download-button";
    button.setAttribute("aria-label", `Download file ${name}`);
    button.title = `Download ${name}`;
    button.innerHTML = iconDownload();
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      downloadLocalFile(fileId);
    });
    return button;
  }

  function bindLocalRenameInput(input, type, id, fallbackName) {
    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      if (type === "folder") renameLocalFolder(id, input.value, fallbackName);
      else renameLocalFile(id, input.value, fallbackName);
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        input.value = fallbackName;
        commit();
      }
    });
    input.addEventListener("blur", commit);
    input.addEventListener("click", (event) => event.stopPropagation());
  }

  function createLocalFolder() {
    const defaultName = getNextLocalName("Folder", "", localFilesState.folders);
    const folder = {
      id: createLocalItemId("folder"),
      name: defaultName
    };
    localFilesState.folders.push(folder);
    activeLocalFolderId = folder.id;
    expandedLocalFolderIds.add(folder.id);
    persistExplorerState();
    void persistLocalFilesState();
    renderLocalFilesTree();
  }

  function createLocalTextFile() {
    const parentFiles = localFilesState.files.filter((file) => (file.folderId || null) === activeLocalFolderId);
    const defaultName = getNextLocalName("text", ".txt", parentFiles);
    const file = {
      id: createLocalItemId("file"),
      name: defaultName,
      folderId: activeLocalFolderId,
      content: ""
    };
    localFilesState.files.push(file);
    if (activeLocalFolderId) expandedLocalFolderIds.add(activeLocalFolderId);
    persistExplorerState();
    void persistLocalFilesState();
    renderLocalFilesTree();
  }

  function getAvailableLocalName(value, collection = []) {
    const normalized = String(value || "").trim().replace(/[\\/:*?"<>|]/g, "_") || "Untitled";
    const existingNames = new Set(collection.map((item) => String(item?.name || "").toLowerCase()));
    if (!existingNames.has(normalized.toLowerCase())) return normalized;

    const extensionIndex = normalized.lastIndexOf(".");
    const baseName = extensionIndex > 0 ? normalized.slice(0, extensionIndex) : normalized;
    const extension = extensionIndex > 0 ? normalized.slice(extensionIndex) : "";
    let suffix = 2;
    let candidate = `${baseName} (${suffix})${extension}`;
    while (existingNames.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${baseName} (${suffix})${extension}`;
    }
    return candidate;
  }

  function openLocalFilesImportPicker() {
    if (!localFilesImportInput) {
      localFilesImportInput = document.createElement("input");
      localFilesImportInput.type = "file";
      localFilesImportInput.multiple = true;
      localFilesImportInput.hidden = true;
      localFilesImportInput.addEventListener("change", () => {
        const files = Array.from(localFilesImportInput.files || []);
        localFilesImportInput.value = "";
        void importLocalFiles(files);
      });
      document.body.appendChild(localFilesImportInput);
    }
    localFilesImportInput.click();
  }

  async function importLocalFiles(files) {
    const targetFolder = localFilesState.folders.find((folder) => folder.id === activeLocalFolderId) || null;
    const importedCount = await addImportedLocalFiles(files, targetFolder?.id || null);
    if (!importedCount) return;
    if (targetFolder) expandedLocalFolderIds.add(targetFolder.id);
    persistExplorerState();
    await persistLocalFilesState();
    renderLocalFilesTree();
    addLog("SUCCESS", `[LOCALFILES] - Imported ${importedCount} file${importedCount === 1 ? "" : "s"}.`);
  }

  async function addImportedLocalFiles(files, folderId) {
    const importedFiles = Array.isArray(files) ? files : [];
    let importedCount = 0;
    for (const importedFile of importedFiles) {
      if (!importedFile || typeof importedFile.text !== "function") continue;
      try {
        const parentFiles = localFilesState.files.filter((file) => (file.folderId || null) === folderId);
        const fallbackName = getNextLocalName("text", ".txt", parentFiles);
        const importedName = String(importedFile.name || "").trim().replace(/[\\/:*?"<>|]/g, "_") || fallbackName;
        const name = getAvailableLocalName(importedName, parentFiles);
        localFilesState.files.push({
          id: createLocalItemId("file"),
          name,
          folderId,
          content: await importedFile.text()
        });
        importedCount += 1;
      } catch (error) {
        addLog("ERROR", `[LOCALFILES] - Unable to import ${importedFile?.name || "file"}: ${getErrorDetails(error)}`);
      }
    }
    return importedCount;
  }

  function downloadLocalFile(fileId) {
    const file = localFilesState.files.find((item) => item.id === fileId);
    if (!file) return;
    downloadLocalBlob(file.name, new Blob([file.content], { type: "text/plain;charset=utf-8" }));
  }

  function downloadLocalBlob(fileName, blob) {
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = String(fileName || "download").replace(/[\\/:*?"<>|]/g, "_");
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function renameLocalFolder(folderId, nextName, fallbackName) {
    const folder = localFilesState.folders.find((item) => item.id === folderId);
    if (!folder) return;
    folder.name = String(nextName || fallbackName).trim().replace(/[\\/:*?"<>|]/g, "_") || fallbackName;
    localFilesState.files
      .filter((file) => file.folderId === folderId)
      .forEach((file) => syncOpenLocalFileLocation(file, folder));
    void persistLocalFilesState();
    renderLocalFilesTree();
    renderTabs();
  }

  function renameLocalFile(fileId, nextName, fallbackName) {
    const file = localFilesState.files.find((item) => item.id === fileId);
    if (!file) return;
    file.name = normalizeLocalFileName(nextName, fallbackName);
    const folder = localFilesState.folders.find((item) => item.id === file.folderId);
    syncOpenLocalFileLocation(file, folder);
    void persistLocalFilesState();
    renderLocalFilesTree();
    renderTabs();
  }

  function syncOpenLocalFileLocation(file, folder) {
    const openFile = openFiles.find((item) => item.sourceType === "local" && item.localFileId === file.id);
    if (!openFile) return;
    const previousKey = `${openFile.bundleName}::${openFile.path}`;
    openFile.bundleName = folder?.name || "Local Files";
    openFile.path = getLocalFilePath(file, folder);
    const nextKey = `${openFile.bundleName}::${openFile.path}`;
    if (previousKey !== nextKey) {
      const model = fileModels.get(previousKey);
      if (model) {
        fileModels.delete(previousKey);
        fileModels.set(nextKey, model);
      }
    }
    if (selectedFile?.id === openFile.id) {
      updateEditorPathLabel(openFile.bundleName, openFile.path);
    }
  }

  function deleteLocalFolder(folderId) {
    const fileIds = localFilesState.files.filter((file) => file.folderId === folderId).map((file) => file.id);
    localFilesState.files = localFilesState.files.filter((file) => file.folderId !== folderId);
    localFilesState.folders = localFilesState.folders.filter((folder) => folder.id !== folderId);
    expandedLocalFolderIds.delete(folderId);
    if (activeLocalFolderId === folderId) activeLocalFolderId = null;
    removeOpenLocalFiles(fileIds);
    void persistLocalFilesState();
    renderLocalFilesTree();
  }

  function deleteLocalFile(fileId) {
    localFilesState.files = localFilesState.files.filter((file) => file.id !== fileId);
    removeOpenLocalFiles([fileId]);
    void persistLocalFilesState();
    renderLocalFilesTree();
  }

  function removeOpenLocalFiles(fileIds) {
    const fileIdSet = new Set(fileIds);
    const selectedWasRemoved = selectedFile?.sourceType === "local" && fileIdSet.has(selectedFile.localFileId);
    for (let index = openFiles.length - 1; index >= 0; index -= 1) {
      const file = openFiles[index];
      if (file.sourceType !== "local" || !fileIdSet.has(file.localFileId)) continue;
      const model = fileModels.get(`${file.bundleName}::${file.path}`);
      model?.dispose?.();
      fileModels.delete(`${file.bundleName}::${file.path}`);
      openFiles.splice(index, 1);
    }
    if (selectedWasRemoved) {
      const nextFile = openFiles[openFiles.length - 1] || null;
      if (nextFile) activateTab(nextFile.id);
      else showWorkspaceReadyState();
    }
    renderTabs();
  }

  function getLocalFilePath(file, folder = null) {
    const parent = folder || localFilesState.folders.find((item) => item.id === file.folderId);
    return parent ? `local/${parent.name}/${file.name}` : `local/${file.name}`;
  }

  async function openLocalFileInEditor(fileId) {
    const file = localFilesState.files.find((item) => item.id === fileId);
    if (!file) return;
    const folder = localFilesState.folders.find((item) => item.id === file.folderId);
    activeLocalFolderId = file.folderId || null;
    if (folder) expandedLocalFolderIds.add(folder.id);
    persistExplorerState();
    const bundleName = folder?.name || "Local Files";
    const filePath = getLocalFilePath(file, folder);
    const existing = openFiles.find((item) => item.sourceType === "local" && item.localFileId === file.id);
    if (existing) {
      existing.bundleName = bundleName;
      existing.path = filePath;
      existing.content = file.content;
      if (!existing.dirty) existing.originalContent = file.content;
      activateTab(existing.id);
      return;
    }
    const fileIdValue = `local::${file.id}`;
    openFiles.push({
      id: fileIdValue,
      button: null,
      bundleName,
      path: filePath,
      content: file.content,
      originalContent: file.content,
      dirty: false,
      sourceType: "local",
      localFileId: file.id
    });
    activateTab(fileIdValue);
  }

  async function saveLocalFile() {
    if (!selectedFile?.localFileId) return false;
    const file = localFilesState.files.find((item) => item.id === selectedFile.localFileId);
    if (!file) return false;
    const source = editor?.getValue?.() ?? selectedFile.content ?? "";
    file.content = String(source);
    selectedFile.content = file.content;
    selectedFile.originalContent = file.content;
    selectedFile.dirty = false;
    const openFile = openFiles.find((item) => item.id === selectedFile.id);
    if (openFile) {
      openFile.content = file.content;
      openFile.originalContent = file.content;
      openFile.dirty = false;
    }
    await persistLocalFilesState();
    renderTabs();
    return true;
  }

  async function refreshSalesforceFiles() {
    if (!sessionId) {
      addLog("ERROR", "No session cookie found.");
      return;
    }
    const refreshButton = body.querySelector("[data-refresh-salesforce-files]");
    refreshButton?.setAttribute("disabled", "");
    addLog("INFO", "[SALESFORCEFILES] - Refreshing Salesforce files, please wait...");
    Object.values(treeGroups).forEach((group) => {
      group.loaded = false;
      group.loading = false;
      group.items = [];
      group.visibleItems = [];
      group.total = 0;
      updateTreeGroupCount(group, 0);
      setTreeGroupStatus(group, "Refreshing...");
    });
    try {
      await ensureLwcTreeLoaded();
      for (const groupKey of auraTreeGroupKeys) await ensureAuraTreeLoaded(groupKey);
      await ensureLightningMessageChannelTreeLoaded();
      await ensureApexTreeLoaded();
      await ensureTriggerTreeLoaded();
      await ensureVisualforceTreeLoaded();
      await ensureVisualforceComponentTreeLoaded();
      addLog("SUCCESS", "[SALESFORCEFILES] - Salesforce files refreshed successfully.");
    } catch (error) {
      addLog("ERROR", `[SALESFORCEFILES] - Refresh failed: ${getErrorDetails(error)}`);
    } finally {
      refreshButton?.removeAttribute("disabled");
    }
  }

  function addLog(type, message) {
    if (!logEl) return;
    const row = document.createElement("div");
    const normalizedType = String(type || "INFO").toUpperCase();
    const timestamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
    row.className = `dc-log-row dc-log-row-${normalizedType.toLowerCase()}`;
    row.innerHTML = `<span class="dc-log-row-type">${escapeHtml(normalizedType)}</span><span class="dc-log-row-divider">|</span><p class="dc-log-row-message">${escapeHtml(String(message ?? ""))}</p>${developerConsolePreferences.showLogTimestamps ? `<span class="dc-log-row-divider">|</span><span class="dc-log-row-time">${escapeHtml(timestamp)}</span>` : ""}`;
    logEl.appendChild(row);
    const maxLogEntries = Number(developerConsolePreferences.maxLogEntries) || 100;
    while (logEl.children.length > maxLogEntries) logEl.firstElementChild?.remove();
    if (developerConsolePreferences.autoScrollLogs) {
      logEl.scrollTo({ top: logEl.scrollHeight, behavior: "smooth" });
    }
  }

  function getErrorDetails(error) {
    if (!error) return "Unknown error - please refresh the page and try again!";
    if (typeof error === "string") return error;
    const parts = [error.message || "Unknown error - please refresh the page and try again!"];
    if (error.name && error.name !== "Error") parts.push(`[${error.name}]`);
    if (error.stack) parts.push(error.stack);
    return parts.join("\n");
  }

  function setEditorValue(value) {
    const nextValue = String(value ?? "");
    if (editor?.setValue) {
      if (editor.getValue?.() !== nextValue) editor.setValue(nextValue);
      return;
    }
    if (editorContainer) editorContainer.textContent = nextValue;
  }

  function syncActiveTreeSelection(file) {
    if (!file || !developerConsolePreferences.revealActiveFile) return null;
    const sourceMap = {
      apex: () => {
        currentApexFileName = file.path.split("/").pop() || file.path;
        return selectTreeFile("apex", currentApexFileName);
      },
      aura: () => {
        ensureAuraTreeGroupExpanded(file.auraTreeGroup);
        ensureBundleNodeExpanded(file.bundleName, findAuraComponentNode, file.auraTreeGroup);
        return selectTreeFile("aura", file.bundleName, file.path, file.auraTreeGroup);
      },
      bundle: () => {
        ensureLwcTreeGroupExpanded();
        ensureBundleNodeExpanded(file.bundleName, findLwcBundleNode);
        return selectTreeFile("bundle", file.bundleName, file.path);
      },
      "apex-trigger": () => selectTreeFile("apex-trigger", setActiveTreeFile("apex-trigger", file.path)),
      "apex-page": () => selectTreeFile("apex-page", setActiveTreeFile("apex-page", file.path)),
      "apex-component": () => selectTreeFile("apex-component", setActiveTreeFile("apex-component", file.path)),
      "lightning-message-channel": () => selectTreeFile("lightning-message-channel", setActiveTreeFile("lightning-message-channel", file.path)),
      local: () => selectLocalFile(file.localFileId)
    };
    const syncFn = sourceMap[file.sourceType];
    if (syncFn) return syncFn();
    return file.button instanceof HTMLElement ? file.button : null;
  }

  function setActiveTreeFile(sourceType, filePath) {
    const fileName = filePath.split("/").pop() || filePath;
    if (sourceType === "apex") currentApexFileName = fileName;
    else if (sourceType === "apex-trigger") currentApexTriggerFileName = fileName;
    else if (sourceType === "apex-page") currentVisualforcePageFileName = fileName;
    else if (sourceType === "apex-component") currentVisualforceComponentFileName = fileName;
    else if (sourceType === "lightning-message-channel") currentLightningMessageChannelFileName = fileName;
    return fileName;
  }

  function restoreActiveTreeSelection(sourceType) {
    if (sourceType === "apex" && currentApexFileName) return syncActiveTreeSelection({ sourceType: "apex", path: `apex/${currentApexFileName}` });
    if (sourceType === "apex-trigger" && currentApexTriggerFileName) return syncActiveTreeSelection({ sourceType: "apex-trigger", path: `triggers/${currentApexTriggerFileName}` });
    if (sourceType === "apex-page" && currentVisualforcePageFileName) return syncActiveTreeSelection({ sourceType: "apex-page", path: `visualforce/${currentVisualforcePageFileName}` });
    if (sourceType === "apex-component" && currentVisualforceComponentFileName) return syncActiveTreeSelection({ sourceType: "apex-component", path: `visualforce-components/${currentVisualforceComponentFileName}` });
    if (sourceType === "lightning-message-channel" && currentLightningMessageChannelFileName) return syncActiveTreeSelection({ sourceType: "lightning-message-channel", path: `message-channels/${currentLightningMessageChannelFileName}` });
    return null;
  }

  function selectTreeFile(sourceType, primaryName, secondaryName, auraTreeGroup) {
    if (sourceType === "apex") {
      const fileButton = findApexClassNode(primaryName);
      if (fileButton instanceof HTMLElement) {
        fileButton.scrollIntoView({ block: "center", inline: "nearest" });
        fileButton.focus();
        return fileButton;
      }
      return null;
    }
    if (sourceType === "aura") {
      const bundleNode = findAuraComponentNode(primaryName, auraTreeGroup);
      const fileButton = bundleNode?.querySelector(`[data-file-path="${String(secondaryName || "").replace(/"/g, '\\"')}"]`) || null;
      if (fileButton instanceof HTMLElement) {
        fileButton.scrollIntoView({ block: "center", inline: "nearest" });
        fileButton.focus();
        return fileButton;
      }
      return null;
    }
    if (sourceType === "bundle") {
      const bundleNode = findLwcBundleNode(primaryName);
      const fileButton = bundleNode?.querySelector(`[data-file-path="${String(secondaryName || "").replace(/"/g, '\\"')}"]`) || null;
      if (fileButton instanceof HTMLElement) {
        fileButton.scrollIntoView({ block: "center", inline: "nearest" });
        fileButton.focus();
        return fileButton;
      }
      return null;
    }
    const listBySource = { "apex-trigger": treeGroups.trigger.list, "apex-page": treeGroups.vf.list, "apex-component": treeGroups.vfc.list, "lightning-message-channel": treeGroups.lightningMessageChannel.list };
    const treeList = listBySource[sourceType];
    if (treeList) {
      const fileButton = treeList.querySelector(`[data-file-path="${String(primaryName || "").replace(/"/g, '\\"')}"]`) || null;
      if (fileButton instanceof HTMLElement) {
        fileButton.scrollIntoView({ block: "center", inline: "nearest" });
        fileButton.focus();
        return fileButton;
      }
      return null;
    }
    return null;
  }

  function selectLocalFile(fileId) {
    const fileButton = localTreeEl?.querySelector(`[data-local-file-id="${String(fileId || "").replace(/"/g, '\\"')}"]`) || null;
    if (fileButton instanceof HTMLElement) {
      fileButton.scrollIntoView({ block: "center", inline: "nearest" });
      return fileButton;
    }
    return null;
  }

  function syncActiveLocalFile(fileId) {
    if (!developerConsolePreferences.revealActiveFile) return null;
    const localFile = localFilesState.files.find((item) => item.id === fileId);
    if (!localFile) return null;

    activeLocalFolderId = localFile.folderId || null;
    if (localFile.folderId) expandedLocalFolderIds.add(localFile.folderId);
    persistExplorerState();
    renderLocalFilesTree();
    return selectLocalFile(fileId);
  }

  function loadSelectedFileIntoEditor(bundleName, filePath, content) {
    if (!editorReady || !editor) return;
    const nextValue = String(content ?? "");
    const language = getMonacoLanguage(filePath);
    const monaco = window.monaco;
    if (monaco?.editor) {
      const modelKey = `${bundleName}::${filePath}`;
      let model = fileModels.get(modelKey);
      if (!model || model.isDisposed?.()) {
        model = monaco.editor.createModel(nextValue, language);
        fileModels.set(modelKey, model);
      } else if (model.getValue?.() !== nextValue) {
        suppressEditorChange = true;
        model.setValue(nextValue);
        suppressEditorChange = false;
      }
      editorModel = model;
      editor.setModel(editorModel);
      if (editor.getValue?.() !== nextValue) {
        suppressEditorChange = true;
        editor.setValue(nextValue);
        suppressEditorChange = false;
      }
    } else {
      suppressEditorChange = true;
      editor.setValue(nextValue);
      suppressEditorChange = false;
    }
    updateEditorPathLabel(bundleName, filePath);
    queueEditorLayout();
  }

  function updateEditorPathLabel(bundleName, filePath) {
    if (!editorPathEl) return;
    if (editorToolbar) editorToolbar.hidden = false;
    editorPathEl.innerHTML = `<span class="dc-editor-path-bundle">${escapeHtml(bundleName)}</span><span class="dc-editor-path-separator">›</span><span class="dc-editor-path-file">${escapeHtml(filePath)}</span>`;
    editorPathEl.title = `${bundleName} > ${filePath}`;
    const saveButton = body.querySelector('[data-editor-action="save"]');
    const label = selectedFile?.sourceType === "local" ? "Save local file" : "Save and deploy";
    saveButton?.setAttribute("aria-label", label);
    saveButton?.querySelector(".dc-editor-tooltip")?.replaceChildren(label);
  }

  function setEditorStatusToIdle() {
    if (!editorPathEl) return;
    if (editorToolbar) editorToolbar.hidden = true;
    editorPathEl.innerHTML = `<span class="dc-editor-path-bundle">No file selected</span>`;
    editorPathEl.title = "No file selected";
  }

  function renderTabs() {
    if (!tabsEl) return;
    tabsEl.innerHTML = "";
    openFiles.forEach((file) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = `dc-tab${selectedFile?.bundleName === file.bundleName && selectedFile?.path === file.path ? " dc-tab-active" : ""}`;
      const label = escapeHtml(file.path.split("/").pop() || file.path);
      tab.innerHTML = `<span class="dc-tab-icon">${getIconForPath(file.path)}</span><span class="dc-tab-label">${label}</span>${file.dirty ? '<span class="dc-tab-dirty" aria-hidden="true">M</span>' : ''}<span class="dc-tab-close" aria-label="Close ${escapeHtml(file.path)}">×</span>`;
      tab.addEventListener("click", (event) => {
        const closeTarget = event.target.closest(".dc-tab-close");
        if (closeTarget) {
          event.stopPropagation();
          requestCloseTab(file.id);
          return;
        }
        activateTab(file.id);
      });
      tabsEl.appendChild(tab);
    }, sessionApiOrigin);
  }

  function activateTab(fileId) {
    const file = openFiles.find((item) => item.id === fileId);
    if (!file) return;
    selectedFile = file;
    loadSelectedFileIntoEditor(file.bundleName, file.path, file.content);
    currentFileButton?.classList.remove("dc-file-selected");
    currentFileButton = null;
    if (developerConsolePreferences.revealActiveFile && file.sourceType === "apex") {
      currentApexFileName = setActiveTreeFile("apex", file.path);
      currentFileButton = selectTreeFile("apex", currentApexFileName);
    } else if (developerConsolePreferences.revealActiveFile && file.sourceType === "aura") {
      ensureAuraTreeGroupExpanded(file.auraTreeGroup);
      ensureBundleNodeExpanded(file.bundleName, findAuraComponentNode, file.auraTreeGroup);
      currentFileButton = selectTreeFile("aura", file.bundleName, file.path, file.auraTreeGroup);
    } else if (developerConsolePreferences.revealActiveFile && file.sourceType === "bundle") {
      ensureLwcTreeGroupExpanded();
      ensureBundleNodeExpanded(file.bundleName, findLwcBundleNode);
      currentFileButton = selectTreeFile("bundle", file.bundleName, file.path);
    } else if (developerConsolePreferences.revealActiveFile && file.sourceType === "apex-trigger") {
      currentApexTriggerFileName = setActiveTreeFile("apex-trigger", file.path);
      currentFileButton = selectTreeFile("apex-trigger", currentApexTriggerFileName);
    } else if (developerConsolePreferences.revealActiveFile && file.sourceType === "apex-page") {
      currentVisualforcePageFileName = setActiveTreeFile("apex-page", file.path);
      currentFileButton = selectTreeFile("apex-page", currentVisualforcePageFileName);
    } else if (developerConsolePreferences.revealActiveFile && file.sourceType === "apex-component") {
      currentVisualforceComponentFileName = setActiveTreeFile("apex-component", file.path);
      currentFileButton = selectTreeFile("apex-component", currentVisualforceComponentFileName);
    } else if (developerConsolePreferences.revealActiveFile && file.sourceType === "lightning-message-channel") {
      currentLightningMessageChannelFileName = setActiveTreeFile("lightning-message-channel", file.path);
      currentFileButton = selectTreeFile("lightning-message-channel", currentLightningMessageChannelFileName);
    } else if (developerConsolePreferences.revealActiveFile && file.sourceType === "local") {
      currentFileButton = syncActiveLocalFile(file.localFileId);
    }
    if (developerConsolePreferences.revealActiveFile) {
      if (!currentFileButton && file.button instanceof HTMLElement) currentFileButton = file.button;
      currentFileButton?.classList.add("dc-file-selected");
    }
    renderTabs();
  }

  function showWorkspaceReadyState() {
    selectedFile = null;
    currentFileButton?.classList.remove("dc-file-selected");
    currentFileButton = null;
    currentApexFileName = null;
    currentApexTriggerFileName = null;
    currentVisualforcePageFileName = null;
    currentVisualforceComponentFileName = null;
    currentLightningMessageChannelFileName = null;
    setEditorStatusToIdle();
    setEditorValue(defaultEditorValue);
  }

  function closeTab(fileId) {
    const index = openFiles.findIndex((item) => item.id === fileId);
    if (index < 0) return;
    const wasActive = selectedFile?.id === fileId;
    if (comparisonReferenceFileId === fileId) comparisonReferenceFileId = null;
    openFiles.splice(index, 1);
    if (wasActive) {
      const next = openFiles[index] || openFiles[index - 1] || null;
      if (next) {
        activateTab(next.id);
      } else {
        showWorkspaceReadyState();
      }
    }
    renderTabs();
  }

  async function saveSelectedFile() {
    if (!selectedFile) return false;
    if (selectedFile.sourceType === "local") return saveLocalFile();
    if (!sessionId) return false;
    const source = editor?.getValue?.() ?? selectedFile.content ?? "";
    const fileName = selectedFile.path.split("/").pop() || selectedFile.path;
    const bundleType = selectedFile.sourceType === "apex"
      ? "[APEX]"
      : selectedFile.sourceType === "apex-trigger"
        ? "[APEXTRIGGER]"
        : selectedFile.sourceType === "apex-page"
          ? "[VISUALFORCEPAGES]"
          : selectedFile.sourceType === "lightning-message-channel"
            ? "[LIGHTNINGMESSAGECHANNEL]"
          : selectedFile.sourceType === "aura"
            ? `[${treeGroups[selectedFile.auraTreeGroup]?.logTag || "AURACOMPONENT"}]`
            : selectedFile.sourceType === "apex-component"
              ? "[VISUALFORCECOMPONENT]"
              : "[LIGHTNINGWEBCOMPONENT]";
    addLog("INFO", `${bundleType} - ${fileName} - File saving & deploying changes, please wait...`);
    showDeploymentToast("pending");
    try {
      if (selectedFile.sourceType === "apex") {
        await deployApexClassWithContainer(sessionId, selectedFile.apexClassId, selectedFile.path, source);
      } else if (selectedFile.sourceType === "apex-trigger") {
        await deployApexTriggerWithContainer(sessionId, selectedFile.apexTriggerId, selectedFile.path, source);
      } else if (selectedFile.sourceType === "apex-page") {
        await deployApexPageWithContainer(sessionId, selectedFile.apexPageId, selectedFile.path, source);
      } else if (selectedFile.sourceType === "apex-component") {
        await deployApexComponentWithContainer(sessionId, selectedFile.apexComponentId, selectedFile.path, source);
      } else if (selectedFile.sourceType === "lightning-message-channel") {
        await deployLightningMessageChannelSource(sessionId, selectedFile.lightningMessageChannelFullName, source);
      } else if (selectedFile.sourceType === "aura") {
        const auraDeploymentType = resolveAuraDeploymentType(
          selectedFile.path,
          selectedFile.auraDefType,
          selectedFile.auraFormat
        );
        await deployAuraDefinitionSource(sessionId, selectedFile.auraDefinitionBundleId, source, auraDeploymentType.defType, auraDeploymentType.format);
      } else {
        await deployLWCBundleFile(sessionId, selectedFile.bundleName, selectedFile.path, source);
      }
      selectedFile.content = source;
      selectedFile.originalContent = source;
      selectedFile.dirty = false;
      const openFile = openFiles.find((item) => item.id === selectedFile.id);
      if (openFile) {
        openFile.content = source;
        openFile.originalContent = source;
        openFile.dirty = false;
      }
      renderTabs();
      showDeploymentToast("success");
      addLog("SUCCESS", `${bundleType} - ${fileName} - Deployed changes successfully.`);
      return true;
    } catch (error) {
      logDeploymentErrors(error);
      showDeploymentToast("error");
      return false;
    }
  }

  async function getSkipSaveDeployConfirmation() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(skipSaveDeployConfirmationKey);
        return stored?.[skipSaveDeployConfirmationKey] === true;
      }
    } catch {
      // Fall back to asking for confirmation when storage is unavailable.
    }
    return false;
  }

  async function setSkipSaveDeployConfirmation(enabled) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    await chrome.storage.local.set({ [skipSaveDeployConfirmationKey]: Boolean(enabled) });
  }

  async function deploySelectedFileToOrg() {
    await saveSelectedFile();
  }

  async function requestSaveSelectedFile() {
    if (!selectedFile || !selectedFile.dirty) return;
    if (selectedFile.sourceType === "local") {
      await saveLocalFile();
      return;
    }
    if (await getSkipSaveDeployConfirmation()) {
      await deploySelectedFileToOrg();
      return;
    }
    openConfirmSaveModal();
  }

  function openConfirmSaveModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay dc-confirm-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-confirm-modal dc-save-confirm-modal">
        <div class="dc-modal-body">
          <p class="dc-confirm-message">Do you want to save & deploy the changes?</p>
        </div>
        <div class="dc-modal-footer dc-confirm-footer">
          <label class="dc-confirm-skip"><input type="checkbox" data-skip-confirmation /> Don't ask again</label>
          <button type="button" class="dc-button dc-button-primary" data-save>Save & Deploy</button>
          <button type="button" class="dc-button" data-cancel>Cancel</button>
        </div>
      </div>
    `;
    const close = () => overlay.remove();
    const saveButton = overlay.querySelector("[data-save]");
    const skipCheckbox = overlay.querySelector("[data-skip-confirmation]");
    skipCheckbox?.addEventListener("change", () => {
      void setSkipSaveDeployConfirmation(Boolean(skipCheckbox.checked));
    });
    saveButton?.addEventListener("click", async () => {
      if (skipCheckbox?.checked) await setSkipSaveDeployConfirmation(true);
      close();
      await deploySelectedFileToOrg();
    });
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      saveButton?.click();
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    document.body.appendChild(overlay);
    saveButton?.focus();
  }

  async function fetchSelectedFileFromOrg(file) {
    if (!file || !sessionId) return "";
    if (file.sourceType === "local") return "";
    if (file.sourceType === "apex") return fetchApexClassBody(file.apexClassId);
    if (file.sourceType === "apex-trigger") return fetchApexTriggerBody(file.apexTriggerId);
    if (file.sourceType === "apex-page") return fetchVisualforcePageBody(file.apexPageId);
    if (file.sourceType === "apex-component") return fetchVisualforceComponentBody(file.apexComponentId);
    if (file.sourceType === "lightning-message-channel") return fetchLightningMessageChannelSource(file.lightningMessageChannelFullName);
    if (file.sourceType === "aura") {
      const auraType = resolveAuraDeploymentType(file.path, file.auraDefType, file.auraFormat);
      return fetchAuraDefinitionBody(file.bundleName, file.path, auraType.defType, auraType.format);
    }
    return fetchBundleFileContent(file.bundleName, file.path);
  }

  function replaceSelectedFileContent(nextContent) {
    if (!selectedFile) return;
    const content = String(nextContent ?? "");
    selectedFile.content = content;
    selectedFile.originalContent = content;
    selectedFile.dirty = false;
    const openFile = openFiles.find((item) => item.id === selectedFile.id);
    if (openFile) {
      openFile.content = content;
      openFile.originalContent = content;
      openFile.dirty = false;
    }
    suppressEditorChange = true;
    loadSelectedFileIntoEditor(selectedFile.bundleName, selectedFile.path, content);
    suppressEditorChange = false;
    renderTabs();
  }

  async function retrieveSelectedFileFromOrg() {
    if (!selectedFile || selectedFile.sourceType === "local") return;
    try {
      addLog("INFO", `Retrieving ${selectedFile.path} from the org...`);
      const content = await fetchSelectedFileFromOrg(selectedFile);
      replaceSelectedFileContent(content);
      addLog("SUCCESS", `Retrieved ${selectedFile.path} from the org.`);
    } catch (error) {
      addLog("ERROR", `Unable to retrieve ${selectedFile.path}: ${getErrorDetails(error)}`);
    }
  }

  function selectCurrentFileForComparison() {
    if (!selectedFile) return;
    comparisonReferenceFileId = selectedFile.id;
    addLog("INFO", `${selectedFile.path} selected for comparison.`);
  }

  function showSelectedFileComparison() {
    const referenceFile = openFiles.find((file) => file.id === comparisonReferenceFileId) || null;
    const targetFile = selectedFile;
    if (!referenceFile || !targetFile || referenceFile.id === targetFile.id) return;

    const referenceContent = String(referenceFile.content ?? "");
    const targetContent = editor?.getValue?.() ?? targetFile.content ?? "";
    const referenceName = referenceFile.path.split("/").pop() || referenceFile.path;
    const targetName = targetFile.path.split("/").pop() || targetFile.path;
    setTimeout(() => openDiffModal(targetFile, referenceContent, targetContent, {
      title: `Compare with Selected · ${targetFile.path}`,
      originalLabel: `Selected: ${referenceName}`,
      modifiedLabel: `Current: ${targetName}`,
      modelUriScope: "comparison",
      errorLabel: "file comparison"
    }), 0);
  }

  async function showSelectedFileDiffFromOrg() {
    if (!selectedFile || selectedFile.sourceType === "local") return;
    try {
      const orgContent = await fetchSelectedFileFromOrg(selectedFile);
      const localContent = editor?.getValue?.() ?? selectedFile.content ?? "";
      const file = selectedFile;
      // Let Monaco finish closing its context menu before creating another editor.
      setTimeout(() => openDiffModal(file, orgContent, localContent), 0);
    } catch (error) {
      addLog("ERROR", `Unable to compare ${selectedFile.path}: ${getErrorDetails(error)}`);
    }
  }

  function openDiffModal(file, originalContent, modifiedContent, options = {}) {
    const monaco = window.monaco;
    if (!monaco?.editor) {
      addLog("ERROR", "Monaco editor is not available for the comparison.");
      return;
    }
    const title = options.title || `Diff from Org · ${file.path}`;
    const originalLabel = options.originalLabel || "Org";
    const modifiedLabel = options.modifiedLabel || "Selected file";
    const modelUriScope = options.modelUriScope || "org";
    const errorLabel = options.errorLabel || "Diff from Org";
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay dc-diff-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-diff-modal" role="dialog" aria-modal="true" aria-labelledby="dc-diff-title">
        <div class="dc-modal-header">
          <h3 id="dc-diff-title">${escapeHtml(title)}</h3>
          <div class="dc-diff-header-actions" aria-label="Diff navigation">
            <button type="button" class="dc-diff-nav-button" data-diff-next aria-label="Next change" title="Next change" disabled>${iconArrowUp()}</button>
            <button type="button" class="dc-diff-nav-button" data-diff-previous aria-label="Previous change" title="Previous change" disabled>${iconArrowDown()}</button>
            <button type="button" class="dc-modal-close" aria-label="Close comparison">×</button>
          </div>
        </div>
        <div class="dc-diff-legend"><span>${escapeHtml(originalLabel)}</span><span>${escapeHtml(modifiedLabel)}</span></div>
        <div class="dc-diff-container" aria-label="${escapeHtml(`Difference between ${originalLabel} and ${modifiedLabel}`)}"></div>
      </div>
    `;
    let isClosed = false;
    const close = () => {
      if (isClosed) return;
      isClosed = true;
      modifiedModelContentSubscription?.dispose?.();
      diffUpdateSubscription?.dispose?.();
      diffEditor?.setModel?.(null);
      diffEditor?.dispose?.();
      originalModel?.dispose?.();
      modifiedModel?.dispose?.();
      overlay.remove();
      requestAnimationFrame(() => editor?.focus?.());
    };
    let diffEditor = null;
    let originalModel = null;
    let modifiedModel = null;
    let modifiedModelContentSubscription = null;
    let diffUpdateSubscription = null;
    const nextChangeButton = overlay.querySelector("[data-diff-next]");
    const previousChangeButton = overlay.querySelector("[data-diff-previous]");
    const updateDiffNavigation = () => {
      const hasChanges = Boolean(diffEditor?.getLineChanges?.()?.length);
      if (nextChangeButton) nextChangeButton.disabled = !hasChanges;
      if (previousChangeButton) previousChangeButton.disabled = !hasChanges;
    };
    const jumpToDiff = (target) => {
      if (!diffEditor?.getLineChanges?.()?.length) return;
      diffEditor.goToDiff?.(target);
      diffEditor.getModifiedEditor?.().focus?.();
    };
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    nextChangeButton?.addEventListener("click", () => jumpToDiff("next"));
    previousChangeButton?.addEventListener("click", () => jumpToDiff("previous"));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    document.body.appendChild(overlay);
    const container = overlay.querySelector(".dc-diff-container");
    const language = getMonacoLanguage(file.path);
    const uriBase = encodeURIComponent(`${file.bundleName}/${file.path}`);
    try {
      originalModel = monaco.editor.createModel(String(originalContent ?? ""), language, monaco.Uri.parse(`inmemory://${modelUriScope}-original/${uriBase}`));
      modifiedModel = monaco.editor.createModel(String(modifiedContent ?? ""), language, monaco.Uri.parse(`inmemory://${modelUriScope}-modified/${uriBase}`));
      diffEditor = monaco.editor.createDiffEditor(container, {
        automaticLayout: true,
        contextmenu: false,
        readOnly: false,
        originalEditable: false,
        renderSideBySide: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13
      });
      diffEditor.setModel({ original: originalModel, modified: modifiedModel });
      diffUpdateSubscription = diffEditor.onDidUpdateDiff?.(updateDiffNavigation);
      updateDiffNavigation();
      modifiedModelContentSubscription = modifiedModel.onDidChangeContent(() => {
        const nextContent = modifiedModel.getValue();
        const openFile = openFiles.find((item) => item.id === file.id);
        if (!openFile) return;

        openFile.content = nextContent;
        openFile.dirty = nextContent !== String(openFile.originalContent ?? "");
        if (selectedFile?.id === file.id) {
          selectedFile.content = nextContent;
          selectedFile.dirty = openFile.dirty;
        }

        const sourceModel = fileModels.get(`${file.bundleName}::${file.path}`);
        if (sourceModel && !sourceModel.isDisposed?.() && sourceModel.getValue?.() !== nextContent) {
          suppressEditorChange = true;
          sourceModel.setValue(nextContent);
          suppressEditorChange = false;
        }
        renderTabs();
      });
      container.addEventListener(
        "contextmenu",
        (event) => {
          const originalEditor = diffEditor?.getOriginalEditor?.();
          const isOriginalPane = originalEditor?.getDomNode?.()?.contains(event.target);
          openEditorContextMenu(
            event,
            isOriginalPane ? originalEditor : diffEditor?.getModifiedEditor(),
            Boolean(isOriginalPane)
          );
        },
        true
      );
      diffEditor.getModifiedEditor()?.focus?.();
    } catch (error) {
      close();
      addLog("ERROR", `Unable to open ${errorLabel}: ${getErrorDetails(error)}`);
    }
  }

  function showDeploymentToast(state) {
    let toast = body.querySelector(".dc-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "dc-toast";
      body.appendChild(toast);
    }
    const config = {
      pending: { icon: renderToastIcon("pending"), title: "Deploying Source to Org", tone: "pending" },
      success: { icon: renderToastIcon("success"), title: "Source Deployment to Org Success", tone: "success" },
      error: { icon: renderToastIcon("error"), title: "Source Deployment to Org Failed", tone: "error" }
    }[state] || { icon: renderToastIcon("pending"), title: "Deploying Source to Org", tone: "pending" };
    toast.className = `dc-toast dc-toast-${config.tone}`;
    toast.innerHTML = `
      <div class="dc-toast-title"><span class="dc-toast-icon">${config.icon}</span><span>${config.title}</span></div>
      <div class="dc-toast-subtitle">Source: Please refer to the log panel for more details.</div>
    `;
    toast.classList.add("dc-toast-visible");
    clearTimeout(showDeploymentToast._timer);
    if (state !== "pending") {
      showDeploymentToast._timer = setTimeout(() => toast?.classList.remove("dc-toast-visible"), 2600);
    }
  }

  function renderToastIcon(state) {
    if (state === "success") {
      return `
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="10" height="10">
          <path d="M6.4 11.3 2.9 7.8l1.1-1.1 2.4 2.4 5.5-5.5 1.1 1.1-6.6 6.6Z" fill="currentColor"></path>
        </svg>
      `;
    }

    if (state === "error") {
      return `
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="10" height="10">
          <path d="M3.1 2.3 2.3 3.1 7.2 8l-4.9 4.9.8.8L8 8.8l4.9 4.9.8-.8L8.8 8l4.9-4.9-.8-.8L8 7.2 3.1 2.3Z" fill="currentColor"></path>
        </svg>
      `;
    }

    return `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="10" height="10">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm.75 3.25v1.5h-1.5v-1.5h1.5ZM7 7.25h2V12H7V7.25Z" fill="currentColor"></path>
      </svg>
    `;
  }

  function logDeploymentErrors(error) {
    const errors = getDeploymentErrorMessages(error);
    errors.forEach((message) => addLog("ERROR", message));
  }

  function getDeploymentErrorMessages(error) {
    const raw = typeof error === "string" ? tryParseJson(error) : error;
    const deployKind = String(raw?.deployKind || "").toLowerCase();

    if (deployKind === "aura") {
      const auraFailures = getAuraDeploymentFailureMessages(error);
      if (auraFailures.length > 0) return auraFailures;
    }

    const lwcFailures = getLwcDeploymentFailureMessages(error);
    if (lwcFailures.length > 0) return lwcFailures;

    const structuredFailures = getStructuredDeploymentFailureMessages(error);
    if (structuredFailures.length > 0) return structuredFailures;

    const fallbackDetails = raw?.message
      || raw?.Message
      || raw?.errorMessage
      || raw?.ErrorMsg
      || error?.message
      || String(error || "Unknown error - please refresh the page and try again!");
    return [`Deployment failed - ${String(fallbackDetails).replace(/\n+/g, " | ")}`];
  }

  function getLwcDeploymentFailureMessages(error) {
    const raw = typeof error === "string" ? tryParseJson(error) : error;
    const candidates = [];

    const collect = (value) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item) candidates.push(item);
        });
        return;
      }
      if (typeof value === "string") {
        const parsed = tryParseJson(value);
        if (parsed !== value) {
          collect(parsed);
          return;
        }
      }
      candidates.push(value);
    };

    collect(raw?.payload);
    collect(raw?.responsePayload);
    collect(raw?.responseBody);
    collect(raw?.rawText);

    return candidates
      .map((item) => formatLwcDeploymentError(item))
      .filter(Boolean);
  }

  function getAuraDeploymentFailureMessages(error) {
    const raw = typeof error === "string" ? tryParseJson(error) : error;
    const candidates = [];

    const collect = (value) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item) candidates.push(item);
        });
        return;
      }
      if (typeof value === "string") {
        const parsed = tryParseJson(value);
        if (parsed !== value) {
          collect(parsed);
          return;
        }
      }
      candidates.push(value);
    };

    collect(raw?.payload);
    collect(raw?.responsePayload);
    collect(raw?.responseBody);
    collect(raw?.rawText);

    return candidates.flatMap((item) => formatAuraDeploymentError(item)).filter(Boolean);
  }

  function getStructuredDeploymentFailureMessages(error) {
    const raw = typeof error === "string" ? tryParseJson(error) : error;
    const messages = [];
    const pushMessage = (value) => {
      const message = String(value || "").trim();
      if (message) messages.push(message);
    };

    if (Array.isArray(raw?.failureMessages)) {
      raw.failureMessages.forEach(pushMessage);
    }

    const deployDetails = raw?.deployDetailsRaw || raw?.DeployDetails || raw?.deployDetails || raw?.details || raw?.request?.DeployDetails || raw?.request?.deployDetails || raw?.request?.details;
    const details = typeof deployDetails === "string" ? tryParseJson(deployDetails) : deployDetails;
    const failures = details?.componentFailures;
    if (Array.isArray(failures) && failures.length > 0) {
      failures.forEach((failure) => {
        pushMessage(formatDeploymentFailureMessage(failure, details?.message || raw?.requestMessage || raw?.request?.message || raw?.message || raw?.ErrorMsg || raw?.errorMessage));
      });
    }

    if (messages.length > 0) {
      return [...new Set(messages)];
    }

    return [];
  }

  function getContainerAsyncRequestFailureMessages(request) {
    const deployDetails = request?.DeployDetails || request?.deployDetails || request?.details;
    const details = typeof deployDetails === "string" ? tryParseJson(deployDetails) : deployDetails;
    const failures = details?.componentFailures;

    if (!Array.isArray(failures) || failures.length === 0) return [];

    return failures
      .map((failure) => formatDeploymentFailureMessage(failure, details?.message || request?.message || request?.Message || request?.ErrorMsg || request?.errorMessage))
      .filter(Boolean);
  }

  function formatDeploymentFailureMessage(failure, fallbackProblem) {
    if (!failure) return "";
    const fileName = failure.fileName || failure.fullName || failure.componentType || "Apex";
    const problem = failure.problem || failure.errorMessage || failure.message || fallbackProblem || "Apex deployment failed.";
    const lineNumber = failure.lineNumber ?? failure.line ?? failure.LineNumber;
    const columnNumber = failure.columnNumber ?? failure.column ?? failure.ColumnNumber;
    const locationParts = [];

    if (lineNumber) locationParts.push(`line ${lineNumber}`);
    if (columnNumber) locationParts.push(`column ${columnNumber}`);

    return `Deployment failed - ${[fileName, locationParts.join(", "), problem].filter(Boolean).join(" | ")}`;
  }

  function formatLwcDeploymentError(details) {
    if (!details) return "";

    const record = typeof details === "string" ? { message: details } : details;
    const errorCode = String(record?.errorCode || record?.ErrorCode || record?.code || "").trim();
    const fields = Array.isArray(record?.fields) ? record.fields.map((field) => String(field || "").trim()).filter(Boolean) : [];
    const rawMessage = String(record?.message || record?.Message || record?.errorMessage || record?.detail || record?.details || "").trim();
    const message = rawMessage.replace(/\r\n/g, "\n");

    if (!message && !errorCode) return "";

    const lines = message
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return errorCode ? `Deployment failed - ${errorCode}` : "";
    }

    const firstLine = lines[0];
    const secondLine = lines[1] || "";
    const firstLineMatch = firstLine.match(/Invalid reference\s+([A-Za-z0-9_.$]+)\s+of type\s+([A-Za-z0-9_.$]+)(?:\s+in file\s+([^|]+))?/i)
      || firstLine.match(/Cannot reference\s+([A-Za-z0-9_.$]+)\s+of type\s+([A-Za-z0-9_.$]+)(?:\s+in file\s+([^|]+))?/i);
    const secondLineMatch = secondLine.match(/^([^:]+):(\d+),(\d+)\s*:\s*([A-Z0-9_]+):\s*(.+)$/i)
      || secondLine.match(/^(.+?)\s*:\s*([A-Z0-9_]+):\s*(.+)$/i);

    if (firstLineMatch) {
      const [, referenceName, referenceType, fileName] = firstLineMatch;
      const friendlyFile = fileName ? fileName.trim() : "Lightning Web Component";
      const friendlyType = referenceType.replace(/^sobjectField$/i, "Salesforce field");
      return `LWC deployment failed in ${friendlyFile}: ${referenceName} is not a valid ${friendlyType} reference. Check the component markup or JavaScript for a misspelled API name, missing import, or field that is not exposed to the component.`;
    }

    const formattedLines = [];
    if (errorCode) formattedLines.push(errorCode);
    if (fields.length > 0) formattedLines.push(`Fields: ${fields.join(", ")}`);

    if (firstLine.toLowerCase().includes("compilation failure")) {
      formattedLines.push(firstLine);
      if (secondLineMatch) {
        const filePart = secondLineMatch[1].trim();
        const code = secondLineMatch[4] || secondLineMatch[2] || "";
        const detail = secondLineMatch[5] || secondLineMatch[3] || "";
        const location = secondLineMatch[2] && secondLineMatch[3]
          ? `${filePart}:${secondLineMatch[2]},${secondLineMatch[3]}`
          : filePart;
        if (location) formattedLines.push(location);
        if (code || detail) formattedLines.push([code, detail].filter(Boolean).join(": "));
      } else if (secondLine) {
        formattedLines.push(secondLine);
      }
    } else {
      formattedLines.push(...lines);
    }

    return `Deployment failed - ${formattedLines.filter(Boolean).join(" | ")}`;
  }

  function formatAuraDeploymentError(details) {
    if (!details) return [];

    const record = typeof details === "string" ? { message: details } : details;
    const errorCode = String(record?.errorCode || record?.ErrorCode || record?.code || "").trim();
    const fields = Array.isArray(record?.fields) ? record.fields.map((field) => String(field || "").trim()).filter(Boolean) : [];
    const rawMessage = String(record?.message || record?.Message || record?.errorMessage || record?.detail || record?.details || "").trim();
    const message = rawMessage.replace(/\r\n/g, "\n");

    if (!message && !errorCode) return [];

    const lines = message
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const formattedLines = [];
    if (errorCode) formattedLines.push(errorCode);
    if (fields.length > 0) formattedLines.push(`Fields: ${fields.join(", ")}`);

    lines.forEach((line) => {
      const parseErrorMatch = line.match(/^ParseError\s+at\s+\[row,col\]:\[(\d+),(\d+)\]$/i);
      if (parseErrorMatch) {
        formattedLines.push(`ParseError at [row,col]:[${parseErrorMatch[1]},${parseErrorMatch[2]}]`);
        return;
      }

      const messageMatch = line.match(/^Message:\s*(.+)$/i);
      if (messageMatch) {
        formattedLines.push(`Message: ${messageMatch[1].trim()}`);
        return;
      }

      formattedLines.push(line);
    });

    return [`Deployment failed - ${formattedLines.filter(Boolean).join(" | ")}`];
  }

  function tryParseJson(value) {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function requestCloseTab(fileId) {
    const file = openFiles.find((item) => item.id === fileId);
    if (!file) return;
    if (!file.dirty) {
      closeTab(fileId);
      return;
    }
    openConfirmCloseModal(file);
  }

  function openConfirmCloseModal(file) {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay dc-confirm-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-confirm-modal dc-close-confirm-modal">
        <div class="dc-modal-body">
          <p class="dc-confirm-message">${escapeHtml(file.path.split("/").pop() || file.path)} is modified, do you want to close?</p>
        </div>
        <div class="dc-modal-footer dc-confirm-footer">
          <button type="button" class="dc-button dc-button-primary" data-yes>Yes</button>
          <button type="button" class="dc-button" data-no>No</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector("[data-yes]")?.addEventListener("click", () => {
      close();
      closeTab(file.id);
    });
    overlay.querySelector("[data-no]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    document.body.appendChild(overlay);
  }

  async function openFileInEditor(bundleName, filePath, content) {
    let nextContent = content;
    if (nextContent == null || nextContent === "") {
      nextContent = await fetchBundleFileContent(bundleName, filePath);
    }
    const existing = openFiles.find((file) => file.bundleName === bundleName && file.path === filePath);
    if (existing) {
      activateTab(existing.id);
      currentFileButton?.classList.remove("dc-file-selected");
      currentFileButton = syncActiveTreeSelection(existing);
      currentFileButton?.classList.add("dc-file-selected");
      return;
    }
    const fileId = `${bundleName}::${filePath}`;
    openFiles.push({ id: fileId, button: null, bundleName, path: filePath, content: String(nextContent ?? ""), originalContent: String(nextContent ?? ""), dirty: false, sourceType: "bundle" });
    renderTabs();
    activateTab(fileId);
    currentFileButton?.classList.remove("dc-file-selected");
    currentFileButton = syncActiveTreeSelection(openFiles.find((file) => file.id === fileId));
    currentFileButton?.classList.add("dc-file-selected");
  }

  async function openAuraFileInEditor(bundleName, filePath, content, defType, format, auraTreeGroup, auraDefinitionBundleId = null) {
    let nextContent = content;
    if (nextContent == null || nextContent === "") {
      nextContent = await fetchAuraDefinitionBody(bundleName, filePath, defType, format);
    }
    const existing = openFiles.find((file) => file.bundleName === bundleName && file.path === filePath);
    if (existing) {
      existing.content = String(nextContent ?? "");
      existing.originalContent = String(nextContent ?? "");
      existing.dirty = false;
      existing.auraDefType = defType || existing.auraDefType || "";
      existing.auraFormat = format || existing.auraFormat || "";
      existing.auraTreeGroup = auraTreeGroup || existing.auraTreeGroup || findAuraTreeGroupKey(bundleName);
      activateTab(existing.id);
      currentFileButton = syncActiveTreeSelection(existing);
      currentFileButton?.classList.add("dc-file-selected");
      return;
    }
    const fileId = `${bundleName}::${filePath}`;
    const resolvedAuraTreeGroup = auraTreeGroup || findAuraTreeGroupKey(bundleName);
    const bundleRecord = findAuraBundleRecord(bundleName, resolvedAuraTreeGroup);
    openFiles.push({ id: fileId, button: null, bundleName, path: filePath, content: String(nextContent ?? ""), originalContent: String(nextContent ?? ""), dirty: false, sourceType: "aura", auraDefinitionBundleId: bundleRecord?.Id || auraDefinitionBundleId || null, auraDefType: defType || "", auraFormat: format || "", auraTreeGroup: resolvedAuraTreeGroup || "aura" });
    renderTabs();
    activateTab(fileId);
    currentFileButton = syncActiveTreeSelection(openFiles.find((file) => file.id === fileId));
    currentFileButton?.classList.add("dc-file-selected");
  }

  async function fetchBundleFileContent(bundleName, filePath) {
    if (!sessionId) return "";
    const safeName = String(bundleName || "").replace(/'/g, "\\'");
    const safePath = String(filePath || "").replace(/'/g, "\\'");
    const query = `SELECT Source FROM LightningComponentResource WHERE LightningComponentBundle.DeveloperName = '${safeName}' AND FilePath = '${safePath}' LIMIT 1`;
    const payload = await callToolingApi(sessionId, query, sessionApiOrigin);
    return payload.records?.[0]?.Source ?? "";
  }
  async function fetchAuraDefinitionBody(bundleName, filePath, defTypeArg, formatArg) {
    if (!sessionId) return "";
    const safeName = String(bundleName || "").replace(/'/g, "\\'");
    const safePath = String(filePath || "").replace(/\\/g, "/").trim();
    const defType = String(defTypeArg || safePath.split(".")[0] || "").trim();
    const format = String(formatArg || (safePath.includes(".") ? safePath.split(".").slice(1).join(".") : "") || "").trim();
    const queries = [
      `SELECT Source, DefType, Format FROM AuraDefinition WHERE AuraDefinitionBundle.DeveloperName = '${safeName}' AND DefType = '${defType}'${format ? ` AND Format = '${format}'` : ""} LIMIT 1`,
      `SELECT Source, DefType, Format FROM AuraDefinition WHERE AuraDefinitionBundle.DeveloperName = '${safeName}' ORDER BY DefType, Format, Id LIMIT 1`
    ];
    for (let index = 0; index < queries.length; index += 1) {
      const query = queries[index];
      const payload = await callToolingApi(sessionId, query, sessionApiOrigin);
      const record = payload.records?.[0];
      const source = String(record?.Source ?? "");
      if (source) return source;
    }
    return "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getIconForPath(name) {
    if (/\.html?$/i.test(name)) return "◫";
    if (/\.js$/i.test(name)) return "{}";
    if (/\.css$/i.test(name)) return "≋";
    if (/\.xml$/i.test(name)) return "<>";
    if (/\.(json|txt|md)$/i.test(name)) return "•";
    return "◦";
  }

  function iconRefresh() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 6.5A5.2 5.2 0 1 0 13.2 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13 2.8v3.8H9.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function iconMoreVertical() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="3.25" r="1.15" fill="currentColor"/><circle cx="8" cy="8" r="1.15" fill="currentColor"/><circle cx="8" cy="12.75" r="1.15" fill="currentColor"/></svg>`;
  }

  function iconWarning() {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.7 3.2 1.9 15a1.4 1.4 0 0 0 1.2 2.1h13.8a1.4 1.4 0 0 0 1.2-2.1L11.3 3.2a1.5 1.5 0 0 0-2.6 0Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 7.1v4.3M10 14.2v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }

  function iconArrowUp() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 9.3 3.5-3.5 3.5 3.5M8 6v6.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function iconArrowDown() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.7 3.5 3.5 3.5-3.5M8 10v-6.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function closeExplorerActionsMenu() {
    explorerActionsMenu?.remove();
    explorerActionsMenu = null;
    explorerActionsMenuTrigger = null;
    if (explorerActionsMenuDismiss) {
      document.removeEventListener("pointerdown", explorerActionsMenuDismiss, true);
      window.removeEventListener("resize", explorerActionsMenuDismiss);
      window.removeEventListener("scroll", explorerActionsMenuDismiss, true);
      explorerActionsMenuDismiss = null;
    }
  }

  function openExplorerActionsMenu(trigger, actions = []) {
    if (!(trigger instanceof HTMLElement) || !actions.length) return;
    if (explorerActionsMenuTrigger === trigger) {
      closeExplorerActionsMenu();
      return;
    }
    closeExplorerActionsMenu();

    const menu = document.createElement("div");
    menu.className = "dc-explorer-actions-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = actions.map((action, index) => `
      <button type="button" class="dc-explorer-action${action.destructive ? " dc-explorer-action-danger" : ""}" data-explorer-action="${index}" role="menuitem">
        <span class="dc-explorer-action-icon" aria-hidden="true">${action.icon || ""}</span>
        <span>${escapeHtml(action.label)}</span>
      </button>
    `).join("");
    menu.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-explorer-action]");
      if (!actionButton) return;
      const action = actions[Number(actionButton.getAttribute("data-explorer-action"))];
      closeExplorerActionsMenu();
      action?.onSelect?.();
    });
    document.body.appendChild(menu);
    explorerActionsMenu = menu;
    explorerActionsMenuTrigger = trigger;

    const triggerRect = trigger.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    const left = Math.max(8, Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const top = Math.min(triggerRect.bottom + 5, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(8, top)}px`;

    explorerActionsMenuDismiss = (event) => {
      if (event?.target && (menu.contains(event.target) || trigger.contains(event.target))) return;
      closeExplorerActionsMenu();
    };
    window.setTimeout(() => {
      if (!explorerActionsMenuDismiss) return;
      document.addEventListener("pointerdown", explorerActionsMenuDismiss, true);
      window.addEventListener("resize", explorerActionsMenuDismiss);
      window.addEventListener("scroll", explorerActionsMenuDismiss, true);
    }, 0);
  }

  function iconFolderAdd() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 4.5c0-.7.5-1.2 1.2-1.2h3l1.2 1.4h5.8c.7 0 1.2.5 1.2 1.2v5.8c0 .7-.5 1.2-1.2 1.2H3c-.7 0-1.2-.5-1.2-1.2z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/><path d="M9.5 7.2v3.2M7.9 8.8h3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  }

  function iconFileAdd() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h5l3 3v8.4c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1v-10.4c0-.6.4-1 1-1z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/><path d="M9 1.8v3h3M8 7.4v3.2M6.4 9h3.2" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>`;
  }

  function iconImport() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h10v11H3z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/><path d="M8 10.7V4.5M5.8 6.7 8 4.5l2.2 2.2M5.2 12h5.6" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function iconDownload() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2v7.1M5.6 6.9 8 9.3l2.4-2.4M3 11.7v1.5h10v-1.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function iconTrash() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6.2 2.5h3.6M5.1 4.5l.5 8h4.8l.5-8M7 6.6v3.8M9 6.6v3.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function iconRename() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 11.8 1.1-3.1 6.5-6.5 2.8 2.8-6.5 6.5zM9.7 3l2.8 2.8" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function iconFormat() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10v2H3zM3 7h6v2H3zM3 11h10v2H3z" fill="currentColor"/></svg>`;
  }

  function iconSave() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h7l3 3v9H3z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 2v4h5V2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 12h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  }

  function iconWordWrap() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h8a2 2 0 010 4H6.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M6.5 6.5L4.5 8.5 6.5 10.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12h7.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  }

  function iconCommandPalette() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10v8H3z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 7h6M5 9h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  }

  function iconMinimap() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h3v10H3zM7 3h2v10H7zM10 3h3v10h-3z" fill="currentColor"/></svg>`;
  }

  function iconZoomIn() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M12 12l-2.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7 5.4v3.2M5.4 7h3.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  }

  function iconZoomOut() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M12 12l-2.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5.4 7h3.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  }

  function iconFullscreen() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function initEditor(monaco) {
    if (!editorContainer) return;

    editor = monaco.editor.create(editorContainer, {
      value: defaultEditorValue,
      language: "plaintext",
      theme: document.documentElement.classList.contains("dark-theme") ? "vs-dark" : "vs-light",
      automaticLayout: true,
      minimap: { enabled: editorMinimapEnabled },
      fontSize: editorFontSize,
      lineNumbers: developerConsolePreferences.lineNumbers ? "on" : "off",
      scrollBeyondLastLine: false,
      wordWrap: editorWordWrap,
      tabSize: developerConsolePreferences.tabSize,
      insertSpaces: developerConsolePreferences.insertSpaces,
      renderWhitespace: developerConsolePreferences.renderWhitespace,
      formatOnPaste: developerConsolePreferences.formatOnPaste,
      formatOnType: developerConsolePreferences.formatOnType,
      contextmenu: false,
      readOnly: false
    });
    const applyEditorTheme = (theme) => {
      const dark = theme === "dark";
      document.documentElement.classList.toggle("dark-theme", dark);
      if (editor) monaco.editor.setTheme(dark ? "vs-dark" : "vs-light");
    };
    void getStoredTheme().then(applyEditorTheme);
    const themeChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(themeBroadcastChannel) : null;
    themeChannel?.addEventListener("message", (event) => {
      if (event.data?.type === "theme") applyEditorTheme(event.data.theme === "dark" ? "dark" : "light");
    });
    chrome.storage?.onChanged?.addListener((changes, areaName) => {
      if (areaName === "local" && changes["lc-theme"] && editor) {
        applyEditorTheme(changes["lc-theme"].newValue === "dark" ? "dark" : "light");
      }
      if (areaName === "local" && Object.prototype.hasOwnProperty.call(changes, localFilesStorageKey)) {
        const incomingLocalFilesState = normalizeLocalFilesState(changes[localFilesStorageKey]?.newValue);
        if (isSameLocalFilesState(incomingLocalFilesState, localFilesState)) return;
        localFilesState = incomingLocalFilesState;
        if (!localFilesState.folders.some((folder) => folder.id === activeLocalFolderId)) {
          activeLocalFolderId = null;
        }
        const remainingFileIds = new Set(localFilesState.files.map((file) => file.id));
        const removedFileIds = openFiles
          .filter((file) => file.sourceType === "local" && !remainingFileIds.has(file.localFileId))
          .map((file) => file.localFileId);
        if (removedFileIds.length) removeOpenLocalFiles(removedFileIds);
        renderLocalFilesTree();
      }
    });
    editorReady = true;
    editor.onDidChangeModelContent(() => {
      if (suppressEditorChange || !selectedFile) return;
      const nextValue = editor.getValue();
      selectedFile.content = nextValue;
      const openFile = openFiles.find((item) => item.id === selectedFile.id);
      if (openFile) {
        openFile.content = nextValue;
        openFile.dirty = nextValue !== String(openFile.originalContent ?? "");
        selectedFile.dirty = openFile.dirty;
      }
      if (selectedFile.sourceType === "local" && selectedFile.localFileId) {
        const localFile = localFilesState.files.find((file) => file.id === selectedFile.localFileId);
        if (localFile) {
          localFile.content = nextValue;
          void persistLocalFilesState();
        }
      }
      renderTabs();
      if (isActiveLwcFile(editor.getModel(), [".js"])) {
        const line = editor.getModel().getLineContent(editor.getPosition().lineNumber).slice(0, editor.getPosition().column - 1).toLowerCase();
        if (/^(l|lw|lwc|lwc:|@)$/.test(line) || /\b(l|lw|lwc|lwc:|@)$/.test(line)) {
          editor.trigger('lwc-autocomplete', 'editor.action.triggerSuggest', {});
        }
      }
      if (isActiveAuraFile(editor.getModel(), [".js"])) {
        const line = editor.getModel().getLineContent(editor.getPosition().lineNumber).slice(0, editor.getPosition().column - 1).toLowerCase();
        if (/^(a|au|aur|aura|aura:|\$a|cmp|cmp:)$/i.test(line.trim()) || /\b(aura:|\$a|cmp:)$/.test(line)) {
          editor.trigger('aura-autocomplete', 'editor.action.triggerSuggest', {});
        }
      }
    });

    const fullscreenToggleLabel = {
      enter: { aria: "Enter fullscreen", title: "Enter fullscreen" },
      exit: { aria: "Exit fullscreen", title: "Exit fullscreen" }
    };

    function updateFullscreenButtonState() {
      const button = body.querySelector("[data-fullscreen-toggle]");
      if (!button) return;
      const isFullscreen = Boolean(document.fullscreenElement);
      const label = isFullscreen ? fullscreenToggleLabel.exit : fullscreenToggleLabel.enter;
      button.setAttribute("aria-label", label.aria);
      const tooltip = button.querySelector(".dc-editor-tooltip");
      if (tooltip) tooltip.textContent = label.title;
    }

    async function toggleFullscreenMode() {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // ignore fullscreen failures
      }
    }

    function toggleEditorWordWrap() {
      editorWordWrap = editorWordWrap === "on" ? "off" : "on";
      editor?.updateOptions?.({ wordWrap: editorWordWrap });
      persistDeveloperConsolePreferences({ wordWrap: editorWordWrap });
    }

    function toggleEditorMinimap() {
      editorMinimapEnabled = !editorMinimapEnabled;
      editor?.updateOptions?.({ minimap: { enabled: editorMinimapEnabled } });
      persistDeveloperConsolePreferences({ minimap: editorMinimapEnabled });
    }

    function adjustEditorZoom(delta) {
      editorFontSize = Math.max(10, Math.min(24, editorFontSize + delta));
      editor?.updateOptions?.({ fontSize: editorFontSize });
      persistDeveloperConsolePreferences({ fontSize: editorFontSize });
    }

    function openCommandPalette() {
      editor?.focus?.();
      const quickCommand = editor?.getAction?.("editor.action.quickCommand");
      if (quickCommand?.run) return quickCommand.run();
      const showCommands = editor?.getAction?.("editor.action.showCommands");
      if (showCommands?.run) return showCommands.run();
      return editor?.trigger?.("dc-toolbar", "editor.action.quickCommand", {});
    }

    async function formatActiveDocument() {
      await editor.getAction?.("editor.action.formatDocument")?.run?.();
    }

    editor.addAction({
      id: "lightning-connect.deploy-to-org",
      label: "Deploy to Org",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => requestSaveSelectedFile()
    });
    editor.addAction({
      id: "lightning-connect.retrieve-from-org",
      label: "Retrieve from Org",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR],
      run: () => retrieveSelectedFileFromOrg()
    });
    editor.addAction({
      id: "lightning-connect.diff-from-org",
      label: "Diff from Org",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD],
      run: () => showSelectedFileDiffFromOrg()
    });

    editorContainer?.addEventListener(
      "contextmenu",
      (event) => openEditorContextMenu(event, editor, false),
      true
    );

    const toolbarActions = body.querySelector(".dc-editor-toolbar");
    toolbarActions?.addEventListener("click", async (event) => {
      const button = event.target.closest?.("[data-editor-action]");
      if (!button) return;
      const action = button.getAttribute("data-editor-action");
      if (action === "save") return requestSaveSelectedFile();
      if (action === "format") return formatActiveDocument();
      if (action === "word-wrap") return toggleEditorWordWrap();
      if (action === "palette") return openCommandPalette();
      if (action === "minimap") return toggleEditorMinimap();
      if (action === "zoom-in") return adjustEditorZoom(1);
      if (action === "zoom-out") return adjustEditorZoom(-1);
      if (action === "fullscreen") return toggleFullscreenMode();
    });

    document.addEventListener("fullscreenchange", updateFullscreenButtonState);
    updateFullscreenButtonState();
    // Keep the file actions available even when the editor does not own the key event.
    document.addEventListener("keydown", (event) => {
      const key = String(event.key || event.code || "").toLowerCase();
      const hasCommandModifier = event.ctrlKey || event.metaKey;
      const isSaveShortcut = hasCommandModifier && !event.shiftKey && key === "s";
      const isRetrieveShortcut = hasCommandModifier && event.shiftKey && key === "r";
      const isDiffShortcut = hasCommandModifier && event.shiftKey && key === "d";
      if (!isSaveShortcut && !isRetrieveShortcut && !isDiffShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      if (isSaveShortcut) {
        void requestSaveSelectedFile();
      } else if (isRetrieveShortcut) {
        void retrieveSelectedFileFromOrg();
      } else if (isDiffShortcut) {
        void showSelectedFileDiffFromOrg();
      }
    }, true);

    // Disable common developer tools keyboard shortcuts
    document.addEventListener("keydown", (event) => {
      const key = String(event.key || "").toLowerCase();
      const code = String(event.code || "").toLowerCase();
      const isDevtoolsShortcut =
        key === "f12" ||
        (event.ctrlKey && event.shiftKey && (key === "i" || key === "j" || code === "keyi" || code === "keyj")) ||
        (event.ctrlKey && !event.shiftKey && (key === "u" || code === "keyu"));

      if (!isDevtoolsShortcut) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }, true);

    queueEditorLayout();
    if (selectedFile) {
      loadSelectedFileIntoEditor(selectedFile.bundleName, selectedFile.path, selectedFile.content);
    }
  }

  function queueEditorLayout() {
    if (!editor?.layout) return;
    requestAnimationFrame(() => {
      try {
        editor.layout();
      } catch {
        // no-op: layout is best-effort for container sizing changes
      }
    });
  }

  async function loadMonaco() {
    if (window.monaco?.editor) return window.monaco;
    const monaco = await import("monaco-editor");
    window.monaco = monaco;
    window.MonacoEnvironment = {
      getWorker(_, label) {
        if (label === "json") return new JsonWorker();
        if (label === "css") return new CssWorker();
        if (label === "html") return new HtmlWorker();
        if (label === "typescript" || label === "javascript") return new TsWorker();
        return new EditorWorker();
      }
    };
    registerCompletionProviders(monaco);
    return monaco;
  }

  function registerCompletionProviders(monaco) {
    if (!monaco?.languages || registerCompletionProviders.registered) return;
    registerCompletionProviders.registered = true;

    monaco.languages.registerCompletionItemProvider(["html"], {
      triggerCharacters: ["<", " ", "=", '"', "'"],
      provideCompletionItems: (model, position) => {
        if (isActiveLwcFile(model, [".html"])) return provideLwcHtmlCompletions(monaco, model, position);
        if (isActiveAuraFile(model, [".cmp", ".app", ".evt", ".intf", ".design", ".auradoc", ".tokens"])) {
          return provideAuraMarkupCompletions(monaco, model, position);
        }
        return { suggestions: [] };
      }
    });

    monaco.languages.registerCompletionItemProvider(["javascript", "typescript"], {
      triggerCharacters: ["@", ".", ":", "l", "w", "c"],
      provideCompletionItems: (model, position) => {
        if (isActiveLwcFile(model, [".js"])) return provideLwcJsCompletions(monaco, model, position);
        if (isActiveAuraFile(model, [".js"])) return provideAuraJavaScriptCompletions(monaco, model, position);
        return { suggestions: [] };
      }
    });

    monaco.languages.registerCompletionItemProvider(["css"], {
      triggerCharacters: [".", ":", "{", "s", "l", "d"],
      provideCompletionItems: (model, position) => {
        if (isActiveLwcFile(model, [".css"])) return provideLwcCssCompletions(monaco, model, position);
        if (isActiveAuraFile(model, [".css"])) return provideAuraCssCompletions(monaco, model, position);
        return { suggestions: [] };
      }
    });

    monaco.languages.registerCompletionItemProvider(["apex"], {
      triggerCharacters: [".", "(", ":"],
      provideCompletionItems: (model, position) => (
        isActiveApexFile(model)
          ? provideApexCompletions(monaco, model, position)
          : { suggestions: [] }
      )
    });

    monaco.languages.registerCompletionItemProvider(["xml"], {
      triggerCharacters: ["<", ":", "l", "w", "c"],
      provideCompletionItems: (model, position) => (
        isActiveLwcFile(model, [".js-meta.xml"])
          ? provideLwcXmlCompletions(monaco, model, position)
          : { suggestions: [] }
      )
    });
  }

  function isActiveCompletionFile(model, sourceType, extensions) {
    if (!selectedFile || selectedFile.sourceType !== sourceType || editor?.getModel?.() !== model) return false;
    const path = String(selectedFile.path || "").toLowerCase();
    return extensions.some((extension) => path.endsWith(extension));
  }

  function isActiveLwcFile(model, extensions) {
    return isActiveCompletionFile(model, "bundle", extensions);
  }

  function isActiveAuraFile(model, extensions) {
    return isActiveCompletionFile(model, "aura", extensions);
  }

  function isActiveApexFile(model) {
    if (!selectedFile || editor?.getModel?.() !== model) return false;
    return /\.(cls|trigger)$/i.test(String(selectedFile.path || ""));
  }

  function provideLwcHtmlCompletions(monaco, model, position) {
    const text = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column }).toLowerCase();
    const tag = (text.match(/<\s*(lightning-[a-z0-9-]*)?$/) || [])[1] || "";
    const base = [
      { label: "lightning-button", detail: "LWC base component", insertText: `<lightning-button label="${'${1:Label}'}" onclick={${'${2:handleClick}'}}></lightning-button>` },
      { label: "lightning-input", detail: "LWC base component", insertText: `<lightning-input label="${'${1:Label}'}" value={${'${2:value}'}} onchange={${'${3:handleChange}'}}></lightning-input>` },
      { label: "lightning-card", detail: "LWC base component", insertText: `<lightning-card title="${'${1:Title}'}">\n  ${'${2:Content}'}\n</lightning-card>` },
      { label: "lightning-combobox", detail: "LWC base component", insertText: `<lightning-combobox label="${'${1:Label}'}" value={${'${2:value}'}} options={${'${3:options}'}}></lightning-combobox>` },
      { label: "lightning-record-form", detail: "LWC base component", insertText: `<lightning-record-form object-api-name="${'${1:ObjectApiName}'}" record-id={${'${2:recordId}'}}></lightning-record-form>` },
      { label: "lightning-record-edit-form", detail: "LWC base component", insertText: `<lightning-record-edit-form object-api-name="${'${1:ObjectApiName}'}" record-id={${'${2:recordId}'}} onsubmit={${'${3:handleSubmit}'}} onsuccess={${'${4:handleSuccess}'}} onerror={${'${5:handleError}'}}></lightning-record-edit-form>` },
      { label: "lightning-record-view-form", detail: "LWC base component", insertText: `<lightning-record-view-form record-id={${'${1:recordId}'}} object-api-name="${'${2:ObjectApiName}'}"></lightning-record-view-form>` },
      { label: "lightning-input-field", detail: "LWC base component", insertText: `<lightning-input-field field-name="${'${1:FieldName}'}"></lightning-input-field>` },
      { label: "lightning-output-field", detail: "LWC base component", insertText: `<lightning-output-field field-name="${'${1:FieldName}'}"></lightning-output-field>` },
      { label: "lightning-textarea", detail: "LWC base component", insertText: `<lightning-textarea label="${'${1:Label}'}" value={${'${2:value}'}} onchange={${'${3:handleChange}'}}></lightning-textarea>` },
      { label: "lightning-checkbox", detail: "LWC base component", insertText: `<lightning-checkbox label="${'${1:Label}'}" checked={${'${2:checked}'}} onchange={${'${3:handleChange}'}}></lightning-checkbox>` },
      { label: "lightning-radio-group", detail: "LWC base component", insertText: `<lightning-radio-group label="${'${1:Label}'}" options={${'${2:options}'}} value={${'${3:value}'}} onchange={${'${4:handleChange}'}}></lightning-radio-group>` },
      { label: "lightning-slider", detail: "LWC base component", insertText: `<lightning-slider label="${'${1:Label}'}" value={${'${2:value}'}} min="${'${3:0}'}" max="${'${4:100}'}" onchange={${'${5:handleChange}'}}></lightning-slider>` },
      { label: "lightning-tabset", detail: "LWC base component", insertText: `<lightning-tabset variant="${'${1:standard}'}">\n  <lightning-tab label="${'${2:Tab 1}'}">${'${3:Content}'}</lightning-tab>\n</lightning-tabset>` },
      { label: "lightning-accordion", detail: "LWC base component", insertText: `<lightning-accordion allow-multiple-sections-open>\n  <lightning-accordion-section name="${'${1:section1}'}" label="${'${2:Section 1}'}">${'${3:Content}'}</lightning-accordion-section>\n</lightning-accordion>` },
      { label: "lightning-vertical-navigation", detail: "LWC base component", insertText: `<lightning-vertical-navigation selected-item="${'${1:item1}'}">\n  <lightning-vertical-navigation-section label="${'${2:Section}'}">\n    <lightning-vertical-navigation-item label="${'${3:Item}'}" name="${'${4:item1}'}"></lightning-vertical-navigation-item>\n  </lightning-vertical-navigation-section>\n</lightning-vertical-navigation>` },
      { label: "lightning-button-group", detail: "LWC base component", insertText: `<lightning-button-group>\n  <lightning-button label="${'${1:One}'}" onclick={${'${2:handleClick}'}}></lightning-button>\n</lightning-button-group>` },
      { label: "lightning-badge", detail: "LWC base component", insertText: `<lightning-badge label="${'${1:Badge}'}"></lightning-badge>` },
      { label: "lightning-pill", detail: "LWC base component", insertText: `<lightning-pill label="${'${1:Pill}'}"></lightning-pill>` },
      { label: "lightning-avatar", detail: "LWC base component", insertText: `<lightning-avatar src="${'${1:avatar.png}'}" alternative-text="${'${2:Avatar}'}"></lightning-avatar>` },
      { label: "lightning-icon", detail: "LWC base component", insertText: `<lightning-icon icon-name="${'${1:utility:user}'}" alternative-text="${'${2:Icon}'}"></lightning-icon>` },
      { label: "lightning-progress-bar", detail: "LWC base component", insertText: `<lightning-progress-bar value={${'${1:50}'}}></lightning-progress-bar>` },
      { label: "lightning-spinner", detail: "LWC base component", insertText: `<lightning-spinner alternative-text="${'${1:Loading}'}"></lightning-spinner>` }
    ].filter((item) => !tag || item.label.startsWith(tag));
    return { suggestions: base.map((item) => ({ label: item.label, kind: monaco.languages.CompletionItemKind.Snippet, detail: item.detail, insertText: item.insertText, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet })) };
  }

  function provideLwcJsCompletions(monaco, model, position) {
    const raw = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const line = raw.toLowerCase();
    const wordMatch = raw.match(/[A-Za-z@][A-Za-z@:-]*$/);
    const typed = (wordMatch ? wordMatch[0] : "").toLowerCase();
    const hasLwc = /(^|\W)lwc:\s*$/.test(line) || /(^|\W)lwc:\s*[a-z-]*$/.test(line) || /(^|\W)lwc:$/.test(line) || /^(l|lw|lwc|lwc:)$/i.test(typed);
    const atStart = /@\s*$/.test(raw) || /@\w*$/.test(raw);
    const suggestions = [];
    const prefixMatch = raw.match(/(?:lwc:?|lw|l|@\w*)$/i);
    const prefixRange = prefixMatch
      ? { startLineNumber: position.lineNumber, startColumn: position.column - prefixMatch[0].length, endLineNumber: position.lineNumber, endColumn: position.column }
      : undefined;

    function matchesSearch(item) {
      if (!typed) return true;
      const text = `${item.label || ""} ${item.detail || ""} ${item.insertText || ""}`.toLowerCase();
      return text.includes(typed);
    }

    function decorate(items) {
      return items.filter(matchesSearch).map((item) => ({ ...item, range: item.range || prefixRange }));
    }

    if (hasLwc || /^\s*import\b/.test(line) || /from\s+['\"][^'\"]*$/.test(line) || !line.trim() || /^(l|lw|lwc|lwc:)$/i.test(typed)) {
      suggestions.push(...decorate([
        { label: "lwc: import { LightningElement, api, track, wire } from 'lwc'", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "import { LightningElement, api, track, wire } from 'lwc';", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "LWC core import" },
        { label: "lwc: import { MessageContext, publish, subscribe, unsubscribe } from 'lightning/messageService'", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "import { MessageContext, publish, subscribe, unsubscribe } from 'lightning/messageService';", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Lightning Message Service import" },
        { label: "lwc: import { NavigationMixin } from 'lightning/navigation'", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "import { NavigationMixin } from 'lightning/navigation';", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Navigation service import" },
        { label: "lwc: import { ShowToastEvent } from 'lightning/platformShowToastEvent'", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "import { ShowToastEvent } from 'lightning/platformShowToastEvent';", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Toast event import" },
        { label: "lwc: import { RefreshEvent } from 'lightning/refresh'", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "import { RefreshEvent } from 'lightning/refresh';", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Refresh event import" }
      ]));
    }

    if (hasLwc || atStart || /\b(api|track|wire)\b/.test(line) || /^(l|lw|lwc|lwc:)$/i.test(typed)) {
      suggestions.push(...decorate([
        { label: "lwc: @api", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "@api ${1:property};", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Public API decorator", range: prefixRange, filterText: "@api", sortText: "a1" },
        { label: "lwc: @track", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "@track ${1:property};", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Reactive field decorator", range: prefixRange, filterText: "@track", sortText: "a2" },
        { label: "lwc: @wire", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "@wire(${1:adapter}, ${2:config}) ${3:property};", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Wire adapter", range: prefixRange, filterText: "@wire", sortText: "a3" },
        { label: "lwc: @wire(MessageContext)", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "@wire(MessageContext) messageContext;", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "LMS message context wire", range: prefixRange, filterText: "@wire(MessageContext)", sortText: "a4" }
      ]));
    }

    if (hasLwc || /\bconstructor\b|\bconnectedcallback\b|\brenderedcallback\b|\bdisconnectedcallback\b|\berrorcallback\b/.test(line) || !line.trim() || /^(l|lw|lwc|lwc:)$/i.test(typed)) {
      suggestions.push(...decorate([
        { label: "lwc: constructor()", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "constructor() {\n  super();\n  ${1:// init}\n}", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "LWC lifecycle hook" },
        { label: "lwc: connectedCallback()", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "connectedCallback() {\n  ${1:// setup}\n}", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "LWC lifecycle hook" },
        { label: "lwc: renderedCallback()", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "renderedCallback() {\n  ${1:// after render}\n}", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "LWC lifecycle hook" },
        { label: "lwc: disconnectedCallback()", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "disconnectedCallback() {\n  ${1:// cleanup}\n}", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "LWC lifecycle hook" },
        { label: "lwc: errorCallback(error, stack)", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "errorCallback(error, stack) {\n  console.error(error, stack);\n}", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "LWC error boundary" }
      ]));
    }

    if (hasLwc || /\bmessagechannel\b|\bmessagecontext\b|\bpublish\b|\bsubscribe\b|\bunsubscribe\b/.test(line) || /^(l|lw|lwc|lwc:)$/i.test(typed)) {
      suggestions.push(...decorate([
        { label: "lwc: publish()", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "publish(this.messageContext, ${1:messageChannel}, ${2:payload});", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Publish LMS message" },
        { label: "lwc: subscribe()", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "this.subscription = subscribe(this.messageContext, ${1:messageChannel}, ${2:callback});", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Subscribe to LMS message" },
        { label: "lwc: unsubscribe()", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "unsubscribe(this.subscription);", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Unsubscribe from LMS message" },
        { label: "lwc: import apex method", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "import ${1:apexMethodName} from '@salesforce/apex/${2:ClassName}.${1:apexMethodName}';", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Import Apex method" },
        { label: "lwc: apex method call", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "${1:apexMethodName}({ ${2:paramName}: ${3:paramValue} })\n  .then(result => {\n    console.log('Result', result);\n  })\n  .catch(error => {\n    console.error('Error:', error.body.message || error.message);\n  });", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Call Apex method imperatively" }
      ]));
    }

    return { suggestions };
  }

  function provideLwcCssCompletions(monaco, model, position) {
    const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1).toLowerCase();
    const token = String(line.split(/[\s.#:{(]/).pop() || "").toLowerCase();
    const range = token ? { startLineNumber: position.lineNumber, startColumn: position.column - token.length, endLineNumber: position.lineNumber, endColumn: position.column } : undefined;
    const suggestions = [
      { label: "display: flex;", insertText: "display: flex;", detail: "CSS basic syntax" },
      { label: "justify-content: center;", insertText: "justify-content: center;", detail: "Flexbox utility" },
      { label: "align-items: center;", insertText: "align-items: center;", detail: "Flexbox utility" },
      { label: "color: var(--lwc-brandTextLink);", insertText: "color: var(--lwc-brandTextLink);", detail: "Salesforce design token" }
    ].map((item) => ({ label: item.label, kind: monaco.languages.CompletionItemKind.Snippet, detail: item.detail, insertText: item.insertText, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range }));
    const slds = (token.startsWith("s") || token.includes("class") || token.includes("slds")) ? [
      "slds-grid",
      "slds-grid_vertical",
      "slds-grid_align-spread",
      "slds-grid_align-center",
      "slds-wrap",
      "slds-col",
      "slds-size_1-of-1",
      "slds-size_1-of-2",
      "slds-size_1-of-3",
      "slds-size_2-of-3",
      "slds-size_1-of-4",
      "slds-size_3-of-4",
      "slds-hide",
      "slds-show",
      "slds-float_left",
      "slds-float_right",
      "slds-clear",
      "slds-truncate",
      "slds-text-align_left",
      "slds-text-align_center",
      "slds-text-align_right",
      "slds-text-body_small",
      "slds-text-body_regular",
      "slds-text-heading_small",
      "slds-text-heading_medium",
      "slds-text-heading_large",
      "slds-text-title",
      "slds-text-title_caps",
      "slds-p-around_xx-small",
      "slds-p-around_x-small",
      "slds-p-around_small",
      "slds-p-around_medium",
      "slds-p-around_large",
      "slds-p-horizontal_xx-small",
      "slds-p-horizontal_x-small",
      "slds-p-horizontal_small",
      "slds-p-horizontal_medium",
      "slds-p-horizontal_large",
      "slds-p-vertical_xx-small",
      "slds-p-vertical_x-small",
      "slds-p-vertical_small",
      "slds-p-vertical_medium",
      "slds-p-vertical_large",
      "slds-m-left_xx-small",
      "slds-m-left_x-small",
      "slds-m-left_small",
      "slds-m-left_medium",
      "slds-m-left_large",
      "slds-m-right_xx-small",
      "slds-m-right_x-small",
      "slds-m-right_small",
      "slds-m-right_medium",
      "slds-m-right_large",
      "slds-m-top_xx-small",
      "slds-m-top_x-small",
      "slds-m-top_small",
      "slds-m-top_medium",
      "slds-m-top_large",
      "slds-m-bottom_xx-small",
      "slds-m-bottom_x-small",
      "slds-m-bottom_small",
      "slds-m-bottom_medium",
      "slds-m-bottom_large",
      "slds-button",
      "slds-button_brand",
      "slds-button_neutral",
      "slds-button_outline-brand",
      "slds-button_destructive",
      "slds-button_success",
      "slds-button_icon",
      "slds-button_icon-border",
      "slds-button_icon-border-filled",
      "slds-button_icon-inverse",
      "slds-button_icon-brand",
      "slds-card",
      "slds-card__header",
      "slds-card__body",
      "slds-card__footer",
      "slds-box",
      "slds-page-header",
      "slds-page-header__title",
      "slds-media",
      "slds-media__figure",
      "slds-media__body",
      "slds-avatar",
      "slds-avatar_circle",
      "slds-avatar_large",
      "slds-avatar_medium",
      "slds-avatar_small",
      "slds-badge",
      "slds-badge_lightest",
      "slds-pill",
      "slds-pill__label",
      "slds-pill__remove",
      "slds-progress-bar",
      "slds-progress-bar__value",
      "slds-input",
      "slds-input-has-icon",
      "slds-input-has-icon_left",
      "slds-input-has-icon_right",
      "slds-checkbox",
      "slds-checkbox_faux",
      "slds-radio",
      "slds-radio_faux",
      "slds-tabs_default",
      "slds-tabs_scoped",
      "slds-tabs_default__nav",
      "slds-tabs_default__item",
      "slds-tabs_default__link",
      "slds-table",
      "slds-table_cell-buffer",
      "slds-table_bordered",
      "slds-table_striped",
      "slds-table_col-bordered",
      "slds-list_dotted",
      "slds-list_ordered",
      "slds-list_vertical",
      "slds-theme_default",
      "slds-theme_shade",
      "slds-theme_alt-inverse",
      "slds-theme_success",
      "slds-theme_warning",
      "slds-theme_error",
      "slds-notify",
      "slds-notify_alert",
      "slds-notify_toast",
      "slds-spinner",
      "slds-spinner_brand",
      "slds-spinner_small",
      "slds-spinner_medium",
      "slds-spinner_large"
    ] : [];
    const filteredSlds = token.startsWith("slds") ? slds.filter((name) => name.toLowerCase().includes(token)) : slds;
    const sldsSuggestions = filteredSlds.map((name) => ({ label: name, kind: monaco.languages.CompletionItemKind.Value, detail: "SLDS utility class", insertText: name, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range }));
    return { suggestions: [...suggestions, ...sldsSuggestions] };
  }

  function provideApexCompletions(monaco, model, position) {
    const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1).toLowerCase();
    const isBlankLine = !line.trim();
    const typedWordMatch = line.match(/[a-z@_.]*$/i);
    const typedWord = (typedWordMatch ? typedWordMatch[0] : "").toLowerCase();
    const isTriggerFile = /\.trigger$/i.test(String(selectedFile?.path || ""));
    const inTrigger = isTriggerFile && (/\btrigger\b/.test(line) || isBlankLine);

    const suggestions = [
      { label: "Apex class", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Apex class template", insertText: `public with sharing class ${'${1:ClassName}'} {\n  ${'${2:// fields}'}\n\n  public ${'${3:ClassName}'}() {\n    ${'${4:// constructor logic}'}\n  }\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "Apex trigger", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Apex trigger template", insertText: `trigger ${'${1:TriggerName}'} on ${'${2:Object__c}'} (${ '${3:before insert, before update}' }) {\n  ${'${4:// logic}'}\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "Apex enum", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Apex enum template", insertText: `public enum ${'${1:Status}'} { ${'${2:NEW}'}, ${'${3:IN_PROGRESS}'}, ${'${4:DONE}'} }`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "SOQL query", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Apex SOQL query snippet", insertText: `List<${'${1:Object__c}'}> records = [SELECT ${'${2:Id, Name}'} FROM ${'${3:Object__c}'} WHERE ${'${4:Field__c}'} = ${'${5:value}'} LIMIT ${'${6:200}'}];`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "SOSL search", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Apex SOSL search snippet", insertText: `List<List<SObject>> results = [FIND ${'${1:searchTerm}'} IN ALL FIELDS RETURNING ${'${2:Account(Name)}'}, ${'${3:Contact(Name, Email)}'}];`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "System.debug", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Apex debug statement", insertText: `System.debug(LoggingLevel.INFO, ${'${1:variable}'});`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "try/catch", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Apex error handling", insertText: `try {\n  ${'${1:// code}'}\n} catch (Exception e) {\n  System.debug(LoggingLevel.ERROR, e);\n  throw e;\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "@AuraEnabled", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Expose Apex to LWC", insertText: `@AuraEnabled(cacheable=true)\npublic static ${'${1:List<Object>}'} ${'${2:methodName}'}(${ '${3:List<Id> ids}' }) {\n  ${'${4:return null;}'}\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "@InvocableMethod", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Flow invocable method", insertText: `@InvocableMethod(label='${'${1:Label}'}' description='${'${2:Description}'}')\npublic static void ${'${3:methodName}'}(List<${'${4:Request}'}> requests) {\n  ${'${5:// logic}'}\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "@future", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Async future method", insertText: `@future(callout=${'${1:false}'})\npublic static void ${'${2:methodName}'}(${ '${3:List<Id> ids}' }) {\n  ${'${4:// async logic}'}\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "@testMethod", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Legacy test method", insertText: `@isTest static void ${'${1:testMethodName}'}() {\n  ${'${2:// arrange}'}\n  Test.startTest();\n  ${'${3:// act}'}\n  Test.stopTest();\n  System.assertEquals(${ ' ${4:expected} ' }, ${ ' ${5:actual} ' });\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "@isTest class", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Apex test class skeleton", insertText: `@isTest\nprivate class ${'${1:MyClassTest}'} {\n  @isTest static void ${'${2:testSomething}'}() {\n    ${'${3:// test logic}'}\n  }\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "@testSetup", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Shared Apex test setup", insertText: `@testSetup\nstatic void ${'${1:setupData}'}() {\n  ${'${2:// create shared test data}'}\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "DML insert", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Insert record", insertText: `insert ${'${1:record}'};`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "DML update", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Update record", insertText: `update ${'${1:record}'};`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "DML upsert", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Upsert record", insertText: `upsert ${'${1:record}'};`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "DML delete", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Delete record", insertText: `delete ${'${1:record}'};`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "DML undelete", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Undelete record", insertText: `undelete ${'${1:records}'};`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "Database.query", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Dynamic SOQL", insertText: `List<SObject> rows = Database.query(${ '"SELECT Id FROM ${1:Object__c}"' });`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "Database.executeBatch", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Batch execution", insertText: `Database.executeBatch(new ${'${1:BatchClass}'}(), ${'${2:200}'});`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "Queueable", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Queueable execution", insertText: `System.enqueueJob(new ${'${1:QueueableClass}'}(${ ' ${2:args} ' }));`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "Database.SaveResult check", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Check DML save results", insertText: `Database.SaveResult[] results = Database.insert(${ ' ${1:records} ' }, false);\nfor (Database.SaveResult sr : results) {\n  if (!sr.isSuccess()) {\n    for (Database.Error err : sr.getErrors()) {\n      System.debug(err.getMessage());\n    }\n  }\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "List<Map<String, Object>>", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Generic data structure", insertText: `List<Map<String, Object>> ${'${1:records}'} = new List<Map<String, Object>>();`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "Map<Id, SObject>", kind: monaco.languages.CompletionItemKind.Snippet, detail: "SObject map", insertText: `Map<Id, SObject> ${'${1:recordMap}'} = new Map<Id, SObject>();`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "Set<Id>", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Set of Ids", insertText: `Set<Id> ${'${1:ids}'} = new Set<Id>();`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
      { label: "for loop", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Apex for loop", insertText: `for (${ ' ${1:SObjectType} ' } ${'${2:record}'} : ${'${3:records}'}) {\n  ${'${4:// logic}'}\n}`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet }
    ];

    const scopedSuggestions = isTriggerFile
      ? suggestions.filter((item) => !["Apex class", "Apex enum", "@isTest class", "@testSetup", "@testMethod", "@future", "@InvocableMethod"].includes(item.label))
      : suggestions.filter((item) => item.label !== "Apex trigger");
    const filtered = scopedSuggestions.filter((item) => {
      if (!typedWord) return true;
      const haystack = `${item.label} ${item.detail} ${item.insertText}`.toLowerCase();
      return haystack.includes(typedWord);
    }).filter((item) => {
      if (/@/.test(typedWord)) return /@/.test(item.label) || /annotation|test|future|invocable/i.test(item.detail || "");
      if (/\bquery\b|soql|sosl/.test(line)) return /soql|sosl|query/i.test(item.detail || item.label);
      if (/\btrigger\b/.test(line) || inTrigger) return /trigger|dml|query|system\.debug|try\/catch/i.test(item.detail || item.label);
      if (/\btest\b/.test(line)) return /test|assert|setup/i.test(item.detail || item.label);
      if (/\binsert\b|\bupdate\b|\bdelete\b|\bupsert\b|\bundelete\b/.test(line)) return /dml/i.test(item.detail || item.label) || /Database\.SaveResult check/i.test(item.label);
      return true;
    });

    return {
      suggestions: filtered.map((item) => ({
        ...item,
        kind: item.kind || monaco.languages.CompletionItemKind.Snippet,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      }))
    };
  }

  function provideLwcXmlCompletions(monaco, model, position) {
    const raw = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const typed = (raw.match(/(?:lwc:?|lw|l|<\/?[a-z]*)$/i) || [""])[0].toLowerCase();
    const range = typed ? { startLineNumber: position.lineNumber, startColumn: position.column - typed.length, endLineNumber: position.lineNumber, endColumn: position.column } : undefined;
    return {
      suggestions: [
        { label: "lwc: targets", kind: monaco.languages.CompletionItemKind.Snippet, detail: "LWC meta XML targets block", insertText: `<targets>\n  <target>lightning__RecordPage</target>\n  <target>lightning__AppPage</target>\n  <target>lightning__HomePage</target> <!-- <target>lightning__Tab</target> -->\n  <!-- <target>lightning__Inbox</target> --> <!-- <target>lightning__UtilityBar</target> -->\n  <!-- <target>lightning__FlowScreen</target> --> <!-- <target>lightningCommunity__Page</target> -->\n  <!-- <target>lightningCommunity__Default</target> -->\n  <!-- <target>lightningCommunity__Page_Layout</target> -->\n  <!-- <target>lightningCommunity__Theme_Layout</target> --> <!-- <target>lightning__RecordAction</target> -->\n  <!-- <target>lightning__GlobalAction</target> --> <!-- <target>lightning__UrlAddressable</target> -->\n</targets>`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, filterText: "lwc: targets" },
        { label: "lwc: isExposed", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Expose component in Lightning App Builder", insertText: `<isExposed>true</isExposed>`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, filterText: "lwc: isExposed" },
        { label: "lwc: apiVersion", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Component API version", insertText: `<apiVersion>67.0</apiVersion>`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, filterText: "lwc: apiVersion" },
        { label: "lwc: targetConfig", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Target configuration block", insertText: `<targetConfigs>\n  <targetConfig targets="lightning__RecordPage">\n    <property name="\${1:propertyName}" type="String" label="\${2:Label}" />\n  </targetConfig>\n</targetConfigs>`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, filterText: "lwc: targetConfig" },
        { label: "lwc: targetConfig multiple properties", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Target config with multiple properties", insertText: `<targetConfigs>\n  <targetConfig targets="lightning__RecordPage,lightning__AppPage">\n    <property name="\${1:recordId}" type="String" label="\${2:Record Id}" />\n    <property name="\${3:showHeader}" type="Boolean" label="\${4:Show Header}" default="true" />\n    <property name="\${5:variant}" type="String" label="\${6:Variant}" />\n  </targetConfig>\n</targetConfigs>`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, filterText: "lwc: targetConfig multiple properties" },
        { label: "lwc: lightning__RecordAction", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Record action target", insertText: `<targets>\n  <target>lightning__RecordAction</target>\n</targets>`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, filterText: "lwc: lightning__RecordAction" },
        { label: "lwc: design attributes", kind: monaco.languages.CompletionItemKind.Snippet, detail: "Design attribute targetConfig", insertText: `<targetConfigs>\n  <targetConfig targets="lightning__AppPage,lightning__HomePage,lightning__RecordPage">\n    <property name="\${1:title}" type="String" label="\${2:Title}" />\n    <property name="\${3:subtitle}" type="String" label="\${4:Subtitle}" />\n    <property name="\${5:showIcon}" type="Boolean" label="\${6:Show Icon}" default="false" />\n  </targetConfig>\n</targetConfigs>`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, filterText: "lwc: design attributes" }
      ]
    };
  }

  function provideAuraMarkupCompletions(monaco, model, position) {
    const path = String(selectedFile?.path || "").toLowerCase();
    const suggestions = [
      { label: "aura:attribute", detail: "Aura component attribute", insertText: '<aura:attribute name="${1:attributeName}" type="${2:String}" default="${3:}" />' },
      { label: "aura:handler init", detail: "Aura initialization handler", insertText: '<aura:handler name="init" value="{!this}" action="{!c.${1:doInit}}" />' },
      { label: "aura:if", detail: "Aura conditional markup", insertText: '<aura:if isTrue="{!v.${1:condition}}">\n  ${2:content}\n  <aura:set attribute="else">\n    ${3:alternate content}\n  </aura:set>\n</aura:if>' },
      { label: "aura:iteration", detail: "Aura collection iteration", insertText: '<aura:iteration items="{!v.${1:items}}" var="${2:item}">\n  ${3:content}\n</aura:iteration>' },
      { label: "aura:method", detail: "Expose an Aura component method", insertText: '<aura:method name="${1:methodName}" action="{!c.${2:handleMethod}}">\n  <aura:attribute name="${3:argument}" type="${4:String}" />\n</aura:method>' },
      { label: "aura:registerEvent", detail: "Register an Aura event", insertText: '<aura:registerEvent name="${1:eventName}" type="${2:c:EventName}" />' },
      { label: "lightning:button", detail: "Lightning button for Aura", insertText: '<lightning:button label="${1:Label}" variant="${2:brand}" onclick="{!c.${3:handleClick}}" />' },
      { label: "lightning:input", detail: "Lightning input for Aura", insertText: '<lightning:input label="${1:Label}" value="{!v.${2:value}}" onchange="{!c.${3:handleChange}}" />' },
      { label: "lightning:card", detail: "Lightning card for Aura", insertText: '<lightning:card title="${1:Title}">\n  ${2:content}\n</lightning:card>' }
    ];

    if (path.endsWith(".cmp")) {
      suggestions.unshift({ label: "aura:component", detail: "Aura component skeleton", insertText: '<aura:component implements="${1:flexipage:availableForAllPageTypes}" access="global">\n  ${2:content}\n</aura:component>' });
    }
    if (path.endsWith(".app")) {
      suggestions.unshift({ label: "aura:application", detail: "Aura application skeleton", insertText: '<aura:application extends="force:slds">\n  ${1:content}\n</aura:application>' });
    }
    if (path.endsWith(".evt")) {
      suggestions.unshift({ label: "aura:event", detail: "Aura event skeleton", insertText: '<aura:event type="${1:APPLICATION}">\n  <aura:attribute name="${2:payload}" type="${3:String}" />\n</aura:event>' });
    }
    if (path.endsWith(".intf")) {
      suggestions.unshift({ label: "aura:interface", detail: "Aura interface skeleton", insertText: '<aura:interface>\n  <aura:attribute name="${1:attributeName}" type="${2:String}" />\n</aura:interface>' });
    }
    if (path.endsWith(".design")) {
      suggestions.unshift({ label: "design:component", detail: "Aura design component", insertText: '<design:component>\n  <design:attribute name="${1:attributeName}" label="${2:Attribute Label}" />\n</design:component>' });
    }
    if (path.endsWith(".tokens")) {
      suggestions.unshift({ label: "aura:tokens", detail: "Aura design token definition", insertText: '<aura:tokens>\n  <aura:token name="${1:tokenName}">${2:#0176d3}</aura:token>\n</aura:tokens>' });
    }
    return createScopedCompletionResult(monaco, model, position, suggestions);
  }

  function provideAuraJavaScriptCompletions(monaco, model, position) {
    return createScopedCompletionResult(monaco, model, position, [
      { label: "aura: controller action", detail: "Aura controller action", insertText: '({\n  ${1:doInit} : function(component, event, helper) {\n    ${2:// initialization}\n  }\n})' },
      { label: "aura: server action", detail: "Call an Apex controller action", insertText: 'var action = component.get("c.${1:methodName}");\naction.setParams({ ${2:paramName}: ${3:paramValue} });\naction.setCallback(this, function(response) {\n  if (response.getState() === "SUCCESS") {\n    ${4:// handle response}\n  } else {\n    ${5:// handle error}\n  }\n});\n$A.enqueueAction(action);' },
      { label: "aura: component.get", detail: "Read an Aura attribute", insertText: 'component.get("v.${1:attributeName}")' },
      { label: "aura: component.set", detail: "Set an Aura attribute", insertText: 'component.set("v.${1:attributeName}", ${2:value});' },
      { label: "aura: component.find", detail: "Find an Aura component by aura:id", insertText: 'component.find("${1:componentId}")' },
      { label: "aura: show toast", detail: "Show a Salesforce toast", insertText: 'var toast = $A.get("e.force:showToast");\ntoast.setParams({\n  title: "${1:Success}",\n  message: "${2:Message}",\n  type: "${3:success}"\n});\ntoast.fire();' },
      { label: "aura: event parameter", detail: "Read an Aura event parameter", insertText: 'event.getParam("${1:parameterName}")' },
      { label: "aura: application event", detail: "Fire an Aura application event", insertText: 'var appEvent = $A.get("e.c:${1:EventName}");\nappEvent.setParams({ ${2:parameterName}: ${3:value} });\nappEvent.fire();' },
      { label: "aura: navigate to record", detail: "Navigate to a Salesforce record", insertText: 'var navigation = $A.get("e.force:navigateToSObject");\nnavigation.setParams({ recordId: "${1:recordId}" });\nnavigation.fire();' }
    ]);
  }

  function provideAuraCssCompletions(monaco, model, position) {
    return createScopedCompletionResult(monaco, model, position, [
      { label: ".THIS", detail: "Aura component root selector", insertText: '.THIS {\n  ${1:/* styles */}\n}' },
      { label: ".THIS child selector", detail: "Aura component child selector", insertText: '.THIS .${1:selector} {\n  ${2:/* styles */}\n}' },
      { label: ".THIS:hover", detail: "Aura component hover state", insertText: '.THIS:hover {\n  ${1:/* styles */}\n}' },
      { label: ".THIS.slds-is-open", detail: "Aura state selector", insertText: '.THIS.slds-is-open {\n  ${1:/* styles */}\n}' },
      { label: "Aura responsive media query", detail: "Aura responsive style", insertText: '@media (max-width: ${1:768px}) {\n  .THIS {\n    ${2:/* responsive styles */}\n  }\n}' }
    ]);
  }

  function createScopedCompletionResult(monaco, model, position, suggestions) {
    const raw = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const tokenMatch = raw.match(/[A-Za-z$:.][A-Za-z0-9$:._-]*$/);
    const typed = String(tokenMatch?.[0] || "").toLowerCase();
    const range = tokenMatch
      ? { startLineNumber: position.lineNumber, startColumn: position.column - tokenMatch[0].length, endLineNumber: position.lineNumber, endColumn: position.column }
      : undefined;
    const filtered = suggestions.filter((item) => {
      if (!typed) return true;
      return `${item.label} ${item.detail} ${item.insertText}`.toLowerCase().includes(typed);
    });
    return {
      suggestions: filtered.map((item) => ({
        ...item,
        kind: item.kind || monaco.languages.CompletionItemKind.Snippet,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range
      }))
    };
  }

  init().catch((error) => addLog("ERROR", error.message));

  async function init() {
    await loadLocalFilesState();
    const [storedPreferences, storedExplorerState] = await Promise.all([
      developerConsolePreferencesPromise,
      developerConsoleExplorerStatePromise
    ]);
    if (storedPreferences) applyDeveloperConsolePreferences(storedPreferences);
    if (storedExplorerState) developerConsoleExplorerState = storedExplorerState;
    sessionId = await getSessionIdFromCookie();
    sessionApiOrigin = new URLSearchParams(window.location.search).get("sourceOrigin") || null;
    if (isStandalone) {
      try {
        const orgId = await getOrganizationDetails(sessionId, sessionApiOrigin || undefined);
        const sourceOrigin = new URLSearchParams(window.location.search).get("sourceOrigin") || sessionApiOrigin || undefined;
        if (orgId && sourceOrigin) {
          await chrome.runtime.sendMessage({ type: "REGISTER_DEVELOPER_CONSOLE_WINDOW", orgId, sourceOrigin });
        }
      } catch {
        // ignore registration failures; duplicate prevention still falls back to window scan
      }
    }
    //logSessionDebug();
    if (!sessionId) {
      addLog("ERROR", "No session cookie found.");
      return;
    }

    restoreExplorerState();
    addLog("INFO", "Developer Console ready. Expand a folder to load its contents.");
  }

  function renderLwcTree(bundles) {
    const group = treeGroups.lwc;
    if (!group?.list) return;
    group.items = bundles;
    group.total = bundles.length;
    group.visibleItems = filterLwcBundles(bundles, currentSearchQuery);
    updateTreeGroupCount(group, group.visibleItems.length);
    group.list.replaceChildren(...renderLwcTreeItems(group.visibleItems));
  }

  function isAuraTreeGroup(key) {
    return auraTreeGroupKeys.includes(key);
  }

  function findAuraTreeGroupKey(bundleName) {
    return auraTreeGroupKeys.find((key) => treeGroups[key]?.items?.some((item) => item.DeveloperName === bundleName)) || "";
  }

  function findAuraBundleRecord(bundleName, auraTreeGroup) {
    const groupKey = auraTreeGroup || findAuraTreeGroupKey(bundleName);
    return treeGroups[groupKey]?.items?.find((item) => item.DeveloperName === bundleName)
      || auraTreeGroupKeys
        .flatMap((key) => treeGroups[key]?.items || [])
        .find((item) => item.DeveloperName === bundleName)
      || null;
  }

  function ensureAuraTreeGroupExpanded(auraTreeGroup) {
    const groupKey = auraTreeGroup || "aura";
    if (!isAuraTreeGroup(groupKey) || !treeGroups[groupKey]) return;
    setTreeGroupExpanded(groupKey, true);
  }

  function ensureLwcTreeGroupExpanded() {
    if (!treeGroups.lwc) return;
    setTreeGroupExpanded("lwc", true);
  }

  function findAuraComponentNode(bundleName, auraTreeGroup) {
    const groupKeys = auraTreeGroup && isAuraTreeGroup(auraTreeGroup) ? [auraTreeGroup] : auraTreeGroupKeys;
    for (const groupKey of groupKeys) {
      const node = treeGroups[groupKey]?.list?.querySelector(`.dc-aura-node[data-bundle-name="${bundleName}"]`);
      if (node) return node;
    }
    return null;
  }

  function ensureBundleNodeExpanded(bundleName, findNodeFn, treeGroupKey) {
    const bundleNode = findNodeFn(bundleName, treeGroupKey);
    if (!bundleNode) return null;
    if (!bundleNode.classList.contains("dc-bundle-expanded")) {
      bundleNode.classList.add("dc-bundle-expanded");
      const caret = bundleNode.querySelector(".dc-bundle-caret");
      if (caret) caret.textContent = "▾";
      const toggle = bundleNode.querySelector(".dc-bundle-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
    }
    return bundleNode;
  }

  function getApexFileName(apexClass) {
    const rawName = String(apexClass?.Name || "UnnamedApexClass").trim();
    const status = String(apexClass?.Status || "").toLowerCase();
    if (status === "active" || status === "complete") return `${rawName}.cls`;
    return `${rawName}.cls`;
  }

  function findApexClassNode(fileName) {
    return treeGroups.apex.list?.querySelector(`[data-file-path="${String(fileName).replace(/"/g, '\\"')}"]`) || null;
  }

  async function openApexClassInEditor(apexClass) {
    const fileName = getApexFileName(apexClass);
    const source = await fetchApexClassBody(apexClass?.Id);
    const filePath = `apex/${fileName}`;
    const existing = openFiles.find((file) => file.bundleName === fileName && file.path === filePath);
    if (existing) {
      existing.content = source || `// ${fileName}\n`;
      existing.originalContent = existing.content;
      existing.apexClassId = apexClass?.Id || null;
      existing.dirty = false;
      activateTab(existing.id);
      renderTabs();
      return;
    }
    const fileId = `${fileName}::${filePath}`;
    openFiles.push({
      id: fileId,
      button: null,
      bundleName: fileName,
      path: filePath,
      content: String(source || `// ${fileName}\n`),
      originalContent: String(source || `// ${fileName}\n`),
      dirty: false,
      sourceType: "apex",
      apexClassId: apexClass?.Id || null
    });
    renderTabs();
    activateTab(fileId);
    if (selectedFile) {
      selectedFile.sourceType = "apex";
      selectedFile.apexClassId = apexClass?.Id || null;
    }
  }

  async function fetchApexClassBody(apexClassId) {
    if (!sessionId || !apexClassId) return "";
    const safeId = String(apexClassId).replace(/'/g, "\\'");
    const payload = await callToolingApi(sessionId, `SELECT Id, Name, Body FROM ApexClass WHERE Id = '${safeId}' LIMIT 1`);
    return payload.records?.[0]?.Body ?? "";
  }

  async function openApexTriggerInEditor(apexTrigger) {
    const fileName = getApexTriggerFileName(apexTrigger);
    const source = await fetchApexTriggerBody(apexTrigger?.Id);
    const filePath = `triggers/${fileName}`;
    const existing = openFiles.find((file) => file.bundleName === fileName && file.path === filePath);
    if (existing) {
      existing.content = source || `// ${fileName}\n`;
      existing.originalContent = existing.content;
      existing.apexTriggerId = apexTrigger?.Id || null;
      existing.dirty = false;
      activateTab(existing.id);
      renderTabs();
      return;
    }
    const fileId = `${fileName}::${filePath}`;
    openFiles.push({
      id: fileId,
      button: null,
      bundleName: fileName,
      path: filePath,
      content: String(source || `// ${fileName}\n`),
      originalContent: String(source || `// ${fileName}\n`),
      dirty: false,
      sourceType: "apex-trigger",
      apexTriggerId: apexTrigger?.Id || null
    });
    renderTabs();
    activateTab(fileId);
    if (selectedFile) {
      selectedFile.sourceType = "apex-trigger";
      selectedFile.apexTriggerId = apexTrigger?.Id || null;
    }
  }

  async function fetchApexTriggerBody(apexTriggerId) {
    if (!sessionId || !apexTriggerId) return "";
    const safeId = String(apexTriggerId).replace(/'/g, "\\'");
    const payload = await callToolingApi(sessionId, `SELECT Id, Name, Body FROM ApexTrigger WHERE Id = '${safeId}' LIMIT 1`);
    return payload.records?.[0]?.Body ?? "";
  }

  async function ensureLwcTreeLoaded() {
    const group = treeGroups.lwc;
    if (group.loaded || group.loading) return;
    group.loading = true;
    setTreeGroupStatus(group, "Loading LWC Bundles...");
    addLog("INFO", "[LIGHTNINGWEBCOMPONENT] - Retrieving resources from org...  please wait.");
    try {
      const bundles = await listLwcComponents(sessionId);
      renderLwcTree(bundles);
      addLog("SUCCESS", `[LIGHTNINGWEBCOMPONENT] - Retrieved ${bundles.length} bundles successfully.`);
      group.loaded = true;
    } catch (error) {
      const details = getErrorDetails(error.message || error);
      setTreeGroupStatus(group, `Error: ${details}`);
      addLog("ERROR", `[LIGHTNINGWEBCOMPONENT] - Failed to retrieve bundles: ${getErrorDetails(error.message || error)}`);
    } finally {
      group.loading = false;
    }
  }

  async function ensureApexTreeLoaded() {
    const group = treeGroups.apex;
    if (group.loaded || group.loading) return;
    group.loading = true;
    setTreeGroupStatus(group, "Loading Apex Classes...");
    addLog("INFO", "[APEX] - Retrieving resources from org... please wait.");
    try {
      const apexClasses = await listApexClasses(sessionId);
      group.items = apexClasses;
      updateTreeGroupCount(group, apexClasses.length);
      if (group.list) {
        group.list.replaceChildren(...renderApexTreeItems(apexClasses));
      }
      addLog("SUCCESS", `[APEX] - Retrieved ${apexClasses.length} classes successfully.`);
      group.loaded = true;
    } catch (error) {
      const details = getErrorDetails(error.message || error);
      if (group.list) group.list.textContent = `Error: ${details}`;
      addLog("ERROR", `[APEX] - Failed to retrieve classes: ${details.replace(/\n/g, " | ")}`);
    } finally {
      group.loading = false;
    }
  }

  async function ensureTriggerTreeLoaded() {
    const group = treeGroups.trigger;
    if (group.loaded || group.loading) return;
    group.loading = true;
      setTreeGroupStatus(group, "Loading APEX TRIGGERS...");
      addLog("INFO", "[APEXTRIGGERS] - Retrieving resources from org... please wait.");
    try {
      const triggers = await listApexTriggers(sessionId);
      group.items = triggers;
      group.total = triggers.length;
      group.visibleItems = filterApexTriggers(triggers, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
      if (group.list) {
        group.list.replaceChildren(...renderApexTriggerTreeItems(triggers));
      }
      addLog("SUCCESS", `[APEXTRIGGERS] - Retrieved ${triggers.length} triggers successfully.`);
      group.loaded = true;
    } catch (error) {
      const details = getErrorDetails(error.message || error);
      if (group.list) group.list.textContent = `Error: ${details}`;
      addLog("ERROR", `[APEXTRIGGERS] - Failed to retrieve triggers: ${details.replace(/\n/g, " | ")}`);
    } finally {
      group.loading = false;
    }
  }

  async function ensureVisualforceTreeLoaded() {
    const group = treeGroups.vf;
    if (group.loaded || group.loading) return;
    group.loading = true;
    setTreeGroupStatus(group, "Loading Visualforce Pages...");
    addLog("INFO", "[VISUALFORCEPAGES] - Retrieving resources from org... please wait.");
    try {
      const pages = await listVisualforcePages(sessionId);
      group.items = pages;
      group.total = pages.length;
      group.visibleItems = filterVisualforcePages(pages, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
      if (group.list) {
        group.list.replaceChildren(...renderVisualforceTreeItems(pages));
      }
      addLog("SUCCESS", `[VISUALFORCEPAGES] - Retrieved ${pages.length} pages successfully.`);
      group.loaded = true;
    } catch (error) {
      const details = getErrorDetails(error.message || error);
      setTreeGroupStatus(group, `Error: ${details}`);
      addLog("ERROR", `[VISUALFORCEPAGES] - Failed to retrieve pages: ${details.replace(/\n/g, " | ")}`);
    } finally {
      group.loading = false;
    }
  }

  function renderDeletableDeveloperResourceTreeItem({ fileName, icon, resource, groupKey, openResource, openDeleteResource }) {
    const row = document.createElement("li");
    const wrapper = document.createElement("div");
    wrapper.className = "dc-file-row-wrap";
    wrapper.innerHTML = `<button type="button" class="dc-tree-item dc-apex-item" data-file-path="${escapeHtml(fileName)}"><span class="dc-file-icon" data-kind="other">${escapeHtml(icon)}</span><span class="dc-apex-label">${escapeHtml(fileName)}</span></button><button type="button" class="dc-tree-actions-trigger" aria-label="${escapeHtml(fileName)} actions" title="${escapeHtml(fileName)} actions">${iconMoreVertical()}</button>`;
    const fileButton = wrapper.querySelector(".dc-apex-item");
    const actionsButton = wrapper.querySelector(".dc-tree-actions-trigger");
    fileButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      void openResource();
    });
    actionsButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openExplorerActionsMenu(actionsButton, [
        {
          label: "Delete",
          icon: iconTrash(),
          destructive: true,
          onSelect: () => {
            if (typeof openDeleteResource === "function") {
              openDeleteResource();
              return;
            }
            openDeleteDeveloperResourceModal(groupKey, resource, fileName);
          }
        }
      ]);
    });
    row.appendChild(wrapper);
    return row;
  }

  function renderApexTreeItems(apexClasses) {
    const group = treeGroups.apex;
    if (group) {
      const sourceItems = Array.isArray(group.items) && group.items.length ? group.items : apexClasses;
      group.items = sourceItems;
      if (!Number.isFinite(group.total) || group.total === 0) {
        group.total = sourceItems.length;
      }
      group.visibleItems = filterApexClasses(sourceItems, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
    }

    return (group?.visibleItems || apexClasses)
      .sort((a, b) => String(a.Name || "").localeCompare(String(b.Name || "")))
      .map((apexClass) => renderDeletableDeveloperResourceTreeItem({
        fileName: getApexFileName(apexClass),
        icon: "A",
        resource: apexClass,
        groupKey: "apex",
        openResource: () => openApexClassInEditor(apexClass)
      }));
  }

  function getApexTriggerFileName(apexTrigger) {
    const rawName = String(apexTrigger?.Name || "UnnamedTrigger").trim();
    return `${rawName}.trigger`;
  }

  function filterApexTriggers(apexTriggers, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return apexTriggers.slice();
    return apexTriggers.filter((apexTrigger) => {
      const name = String(apexTrigger.Name || "").toLowerCase();
      const fileName = String(getApexTriggerFileName(apexTrigger) || "").toLowerCase();
      return name.includes(normalizedQuery) || fileName.includes(normalizedQuery);
    });
  }

  function getVisualforcePageFileName(page) {
    const rawName = String(page?.Name || page?.FullName || "UnnamedPage").trim();
    return `${rawName}.page`;
  }

  function filterVisualforcePages(pages, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return pages.slice();
    return pages.filter((page) => {
      const name = String(page.Name || "").toLowerCase();
      const fileName = String(getVisualforcePageFileName(page) || "").toLowerCase();
      return name.includes(normalizedQuery) || fileName.includes(normalizedQuery);
    });
  }

  function renderVisualforceTreeItems(pages) {
    const group = treeGroups.vf;
    if (group) {
      const sourceItems = Array.isArray(group.items) && group.items.length ? group.items : pages;
      group.items = sourceItems;
      if (!Number.isFinite(group.total) || group.total === 0) {
        group.total = sourceItems.length;
      }
      group.visibleItems = filterVisualforcePages(sourceItems, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
    }

    return (group?.visibleItems || pages)
      .sort((a, b) => String(a.Name || "").localeCompare(String(b.Name || "")))
      .map((page) => renderDeletableDeveloperResourceTreeItem({
        fileName: getVisualforcePageFileName(page),
        icon: "V",
        resource: page,
        groupKey: "vf",
        openResource: () => openVisualforcePageInEditor(page)
      }));
  }

  async function openVisualforcePageInEditor(page) {
    const fileName = getVisualforcePageFileName(page);
    const source = await fetchVisualforcePageBody(page?.Id);
    const filePath = `visualforce/${fileName}`;
    const nextContent = source || `<!-- ${fileName} -->\n`;
    const existing = openFiles.find((file) => file.bundleName === fileName && file.path === filePath);
    if (existing) {
      existing.content = nextContent;
      existing.originalContent = nextContent;
      existing.apexPageId = page?.Id || null;
      existing.dirty = false;
      activateTab(existing.id);
      renderTabs();
      return;
    }

    const fileId = `${fileName}::${filePath}`;
    openFiles.push({
      id: fileId,
      button: null,
      bundleName: fileName,
      path: filePath,
      content: String(nextContent ?? ""),
      originalContent: String(nextContent ?? ""),
      dirty: false,
      sourceType: "apex-page",
      apexPageId: page?.Id || null
    });
    renderTabs();
    activateTab(fileId);
  }

  async function fetchVisualforcePageBody(pageId) {
    if (!sessionId || !pageId) return "";
    const safeId = String(pageId).replace(/'/g, "\\'");
    const payload = await callToolingApi(sessionId, `SELECT Id, Name, Markup FROM ApexPage WHERE Id = '${safeId}' LIMIT 1`);
    return payload.records?.[0]?.Markup ?? "";
  }

  function getVisualforceComponentFileName(component) {
    const rawName = String(component?.Name || component?.FullName || "UnnamedComponent").trim();
    return `${rawName}.component`;
  }

  function filterVisualforceComponents(components, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return components.slice();
    return components.filter((component) => {
      const name = String(component.Name || "").toLowerCase();
      const fileName = String(getVisualforceComponentFileName(component) || "").toLowerCase();
      return name.includes(normalizedQuery) || fileName.includes(normalizedQuery);
    });
  }

  function renderVisualforceComponentTreeItems(components) {
    const group = treeGroups.vfc;
    if (group) {
      const sourceItems = Array.isArray(group.items) && group.items.length ? group.items : components;
      group.items = sourceItems;
      if (!Number.isFinite(group.total) || group.total === 0) {
        group.total = sourceItems.length;
      }
      group.visibleItems = filterVisualforceComponents(sourceItems, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
    }

    return (group?.visibleItems || components)
      .sort((a, b) => String(a.Name || "").localeCompare(String(b.Name || "")))
      .map((component) => renderDeletableDeveloperResourceTreeItem({
        fileName: getVisualforceComponentFileName(component),
        icon: "C",
        resource: component,
        groupKey: "vfc",
        openResource: () => openVisualforceComponentInEditor(component)
      }));
  }

  async function ensureVisualforceComponentTreeLoaded() {
    const group = treeGroups.vfc;
    if (group.loaded || group.loading) return;
    group.loading = true;
    setTreeGroupStatus(group, "Loading Visualforce Components...");
    addLog("INFO", "[VISUALFORCECOMPONENT] - Retrieving resources from org... please wait.");
    try {
      const components = await listVisualforceComponents(sessionId);
      group.items = components;
      group.total = components.length;
      group.visibleItems = filterVisualforceComponents(components, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
      if (group.list) {
        group.list.replaceChildren(...renderVisualforceComponentTreeItems(components));
      }
      addLog("SUCCESS", `[VISUALFORCECOMPONENT] - Retrieved ${components.length} components successfully.`);
      group.loaded = true;
    } catch (error) {
      const details = getErrorDetails(error.message || error);
      setTreeGroupStatus(group, `Error: ${details}`);
      addLog("ERROR", `[VISUALFORCECOMPONENT] - Failed to retrieve components: ${details.replace(/\n/g, " | ")}`);
    } finally {
      group.loading = false;
    }
  }

  function getDeveloperResourceConfig(groupKey) {
    const configs = {
      apex: {
        sobjectType: "ApexClass",
        sourceType: "apex",
        fileIdProperty: "apexClassId",
        logTag: "APEX",
        label: "Apex class"
      },
      trigger: {
        sobjectType: "ApexTrigger",
        sourceType: "apex-trigger",
        fileIdProperty: "apexTriggerId",
        logTag: "APEXTRIGGER",
        label: "Apex trigger"
      },
      vf: {
        sobjectType: "ApexPage",
        sourceType: "apex-page",
        fileIdProperty: "apexPageId",
        logTag: "VISUALFORCEPAGES",
        label: "Visualforce page"
      },
      vfc: {
        sobjectType: "ApexComponent",
        sourceType: "apex-component",
        fileIdProperty: "apexComponentId",
        logTag: "VISUALFORCECOMPONENT",
        label: "Visualforce component"
      }
    };
    return configs[groupKey] || null;
  }

  async function refreshDeveloperResourceGroup(groupKey) {
    if (!sessionId) {
      addLog("ERROR", "No session cookie found.");
      return;
    }
    const group = treeGroups[groupKey];
    const loaders = {
      apex: ensureApexTreeLoaded,
      trigger: ensureTriggerTreeLoaded,
      vf: ensureVisualforceTreeLoaded,
      vfc: ensureVisualforceComponentTreeLoaded
    };
    const loadGroup = loaders[groupKey];
    if (!group || !loadGroup || group.loading) return;
    group.loaded = false;
    group.items = [];
    group.visibleItems = [];
    group.total = 0;
    updateTreeGroupCount(group, 0);
    if (group.button) group.button.setAttribute("aria-expanded", "true");
    if (group.list) group.list.hidden = false;
    await loadGroup();
  }

  function removeOpenDeveloperResourceFile(config, resourceId, fileName) {
    const normalizedResourceId = String(resourceId || "");
    const filesToRemove = openFiles.filter((file) => (
      file.sourceType === config.sourceType
      && (
        String(file[config.fileIdProperty] || "") === normalizedResourceId
        || String(file.path || "").endsWith(`/${fileName}`)
      )
    ));
    if (!filesToRemove.length) return;

    const removedIds = new Set(filesToRemove.map((file) => file.id));
    const selectedWasRemoved = selectedFile && removedIds.has(selectedFile.id);
    filesToRemove.forEach((file) => fileModels.delete(`${file.bundleName}::${file.path}`));
    for (let index = openFiles.length - 1; index >= 0; index -= 1) {
      if (removedIds.has(openFiles[index].id)) openFiles.splice(index, 1);
    }
    if (selectedWasRemoved) {
      const nextFile = openFiles[0] || null;
      if (nextFile) activateTab(nextFile.id);
      else {
        showWorkspaceReadyState();
        renderTabs();
      }
      return;
    }
    renderTabs();
  }

  async function deleteDeveloperResource(groupKey, resource, fileName) {
    const config = getDeveloperResourceConfig(groupKey);
    const resourceId = resource?.Id;
    if (!sessionId || !config || !resourceId) throw new Error("File information is unavailable.");
    showDeploymentToast("pending");
    addLog("INFO", `[${config.logTag}] - Deleting ${fileName}, please wait...`);
    try {
      await deleteToolingRecord(sessionId, config.sobjectType, resourceId, sessionApiOrigin);
      removeOpenDeveloperResourceFile(config, resourceId, fileName);
      await refreshDeveloperResourceGroup(groupKey);
      showDeploymentToast("success");
      addLog("SUCCESS", `[${config.logTag}] - Deleted ${fileName}.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  function openDeleteDeveloperResourceModal(groupKey, resource, fileName) {
    openDeleteExplorerItemConfirmationModal(() => deleteDeveloperResource(groupKey, resource, fileName));
  }

  async function openVisualforceComponentInEditor(component) {
    const fileName = getVisualforceComponentFileName(component);
    const source = await fetchVisualforceComponentBody(component?.Id);
    const filePath = `visualforce-components/${fileName}`;
    const nextContent = source || `<!-- ${fileName} -->\n`;
    const existing = openFiles.find((file) => file.bundleName === fileName && file.path === filePath);
    if (existing) {
      existing.content = nextContent;
      existing.originalContent = nextContent;
      existing.apexComponentId = component?.Id || null;
      existing.dirty = false;
      activateTab(existing.id);
      renderTabs();
      return;
    }

    const fileId = `${fileName}::${filePath}`;
    openFiles.push({
      id: fileId,
      button: null,
      bundleName: fileName,
      path: filePath,
      content: String(nextContent ?? ""),
      originalContent: String(nextContent ?? ""),
      dirty: false,
       sourceType: "apex-component",
      apexComponentId: component?.Id || null
    });
    renderTabs();
    activateTab(fileId);
  }

  async function fetchVisualforceComponentBody(componentId) {
    if (!sessionId || !componentId) return "";
    const safeId = String(componentId).replace(/'/g, "\\'");
    const payload = await callToolingApi(sessionId, `SELECT Id, Name, Markup FROM ApexComponent WHERE Id = '${safeId}' LIMIT 1`);
    return payload.records?.[0]?.Markup ?? "";
  }

  function getLightningMessageChannelFileName(channel) {
    const rawName = String(channel?.FullName || channel?.fullName || "UnnamedMessageChannel").trim();
    const metadataName = rawName.endsWith("__c") ? rawName.slice(0, -3) : rawName;
    return `${metadataName}.messageChannel-meta.xml`;
  }

  function filterLightningMessageChannels(channels, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return channels.slice();
    return channels.filter((channel) => {
      const fullName = String(channel?.FullName || channel?.fullName || "").toLowerCase();
      const fileName = getLightningMessageChannelFileName(channel).toLowerCase();
      return fullName.includes(normalizedQuery) || fileName.includes(normalizedQuery);
    });
  }

  function renderLightningMessageChannelTreeItems(channels) {
    const group = treeGroups.lightningMessageChannel;
    if (group) {
      const sourceItems = Array.isArray(group.items) && group.items.length ? group.items : channels;
      group.items = sourceItems;
      if (!Number.isFinite(group.total) || group.total === 0) {
        group.total = sourceItems.length;
      }
      group.visibleItems = filterLightningMessageChannels(sourceItems, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
    }

    return (group?.visibleItems || channels)
      .sort((left, right) => String(left?.FullName || left?.fullName || "").localeCompare(String(right?.FullName || right?.fullName || "")))
      .map((channel) => renderDeletableDeveloperResourceTreeItem({
        fileName: getLightningMessageChannelFileName(channel),
        icon: "<>",
        resource: channel,
        openResource: () => openLightningMessageChannelInEditor(channel),
        openDeleteResource: () => openDeleteLightningMessageChannelModal(channel)
      }));
  }

  async function ensureLightningMessageChannelTreeLoaded() {
    const group = treeGroups.lightningMessageChannel;
    if (group.loaded || group.loading) return;
    group.loading = true;
    setTreeGroupStatus(group, "Loading Lightning Message Channels...");
    addLog("INFO", "[LIGHTNINGMESSAGECHANNEL] - Retrieving resources from org... please wait.");
    try {
      const channels = await listLightningMessageChannels(sessionId, sessionApiOrigin);
      group.items = channels;
      group.total = channels.length;
      group.visibleItems = filterLightningMessageChannels(channels, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
      if (group.list) {
        group.list.replaceChildren(...renderLightningMessageChannelTreeItems(channels));
      }
      addLog("SUCCESS", `[LIGHTNINGMESSAGECHANNEL] - Retrieved ${channels.length} channels successfully.`);
      group.loaded = true;
    } catch (error) {
      const details = getErrorDetails(error.message || error);
      setTreeGroupStatus(group, `Error: ${details}`);
      addLog("ERROR", `[LIGHTNINGMESSAGECHANNEL] - Failed to retrieve channels: ${details.replace(/\n/g, " | ")}`);
    } finally {
      group.loading = false;
    }
  }

  async function refreshLightningMessageChannels() {
    if (!sessionId) {
      addLog("ERROR", "No session cookie found.");
      return;
    }
    const group = treeGroups.lightningMessageChannel;
    if (!group || group.loading) return;
    group.loaded = false;
    group.items = [];
    group.visibleItems = [];
    group.total = 0;
    updateTreeGroupCount(group, 0);
    if (group.button) group.button.setAttribute("aria-expanded", "true");
    if (group.list) group.list.hidden = false;
    await ensureLightningMessageChannelTreeLoaded();
  }

  function removeOpenLightningMessageChannelFile(fullName) {
    const normalizedFullName = String(fullName || "").trim();
    const filesToRemove = openFiles.filter((file) => (
      file.sourceType === "lightning-message-channel"
      && String(file.lightningMessageChannelFullName || "").trim() === normalizedFullName
    ));
    if (!filesToRemove.length) return;

    const removedIds = new Set(filesToRemove.map((file) => file.id));
    const selectedWasRemoved = selectedFile && removedIds.has(selectedFile.id);
    filesToRemove.forEach((file) => fileModels.delete(`${file.bundleName}::${file.path}`));
    for (let index = openFiles.length - 1; index >= 0; index -= 1) {
      if (removedIds.has(openFiles[index].id)) openFiles.splice(index, 1);
    }
    if (selectedWasRemoved) {
      const nextFile = openFiles[0] || null;
      if (nextFile) activateTab(nextFile.id);
      else {
        showWorkspaceReadyState();
        renderTabs();
      }
      return;
    }
    renderTabs();
  }

  async function deleteLightningMessageChannel(channel) {
    const fullName = String(channel?.FullName || channel?.fullName || "").trim();
    const fileName = getLightningMessageChannelFileName(channel);
    if (!sessionId || !fullName) throw new Error("Lightning Message Channel information is unavailable.");
    showDeploymentToast("pending");
    addLog("INFO", `[LIGHTNINGMESSAGECHANNEL] - Deleting ${fileName}, please wait...`);
    try {
      await deleteLightningMessageChannelMetadata(sessionId, fullName, sessionApiOrigin);
      removeOpenLightningMessageChannelFile(fullName);
      await refreshLightningMessageChannels();
      showDeploymentToast("success");
      addLog("SUCCESS", `[LIGHTNINGMESSAGECHANNEL] - Deleted ${fileName}.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  function openDeleteLightningMessageChannelModal(channel) {
    openDeleteExplorerItemConfirmationModal(() => deleteLightningMessageChannel(channel));
  }

  async function openLightningMessageChannelInEditor(channel) {
    const fullName = String(channel?.FullName || channel?.fullName || "").trim();
    if (!fullName) throw new Error("Lightning Message Channel name is unavailable.");
    const fileName = getLightningMessageChannelFileName(channel);
    const source = await fetchLightningMessageChannelSource(fullName);
    const filePath = `message-channels/${fileName}`;
    const bundleName = "Lightning Message Channels";
    const existing = openFiles.find((file) => file.bundleName === bundleName && file.path === filePath);
    if (existing) {
      existing.content = source;
      existing.originalContent = source;
      existing.lightningMessageChannelFullName = fullName;
      existing.dirty = false;
      activateTab(existing.id);
      renderTabs();
      return;
    }

    const fileId = `${bundleName}::${filePath}`;
    openFiles.push({
      id: fileId,
      button: null,
      bundleName,
      path: filePath,
      content: source,
      originalContent: source,
      dirty: false,
      sourceType: "lightning-message-channel",
      lightningMessageChannelFullName: fullName
    });
    renderTabs();
    activateTab(fileId);
  }

  async function fetchLightningMessageChannelSource(fullName) {
    if (!sessionId || !fullName) return "";
    const metadata = await getLightningMessageChannelMetadata(sessionId, fullName, sessionApiOrigin);
    return serializeLightningMessageChannelMetadata(metadata);
  }

  function serializeLightningMessageChannelMetadata(metadata) {
    const fields = Array.isArray(metadata?.lightningMessageFields) ? metadata.lightningMessageFields : [];
    const source = [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<LightningMessageChannel xmlns=\"http://soap.sforce.com/2006/04/metadata\">",
      `    <masterLabel>${escapeXml(metadata?.masterLabel || metadata?.fullName || "")}</masterLabel>`,
      `    <isExposed>${metadata?.isExposed === true ? "true" : "false"}</isExposed>`
    ];
    const description = String(metadata?.description || "").trim();
    if (description) source.push(`    <description>${escapeXml(description)}</description>`);
    fields.forEach((field) => {
      source.push(
        "    <lightningMessageFields>",
        `        <fieldName>${escapeXml(field?.fieldName || "")}</fieldName>`
      );
      const fieldDescription = String(field?.description || "").trim();
      if (fieldDescription) source.push(`        <description>${escapeXml(fieldDescription)}</description>`);
      source.push("    </lightningMessageFields>");
    });
    source.push("</LightningMessageChannel>", "");
    return source.join("\n");
  }

  function parseLightningMessageChannelSource(source, fullName) {
    const document = new DOMParser().parseFromString(String(source || ""), "application/xml");
    const parserError = document.querySelector("parsererror") || (document.documentElement?.localName === "parsererror" ? document.documentElement : null);
    if (parserError) throw new Error(`Invalid Lightning Message Channel XML: ${parserError.textContent?.trim() || "Unable to parse the XML."}`);

    const root = document.documentElement;
    if (root?.localName !== "LightningMessageChannel") {
      throw new Error("The root element must be LightningMessageChannel.");
    }
    const children = Array.from(root.children || []);
    const childText = (name, element = root) => Array.from(element.children || [])
      .find((child) => child.localName === name)?.textContent?.trim() || "";
    const masterLabel = childText("masterLabel");
    if (!masterLabel) throw new Error("Lightning Message Channel masterLabel is required.");

    const isExposedText = childText("isExposed");
    if (isExposedText && !["true", "false"].includes(isExposedText.toLowerCase())) {
      throw new Error("Lightning Message Channel isExposed must be true or false.");
    }
    const usedFieldNames = new Set();
    const lightningMessageFields = children
      .filter((child) => child.localName === "lightningMessageFields")
      .map((field) => ({
        fieldName: childText("fieldName", field),
        description: childText("description", field)
      }));
    lightningMessageFields.forEach((field) => {
      if (!field.fieldName) throw new Error("Every lightningMessageFields entry requires a fieldName.");
      const normalizedName = field.fieldName.toLowerCase();
      if (usedFieldNames.has(normalizedName)) throw new Error(`Duplicate Lightning Message Channel field: ${field.fieldName}.`);
      usedFieldNames.add(normalizedName);
    });

    return {
      fullName: String(fullName || "").trim(),
      masterLabel,
      description: childText("description"),
      isExposed: isExposedText.toLowerCase() === "true",
      lightningMessageFields
    };
  }

  async function deployLightningMessageChannelSource(sessionIdValue, fullName, source) {
    const metadata = parseLightningMessageChannelSource(source, fullName);
    await updateLightningMessageChannelMetadata(sessionIdValue, metadata.fullName, metadata, sessionApiOrigin);
  }

  async function createLightningMessageChannel({ channelName, masterLabel, isExposed, apiVersion, description = "", lightningMessageFields = [] }) {
    if (!sessionId) throw new Error("No session available.");
    showDeploymentToast("pending");
    addLog("INFO", `[LIGHTNINGMESSAGECHANNEL] - Creating ${channelName}, please wait...`);
    try {
      await createLightningMessageChannelMetadata(
        sessionId,
        channelName,
        { masterLabel, isExposed, description, lightningMessageFields },
        sessionApiOrigin,
        apiVersion
      );
      await refreshAndOpenNewLightningMessageChannel(sessionId, channelName);
      showDeploymentToast("success");
      addLog("SUCCESS", `[LIGHTNINGMESSAGECHANNEL] - Created ${channelName} successfully.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function refreshAndOpenNewLightningMessageChannel(sessionIdValue, fullName) {
    const group = treeGroups.lightningMessageChannel;
    if (!group?.list) throw new Error("Lightning Message Channel File Explorer is unavailable.");

    const channels = await listLightningMessageChannels(sessionIdValue, sessionApiOrigin);
    group.items = channels;
    group.total = channels.length;
    group.visibleItems = filterLightningMessageChannels(channels, currentSearchQuery);
    updateTreeGroupCount(group, group.visibleItems.length);
    group.list.replaceChildren(...renderLightningMessageChannelTreeItems(channels));
    group.loaded = true;
    setTreeGroupExpanded("lightningMessageChannel", true);

    const normalizedFullName = String(fullName || "").trim();
    const createdChannel = channels.find((channel) => (
      String(channel?.FullName || channel?.fullName || "").trim() === normalizedFullName
    )) || { FullName: normalizedFullName };
    await openLightningMessageChannelInEditor(createdChannel);
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function renderApexTriggerTreeItems(apexTriggers) {
    const group = treeGroups.trigger;
    if (group) {
      const sourceItems = Array.isArray(group.items) && group.items.length ? group.items : apexTriggers;
      group.items = sourceItems;
      if (!Number.isFinite(group.total) || group.total === 0) {
        group.total = sourceItems.length;
      }
      group.visibleItems = filterApexTriggers(sourceItems, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
    }

    return (group?.visibleItems || apexTriggers)
      .sort((a, b) => String(a.Name || "").localeCompare(String(b.Name || "")))
      .map((apexTrigger) => renderDeletableDeveloperResourceTreeItem({
        fileName: getApexTriggerFileName(apexTrigger),
        icon: "T",
        resource: apexTrigger,
        groupKey: "trigger",
        openResource: () => openApexTriggerInEditor(apexTrigger)
      }));
  }

  function setTreeGroupExpanded(key, expanded, persistState = true) {
    const group = treeGroups[key];
    if (!group?.button || !group.list) return;
    group.button.setAttribute("aria-expanded", String(expanded));
    group.list.hidden = !expanded;
    if (expanded) {
      if (key === "lwc" && !group.loaded) void ensureLwcTreeLoaded();
      if (isAuraTreeGroup(key) && !group.loaded) void ensureAuraTreeLoaded(key);
      if (key === "apex" && !group.loaded) void ensureApexTreeLoaded();
      if (key === "trigger" && !group.loaded) void ensureTriggerTreeLoaded();
      if (key === "vf" && !group.loaded) void ensureVisualforceTreeLoaded();
      if (key === "vfc" && !group.loaded) void ensureVisualforceComponentTreeLoaded();
      if (key === "lightningMessageChannel" && !group.loaded) void ensureLightningMessageChannelTreeLoaded();
    }
    if (persistState) persistExplorerState();
  }

  function updateTreeGroupCount(group, visibleCount) {
    if (!group?.count) return;
    const total = Number.isFinite(group.total) ? group.total : 0;
    const hasSearch = String(currentSearchQuery || "").trim().length > 0;
    group.count.textContent = hasSearch ? `(${visibleCount}/${total})` : `(${total})`;
  }

  function setTreeGroupStatus(group, message) {
    if (!group?.list) return;
    group.list.replaceChildren();
    const item = document.createElement("li");
    item.className = "dc-tree-status";
    item.textContent = message;
    group.list.appendChild(item);
  }

  function applySearchFilter() {
    const lwcGroup = treeGroups.lwc;
    const apexGroup = treeGroups.apex;
    const triggerGroup = treeGroups.trigger;
    const lightningMessageChannelGroup = treeGroups.lightningMessageChannel;

    if (lwcGroup?.loaded && lwcGroup.items) {
      lwcGroup.visibleItems = filterLwcBundles(lwcGroup.items, currentSearchQuery);
      updateTreeGroupCount(lwcGroup, lwcGroup.visibleItems.length);
      if (lwcGroup.list) {
        lwcGroup.list.replaceChildren(...renderLwcTreeItems(lwcGroup.visibleItems));
      }
    }

    auraTreeGroupKeys.forEach((groupKey) => {
      const auraGroup = treeGroups[groupKey];
      if (!auraGroup?.loaded || !auraGroup.items) return;
      auraGroup.visibleItems = filterAuraBundles(auraGroup.items, currentSearchQuery);
      updateTreeGroupCount(auraGroup, auraGroup.visibleItems.length);
      if (auraGroup.list) {
        auraGroup.list.replaceChildren(...renderAuraTreeItems(groupKey));
      }
    });

    if (selectedFile?.sourceType === "aura") {
      currentFileButton?.classList.remove("dc-file-selected");
      currentFileButton = syncActiveTreeSelection(selectedFile);
      currentFileButton?.classList.add("dc-file-selected");
    }

    if (apexGroup?.loaded && apexGroup.items) {
      apexGroup.visibleItems = filterApexClasses(apexGroup.items, currentSearchQuery);
      updateTreeGroupCount(apexGroup, apexGroup.visibleItems.length);
      if (apexGroup.list) {
        apexGroup.list.replaceChildren(...renderApexTreeItems(apexGroup.items));
      }
      if (currentApexFileName) {
        currentFileButton?.classList.remove("dc-file-selected");
        currentFileButton = syncActiveTreeSelection({ sourceType: "apex", path: `apex/${currentApexFileName}` });
        currentFileButton?.classList.add("dc-file-selected");
      }
    }

    if (triggerGroup?.loaded && triggerGroup.items) {
      triggerGroup.visibleItems = filterApexTriggers(triggerGroup.items, currentSearchQuery);
      updateTreeGroupCount(triggerGroup, triggerGroup.visibleItems.length);
      if (triggerGroup.list) {
        triggerGroup.list.replaceChildren(...renderApexTriggerTreeItems(triggerGroup.items));
      }
      if (selectedFile?.sourceType === "apex-trigger" && currentApexTriggerFileName) {
        currentFileButton?.classList.remove("dc-file-selected");
        currentFileButton = restoreActiveTreeSelection("apex-trigger");
        currentFileButton?.classList.add("dc-file-selected");
      }
    }

    if (lightningMessageChannelGroup?.loaded && lightningMessageChannelGroup.items) {
      lightningMessageChannelGroup.visibleItems = filterLightningMessageChannels(lightningMessageChannelGroup.items, currentSearchQuery);
      updateTreeGroupCount(lightningMessageChannelGroup, lightningMessageChannelGroup.visibleItems.length);
      if (lightningMessageChannelGroup.list) {
        lightningMessageChannelGroup.list.replaceChildren(...renderLightningMessageChannelTreeItems(lightningMessageChannelGroup.items));
      }
      if (selectedFile?.sourceType === "lightning-message-channel" && currentLightningMessageChannelFileName) {
        currentFileButton?.classList.remove("dc-file-selected");
        currentFileButton = restoreActiveTreeSelection("lightning-message-channel");
        currentFileButton?.classList.add("dc-file-selected");
      }
    }

    const vfcGroup = treeGroups.vfc;
    if (vfcGroup?.loaded && vfcGroup.items) {
      vfcGroup.visibleItems = filterVisualforceComponents(vfcGroup.items, currentSearchQuery);
      updateTreeGroupCount(vfcGroup, vfcGroup.visibleItems.length);
      if (vfcGroup.list) {
        vfcGroup.list.replaceChildren(...renderVisualforceComponentTreeItems(vfcGroup.items));
      }
      if (selectedFile?.sourceType === "apex-component" && currentVisualforceComponentFileName) {
        currentFileButton?.classList.remove("dc-file-selected");
        currentFileButton = restoreActiveTreeSelection("apex-component");
        currentFileButton?.classList.add("dc-file-selected");
      }
    }

    const vfGroup = treeGroups.vf;
    if (vfGroup?.loaded && vfGroup.items) {
      vfGroup.visibleItems = filterVisualforcePages(vfGroup.items, currentSearchQuery);
      updateTreeGroupCount(vfGroup, vfGroup.visibleItems.length);
      if (vfGroup.list) {
        vfGroup.list.replaceChildren(...renderVisualforceTreeItems(vfGroup.items));
      }
      if (selectedFile?.sourceType === "apex-page" && currentVisualforcePageFileName) {
        currentFileButton?.classList.remove("dc-file-selected");
        currentFileButton = restoreActiveTreeSelection("apex-page");
        currentFileButton?.classList.add("dc-file-selected");
      }
    }
    renderLocalFilesTree();
  }

  function filterLwcBundles(bundles, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return bundles.slice();
    return bundles.filter((bundle) => {
      const name = String(bundle.MasterLabel || bundle.DeveloperName || "").toLowerCase();
      return name.includes(normalizedQuery) || String(bundle.DeveloperName || "").toLowerCase().includes(normalizedQuery);
    });
  }

  function filterApexClasses(apexClasses, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return apexClasses.slice();
    return apexClasses.filter((apexClass) => {
      const name = String(apexClass.Name || "").toLowerCase();
      const fileName = String(getApexFileName(apexClass) || "").toLowerCase();
      return name.includes(normalizedQuery) || fileName.includes(normalizedQuery);
    });
  }

  function renderLwcTreeItems(bundles) {
    return bundles.map((bundle) => {
      const row = document.createElement("li");
      row.innerHTML = `<div class="dc-bundle-node" data-bundle-name="${escapeHtml(bundle.DeveloperName)}"><div class="dc-bundle-row"><button type="button" class="dc-tree-item dc-bundle-toggle" data-bundle-name="${escapeHtml(bundle.DeveloperName)}"><span class="dc-bundle-caret">▸</span><span>${escapeHtml(bundle.MasterLabel || bundle.DeveloperName)}</span></button><button type="button" class="dc-tree-actions-trigger" aria-label="${escapeHtml(bundle.DeveloperName)} actions" title="${escapeHtml(bundle.DeveloperName)} actions">${iconMoreVertical()}</button></div><div class="dc-bundle-children" data-bundle-children="${escapeHtml(bundle.DeveloperName)}"></div></div>`;
      const button = row.querySelector(".dc-bundle-toggle");
      const actionsButton = row.querySelector(".dc-tree-actions-trigger");
      button?.addEventListener("click", (event) => {
        event.stopPropagation();
        void toggleLwcBundleNode(bundle.DeveloperName);
      });
      actionsButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openExplorerActionsMenu(actionsButton, [
          { label: "Add New File", icon: iconFileAdd(), onSelect: () => openCreateLwcResourceModal(bundle) },
          { label: "Delete", icon: iconTrash(), destructive: true, onSelect: () => openDeleteLwcBundleModal(bundle) }
        ]);
      });
      return row;
    });
  }

  async function toggleLwcBundleNode(bundleName) {
    const bundleNode = findLwcBundleNode(bundleName);
    if (!bundleNode) return;
    const isExpanded = bundleNode.classList.toggle("dc-bundle-expanded");
    const caret = bundleNode.querySelector(".dc-bundle-caret");
    if (caret) caret.textContent = isExpanded ? "▾" : "▸";
    if (!isExpanded) return;
    const bundleChildren = bundleNode.querySelector(`[data-bundle-children="${bundleName}"]`);
    if (bundleChildren?.childElementCount) return;
    await loadLwcBundleFiles(bundleName, bundleNode);
  }

  async function loadLwcBundleFiles(bundleName, bundleNode = findLwcBundleNode(bundleName)) {
    const bundleChildren = bundleNode?.querySelector(`[data-bundle-children="${bundleName}"]`);
    if (!bundleChildren) return [];
    bundleChildren.textContent = "Loading files...";
    addLog("INFO", `[LIGHTNINGWEBCOMPONENT] - Retrieving resources for ${bundleName}.`);
    try {
      const bundleRecord = treeGroups.lwc.items.find((item) => item.DeveloperName === bundleName);
      if (!bundleRecord?.Id) throw new Error(`Unable to find LightningComponentBundle Id for ${bundleName}.`);
      const resources = await listLwcComponentResources(sessionId, bundleRecord.Id);
      const files = resources.map(normalizeResourceFile).filter((file) => file.path && file.path !== "unknown");
      const filteredFiles = filterBundleFiles(files, currentSearchQuery);
      bundleChildren.replaceChildren(...renderLwcBundleFiles(bundleName, filteredFiles));
      addLog("SUCCESS", `[LIGHTNINGWEBCOMPONENT] - Retrieved ${files.length} files for ${bundleName}.`);
      return files;
    } catch (error) {
      const details = getErrorDetails(error.message || error);
      bundleChildren.textContent = `Error: ${details}`;
      addLog("ERROR", `[LIGHTNINGWEBCOMPONENT] - File load failed for ${bundleName}: ${details.replace(/\n/g, " | ")}`);
      return [];
    }
  }

  function filterAuraBundles(bundles, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return bundles.slice();
    return bundles.filter((bundle) => {
      const name = String(bundle.DeveloperName || "").toLowerCase();
      const label = String(bundle.MasterLabel || "").toLowerCase();
      return name.includes(normalizedQuery) || label.includes(normalizedQuery);
    });
  }

  function normalizeAuraDefinition(definition, bundleName) {
    const defType = String(definition?.DefType || "").trim();
    const format = String(definition?.Format || "").trim();
    const content = definition?.Source ?? definition?.Body ?? definition?.Markup ?? definition?.ComponentSource ?? "";
    const fileTypeKey = `${defType}.${format}`.toUpperCase();
    const baseName = String(bundleName || "auradefinition").trim();
    const fileNameMap = {
      "COMPONENT.XML": `${baseName}.cmp`,
      "CONTROLLER.JS": `${baseName}Controller.js`,
      "HELPER.JS": `${baseName}Helper.js`,
      "STYLE.CSS": `${baseName}.css`,
      "RENDERER.JS": `${baseName}Renderer.js`,
      "DESIGN.XML": `${baseName}.design`,
      "DOCUMENTATION.XML": `${baseName}.auradoc`,
      "SVG.SVG": `${baseName}.svg`,
      "APPLICATION.XML": `${baseName}.app`,
      "EVENT.XML": `${baseName}.evt`,
      "INTERFACE.XML": `${baseName}.intf`,
      "TOKEN.XML": `${baseName}.tokens`,
      "TOKENS.XML": `${baseName}.tokens`
    };
    const fileName = fileNameMap[fileTypeKey] || [defType || "auradefinition", format].filter(Boolean).join(".").toLowerCase();
    return {
      id: definition?.Id || null,
      bundleId: definition?.AuraDefinitionBundleId || null,
      path: fileName,
      fileName,
      content,
      defType,
      format
    };
  }

  async function ensureAuraTreeLoaded(groupKey = "aura") {
    const group = treeGroups[groupKey];
    if (group.loaded || group.loading) return;
    group.loading = true;
    setTreeGroupStatus(group, `Loading ${String(group.displayName || "Aura bundles").toUpperCase()}...`);
    addLog("INFO", `[${group.logTag || "AURACOMPONENT"}] - Retrieving resources from org... please wait.`);
    try {
      const bundles = await listAuraBundles(sessionId, group.definitionTypes);
      group.items = bundles;
      group.total = bundles.length;
      group.visibleItems = filterAuraBundles(bundles, currentSearchQuery);
      updateTreeGroupCount(group, group.visibleItems.length);
      if (group.list) {
        group.list.replaceChildren(...renderAuraTreeItems(groupKey));
      }
      addLog("SUCCESS", `[${group.logTag || "AURACOMPONENT"}] - Retrieved ${bundles.length} bundles successfully.`);
      group.loaded = true;
    } catch (error) {
      const details = getErrorDetails(error.message || error);
      setTreeGroupStatus(group, `Error: ${details}`);
      addLog("ERROR", `[${group.logTag || "AURACOMPONENT"}] - Failed to retrieve bundles: ${details.replace(/\n/g, " | ")}`);
    } finally {
      group.loading = false;
    }
  }

  async function refreshAuraBundles(groupKey = "aura") {
    if (!sessionId) {
      addLog("ERROR", "No session cookie found.");
      return;
    }
    const group = treeGroups[groupKey];
    if (!isAuraTreeGroup(groupKey) || !group || group.loading) return;
    group.loaded = false;
    group.items = [];
    group.visibleItems = [];
    group.total = 0;
    updateTreeGroupCount(group, 0);
    ensureAuraTreeGroupExpanded(groupKey);
    await ensureAuraTreeLoaded(groupKey);
  }

  function renderAuraTreeItems(groupKey) {
    const group = treeGroups[groupKey];
    if (!group) return [];
    const sourceItems = Array.isArray(group.items) ? group.items : [];
    group.items = sourceItems;
    group.total = sourceItems.length;
    group.visibleItems = filterAuraBundles(sourceItems, currentSearchQuery);
    updateTreeGroupCount(group, group.visibleItems.length);

    return group.visibleItems
      .sort((a, b) => String(a.DeveloperName || "").localeCompare(String(b.DeveloperName || "")))
      .map((bundle) => {
        const row = document.createElement("li");
        row.innerHTML = `<div class="dc-bundle-node dc-aura-node" data-bundle-name="${bundle.DeveloperName}"><button type="button" class="dc-tree-item dc-bundle-toggle" data-bundle-name="${bundle.DeveloperName}"><span class="dc-bundle-caret">▸</span><span>${escapeHtml(bundle.MasterLabel || bundle.DeveloperName)}</span></button><div class="dc-bundle-children" data-bundle-children="${bundle.DeveloperName}"></div></div>`;
        const button = row.querySelector("button");
        const supportsActions = ["aura", "auraApplication", "auraEvent", "auraInterface", "auraToken"].includes(groupKey);
        if (supportsActions && button?.parentElement) {
          const bundleRow = document.createElement("div");
          bundleRow.className = "dc-bundle-row";
          button.parentElement.insertBefore(bundleRow, button);
          bundleRow.appendChild(button);
          const actionsButton = document.createElement("button");
          actionsButton.type = "button";
          actionsButton.className = "dc-tree-actions-trigger";
          actionsButton.setAttribute("aria-label", `${bundle.DeveloperName} actions`);
          actionsButton.title = `${bundle.DeveloperName} actions`;
          actionsButton.innerHTML = iconMoreVertical();
          actionsButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const actions = [];
            if (groupKey === "aura" || groupKey === "auraApplication") {
              actions.push({ label: "Add New File", icon: iconFileAdd(), onSelect: () => openCreateAuraResourceModal(bundle, groupKey) });
            }
            actions.push({ label: "Delete", icon: iconTrash(), destructive: true, onSelect: () => openDeleteAuraBundleModal(bundle, groupKey) });
            openExplorerActionsMenu(actionsButton, actions);
          });
          bundleRow.appendChild(actionsButton);
        }
        button?.addEventListener("click", async (event) => {
          const bundleName = button.getAttribute("data-bundle-name");
          const bundleNode = button.closest(".dc-bundle-node");
          const bundleChildren = bundleNode?.querySelector(`[data-bundle-children="${bundleName}"]`);
          if (!bundleNode) return;
          event.stopPropagation();
          const isExpanded = bundleNode.classList.toggle("dc-bundle-expanded");
          const caret = bundleNode.querySelector(".dc-bundle-caret");
          if (caret) caret.textContent = isExpanded ? "▾" : "▸";
          if (!isExpanded) return;
          if (bundleChildren && bundleChildren.childElementCount > 0) return;
          if (bundleChildren) bundleChildren.textContent = "Loading files...";
          try {
            const bundleRecord = group.items.find((item) => item.DeveloperName === bundleName);
            if (!bundleRecord?.Id) throw new Error(`Unable to find AuraDefinitionBundle Id for ${bundleName}.`);
            const definitions = await listAuraDefinitionsForBundle(sessionId, bundleRecord.Id);
            const files = definitions.map((definition) => normalizeAuraDefinition(definition, bundleName)).filter((file) => file.path && file.path !== "unknown");
            const filteredFiles = filterBundleFiles(files, currentSearchQuery);
            if (bundleChildren) bundleChildren.replaceChildren(...renderAuraBundleFiles(bundleName, filteredFiles, openAuraFileInEditor, groupKey));
            addLog("SUCCESS", `[${group.logTag || "AURACOMPONENT"}] - Retrieved ${files.length} files for ${bundleName} successfully.`);
          } catch (error) {
            const details = getErrorDetails(error.message || error);
            if (bundleChildren) bundleChildren.textContent = `Error: ${details}`;
            addLog("ERROR", `[${group.logTag || "AURACOMPONENT"}] - File load failed for ${bundleName}: ${details.replace(/\n/g, " | ")}`);
          }
        });
        return row;
      });
  }

  function renderAuraBundleFiles(bundleName, files, onSelectFile, auraTreeGroup) {
    return files
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "dc-file-row";
        row.setAttribute("data-file-path", file.path);
        row.dataset.auraDefType = String(file.defType || "").toLowerCase();
        row.dataset.auraFormat = String(file.format || "").toLowerCase();
        const kind = /\.(cmp|app|evt|intf|tokens)$/i.test(file.fileName || file.path)
          ? "xml"
          : /\.js$/i.test(file.fileName || file.path)
          ? "js"
          : /\.css$/i.test(file.fileName || file.path)
          ? "css"
          : /\.svg$/i.test(file.fileName || file.path)
          ? "svg"
          : /\.design|\.auradoc$/i.test(file.fileName || file.path)
          ? "xml"
          : "other";
        row.innerHTML = `<span class="dc-file-icon" data-kind="${kind}">${getIconForPath(file.fileName || file.path)}</span><span class="dc-file-label">${escapeHtml(file.fileName || file.path)}</span>`;
        row.addEventListener("click", (event) => {
          event.stopPropagation();
          Promise.resolve(onSelectFile(bundleName, file.path, file.content, file.defType, file.format, auraTreeGroup));
        });
        if (["aura", "auraApplication", "auraEvent", "auraInterface", "auraToken"].includes(auraTreeGroup)) {
          const wrapper = document.createElement("div");
          wrapper.className = "dc-file-row-wrap";
          const actionsButton = document.createElement("button");
          actionsButton.type = "button";
          actionsButton.className = "dc-tree-actions-trigger";
          actionsButton.setAttribute("aria-label", `${file.fileName || file.path} actions`);
          actionsButton.title = `${file.fileName || file.path} actions`;
          actionsButton.innerHTML = iconMoreVertical();
          actionsButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openExplorerActionsMenu(actionsButton, [
              { label: "Delete", icon: iconTrash(), destructive: true, onSelect: () => openDeleteAuraDefinitionModal(bundleName, file, auraTreeGroup) }
            ]);
          });
          wrapper.append(row, actionsButton);
          return wrapper;
        }
        return row;
      });
  }

  function filterBundleFiles(files, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return files.slice();
    return files.filter((file) => String(file.fileName || file.path || "").toLowerCase().includes(normalizedQuery));
  }

  function normalizeResourceFile(resource) {
    const rawPath = String(resource.FilePath || "").replace(/\\/g, "/").trim();
    const path = rawPath || "unknown";
    const fileName = path.split("/").pop() || "unknown";
    return {
      id: resource.Id || null,
      bundleId: resource.LightningComponentBundleId || null,
      format: resource.Format || "",
      path: path || "unknown",
      fileName,
      content: resource.Source ?? ""
    };
  }

  function renderLwcBundleFiles(bundleName, files) {
    return files
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => {
        const row = document.createElement("div");
        row.className = "dc-file-row-wrap";
        const kind = /\.html?$/i.test(file.fileName || file.path)
          ? "html"
          : /\.js$/i.test(file.fileName || file.path)
          ? "js"
          : /\.css$/i.test(file.fileName || file.path)
          ? "css"
          : /\.xml$/i.test(file.fileName || file.path)
          ? "xml"
          : "other";
        row.innerHTML = `<button type="button" class="dc-file-row" data-file-path="${escapeHtml(file.path)}"><span class="dc-file-icon" data-kind="${kind}">${getIconForPath(file.fileName || file.path)}</span><span class="dc-file-label">${escapeHtml(file.fileName || file.path)}</span></button><button type="button" class="dc-tree-actions-trigger" aria-label="${escapeHtml(file.fileName || file.path)} actions" title="${escapeHtml(file.fileName || file.path)} actions">${iconMoreVertical()}</button>`;
        const fileButton = row.querySelector(".dc-file-row");
        const actionsButton = row.querySelector(".dc-tree-actions-trigger");
        fileButton?.addEventListener("click", (event) => {
          event.stopPropagation();
          void openFileInEditor(bundleName, file.path, file.content);
        });
        actionsButton?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openExplorerActionsMenu(actionsButton, [
            { label: "Rename", icon: iconRename(), onSelect: () => openRenameLwcResourceModal(bundleName, file) },
            { label: "Delete", icon: iconTrash(), destructive: true, onSelect: () => openDeleteLwcResourceModal(bundleName, file) }
          ]);
        });
        return row;
      });
  }

  function validateLwcResourceName(value, label = "Name") {
    const normalized = String(value || "").trim();
    if (!normalized) return `${label} is required.`;
    if (normalized.includes(".")) return `${label} must not include a file extension.`;
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(normalized)) {
      return `${label} must start with a letter and can contain only letters, numbers, hyphens, and underscores.`;
    }
    return "";
  }

  function getLwcResourceExtension(filePath) {
    const fileName = String(filePath || "").split("/").pop() || "";
    if (fileName.toLowerCase().endsWith(".js-meta.xml")) return ".js-meta.xml";
    const extensionIndex = fileName.lastIndexOf(".");
    return extensionIndex > 0 ? fileName.slice(extensionIndex) : "";
  }

  function getLwcResourceBaseName(filePath) {
    const fileName = String(filePath || "").split("/").pop() || "";
    const extension = getLwcResourceExtension(fileName);
    return extension ? fileName.slice(0, -extension.length) : fileName;
  }

  function getLwcResourcePath(bundleName, resourceName, type) {
    const extensions = { html: ".html", js: ".js", css: ".css", svg: ".svg" };
    const extension = extensions[type];
    if (!extension) throw new Error("Select a valid LWC file type.");
    return `lwc/${bundleName}/${resourceName}${extension}`;
  }

  function getLwcResourceStarterSource(resourceName, type) {
    if (type === "html") {
      return ["<template>", "    <!-- TODO: Add your component markup here. -->", "</template>", ""].join("\n");
    }
    if (type === "js") {
      return [`// ${resourceName}.js`, "", "// TODO: Add your JavaScript here.", ""].join("\n");
    }
    if (type === "css") {
      return ["/* TODO: Add your component styling here. */", ""].join("\n");
    }
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">',
      "    <!-- TODO: Add your SVG markup here. -->",
      "</svg>",
      ""
    ].join("\n");
  }

  async function refreshLwcBundles() {
    if (!sessionId) {
      addLog("ERROR", "No session cookie found.");
      return;
    }
    const group = treeGroups.lwc;
    if (!group || group.loading) return;
    group.loaded = false;
    group.items = [];
    group.visibleItems = [];
    group.total = 0;
    updateTreeGroupCount(group, 0);
    ensureLwcTreeGroupExpanded();
    await ensureLwcTreeLoaded();
  }

  async function refreshLwcBundleFiles(bundleName, openFilePath = "") {
    ensureLwcTreeGroupExpanded();
    await ensureLwcTreeLoaded();
    const bundleNode = await waitForLwcBundleNode(bundleName);
    if (!bundleNode) return [];
    ensureBundleNodeExpanded(bundleName, findLwcBundleNode);
    const files = await loadLwcBundleFiles(bundleName, bundleNode);
    const fileToOpen = files.find((file) => file.path === openFilePath);
    if (fileToOpen) await openFileInEditor(bundleName, fileToOpen.path, fileToOpen.content);
    return files;
  }

  function removeOpenLwcFiles(bundleName, filePath = "") {
    const filesToRemove = openFiles.filter((file) => (
      file.sourceType === "bundle"
      && file.bundleName === bundleName
      && (!filePath || file.path === filePath)
    ));
    if (!filesToRemove.length) return;

    const removedIds = new Set(filesToRemove.map((file) => file.id));
    const selectedWasRemoved = selectedFile && removedIds.has(selectedFile.id);
    filesToRemove.forEach((file) => {
      const modelKey = `${file.bundleName}::${file.path}`;
      fileModels.delete(modelKey);
    });
    for (let index = openFiles.length - 1; index >= 0; index -= 1) {
      if (removedIds.has(openFiles[index].id)) openFiles.splice(index, 1);
    }
    if (selectedWasRemoved) {
      const nextFile = openFiles[0] || null;
      if (nextFile) activateTab(nextFile.id);
      else {
        showWorkspaceReadyState();
        renderTabs();
      }
      return;
    }
    renderTabs();
  }

  function renameOpenLwcFile(bundleName, oldPath, newPath) {
    const openFile = openFiles.find((file) => file.sourceType === "bundle" && file.bundleName === bundleName && file.path === oldPath);
    if (!openFile) return;
    const oldModelKey = `${bundleName}::${oldPath}`;
    const newModelKey = `${bundleName}::${newPath}`;
    const model = fileModels.get(oldModelKey);
    if (model) {
      fileModels.delete(oldModelKey);
      fileModels.set(newModelKey, model);
    }
    openFile.path = newPath;
    openFile.id = `${bundleName}::${newPath}`;
    openFile.button = null;
    if (selectedFile === openFile) {
      loadSelectedFileIntoEditor(bundleName, newPath, openFile.content);
      updateEditorPathLabel(bundleName, newPath);
    }
    renderTabs();
  }

  async function createLwcResource(bundle, resourceName, type) {
    if (!sessionId) throw new Error("No session available.");
    const bundleName = String(bundle?.DeveloperName || "").trim();
    const bundleId = bundle?.Id;
    if (!bundleName || !bundleId) throw new Error("Lightning Web Component bundle information is unavailable.");
    const filePath = getLwcResourcePath(bundleName, resourceName, type);
    showDeploymentToast("pending");
    addLog("INFO", `[LIGHTNINGWEBCOMPONENT] - Creating ${filePath}, please wait...`);
    try {
      const resources = await listLwcComponentResources(sessionId, bundleId);
      if (resources.some((resource) => String(resource.FilePath || "").toLowerCase() === filePath.toLowerCase())) {
        throw new Error(`${filePath.split("/").pop()} already exists in ${bundleName}.`);
      }
      await createToolingRecord(sessionId, "LightningComponentResource", {
        LightningComponentBundleId: bundleId,
        Format: type,
        FilePath: filePath,
        Source: getLwcResourceStarterSource(resourceName, type)
      }, sessionApiOrigin);
      await refreshLwcBundleFiles(bundleName, filePath);
      showDeploymentToast("success");
      addLog("SUCCESS", `[LIGHTNINGWEBCOMPONENT] - Created ${filePath.split("/").pop()} in ${bundleName}.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function renameLwcResource(bundleName, resource, nextName) {
    if (!sessionId || !resource?.id) throw new Error("Lightning Web Component resource information is unavailable.");
    const extension = getLwcResourceExtension(resource.path);
    const folderPath = String(resource.path || "").split("/").slice(0, -1).join("/");
    const nextPath = `${folderPath}/${nextName}${extension}`;
    if (nextPath === resource.path) return;
    showDeploymentToast("pending");
    addLog("INFO", `[LIGHTNINGWEBCOMPONENT] - Renaming ${resource.fileName}, please wait...`);
    try {
      const bundle = treeGroups.lwc.items.find((item) => item.DeveloperName === bundleName);
      const resources = bundle?.Id ? await listLwcComponentResources(sessionId, bundle.Id) : [];
      if (resources.some((item) => String(item.FilePath || "").toLowerCase() === nextPath.toLowerCase())) {
        throw new Error(`${nextPath.split("/").pop()} already exists in ${bundleName}.`);
      }
      await updateToolingRecord(sessionId, "LightningComponentResource", resource.id, { FilePath: nextPath }, sessionApiOrigin);
      renameOpenLwcFile(bundleName, resource.path, nextPath);
      await refreshLwcBundleFiles(bundleName, nextPath);
      showDeploymentToast("success");
      addLog("SUCCESS", `[LIGHTNINGWEBCOMPONENT] - Renamed ${resource.fileName} to ${nextPath.split("/").pop()}.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function deleteLwcResource(bundleName, resource) {
    if (!sessionId || !resource?.id) return;
    showDeploymentToast("pending");
    addLog("INFO", `[LIGHTNINGWEBCOMPONENT] - Deleting ${resource.fileName}, please wait...`);
    try {
      await deleteToolingRecord(sessionId, "LightningComponentResource", resource.id, sessionApiOrigin);
      removeOpenLwcFiles(bundleName, resource.path);
      await refreshLwcBundleFiles(bundleName);
      showDeploymentToast("success");
      addLog("SUCCESS", `[LIGHTNINGWEBCOMPONENT] - Deleted ${resource.fileName}.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function deleteLwcBundle(bundle) {
    if (!sessionId || !bundle?.Id) throw new Error("Lightning Web Component bundle information is unavailable.");
    const bundleName = String(bundle.DeveloperName || "").trim();
    showDeploymentToast("pending");
    addLog("INFO", `[LIGHTNINGWEBCOMPONENT] - Deleting ${bundleName}, please wait...`);
    try {
      await deleteToolingRecord(sessionId, "LightningComponentBundle", bundle.Id, sessionApiOrigin);
      removeOpenLwcFiles(bundleName);
      await refreshLwcBundles();
      showDeploymentToast("success");
      addLog("SUCCESS", `[LIGHTNINGWEBCOMPONENT] - Deleted ${bundleName}.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  function openCreateLwcResourceModal(bundle) {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-lwc dc-lwc-resource-modal">
        <div class="dc-modal-header">
          <h3>New File (${escapeHtml(bundle.MasterLabel || bundle.DeveloperName)})</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="resourceName" autocomplete="off" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Type</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><div class="dc-select-wrap"><select class="dc-select" name="resourceType"><option value="" selected disabled>Select file type</option><option value="html">HTML</option><option value="js">JavaScript</option><option value="css">CSS</option><option value="svg">SVG</option></select></div></label>
          </div>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;
    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const resourceNameInput = overlay.querySelector('[name="resourceName"]');
    const resourceTypeInput = overlay.querySelector('[name="resourceType"]');
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    resourceNameInput?.addEventListener("input", clearFormMessage);
    resourceTypeInput?.addEventListener("change", clearFormMessage);
    resourceNameInput?.addEventListener("blur", () => {
      const validationMessage = validateLwcResourceName(resourceNameInput.value);
      if (validationMessage) showFormMessage(validationMessage);
    });
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const resourceName = resourceNameInput?.value.trim() || "";
      const resourceType = resourceTypeInput?.value || "";
      clearFormMessage();
      const validationMessage = validateLwcResourceName(resourceName);
      if (validationMessage) return showFormMessage(validationMessage);
      if (!resourceType) return showFormMessage("Type is required.");
      try {
        await createLwcResource(bundle, resourceName, resourceType);
        close();
      } catch (error) {
        showFormMessage(error.message || "The Lightning Web Component file could not be created.");
      }
    });
    document.body.appendChild(overlay);
    resourceNameInput?.focus();
  }

  function openRenameLwcResourceModal(bundleName, resource) {
    const oldName = getLwcResourceBaseName(resource.path);
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-lwc dc-lwc-resource-modal">
        <div class="dc-modal-header">
          <h3>Rename File</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field"><span class="dc-field-label-line"><span class="dc-field-label-text">Old Name</span></span><input class="dc-input" type="text" name="oldName" value="${escapeHtml(oldName)}" readonly /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">New Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="newName" value="${escapeHtml(oldName)}" autocomplete="off" /></label>
          </div>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-update>Update</button>
        </div>
      </div>
    `;
    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const newNameInput = overlay.querySelector('[name="newName"]');
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    newNameInput?.addEventListener("input", clearFormMessage);
    newNameInput?.addEventListener("blur", () => {
      const validationMessage = validateLwcResourceName(newNameInput.value, "New Name");
      if (validationMessage) showFormMessage(validationMessage);
    });
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-update]")?.addEventListener("click", async () => {
      const nextName = newNameInput?.value.trim() || "";
      clearFormMessage();
      const validationMessage = validateLwcResourceName(nextName, "New Name");
      if (validationMessage) return showFormMessage(validationMessage);
      try {
        await renameLwcResource(bundleName, resource, nextName);
        close();
      } catch (error) {
        showFormMessage(error.message || "The Lightning Web Component file could not be renamed.");
      }
    });
    document.body.appendChild(overlay);
    newNameInput?.focus();
    newNameInput?.select();
  }

  function openDeleteLwcBundleModal(bundle) {
    openDeleteExplorerItemConfirmationModal(() => deleteLwcBundle(bundle));
  }

  function openDeleteLwcResourceModal(bundleName, resource) {
    openDeleteExplorerItemConfirmationModal(() => deleteLwcResource(bundleName, resource));
  }

  function openDeleteExplorerItemConfirmationModal(onProceed) {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay dc-confirm-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-confirm-modal dc-save-confirm-modal dc-delete-confirm-modal">
        <div class="dc-modal-body">
          <p class="dc-confirm-message"><span class="dc-delete-warning-icon" aria-hidden="true">${iconWarning()}</span>This action is permanent and cannot be undone. Are you sure you want to proceed?</p>
        </div>
        <div class="dc-modal-footer dc-confirm-footer">
          <button type="button" class="dc-button dc-button-danger" data-proceed>Proceed</button>
          <button type="button" class="dc-button" data-cancel>Cancel</button>
        </div>
      </div>
    `;
    const close = () => overlay.remove();
    const proceedButton = overlay.querySelector("[data-proceed]");
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      proceedButton?.click();
    });
    proceedButton?.addEventListener("click", async () => {
      try {
        await onProceed?.();
        close();
      } catch {
        // The existing deployment error logger and toast report the failure.
      }
    });
    document.body.appendChild(overlay);
    proceedButton?.focus();
  }

  function getAuraResourceDefinition(bundleName, type) {
    const normalizedType = String(type || "").trim().toLowerCase();
    const sources = {
      component: {
        label: "Component",
        defType: "COMPONENT",
        format: "XML",
        source: [
          '<aura:component access="global">',
          "    <!-- TODO: Add your component markup here. -->",
          "</aura:component>",
          ""
        ].join("\n")
      },
      application: {
        label: "Application",
        defType: "APPLICATION",
        format: "XML",
        source: [
          '<aura:application access="global">',
          "    <!-- TODO: Add your application markup here. -->",
          "</aura:application>",
          ""
        ].join("\n")
      },
      controller: {
        label: "Controller",
        defType: "CONTROLLER",
        format: "JS",
        source: [
          "({",
          "    // TODO: Add your client-side controller actions here.",
          "})",
          ""
        ].join("\n")
      },
      helper: {
        label: "Helper",
        defType: "HELPER",
        format: "JS",
        source: [
          "({",
          "    // TODO: Add helper methods here.",
          "})",
          ""
        ].join("\n")
      },
      renderer: {
        label: "Renderer",
        defType: "RENDERER",
        format: "JS",
        source: [
          "({",
          "    // TODO: Add custom rendering hooks here.",
          "})",
          ""
        ].join("\n")
      },
      style: {
        label: "Style",
        defType: "STYLE",
        format: "CSS",
        source: [
          ".THIS {",
          "    /* TODO: Add component styling here. */",
          "}",
          ""
        ].join("\n")
      },
      design: {
        label: "Design",
        defType: "DESIGN",
        format: "XML",
        source: [
          "<design:component>",
          "    <!-- TODO: Add design-time configuration here. -->",
          "</design:component>",
          ""
        ].join("\n")
      },
      documentation: {
        label: "Documentation",
        defType: "DOCUMENTATION",
        format: "XML",
        source: [
          "<aura:documentation>",
          "    <!-- TODO: Add component documentation here. -->",
          "</aura:documentation>",
          ""
        ].join("\n")
      },
      svg: {
        label: "SVG",
        defType: "SVG",
        format: "SVG",
        source: [
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">',
          "    <!-- TODO: Add your SVG markup here. -->",
          "</svg>",
          ""
        ].join("\n")
      }
    };
    const definition = sources[normalizedType];
    if (!definition) throw new Error("Select a valid Aura file type.");
    return { ...definition, bundleName: String(bundleName || "").trim() };
  }

  async function refreshAuraBundleFiles(bundleName, auraTreeGroup = "aura", openDefinition = null) {
    ensureAuraTreeGroupExpanded(auraTreeGroup);
    await ensureAuraTreeLoaded(auraTreeGroup);
    const bundleNode = await waitForAuraBundleNode(bundleName, auraTreeGroup);
    if (!bundleNode) return [];
    ensureBundleNodeExpanded(bundleName, findAuraComponentNode, auraTreeGroup);
    const bundleRecord = findAuraBundleRecord(bundleName, auraTreeGroup);
    if (!bundleRecord?.Id) throw new Error(`Unable to find AuraDefinitionBundle Id for ${bundleName}.`);
    const definitions = await listAuraDefinitionsForBundle(sessionId, bundleRecord.Id);
    const files = definitions
      .map((definition) => normalizeAuraDefinition(definition, bundleName))
      .filter((file) => file.path && file.path !== "unknown");
    const bundleChildren = bundleNode.querySelector(`[data-bundle-children="${bundleName}"]`);
    if (bundleChildren) {
      bundleChildren.replaceChildren(...renderAuraBundleFiles(bundleName, filterBundleFiles(files, currentSearchQuery), openAuraFileInEditor, auraTreeGroup));
    }
    const defType = String(openDefinition?.defType || "").toUpperCase();
    const format = String(openDefinition?.format || "").toUpperCase();
    const fileToOpen = files.find((file) => (
      String(file.defType || "").toUpperCase() === defType
      && String(file.format || "").toUpperCase() === format
    ));
    if (fileToOpen) {
      await openAuraFileInEditor(
        bundleName,
        fileToOpen.path,
        fileToOpen.content,
        fileToOpen.defType,
        fileToOpen.format,
        auraTreeGroup,
        bundleRecord.Id
      );
    }
    return files;
  }

  function removeOpenAuraFiles(bundleName, auraTreeGroup = "aura", filePath = "") {
    const filesToRemove = openFiles.filter((file) => (
      file.sourceType === "aura"
      && file.auraTreeGroup === auraTreeGroup
      && file.bundleName === bundleName
      && (!filePath || file.path === filePath)
    ));
    if (!filesToRemove.length) return;

    const removedIds = new Set(filesToRemove.map((file) => file.id));
    const selectedWasRemoved = selectedFile && removedIds.has(selectedFile.id);
    filesToRemove.forEach((file) => {
      fileModels.delete(`${file.bundleName}::${file.path}`);
    });
    for (let index = openFiles.length - 1; index >= 0; index -= 1) {
      if (removedIds.has(openFiles[index].id)) openFiles.splice(index, 1);
    }
    if (selectedWasRemoved) {
      const nextFile = openFiles[0] || null;
      if (nextFile) activateTab(nextFile.id);
      else {
        showWorkspaceReadyState();
        renderTabs();
      }
      return;
    }
    renderTabs();
  }

  async function createAuraResource(bundle, type, auraTreeGroup = "aura") {
    if (!sessionId) throw new Error("No session available.");
    const bundleName = String(bundle?.DeveloperName || "").trim();
    const bundleId = bundle?.Id;
    const logTag = treeGroups[auraTreeGroup]?.logTag || "AURACOMPONENT";
    if (!bundleName || !bundleId) throw new Error("Aura bundle information is unavailable.");
    const definition = getAuraResourceDefinition(bundleName, type);
    showDeploymentToast("pending");
    addLog("INFO", `[${logTag}] - Creating ${definition.label} for ${bundleName}, please wait...`);
    try {
      const existingDefinitions = await listAuraDefinitionsForBundle(sessionId, bundleId);
      const alreadyExists = existingDefinitions.some((item) => (
        String(item.DefType || "").toUpperCase() === definition.defType
        && String(item.Format || "").toUpperCase() === definition.format
      ));
      if (alreadyExists) throw new Error(`${definition.label} already exists in ${bundleName}.`);
      await createAuraDefinitionResources(sessionId, bundleId, [definition]);
      await refreshAuraBundleFiles(bundleName, auraTreeGroup, definition);
      showDeploymentToast("success");
      addLog("SUCCESS", `[${logTag}] - Created ${definition.label} for ${bundleName}.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function deleteAuraDefinition(bundleName, definition, auraTreeGroup = "aura") {
    if (!sessionId || !definition?.id) throw new Error("Aura file information is unavailable.");
    const fileName = definition.fileName || definition.path || "Aura definition";
    const logTag = treeGroups[auraTreeGroup]?.logTag || "AURACOMPONENT";
    showDeploymentToast("pending");
    addLog("INFO", `[${logTag}] - Deleting ${fileName}, please wait...`);
    try {
      await deleteToolingRecord(sessionId, "AuraDefinition", definition.id, sessionApiOrigin);
      removeOpenAuraFiles(bundleName, auraTreeGroup, definition.path);
      await refreshAuraBundleFiles(bundleName, auraTreeGroup);
      showDeploymentToast("success");
      addLog("SUCCESS", `[${logTag}] - Deleted ${fileName}.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function deleteAuraBundle(bundle, auraTreeGroup = "aura") {
    if (!sessionId || !bundle?.Id) throw new Error("Aura bundle information is unavailable.");
    const bundleName = String(bundle.DeveloperName || "").trim();
    const logTag = treeGroups[auraTreeGroup]?.logTag || "AURACOMPONENT";
    showDeploymentToast("pending");
    addLog("INFO", `[${logTag}] - Deleting ${bundleName}, please wait...`);
    try {
      await deleteToolingRecord(sessionId, "AuraDefinitionBundle", bundle.Id, sessionApiOrigin);
      removeOpenAuraFiles(bundleName, auraTreeGroup);
      await refreshAuraBundles(auraTreeGroup);
      showDeploymentToast("success");
      addLog("SUCCESS", `[${logTag}] - Deleted ${bundleName}.`);
    } catch (error) {
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  function openCreateAuraResourceModal(bundle, auraTreeGroup = "aura") {
    const bundleName = String(bundle?.DeveloperName || "").trim();
    const isAuraApplication = auraTreeGroup === "auraApplication";
    const primaryResource = isAuraApplication
      ? { value: "application", label: "Application" }
      : { value: "component", label: "Component" };
    const resourceTypeOptions = [
      primaryResource,
      { value: "controller", label: "Controller" },
      { value: "helper", label: "Helper" },
      { value: "renderer", label: "Renderer" },
      { value: "style", label: "Style" },
      { value: "design", label: "Design" },
      { value: "documentation", label: "Documentation" },
      { value: "svg", label: "SVG" }
    ].map((option) => `<option value="${option.value}">${option.label}</option>`).join("");
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura dc-aura-resource-modal">
        <div class="dc-modal-header">
          <h3>New File (${escapeHtml(bundle.MasterLabel || bundleName)})</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field"><span class="dc-field-label-line"><span class="dc-field-label-text">Name</span></span><input class="dc-input" type="text" name="resourceName" value="${escapeHtml(bundleName)}" readonly /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Type</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><div class="dc-select-wrap"><select class="dc-select" name="resourceType"><option value="" selected disabled>Select file type</option>${resourceTypeOptions}</select></div></label>
          </div>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;
    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const resourceTypeInput = overlay.querySelector('[name="resourceType"]');
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    resourceTypeInput?.addEventListener("change", clearFormMessage);
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const resourceType = resourceTypeInput?.value || "";
      clearFormMessage();
      if (!resourceType) return showFormMessage("Type is required.");
      try {
        await createAuraResource(bundle, resourceType, auraTreeGroup);
        close();
      } catch (error) {
        showFormMessage(error.message || "The Aura file could not be created.");
      }
    });
    document.body.appendChild(overlay);
    resourceTypeInput?.focus();
  }

  function openDeleteAuraBundleModal(bundle, auraTreeGroup = "aura") {
    openDeleteExplorerItemConfirmationModal(() => deleteAuraBundle(bundle, auraTreeGroup));
  }

  function openDeleteAuraDefinitionModal(bundleName, definition, auraTreeGroup = "aura") {
    openDeleteExplorerItemConfirmationModal(() => deleteAuraDefinition(bundleName, definition, auraTreeGroup));
  }

  function findLwcBundleNode(bundleName) {
    return treeGroups.lwc.list?.querySelector(`.dc-bundle-node[data-bundle-name="${bundleName}"]`) || null;
  }

  async function waitForLwcBundleNode(bundleName, timeoutMs = 3000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const node = findLwcBundleNode(bundleName);
      if (node) return node;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  async function waitForAuraBundleNode(bundleName, auraTreeGroup = "aura", timeoutMs = 3000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const node = findAuraComponentNode(bundleName, auraTreeGroup);
      if (node) return node;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  async function deployLWCBundleFile(sessionIdValue, bundleName, filePath, source) {
    const bundle = await findBundleByName(sessionIdValue, bundleName);
    if (!bundle?.Id) throw new Error(`Unable to find bundle ${bundleName}.`);
    const safePath = String(filePath || "").replace(/'/g, "\\'");
    const resourceQuery = `SELECT Id FROM LightningComponentResource WHERE LightningComponentBundleId = '${bundle.Id}' AND FilePath = '${safePath}' LIMIT 1`;
    const queryResult = await callToolingApi(sessionIdValue, resourceQuery, sessionApiOrigin);
    const existing = queryResult.records?.[0];
    if (!existing?.Id) throw new Error(`No existing resource found for ${filePath}.`);
    const mutationResponse = await requestSalesforceApi(sessionIdValue, sessionApiOrigin, `/sobjects/LightningComponentResource/${existing.Id}`, {
      method: "PATCH",
      body: JSON.stringify({ Source: source })
    });
    const mutationResponseClone = mutationResponse.clone?.() || null;
    const mutationPayload = await mutationResponse.json().catch(() => null);
    const mutationText = mutationResponseClone ? await mutationResponseClone.text().catch(() => "") : "";
    if (!mutationResponse.ok) {
      const message = mutationPayload?.[0]?.message || mutationPayload?.message || mutationResponse.statusText || "Unknown error - please refresh the page and try again!";
      const errorCode = mutationPayload?.[0]?.errorCode || mutationPayload?.errorCode;
      const error = new Error(errorCode ? `${message} (${errorCode})` : message);
      error.deployKind = "lwc";
      error.payload = mutationPayload;
      error.responseText = mutationText;
      error.status = mutationResponse.status;
      error.statusText = mutationResponse.statusText;
      error.resourceId = existing.Id;
      error.bundleName = bundleName;
      error.filePath = filePath;
      error.errorCode = errorCode || "";
      throw error;
    }
  }
  async function deployApexClassWithContainer(sessionIdValue, apexClassId, filePath, source) {
    if (!apexClassId) throw new Error("Unable to find Apex class.");
    const sourceOrigin = new URL(window.location.href).searchParams.get("sourceOrigin");
    const containerName = `LightningConnect_${Date.now()}`;
    const container = await createToolingRecord(sessionIdValue, "MetadataContainer", { Name: containerName });
    const containerId = container.id || container.Id;
    if (!containerId) throw new Error("Unable to create Metadata Container.");

    try {
      const member = await createToolingRecord(sessionIdValue, "ApexClassMember", {
        MetadataContainerId: containerId,
        Body: source,
        ContentEntityId: apexClassId
      });
      const memberId = member.id || member.Id;
      if (!memberId) throw new Error("Unable to create Apex Class Member.");

      const request = await createToolingRecord(sessionIdValue, "ContainerAsyncRequest", {
        MetadataContainerId: containerId,
        IsCheckOnly: false,
        IsRunTests: false
      });
      const requestId = request.id || request.Id;
      if (!requestId) throw new Error("Unable to submit container deployment request.");

      await pollContainerAsyncRequest(sessionIdValue, requestId);
    } finally {
      await cleanupToolingContainer(sessionIdValue, containerId).catch(() => {});
    }
  }

  async function deployApexTriggerWithContainer(sessionIdValue, apexTriggerId, filePath, source) {
    if (!apexTriggerId) throw new Error("Unable to find Apex trigger.");
    const sourceOrigin = new URL(window.location.href).searchParams.get("sourceOrigin");
    const containerName = `LightningConnect_${Date.now()}`;
    const container = await createToolingRecord(sessionIdValue, "MetadataContainer", { Name: containerName });
    const containerId = container.id || container.Id;
    if (!containerId) throw new Error("Unable to create Metadata Container.");

    try {
      const member = await createToolingRecord(sessionIdValue, "ApexTriggerMember", {
        MetadataContainerId: containerId,
        Body: source,
        ContentEntityId: apexTriggerId
      });
      const memberId = member.id || member.Id;
       if (!memberId) throw new Error("Unable to create Apex Trigger Member.");

      const request = await createToolingRecord(sessionIdValue, "ContainerAsyncRequest", {
        MetadataContainerId: containerId,
        IsCheckOnly: false,
        IsRunTests: false
      });
      const requestId = request.id || request.Id;
      if (!requestId) throw new Error("Unable to submit container deployment request.");

      await pollContainerAsyncRequest(sessionIdValue, requestId);
    } finally {
      await cleanupToolingContainer(sessionIdValue, containerId).catch(() => {});
    }
  }

  async function deployApexPageWithContainer(sessionIdValue, apexPageId, filePath, source) {
    if (!apexPageId) throw new Error("Unable to find Visualforce page.");
    const sourceOrigin = new URL(window.location.href).searchParams.get("sourceOrigin");
    const containerName = `LightningConnect_${Date.now()}`;
    const container = await createToolingRecord(sessionIdValue, "MetadataContainer", { Name: containerName });
    const containerId = container.id || container.Id;
    if (!containerId) throw new Error("Unable to create Metadata Container.");

    try {
      const member = await createToolingRecord(sessionIdValue, "ApexPageMember", {
        MetadataContainerId: containerId,
        Body: source,
        ContentEntityId: apexPageId
      });
      const memberId = member.id || member.Id;
      if (!memberId) throw new Error("Unable to create Apex Page Member.");

      const request = await createToolingRecord(sessionIdValue, "ContainerAsyncRequest", {
        MetadataContainerId: containerId,
        IsCheckOnly: false,
        IsRunTests: false
      });
      const requestId = request.id || request.Id;
      if (!requestId) throw new Error("Unable to submit container deployment request.");

      await pollContainerAsyncRequest(sessionIdValue, requestId);
    } finally {
      await cleanupToolingContainer(sessionIdValue, containerId).catch(() => {});
    }
  }

  async function deployApexComponentWithContainer(sessionIdValue, apexComponentId, filePath, source) {
    if (!apexComponentId) throw new Error("Unable to find Visualforce component.");
    const containerName = `LightningConnect_${Date.now()}`;
    const container = await createToolingRecord(sessionIdValue, "MetadataContainer", { Name: containerName });
    const containerId = container.id || container.Id;
    if (!containerId) throw new Error("Unable to create Metadata Container.");

    try {
      const member = await createToolingRecord(sessionIdValue, "ApexComponentMember", {
        MetadataContainerId: containerId,
        Body: source,
        ContentEntityId: apexComponentId
      });
      const memberId = member.id || member.Id;
      if (!memberId) throw new Error("Unable to create Apex Component Member.");

      const request = await createToolingRecord(sessionIdValue, "ContainerAsyncRequest", {
        MetadataContainerId: containerId,
        IsCheckOnly: false,
        IsRunTests: false
      });
      const requestId = request.id || request.Id;
      if (!requestId) throw new Error("Unable to submit container deployment request.");

      await pollContainerAsyncRequest(sessionIdValue, requestId);
    } finally {
      await cleanupToolingContainer(sessionIdValue, containerId).catch(() => {});
    }
  }

  async function pollContainerAsyncRequest(sessionIdValue, requestId) {
    const safeRequestId = String(requestId).replace(/'/g, "\\'");
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const payload = await callToolingApi(sessionIdValue, `SELECT Id, State, ErrorMsg, DeployDetails FROM ContainerAsyncRequest WHERE Id = '${safeRequestId}' LIMIT 1`, sessionApiOrigin);
      const request = payload.records?.[0];
      if (!request) throw new Error("Unable to find deployment request status.");
      const state = String(request.State || "").toLowerCase();
      if (["completed", "success"].includes(state)) return request;
      if (["failed", "error", "aborted"].includes(state)) {
        const failureMessages = getContainerAsyncRequestFailureMessages(request);
        const message = failureMessages[0] || request.message || request.Message || request.ErrorMsg || request.errorMessage || "Apex deployment failed.";
        const error = new Error(message);
        error.failureMessages = failureMessages;
        error.deployDetailsRaw = request.DeployDetails || request.deployDetails || request.details;
        error.componentFailures = Array.isArray(request?.DeployDetails?.componentFailures)
          ? request.DeployDetails.componentFailures
          : Array.isArray(request?.deployDetails?.componentFailures)
            ? request.deployDetails.componentFailures
            : Array.isArray(request?.details?.componentFailures)
              ? request.details.componentFailures
              : [];
        error.request = request;
        error.requestMessage = request.message || request.Message || request.ErrorMsg || request.errorMessage || "";
        error.ErrorMsg = request.ErrorMsg || request.errorMessage || request.message || request.Message || "";
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Timed out waiting for Apex deployment to complete.");
  }

  async function cleanupToolingContainer(sessionIdValue, containerId) {
    const sourceOrigin = new URL(window.location.href).searchParams.get("sourceOrigin");
    const safeContainerId = String(containerId).replace(/'/g, "\\'");
    await requestSalesforceApi(sessionIdValue, sourceOrigin, `/sobjects/MetadataContainer/${safeContainerId}`, {
      method: "DELETE"
    }).catch(() => {});
  }

  function resolveAuraDeploymentType(filePath, defTypeArg, formatArg) {
    const normalizedPath = String(filePath || "").toLowerCase();
    if (defTypeArg && formatArg) return { defType: String(defTypeArg).trim(), format: String(formatArg).trim() };
    if (normalizedPath.endsWith(".cmp")) return { defType: "COMPONENT", format: "XML" };
    if (normalizedPath.endsWith("controller.js")) return { defType: "CONTROLLER", format: "JS" };
    if (normalizedPath.endsWith("helper.js")) return { defType: "HELPER", format: "JS" };
    if (normalizedPath.endsWith(".css")) return { defType: "STYLE", format: "CSS" };
    if (normalizedPath.endsWith("renderer.js")) return { defType: "RENDERER", format: "JS" };
    if (normalizedPath.endsWith(".design")) return { defType: "DESIGN", format: "XML" };
    if (normalizedPath.endsWith(".auradoc")) return { defType: "DOCUMENTATION", format: "XML" };
    if (normalizedPath.endsWith(".svg")) return { defType: "SVG", format: "SVG" };
    if (normalizedPath.endsWith(".app")) return { defType: "APPLICATION", format: "XML" };
    if (normalizedPath.endsWith(".evt")) return { defType: "EVENT", format: "XML" };
    if (normalizedPath.endsWith(".intf")) return { defType: "INTERFACE", format: "XML" };
    if (normalizedPath.endsWith(".tokens")) return { defType: "TOKENS", format: "XML" };
    return { defType: String(defTypeArg || "").trim(), format: String(formatArg || "").trim() };
  }

  async function deployAuraDefinitionSource(sessionIdValue, auraBundleId, source, defType, format) {
    if (!auraBundleId) throw new Error("Unable to find Aura bundle.");
    const resolvedAuraType = resolveAuraDeploymentType("", defType, format);
    const safeBundleId = String(auraBundleId || "").replace(/'/g, "\\'");
    const safeDefType = String(resolvedAuraType.defType || "").replace(/'/g, "\\'");
    const safeFormat = String(resolvedAuraType.format || "").replace(/'/g, "\\'");
    const where = [`AuraDefinitionBundleId = '${safeBundleId}'`];
    if (safeDefType) where.push(`DefType = '${safeDefType}'`);
    if (safeFormat) where.push(`Format = '${safeFormat}'`);
    const query = `SELECT Id FROM AuraDefinition WHERE ${where.join(" AND ")} LIMIT 1`;
    const queryResult = await callToolingApi(sessionIdValue, query, sessionApiOrigin);
    const record = queryResult.records?.[0];
    if (!record?.Id) throw new Error("Unable to resolve Aura definition for fallback update.");
    const mutationResponse = await requestSalesforceApi(sessionIdValue, sessionApiOrigin, `/sobjects/AuraDefinition/${record.Id}`, {
      method: "PATCH",
      body: JSON.stringify({ Source: source })
    });
    const mutationResponseClone = mutationResponse.clone?.() || null;
    const mutationPayload = await mutationResponse.json().catch(() => null);
    const mutationText = mutationResponseClone ? await mutationResponseClone.text().catch(() => "") : "";
    if (!mutationResponse.ok) {
      const message = mutationPayload?.[0]?.message || mutationPayload?.message || mutationResponse.statusText || "Aura fallback update failed.";
      const errorCode = mutationPayload?.[0]?.errorCode || mutationPayload?.errorCode;
      const error = new Error(errorCode ? `${message} (${errorCode})` : message);
      error.deployKind = "aura";
      error.payload = mutationPayload;
      error.responseText = mutationText;
      error.status = mutationResponse.status;
      error.statusText = mutationResponse.statusText;
      error.recordId = record.Id;
      error.auraBundleId = auraBundleId;
      error.defType = defType;
      error.format = format;
      error.errorCode = errorCode || "";
      throw error;
    }
  }

  async function findBundleByName(sessionIdValue, bundleName) {
    const safeName = String(bundleName || "").replace(/'/g, "\\'");
    const query = `SELECT Id, DeveloperName FROM LightningComponentBundle WHERE DeveloperName = '${safeName}' LIMIT 1`;
    const sourceOrigin = new URL(window.location.href).searchParams.get("sourceOrigin");
    const queryResult = await callToolingApi(sessionIdValue, query, sourceOrigin);
    return queryResult.records?.[0] || null;
  }

  function getMonacoLanguage(filePath) {
    const path = String(filePath || "").toLowerCase();
    if (path.endsWith(".html")) return "html";
    if (path.endsWith(".page")) return "html";
    if (path.endsWith(".component")) return "html";
    if (path.endsWith(".cmp")) return "html";
    if (path.endsWith(".design")) return "html";
    if (path.endsWith(".auradoc")) return "html";
    if (path.endsWith(".app")) return "html";
    if (path.endsWith(".evt")) return "html";
    if (path.endsWith(".intf")) return "html";
    if (path.endsWith(".tokens")) return "html";
    if (path.endsWith(".css")) return "css";
    if (path.endsWith(".js")) return "javascript";
    if (path.endsWith(".svg")) return "xml";
    if (path.endsWith(".xml")) return "xml";
    if (path.endsWith(".cls") || path.endsWith(".trigger")) return "apex";
    if (path.endsWith(".json")) return "json";
    return "plaintext";
  }

  function openCreateLightningMessageChannelModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura dc-create-modal-message-channel">
        <div class="dc-modal-header">
          <h3>New Lightning Message Channel</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Channel Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="channelName" maxlength="40" required aria-required="true" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Master Label</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="masterLabel" maxlength="80" required aria-required="true" /></label>
          </div>
          <div class="dc-form-grid dc-form-grid-two">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Exposed</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="isExposed" required aria-required="true">
                  <option value="true" selected>Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion" required aria-required="true">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
          <label class="dc-field"><span class="dc-field-label-text">Descriptions</span><textarea class="dc-textarea" name="description"></textarea></label>
          <section class="dc-message-fields-section" aria-labelledby="dc-message-fields-title">
            <div class="dc-message-fields-heading"><span id="dc-message-fields-title">Message Fields</span></div>
            <div class="dc-message-field-list" data-message-field-list></div>
            <button type="button" class="dc-button dc-message-field-add" data-add-message-field><span aria-hidden="true">+</span> Add Field</button>
          </section>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const channelNameInput = overlay.querySelector('[name="channelName"]');
    const masterLabelInput = overlay.querySelector('[name="masterLabel"]');
    const exposedInput = overlay.querySelector('[name="isExposed"]');
    const apiVersionInput = overlay.querySelector('[name="apiVersion"]');
    const descriptionInput = overlay.querySelector('[name="description"]');
    const fieldList = overlay.querySelector("[data-message-field-list]");
    const deployButton = overlay.querySelector("[data-deploy]");
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateChannelName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Channel Name is required.";
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Channel Name must start with a letter and contain only letters, numbers, and underscores.";
      }
      if (normalized.endsWith("_") || normalized.includes("__")) {
        return "Channel Name cannot end with an underscore or contain consecutive underscores.";
      }
      if (normalized.length > 40) return "Channel Name must not exceed 40 characters.";
      return "";
    };
    const createMessageFieldRow = (field = {}) => {
      const row = document.createElement("div");
      row.className = "dc-message-field-row";
      row.innerHTML = `
        <input class="dc-input" type="text" name="messageFieldName" maxlength="80" placeholder="Name" value="${escapeHtml(field.name || "")}" />
        <input class="dc-input" type="text" name="messageFieldDescription" maxlength="255" placeholder="Description" value="${escapeHtml(field.description || "")}" />
        <button type="button" class="dc-message-field-remove" data-remove-message-field aria-label="Remove message field" title="Remove message field">&times;</button>
      `;
      row.querySelectorAll("input").forEach((input) => input.addEventListener("input", clearFormMessage));
      row.querySelector("[data-remove-message-field]")?.addEventListener("click", () => {
        row.remove();
        clearFormMessage();
      });
      return row;
    };
    const getMessageFields = () => Array.from(fieldList?.querySelectorAll(".dc-message-field-row") || [])
      .map((row) => ({
        fieldName: row.querySelector('[name="messageFieldName"]')?.value.trim() || "",
        description: row.querySelector('[name="messageFieldDescription"]')?.value.trim() || ""
      }))
      .filter((field) => field.fieldName || field.description);
    const validateMessageFields = (fields) => {
      const names = new Set();
      for (const field of fields) {
        if (!field.fieldName) return "Each Message Field requires a Name.";
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(field.fieldName)) {
          return `Message Field ${field.fieldName} must start with a letter and contain only letters, numbers, and underscores.`;
        }
        const normalizedName = field.fieldName.toLowerCase();
        if (names.has(normalizedName)) return `Duplicate Message Field Name: ${field.fieldName}.`;
        names.add(normalizedName);
      }
      return "";
    };
    const syncMasterLabelFromChannelName = () => {
      if (!channelNameInput || !masterLabelInput) return;
      masterLabelInput.value = channelNameInput.value.trim();
    };

    channelNameInput?.addEventListener("input", () => {
      clearFormMessage();
      syncMasterLabelFromChannelName();
    });
    channelNameInput?.addEventListener("blur", () => {
      const message = validateChannelName(channelNameInput.value);
      if (message) showFormMessage(message);
    });
    masterLabelInput?.addEventListener("input", clearFormMessage);
    exposedInput?.addEventListener("change", clearFormMessage);
    apiVersionInput?.addEventListener("change", clearFormMessage);
    descriptionInput?.addEventListener("input", clearFormMessage);
    overlay.querySelector("[data-add-message-field]")?.addEventListener("click", () => {
      fieldList?.appendChild(createMessageFieldRow());
      fieldList?.lastElementChild?.querySelector('[name="messageFieldName"]')?.focus();
    });
    fieldList?.appendChild(createMessageFieldRow());
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    deployButton?.addEventListener("click", async () => {
      const channelName = channelNameInput?.value.trim() || "";
      const masterLabel = masterLabelInput?.value.trim() || "";
      const isExposed = exposedInput?.value === "true";
      const apiVersion = apiVersionInput?.value.trim() || "";
      const lightningMessageFields = getMessageFields();
      clearFormMessage();
      const channelNameValidation = validateChannelName(channelName);
      if (channelNameValidation) return showFormMessage(channelNameValidation);
      if (!masterLabel) return showFormMessage("Master Label is required.");
      if (!exposedInput?.value) return showFormMessage("Exposed is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      const messageFieldValidation = validateMessageFields(lightningMessageFields);
      if (messageFieldValidation) return showFormMessage(messageFieldValidation);
      deployButton.disabled = true;
      try {
        await createLightningMessageChannel({
          channelName,
          masterLabel,
          isExposed,
          apiVersion,
          description: descriptionInput?.value.trim() || "",
          lightningMessageFields
        });
        close();
      } catch (error) {
        showFormMessage(error.message || "Lightning Message Channel failed to create.");
      } finally {
        deployButton.disabled = false;
      }
    });
    document.body.appendChild(overlay);
    channelNameInput?.focus();
  }

  function openCreateLwcModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-lwc">
        <div class="dc-modal-header">
          <h3>New Lightning Web Component</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">×</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Component Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="componentName" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Master Label</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="masterLabel" /></label>
          </div>
          <div class="dc-form-grid dc-form-grid-two">
            <label class="dc-field">Targets
              <div class="dc-multiselect" data-multiselect="targets">
                <button type="button" class="dc-multiselect-button" data-multiselect-button>
                  <span class="dc-multiselect-value" data-multiselect-value>Select targets</span>
                  <span class="dc-dropdown-chevron" aria-hidden="true"></span>
                </button>
                <div class="dc-multiselect-panel" data-multiselect-panel hidden></div>
              </div>
            </label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
          <div class="dc-checkbox-row">
            <label><input type="checkbox" name="includeCss" /> Include CSS File</label>
          </div>
          <label class="dc-field">Descriptions<textarea class="dc-textarea" name="description"></textarea></label>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const targets = ["lightning__AppPage","lightning__HomePage","lightning__RecordPage","lightning__Inbox","lightning__FlowScreen","lightningCommunity__Default","lightningCommunity__Page_Layout","lightningCommunity__Theme_Layout","lightning__GlobalAction"];
    const selectedTargets = new Set();
    const close = () => overlay.remove();
    const multiselect = overlay.querySelector('[data-multiselect="targets"]');
    const multiselectButton = overlay.querySelector("[data-multiselect-button]");
    const multiselectPanel = overlay.querySelector("[data-multiselect-panel]");
    const multiselectValue = overlay.querySelector("[data-multiselect-value]");
    const formMessage = overlay.querySelector("[data-form-message]");
    const componentNameInput = overlay.querySelector('[name="componentName"]');
    const masterLabelInput = overlay.querySelector('[name="masterLabel"]');
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateComponentName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Component Name is required.";
      if (!/^[a-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Component Name must start with a lowercase letter and contain only letters, numbers, and underscores.";
      }
      return "";
    };
    const syncMasterLabelFromComponentName = () => {
      if (!componentNameInput || !masterLabelInput) return;
      masterLabelInput.value = componentNameInput.value.trim();
    };
    componentNameInput?.addEventListener("input", () => {
      clearFormMessage();
      syncMasterLabelFromComponentName();
    });
    componentNameInput?.addEventListener("blur", () => {
      const message = validateComponentName(componentNameInput.value);
      if (message) showFormMessage(message);
    });
    masterLabelInput?.addEventListener("input", () => {
      clearFormMessage();
    });
    const renderTargets = () => {
      multiselectPanel.innerHTML = targets.map((target) => `
        <label class="dc-multiselect-option"><input type="checkbox" value="${escapeHtml(target)}" ${selectedTargets.has(target) ? "checked" : ""} /> <span>${escapeHtml(target)}</span></label>
      `).join("");
      const selected = [...selectedTargets];
      if (!selected.length) {
        multiselectValue.textContent = "Select targets";
      } else if (selected.length === 1) {
        multiselectValue.textContent = selected[0];
      } else {
        const preview = selected.slice(0, 2).join(", ");
        multiselectValue.textContent = selected.length > 2 ? `${preview}... (${selected.length})` : `${preview} (${selected.length})`;
      }
    };
    renderTargets();
    multiselectButton?.addEventListener("click", () => {
      const isHidden = multiselectPanel.hasAttribute("hidden");
      if (isHidden) multiselectPanel.removeAttribute("hidden"); else multiselectPanel.setAttribute("hidden", "");
    });
    multiselectPanel?.addEventListener("change", (event) => {
      const checkbox = event.target.closest('input[type="checkbox"]');
      if (!checkbox) return;
      if (checkbox.checked) selectedTargets.add(checkbox.value); else selectedTargets.delete(checkbox.value);
      renderTargets();
    });
    overlay.addEventListener("click", (event) => {
      if (!multiselect?.contains(event.target)) multiselectPanel?.setAttribute("hidden", "");
    });
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const form = overlay;
      const componentName = form.querySelector('[name="componentName"]').value.trim();
      const masterLabel = form.querySelector('[name="masterLabel"]').value.trim();
      const apiVersion = form.querySelector('[name="apiVersion"]').value.trim();
      clearFormMessage();
      const componentNameValidation = validateComponentName(componentName);
      if (componentNameValidation) return showFormMessage(componentNameValidation);
      if (!masterLabel) return showFormMessage("Master Label is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      try {
        await createLwcBundle({ componentName, masterLabel, apiVersion, targets: [...selectedTargets], includeCss: !!form.querySelector('[name="includeCss"]').checked, description: form.querySelector('[name="description"]').value.trim() });
        close();
      } catch (error) {
        showFormMessage(error.message || "LWC bundle failed to Create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function openCreateAuraModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura">
        <div class="dc-modal-header">
          <h3>New Lightning Aura Component</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">×</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Component Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="componentName" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Master Label</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="masterLabel" /></label>
          </div>
          <div class="dc-form-grid dc-form-grid-two">
            <label class="dc-field">Targets
              <div class="dc-multiselect" data-multiselect="targets">
                <button type="button" class="dc-multiselect-button" data-multiselect-button>
                  <span class="dc-multiselect-value" data-multiselect-value>Select targets</span>
                  <span class="dc-dropdown-chevron" aria-hidden="true"></span>
                </button>
                <div class="dc-multiselect-panel" data-multiselect-panel hidden></div>
              </div>
            </label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
          <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Descriptions</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><textarea class="dc-textarea" name="description" required aria-required="true"></textarea></label>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const targets = [
      "flexipage:availableForRecordHome",
      "force:appHostable",
      "flexipage:availableForAllPageTypes",
      "force:lightningQuickAction",
      "force:lightningQuickActionWithoutHeader",
      "force:hasRecordId",
      "forceCommunity:availableForAllPageTypes",
      "lightning:availableForFlowScreens",
      "lightning:utilityItem"
    ];
    const selectedTargets = new Set();
    const close = () => overlay.remove();
    const multiselect = overlay.querySelector('[data-multiselect="targets"]');
    const multiselectButton = overlay.querySelector("[data-multiselect-button]");
    const multiselectPanel = overlay.querySelector("[data-multiselect-panel]");
    const multiselectValue = overlay.querySelector("[data-multiselect-value]");
    const formMessage = overlay.querySelector("[data-form-message]");
    const componentNameInput = overlay.querySelector('[name="componentName"]');
    const masterLabelInput = overlay.querySelector('[name="masterLabel"]');
    const descriptionInput = overlay.querySelector('[name="description"]');
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateComponentName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Component Name is required.";
      if (!/^[a-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Component Name must start with a lowercase letter and contain only letters, numbers, and underscores.";
      }
      return "";
    };
    const syncMasterLabelFromComponentName = () => {
      if (!componentNameInput || !masterLabelInput) return;
      masterLabelInput.value = componentNameInput.value.trim();
    };
    const renderTargets = () => {
      multiselectPanel.innerHTML = targets.map((target) => `
        <label class="dc-multiselect-option"><input type="checkbox" value="${escapeHtml(target)}" ${selectedTargets.has(target) ? "checked" : ""} /> <span>${escapeHtml(target)}</span></label>
      `).join("");
      const selected = [...selectedTargets];
      if (!selected.length) {
        multiselectValue.textContent = "Select targets";
      } else if (selected.length === 1) {
        multiselectValue.textContent = selected[0];
      } else {
        const preview = selected.slice(0, 2).join(", ");
        multiselectValue.textContent = selected.length > 2 ? `${preview}... (${selected.length})` : `${preview} (${selected.length})`;
      }
    };

    componentNameInput?.addEventListener("input", () => {
      clearFormMessage();
      syncMasterLabelFromComponentName();
    });
    componentNameInput?.addEventListener("blur", () => {
      const message = validateComponentName(componentNameInput.value);
      if (message) showFormMessage(message);
    });
    masterLabelInput?.addEventListener("input", clearFormMessage);
    descriptionInput?.addEventListener("input", clearFormMessage);
    renderTargets();
    multiselectButton?.addEventListener("click", () => {
      const isHidden = multiselectPanel.hasAttribute("hidden");
      if (isHidden) multiselectPanel.removeAttribute("hidden"); else multiselectPanel.setAttribute("hidden", "");
    });
    multiselectPanel?.addEventListener("change", (event) => {
      const checkbox = event.target.closest('input[type="checkbox"]');
      if (!checkbox) return;
      if (checkbox.checked) selectedTargets.add(checkbox.value); else selectedTargets.delete(checkbox.value);
      renderTargets();
    });
    overlay.addEventListener("click", (event) => {
      if (!multiselect?.contains(event.target)) multiselectPanel?.setAttribute("hidden", "");
    });
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const componentName = componentNameInput?.value.trim() || "";
      const masterLabel = masterLabelInput?.value.trim() || "";
      const apiVersion = overlay.querySelector('[name="apiVersion"]')?.value.trim() || "";
      const description = descriptionInput?.value.trim() || "";
      clearFormMessage();
      const componentNameValidation = validateComponentName(componentName);
      if (componentNameValidation) return showFormMessage(componentNameValidation);
      if (!masterLabel) return showFormMessage("Master Label is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      if (!description) return showFormMessage("Description is required.");
      try {
        await createAuraDefinitionBundle({
          bundleName: componentName,
          masterLabel,
          apiVersion,
          description,
          definitions: buildAuraComponentDefinitions([...selectedTargets]),
          auraTreeGroup: "aura",
          logTag: "AURACOMPONENT",
          primaryDefinition: { defType: "COMPONENT", format: "XML" }
        });
        close();
      } catch (error) {
        showFormMessage(error.message || "Aura component bundle failed to create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function openCreateAuraApplicationModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura">
        <div class="dc-modal-header">
          <h3>New Lightning Aura Application</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">×</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Application Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="applicationName" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Master Label</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="masterLabel" /></label>
          </div>
          <div class="dc-form-grid dc-form-grid-two">
            <label class="dc-field">Targets
              <div class="dc-multiselect" data-multiselect="targets">
                <button type="button" class="dc-multiselect-button" data-multiselect-button>
                  <span class="dc-multiselect-value" data-multiselect-value>Select targets</span>
                  <span class="dc-dropdown-chevron" aria-hidden="true"></span>
                </button>
                <div class="dc-multiselect-panel" data-multiselect-panel hidden></div>
              </div>
            </label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
          <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Descriptions</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><textarea class="dc-textarea" name="description" required aria-required="true"></textarea></label>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const targets = [
      "flexipage:availableForRecordHome",
      "force:appHostable",
      "flexipage:availableForAllPageTypes",
      "force:hasRecordId",
      "force:hasSObjectName",
      "forceCommunity:availableForAllPageTypes",
      "force:lightningQuickAction",
      "force:lightningQuickActionWithoutHeader",
      "lightning:actionOverride",
      "force:recordEdit",
      "force:recordView"
    ];
    const selectedTargets = new Set();
    const close = () => overlay.remove();
    const multiselect = overlay.querySelector('[data-multiselect="targets"]');
    const multiselectButton = overlay.querySelector("[data-multiselect-button]");
    const multiselectPanel = overlay.querySelector("[data-multiselect-panel]");
    const multiselectValue = overlay.querySelector("[data-multiselect-value]");
    const formMessage = overlay.querySelector("[data-form-message]");
    const applicationNameInput = overlay.querySelector('[name="applicationName"]');
    const masterLabelInput = overlay.querySelector('[name="masterLabel"]');
    const descriptionInput = overlay.querySelector('[name="description"]');
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateApplicationName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Application Name is required.";
      if (!/^[a-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Application Name must start with a lowercase letter and contain only letters, numbers, and underscores.";
      }
      return "";
    };
    const syncMasterLabelFromApplicationName = () => {
      if (!applicationNameInput || !masterLabelInput) return;
      masterLabelInput.value = applicationNameInput.value.trim();
    };
    const renderTargets = () => {
      multiselectPanel.innerHTML = targets.map((target) => `
        <label class="dc-multiselect-option"><input type="checkbox" value="${escapeHtml(target)}" ${selectedTargets.has(target) ? "checked" : ""} /> <span>${escapeHtml(target)}</span></label>
      `).join("");
      const selected = [...selectedTargets];
      if (!selected.length) {
        multiselectValue.textContent = "Select targets";
      } else if (selected.length === 1) {
        multiselectValue.textContent = selected[0];
      } else {
        const preview = selected.slice(0, 2).join(", ");
        multiselectValue.textContent = selected.length > 2 ? `${preview}... (${selected.length})` : `${preview} (${selected.length})`;
      }
    };

    applicationNameInput?.addEventListener("input", () => {
      clearFormMessage();
      syncMasterLabelFromApplicationName();
    });
    applicationNameInput?.addEventListener("blur", () => {
      const message = validateApplicationName(applicationNameInput.value);
      if (message) showFormMessage(message);
    });
    masterLabelInput?.addEventListener("input", clearFormMessage);
    descriptionInput?.addEventListener("input", clearFormMessage);
    renderTargets();
    multiselectButton?.addEventListener("click", () => {
      const isHidden = multiselectPanel.hasAttribute("hidden");
      if (isHidden) multiselectPanel.removeAttribute("hidden"); else multiselectPanel.setAttribute("hidden", "");
    });
    multiselectPanel?.addEventListener("change", (event) => {
      const checkbox = event.target.closest('input[type="checkbox"]');
      if (!checkbox) return;
      if (checkbox.checked) selectedTargets.add(checkbox.value); else selectedTargets.delete(checkbox.value);
      renderTargets();
    });
    overlay.addEventListener("click", (event) => {
      if (!multiselect?.contains(event.target)) multiselectPanel?.setAttribute("hidden", "");
    });
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const applicationName = applicationNameInput?.value.trim() || "";
      const masterLabel = masterLabelInput?.value.trim() || "";
      const apiVersion = overlay.querySelector('[name="apiVersion"]')?.value.trim() || "";
      const description = descriptionInput?.value.trim() || "";
      clearFormMessage();
      const applicationNameValidation = validateApplicationName(applicationName);
      if (applicationNameValidation) return showFormMessage(applicationNameValidation);
      if (!masterLabel) return showFormMessage("Master Label is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      if (!description) return showFormMessage("Description is required.");
      try {
        await createAuraApplicationBundle({
          applicationName,
          masterLabel,
          apiVersion,
          description,
          targets: [...selectedTargets]
        });
        close();
      } catch (error) {
        showFormMessage(error.message || "Aura application bundle failed to create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function openCreateLightningEventModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura">
        <div class="dc-modal-header">
          <h3>New Lightning Event</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">×</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Event Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="eventName" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Master Label</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="masterLabel" /></label>
          </div>
          <div class="dc-form-grid dc-form-grid-two">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Type</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="eventType">
                  <option value="" selected disabled>Select event type</option>
                  <option value="COMPONENT">Component</option>
                  <option value="APPLICATION">Application</option>
                </select>
              </div>
            </label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
          <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Descriptions</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><textarea class="dc-textarea" name="description" required aria-required="true"></textarea></label>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const eventNameInput = overlay.querySelector('[name="eventName"]');
    const masterLabelInput = overlay.querySelector('[name="masterLabel"]');
    const eventTypeInput = overlay.querySelector('[name="eventType"]');
    const apiVersionInput = overlay.querySelector('[name="apiVersion"]');
    const descriptionInput = overlay.querySelector('[name="description"]');
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateEventName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Event Name is required.";
      if (!/^[a-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Event Name must start with a lowercase letter and contain only letters, numbers, and underscores.";
      }
      return "";
    };
    const syncMasterLabelFromEventName = () => {
      if (!eventNameInput || !masterLabelInput) return;
      masterLabelInput.value = eventNameInput.value.trim();
    };

    eventNameInput?.addEventListener("input", () => {
      clearFormMessage();
      syncMasterLabelFromEventName();
    });
    eventNameInput?.addEventListener("blur", () => {
      const message = validateEventName(eventNameInput.value);
      if (message) showFormMessage(message);
    });
    masterLabelInput?.addEventListener("input", clearFormMessage);
    eventTypeInput?.addEventListener("change", clearFormMessage);
    apiVersionInput?.addEventListener("change", clearFormMessage);
    descriptionInput?.addEventListener("input", clearFormMessage);
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const eventName = eventNameInput?.value.trim() || "";
      const masterLabel = masterLabelInput?.value.trim() || "";
      const eventType = eventTypeInput?.value.trim() || "";
      const apiVersion = apiVersionInput?.value.trim() || "";
      const description = descriptionInput?.value.trim() || "";
      clearFormMessage();
      const eventNameValidation = validateEventName(eventName);
      if (eventNameValidation) return showFormMessage(eventNameValidation);
      if (!masterLabel) return showFormMessage("Master Label is required.");
      if (!["COMPONENT", "APPLICATION"].includes(eventType)) return showFormMessage("Type is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      if (!description) return showFormMessage("Description is required.");
      try {
        await createLightningEventBundle({
          eventName,
          masterLabel,
          eventType,
          apiVersion,
          description
        });
        close();
      } catch (error) {
        showFormMessage(error.message || "Lightning Event bundle failed to create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function openCreateLightningInterfaceModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura">
        <div class="dc-modal-header">
          <h3>New Lightning Interface</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">×</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Interface Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="interfaceName" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Master Label</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="masterLabel" /></label>
          </div>
          <div class="dc-form-grid">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
          <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Descriptions</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><textarea class="dc-textarea" name="description" required aria-required="true"></textarea></label>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const interfaceNameInput = overlay.querySelector('[name="interfaceName"]');
    const masterLabelInput = overlay.querySelector('[name="masterLabel"]');
    const apiVersionInput = overlay.querySelector('[name="apiVersion"]');
    const descriptionInput = overlay.querySelector('[name="description"]');
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateInterfaceName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Interface Name is required.";
      if (!/^[a-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Interface Name must start with a lowercase letter and contain only letters, numbers, and underscores.";
      }
      return "";
    };
    const syncMasterLabelFromInterfaceName = () => {
      if (!interfaceNameInput || !masterLabelInput) return;
      masterLabelInput.value = interfaceNameInput.value.trim();
    };

    interfaceNameInput?.addEventListener("input", () => {
      clearFormMessage();
      syncMasterLabelFromInterfaceName();
    });
    interfaceNameInput?.addEventListener("blur", () => {
      const message = validateInterfaceName(interfaceNameInput.value);
      if (message) showFormMessage(message);
    });
    masterLabelInput?.addEventListener("input", clearFormMessage);
    apiVersionInput?.addEventListener("change", clearFormMessage);
    descriptionInput?.addEventListener("input", clearFormMessage);
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const interfaceName = interfaceNameInput?.value.trim() || "";
      const masterLabel = masterLabelInput?.value.trim() || "";
      const apiVersion = apiVersionInput?.value.trim() || "";
      const description = descriptionInput?.value.trim() || "";
      clearFormMessage();
      const interfaceNameValidation = validateInterfaceName(interfaceName);
      if (interfaceNameValidation) return showFormMessage(interfaceNameValidation);
      if (!masterLabel) return showFormMessage("Master Label is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      if (!description) return showFormMessage("Description is required.");
      try {
        await createLightningInterfaceBundle({
          interfaceName,
          masterLabel,
          apiVersion,
          description
        });
        close();
      } catch (error) {
        showFormMessage(error.message || "Lightning Interface bundle failed to create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function openCreateLightningTokenModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura">
        <div class="dc-modal-header">
          <h3>New Lightning Token</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Token Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="tokenName" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Master Label</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="masterLabel" /></label>
          </div>
          <div class="dc-form-grid">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
          <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Descriptions</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><textarea class="dc-textarea" name="description" required aria-required="true"></textarea></label>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const tokenNameInput = overlay.querySelector('[name="tokenName"]');
    const masterLabelInput = overlay.querySelector('[name="masterLabel"]');
    const apiVersionInput = overlay.querySelector('[name="apiVersion"]');
    const descriptionInput = overlay.querySelector('[name="description"]');
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateTokenName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Token Name is required.";
      if (!/^[a-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Token Name must start with a lowercase letter and contain only letters, numbers, and underscores.";
      }
      return "";
    };
    const syncMasterLabelFromTokenName = () => {
      if (!tokenNameInput || !masterLabelInput) return;
      masterLabelInput.value = tokenNameInput.value.trim();
    };

    tokenNameInput?.addEventListener("input", () => {
      clearFormMessage();
      syncMasterLabelFromTokenName();
    });
    tokenNameInput?.addEventListener("blur", () => {
      const message = validateTokenName(tokenNameInput.value);
      if (message) showFormMessage(message);
    });
    masterLabelInput?.addEventListener("input", clearFormMessage);
    apiVersionInput?.addEventListener("change", clearFormMessage);
    descriptionInput?.addEventListener("input", clearFormMessage);
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const tokenName = tokenNameInput?.value.trim() || "";
      const masterLabel = masterLabelInput?.value.trim() || "";
      const apiVersion = apiVersionInput?.value.trim() || "";
      const description = descriptionInput?.value.trim() || "";
      clearFormMessage();
      const tokenNameValidation = validateTokenName(tokenName);
      if (tokenNameValidation) return showFormMessage(tokenNameValidation);
      if (!masterLabel) return showFormMessage("Master Label is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      if (!description) return showFormMessage("Description is required.");
      try {
        await createLightningTokenBundle({
          tokenName,
          masterLabel,
          apiVersion,
          description
        });
        close();
      } catch (error) {
        showFormMessage(error.message || "Lightning Token bundle failed to create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function openCreateApexClassModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura">
        <div class="dc-modal-header">
          <h3>New Apex Class</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Class Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="apexClassName" maxlength="40" required aria-required="true" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Type</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apexClassType" required aria-required="true">
                  <option value="" selected disabled>Select class type</option>
                  <option value="normal">Normal Class</option>
                  <option value="batch">Batch Class</option>
                  <option value="queueable">Queueable Class</option>
                  <option value="schedulable">Schedulable Class</option>
                  <option value="test">Test Class</option>
                  <option value="rest">Rest Web Service Class</option>
                  <option value="soap">Soap Web Service Class</option>
                </select>
              </div>
            </label>
            <label class="dc-field"><span class="dc-field-label-line"><span class="dc-field-label-text">Sharing Type</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="sharingType">
                  <option value="with sharing" selected>With sharing (default)</option>
                  <option value="without sharing">Without sharing</option>
                  <option value="inherited sharing">Inherited sharing</option>
                </select>
              </div>
            </label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion" required aria-required="true">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const classNameInput = overlay.querySelector('[name="apexClassName"]');
    const classTypeInput = overlay.querySelector('[name="apexClassType"]');
    const sharingTypeInput = overlay.querySelector('[name="sharingType"]');
    const apiVersionInput = overlay.querySelector('[name="apiVersion"]');
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateClassName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Class Name is required.";
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Class Name must start with a letter and contain only letters, numbers, and underscores.";
      }
      if (normalized.length > 40) return "Class Name must not exceed 40 characters.";
      return "";
    };

    classNameInput?.addEventListener("input", clearFormMessage);
    classNameInput?.addEventListener("blur", () => {
      const message = validateClassName(classNameInput.value);
      if (message) showFormMessage(message);
    });
    classTypeInput?.addEventListener("change", clearFormMessage);
    sharingTypeInput?.addEventListener("change", clearFormMessage);
    apiVersionInput?.addEventListener("change", clearFormMessage);
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const className = classNameInput?.value.trim() || "";
      const classType = classTypeInput?.value.trim() || "";
      const sharingType = sharingTypeInput?.value.trim() || "with sharing";
      const apiVersion = apiVersionInput?.value.trim() || "";
      clearFormMessage();
      const classNameValidation = validateClassName(className);
      if (classNameValidation) return showFormMessage(classNameValidation);
      if (!classType) return showFormMessage("Class Type is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      try {
        await createApexClass({ className, classType, sharingType, apiVersion });
        close();
      } catch (error) {
        showFormMessage(error.message || "Apex class failed to create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function buildApexClassBody({ className, classType, sharingType = "with sharing" }) {
    const normalizedType = String(classType || "").trim().toLowerCase();
    const normalizedSharingType = String(sharingType || "").trim().toLowerCase();
    if (![
      "normal",
      "batch",
      "queueable",
      "schedulable",
      "test",
      "rest",
      "soap"
    ].includes(normalizedType)) {
      throw new Error("Select a valid Apex class type.");
    }
    if (!["with sharing", "without sharing", "inherited sharing"].includes(normalizedSharingType)) {
      throw new Error("Select a valid sharing type.");
    }

    const classDeclaration = (access = "public") => `${access} ${normalizedSharingType} class ${className}`;
    if (normalizedType === "batch") {
      return [
        `${classDeclaration()} implements Database.Batchable<SObject> {`,
        "    public Database.QueryLocator start(Database.BatchableContext context) {",
        "        return Database.getQueryLocator('SOQL Query...');",
        "    }",
        "",
        "    public void execute(Database.BatchableContext context, List<SObject> scope) {",
        "        // TODO: Process each batch scope.",
        "    }",
        "",
        "    public void finish(Database.BatchableContext context) {",
        "        // TODO: Perform post-processing.",
        "    }",
        "}",
        ""
      ].join("\n");
    }
    if (normalizedType === "queueable") {
      return [
        `${classDeclaration()} implements Queueable {`,
        "    public void execute(QueueableContext context) {",
        "        // TODO: Add asynchronous work.",
        "    }",
        "}",
        ""
      ].join("\n");
    }
    if (normalizedType === "schedulable") {
      return [
        `${classDeclaration()} implements Schedulable {`,
        "    public void execute(SchedulableContext context) {",
        "        // TODO: Add scheduled work.",
        "    }",
        "}",
        ""
      ].join("\n");
    }
    if (normalizedType === "test") {
      return [
        "@IsTest",
        `${classDeclaration("private")} {`,
        "    @IsTest",
        "    static void shouldRun() {",
        "        // TODO: Add test setup and assertions.",
        "        System.assertEquals(true, true);",
        "    }",
        "}",
        ""
      ].join("\n");
    }
    if (normalizedType === "rest") {
      return [
        `@RestResource(urlMapping='/${String(className).toLowerCase()}/*')`,
        `${classDeclaration("global")} {`,
        "    @HttpGet",
        "    global static String getResource() {",
        "        return '{\"message\":\"TODO\"}';",
        "    }",
        "}",
        ""
      ].join("\n");
    }
    if (normalizedType === "soap") {
      return [
        `${classDeclaration("global")} {`,
        "    webservice static String getResource() {",
        "        return 'TODO';",
        "    }",
        "}",
        ""
      ].join("\n");
    }
    return [
      `${classDeclaration()} {`,
      "    // TODO: Add your Apex logic here.",
      "}",
      ""
    ].join("\n");
  }

  async function createApexClass({ className, classType, sharingType = "with sharing", apiVersion }) {
    if (!sessionId) throw new Error("No session available.");
    const classBody = buildApexClassBody({ className, classType, sharingType });
    const classTypeLabel = String(classType || "Apex").replace(/^./, (value) => value.toUpperCase());
    showDeploymentToast("pending");
    addLog("INFO", `[APEX] - Creating ${classTypeLabel} class ${className}, please wait...`);
    let apexClassId = null;
    try {
      const apexClass = await createToolingRecord(sessionId, "ApexClass", {
        Name: className,
        Body: classBody,
        ApiVersion: Number(apiVersion)
      });
      apexClassId = apexClass.id || apexClass.Id;
      if (!apexClassId) throw new Error("Unable to create Apex class.");

      await refreshAndOpenNewApexClass(sessionId, {
        Id: apexClassId,
        Name: className,
        ApiVersion: Number(apiVersion),
        Status: "Active"
      });
      showDeploymentToast("success");
      addLog("SUCCESS", `[APEX] - Created ${classTypeLabel} class ${className} with id: ${apexClassId}`);
    } catch (error) {
      if (apexClassId) {
        try {
          await deleteToolingRecord(sessionId, "ApexClass", apexClassId);
          addLog("INFO", `[APEX] - Rolled back Apex class ${className} (${apexClassId}) after creation failure.`);
        } catch (rollbackError) {
          addLog("ERROR", `[APEX] - Rollback failed for ${className} (${apexClassId}): ${rollbackError.message || rollbackError}`);
        }
      }
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function refreshAndOpenNewApexClass(sessionIdValue, apexClass) {
    const apexGroup = treeGroups.apex;
    if (!apexGroup?.list) throw new Error("Apex File Explorer is unavailable.");

    const apexClasses = await listApexClasses(sessionIdValue);
    apexGroup.items = apexClasses;
    apexGroup.total = apexClasses.length;
    apexGroup.visibleItems = filterApexClasses(apexClasses, currentSearchQuery);
    updateTreeGroupCount(apexGroup, apexGroup.visibleItems.length);
    apexGroup.list.replaceChildren(...renderApexTreeItems(apexClasses));
    apexGroup.loaded = true;
    setTreeGroupExpanded("apex", true);

    const createdApexClass = apexClasses.find((item) => (
      item.Id === apexClass?.Id || item.Name === apexClass?.Name
    )) || apexClass;
    await openApexClassInEditor(createdApexClass);
  }

  function getApexTriggerEventOptions() {
    return [
      { value: "before insert", label: "Before Insert" },
      { value: "after insert", label: "After Insert" },
      { value: "before update", label: "Before Update" },
      { value: "after update", label: "After Update" },
      { value: "before delete", label: "Before Delete" },
      { value: "after delete", label: "After Delete" },
      { value: "after undelete", label: "After Undelete" }
    ];
  }

  function openCreateApexTriggerModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura">
        <div class="dc-modal-header">
          <h3>New Apex Trigger</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Trigger Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="apexTriggerName" maxlength="40" required aria-required="true" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">SObject Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="sObjectName" placeholder="Account or Custom_Object__c" maxlength="40" required aria-required="true" /></label>
          </div>
          <div class="dc-form-grid dc-form-grid-two">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Events</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-multiselect" data-multiselect="trigger-events">
                <button type="button" class="dc-multiselect-button" data-multiselect-button>
                  <span class="dc-multiselect-value" data-multiselect-value>Select events</span>
                  <span class="dc-dropdown-chevron" aria-hidden="true"></span>
                </button>
                <div class="dc-multiselect-panel" data-multiselect-panel hidden></div>
              </div>
            </label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion" required aria-required="true">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const triggerEvents = getApexTriggerEventOptions();
    const selectedEvents = new Set();
    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const triggerNameInput = overlay.querySelector('[name="apexTriggerName"]');
    const sObjectNameInput = overlay.querySelector('[name="sObjectName"]');
    const apiVersionInput = overlay.querySelector('[name="apiVersion"]');
    const multiselect = overlay.querySelector('[data-multiselect="trigger-events"]');
    const multiselectButton = overlay.querySelector("[data-multiselect-button]");
    const multiselectPanel = overlay.querySelector("[data-multiselect-panel]");
    const multiselectValue = overlay.querySelector("[data-multiselect-value]");
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateTriggerName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Trigger Name is required.";
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Trigger Name must start with a letter and contain only letters, numbers, and underscores.";
      }
      if (normalized.length > 40) return "Trigger Name must not exceed 40 characters.";
      return "";
    };
    const validateSObjectName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "SObject Name is required.";
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "SObject Name must be a valid Salesforce object API name.";
      }
      if (normalized.length > 40) return "SObject Name must not exceed 40 characters.";
      return "";
    };
    const renderEvents = () => {
      if (!multiselectPanel || !multiselectValue) return;
      multiselectPanel.innerHTML = triggerEvents.map((eventOption) => `
        <label class="dc-multiselect-option"><input type="checkbox" value="${escapeHtml(eventOption.value)}" ${selectedEvents.has(eventOption.value) ? "checked" : ""} /> <span>${escapeHtml(eventOption.label)}</span></label>
      `).join("");
      const selected = triggerEvents.filter((eventOption) => selectedEvents.has(eventOption.value));
      if (!selected.length) {
        multiselectValue.textContent = "Select events";
      } else if (selected.length === 1) {
        multiselectValue.textContent = selected[0].label;
      } else {
        const preview = selected.slice(0, 2).map((eventOption) => eventOption.label).join(", ");
        multiselectValue.textContent = selected.length > 2 ? `${preview}... (${selected.length})` : `${preview} (${selected.length})`;
      }
    };

    triggerNameInput?.addEventListener("input", clearFormMessage);
    triggerNameInput?.addEventListener("blur", () => {
      const message = validateTriggerName(triggerNameInput.value);
      if (message) showFormMessage(message);
    });
    sObjectNameInput?.addEventListener("input", clearFormMessage);
    sObjectNameInput?.addEventListener("blur", () => {
      const message = validateSObjectName(sObjectNameInput.value);
      if (message) showFormMessage(message);
    });
    apiVersionInput?.addEventListener("change", clearFormMessage);
    renderEvents();
    multiselectButton?.addEventListener("click", () => {
      const isHidden = multiselectPanel?.hasAttribute("hidden");
      if (isHidden) multiselectPanel?.removeAttribute("hidden"); else multiselectPanel?.setAttribute("hidden", "");
    });
    multiselectPanel?.addEventListener("change", (event) => {
      const checkbox = event.target.closest('input[type="checkbox"]');
      if (!checkbox) return;
      if (checkbox.checked) selectedEvents.add(checkbox.value); else selectedEvents.delete(checkbox.value);
      clearFormMessage();
      renderEvents();
    });
    overlay.addEventListener("click", (event) => {
      if (!multiselect?.contains(event.target)) multiselectPanel?.setAttribute("hidden", "");
    });
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const triggerName = triggerNameInput?.value.trim() || "";
      const sObjectName = sObjectNameInput?.value.trim() || "";
      const apiVersion = apiVersionInput?.value.trim() || "";
      const events = triggerEvents
        .filter((eventOption) => selectedEvents.has(eventOption.value))
        .map((eventOption) => eventOption.value);
      clearFormMessage();
      const triggerNameValidation = validateTriggerName(triggerName);
      if (triggerNameValidation) return showFormMessage(triggerNameValidation);
      const sObjectNameValidation = validateSObjectName(sObjectName);
      if (sObjectNameValidation) return showFormMessage(sObjectNameValidation);
      if (!events.length) return showFormMessage("Select at least one trigger event.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      try {
        await createApexTrigger({ triggerName, sObjectName, events, apiVersion });
        close();
      } catch (error) {
        showFormMessage(error.message || "Apex trigger failed to create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function buildApexTriggerBody({ triggerName, sObjectName, events = [] }) {
    const eventOptions = getApexTriggerEventOptions();
    const selectedEventValues = new Set(
      (Array.isArray(events) ? events : []).map((eventValue) => String(eventValue || "").trim().toLowerCase()).filter(Boolean)
    );
    const normalizedEvents = eventOptions
      .filter((eventOption) => selectedEventValues.has(eventOption.value))
      .map((eventOption) => eventOption.value);
    if (!normalizedEvents.length || normalizedEvents.length !== selectedEventValues.size) {
      throw new Error("Select at least one valid trigger event.");
    }

    return [
      `trigger ${triggerName} on ${sObjectName} (${normalizedEvents.join(", ")}) {`,
      "    // TODO: Add trigger logic here.",
      "}",
      ""
    ].join("\n");
  }

  async function createApexTrigger({ triggerName, sObjectName, events, apiVersion }) {
    if (!sessionId) throw new Error("No session available.");
    const triggerBody = buildApexTriggerBody({ triggerName, sObjectName, events });
    showDeploymentToast("pending");
    addLog("INFO", `[APEXTRIGGER] - Creating trigger ${triggerName}, please wait...`);
    let apexTriggerId = null;
    try {
      const apexTrigger = await createToolingRecord(sessionId, "ApexTrigger", {
        Name: triggerName,
        Body: triggerBody,
        TableEnumOrId: sObjectName,
        ApiVersion: Number(apiVersion)
      });
      apexTriggerId = apexTrigger.id || apexTrigger.Id;
      if (!apexTriggerId) throw new Error("Unable to create Apex trigger.");

      await refreshAndOpenNewApexTrigger(sessionId, {
        Id: apexTriggerId,
        Name: triggerName,
        TableEnumOrId: sObjectName,
        ApiVersion: Number(apiVersion),
        Status: "Active"
      });
      showDeploymentToast("success");
      addLog("SUCCESS", `[APEXTRIGGER] - Created trigger ${triggerName} with id: ${apexTriggerId}`);
    } catch (error) {
      if (apexTriggerId) {
        try {
          await deleteToolingRecord(sessionId, "ApexTrigger", apexTriggerId);
          addLog("INFO", `[APEXTRIGGER] - Rolled back Apex trigger ${triggerName} (${apexTriggerId}) after creation failure.`);
        } catch (rollbackError) {
          addLog("ERROR", `[APEXTRIGGER] - Rollback failed for ${triggerName} (${apexTriggerId}): ${rollbackError.message || rollbackError}`);
        }
      }
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function refreshAndOpenNewApexTrigger(sessionIdValue, apexTrigger) {
    const triggerGroup = treeGroups.trigger;
    if (!triggerGroup?.list) throw new Error("Apex Trigger File Explorer is unavailable.");

    const apexTriggers = await listApexTriggers(sessionIdValue);
    triggerGroup.items = apexTriggers;
    triggerGroup.total = apexTriggers.length;
    triggerGroup.visibleItems = filterApexTriggers(apexTriggers, currentSearchQuery);
    updateTreeGroupCount(triggerGroup, triggerGroup.visibleItems.length);
    triggerGroup.list.replaceChildren(...renderApexTriggerTreeItems(apexTriggers));
    triggerGroup.loaded = true;
    setTreeGroupExpanded("trigger", true);

    const createdApexTrigger = apexTriggers.find((item) => (
      item.Id === apexTrigger?.Id || item.Name === apexTrigger?.Name
    )) || apexTrigger;
    await openApexTriggerInEditor(createdApexTrigger);
  }
  function openCreateVisualforcePageModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura">
        <div class="dc-modal-header">
          <h3>New Visualforce Page</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Page Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="visualforcePageName" maxlength="40" required aria-required="true" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Master Label</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="masterLabel" required aria-required="true" /></label>
          </div>
          <div class="dc-form-grid">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion" required aria-required="true">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const pageNameInput = overlay.querySelector('[name="visualforcePageName"]');
    const masterLabelInput = overlay.querySelector('[name="masterLabel"]');
    const apiVersionInput = overlay.querySelector('[name="apiVersion"]');
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validatePageName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Page Name is required.";
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Page Name must start with a letter and contain only letters, numbers, and underscores.";
      }
      if (normalized.length > 40) return "Page Name must not exceed 40 characters.";
      return "";
    };
    const syncMasterLabelFromPageName = () => {
      if (!pageNameInput || !masterLabelInput) return;
      masterLabelInput.value = pageNameInput.value.trim();
    };

    pageNameInput?.addEventListener("input", () => {
      clearFormMessage();
      syncMasterLabelFromPageName();
    });
    pageNameInput?.addEventListener("blur", () => {
      const message = validatePageName(pageNameInput.value);
      if (message) showFormMessage(message);
    });
    masterLabelInput?.addEventListener("input", clearFormMessage);
    apiVersionInput?.addEventListener("change", clearFormMessage);
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const pageName = pageNameInput?.value.trim() || "";
      const masterLabel = masterLabelInput?.value.trim() || "";
      const apiVersion = apiVersionInput?.value.trim() || "";
      clearFormMessage();
      const pageNameValidation = validatePageName(pageName);
      if (pageNameValidation) return showFormMessage(pageNameValidation);
      if (!masterLabel) return showFormMessage("Master Label is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      try {
        await createVisualforcePage({ pageName, masterLabel, apiVersion });
        close();
      } catch (error) {
        showFormMessage(error.message || "Visualforce page failed to create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function buildVisualforcePageMarkup() {
    return [
      "<apex:page>",
      "    <!-- TODO: Add your Visualforce markup here. -->",
      "</apex:page>",
      ""
    ].join("\n");
  }

  async function createVisualforcePage({ pageName, masterLabel, apiVersion }) {
    if (!sessionId) throw new Error("No session available.");
    showDeploymentToast("pending");
    addLog("INFO", `[VISUALFORCEPAGE] - Creating page ${pageName}, please wait...`);
    let apexPageId = null;
    try {
      const apexPage = await createToolingRecord(sessionId, "ApexPage", {
        Name: pageName,
        MasterLabel: masterLabel,
        Markup: buildVisualforcePageMarkup(),
        ApiVersion: Number(apiVersion)
      });
      apexPageId = apexPage.id || apexPage.Id;
      if (!apexPageId) throw new Error("Unable to create Visualforce page.");

      await refreshAndOpenNewVisualforcePage(sessionId, {
        Id: apexPageId,
        Name: pageName,
        MasterLabel: masterLabel,
        ApiVersion: Number(apiVersion)
      });
      showDeploymentToast("success");
      addLog("SUCCESS", `[VISUALFORCEPAGE] - Created page ${pageName} with id: ${apexPageId}`);
    } catch (error) {
      if (apexPageId) {
        try {
          await deleteToolingRecord(sessionId, "ApexPage", apexPageId);
          addLog("INFO", `[VISUALFORCEPAGE] - Rolled back Visualforce page ${pageName} (${apexPageId}) after creation failure.`);
        } catch (rollbackError) {
          addLog("ERROR", `[VISUALFORCEPAGE] - Rollback failed for ${pageName} (${apexPageId}): ${rollbackError.message || rollbackError}`);
        }
      }
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function refreshAndOpenNewVisualforcePage(sessionIdValue, apexPage) {
    const visualforceGroup = treeGroups.vf;
    if (!visualforceGroup?.list) throw new Error("Visualforce Page Explorer is unavailable.");

    const pages = await listVisualforcePages(sessionIdValue);
    visualforceGroup.items = pages;
    visualforceGroup.total = pages.length;
    visualforceGroup.visibleItems = filterVisualforcePages(pages, currentSearchQuery);
    updateTreeGroupCount(visualforceGroup, visualforceGroup.visibleItems.length);
    visualforceGroup.list.replaceChildren(...renderVisualforceTreeItems(pages));
    visualforceGroup.loaded = true;
    setTreeGroupExpanded("vf", true);

    const createdPage = pages.find((item) => (
      item.Id === apexPage?.Id || item.Name === apexPage?.Name
    )) || apexPage;
    await openVisualforcePageInEditor(createdPage);
  }

  function openCreateVisualforceComponentModal() {
    const overlay = document.createElement("div");
    overlay.className = "dc-modal-overlay";
    overlay.innerHTML = `
      <div class="dc-modal dc-create-modal dc-create-modal-aura">
        <div class="dc-modal-header">
          <h3>New Visualforce Component</h3>
          <button type="button" class="dc-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="dc-modal-body">
          <div class="dc-modal-message dc-modal-message-hidden" data-form-message role="alert" aria-live="polite"></div>
          <div class="dc-form-grid dc-form-grid-two-inputs">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Component Name</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="visualforceComponentName" maxlength="40" required aria-required="true" /></label>
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">Master Label</span><span class="dc-required-indicator" aria-hidden="true">*</span></span><input class="dc-input" type="text" name="masterLabel" required aria-required="true" /></label>
          </div>
          <div class="dc-form-grid">
            <label class="dc-field dc-field-required"><span class="dc-field-label-line"><span class="dc-field-label-text">API Version</span><span class="dc-required-indicator" aria-hidden="true">*</span></span>
              <div class="dc-select-wrap">
                <select class="dc-select" name="apiVersion" required aria-required="true">
                  <option value="" selected disabled>Select API version</option>
                  <option value="67.0">67.0</option>
                  <option value="66.0">66.0</option>
                  <option value="65.0">65.0</option>
                  <option value="64.0">64.0</option>
                  <option value="63.0">63.0</option>
                  <option value="62.0">62.0</option>
                  <option value="61.0">61.0</option>
                  <option value="60.0">60.0</option>
                </select>
              </div>
            </label>
          </div>
        </div>
        <div class="dc-modal-footer">
          <button type="button" class="dc-button" data-cancel>Cancel</button>
          <button type="button" class="dc-button dc-button-primary" data-deploy>Deploy</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    const formMessage = overlay.querySelector("[data-form-message]");
    const componentNameInput = overlay.querySelector('[name="visualforceComponentName"]');
    const masterLabelInput = overlay.querySelector('[name="masterLabel"]');
    const apiVersionInput = overlay.querySelector('[name="apiVersion"]');
    const clearFormMessage = () => {
      if (!formMessage) return;
      formMessage.textContent = "";
      formMessage.className = "dc-modal-message dc-modal-message-hidden";
    };
    const showFormMessage = (message) => {
      if (!formMessage) return;
      formMessage.textContent = message;
      formMessage.className = "dc-modal-message dc-modal-message-error";
    };
    const validateComponentName = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "Component Name is required.";
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) {
        return "Component Name must start with a letter and contain only letters, numbers, and underscores.";
      }
      if (normalized.endsWith("_") || normalized.includes("__")) {
        return "Component Name cannot end with an underscore or contain consecutive underscores.";
      }
      if (normalized.length > 40) return "Component Name must not exceed 40 characters.";
      return "";
    };
    const syncMasterLabelFromComponentName = () => {
      if (!componentNameInput || !masterLabelInput) return;
      masterLabelInput.value = componentNameInput.value.trim();
    };

    componentNameInput?.addEventListener("input", () => {
      clearFormMessage();
      syncMasterLabelFromComponentName();
    });
    componentNameInput?.addEventListener("blur", () => {
      const message = validateComponentName(componentNameInput.value);
      if (message) showFormMessage(message);
    });
    masterLabelInput?.addEventListener("input", clearFormMessage);
    apiVersionInput?.addEventListener("change", clearFormMessage);
    overlay.querySelector(".dc-modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-deploy]")?.addEventListener("click", async () => {
      const componentName = componentNameInput?.value.trim() || "";
      const masterLabel = masterLabelInput?.value.trim() || "";
      const apiVersion = apiVersionInput?.value.trim() || "";
      clearFormMessage();
      const componentNameValidation = validateComponentName(componentName);
      if (componentNameValidation) return showFormMessage(componentNameValidation);
      if (!masterLabel) return showFormMessage("Master Label is required.");
      if (!apiVersion || Number.isNaN(Number(apiVersion))) return showFormMessage("API Version is required.");
      try {
        await createVisualforceComponent({ componentName, masterLabel, apiVersion });
        close();
      } catch (error) {
        showFormMessage(error.message || "Visualforce component failed to create.");
      }
    });
    document.body.appendChild(overlay);
  }

  function buildVisualforceComponentMarkup() {
    return [
      "<apex:component>",
      "    <!-- TODO: Add your Visualforce component markup here. -->",
      "</apex:component>",
      ""
    ].join("\n");
  }

  async function createVisualforceComponent({ componentName, masterLabel, apiVersion }) {
    if (!sessionId) throw new Error("No session available.");
    showDeploymentToast("pending");
    addLog("INFO", `[VISUALFORCECOMPONENT] - Creating component ${componentName}, please wait...`);
    let apexComponentId = null;
    try {
      const apexComponent = await createToolingRecord(sessionId, "ApexComponent", {
        Name: componentName,
        MasterLabel: masterLabel,
        Markup: buildVisualforceComponentMarkup(),
        ApiVersion: Number(apiVersion)
      });
      apexComponentId = apexComponent.id || apexComponent.Id;
      if (!apexComponentId) throw new Error("Unable to create Visualforce component.");

      await refreshAndOpenNewVisualforceComponent(sessionId, {
        Id: apexComponentId,
        Name: componentName,
        MasterLabel: masterLabel,
        ApiVersion: Number(apiVersion)
      });
      showDeploymentToast("success");
      addLog("SUCCESS", `[VISUALFORCECOMPONENT] - Created component ${componentName} with id: ${apexComponentId}`);
    } catch (error) {
      if (apexComponentId) {
        try {
          await deleteToolingRecord(sessionId, "ApexComponent", apexComponentId);
          addLog("INFO", `[VISUALFORCECOMPONENT] - Rolled back Visualforce component ${componentName} (${apexComponentId}) after creation failure.`);
        } catch (rollbackError) {
          addLog("ERROR", `[VISUALFORCECOMPONENT] - Rollback failed for ${componentName} (${apexComponentId}): ${rollbackError.message || rollbackError}`);
        }
      }
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function refreshAndOpenNewVisualforceComponent(sessionIdValue, apexComponent) {
    const visualforceComponentGroup = treeGroups.vfc;
    if (!visualforceComponentGroup?.list) throw new Error("Visualforce Component Explorer is unavailable.");

    const components = await listVisualforceComponents(sessionIdValue);
    visualforceComponentGroup.items = components;
    visualforceComponentGroup.total = components.length;
    visualforceComponentGroup.visibleItems = filterVisualforceComponents(components, currentSearchQuery);
    updateTreeGroupCount(visualforceComponentGroup, visualforceComponentGroup.visibleItems.length);
    visualforceComponentGroup.list.replaceChildren(...renderVisualforceComponentTreeItems(components));
    visualforceComponentGroup.loaded = true;
    setTreeGroupExpanded("vfc", true);

    const createdComponent = components.find((item) => (
      item.Id === apexComponent?.Id || item.Name === apexComponent?.Name
    )) || apexComponent;
    await openVisualforceComponentInEditor(createdComponent);
  }
  async function createLwcBundle({ componentName, masterLabel, apiVersion, targets = [], includeCss = false, description = "" }) {
    if (!sessionId) throw new Error("No session available.");
    showDeploymentToast("pending");
    addLog("INFO", `[LIGHTNINGWEBCOMPONENT] - Deploying changes for ${componentName}, please wait...`);
    let bundleId = null;
    try {
      const normalizedTargets = Array.isArray(targets) ? targets.map((target) => String(target || "").trim()).filter(Boolean) : [];
      const bundle = await createToolingRecord(sessionId, "LightningComponentBundle", {
        FullName: componentName,
        //Description: description,
        Metadata: {
          apiVersion: Number(apiVersion),
          isExposed: true,
          masterLabel: masterLabel || componentName,
          description: description || '',
          targets: {
            target: normalizedTargets.length > 0 ? normalizedTargets : []
          }
        }
      });
      bundleId = bundle.id || bundle.Id;
      if (!bundleId) throw new Error("Unable to create Lightning Component Bundle.");
      const componentClassName = componentName.charAt(0).toUpperCase() + componentName.slice(1);
      const basePath = `lwc/${componentName}/${componentName}`;
      const metadataSource = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<LightningComponentBundle xmlns="http://sforce.com/2006/04/metadata">',
        `    <apiVersion>${Number(apiVersion).toFixed(1)}</apiVersion>`,
        "    <isExposed>true</isExposed>",
        ...(description ? [`    <description>${description}</description>`] : []),
        "    <targets>",
        ...normalizedTargets.map((target) => `        <target>${target}</target>`),
        "    </targets>",
        "</LightningComponentBundle>",
        ""
      ].join("\n");
      await createToolingRecord(sessionId, "LightningComponentResource", {
        LightningComponentBundleId: bundleId,
        Format: "js",
        FilePath: `${basePath}.js`,
        Source: [
          "import { LightningElement } from 'lwc';",
          `export default class ${componentClassName} extends LightningElement {`,
          "    // TODO: Add your component logic here.",
          "}",
          ""
        ].join("\n")
      });
      await createToolingRecord(sessionId, "LightningComponentResource", {
        LightningComponentBundleId: bundleId,
        Format: "html",
        FilePath: `${basePath}.html`,
        Source: [
          "<template>",
          "    <!-- TODO: Add your component markup here. -->",
          "</template>",
          ""
        ].join("\n")
      });
      await createToolingRecord(sessionId, "LightningComponentResource", {
        LightningComponentBundleId: bundleId,
        Format: "xml",
        FilePath: `${basePath}.js-meta.xml`,
        Source: metadataSource
      });
      if (includeCss) {
        await createToolingRecord(sessionId, "LightningComponentResource", {
          LightningComponentBundleId: bundleId,
          Format: "css",
          FilePath: `${basePath}.css`,
          Source: [
            "/* TODO: Add your component styling here. */",
            ""
          ].join("\n")
        });
      }
      await refreshAndOpenNewLwcBundle(sessionId, componentName);
      showDeploymentToast("success");
      addLog("SUCCESS", `[LIGHTNINGWEBCOMPONENT] - Created bundle for ${componentName} with id: ${bundleId}`);
    } catch (error) {
      if (bundleId) {
        try {
          await deleteToolingRecord(sessionId, "LightningComponentBundle", bundleId);
          addLog("INFO", `[LIGHTNINGWEBCOMPONENT] - Rolled back Lightning Component bundle: ${componentName} (${bundleId}) after deployment failure.`);
        } catch (rollbackError) {
          addLog("ERROR", `[LIGHTNINGWEBCOMPONENT] - Rollback failed for ${componentName} (${bundleId}): ${rollbackError.message || rollbackError}`);
        }
      }
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  function buildAuraComponentDefinitions(targets = []) {
    const normalizedTargets = Array.isArray(targets)
      ? targets.map((target) => String(target || "").trim()).filter(Boolean)
      : [];
    const implementsAttribute = normalizedTargets.length
      ? ` implements="${normalizedTargets.join(",")}"`
      : "";

    return [
      {
        defType: "COMPONENT",
        format: "XML",
        source: [
          `<aura:component${implementsAttribute} access="global">`,
          "    <!-- TODO: Add your component markup here -->",
          "</aura:component>",
          ""
        ].join("\n")
      },
      {
        defType: "CONTROLLER",
        format: "JS",
        source: [
          "({",
          "    // TODO: Add your client-side controller actions here.",
          "})",
          ""
        ].join("\n")
      },
      {
        defType: "HELPER",
        format: "JS",
        source: [
          "({",
          "    // TODO: Add helper methods here.",
          "})",
          ""
        ].join("\n")
      }
    ];
  }

  function buildAuraApplicationDefinitions(targets = []) {
    const normalizedTargets = Array.isArray(targets)
      ? targets.map((target) => String(target || "").trim()).filter(Boolean)
      : [];
    const implementsAttribute = normalizedTargets.length
      ? ` implements="${normalizedTargets.join(",")}"`
      : "";

    return [{
      defType: "APPLICATION",
      format: "XML",
      source: [
        `<aura:application${implementsAttribute} access="global">`,
        "    <!-- TODO: Add your application markup here -->",
        "</aura:application>",
        ""
      ].join("\n")
    }];
  }

  async function createAuraApplicationBundle({ applicationName, masterLabel, apiVersion, description = "", targets = [] }) {
    return createAuraDefinitionBundle({
      bundleName: applicationName,
      masterLabel,
      apiVersion,
      description,
      definitions: buildAuraApplicationDefinitions(targets),
      auraTreeGroup: "auraApplication",
      logTag: "AURAAPPLICATION",
      primaryDefinition: { defType: "APPLICATION", format: "XML" }
    });
  }

  function buildLightningEventDefinitions(eventType) {
    const normalizedEventType = String(eventType || "").trim().toUpperCase();
    if (!["COMPONENT", "APPLICATION"].includes(normalizedEventType)) {
      throw new Error("Lightning Event Type must be Component or Application.");
    }

    return [{
      defType: "EVENT",
      format: "XML",
      source: [
        `<aura:event type="${normalizedEventType}">`,
        "    <!-- TODO: Add event attributes here -->",
        "</aura:event>",
        ""
      ].join("\n")
    }];
  }

  async function createLightningEventBundle({ eventName, masterLabel, eventType, apiVersion, description = "" }) {
    return createAuraDefinitionBundle({
      bundleName: eventName,
      masterLabel,
      apiVersion,
      description,
      definitions: buildLightningEventDefinitions(eventType),
      auraTreeGroup: "auraEvent",
      logTag: "LIGHTNINGEVENT",
      primaryDefinition: { defType: "EVENT", format: "XML" }
    });
  }

  function buildLightningInterfaceDefinitions() {
    return [{
      defType: "INTERFACE",
      format: "XML",
      source: [
        "<aura:interface>",
        "    <!-- TODO: Add interface attributes here -->",
        "</aura:interface>",
        ""
      ].join("\n")
    }];
  }

  async function createLightningInterfaceBundle({ interfaceName, masterLabel, apiVersion, description = "" }) {
    return createAuraDefinitionBundle({
      bundleName: interfaceName,
      masterLabel,
      apiVersion,
      description,
      definitions: buildLightningInterfaceDefinitions(),
      auraTreeGroup: "auraInterface",
      logTag: "LIGHTNINGINTERFACE",
      primaryDefinition: { defType: "INTERFACE", format: "XML" }
    });
  }

  function buildLightningTokenDefinitions() {
    return [{
      defType: "TOKENS",
      format: "XML",
      source: [
        "<aura:tokens>",
        "    <!-- TODO: Add design tokens here -->",
        "</aura:tokens>",
        ""
      ].join("\n")
    }];
  }

  async function createLightningTokenBundle({ tokenName, masterLabel, apiVersion, description = "" }) {
    return createAuraDefinitionBundle({
      bundleName: tokenName,
      masterLabel,
      apiVersion,
      description,
      definitions: buildLightningTokenDefinitions(),
      auraTreeGroup: "auraToken",
      logTag: "LIGHTNINGTOKEN",
      primaryDefinition: { defType: "TOKENS", format: "XML" }
    });
  }

  async function createAuraDefinitionResources(sessionIdValue, auraDefinitionBundleId, definitions = []) {
    if (!auraDefinitionBundleId) throw new Error("Unable to create Aura definitions without a bundle Id.");
    const resources = Array.isArray(definitions) ? definitions : [];
    if (!resources.length) throw new Error("At least one Aura definition is required.");

    for (const definition of resources) {
      const defType = String(definition?.defType || "").trim();
      const format = String(definition?.format || "").trim();
      if (!defType || !format) throw new Error("Aura definitions require both DefType and Format.");
      await createToolingRecord(sessionIdValue, "AuraDefinition", {
        AuraDefinitionBundleId: auraDefinitionBundleId,
        DefType: defType,
        Format: format,
        Source: String(definition?.source ?? "")
      });
    }
  }

  async function createAuraDefinitionBundle({
    bundleName,
    masterLabel,
    apiVersion,
    description = "",
    definitions = [],
    auraTreeGroup = "aura",
    logTag = "AURACOMPONENT",
    primaryDefinition = { defType: "COMPONENT", format: "XML" }
  }) {
    if (!sessionId) throw new Error("No session available.");
    showDeploymentToast("pending");
    addLog("INFO", `[${logTag}] - Deploying changes for ${bundleName}, please wait...`);
    let bundleId = null;
    try {
      const bundle = await createToolingRecord(sessionId, "AuraDefinitionBundle", {
        DeveloperName: bundleName,
        MasterLabel: masterLabel || bundleName,
        ApiVersion: Number(apiVersion),
        Description: description || ""
      });
      bundleId = bundle.id || bundle.Id;
      if (!bundleId) throw new Error("Unable to create Aura Definition Bundle.");

      await createAuraDefinitionResources(sessionId, bundleId, definitions);
      await refreshAndOpenNewAuraBundle(sessionId, {
        bundleName,
        bundleId,
        auraTreeGroup,
        primaryDefinition
      });
      showDeploymentToast("success");
      addLog("SUCCESS", `[${logTag}] - Created bundle for ${bundleName} with id: ${bundleId}`);
    } catch (error) {
      if (bundleId) {
        try {
          await deleteToolingRecord(sessionId, "AuraDefinitionBundle", bundleId);
          addLog("INFO", `[${logTag}] - Rolled back Aura Definition Bundle: ${bundleName} (${bundleId}) after deployment failure.`);
        } catch (rollbackError) {
          addLog("ERROR", `[${logTag}] - Rollback failed for ${bundleName} (${bundleId}): ${rollbackError.message || rollbackError}`);
        }
      }
      showDeploymentToast("error");
      logDeploymentErrors(error);
      throw error;
    }
  }

  async function refreshAndOpenNewAuraBundle(sessionIdValue, { bundleName, bundleId, auraTreeGroup = "aura", primaryDefinition = {} }) {
    const auraGroup = treeGroups[auraTreeGroup];
    if (!auraGroup?.list) throw new Error("Aura File Explorer is unavailable.");

    auraGroup.loaded = false;
    setTreeGroupExpanded(auraTreeGroup, true);
    const bundleNode = await waitForAuraBundleNode(bundleName, auraTreeGroup);
    const bundleRecord = findAuraBundleRecord(bundleName, auraTreeGroup);
    const resolvedBundleId = bundleRecord?.Id || bundleId;
    const definitions = await listAuraDefinitionsForBundle(sessionIdValue, resolvedBundleId);
    const files = definitions
      .map((definition) => normalizeAuraDefinition(definition, bundleName))
      .filter((file) => file.path && file.path !== "unknown");
    const primaryDefType = String(primaryDefinition?.defType || "COMPONENT").toUpperCase();
    const primaryFormat = String(primaryDefinition?.format || "XML").toUpperCase();
    const primaryFile = files.find((file) => (
      String(file.defType || "").toUpperCase() === primaryDefType
      && String(file.format || "").toUpperCase() === primaryFormat
    )) || files[0];
    if (!primaryFile) throw new Error("Aura Definition Bundle was created without a primary definition.");

    if (bundleNode) {
      ensureBundleNodeExpanded(bundleName, findAuraComponentNode, auraTreeGroup);
      const bundleChildren = bundleNode.querySelector(`.dc-bundle-children[data-bundle-children="${bundleName}"]`);
      if (bundleChildren) {
        const visibleFiles = filterBundleFiles(files, currentSearchQuery);
        bundleChildren.replaceChildren(...renderAuraBundleFiles(bundleName, visibleFiles, openAuraFileInEditor, auraTreeGroup));
      }
    }

    await openAuraFileInEditor(
      bundleName,
      primaryFile.path,
      primaryFile.content,
      primaryFile.defType,
      primaryFile.format,
      auraTreeGroup,
      resolvedBundleId
    );
  }

  async function refreshAndOpenNewLwcBundle(sessionIdValue, bundleName) {
    const lwcGroup = treeGroups.lwc;
    if (!lwcGroup?.list) return;
    lwcGroup.loaded = false;
    setTreeGroupExpanded("lwc", true);
    await ensureLwcTreeLoaded();

    const bundleNode = await waitForLwcBundleNode(bundleName);
    if (bundleNode) {
      bundleNode.classList.add("dc-bundle-expanded");
      const caret = bundleNode.querySelector(".dc-bundle-caret");
      if (caret) caret.textContent = "▾";
      const toggle = bundleNode.querySelector(".dc-bundle-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
    }

    const bundle = treeGroups.lwc.items.find((item) => item.DeveloperName === bundleName);
    if (!bundle?.Id || !bundleNode) return;

    const resources = await listLwcComponentResources(sessionIdValue, bundle.Id);
    const files = resources.map(normalizeResourceFile).filter((file) => file.path && file.path !== "unknown");
    const bundleChildren = bundleNode?.querySelector(`.dc-bundle-children[data-bundle-children="${bundleName}"]`);
    if (bundleChildren) {
      bundleChildren.replaceChildren(...renderLwcBundleFiles(bundleName, filterBundleFiles(files, currentSearchQuery)));
    }

    const htmlFile = files.find((file) => /\.html$/i.test(file.path)) || null;
    await openFileInEditor(bundleName, htmlFile.path, htmlFile.content || "<template>\n</template>");
  }
}






