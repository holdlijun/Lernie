/* global chrome */

const FLOAT_TRIGGER_OFFSET = 12;
const PANEL_DEFAULT_POSITION = { x: 24, y: 24 };

const state = {
  selectionText: "",
  selectionContext: "",
  selectionRect: null,
  lastLookup: null,
  activeTab: "definition",
  autoPlayEnabled: false,
  notionAutoSave: false,
  panelPinned: false,
  panelPosition: null,
  notionConfigOk: false
};

const dom = {
  trigger: null,
  panel: null,
  tabs: {},
  body: null,
  translationBlock: null,
  contextBlock: null,
  grammarBlock: null,
  footer: null,
  toast: null
};

const PART_OF_SPEECH_LABELS = {
  noun: "\u540d\u8bcd",
  verb: "\u52a8\u8bcd",
  adjective: "\u5f62\u5bb9\u8bcd",
  adverb: "\u526f\u8bcd",
  pronoun: "\u4ee3\u8bcd",
  preposition: "\u4ecb\u8bcd",
  conjunction: "\u8fde\u8bcd",
  interjection: "\u611f\u53f9\u8bcd",
  determiner: "\u9650\u5b9a\u8bcd",
  article: "\u51a0\u8bcd",
  prefix: "\u524d\u7f00",
  suffix: "\u540e\u7f00",
  phrasalverb: "\u52a8\u8bcd\u77ed\u8bed",
  auxiliaryverb: "\u52a9\u52a8\u8bcd"
};

const PART_OF_SPEECH_COLORS = {
  noun: "#3b82f6",      // 閽冩繆澹?- 閸氬秷鐦?
  verb: "#ef4444",      // 缁俱垼澹?- 閸斻劏鐦?
  adjective: "#10b981",  // 缂佽儻澹?- 瑜般垹顔愮拠?
  adverb: "#f59e0b",    // 濮楁瑨澹?- 閸擃垵鐦?
  pronoun: "#8b5cf6",   // 缁鳖偉澹?- 娴狅綀鐦?
  preposition: "#06b6d4", // 闂堟帟澹?- 娴犲鐦?
  conjunction: "#84cc16", // 闂堟帞璞㈤懝?- 鏉╃偠鐦?
  interjection: "#f97316", // 濮楁瑧瀛╅懝?- 閹扮喎寰嗙拠?
  determiner: "#6366f1", // 闂堟稖鎽戦懝?- 闂勬劕鐣剧拠?
  article: "#14b8a6",   // 閽冩繄璞㈤懝?- 閸愮姾鐦?
  prefix: "#64748b",    // 閻忔媽澹?- 閸撳秶绱?
  suffix: "#64748b",    // 閻忔媽澹?- 閸氬海绱?
  phrasalverb: "#dc2626", // 濞ｈ京瀛╅懝?- 閸斻劏鐦濋惌顓☆嚔
  auxiliaryverb: "#b91c1c" // 濞ｈ京瀛╅懝?- 閸斺晛濮╃拠?
};

function formatPartOfSpeech(value) {
  if (!value) {
    return "\u8bcd\u6027";
  }
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "");
  return PART_OF_SPEECH_LABELS[normalized] || value;
}

function getPartOfSpeechColor(value) {
  if (!value) {
    return "#64748b"; // 姒涙顓婚悘鎷屽
  }
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "");
  return PART_OF_SPEECH_COLORS[normalized] || "#64748b";
}

function containsChinese(text = "") {
  return /[\u4e00-\u9fff]/.test(text);
}

function isExtensionContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (error) {
    return false;
  }
}

function handleExtensionContextInvalidated() {
  console.warn("[Lernie] Extension context invalidated, attempting to reinitialize...");
  
// Check extension context validity
  hidePanel();
  hideTrigger();
  
  // 濞撳懐鎮婇悩鑸碘偓?
  state.selectionText = "";
  state.selectionContext = "";
  state.selectionRect = null;
  state.lastLookup = null;
  
  // 閺勫墽銇氶幓鎰仛娣団剝浼?
  showToast("\u6269\u5c55\u5df2\u5931\u6548\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5");
  
  // 鐏忔繆鐦柌宥嗘煀閸掓繂顫愰崠鏍电礄瀵ゆ儼绻滈幍褑顢戦敍?
  setTimeout(() => {
    if (isExtensionContextValid()) {
      console.log("[Lernie] Extension context restored, reinitializing...");
      initialize();
    }
  }, 1000);
}

