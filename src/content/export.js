(() => {
  const ns = window.NLMExport;
  if (!ns) return;

  const {
    TAG,
    state,
    debug,
    escapeHtml,
    getSelectionHtml,
    Selectors,
    findChatToolbar,
    findChatPanelFromToolbar,
    locateChatAreaFallback,
    collectMessagesHtml,
    guessNotebookLMNotes,
    injectToolbarButton,
    showToast
  } = ns;

  const getCopyChatButton = () => {
    return Array.from(document.querySelectorAll(Selectors.buttons)).find((btn) => {
      const label = (btn.getAttribute("data-tooltip") || btn.getAttribute("aria-label") || "").toLowerCase();
      if (label.includes("copy chat")) return true;
      const text = (btn.textContent || "").toLowerCase();
      return text.includes("copy chat");
    }) || null;
  };

  const collectViaClipboard = async () => {
    const copyBtn = getCopyChatButton();
    debug("copy button", copyBtn ? copyBtn.tagName : "<none>");
    if (!copyBtn) return null;

    copyBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 200));

    let clip = null;
    try {
      clip = await navigator.clipboard.readText();
    } catch (_err) {
      console.warn(`${TAG} clipboard read failed`);
    }
    if (!clip) return null;

    debug("clipboard length", clip.length);
    const blocks = clip.trim().split(/\r?\n\r?\n/);
    const html = blocks.map((block) => {
      const text = escapeHtml(block).replace(/\r?\n/g, "<br>");
      return `<p>${text}</p>`;
    }).join("");
    showToast("Copied chat to clipboard, preparing PDF export…");
    return html;
  };

  const defaultDelimiters = () => ([
    { left: "$$", right: "$$", display: true },
    { left: "\\[", right: "\\]", display: true },
    { left: "\\(", right: "\\)", display: false },
    { left: "$", right: "$", display: false }
  ]);

  const sendToPrintPage = async (html) => {
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
  };

  const gatherExportHtml = async () => {
    const selection = getSelectionHtml();
    if (selection) {
      debug("export source", "selection");
      return selection;
    }

    const toolbar = findChatToolbar();
    debug("toolbar", toolbar ? toolbar.tagName : "<none>");
    if (toolbar) {
      const loc = findChatPanelFromToolbar(toolbar);
      debug("toolbar loc", loc?.area ? loc.area.tagName : "<none>");
      if (loc?.area) {
        const html = collectMessagesHtml(loc.area);
        if (html) return html;
      }
    }

    if (state.lastChatArea?.isConnected) {
      debug("using cached area", state.lastChatArea.tagName);
      const cached = collectMessagesHtml(state.lastChatArea);
      if (cached) return cached;
    }

    const clipboard = await collectViaClipboard();
    if (clipboard) {
      debug("export source", "clipboard");
      return clipboard;
    }

    const notes = guessNotebookLMNotes();
    if (notes) {
      debug("export source", "notes fallback");
      return notes;
    }

    const ensureContent = (html) => (html && html.replace(/\s+/g, "").length ? html : null);

    const main = document.querySelector("main");
    if (main) {
      debug("falling back to main", main.tagName);
      const mainHtml = ensureContent(collectMessagesHtml(main));
      if (mainHtml) return mainHtml;
      const mainLoose = ensureContent(collectMessagesHtml(main, { ignoreVisibility: true }));
      if (mainLoose) return mainLoose;
      const mainRaw = ensureContent(main.innerHTML);
      if (mainRaw) return mainRaw;
    }

    debug("falling back to body/document");
    const bodyHtml = ensureContent(collectMessagesHtml(document.body));
    if (bodyHtml) return bodyHtml;
    const bodyLoose = ensureContent(collectMessagesHtml(document.body, { ignoreVisibility: true }));
    if (bodyLoose) return bodyLoose;
    const bodyRaw = ensureContent(document.body.innerHTML);
    if (bodyRaw) return bodyRaw;

    return ensureContent(document.documentElement.innerHTML) || document.documentElement.innerHTML;
  };

  const exportChatOrNotes = async () => {
    const html = await gatherExportHtml();
    const textLength = html ? html.replace(/<[^>]+>/g, "").replace(/\s+/g, "").length : 0;
    if (!html || textLength === 0) {
      showToast("Couldn’t find chat/notes here. Scroll or select text and try again.");
      console.warn(
        `${TAG} export aborted — insufficient HTML`,
        html ? html.slice(0, 120) : "<empty>",
        `(text length: ${textLength})`
      );
      return;
    }
    await sendToPrintPage(html);
  };

  const setupObservers = () => {
    const observer = new MutationObserver(() => {
      injectToolbarButton(exportChatOrNotes);
      if (state.lastChatArea && !state.lastChatArea.isConnected) state.lastChatArea = null;
      if (!state.lastChatArea) locateChatAreaFallback();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return observer;
  };

  const setupRuntimeListener = () => {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type !== "NLM_EXPORT_COLLECT") return;
      try {
        const toolbar = findChatToolbar();
        const loc = findChatPanelFromToolbar(toolbar);
        const ensureContent = (value) => (value && value.replace(/\s+/g, "").length ? value : null);

        let html =
          getSelectionHtml() ||
          (loc?.area ? collectMessagesHtml(loc.area) : null) ||
          guessNotebookLMNotes();

        if (!html) {
          const mainEl = document.querySelector("main");
          if (mainEl) {
            html =
              ensureContent(collectMessagesHtml(mainEl)) ||
              ensureContent(collectMessagesHtml(mainEl, { ignoreVisibility: true })) ||
              ensureContent(mainEl.innerHTML);
          }
        }

        if (!html) {
          html =
            ensureContent(collectMessagesHtml(document.body)) ||
            ensureContent(collectMessagesHtml(document.body, { ignoreVisibility: true })) ||
            ensureContent(document.body.innerHTML) ||
            document.body.innerHTML;
        }

        sendResponse({
          ok: !!html,
          html,
          title: document.title,
          url: location.href,
          mathDelimiters: msg.mathDelimiters || null
        });
      } catch (err) {
        console.error(`${TAG} export (message) failed`, err);
        sendResponse({ ok: false, error: String(err) });
      }
      return true;
    });
  };

  const init = () => {
    injectToolbarButton(exportChatOrNotes);
    locateChatAreaFallback();
    setupObservers();
    setupRuntimeListener();
  };

  init();

  Object.assign(ns, {
    exportChatOrNotes,
    gatherExportHtml,
    collectViaClipboard,
    defaultDelimiters
  });
})();
