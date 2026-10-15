import { getSessionIdFromCookie, callToolingApi } from "../modules/salesforce-api.js";
import { renderPageChrome } from "../modules/page-chrome.js";
import "./download-metadata.css";

export function renderDownloadMetadata(container) {
  const body = renderPageChrome(container, `
    <div class="dm-page">
      <section class="dm-section">
        <div class="dm-section-header">
          <h2>Metadata Query</h2>
        </div>
        <div class="query-shell">
          <textarea id="metadata-query" class="query-editor" spellcheck="false">SELECT Id, Name, ApiVersion FROM ApexClass ORDER BY Name LIMIT 20</textarea>
          <div class="query-actions">
            <div></div>
            <div class="query-actions-right">
              <button id="metadata-preview" class="toolbar-button" type="button">Preview</button>
              <button id="metadata-run" class="primary-button" type="button">Run Download</button>
            </div>
          </div>
        </div>
      </section>
      <section class="dm-section">
        <div class="dm-section-header">
          <h2>Metadata Result</h2>
        </div>
        <pre id="metadata-output" class="dm-result-area">Ready</pre>
      </section>
    </div>
  `, {
    headerHtml: `
      <div class="header-action-group">
        <span class="header-action-label">Download Metadata</span>
        <button type="button" class="toolbar-button" data-header-action="download-metadata">Download</button>
      </div>
    `
  });

  const queryInput = body.querySelector("#metadata-query");
  const previewButton = body.querySelector("#metadata-preview");
  const runButton = body.querySelector("#metadata-run");
  const output = body.querySelector("#metadata-output");

  function setSafeText(el, value) {
    if (!el) return;
    el.textContent = String(value ?? "");
  }

  const getQuery = () => String(queryInput.value || "").trim();

  previewButton.addEventListener("click", () => {
    const query = getQuery();
    setSafeText(output, query || "No query provided.");
  });

  runButton.addEventListener("click", async () => {
    const query = getQuery();
    if (!query) {
      setSafeText(output, "Please provide a query first.");
      return;
    }
    setSafeText(output, "Fetching metadata...");
    try {
      const sessionId = await getSessionIdFromCookie();
      if (!sessionId) {
        throw new Error("Unable to locate Salesforce session cookie.");
      }
      const result = await callToolingApi(sessionId, query);
      setSafeText(output, JSON.stringify(result, null, 2));
    } catch (error) {
      setSafeText(output, `Error: ${error.message}`);
    }
  });
}