function selectChineseTranslations(values = [], fallback = "") {
  const collected = [];
  values.forEach((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) {
      return;
    }
    const segments = splitChineseText(text);
    if (segments.length) {
      segments.forEach((segment) => collected.push(segment));
    } else {
      collected.push(text);
    }
  });
  const unique = Array.from(new Set(collected.filter(Boolean)));
  const chinese = unique.filter((item) => containsChinese(item));
  if (chinese.length) {
    return chinese;
  }
  if (fallback) {
    const fallbackSegments = splitChineseText(fallback);
    if (fallbackSegments.length) {
      return Array.from(new Set(fallbackSegments));
    }
    if (containsChinese(fallback)) {
      return [fallback];
    }
  }
  return unique;
}

function splitChineseText(text) {
  return String(text)
    .split(/[\u3001\u3002\uff0c\uff1b\uff1a\uff0f,;\ufffd\ufffd\ufffd\ufffd\/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function createTrigger() {
  const trigger = document.createElement("div");
  trigger.className = "wordmate-floating-trigger";
  trigger.title = "Lernie \u67e5\u8bcd";
  const triggerIcon = document.createElement("img");
  triggerIcon.src = chrome.runtime.getURL("assets/icon48.png");
  triggerIcon.alt = "Lernie";
  triggerIcon.className = "wordmate-trigger-icon";
  trigger.appendChild(triggerIcon);
  trigger.addEventListener("mousedown", (event) => event.preventDefault());
  trigger.addEventListener("click", handleTriggerClick);
  document.documentElement.appendChild(trigger);
  dom.trigger = trigger;
}

function createPanel() {
  const panel = document.createElement("div");
  panel.className = "wordmate-panel";
  panel.style.position = "fixed";
  panel.style.display = "none";
  panel.style.top = "50%";
  panel.style.left = "50%";
  panel.style.transform = "translate(-50%, -50%)";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = `
    <div class="wordmate-panel-header">
      <div class="wordmate-panel-header-main">
        <h1 class="wordmate-panel-word" id="wordmate-word"></h1>
        <p class="wordmate-panel-phonetic" id="wordmate-phonetic"></p>
      </div>
      <button class="wordmate-icon-button" id="wordmate-audio-button" title="\u64ad\u653e\u53d1\u97f3 (Shift+P)" type="button">\uD83D\uDD0A</button>
      <button class="wordmate-icon-button" id="wordmate-pin-button" title="\u56fa\u5b9a\u9762\u677f" type="button">\uD83D\uDCCC</button>
      <button class="wordmate-icon-button" id="wordmate-close-button" title="\u5173\u95ed (Esc)" type="button">\u00d7</button>
    </div>
    <div class="wordmate-tabs" role="tablist">
      <button class="wordmate-tab wordmate-active" data-tab="definition" role="tab">\u91ca\u4e49</button>
      <button class="wordmate-tab" data-tab="context" role="tab">\u8bed\u5883</button>
      <button class="wordmate-tab" data-tab="writing" role="tab">\u5199\u4f5c</button>
      <button class="wordmate-tab" data-tab="vocabulary" role="tab">\u8bcd\u5e93</button>
    </div>
    <div class="wordmate-panel-body" id="wordmate-panel-body">
      <div data-section="definition">
        <div class="wordmate-translation" id="wordmate-translation"></div>
      </div>
      <div data-section="context" style="display:none">
        <div class="wordmate-section-title">\u8bed\u5883\u7ffb\u8bd1</div>
        <div id="wordmate-context"></div>
        <div class="wordmate-divider"></div>
        <div class="wordmate-section-title">\u8bed\u6cd5\u63d0\u793a</div>
        <div id="wordmate-grammar"></div>
      </div>
      <div data-section="writing" style="display:none">
        <div class="wordmate-section-title">\u5199\u4f5c\u52a9\u624b</div>
        <p style="font-size:13px;color:#475467;">\u5373\u5c06\u652f\u6301\u9488\u5bf9\u5f53\u524d\u9009\u4e2d\u5185\u5bb9\u7684\u6539\u5199\u3001\u6da6\u8272\u4e0e\u8bed\u6c14\u8c03\u6574\u3002</p>
      </div>
      <div data-section="vocabulary" style="display:none">
        <div class="wordmate-section-title">\u8bcd\u5e93\u64cd\u4f5c</div>
        <p style="font-size:13px;color:#475467;">\u5728\u4e0b\u65b9\u6309\u94ae\u4e2d\u6536\u85cf\u5230\u4e2a\u4eba\u8bcd\u5e93\u6216\u540c\u6b65\u81f3 Notion\u3002</p>
      </div>
    </div>
    <div class="wordmate-panel-footer">
      <button class="wordmate-primary-button" id="wordmate-save-notion" type="button">\u4fdd\u5b58\u751f\u8bcd\u5e93</button>
    </div>
  `;

  const toast = document.createElement("div");
  toast.className = "wordmate-panel-toast";
  toast.id = "wordmate-toast";
  toast.setAttribute("role", "status");
  panel.appendChild(toast);

  document.documentElement.appendChild(panel);
  dom.panel = panel;
  dom.body = panel.querySelector("#wordmate-panel-body");
  dom.translationBlock = panel.querySelector("#wordmate-translation");
  dom.contextBlock = panel.querySelector("#wordmate-context");
  dom.grammarBlock = panel.querySelector("#wordmate-grammar");
  dom.footer = panel.querySelector(".wordmate-panel-footer");
  dom.toast = toast;

  panel
    .querySelectorAll(".wordmate-tab")
    .forEach((tab) => tab.addEventListener("click", handleTabSwitch));

  panel
    .querySelector("#wordmate-close-button")
    .addEventListener("click", hidePanel);

  panel
    .querySelector("#wordmate-pin-button")
    .addEventListener("click", togglePanelPinned);

  panel
    .querySelector("#wordmate-save-notion")
    .addEventListener("click", () => handleSaveWord());

  panel
    .querySelector("#wordmate-audio-button")
    .addEventListener("click", handleReplayAudio);

  enablePanelDrag(panel.querySelector(".wordmate-panel-header"));
  updatePinVisualState();
  if (!state.panelPinned) {
    positionPanelNearSelection();
  }
}

function initContextMenusListener() {
  document.addEventListener("contextmenu", () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      state.selectionText = selection.toString().trim();
      state.selectionRect = selection.getRangeAt(0).getBoundingClientRect();
      state.selectionContext = buildSelectionContext(selection);
    }
  });
}

function buildSelectionContext(selection) {
  try {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const parentElement =
      container.nodeType === Node.ELEMENT_NODE
        ? container
        : container.parentElement;
    if (!parentElement) {
      return "";
    }
    const sentence = parentElement.innerText || "";
    return sentence.trim().slice(0, 400);
  } catch (error) {
    console.warn("[Lernie] Failed to build context", error);
    return "";
  }
}

function updateTriggerPosition(rect) {
  if (!dom.trigger || !rect) {
    return;
  }
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const top = rect.top + scrollY - dom.trigger.offsetHeight - FLOAT_TRIGGER_OFFSET;
  const left = rect.left + scrollX + rect.width + FLOAT_TRIGGER_OFFSET;

  dom.trigger.style.top = `${Math.max(top, 8)}px`;
  dom.trigger.style.left = `${Math.min(left, window.innerWidth + scrollX - 48)}px`;
}

function handleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    hideTrigger();
    return;
  }
  const text = selection.toString().trim();
  if (!isTextValidForLookup(text)) {
    hideTrigger();
    return;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  state.selectionText = text;
  state.selectionRect = rect;
  state.selectionContext = buildSelectionContext(selection);
  updateTriggerPosition(rect);
  showTrigger();
}

