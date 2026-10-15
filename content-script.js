(async function initLightningConnect() {
  const allowedHosts = [
    /(^|\.)lightning\.force\.com$/i,
    /(^|\.)salesforce\.com$/i,
    /(^|\.)my\.salesforce\.com$/i,
    /(^|\.)my\.salesforce-setup\.com$/i,
    /(^|\.)visual\.force\.com$/i,
    /(^|\.)salesforce-setup\.com$/i
  ];

  if (!allowedHosts.some((pattern) => pattern.test(window.location.hostname))) return;
  if (window.__lightningConnectLauncherMounted || document.querySelector("[data-lightning-connect-root='true']")) return;

  const sidCheck = await chrome.runtime.sendMessage({
    type: "CHECK_SID_COOKIE",
    sourceOrigin: window.location.origin
  }).catch(() => null);
  if (!sidCheck?.ok || sidCheck.hasSid !== true) return;

  window.__lightningConnectLauncherMounted = true;

  const initialRecordInfo = getRecordInfoFromUrl();
  const pageObjectApiName = getObjectApiNameFromUrl() || initialRecordInfo?.objectApiName || null;
  const pageRecordId = initialRecordInfo?.recordId || "";
  const state = {
    open: false,
    tab: "objects",
    query: "",
    searchResults: [],
    searchLoading: false,
    userRecord: null,
    userSearchResults: [],
    userSearchLoading: false,
    organization: null,
    organizationLoading: false,
    currentUserId: "",
    objectRecord: pageObjectApiName ? {
      apiName: pageObjectApiName,
      label: humanizeObjectName(pageObjectApiName),
    category: /__c$|__mdt$|__b$|__e$/.test(pageObjectApiName) ? "Custom" : "Standard",
    keyPrefix: ""
    } : null,
    domainName: null
    ,recordId: pageRecordId,
    recordData: null,
    recordFields: [],
    notice: null
  };

  const rootHost = document.createElement("div");
  rootHost.setAttribute("data-lightning-connect-root", "true");
  rootHost.style.cssText = "position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483647;display:block;visibility:visible;pointer-events:auto;";

  const shadow = rootHost.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      * {
        box-sizing: border-box;
      }

      .launcher {
        position: relative;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .launcher.open {
        width: min(80vw, 350px);
        height: min(80vh, 640px);
      }

      .button {
        position: absolute;
        right: 0;
        top: 50%;
        width: 30px;
        height: 38px;
        transform: translateY(-50%);
        border: 1px solid rgba(91, 132, 171, 0.8);
        border-right: 0;
        border-radius: 13px 0 0 13px;
        background: linear-gradient(180deg, rgba(29, 139, 194, 0.78), rgba(13, 101, 141, 0.78));
        color: #fff;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
        display: grid;
        place-items: center;
        padding: 0;
        opacity: 0.82;
        transition: opacity 160ms ease, transform 160ms ease, background 160ms ease;
        backdrop-filter: blur(3px) saturate(0.96);
      }

      .button:hover {
        opacity: 0.96;
      }

      .button svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
        transform: rotate(0deg);
        transition: transform 180ms ease;
      }

      .launcher.open .button svg {
        transform: rotate(180deg);
      }

      .launcher.open .button {
        right: 100%;
        top: 0;
        width: 30px;
        height: 38px;
        transform: none;
        border: 1px solid rgba(91, 132, 171, 0.8);
        border-right: 0;
        border-radius: 12px 0 0 12px;
      }

      .drawer {
        position: absolute;
        right: 0;
        top: 0;
        width: 100%;
        height: 100%;
        max-height: 100%;
        transform: translateX(18px);
        opacity: 0;
        pointer-events: none;
        transition: transform 180ms ease, opacity 180ms ease;
        border: 1px solid #cfd7e6;
        border-right: 0;
        /* Keep the top-left edge square so the open launcher can meet it cleanly. */
        border-radius: 0 0 0 14px;
        background: #fff;
        box-shadow: 0 18px 38px rgba(10, 28, 58, 0.22);
        overflow: hidden;
      }

      .launcher.open .drawer {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(0);
      }

      .drawer-shell {
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .drawer-header {
        padding: 10px 11px 8px;
        border-bottom: 1px solid #d8dde6;
        background: linear-gradient(180deg, #f8fbff, #f2f5fa);
      }

      .notice-panel {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: start;
        padding: 10px 11px;
        border-bottom: 1px solid #efb4b4;
        background: #fde2e2;
        color: #8f1d1d;
      }

      .notice-panel[hidden] { display: none; }
      .notice-panel.notice-warning { border-bottom-color: #e6c36a; background: #fff4cc; color: #795600; }
      .notice-panel.notice-success { border-bottom-color: #8ad1b0; background: #dff7ea; color: #146c43; }
      .notice-panel-content { min-width: 0; }
      .notice-panel-title { font-size: 12px; font-weight: 800; }
      .notice-panel-message { margin-top: 3px; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
      .notice-panel-close {
        width: 24px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: currentColor;
        font: inherit;
        font-size: 22px;
        line-height: 20px;
        cursor: pointer;
      }

      .notice-panel-close:hover { background: rgba(0, 0, 0, 0.1); }

      .title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .title {
        font-size: 16px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: #16325c;
        white-space: nowrap;
      }

      .tabs {
        display: flex;
        align-items: center;
        gap: 0;
        justify-content: flex-start;
      }

      .drawer-tabs {
        padding: 0 11px;
        border-bottom: 1px solid #d8dde6;
        background: #fff;
      }

      .tab {
        position: relative;
        border: 0;
        border-bottom: 3px solid transparent;
        background: transparent;
        border-radius: 0;
        padding: 10px 13px 8px;
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        color: #42526e;
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
      }

      .tab:hover {
        background: #f5f9ff;
        color: #0b5cab;
      }

      .tab.active {
        border-bottom-color: #0b5cab;
        color: #0b5cab;
      }

      .tab:focus-visible {
        outline: 2px solid #0176d3;
        outline-offset: -2px;
      }

      .drawer-scroll {
        flex: 1;
        min-height: 0;
        overflow: auto;
        background: #fff;
      }

      .section {
        padding: 9px 11px;
      }

      .section + .section {
        border-top: 1px solid #d8dde6;
      }

      .search-box {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 38px;
        padding: 0 10px;
        border: 1px solid #b9c9db;
        border-radius: 14px;
        background: #fff;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }

      .search-box:focus-within {
        border-color: #0b5cab;
        box-shadow: 0 0 0 2px rgba(11, 92, 171, 0.12);
      }

      .search-box svg {
        width: 18px;
        height: 18px;
        fill: #6b7a90;
        flex: 0 0 auto;
      }

      .search-input {
        width: 100%;
        min-width: 0;
        border: 0;
        outline: none;
        background: transparent;
        font: inherit;
        font-size: 14px;
        color: #16325c;
      }

      .results-panel {
        min-height: 220px;
        display: grid;
        gap: 10px;
        align-content: start;
      }

      .empty-state {
        min-height: 220px;
        display: grid;
        place-items: center;
        text-align: center;
        color: #5c6b80;
        padding: 8px 4px;
      }

      .empty-illus {
        position: relative;
        width: 150px;
        height: 92px;
        margin-bottom: 10px;
        border-radius: 24px;
        border: 1px dashed #d5deea;
        background: linear-gradient(180deg, #f8fbff, #eef3fb);
      }

      .empty-illus::before {
        content: "";
        position: absolute;
        width: 44px;
        height: 44px;
        left: 20px;
        top: 22px;
        border-radius: 50%;
        border: 4px solid rgba(11, 92, 171, 0.18);
        box-shadow: 18px 0 0 -12px rgba(11, 92, 171, 0.18);
      }

      .empty-illus::after {
        content: "";
        position: absolute;
        right: 18px;
        top: 18px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 4px solid rgba(11, 92, 171, 0.12);
      }

      .empty-title {
        font-size: 15px;
        font-weight: 700;
        color: #5c6b80;
      }

      .empty-subtitle {
        margin-top: 4px;
        font-size: 12px;
        color: #7f8ca1;
      }

      .record-card,
      .user-card {
        border: 1px solid #d8dde6;
        border-radius: 14px;
        background: #fff;
        padding: 12px;
        display: grid;
        gap: 8px;
        box-shadow: 0 2px 0 rgba(11, 92, 171, 0.02);
      }

      .user-card { gap: 4px; }

      .user-title { color: #0b5cab; text-decoration: underline; font-size: 14px; font-weight: 800; }
      .user-detail-line { color: #5c6b80; font-size: 12px; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }

      .org-card {
        border: 1px solid #d8dde6;
        border-radius: 14px;
        background: #fff;
        padding: 11px;
        display: grid;
        gap: 11px;
        box-shadow: 0 2px 0 rgba(11, 92, 171, 0.02);
      }

      .org-grid {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: 6px 10px;
        align-items: start;
      }

      .org-label {
        color: #66788a;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      }

      .org-value {
        color: #16325c;
        font-size: 11px;
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .object-card { gap: 3px; }

      .object-search-card {
        width: 100%;
        display: grid;
        gap: 2px;
        padding: 9px 10px;
        border: 1px solid #d8dde6;
        border-radius: 10px;
        background: #fff;
        text-align: left;
        cursor: pointer;
      }

      .object-search-card:hover { background: #f5f9ff; }
      .object-search-label { color: #0b5cab; font-size: 13px; font-weight: 800; }
      .object-search-meta { color: #5c6b80; font-size: 12px; }

      .record-detail-card {
        border: 1px solid #d8dde6;
        border-radius: 10px;
        background: #fff;
        padding: 9px 10px;
        display: grid;
        gap: 4px;
        color: #5c6b80;
        font-size: 12px;
        font-weight: 700;
      }

      .record-detail-line { font-weight: 700; }
      .record-id-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .record-detail-line strong { color: #16325c; }
      .record-detail-line a { color: #0b5cab; text-decoration: underline; }

      .object-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .object-title,
      .object-links a {
        color: #0b5cab;
        text-decoration: underline;
        cursor: pointer;
      }

      .object-title { font-size: 16px; font-weight: 800; }
      .object-subtitle-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .object-subtitle,
      .object-api,
      .object-prefix,
      .object-links { color: #5c6b80; font-size: 12px; font-weight: 700; line-height: 1.3; }
      .object-subtitle-row .card-badge { margin-left: auto; }
      .object-links span { font-weight: 700; }

      .new-object-button,
      .card-action-button {
        border: 1px solid #b8c7da;
        border-radius: 999px;
        background: #fff;
        color: #0b5cab;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .new-object-button { padding: 5px 11px; font-size: 12px; width: 65px;}
      .card-action-button { width: 100%; margin-top: 6px; padding: 7px 10px; font-size: 12px; }

      .card-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-weight: 800;
        color: #16325c;
      }

      .card-badge {
        flex: 0 0 auto;
        border: 1px solid #d8dde6;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 700;
        color: #5c6b80;
        background: #f8fbff;
      }

      .card-subtitle {
        color: #5c6b80;
        font-size: 12px;
        line-height: 1.4;
      }

      .card-grid {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 4px 10px;
        align-items: start;
      }

      .label {
        color: #66788a;
        font-size: 12px;
        font-weight: 700;
      }

      .value {
        color: #0b5cab;
        font-size: 13px;
        font-weight: 700;
        word-break: break-word;
      }

      .metadata-title {
        margin-bottom: 10px;
        font-size: 15px;
        font-weight: 800;
        color: #16325c;
      }

      .menu-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .menu-button {
        min-height: 40px;
        border: 1px solid #b8c7da;
        border-radius: 999px;
        background: #fff;
        color: #0b5cab;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        padding: 10px 12px;
        cursor: pointer;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
      }

      .menu-button:hover {
        background: #f5f9ff;
      }

      .drawer-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 40px;
        padding: 6px 10px;
        border-top: 1px solid #d8dde6;
        background: #f8fafc;
      }

      .version {
        font-size: 12px;
        font-weight: 700;
        color: #5c6b80;
      }

      .settings-button {
        border: 0;
        background: transparent;
        width: 24px;
        height: 24px;
        padding: 0;
        display: grid;
        place-items: center;
        cursor: pointer;
        color: #7b8794;
      }

      .settings-button svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      :host(.dark-theme) .drawer-shell,
      :host(.dark-theme) .drawer-scroll { background: #101827; color: #e8eef7; }
      :host(.dark-theme) .button,
      :host(.dark-theme) .launcher.open .button { background: #22314a; border-color: #52627a; color: #f4f7fb; }
      :host(.dark-theme) .notice-panel { border-color: #35445b; background: #182438; color: #e8eef7; }
      :host(.dark-theme) .notice-panel.notice-success { border-color: #28634f; background: #163b32; color: #d5f5e5; }
      :host(.dark-theme) .notice-panel.notice-warning { border-color: #806b2f; background: #3d3519; color: #f6e7a5; }
      :host(.dark-theme) .notice-panel.notice-error { border-color: #7d3b43; background: #401f28; color: #ffd9df; }
      :host(.dark-theme) .drawer-header,
      :host(.dark-theme) .drawer-footer { background: #182438; border-color: #35445b; }
      :host(.dark-theme) .drawer-tabs { background: #182438; border-color: #35445b; }
      :host(.dark-theme) .title,
      :host(.dark-theme) .metadata-title,
      :host(.dark-theme) .card-title,
      :host(.dark-theme) .org-value,
      :host(.dark-theme) .record-detail-line strong { color: #e8eef7; }
      :host(.dark-theme) .tab { color: #aebbd0; }
      :host(.dark-theme) .tab:hover { background: #22314a; color: #7db7f0; }
      :host(.dark-theme) .tab.active,
      :host(.dark-theme) .user-title,
      :host(.dark-theme) .object-title,
      :host(.dark-theme) .object-links a,
      :host(.dark-theme) .object-search-label,
      :host(.dark-theme) .value { color: #7db7f0; }
      :host(.dark-theme) .section + .section { border-color: #35445b; }
      :host(.dark-theme) .search-box { background: #182438; border-color: #52627a; box-shadow: none; }
      :host(.dark-theme) .search-input { color: #e8eef7; }
      :host(.dark-theme) .search-input::placeholder { color: #8291a8; }
      :host(.dark-theme) .empty-state,
      :host(.dark-theme) .empty-title,
      :host(.dark-theme) .user-detail-line,
      :host(.dark-theme) .object-subtitle,
      :host(.dark-theme) .object-api,
      :host(.dark-theme) .object-prefix,
      :host(.dark-theme) .object-links,
      :host(.dark-theme) .record-detail-card,
      :host(.dark-theme) .card-subtitle,
      :host(.dark-theme) .label,
      :host(.dark-theme) .org-label,
      :host(.dark-theme) .version { color: #aebbd0; }
      :host(.dark-theme) .empty-subtitle { color: #8291a8; }
      :host(.dark-theme) .empty-illus { border-color: #35445b; background: linear-gradient(180deg, #22314a, #182438); }
      :host(.dark-theme) .record-card,
      :host(.dark-theme) .user-card,
      :host(.dark-theme) .org-card,
      :host(.dark-theme) .object-search-card,
      :host(.dark-theme) .record-detail-card { background: #182438; border-color: #35445b; box-shadow: none; }
      :host(.dark-theme) .object-search-card:hover,
      :host(.dark-theme) .menu-button:hover { background: #22314a; }
      :host(.dark-theme) .new-object-button,
      :host(.dark-theme) .card-action-button,
      :host(.dark-theme) .menu-button,
      :host(.dark-theme) .card-badge { background: #182438; border-color: #52627a; color: #7db7f0; }
      :host(.dark-theme) .menu-button { box-shadow: none; }
      :host(.dark-theme) .card-badge { background: #22314a; color: #aebbd0; }

      @media (max-width: 520px) {
        .launcher.open {
          width: 80vw;
          height: 80vh;
        }
      }
    </style>
    <div class="launcher" id="lc-launcher" aria-expanded="false">
      <section class="drawer" id="lc-drawer" aria-label="Salesforce Connect">
        <div class="drawer-shell">
          <div class="drawer-header">
            <div class="title-row">
              <div class="title">Salesforce Connect</div>
            </div>
          </div>

          <div class="notice-panel" id="lc-notice-panel" role="status" aria-live="polite" hidden>
            <div class="notice-panel-content">
              <div class="notice-panel-title" id="lc-notice-title"></div>
              <div class="notice-panel-message" id="lc-notice-message"></div>
            </div>
            <button class="notice-panel-close" id="lc-notice-close" type="button" aria-label="Dismiss message" title="Dismiss message">×</button>
          </div>

          <div class="drawer-tabs">
            <div class="tabs" role="tablist" aria-label="Connector tabs">
              <button class="tab active" type="button" data-tab="objects" role="tab" aria-selected="true">Objects</button>
              <button class="tab" type="button" data-tab="users" role="tab" aria-selected="false">Users</button>
              <button class="tab" type="button" data-tab="organization" role="tab" aria-selected="false">Organization</button>
            </div>
          </div>

          <div class="drawer-scroll">
            <section class="section" id="lc-search-section">
              <label class="sr-only" for="lc-search">Search</label>
              <div class="search-box">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M10 4a6 6 0 1 1 3.68 10.72l4.8 4.8-1.42 1.42-4.8-4.8A6 6 0 0 1 10 4m0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path>
                </svg>
                <input id="lc-search" class="search-input" type="search" autocomplete="off" spellcheck="false" />
              </div>
            </section>

            <section class="section">
              <div class="results-panel" id="lc-results" aria-live="polite"></div>
            </section>

            <section class="section">
              <div class="metadata-title">Data &amp; Metadata</div>
              <div class="menu-grid">
                <button class="menu-button" type="button" data-key="dataExport">Data Export</button>
                <button class="menu-button" type="button" data-key="dataImport">Data Import</button>
                <button class="menu-button" type="button" data-key="downloadMetadata">Download Metadata</button>
                <button class="menu-button" type="button" data-key="developerConsole">Developer Console</button>
              </div>
            </section>
          </div>

          <div class="drawer-footer">
            <div class="version" id="lc-api-version">API Version: v—</div>
            <button class="settings-button" type="button" data-key="settings" aria-label="Settings" title="Settings">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19.14,12.94a7.43,7.43,0,0,0,.05-1l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.61-.22l-2.49,1a7.28,7.28,0,0,0-1.73-1l-.38-2.65A.5.5,0,0,0,13.7,3H10.3a.5.5,0,0,0-.49.42L9.43,6.07a7.28,7.28,0,0,0-1.73,1l-2.49-1a.5.5,0,0,0-.61.22l-2,3.46a.5.5,0,0,0,.12.64L4.84,11.9a7.43,7.43,0,0,0,0,2L2.73,15.55a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.61.22l2.49-1a7.28,7.28,0,0,0,1.73,1l.38,2.65a.5.5,0,0,0,.49.42h3.4a.5.5,0,0,0,.49-.42l.38-2.65a7.28,7.28,0,0,0,1.73-1l2.49,1a.5.5,0,0,0,.61-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/>
              </svg>
            </button>
          </div>
        </div>
      </section>

      <button class="button" id="lc-button" aria-label="Open Salesforce Connect" aria-expanded="false" title="Open Salesforce Connect">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6V6z"></path>
        </svg>
      </button>
    </div>
  `;

  document.documentElement.appendChild(rootHost);

  const launcher = shadow.getElementById("lc-launcher");
  const button = shadow.getElementById("lc-button");
  const drawer = shadow.getElementById("lc-drawer");
  const noticePanel = shadow.getElementById("lc-notice-panel");
  const noticeTitle = shadow.getElementById("lc-notice-title");
  const noticeMessage = shadow.getElementById("lc-notice-message");
  const noticeClose = shadow.getElementById("lc-notice-close");
  const searchInput = shadow.getElementById("lc-search");
  const searchSection = shadow.getElementById("lc-search-section");
  const resultsPanel = shadow.getElementById("lc-results");
  const apiVersionLabel = shadow.getElementById("lc-api-version");
  const tabButtons = Array.from(shadow.querySelectorAll("[data-tab]"));
  const actionButtons = Array.from(shadow.querySelectorAll("[data-key]"));

  const objectPlaceholder = "Record id, id prefix or object name";
  const userPlaceholder = "Name, username, email or alias";

  function applyTheme(theme) {
    rootHost.classList.toggle("dark-theme", theme === "dark");
  }

  async function loadTheme() {
    if (!chrome.storage?.local) return;
    try {
      const stored = await chrome.storage.local.get("lc-theme");
      applyTheme(stored?.["lc-theme"] === "dark" ? "dark" : "light");
    } catch {
      applyTheme("light");
    }
  }

  render();
  loadTheme();
  updateApiVersionLabel();
  loadCurrentObject();
  loadCurrentUser();

  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === "local" && changes["lc-theme"]) {
      applyTheme(changes["lc-theme"].newValue === "dark" ? "dark" : "light");
    }
    if (areaName !== "local" || (!changes["lc-api-version"] && !changes["lc-settings"])) return;
    updateApiVersionLabel();
  });

  chrome.runtime?.onMessage?.addListener((message) => {
    if (message?.type === "THEME_UPDATED") applyTheme(message.theme === "dark" ? "dark" : "light");
  });

  window.addEventListener("popstate", () => {
    if (state.tab === "users") loadCurrentUser();
    else {
      syncObjectFromUrl();
      loadCurrentObject();
    }
  });

  noticeClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.notice = null;
    render();
  });

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!state.open) {
      syncObjectFromUrl();
      loadCurrentObject();
    }
    state.open = !state.open;
    render();
    if (state.open && state.tab !== "organization") {
      window.setTimeout(() => searchInput?.focus(), 0);
    }
  });

  tabButtons.forEach((tabButton) => {
    tabButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const nextTab = tabButton.dataset.tab;
      if (!nextTab) return;
      state.tab = nextTab;
      state.open = true;
      if (nextTab === "users" && !state.query) loadCurrentUser();
      if (nextTab === "organization" && !state.organization) loadOrganization();
      render();
      if (nextTab !== "organization") window.setTimeout(() => searchInput?.focus(), 0);
    });
  });

  searchInput?.addEventListener("input", () => {
    if (state.tab === "organization") return;
    state.query = String(searchInput.value || "");
    if (state.tab === "objects") searchObjects(state.query);
    else searchUsers(state.query);
  });

  resultsPanel?.addEventListener("click", (event) => {
    const organizationAction = event.target instanceof Element ? event.target.closest("[data-org-action]") : null;
    if (organizationAction?.dataset.orgAction === "company-profile") {
      event.preventDefault();
      event.stopPropagation();
      openExternalTab(buildCompanyProfileUrl()).catch(showError);
      return;
    }
    const userResult = event.target instanceof Element ? event.target.closest("[data-user-id]") : null;
    if (userResult) {
      event.preventDefault();
      event.stopPropagation();
      const userId = userResult.dataset.userId;
      if (userId) {
        state.query = "";
        state.userRecord = null;
        state.userSearchResults = [];
        renderResults();
        loadUser(userId);
      }
      return;
    }
    const userAction = event.target instanceof Element ? event.target.closest("[data-user-action]") : null;
    if (userAction) {
      const action = userAction.dataset.userAction;
      if (action === "details" && state.userRecord?.id) {
        event.preventDefault();
        event.stopPropagation();
        openExternalTab(buildUserDetailsUrl(state.userRecord.id)).catch(showError);
      }
      return;
    }
    const recordResult = event.target instanceof Element ? event.target.closest("[data-record-id]") : null;
    if (recordResult) {
      event.preventDefault();
      event.stopPropagation();
      const recordId = recordResult.dataset.recordId;
      const objectApiName = recordResult.dataset.recordObjectApi;
      if (recordId && objectApiName) {
        state.query = "";
        state.searchResults = [];
        state.recordId = recordId;
        state.recordData = null;
        state.recordFields = [];
        state.objectRecord = {
          apiName: objectApiName,
          label: recordResult.dataset.recordObjectLabel || objectApiName,
          category: /__c$|__mdt$|__b$|__e$/.test(objectApiName) ? "Custom" : "Standard",
          keyPrefix: recordResult.dataset.recordPrefix || ""
        };
        renderResults();
        loadObjectMetadata(objectApiName);
      }
      return;
    }
    const objectResult = event.target instanceof Element ? event.target.closest("[data-object-api]") : null;
    if (objectResult) {
      event.preventDefault();
      event.stopPropagation();
      const objectApiName = objectResult.dataset.objectApi;
      if (objectApiName) {
        state.query = "";
        state.searchResults = [];
        setObjectFallback(objectApiName, objectResult.dataset.objectLabel || objectApiName, objectResult.dataset.objectPrefix || "");
        renderResults();
        loadObjectMetadata(objectApiName);
      }
      return;
    }
    const target = event.target instanceof Element ? event.target.closest("[data-object-action]") : null;
    if (!target || !state.objectRecord) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    const action = target.dataset.objectAction;
    if (action === "data-view") {
      openAppTab("dataView", state.objectRecord.apiName, state.recordId).catch(showError);
      return;
    }
    const href = buildObjectUrl(state.objectRecord.apiName, action);
    if (!href) return;
    if (action === "new") {
      const nextUrl = new URL(href);
      const historyUrl = nextUrl.origin === window.location.origin
        ? nextUrl.href
        : `${window.location.origin}${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      window.history.pushState({ lightningConnectObject: state.objectRecord.apiName }, "", historyUrl);
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
      return;
    }
    window.location.assign(href);
  });

  actionButtons.forEach((actionButton) => {
    actionButton.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.preventDefault();
      event.stopPropagation();

      const key = actionButton.dataset.key;
      if (!key) return;

      const actionLabels = {
        dataExport: "Data Export",
        dataImport: "Data Import",
        downloadMetadata: "Download Metadata",
        developerConsole: "Developer Console"
      };
      const actionLabel = actionLabels[key];

      try {
        const sourceOrigin = getSalesforceOrigin(window.location.origin);
        if (key === "developerConsole") {
          const response = await chrome.runtime.sendMessage({
            type: "OPEN_DEVELOPER_CONSOLE_WINDOW",
            sourceOrigin,
            orgKey: null
          });
          if (!response?.ok) {
            showError(response?.error || "Failed to open developer console window.");
          } else {
            showSuccess(`${actionLabel} opened successfully in a new window.`);
          }
          return;
        }

        const response = await chrome.runtime.sendMessage({
          type: "OPEN_APP_TAB",
          menuKey: key,
          sourceOrigin
        });
        if (!response?.ok) {
          showError(response?.error || "Failed to open the requested page.");
        } else if (actionLabel) {
          showSuccess(`${actionLabel} opened successfully in a new tab.`);
        }
      } catch (error) {
        console.warn("Lightning Connect: extension context invalidated or unavailable", error);
        showError(error);
      }
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootHost.contains(target)) {
        state.open = false;
        render();
      }
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.open) {
      state.open = false;
      render();
    }
  });

  function render() {
    launcher.classList.toggle("open", state.open);
    button.setAttribute("aria-expanded", String(state.open));
    const buttonLabel = state.open ? "Close Salesforce Connect" : "Open Salesforce Connect";
    button.setAttribute("aria-label", buttonLabel);
    button.setAttribute("title", buttonLabel);
    drawer.setAttribute("aria-hidden", String(!state.open));

    tabButtons.forEach((tabButton) => {
      const isActive = tabButton.dataset.tab === state.tab;
      tabButton.classList.toggle("active", isActive);
      tabButton.setAttribute("aria-selected", String(isActive));
    });

    if (searchInput) {
      searchInput.placeholder = state.tab === "users" ? userPlaceholder : objectPlaceholder;
      if (document.activeElement !== searchInput) {
        searchInput.value = state.query;
      }
    }
    if (searchSection) searchSection.hidden = state.tab === "organization";

    if (noticePanel) {
      noticePanel.hidden = !state.notice;
      noticePanel.classList.toggle("notice-error", state.notice?.type === "error");
      noticePanel.classList.toggle("notice-warning", state.notice?.type === "warning");
      noticePanel.classList.toggle("notice-success", state.notice?.type === "success");
    }
    if (noticeTitle) noticeTitle.textContent = state.notice?.title || "Message";
    if (noticeMessage) noticeMessage.textContent = state.notice?.message || "";

    renderResults();
  }

  async function updateApiVersionLabel() {
    if (!apiVersionLabel) return;
    try {
      let selectedVersion = null;
      try {
        const response = await chrome.runtime.sendMessage({
          type: "GET_SELECTED_API_VERSION",
          sourceOrigin: getSalesforceOrigin(window.location.origin)
        });
        selectedVersion = response?.ok ? response.apiVersion : null;
      } catch {
        selectedVersion = null;
      }
      if (!selectedVersion && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(["lc-api-version", "lc-settings"]);
        selectedVersion = stored["lc-api-version"] ?? stored["lc-settings"]?.apiVersion;
      }
      const normalizedVersion = String(selectedVersion ?? "").trim();
      const numericVersion = Number(normalizedVersion);
      const displayVersion = normalizedVersion && Number.isFinite(numericVersion)
        ? numericVersion.toFixed(1)
        : normalizedVersion;
      apiVersionLabel.textContent = displayVersion ? `API Version: v${displayVersion}` : "API Version: v—";
    } catch {
      apiVersionLabel.textContent = "API Version: v—";
    }
  }

  function showNotice(message, type = "error", title = "") {
    const normalizedType = ["error", "warning", "success"].includes(type) ? type : "error";
    const titles = { error: "Something went wrong", warning: "Warning", success: "Success" };
    state.notice = {
      type: normalizedType,
      title: title || titles[normalizedType],
      message: String(message || "An unexpected message occurred.").trim()
    };
    render();
  }

  function showError(error) {
    const message = error instanceof Error ? error.message : String(error?.message || error || "An unexpected error occurred.");
    showNotice(message.trim() || "An unexpected error occurred.", "error");
  }

  function showWarning(message, title = "Warning") { showNotice(message, "warning", title); }
  function showSuccess(message, title = "Success") { showNotice(message, "success", title); }

  function renderResults() {
    if (!resultsPanel) return;

    if (state.tab === "organization") {
      if (state.organizationLoading) {
        resultsPanel.innerHTML = `<div class="empty-state"><div class="empty-title">Loading organization...</div></div>`;
        return;
      }
      if (!state.organization) {
        resultsPanel.innerHTML = `<div class="empty-state"><div class="empty-title">Organization details unavailable</div><div class="empty-subtitle">Unable to load organization details.</div></div>`;
        return;
      }
      const organization = state.organization;
      resultsPanel.innerHTML = `<article class="org-card">
        <div class="org-grid">
          <div class="org-label">Org Id</div><div class="org-value">${escapeHtml(organization.Id)}</div>
          <div class="org-label">Instance</div><div class="org-value">${escapeHtml(organization.InstanceName)}</div>
          <div class="org-label">Name</div><div class="org-value">${escapeHtml(organization.Name)}</div>
          <div class="org-label">Type</div><div class="org-value">${escapeHtml(organization.OrganizationType)}</div>
          <div class="org-label">Time Zone</div><div class="org-value">${escapeHtml(organization.TimeZoneSidKey)}</div>
          <div class="org-label">Language</div><div class="org-value">${escapeHtml(organization.LanguageLocaleKey)}</div>
          <div class="org-label">Environment</div><div class="org-value">${organization.IsSandbox ? "Sandbox" : "Production"}</div>
        </div>
      </article>
      <button type="button" class="card-action-button" data-org-action="company-profile">Details</button>`;
      return;
    }

    const normalizedQuery = String(state.query || "").trim().toLowerCase();
    if (state.tab === "objects" && normalizedQuery) {
      if (state.searchLoading) {
        resultsPanel.innerHTML = `<div class="empty-state"><div class="empty-title">Searching objects…</div></div>`;
        return;
      }
      const recordIdQuery = isRecordIdQuery(normalizedQuery);
      if (!state.searchResults.length) {
        resultsPanel.innerHTML = recordIdQuery
          ? `<div class="empty-state"><div class="empty-title">No matching record</div><div class="empty-subtitle">No object was found for this record ID.</div></div>`
          : `<div class="empty-state"><div class="empty-title">No matching objects</div><div class="empty-subtitle">Search by object name or key prefix.</div></div>`;
        return;
      }
      if (recordIdQuery) {
        const recordId = String(state.query || "").trim();
        resultsPanel.innerHTML = state.searchResults.map((record) => `
          <button class="object-search-card record-search-card" type="button" data-record-id="${escapeHtml(recordId)}" data-record-object-api="${escapeHtml(record.QualifiedApiName)}" data-record-object-label="${escapeHtml(record.Label || record.QualifiedApiName)}" data-record-prefix="${escapeHtml(record.KeyPrefix || "")}">
            <span class="object-search-label">${escapeHtml(recordId)}</span>
            <span class="object-search-meta">${escapeHtml(record.QualifiedApiName)} | ${escapeHtml(record.KeyPrefix || "—")}</span>
          </button>`).join("");
        return;
      }
      resultsPanel.innerHTML = state.searchResults.map((record) => `
        <button class="object-search-card" type="button" data-object-api="${escapeHtml(record.QualifiedApiName)}" data-object-label="${escapeHtml(record.Label || record.QualifiedApiName)}" data-object-prefix="${escapeHtml(record.KeyPrefix || "")}">
          <span class="object-search-label">${escapeHtml(record.Label || record.QualifiedApiName)}</span>
          <span class="object-search-meta">${escapeHtml(record.QualifiedApiName)} | ${escapeHtml(record.KeyPrefix || "—")}</span>
        </button>`).join("");
      return;
    }
    if (state.tab === "users") {
      if (state.userSearchLoading) {
        resultsPanel.innerHTML = `<div class="empty-state"><div class="empty-title">Searching users…</div></div>`;
        return;
      }
      if (normalizedQuery) {
        if (!state.userSearchResults.length) {
          resultsPanel.innerHTML = `<div class="empty-state"><div class="empty-title">No matching users</div><div class="empty-subtitle">No users were found for "${escapeHtml(state.query.trim())}".</div></div>`;
          return;
        }
        resultsPanel.innerHTML = state.userSearchResults.map((user) => `
          <button class="object-search-card user-search-card" type="button" data-user-id="${escapeHtml(user.id)}">
            <span class="object-search-label">${escapeHtml(user.name)}</span>
            <span class="object-search-meta">${escapeHtml(user.username)} | ${escapeHtml(user.email)}</span>
          </button>`).join("");
        return;
      }
      if (state.userRecord) {
        resultsPanel.innerHTML = `${renderUserCard(state.userRecord)}<button class="card-action-button" type="button" data-user-action="details">Details</button>`;
        return;
      }
      resultsPanel.innerHTML = `<div class="empty-state"><div class="empty-title">Loading current user…</div></div>`;
      return;
    }

    const records = state.objectRecord ? [state.objectRecord] : [];
    const filtered = normalizedQuery
      ? records.filter((record) => Object.values(record).some((value) => String(value || "").toLowerCase().includes(normalizedQuery)))
      : [];

    if (state.tab === "objects" && state.objectRecord) {
      const objectRecord = state.objectRecord;
      resultsPanel.innerHTML = `
        <article class="record-card object-card">
          <div class="object-card-top">
            <a class="object-title" href="${escapeHtml(buildObjectUrl(objectRecord.apiName, "setup"))}" data-object-action="setup">${escapeHtml(objectRecord.label)}</a>
            <button class="new-object-button" type="button" data-object-action="new">New</button>
          </div>
          <div class="object-subtitle-row"><div class="object-subtitle">Label: ${escapeHtml(objectRecord.label)}</div><span class="card-badge">${escapeHtml(objectRecord.category)}</span></div>
          <div class="object-api">API Name: ${escapeHtml(objectRecord.apiName)}</div>
          <div class="object-prefix">Prefix: ${escapeHtml(objectRecord.keyPrefix || "—")}</div>
          <div class="object-links"><span>Links:</span> <a href="${escapeHtml(buildObjectUrl(objectRecord.apiName, "fields"))}" data-object-action="fields">Fields</a> / <a href="${escapeHtml(buildObjectUrl(objectRecord.apiName, "pageLayouts"))}" data-object-action="pageLayouts">Page Layouts</a> / <a href="${escapeHtml(buildObjectUrl(objectRecord.apiName, "lightningPages"))}" data-object-action="lightningPages">Lightning Pages</a> / <a href="${escapeHtml(buildObjectUrl(objectRecord.apiName, "recordTypes"))}" data-object-action="recordTypes">Record Types</a> / <a href="${escapeHtml(buildObjectUrl(objectRecord.apiName, "list"))}" data-object-action="list">List View</a> / <a href="${escapeHtml(buildObjectUrl(objectRecord.apiName, "access"))}" data-object-action="access">Access</a></div>
        </article>
        ${renderRecordCard()}
        <button class="card-action-button" type="button" data-object-action="data-view">Show All Data</button>`;
      return;
    }

    if (!normalizedQuery) {
      resultsPanel.innerHTML = `
        <div class="empty-state">
          <div>
            <div class="empty-illus" aria-hidden="true"></div>
            <div class="empty-title">No record to display</div>
            <div class="empty-subtitle">${escapeHtml(state.tab === "users" ? "Search by name, username, email or alias." : "Search by object name or record id prefix.")}</div>
          </div>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      resultsPanel.innerHTML = `
        <div class="empty-state">
          <div>
            <div class="empty-illus" aria-hidden="true"></div>
            <div class="empty-title">No record to display</div>
            <div class="empty-subtitle">No results found for "${escapeHtml(state.query.trim())}".</div>
          </div>
        </div>
      `;
      return;
    }

    resultsPanel.innerHTML = filtered
      .map(
        (objectRecord) => `
          <article class="record-card">
            <div class="card-title">
              <span>${escapeHtml(objectRecord.name)}</span>
              <span class="card-badge">${escapeHtml(objectRecord.category)}</span>
            </div>
            <div class="card-subtitle">${escapeHtml(objectRecord.label)}</div>
            <div class="card-grid">
              <div class="label">API Name</div><div class="value">${escapeHtml(objectRecord.apiName)}</div>
              <div class="label">Prefix</div><div class="value">${escapeHtml(objectRecord.hint)}</div>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderUserCard(user) {
    const current = user.id === state.currentUserId;
    const userHref = `${window.location.origin}/lightning/r/User/${encodeURIComponent(user.id)}/view`;
    return `<article class="user-card">
      <div class="card-title">
        <a class="user-title" href="${escapeHtml(userHref)}">${escapeHtml(user.name)}</a>
        <span class="card-badge">${current ? "Current User" : "User"}</span>
      </div>
      <div class="user-detail-line">Name: ${escapeHtml(user.name)}</div>
      <div class="user-detail-line">Username: ${escapeHtml(user.username)}</div>
      <div class="user-detail-line">Id: ${escapeHtml(user.id)}</div>
      <div class="user-detail-line">E-Mail: ${escapeHtml(user.email)}</div>
      <div class="user-detail-line">Profile: ${escapeHtml(user.profile || "—")}</div>
      <div class="user-detail-line">Role: ${escapeHtml(user.role || "—")}</div>
      <div class="user-detail-line">Alias: ${escapeHtml(user.alias || "—")}</div>
      <div class="user-detail-line">Status: ${escapeHtml(user.status || "—")}</div>
    </article>`;
  }

  function buildUserDetailsUrl(userId) {
    const domainName = String(state.domainName || getSalesforceOrigin(window.location.origin).replace(/^https?:\/\//, ""))
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .replace(/\.(?:lightning\.force\.com|my\.salesforce(?:-setup)?\.com)$/i, "");
    const setupDomain = `${domainName}.lightning.force.com`;
    return `https://${setupDomain}/lightning/setup/ManageUsers/page?address=%2F${encodeURIComponent(userId)}%3Fnoredirect%3D1%26isUserEntityOverride%3D1`;
  }

  function buildCompanyProfileUrl() {
    const sourceHost = new URL(getSalesforceOrigin(window.location.origin)).hostname;
    const domainName = String(state.domainName || sourceHost)
      .replace(/^https?:\/\//, "")
      .replace(/\.(?:lightning\.force\.com|my\.salesforce(?:-setup)?\.com|my\.salesforce\.com)$/i, "")
      .replace(/\/$/, "");
    const setupDomain = `${domainName}.my.salesforce-setup.com`;
    return `https://${setupDomain}/lightning/setup/CompanyProfileInfo/home`;
  }

  async function loadCurrentUser() {
    state.userSearchLoading = false;
    if (state.tab === "users" && !state.query) {
      state.userSearchLoading = true;
      renderResults();
    }
    try {
      const response = await chrome.runtime.sendMessage({
        type: "LOAD_CURRENT_USER",
        sourceOrigin: getSalesforceOrigin(window.location.origin)
      });
      if (!response?.ok) throw new Error(response?.error || "Unable to load current user.");
      state.currentUserId = response.user?.id || state.currentUserId;
      state.userRecord = response.user || null;
    } catch (error) {
      showError(error);
    } finally {
      state.userSearchLoading = false;
      if (state.tab === "users" && !state.query) renderResults();
    }
  }

  async function loadOrganization() {
    state.organizationLoading = true;
    renderResults();
    try {
      const response = await chrome.runtime.sendMessage({
        type: "LOAD_ORGANIZATION",
        sourceOrigin: getSalesforceOrigin(window.location.origin)
      });
      if (!response?.ok) throw new Error(response?.error || "Unable to load organization details.");
      state.organization = response.organization || null;
    } catch (error) {
      showError(error);
    } finally {
      state.organizationLoading = false;
      if (state.tab === "organization") renderResults();
    }
  }

  async function searchUsers(query) {
    const normalized = String(query || "").trim();
    state.userRecord = null;
    if (!normalized) {
      state.userSearchLoading = false;
      state.userSearchResults = [];
      loadCurrentUser();
      renderResults();
      return;
    }
    state.userSearchLoading = true;
    renderResults();
    try {
      const response = await chrome.runtime.sendMessage({
        type: "SEARCH_USERS",
        sourceOrigin: getSalesforceOrigin(window.location.origin),
        query: normalized
      });
      if (!response?.ok) throw new Error(response?.error || "Unable to search users.");
      state.userSearchResults = response.users || [];
    } catch (error) {
      showError(error);
      state.userSearchResults = [];
    } finally {
      state.userSearchLoading = false;
      renderResults();
    }
  }

  async function loadUser(userId) {
    state.userSearchLoading = true;
    renderResults();
    try {
      const response = await chrome.runtime.sendMessage({
        type: "LOAD_USER",
        sourceOrigin: getSalesforceOrigin(window.location.origin),
        userId
      });
      if (!response?.ok) throw new Error(response?.error || "Unable to load user.");
      state.userRecord = response.user || null;
    } catch (error) {
      showError(error);
    } finally {
      state.userSearchLoading = false;
      renderResults();
    }
  }

  async function openExternalTab(url) {
    const response = await chrome.runtime.sendMessage({ type: "OPEN_EXTERNAL_TAB", url });
    if (!response?.ok) throw new Error(response?.error || "Unable to open the new tab.");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function loadCurrentObject() {
    const objectApiName = getObjectApiNameFromUrl() || getRecordInfoFromUrl()?.objectApiName;
    if (!objectApiName) return;
    try {
      const apiOrigin = getSalesforceOrigin(window.location.origin);
      await loadObjectMetadata(objectApiName);
    } catch (error) {
      // Keep the URL-derived card visible when Salesforce metadata is unavailable.
      console.log("Lightning Connect: loading object - error", error);
      showError(error);
      renderResults();
    }
  }

  async function loadObjectMetadata(objectApiName) {
    try {
      const apiOrigin = getSalesforceOrigin(window.location.origin);
      const response = await chrome.runtime.sendMessage({
        type: "LOAD_OBJECT_METADATA",
        sourceOrigin: apiOrigin,
        objectApiName
      });
      if (!response?.ok) throw new Error(response?.error || "Unable to load object metadata.");
      const entity = response.metadata?.entity;
      state.domainName = response.metadata?.domainName || new URL(apiOrigin).hostname;
      state.objectRecord = {
        apiName: objectApiName,
        label: entity?.Label || humanizeObjectName(objectApiName),
        category: /__c$|__mdt$|__b$|__e$/.test(objectApiName) ? "Custom" : "Standard",
        keyPrefix: entity?.KeyPrefix || ""
      };
      if (state.recordId) await loadRecordData(objectApiName, state.recordId);
      renderResults();
    } catch (error) {
      console.log("Lightning Connect: loading object - error", error);
      showError(error);
      renderResults();
    }
  }

  async function loadRecordData(objectApiName, recordId) {
    const response = await chrome.runtime.sendMessage({
      type: "LOAD_RECORD_DATA",
      sourceOrigin: getSalesforceOrigin(window.location.origin),
      objectApiName,
      recordId,
      fields: ["Id", "Name", "CreatedDate", "CreatedBy.Name", "CreatedById", "LastModifiedDate", "LastModifiedBy.Name", "LastModifiedById"]
    });
    if (!response?.ok) throw new Error(response?.error || "Unable to load record data.");
    state.recordData = response.record?.record || null;
    state.recordFields = response.record?.fields || [];
  }

  function renderRecordCard() {
    if (!state.recordId || !state.recordData) return "";
    const createdById = state.recordData.CreatedById;
    const createdByName = state.recordData.CreatedBy?.Name || "";
    const userHref = createdById ? `${window.location.origin}/lightning/r/User/${encodeURIComponent(createdById)}/view` : "#";
    const modifiedById = state.recordData.LastModifiedById;
    const modifiedByName = state.recordData.LastModifiedBy?.Name || "";
    const modifiedUserHref = modifiedById ? `${window.location.origin}/lightning/r/User/${encodeURIComponent(modifiedById)}/view` : "#";
    const nameLine = state.recordFields.includes("Name") ? `<div class="record-detail-line">Name: ${escapeHtml(state.recordData.Name || "")}</div>` : "";
    return `<article class="record-detail-card"><div class="record-detail-line record-id-line"><strong>Id: ${escapeHtml(state.recordId)}</strong><span class="card-badge">Record</span></div>${nameLine}<div class="record-detail-line">Created Date: ${escapeHtml(formatRecordDate(state.recordData.CreatedDate))} | ${createdByName ? `<a href="${escapeHtml(userHref)}">${escapeHtml(createdByName)}</a>` : ""}</div><div class="record-detail-line">Modified Date: ${escapeHtml(formatRecordDate(state.recordData.LastModifiedDate))} | ${modifiedByName ? `<a href="${escapeHtml(modifiedUserHref)}">${escapeHtml(modifiedByName)}</a>` : ""}</div></article>`;
  }

  function formatRecordDate(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(date).replace(",", "");
  }

  async function searchObjects(query) {
    const normalized = String(query || "").trim();
    if (!normalized) {
      state.searchLoading = false;
      state.searchResults = [];
      renderResults();
      return;
    }
    state.searchLoading = true;
    renderResults();
    try {
      const searchQuery = isRecordIdQuery(normalized) ? normalized.slice(0, 3) : normalized;
      const response = await chrome.runtime.sendMessage({
        type: "SEARCH_OBJECTS",
        sourceOrigin: getSalesforceOrigin(window.location.origin),
        query: searchQuery
      });
      if (!response?.ok) throw new Error(response?.error || "Unable to search objects.");
      state.searchResults = response.objects || [];
    } catch (error) {
      console.log("Lightning Connect: object search error", error);
      showError(error);
      state.searchResults = [];
    } finally {
      state.searchLoading = false;
      renderResults();
    }
  }

  function isRecordIdQuery(value) {
    return /^[a-z0-9]{15,18}$/i.test(String(value || "").trim());
  }

  function setObjectFallback(objectApiName, label, keyPrefix) {
    state.domainName = null;
    state.recordId = "";
    state.recordData = null;
    state.recordFields = [];
    state.objectRecord = {
      apiName: objectApiName,
      label,
      category: /__c$|__mdt$|__b$|__e$/.test(objectApiName) ? "Custom" : "Standard",
      keyPrefix
    };
  }

  function syncObjectFromUrl() {
    const recordInfo = getRecordInfoFromUrl();
    const objectApiName = getObjectApiNameFromUrl() || recordInfo?.objectApiName;
    const nextRecordId = recordInfo?.recordId || "";
    if (!objectApiName || (state.objectRecord?.apiName === objectApiName && state.recordId === nextRecordId)) return;
    state.domainName = null;
    state.recordId = nextRecordId;
    state.recordData = null;
    state.objectRecord = {
      apiName: objectApiName,
      label: humanizeObjectName(objectApiName),
      category: /__c$|__mdt$|__b$|__e$/.test(objectApiName) ? "Custom" : "Standard",
      keyPrefix: ""
    };
    renderResults();
  }

  async function openAppTab(menuKey, objectApiName, recordId) {
    const sourceOrigin = getSalesforceOrigin(window.location.origin);
    await chrome.runtime.sendMessage({ type: "OPEN_APP_TAB", menuKey, objectApiName, recordId, sourceOrigin });
  }

  function buildObjectUrl(apiName, action) {
    const domainName = String(state.domainName || getSalesforceOrigin(window.location.origin).replace(/^https?:\/\//, ""))
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .replace(/\.(?:lightning\.force\.com|my\.salesforce(?:-setup)?\.com)$/i, "");
    const lightningDomain = `${domainName}.lightning.force.com`;
    const setupDomain = `${domainName}.lightning.force.com`;
    const encoded = encodeURIComponent(apiName);
    if (action === "setup") return `https://${setupDomain}/lightning/setup/ObjectManager/${encoded}/view`;
    if (action === "new") return `https://${lightningDomain}/lightning/o/${encoded}/new`;
    if (action === "fields") return `https://${setupDomain}/lightning/setup/ObjectManager/${encoded}/FieldsAndRelationships/view`;
    if (action === "pageLayouts") return `https://${setupDomain}/lightning/setup/ObjectManager/${encoded}/PageLayouts/view`;
    if (action === "lightningPages") return `https://${setupDomain}/lightning/setup/ObjectManager/${encoded}/LightningPages/view`;
    if (action === "recordTypes") return `https://${setupDomain}/lightning/setup/ObjectManager/${encoded}/RecordTypes/view`;
    if (action === "list") return `https://${lightningDomain}/lightning/o/${encoded}/list`;
    if (action === "access") return `https://${setupDomain}/lightning/setup/ObjectManager/${encoded}/ObjectAccess/view`;
    return "#";
  }

})();

function getObjectApiNameFromUrl() {
  const match = window.location.pathname.match(/\/lightning\/o\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function getRecordInfoFromUrl() {
  const match = window.location.pathname.match(/\/lightning\/r\/([^/]+)\/([^/]+)\/view/i);
  return match ? { objectApiName: decodeURIComponent(match[1]), recordId: decodeURIComponent(match[2]) } : null;
}

function humanizeObjectName(apiName) {
  return String(apiName || "").replace(/__c$|__mdt$|__b$|__e$/i, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function getSalesforceOrigin(origin) {
  try {
    const url = new URL(origin);
    const host = url.hostname;

    if (host.endsWith(".lightning.force.com")) {
      return url.origin.replace(".lightning.force.com", ".my.salesforce.com");
    }

    if (host.endsWith(".my.salesforce-setup.com")) {
      return url.origin.replace(".my.salesforce-setup.com", ".my.salesforce.com");
    }

    return url.origin;
  } catch {
    return origin;
  }
}
