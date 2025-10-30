// print.js (module)

const decodeHtmlEntities = (() => {
  const textarea = document.createElement("textarea");
  return (str) => {
    if (!str || str.indexOf("&") === -1) return str;
    textarea.innerHTML = str;
    return textarea.value;
  };
})();

const LATEX_COMMANDS = [
  "\\\\frac",
  "\\\\sqrt",
  "\\\\int",
  "\\\\sum",
  "\\\\prod",
  "\\\\displaystyle",
  "\\\\over",
  "\\\\binom",
  "\\\\lim",
  "\\\\log",
  "\\\\ln",
  "\\\\exp",
  "\\\\sin",
  "\\\\cos",
  "\\\\tan",
  "\\\\theta",
  "\\\\phi",
  "\\\\pi",
  "\\\\Gamma",
  "\\\\beta",
  "\\\\alpha",
  "\\\\gamma",
  "\\\\lambda",
  "\\\\sigma",
  "\\\\rho",
  "\\\\mu",
  "\\\\nu",
  "\\\\omega",
  "\\\\cdot",
  "\\\\times",
  "\\\\leq",
  "\\\\geq",
  "\\\\neq",
  "\\\\approx",
  "\\\\rightarrow",
  "\\\\mapsto",
  "\\\\begin\\{cases\\}",
  "\\\\begin\\{align",
  "\\\\begin\\{array"
];

function sanitize(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  doc.querySelectorAll("script, iframe, object, embed").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      if (attr.name === "srcdoc") el.removeAttribute(attr.name);
      if (/^_?ng/.test(attr.name)) el.removeAttribute(attr.name);
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

  selectors.forEach((sel) => {
    root.querySelectorAll(sel).forEach((node) => removeQueue.add(node));
  });

  root.querySelectorAll("span, div, button").forEach((node) => {
    const cls = node.className || "";
    const label = (node.getAttribute("aria-label") || node.getAttribute("title") || "").toLowerCase();
    if (/reference|citation|footnote|source/i.test(cls) || /reference|citation|footnote|source/.test(label)) {
      removeQueue.add(node);
      return;
    }
    const text = (node.textContent || "").trim();
    if (text && /^\d{1,3}$/.test(text)) removeQueue.add(node);
  });

  removeQueue.forEach((node) => {
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
      .replace(/\\text\s*\{([^}]*)\}/g, (_m, inner) => inner);
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

function promoteBareLatex(root) {
  if (!root) return;
  const selectors = ["p", "span", "li", "div"];
  root.querySelectorAll(selectors.join(",")).forEach((node) => {
    if (node.children.length) return;
    if (node.closest(".katex") || node.closest("math")) return;
    let text = (node.textContent || "").trim();
    if (!text) return;
    const decoded = decodeHtmlEntities(text);
    if (decoded !== text) {
      text = decoded;
      node.textContent = decoded;
    }
    if (/^\$\$[\s\S]*\$\$$/.test(text) || /^\$[\s\S]*\$/.test(text)) return;
    if (!text.includes("\\")) return;
    const looksLikeMath = LATEX_COMMANDS.some((cmd) => text.includes(cmd));
    if (!looksLikeMath) return;
    const display =
      /\\(begin|displaystyle|int|sum|prod|frac|cases|align|array)/.test(text) ||
      text.includes("\\\\") ||
      text.length > 80;
    node.textContent = display ? `$$${text}$$` : `$${text}$`;
  });
}

function convertDividerParagraphs(root) {
  if (!root) return;
  root.querySelectorAll("p").forEach((p) => {
    if (p.children.length) return;
    const text = (p.textContent || "").trim();
    if (!text) return;
    if (/^[-_]{3,}$/.test(text)) {
      const hr = document.createElement("hr");
      hr.className = "nlm-divider";
      p.replaceWith(hr);
    }
  });
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
  convertDividerParagraphs(content);
  normalizeCitations(content);
  cleanupLatexArtifacts(content);
  promoteBareLatex(content);
  ensureDisplayWrappers(content);

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

  document
    .getElementById("btn-save")
    .addEventListener("click", async () => {
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
