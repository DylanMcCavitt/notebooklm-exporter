(() => {
  const namespace = (window.NLMExport = window.NLMExport || {});

  const TAG = "[NotebookLM-PDF]";
  const state = { lastChatArea: null };

  const DEBUG_ENABLED = (() => {
    try { return !!window.localStorage?.getItem("nlmExportDebug"); }
    catch (_e) { return false; }
  })();

  const debug = (...args) => {
    if (DEBUG_ENABLED) console.debug(TAG, ...args);
  };

  const qsa = (sel, root = document) => {
    try { return Array.from(root.querySelectorAll(sel)); }
    catch (e) {
      console.warn(`${TAG} bad selector skipped: ${sel}`, e);
      return [];
    }
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

  const escapeHtml = (str) => (str || "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));

  const describeNode = (node) => {
    if (!node) return "<none>";
    const name = node.tagName ? node.tagName.toLowerCase() : node.nodeName;
    const id = node.id ? `#${node.id}` : "";
    const classes = node.classList?.length ? `.${Array.from(node.classList).join('.')}` : "";
    return `${name}${id}${classes}`;
  };

  const getSelectionHtml = () => {
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
  };

  const rememberChatArea = (area) => {
    if (!area || !area.isConnected || !isVisible(area)) return;
    state.lastChatArea = area;
    debug("remembered chat area", describeNode(area));
  };

  const Selectors = Object.freeze({
    buttons: 'button, [role="button"]',
    chatContainers: [
      '[role="feed"]',
      '[role="log"]',
      '[role="list"]',
      '[aria-live]'
    ],
    chatItems: [
      'article',
      '[role="listitem"]',
      '[data-testid*="message"]',
      '[data-test-id*="message"]',
      '[data-testid*="conversation"]',
      '[data-test-id*="conversation"]',
      'nlm-conversation-turn',
      'mat-card'
    ],
    notesFallback: [
      '[data-testid*="note"]',
      '[data-test-id*="note"]',
      '[class*="note"] article',
      '[role="list"] [role="listitem"]',
      'article'
    ]
  });

  Object.assign(namespace, {
    TAG,
    state,
    debug,
    qsa,
    isVisible,
    escapeHtml,
    describeNode,
    getSelectionHtml,
    rememberChatArea,
    Selectors
  });
})();