function isTextValidForLookup(text) {
  if (!text) {
    return false;
  }
  if (text.length > 60) {
    return false;
  }
  return /[A-Za-z]/.test(text);
}

function showTrigger() {
  if (!dom.trigger) return;
  dom.trigger.classList.add("wordmate-visible");
}

function hideTrigger() {
  if (!dom.trigger) return;
  dom.trigger.classList.remove("wordmate-visible");
}

function handleTriggerClick(event) {
  event.stopPropagation();
  openPanelAtSelection();
}

function openPanelAtSelection() {
  if (!state.selectionText) {
    hidePanel();
    return;
  }
  positionPanelNearSelection();
  showPanel();
  lookupSelection();
}

function positionPanelNearSelection() {
  if (!dom.panel) return;

  if (state.panelPinned && state.panelPosition) {
    const { x = 0, y = 0 } = state.panelPosition;
    dom.panel.style.transform = "";
    dom.panel.style.left = `${x}px`;
    dom.panel.style.top = `${y}px`;
    return;
  }

  dom.panel.style.left = "50%";
  dom.panel.style.top = "50%";
  dom.panel.style.transform = "translate(-50%, -50%)";
  state.panelPosition = null;
}

function showPanel() {
  if (!dom.panel) return;

  positionPanelNearSelection();
  dom.panel.style.display = "flex";
  dom.panel.classList.add("wordmate-visible");
  console.log("[Lernie][UI] showPanel", {
    pinned: state.panelPinned,
    position: state.panelPosition
  });
  document.addEventListener("mousedown", handleOutsideClick, true);
  document.addEventListener("keydown", handleGlobalKey);
}

