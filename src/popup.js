async function collectAndOpen(mode) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true});
    if (!tab?.id) return;

    const includeDollar = document.getElementById("detectDollar").checked;
    const delimiters = [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
    ];
    if (includeDollar) delimiters.push({ left: "$", right: "$", display: false });

    const message = { type: "NLM_EXPORT_COLLECT", mode, mathDelimiters: delimiters };

    let payload;

    try {
        payload = await chrome.tab.sendMessage(tab.id, message);
    } catch (err) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["src/content.js"]
            });
            payload = await chrome.tabs.sendMessage(tab.id, message);
        } catch(err2) {
            console.error("Could not reach content script:", err2);
            alert("Could not connect to the page. Make sure you're on https://notebooklm.google.com/ and refresh the tab.")
        }
    }

    if (!payload?.ok) {
        await chrome.runtime.sendMessage({ type: "NLM_OPEN_PRINT", payload });
        window.close();
    } else {
        alert("Could not collect notes on this page.");
    }
}

document.getElementById("exportAuto").addEventListener("click", () => collectAndOpen("auto"));
document.getElementById("exportSelection").addEventListener("click", () => collectAndOpen("selection"));
