// print.js (module)

function sanitize(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  doc.querySelectorAll("script, iframe, object, embed").forEach(el => el.remove());
  doc.querySelectorAll("*").forEach(el => {
    [...el.attributes].forEach(attr => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name); // strip onClick/onLoad/...
      if (attr.name === "srcdoc") el.removeAttribute("srcdoc");
    });
  });
  return doc.body.innerHTML;
}

function makeFileName(title) {
  const base = (title || "NotebookLM Export").replace(/\s+/g, "_").replace(/[^\w\-]+/g, "");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `${base}_${stamp}.pdf`;
}

function normalizeCitations(root) {
  if (!root) return;

  const removeQueue = new Set();
  const selectors = [
    "sup",
    "a[href^='#cite']",
    "a[data-reference-id]",
    "span[data-reference-id]",
    "button[data-reference-id]",
    "[role='doc-noteref']",
    "[role='doc-footnote']"
  ];

  selectors.forEach(sel => {
    root.querySelectorAll(sel).forEach(node => removeQueue.add(node));
  });

  root.querySelectorAll("span, div, button").forEach(node => {
    const cls = node.className || "";
    const label = (node.getAttribute("aria-label") || node.getAttribute("title") || "").toLowerCase();
    if (/reference|citation|footnote|source/i.test(cls) || /reference|citation|footnote|source/.test(label)) {
      removeQueue.add(node);
      return;
    }
    const text = (node.textContent || "").trim();
    if (text && /^\d{1,3}$/.test(text)) removeQueue.add(node);
  });

  removeQueue.forEach(node => {
    const prev = node.previousSibling;
    if (prev && prev.nodeType === Node.TEXT_NODE && !/\s$/.test(prev.textContent || "")) {
      prev.textContent += " ";
    } else if (!prev) {
      const parent = node.parentNode;
      if (parent) parent.insertBefore(document.createTextNode(" "), node);
    }
    node.remove();
  });
}

function cleanupLatexArtifacts(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const footnoteBlock = /\\text\s*\{\s*\\?\$\$\s*\d+\s*(?:\\text\s*\{[^}]*\}\s*)?\}/g;
  const emptyDisplay = /\\text\s*\{\s*\\?\$\$\s*\}/g;
  const displayOpen = /\\text\s*\{\s*\\?\$\$\s*/g;
  const displayClose = /\s*\\?\$\$\s*\}/g;
  const inlineOpen = /\\text\s*\{\s*\\?\$\s*/g;
  const inlineClose = /\s*\\?\$\s*\}/g;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    let text = node.textContent;
    if (!text || text.indexOf("\\text") === -1) continue;
    const original = text;
    text = text
      .replace(footnoteBlock, "")
      .replace(emptyDisplay, "")
      .replace(displayOpen, () => "$$")
      .replace(displayClose, () => "$$")
      .replace(inlineOpen, () => "$")
      .replace(inlineClose, () => "$")
      .replace(/\$\$([\s\S]*?)\$(\d{1,3})\s*\}/g, (_match, inner) => `$$${inner}$$`)
      .replace(/\$([\s\S]*?)\$(\d{1,3})\s*\}/g, (_match, inner) => `$${inner}$`)
      .replace(/\$\$(\d{1,3})\s*\}/g, () => "$$")
      .replace(/\$(\d{1,3})\s*\}/g, () => "$")
      .replace(/\\text\s*\{([^}]*)\}/g, (_m, inner) => inner); // strip stray \text{} wrappers
    if (text !== original) node.textContent = text;
  }
}

function ensureDisplayWrappers(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    let text = node.textContent;
    if (!text) continue;

    const replaced = text.replace(/\$\$\s*([^$]+?)\s*\$\$\s*(\d{1,3})/g, "$$$1$$");
    if (replaced !== text) {
      node.textContent = replaced;
      text = replaced;
    }

    const displayBlock = /^\s*\$\$[\s\S]*\$\$\s*$/;
    if (!displayBlock.test(text)) continue;

    const parent = node.parentElement;
    if (!parent || parent.classList.contains("katex-display")) continue;

    const wrapper = document.createElement("div");
    wrapper.className = "math-block";
    node.parentNode.insertBefore(wrapper, node);
    wrapper.appendChild(node);
  }
}

async function main() {
  const params = new URLSearchParams(location.search);
  const key = params.get("key");
  if (!key) return;

  const store = await chrome.storage.session.get(key);
  const payload = store[key] || {};
  const { html, title, url, mathDelimiters } = payload;

  document.getElementById("doc-title").textContent = title || "NotebookLM Export";
  document.getElementById("doc-meta").textContent = `${new Date().toLocaleString()} • ${url || ""}`;

  const content = document.getElementById("content");
  content.innerHTML = sanitize(html);
  normalizeCitations(content);
  cleanupLatexArtifacts(content);
  ensureDisplayWrappers(content);

  // Render math with KaTeX auto-render
  const delimiters = mathDelimiters || [
    { left: "$$", right: "$$", display: true },
    { left: "\\[", right: "\\]", display: true },
    { left: "\\(", right: "\\)", display: false },
    { left: "$", right: "$", display: false }
  ];

  renderMathInElement(content, {
    delimiters,
    throwOnError: false,
    strict: false,
    trust: true,
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
  });

  await document.fonts.ready;

  document.getElementById("btn-print").addEventListener("click", () => window.print());

  document.getElementById("btn-save").addEventListener("click", async () => {
    if (!window.html2pdf) return alert("html2pdf is not available.");
    await html2pdf()
      .set({
        margin: 10,
        filename: makeFileName(title),
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      })
      .from(content)
      .save();
  });
}

main();
