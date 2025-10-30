(() => {
  const namespace = (window.NLMExport = window.NLMExport || {});

  const TAG = "[NotebookLM-PDF]";
  const state = { lastChatArea: null };

  const isDebugEnabled = () => {
    try { return !!window.localStorage?.getItem("nlmExportDebug"); }
    catch (_e) { return false; }
  };

  const debug = (...args) => {
    if (isDebugEnabled()) console.debug(TAG, ...args);
  };

  const qsa = (sel, root = document) => {
    const results = [];
    const seen = new Set();
    let selectors = null;

    const matchesSelector = (el) => {
      try {
        return el.matches(sel);
      } catch (err) {
        if (!selectors) {
          selectors = sel.split(',').map((s) => s.trim()).filter(Boolean);
        }
        return selectors.some((s) => {
          try { return el.matches(s); }
          catch (_e) { return false; }
        });
      }
    };

    const visit = (node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        if (matchesSelector(el)) results.push(el);
        if (el.shadowRoot) visit(el.shadowRoot);
        for (let i = 0; i < el.children.length; i++) {
          visit(el.children[i]);
        }
        return;
      }

      if (node instanceof Document || node instanceof DocumentFragment) {
        const childNodes = node.childNodes || [];
        for (let i = 0; i < childNodes.length; i++) {
          if (childNodes[i].nodeType === Node.ELEMENT_NODE) visit(childNodes[i]);
        }
      }
    };

    try {
      visit(root);
    } catch (e) {
      console.warn(`${TAG} traversal failed for selector: ${sel}`, e);
      return [];
    }
    return results;
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
    const textLength = (container.textContent || "").replace(/\s+/g, "").length;
    if (!textLength) return null;
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
    debugEnabled: isDebugEnabled,
    qsa,
    isVisible,
    escapeHtml,
    describeNode,
    getSelectionHtml,
    rememberChatArea,
    Selectors
  });
})();