function hidePanel() {
  if (!dom.panel) return;

  dom.panel.classList.remove("wordmate-visible");
  dom.panel.style.display = "none";
  if (!state.panelPinned) {
    dom.panel.style.transform = "translate(-50%, -50%)";
  }
  hideTrigger();
  document.removeEventListener("mousedown", handleOutsideClick, true);
  document.removeEventListener("keydown", handleGlobalKey);
}

function handleOutsideClick(event) {
  if (!dom.panel || state.panelPinned) return;
  const target = event.target;
  if (
    dom.panel.contains(target) ||
    dom.trigger.contains(target)
  ) {
    return;
  }
  hidePanel();
}

function handleGlobalKey(event) {
  if (event.key === "Escape") {
    hidePanel();
  }
}

function updatePinVisualState() {
  const pinButton = dom.panel?.querySelector("#wordmate-pin-button");
  if (pinButton) {
    pinButton.textContent = "\uD83D\uDCCC";
    pinButton.title = state.panelPinned ? "\u53d6\u6d88\u56fa\u5b9a" : "\u56fa\u5b9a\u9762\u677f";
    pinButton.setAttribute("aria-pressed", state.panelPinned ? "true" : "false");
  }
  if (dom.panel) {
    dom.panel.classList.toggle("wordmate-pinned", state.panelPinned);
  }
}

function togglePanelPinned() {
  state.panelPinned = !state.panelPinned;
  if (state.panelPinned && dom.panel) {
    const rect = dom.panel.getBoundingClientRect();
    const left = rect.left;
    const top = rect.top;
    dom.panel.style.transform = "";
    dom.panel.style.left = `${left}px`;
    dom.panel.style.top = `${top}px`;
    state.panelPosition = { x: left, y: top };
  } else {
    state.panelPosition = null;
  }
  updatePinVisualState();
  if (!state.panelPinned) {
    positionPanelNearSelection();
  }
}

function handleTabSwitch(event) {
  const tab = event.currentTarget;
  const target = tab.dataset.tab;
  if (!target) return;
  state.activeTab = target;
  dom.panel
    .querySelectorAll(".wordmate-tab")
    .forEach((node) => node.classList.toggle("wordmate-active", node === tab));

  dom.body
    .querySelectorAll("[data-section]")
    .forEach((section) => {
      section.style.display =
        section.getAttribute("data-section") === target ? "block" : "none";
    });
}

async function lookupSelection() {
  if (!isExtensionContextValid()) {
    console.error("[Lernie] Extension context invalidated, please reload the page");
    handleExtensionContextInvalidated();
    return;
  }
  
  const payload = {
    text: state.selectionText,
    context: state.selectionContext,
    sourceUrl: window.location.href,
    pageTitle: document.title
  };
  setPanelLoading(true);
  try {
    const response = await chrome.runtime.sendMessage({
      type: "WORDMATE_LOOKUP",
      payload
    });
    if (!response) {
      throw new Error("Empty response");
    }
    state.lastLookup = response;
    renderLookupResult(response);
    if (state.autoPlayEnabled) {
      playPronunciation("default");
    }
    if (state.notionAutoSave) {
      handleSaveWord({ trigger: "auto", silent: true });
    }
  } catch (error) {
    console.error("[Lernie] Lookup failed", error);
    if (error.message.includes("Extension context invalidated")) {
      handleExtensionContextInvalidated();
    } else {
      showToast("\u67e5\u8be2\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5");
    }
  } finally {
    setPanelLoading(false);
  }
}

