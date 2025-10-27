// content.js — toolbar button next to Refresh; exports the Chat panel content
(() => {
  const TAG = "[NotebookLM-PDF]";
  console.log(`${TAG} content script loaded`);

  // ----------------- small helpers -----------------
  const qsa = (sel, root = document) => {
    try { return Array.from(root.querySelectorAll(sel)); }
    catch (e) { console.warn(`${TAG} bad selector skipped: ${sel}`, e); return []; }
  };

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      const style = el.ownerDocument?.defaultView?.getComputedStyle(el) || window.getComputedStyle(el);
      if (!style) return false;
      if (style.visibility === "hidden" || style.display === "none") return false;
      if (parseFloat(style.opacity || "1") === 0) return false;
      return true;
    } catch (_e) {
      return false;
    }
  };

  const isOurButton = (el) => el?.dataset?.nlmExportToolbar === "1";

  const escapeHtml = (str) => (str || "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));

  const debugEnabled = (() => {
    try { return !!window.localStorage?.getItem("nlmExportDebug"); }
    catch (_e) { return false; }
  })();
  const debug = (...args) => { if (debugEnabled) console.debug(TAG, ...args); };

  function describeNode(node) {
    if (!node) return "<none>";
    const name = node.tagName ? node.tagName.toLowerCase() : node.nodeName;
    const id = node.id ? `#${node.id}` : "";
    const classes = node.classList?.length ? `.${Array.from(node.classList).join('.')}` : "";
    return `${name}${id}${classes}`;
  }

  function getSelectionHtml() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const container = document.createElement("div");
    for (let i = 0; i < sel.rangeCount; i++) {
      const frag = sel.getRangeAt(i).cloneContents();
      const wrap = document.createElement("div");
      wrap.appendChild(frag);
      container.appendChild(wrap);
    }
    return container.innerHTML;
  }

  // Find a button by its visible text (case-insensitive)
  function findButtonByText(text, root = document) {
    const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const want = norm(text);
    const btns = qsa('button, [role="button"]', root);
    for (const b of btns) {
      if (norm(b.textContent) === want && isVisible(b)) return b;
    }
    return null;
  }

  function findRefreshButton(root = document) {
    const labelMatch = root.querySelector('button[aria-label="Refresh chat messages"]');
    if (labelMatch && !isOurButton(labelMatch) && isVisible(labelMatch)) return labelMatch;

    const classMatch = root.querySelector('button.refresh-button');
    if (classMatch && !isOurButton(classMatch) && isVisible(classMatch)) return classMatch;

    const textMatch = findButtonByText("Refresh", root);
    if (textMatch && !isOurButton(textMatch) && isVisible(textMatch)) return textMatch;

    return null;
  }

  // Walk up to a reasonable "row" container (the Chat toolbar with Export / Refresh)
  function findChatToolbar() {
    const refresh = findRefreshButton();
    const builtinExport = findButtonByText("Export");

    const anchor = refresh || builtinExport;
    if (!anchor) return null;

    const toolbarFromAttribute = anchor.closest?.('[role="toolbar"]');
    if (toolbarFromAttribute && isVisible(toolbarFromAttribute)) return toolbarFromAttribute;

    // climb up a few levels until we see multiple buttons in the same row
    let n = anchor.parentElement;
    for (let i = 0; i < 6 && n; i++) {
      const buttons = qsa('button, [role="button"]', n).filter(isVisible);
      const containsAnchor = buttons.includes(anchor);
      const hasPeerButton = buttons.some(b => b !== anchor);
      if (containsAnchor && hasPeerButton && isVisible(n)) {
        return n;
      }
      n = n.parentElement;
    }
    return anchor.parentElement || null;
  }

  let lastChatArea = null;
  function rememberChatArea(area) {
    if (!area || !area.isConnected) return;
    if (!isVisible(area)) return;
    lastChatArea = area;
    debug("remembered chat area", describeNode(area));
  }

  // From the toolbar, find the chat panel root and message area
  function findChatPanelFromToolbar(toolbarEl) {
    if (!toolbarEl) return null;

    // go up until we find a container that holds a feed/list/log of messages
    let panel = toolbarEl;
    for (let i = 0; i < 6 && panel; i++) {
      if (panel.querySelector('[role="feed"], [role="log"], [role="list"], [aria-live]')) break;
      panel = panel.parentElement;
    }
    if (!panel) panel = toolbarEl.parentElement;

    const selectors = [
      '[role="feed"]',
      '[role="log"]',
      '[role="list"]',
      '[aria-live]'
    ];
    let area = null;
    for (const sel of selectors) {
      const candidate = panel.querySelector(sel);
      if (candidate && isVisible(candidate)) {
        area = candidate;
        break;
      }
    }
    if (!area) area = panel;

    rememberChatArea(area);
    return { panel, area };
  }

  // Collect messages inside a message area; fall back to the whole area if no items found
  function collectMessagesHtml(area) {
    rememberChatArea(area);
    const selectors = [
      'article',
      '[role="listitem"]',
      '[data-testid*="message"]',
      '[data-test-id*="message"]',
      '[data-testid*="conversation"]',
      '[data-test-id*="conversation"]',
      'nlm-conversation-turn',
      'mat-card'
    ];

    const seen = new Set();
    const items = [];
    for (const sel of selectors) {
      const found = qsa(sel, area);
      for (const el of found) {
        if (!isVisible(el)) continue;
        if (!el.textContent?.trim()) continue;
        if (seen.has(el)) continue;
        seen.add(el);
        items.push(el);
      }
      if (items.length >= 3) break;
    }

    debug("collectMessagesHtml", describeNode(area), "items", items.length);

    if (items.length) {
      const wrapper = document.createElement("div");
      items.forEach(el => wrapper.appendChild(el.cloneNode(true)));
      return wrapper.innerHTML;
    }
    const html = area.innerHTML || "";
    debug("collectMessagesHtml fallback to area innerHTML length", html.length);
    return html;
  }

  function locateChatAreaFallback() {
    const candidates = qsa('[role="feed"], [role="log"], [role="list"], [aria-live]');
    for (const el of candidates) {
      if (isVisible(el)) {
        rememberChatArea(el);
        debug("fallback located", describeNode(el));
        break;
      }
    }
  }

  // Notes fallback (not used if we found the Chat panel)
  function guessNotebookLMNotes() {
    const selectors = [
      '[data-testid*="note"]',
      '[data-test-id*="note"]',
      '[class*="note"] article',
      '[role="list"] [role="listitem"]',
      'article'
    ];
    const seen = new Set();
    const wrapper = document.createElement("div");

    for (const sel of selectors) {
      const nodes = qsa(sel);
      for (const el of nodes) {
        if (!el || seen.has(el)) continue;
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        const text = (el.textContent || "").trim();
        if (text && visible) {
          seen.add(el);
          wrapper.appendChild(el.cloneNode(true));
        }
      }
      if (wrapper.childElementCount >= 3) break;
    }
    return wrapper.childElementCount ? wrapper.innerHTML : null;
  }

  // Build default KaTeX delimiters
  const defaultDelimiters = () => ([
    { left: "$$", right: "$$", display: true },
    { left: "\\[", right: "\\]", display: true },
    { left: "\\(", right: "\\)", display: false },
    { left: "$", right: "$", display: false } // remove if $ clashes with currency
  ]);

  // Do the export
  function getCopyChatButton() {
    const buttons = qsa('button, [role="button"]');
    return buttons.find(btn => {
      const label = (btn.getAttribute("data-tooltip") || btn.getAttribute("aria-label") || "").toLowerCase();
      if (label.includes("copy chat")) return true;
      const text = (btn.textContent || "").toLowerCase();
      return text.includes("copy chat");
    });
  }

  async function exportChatOrNotes() {
    // 1) selection wins
    let html = getSelectionHtml();
    debug("export start", { selection: !!html });

    const toolbar = findChatToolbar();
    debug("toolbar", describeNode(toolbar));
    if (!html && toolbar) {
      const loc = findChatPanelFromToolbar(toolbar);
      debug("toolbar loc", loc?.area ? describeNode(loc.area) : "<none>");
      if (loc?.area) html = collectMessagesHtml(loc.area);
    }

    if (!html && lastChatArea?.isConnected) {
      debug("using cached lastChatArea", describeNode(lastChatArea));
      html = collectMessagesHtml(lastChatArea);
    }

    if (!html) {
      const copyBtn = getCopyChatButton();
      debug("copy button", describeNode(copyBtn));
      if (copyBtn) {
        copyBtn.click();
        await new Promise(resolve => setTimeout(resolve, 200));
        let clip = null;
        try {
          clip = await navigator.clipboard.readText();
        } catch (_e) {
          console.warn(`${TAG} clipboard read failed`);
        }
        if (clip) {
          debug("clipboard length", clip.length);
          const blocks = clip.trim().split(/\r?\n\r?\n/);
          const formatted = blocks.map(block => {
            const text = escapeHtml(block).replace(/\r?\n/g, "<br>");
            return `<p>${text}</p>`;
          }).join("");
          html = formatted;
          showToast("Copied chat to clipboard, preparing PDF export…");
        }
      }
    }

    if (!html) {
      debug("falling back to notes guess");
      html = guessNotebookLMNotes();
    }

    if (!html) {
      const main = document.querySelector("main") || document.body;
      html = main ? main.innerHTML : document.documentElement.innerHTML;
      debug("falling back to main/document", html?.length || 0);
    }

    if (!html || html.replace(/\s+/g, "").length < 50) {
      showToast("Couldn’t find chat/notes here. Scroll a bit or make a text selection and try again.");
      console.warn(`${TAG} export aborted — insufficient HTML`, html ? html.slice(0, 120) : "<empty>");
      return;
    }

    await chrome.runtime.sendMessage({
      type: "NLM_OPEN_PRINT",
      payload: {
        ok: true,
        html,
        title: document.title,
        url: location.href,
        mathDelimiters: defaultDelimiters()
      }
    });
  }

  // ----------------- inject button into the Chat toolbar -----------------
  function injectToolbarButton() {
    const existing = document.getElementById("nlm-toolbar-export");
    if (existing && existing.isConnected) return;
    if (existing) existing.remove();

    const toolbar = findChatToolbar();
    if (!toolbar) return; // try again later — SPA may not have built it yet

    const refresh = findRefreshButton(toolbar) || findButtonByText("Export", toolbar);
    const btn = document.createElement("button");
    btn.id = "nlm-toolbar-export";
    btn.type = "button";
    btn.setAttribute("aria-label", "Export chat as PDF");
    btn.dataset.nlmExportToolbar = "1";

    if (refresh) {
      btn.className = refresh.className;
      for (const attr of refresh.getAttributeNames()) {
        if (attr === "id" || attr === "aria-label") continue;
        const value = refresh.getAttribute(attr);
        if (value === null) continue;
        btn.setAttribute(attr, value);
      }
      btn.innerHTML = refresh.innerHTML;
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

    btn.addEventListener("click", exportChatOrNotes);

    if (refresh) {
      refresh.insertAdjacentElement("afterend", btn);
    } else {
      toolbar.appendChild(btn);
    }
    console.log(`${TAG} toolbar export button injected`);
  }

  // Simple toast that doesn’t depend on page styles
  function makeToastHost() {
    if (document.getElementById("nlm-toast-root")) return;
    const host = document.createElement("div");
    host.id = "nlm-toast-root";
    host.style.position = "fixed";
    host.style.left = "8px";
    host.style.right = "8px";
    host.style.bottom = "8px";
    host.style.zIndex = "2147483647";
    const sh = host.attachShadow({ mode: "open" });
    sh.innerHTML = `
      <style>
        .toast { display:none; background: rgba(0,0,0,.85); color: #fff;
                 padding: 8px 10px; border-radius: 8px;
                 font: 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .show { display:block; }
      </style>
      <div id="t" class="toast"></div>
    `;
    document.documentElement.appendChild(host);
    makeToastHost.show = (msg) => {
      const t = sh.getElementById("t");
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 2300);
    };
  }

  function showToast(msg) {
    if (!makeToastHost.show) makeToastHost();
    makeToastHost.show(msg);
  }

  // Observe the SPA and (re)inject when the Chat header appears
  const mo = new MutationObserver(() => {
    injectToolbarButton();
    if (lastChatArea && !lastChatArea.isConnected) lastChatArea = null;
    if (!lastChatArea) locateChatAreaFallback();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  injectToolbarButton();
  locateChatAreaFallback();

  // Keep the old message path alive (harmless if you removed popup buttons)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "NLM_EXPORT_COLLECT") return;
    try {
      // Export from the toolbar’s chat panel to mirror the button behavior
      const toolbar = findChatToolbar();
      const loc = findChatPanelFromToolbar(toolbar);
      const htmlSel = getSelectionHtml();
      const html =
        htmlSel ||
        (loc?.area ? collectMessagesHtml(loc.area) : null) ||
        guessNotebookLMNotes() ||
        (document.querySelector("main") || document.body).innerHTML;

      sendResponse({
        ok: !!html,
        html,
        title: document.title,
        url: location.href,
        mathDelimiters: msg.mathDelimiters || null
      });
    } catch (e) {
      console.error(`${TAG} export (message) failed`, e);
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  });
})();
