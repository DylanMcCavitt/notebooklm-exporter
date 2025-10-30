(() => {
  const ns = window.NLMExport;
  if (!ns) return;

  const {
    debug,
    qsa,
    isVisible,
    describeNode,
    rememberChatArea,
    escapeHtml,
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
      if (candidate && isLikelyChatArea(candidate) && isVisible(candidate)) {
        area = candidate;
        break;
      }
    }
    if (!area) area = panel;

    rememberChatArea(area);
    return { panel, area };
  };

  const textToParagraphHtml = (text) => {
    const normalized = (text || "").replace(/\r/g, "").trim();
    if (!normalized) return null;
    const blocks = normalized
      .split(/\n{2,}/)
      .map((block) => {
        const safe = escapeHtml(block.trim()).replace(/\n/g, "<br>");
        return safe ? `<p>${safe}</p>` : null;
      })
      .filter(Boolean);
    return blocks.length ? blocks.join("") : null;
  };

  const buildTextFallbackHtml = (el) => {
    const text = (el.innerText || el.textContent || "").trim();
    if (!text) return null;
    return textToParagraphHtml(text);
  };

  const normalizeExportNode = (el) => {
    const clone = el.cloneNode(true);
    const cloneHtml = (clone.innerHTML || "").replace(/\s+/g, "");
    if (cloneHtml.length >= 10) return clone;

    const shadowHtml = el.shadowRoot?.innerHTML || "";
    if (shadowHtml.replace(/\s+/g, "").length >= 10) {
      const wrapper = document.createElement("article");
      wrapper.setAttribute("data-nlm-export-fallback", "shadow");
      wrapper.innerHTML = shadowHtml;
      return wrapper;
    }

    if (el.shadowRoot) {
      const shadowText = textToParagraphHtml(el.shadowRoot.textContent || "");
      if (shadowText) {
        const wrapper = document.createElement("article");
        wrapper.setAttribute("data-nlm-export-fallback", "shadow-text");
        wrapper.innerHTML = shadowText;
        return wrapper;
      }
    }

    const fallbackHtml = buildTextFallbackHtml(el);
    if (!fallbackHtml) return null;

    const wrapper = document.createElement("article");
    wrapper.setAttribute("data-nlm-export-fallback", "text");
    wrapper.innerHTML = fallbackHtml;
    return wrapper;
  };

  const collectMessagesHtml = (area, options = {}) => {
    const { ignoreVisibility = false } = options;
    if (!ignoreVisibility && area && area !== document.body && area !== document.documentElement && isLikelyChatArea(area)) {
      rememberChatArea(area);
    }
    const seen = new Set();
    const nodes = [];
    for (const sel of Selectors.chatItems) {
      for (const el of qsa(sel, area)) {
        if (!ignoreVisibility && !isVisible(el)) continue;
        if (!el.textContent?.trim()) continue;
        if (seen.has(el)) continue;
        seen.add(el);
        const normalized = normalizeExportNode(el);
        if (!normalized) continue;
        nodes.push(normalized);
      }
      if (nodes.length >= 3) break;
    }

    debug(
      "collectMessagesHtml",
      area ? describeNode(area) : "<root>",
      "items",
      nodes.length,
      "ignoreVisibility",
      ignoreVisibility
    );

    if (nodes.length) {
      debug("collectMessagesHtml nodes", nodes.map((node, idx) => {
        const tag = node.tagName?.toLowerCase?.() || describeNode(node);
        const fallback = node.getAttribute?.("data-nlm-export-fallback") || "";
        const sample = node.textContent ? node.textContent.trim().slice(0, 80) : "";
        return `${idx}:${tag}${fallback ? `(${fallback})` : ""}:${sample}`;
      }));
      const wrapper = document.createElement("div");
      nodes.forEach((node) => wrapper.appendChild(node));
      return wrapper.innerHTML;
    }

    const html = area.innerHTML || "";
    if (html.replace(/\s+/g, "").length) {
      debug("collectMessagesHtml fallback length", html.length);
      return html;
    }

    const shadowHtml = area.shadowRoot?.innerHTML || "";
    if (shadowHtml.replace(/\s+/g, "").length) {
      debug("collectMessagesHtml area shadow fallback length", shadowHtml.length);
      return shadowHtml;
    }

    if (area.shadowRoot) {
      const shadowText = textToParagraphHtml(area.shadowRoot.textContent || "");
      if (shadowText) {
        debug("collectMessagesHtml area shadow text fallback length", shadowText.length);
        return shadowText;
      }
    }

    const textFallback = textToParagraphHtml(area.innerText || area.textContent || "");
    if (textFallback) {
      debug("collectMessagesHtml area text fallback length", textFallback.length);
      return textFallback;
    }

    debug("collectMessagesHtml fallback empty", describeNode(area));
    return html;
  };

  const isLikelyChatArea = (el) => {
    if (!el) return false;
    const id = (el.id || "").toLowerCase();
    if (id.startsWith("cdk-live-announcer")) return false;
    const className = typeof el.className === "string" ? el.className.toLowerCase() : "";
    if (className.includes("emoji-keyboard")) return false;
    if (className.includes("cdk-live-announcer")) return false;
    return true;
  };

  const locateChatAreaFallback = () => {
    const selector = Selectors.chatContainers.join(',');
    for (const el of qsa(selector)) {
      if (!isLikelyChatArea(el)) continue;
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

  const debugListCandidates = () => {
    const containers = [];
    for (const sel of Selectors.chatContainers) {
      for (const el of qsa(sel)) {
        if (!isLikelyChatArea(el)) continue;
        containers.push({
          selector: sel,
          node: describeNode(el),
          textSample: (el.textContent || "").trim().slice(0, 80),
          shadow: !!el.shadowRoot
        });
      }
    }

    const items = [];
    for (const sel of Selectors.chatItems) {
      for (const el of qsa(sel)) {
        items.push({
          selector: sel,
          node: describeNode(el),
          textSample: (el.textContent || "").trim().slice(0, 80),
          shadow: !!el.shadowRoot
        });
      }
    }

    debug("debugListCandidates containers", containers);
    debug("debugListCandidates items", items);
    return { containers, items };
  };

  Object.assign(ns, {
    findButtonByText,
    findRefreshButton,
    findChatToolbar,
    findChatPanelFromToolbar,
    collectMessagesHtml,
    locateChatAreaFallback,
    guessNotebookLMNotes,
    debugListCandidates
  });
})();
