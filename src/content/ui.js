(() => {
  const ns = window.NLMExport;
  if (!ns) return;

  const {
    TAG,
    findChatToolbar,
    findRefreshButton,
    findButtonByText
  } = ns;

  let toastAPI = null;

  const ensureToastHost = () => {
    if (toastAPI) return toastAPI;
    if (document.getElementById("nlm-toast-root")) return toastAPI;

    const host = document.createElement("div");
    host.id = "nlm-toast-root";
    host.style.position = "fixed";
    host.style.left = "8px";
    host.style.right = "8px";
    host.style.bottom = "8px";
    host.style.zIndex = "2147483647";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        .toast { display:none; background: rgba(0,0,0,.85); color:#fff;
                 padding:8px 10px; border-radius:8px;
                 font:12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
        .show { display:block; }
      </style>
      <div id="t" class="toast"></div>
    `;

    document.documentElement.appendChild(host);

    toastAPI = {
      show(msg) {
        const toast = shadow.getElementById("t");
        toast.textContent = msg;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2300);
      }
    };

    return toastAPI;
  };

  const showToast = (msg) => {
    const api = ensureToastHost();
    api?.show(msg);
  };

  const createToolbarButton = (referenceBtn, onClick) => {
    const btn = document.createElement("button");
    btn.id = "nlm-toolbar-export";
    btn.type = "button";
    btn.setAttribute("aria-label", "Export chat as PDF");
    btn.dataset.nlmExportToolbar = "1";

    if (referenceBtn) {
      btn.className = referenceBtn.className;
      for (const attr of referenceBtn.getAttributeNames()) {
        if (attr === "id" || attr === "aria-label") continue;
        const value = referenceBtn.getAttribute(attr);
        if (value !== null) btn.setAttribute(attr, value);
      }
      btn.innerHTML = referenceBtn.innerHTML;
      btn.classList.remove("refresh-button");

      const label = btn.querySelector(".mdc-button__label");
      if (label) label.textContent = " Export PDF ";
      else btn.textContent = "Export PDF";

      const icon = btn.querySelector("mat-icon");
      if (icon) icon.textContent = "picture_as_pdf";

      btn.removeAttribute("disabled");
    } else {
      btn.textContent = "Export PDF";
      btn.style.marginLeft = "8px";
      btn.style.padding = "6px 10px";
      btn.style.borderRadius = "8px";
      btn.style.cursor = "pointer";
    }

    btn.addEventListener("click", onClick);
    return btn;
  };

  const injectToolbarButton = (onClick) => {
    const existing = document.getElementById("nlm-toolbar-export");
    if (existing && existing.isConnected) return;
    if (existing) existing.remove();

    const toolbar = findChatToolbar();
    if (!toolbar) return;

    const referenceBtn = findRefreshButton(toolbar) || findButtonByText("Export", toolbar);
    const btn = createToolbarButton(referenceBtn, onClick);

    if (referenceBtn) referenceBtn.insertAdjacentElement("afterend", btn);
    else toolbar.appendChild(btn);

    console.log(`${TAG} toolbar export button injected`);
  };

  Object.assign(ns, { showToast, injectToolbarButton });
})();
