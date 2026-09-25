(function () {
  const LINK_CLASS = "gmail-2fa-code-copier-link";
  const PROCESSED_ATTR = "data-gmail-2fa-code-copier-processed";
  const CODE_PATTERN = /[A-Za-z0-9][A-Za-z0-9_-]{2,}[A-Za-z0-9]|\b\d{4,}\b/g;
  const SKIP_SELECTOR = "a, button, input, textarea, select, script, style, code, pre, ." + LINK_CLASS;
  const SCAN_TARGET_SELECTOR = ".a3s, h2.hP";

  let enabled = true;
  let scanTimer = null;
  let observer = null;

  chrome.storage.sync.get({ enabled: true }, (items) => {
    enabled = items.enabled;
    if (enabled) {
      start();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.enabled) {
      return;
    }

    enabled = changes.enabled.newValue;
    if (enabled) {
      start();
    } else {
      stop();
    }
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("." + LINK_CLASS);
    if (!link) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    copyCode(link);
  }, true);

  function start() {
    scanSoon();
    if (!observer) {
      observer = new MutationObserver(scanSoon);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function stop() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (scanTimer) {
      window.clearTimeout(scanTimer);
      scanTimer = null;
    }
    unwrapLinks();
  }

  function scanSoon() {
    if (!enabled || scanTimer) {
      return;
    }

    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      scanTargets();
    }, 150);
  }

  function scanTargets() {
    document.querySelectorAll(SCAN_TARGET_SELECTOR).forEach((target) => {
      processNode(target);
    });
  }

  function processNode(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(textNode) {
        const parent = textNode.parentElement;
        if (!parent || parent.closest(SKIP_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!textNode.nodeValue || !hasCodeCandidate(textNode.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach(linkifyTextNode);
  }

  function hasCodeCandidate(text) {
    CODE_PATTERN.lastIndex = 0;
    return CODE_PATTERN.test(text);
  }

  function linkifyTextNode(textNode) {
    const text = textNode.nodeValue;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let changed = false;

    CODE_PATTERN.lastIndex = 0;
    let match;
    while ((match = CODE_PATTERN.exec(text)) !== null) {
      const code = match[0];
      if (!isCode(code)) {
        continue;
      }

      if (match.index > lastIndex) {
        fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      fragment.append(createCodeLink(code));
      lastIndex = match.index + code.length;
      changed = true;
    }

    if (!changed) {
      return;
    }

    if (lastIndex < text.length) {
      fragment.append(document.createTextNode(text.slice(lastIndex)));
    }
    textNode.replaceWith(fragment);
  }

  function isCode(value) {
    return value.length >= 4 && /\d/.test(value);
  }

  function createCodeLink(code) {
    const link = document.createElement("a");
    link.href = "#";
    link.className = LINK_CLASS;
    link.textContent = code;
    link.dataset.code = code;
    link.setAttribute(PROCESSED_ATTR, "true");
    link.title = "Copy 2FA code";
    return link;
  }

  async function copyCode(link) {
    const code = link.dataset.code || link.textContent;
    try {
      await navigator.clipboard.writeText(code);
      showCopied(link);
    } catch (_error) {
      fallbackCopy(code);
      showCopied(link);
    }
  }

  function fallbackCopy(code) {
    const input = document.createElement("textarea");
    input.value = code;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.top = "-9999px";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  function showCopied(link) {
    link.classList.add("gmail-2fa-code-copier-copied");
    link.title = "Copied";
    window.setTimeout(() => {
      link.classList.remove("gmail-2fa-code-copier-copied");
      link.title = "Copy 2FA code";
    }, 900);
  }

  function unwrapLinks() {
    document.querySelectorAll("." + LINK_CLASS).forEach((link) => {
      link.replaceWith(document.createTextNode(link.dataset.code || link.textContent));
    });
  }
})();