function setPanelLoading(isLoading) {
  if (!dom.panel) return;
  dom.panel.classList.toggle("wordmate-loading", isLoading);
  if (isLoading) {
    dom.translationBlock.textContent = "\u52a0\u8f7d\u4e2d...";
    dom.contextBlock.textContent = "\u6682\u65e0\u8bed\u5883\u4fe1\u606f\u3002";
    dom.grammarBlock.textContent = "\u6682\u65e0\u8bed\u6cd5\u63d0\u793a\u3002";
  }
}

function renderLookupResult(result) {
  const { word, translation, translations = [], definitions, phonetic, examples, audio, context, grammar } = result;
  dom.panel.querySelector("#wordmate-word").textContent = word || state.selectionText;
  dom.panel.querySelector("#wordmate-phonetic").textContent = phonetic || "";
  renderDefinitions(definitions, translation, translations || []);
  renderContext(context);
  renderGrammar(grammar);

  const saveButton = dom.footer.querySelector("#wordmate-save-notion");
  if (saveButton) {
    saveButton.disabled = false;
    saveButton.title = state.notionConfigOk
      ? "\u4fdd\u5b58\u5230\u751f\u8bcd\u5e93\u5e76\u540c\u6b65 Notion"
      : "\u4fdd\u5b58\u5230\u751f\u8bcd\u5e93\uff08\u672a\u914d\u7f6e Notion\uff09";
  }
  const audioButton = dom.panel.querySelector("#wordmate-audio-button");
  audioButton.dataset.audioUrl = audio?.default || "";
  audioButton.disabled = !audio;
}

