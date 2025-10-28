(() => {
  const ns = window.NLMExport;
  if (!ns) return;

  const {
    debug,
    qsa,
    isVisible,
    describeNode,
    rememberChatArea,
    Selectors,
    state
  } = ns;

  const findButtonByText = (text, root = document) => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const want = norm(text);
    for (const btn of qsa(Selectors.buttons, root)) {
      if (norm(btn.textContent) === want && isVisible(btn)) return btn;
    }
    return null;
  };

  const findRefreshButton = (root = document) => {
    const labelMatch = root.querySelector('button[aria-label="Refresh chat messages"]');
    if (labelMatch && !labelMatch.dataset?.nlmExportToolbar && isVisible(labelMatch)) return labelMatch;

    const classMatch = root.querySelector('button.refresh-button');
    if (classMatch && !classMatch.dataset?.nlmExportToolbar && isVisible(classMatch)) return classMatch;

    const textMatch = findButtonByText("Refresh", root);
    if (textMatch && !textMatch.dataset?.nlmExportToolbar && isVisible(textMatch)) return textMatch;

    return null;
  };

  const findChatToolbar = () => {
    const refresh = findRefreshButton();
    const builtinExport = findButtonByText("Export");
    const anchor = refresh || builtinExport;
    if (!anchor) return null;

    const toolbar = anchor.closest?.('[role="toolbar"]');
    if (toolbar && isVisible(toolbar)) return toolbar;

    let node = anchor.parentElement;
    for (let i = 0; i < 6 && node; i++) {
      const buttons = qsa(Selectors.buttons, node).filter(isVisible);
      const containsAnchor = buttons.includes(anchor);
      const hasPeer = buttons.some((btn) => btn !== anchor);
      if (containsAnchor && hasPeer && isVisible(node)) return node;
      node = node.parentElement;
    }
    return anchor.parentElement || null;
  };

  const findChatPanelFromToolbar = (toolbar) => {
    if (!toolbar) return null;

    let panel = toolbar;
    for (let i = 0; i < 6 && panel; i++) {
      if (Selectors.chatContainers.some((sel) => panel.querySelector(sel))) break;
      panel = panel.parentElement;
    }
    if (!panel) panel = toolbar.parentElement;

    let area = null;
    for (const sel of Selectors.chatContainers) {
      const candidate = panel?.querySelector(sel);
      if (candidate && isVisible(candidate)) {
        area = candidate;
        break;
      }
    }
    if (!area) area = panel;

    rememberChatArea(area);
    return { panel, area };
  };

  const collectMessagesHtml = (area) => {
    rememberChatArea(area);
    const seen = new Set();
    const items = [];
    for (const sel of Selectors.chatItems) {
      for (const el of qsa(sel, area)) {
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
      items.forEach((el) => wrapper.appendChild(el.cloneNode(true)));
      return wrapper.innerHTML;
    }

    const html = area.innerHTML || "";
    debug("collectMessagesHtml fallback length", html.length);
    return html;
  };

  const locateChatAreaFallback = () => {
    const selector = Selectors.chatContainers.join(',');
    for (const el of qsa(selector)) {
      if (isVisible(el)) {
        rememberChatArea(el);
        debug("fallback located", describeNode(el));
        break;
      }
    }
  };

  const guessNotebookLMNotes = () => {
    const seen = new Set();
    const wrapper = document.createElement("div");

    for (const sel of Selectors.notesFallback) {
      for (const el of qsa(sel)) {
        if (!el || seen.has(el)) continue;
        if (!isVisible(el)) continue;
        const text = (el.textContent || "").trim();
        if (!text) continue;
        seen.add(el);
        wrapper.appendChild(el.cloneNode(true));
      }
      if (wrapper.childElementCount >= 3) break;
    }

    return wrapper.childElementCount ? wrapper.innerHTML : null;
  };

  Object.assign(ns, {
    findButtonByText,
    findRefreshButton,
    findChatToolbar,
    findChatPanelFromToolbar,
    collectMessagesHtml,
    locateChatAreaFallback,
    guessNotebookLMNotes
  });
})();
