export function renderPageChrome(container, bodyHtml, options = {}) {
  if (!container) return null;
  container.innerHTML = `
    <div class="workflow-page">
      <section class="workflow-body">
        <div class="workflow-body-inner">
          ${bodyHtml}
        </div>
      </section>
    </div>
  `;

  const headerHost = document.getElementById("page-header-content");
  if (headerHost) {
    headerHost.innerHTML = String(options.headerHtml || "");
    headerHost.hidden = !headerHost.innerHTML.trim();
  }

  const footerHost = document.getElementById("page-footer-content");
  if (footerHost) {
    footerHost.innerHTML = String(options.footerHtml || "");
    footerHost.hidden = !footerHost.innerHTML.trim();
  }

  return container.querySelector(".workflow-body-inner");
}