function renderDefinitions(definitions, fallback, fallbackAlternatives = []) {
  if (!dom.translationBlock) {
    console.error("[Lernie] ERROR: dom.translationBlock is null or undefined!");
    return;
  }
  
  dom.translationBlock.innerHTML = "";
  const items = Array.isArray(definitions) ? definitions : [];
  const baseAlternatives = Array.isArray(fallbackAlternatives)
    ? fallbackAlternatives.filter(Boolean)
    : [];
  const fallbackCandidates = selectChineseTranslations(
    baseAlternatives.length ? baseAlternatives : fallback ? [fallback] : [],
    fallback
  );

  const emptyMessage = "\u6682\u65e0\u91ca\u4e49";

  if (!items.length) {
    const fallbackText = fallbackCandidates[0] || fallback || baseAlternatives[0];
    const paragraph = document.createElement("p");
    paragraph.textContent = fallbackText || emptyMessage;
    paragraph.style.fontSize = "16px";
    paragraph.style.fontWeight = "600";
    paragraph.style.color = "#0f172a";
    dom.translationBlock.appendChild(paragraph);
    return;
  }

  // 閹稿鐦濋幀褍鍨庣紒鍕嫙閸氬牆鑻熼惄绋挎倱鐠囧秵鈧呮畱闁插﹣绠?
  const groupedByPos = {};
  console.log("[Lernie][DEBUG] Original definitions:", items);
  
  items.forEach((definition, index) => {
    const partLabelRaw = definition.partOfSpeech || "";
    const partLabel = formatPartOfSpeech(partLabelRaw);
    const key = partLabelRaw || "unknown";
    
    console.log(`[Lernie][DEBUG] Definition ${index}:`, {
      partOfSpeech: partLabelRaw,
      partLabel: partLabel,
      key: key,
      translations: definition.translations,
      translation: definition.translation,
      meaning: definition.meaning
    });
    
    if (!groupedByPos[key]) {
      groupedByPos[key] = {
        partOfSpeech: partLabelRaw,
        partLabel: partLabel,
        translations: []
      };
    }
    
    // 閺€鍫曟肠閹碘偓閺堝鐐曠拠?
    const translations = Array.isArray(definition.translations)
      ? definition.translations.filter(Boolean)
      : [];
    
    if (translations.length) {
      groupedByPos[key].translations.push(...translations);
    } else if (definition.translation) {
      groupedByPos[key].translations.push(definition.translation);
    } else if (definition.meaning) {
      groupedByPos[key].translations.push(definition.meaning);
    }
  });
  
  console.log("[Lernie][DEBUG] Grouped by POS:", groupedByPos);

  // 婵″倹鐏夊▽鈩冩箒閸掑棛绮嶇紒鎾寸亯閿涘奔濞囬悽鈺llback
  const groupedEntries = Object.values(groupedByPos);
  if (groupedEntries.length === 0) {
    const fallbackText = fallbackCandidates[0] || fallback || baseAlternatives[0];
    const paragraph = document.createElement("p");
    paragraph.textContent = fallbackText || emptyMessage;
    paragraph.style.fontSize = "16px";
    paragraph.style.fontWeight = "600";
    paragraph.style.color = "#0f172a";
    dom.translationBlock.appendChild(paragraph);
    return;
  }

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "8px";

  groupedEntries.slice(0, 6).forEach((group, index) => {
    console.log(`[Lernie][DEBUG] Rendering group ${index}:`, group);
    const partLabelRaw = group.partOfSpeech;
    const partLabel = group.partLabel;
    const partColor = getPartOfSpeechColor(partLabelRaw);
    
    const wrapper = document.createElement("div");
    wrapper.style.padding = "12px 16px";
    wrapper.style.borderRadius = "12px";
    wrapper.style.background = "rgba(248, 250, 252, 0.95)";
    wrapper.style.border = `2px solid ${partColor}20`;
    wrapper.style.marginBottom = "8px";
    wrapper.style.transition = "all 0.2s ease";
    wrapper.style.cursor = "default";
    
    // 濞ｈ濮為幃顒€浠犻弫鍫熺亯
    wrapper.addEventListener("mouseenter", () => {
      wrapper.style.border = `2px solid ${partColor}40`;
      wrapper.style.background = "rgba(248, 250, 252, 1)";
      wrapper.style.transform = "translateY(-1px)";
      wrapper.style.boxShadow = `0 4px 12px ${partColor}20`;
    });
    
    wrapper.addEventListener("mouseleave", () => {
      wrapper.style.border = `2px solid ${partColor}20`;
      wrapper.style.background = "rgba(248, 250, 252, 0.95)";
      wrapper.style.transform = "translateY(0)";
      wrapper.style.boxShadow = "none";
    });

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.marginBottom = "8px";

    const part = document.createElement("span");
    part.className = "wordmate-badge";
    part.textContent = partLabel;
    part.style.backgroundColor = partColor;
    part.style.color = "white";
    part.style.padding = "4px 8px";
    part.style.borderRadius = "6px";
    part.style.fontSize = "12px";
    part.style.fontWeight = "600";
    part.style.marginRight = "8px";
    header.appendChild(part);
    wrapper.appendChild(header);

    // 閸樺鍣搁獮鍫曟閸掑墎鐐曠拠鎴炴殶闁?
    const uniqueTranslations = Array.from(new Set(group.translations)).slice(0, 6);
    let displayList = uniqueTranslations;
    
    // 婵″倹鐏夋禒宥囧姧濞屸剝婀佺紙鏄忕槯閿涘奔濞囬悽鈺llback
    if (!displayList.length) {
      displayList = fallbackCandidates.slice(0, 6);
    }

    const paragraph = document.createElement("p");
    paragraph.style.margin = "0";
    paragraph.style.fontSize = "16px";
    paragraph.style.fontWeight = "600";
    paragraph.style.color = "#0f172a";
    paragraph.style.lineHeight = "1.5";
    paragraph.textContent = displayList.join("\uff0c") || emptyMessage;
    wrapper.appendChild(paragraph);
    
    list.appendChild(wrapper);
  });

  dom.translationBlock.appendChild(list);
}
function renderContext(context) {
  dom.contextBlock.innerHTML = "";
  if (!context || !context.translation) {
    dom.contextBlock.textContent = "\u6682\u65e0\u8bed\u5883\u4fe1\u606f\u3002";
    return;
  }
  const paragraph = document.createElement("p");
  paragraph.style.fontSize = "14px";
  paragraph.style.lineHeight = "1.5";
  paragraph.textContent = context.translation;

  dom.contextBlock.appendChild(paragraph);

  if (context.original) {
    const source = document.createElement("p");
    source.style.marginTop = "6px";
    source.style.fontSize = "13px";
    source.style.color = "#475467";
    source.textContent = "\u539f\u6587\uff1a" + context.original;
    dom.contextBlock.appendChild(source);
  }
}

