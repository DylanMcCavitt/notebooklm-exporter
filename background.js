// background.js (MV3 module) — minimal

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "NLM_OPEN_PRINT" && msg.payload) {
    openPrintTab(msg.payload);
    sendResponse({ ok: true });
  }
});

// Opens the extension's print page with the captured HTML
async function openPrintTab(payload) {
  const key = `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Session storage is ephemeral; nothing persists after the browser session.
  await chrome.storage.session.set({ [key]: payload });

  const url = chrome.runtime.getURL("print.html") + `?key=${encodeURIComponent(key)}`;
  await chrome.tabs.create({ url });
}