function renderGrammar(grammar) {
  dom.grammarBlock.innerHTML = "";
  if (!Array.isArray(grammar) || grammar.length === 0) {
    dom.grammarBlock.textContent = "\u6682\u65e0\u8bed\u6cd5\u63d0\u793a\u3002";
    return;
  }
  grammar.forEach((item) => {
    const block = document.createElement("div");
    block.style.marginBottom = "8px";
    block.innerHTML = `
      <div class="wordmate-badge">${item.title || "\u8bed\u6cd5\u63d0\u793a"}</div>
      <p style="margin-top:4px;font-size:13px;line-height:1.5;">${item.detail || ""}</p>
    `;
    dom.grammarBlock.appendChild(block);
  });
}
function handleSaveWord({ trigger = "manual", silent = false } = {}) {
  if (!state.lastLookup) {
    if (!silent) {
      showToast("\u8bf7\u5148\u67e5\u8be2\u5355\u8bcd");
    }
    return;
  }

  if (trigger === "manual" && !state.notionConfigOk) {
    if (!silent) {
      showToast("\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u6dfb\u52a0 Notion \u914d\u7f6e");
    }
    return;
  }

  if (!isExtensionContextValid()) {
    console.error("[Lernie] Extension context invalidated during save");
    if (!silent) {
      showToast("\u6269\u5c55\u5df2\u5931\u6548\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5");
    }
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "WORDMATE_SAVE_LOCAL",
      payload: state.lastLookup
    },
    (response = {}) => {
      if (chrome.runtime.lastError) {
        console.error("[Lernie] Save local error", chrome.runtime.lastError);
        if (!silent) {
          if (chrome.runtime.lastError.message.includes("Extension context invalidated")) {
            showToast("\u6269\u5c55\u5df2\u5931\u6548\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5");
          } else {
            showToast("\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5");
          }
        }
        return;
      }

      const { success, message, entry } = response;
      if (!success) {
        if (!silent) {
          showToast(message || "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5");
        }
        return;
      }

      if (entry) {
        state.lastLookup = { ...state.lastLookup, ...entry };
      }

      const notionRequired = trigger === "manual" && state.notionConfigOk;
      if (!notionRequired) {
        if (!silent) {
          showToast(message || "\u5df2\u52a0\u5165\u751f\u8bcd\u5e93");
        }
        return;
      }

      const notionPayload = entry ? { ...entry, ...state.lastLookup } : state.lastLookup;
      chrome.runtime.sendMessage(
        {
          type: "WORDMATE_SAVE_NOTION",
          payload: notionPayload
        },
        (notionResponse = {}) => {
          if (chrome.runtime.lastError) {
            console.error("[Lernie] Notion save error", chrome.runtime.lastError);
            showToast("\u672c\u5730\u5df2\u4fdd\u5b58\uff0c\u4f46\u540c\u6b65 Notion \u5931\u8d25");
            return;
          }

          if (notionResponse.success) {
            state.lastLookup = { ...state.lastLookup, notionSynced: true };
            showToast("\u5df2\u4fdd\u5b58\u5e76\u540c\u6b65\u5230 Notion");
          } else {
            const detail = notionResponse.message ? "\uff1a" + notionResponse.message : "";
            showToast("\u672c\u5730\u5df2\u4fdd\u5b58\uff0c\u4f46 Notion \u540c\u6b65\u5931\u8d25" + detail);
          }
        }
      );
    }
  );
}

function showToast(message) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.add("wordmate-visible");
  setTimeout(() => dom.toast.classList.remove("wordmate-visible"), 2200);
}

function handleReplayAudio() {
  if (!state.lastLookup) return;
  playPronunciation("default");
}

function playPronunciation(source) {
  let audioUrl = "";
  if (source === "default" && state.lastLookup?.audio) {
    audioUrl =
      state.lastLookup.audio?.preferred ||
      state.lastLookup.audio?.default ||
      state.lastLookup.audio?.fallback ||
      "";
  } else if (typeof source === "string") {
    audioUrl = source;
  }

  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => synthesizeSpeech(state.lastLookup?.word || state.selectionText));
    } catch (error) {
      console.warn("[Lernie] Audio playback failed, fallback to speech synthesis.", error);
      synthesizeSpeech(state.lastLookup?.word || state.selectionText);
    }
    return;
  }
  synthesizeSpeech(state.lastLookup?.word || state.selectionText);
}

function synthesizeSpeech(text) {
  if (!text || !("speechSynthesis" in window)) {
    showToast("\u6682\u65e0\u53ef\u64ad\u653e\u7684\u53d1\u97f3");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = 1;
  utterance.rate = 1;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn("[Lernie] speechSynthesis failed", error);
    showToast("\u8bed\u97f3\u5408\u6210\u4e0d\u53ef\u7528");
  }
}

function enablePanelDrag(header) {
  if (!header) return;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  header.style.cursor = "move";
  header.addEventListener("mousedown", (event) => {
    if (!dom.panel) return;
    isDragging = true;
    startX = event.clientX - dom.panel.offsetLeft;
    startY = event.clientY - dom.panel.offsetTop;
    dom.panel.style.transform = "";
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", onStopDrag);
  });

  function onDrag(event) {
    if (!isDragging || !dom.panel) return;
    const x = event.clientX - startX;
    const y = event.clientY - startY;
    dom.panel.style.transform = "";
    dom.panel.style.left = `${x}px`;
    dom.panel.style.top = `${y}px`;
    state.panelPosition = { x, y };
    state.panelPinned = true;
    updatePinVisualState();
  }

  function onStopDrag() {
    isDragging = false;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", onStopDrag);
  }
}

function handleCommandMessage(request) {
  switch (request.action) {
    case "OPEN_FLOAT":
      if (state.selectionText) {
        openPanelAtSelection();
      } else {
        showToast("\u8bf7\u5148\u9009\u62e9\u9700\u8981\u67e5\u8be2\u7684\u5185\u5bb9");
      }
      break;
    case "REPLAY_AUDIO":
      handleReplayAudio();
      break;
    case "SAVE_NOTION":
      handleSaveWord();
      break;
    case "UPDATE_SETTINGS":
      applySettings(request.payload || {});
      break;
    case "SHOW_LOOKUP_RESULT":
      if (request.payload) {
        state.lastLookup = request.payload;
        showPanel();
        renderLookupResult(request.payload);
      }
      break;
    default:
      break;
  }
}

function applySettings(settings) {
  if (typeof settings.autoPlayAudio === "boolean") {
    state.autoPlayEnabled = settings.autoPlayAudio;
  }
  if (typeof settings.autoSaveNotion === "boolean") {
    state.notionAutoSave = settings.autoSaveNotion;
  }
  if (typeof settings.notionConfigured === "boolean") {
    state.notionConfigOk = settings.notionConfigured;
  }
}

async function bootstrapSettings() {
  if (!isExtensionContextValid()) {
    console.warn("[Lernie] Extension context invalidated, skipping settings bootstrap");
    return;
  }
  
  try {
    const settings = await chrome.runtime.sendMessage({
      type: "WORDMATE_GET_SETTINGS"
    });
    applySettings(settings || {});
  } catch (error) {
    console.warn("[Lernie] Failed to bootstrap settings", error);
  }
}

function registerKeyboardShortcutListener() {
  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      if (state.selectionText) {
        openPanelAtSelection();
      } else {
        showToast("\u8bf7\u5148\u9009\u62e9\u9700\u8981\u67e5\u8be2\u7684\u5185\u5bb9");
      }
    }
  });
}

function registerSelectionHandlers() {
  document.addEventListener("mouseup", () => setTimeout(handleSelectionChange, 10));
  document.addEventListener("keyup", () => setTimeout(handleSelectionChange, 10));
}

function initMessageListener() {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (!request) return;
    handleCommandMessage(request);
    sendResponse && sendResponse();
  });
}

function initContextMenuIntegration() {
  if (!isExtensionContextValid()) {
    console.warn("[Lernie] Extension context invalidated, skipping context menu integration");
    return;
  }
  chrome.runtime.sendMessage({ type: "WORDMATE_CONTEXT_READY" });
}

function initialize() {
  if (window.top !== window.self) {
    return;
  }
  createTrigger();
  createPanel();
  initContextMenusListener();
  registerSelectionHandlers();
  registerKeyboardShortcutListener();
  initMessageListener();
  initContextMenuIntegration();
  bootstrapSettings();
}

initialize();















