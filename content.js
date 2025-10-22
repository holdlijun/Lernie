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
  panelPosition: { ...PANEL_DEFAULT_POSITION },
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

function formatPartOfSpeech(value) {
  if (!value) {
    return "\u8bcd\u6027";
  }
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "");
  return PART_OF_SPEECH_LABELS[normalized] || value;
}

function containsChinese(text = "") {
  return /[\u4e00-\u9fff]/.test(text);
}

function selectChineseTranslations(values = [], fallback = "") {
  const unique = [...new Set(values.map((item) => (item || "").trim()).filter(Boolean))];
  const chinese = unique.filter((item) => containsChinese(item));
  if (chinese.length) {
    return chinese;
  }
  if (fallback && containsChinese(fallback)) {
    return [fallback];
  }
  return unique;
}

function createTrigger() {
  const trigger = document.createElement("div");
  trigger.className = "wordmate-floating-trigger";
  trigger.textContent = "W";
  trigger.title = "WordMate \u67e5\u8bcd";
  trigger.addEventListener("mousedown", (event) => event.preventDefault());
  trigger.addEventListener("click", handleTriggerClick);
  document.documentElement.appendChild(trigger);
  dom.trigger = trigger;
}

function createPanel() {
  const panel = document.createElement("div");
  panel.className = "wordmate-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = `
    <div class="wordmate-panel-header">
      <div class="wordmate-panel-header-main">
        <h1 class="wordmate-panel-word" id="wordmate-word"></h1>
        <p class="wordmate-panel-phonetic" id="wordmate-phonetic"></p>
      </div>
      <button class="wordmate-icon-button" id="wordmate-audio-button" title="\u64ad\u653e\u53d1\u97f3 (Shift+P)" type="button">\uD83D\uDD0A</button>
      <button class="wordmate-icon-button" id="wordmate-pin-button" title="\u56fa\u5b9a\u9762\u677f" type="button">\u56fa\u5b9a</button>
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
    console.warn("[WordMate] Failed to build context", error);
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
  const rect = state.selectionRect;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  if (!state.panelPinned && rect) {
    const panelWidth = 360;
    const panelHeight = 320;
    let top = rect.bottom + scrollY + 12;
    let left = rect.left + scrollX;
    if (top + panelHeight > scrollY + window.innerHeight) {
      top = rect.top + scrollY - panelHeight - 12;
    }
    if (left + panelWidth > scrollX + window.innerWidth) {
      left = scrollX + window.innerWidth - panelWidth - 24;
    }
    state.panelPosition = { x: Math.max(left, 12 + scrollX), y: Math.max(top, 12 + scrollY) };
  }

  dom.panel.style.top = `${state.panelPosition.y}px`;
  dom.panel.style.left = `${state.panelPosition.x}px`;
}

function showPanel() {
  dom.panel?.classList.add("wordmate-visible");
  document.addEventListener("mousedown", handleOutsideClick, true);
  document.addEventListener("keydown", handleGlobalKey);
}

function hidePanel() {
  dom.panel?.classList.remove("wordmate-visible");
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
    pinButton.textContent = state.panelPinned ? "\u53d6\u6d88" : "\u56fa\u5b9a";
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
    const left = parseFloat(dom.panel.style.left) || dom.panel.offsetLeft || 0;
    const top = parseFloat(dom.panel.style.top) || dom.panel.offsetTop || 0;
    state.panelPosition = { x: left, y: top };
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
    console.error("[WordMate] Lookup failed", error);
    showToast("\u67e5\u8be2\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5");
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
  const { word, translation, definitions, phonetic, examples, audio, context, grammar } = result;
  dom.panel.querySelector("#wordmate-word").textContent = word || state.selectionText;
  dom.panel.querySelector("#wordmate-phonetic").textContent = phonetic || "";
  renderDefinitions(definitions, translation);
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

function renderDefinitions(definitions, fallback) {
  dom.translationBlock.innerHTML = "";
  const items = Array.isArray(definitions) ? definitions : [];
  const fallbackDisplay = selectChineseTranslations(fallback ? [fallback] : [], fallback)[0] || fallback || "";

  if (!items.length) {
    if (fallbackDisplay) {
      const paragraph = document.createElement("p");
      paragraph.textContent = fallbackDisplay;
      paragraph.style.fontSize = "16px";
      paragraph.style.fontWeight = "600";
      paragraph.style.color = "#0f172a";
      dom.translationBlock.appendChild(paragraph);
    } else {
      const empty = document.createElement("p");
      empty.textContent = "\u6682\u65e0\u91ca\u4e49";
      empty.style.color = "#475467";
      dom.translationBlock.appendChild(empty);
    }
    return;
  }

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "8px";

  items.slice(0, 6).forEach((definition) => {
    const wrapper = document.createElement("div");
    wrapper.style.padding = "10px 12px";
    wrapper.style.borderRadius = "12px";
    wrapper.style.background = "rgba(248, 250, 252, 0.95)";
    wrapper.style.border = "1px solid rgba(226, 232, 240, 0.7)";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.marginBottom = "6px";

    const part = document.createElement("span");
    part.className = "wordmate-badge";
    part.textContent = formatPartOfSpeech(definition.partOfSpeech);
    header.appendChild(part);
    wrapper.appendChild(header);

    const translationsRaw = Array.isArray(definition.translations)
      ? definition.translations.slice()
      : [];
    if (definition.translation && !translationsRaw.length) {
      translationsRaw.push(definition.translation);
    }
    if (!translationsRaw.length && fallbackDisplay) {
      translationsRaw.push(fallbackDisplay);
    }
    const chineseTranslations = selectChineseTranslations(translationsRaw, fallbackDisplay);
    const translationDisplay = chineseTranslations.slice(0, 3).join("\uff1b");

    if (translationDisplay) {
      const translationEl = document.createElement("p");
      translationEl.style.margin = "0";
      translationEl.style.fontSize = "16px";
      translationEl.style.fontWeight = "600";
      translationEl.style.color = "#0f172a";
      translationEl.textContent = translationDisplay;
      wrapper.appendChild(translationEl);
    } else if (fallbackDisplay) {
      const fallbackEl = document.createElement("p");
      fallbackEl.style.margin = "0";
      fallbackEl.style.fontSize = "16px";
      fallbackEl.style.fontWeight = "600";
      fallbackEl.style.color = "#0f172a";
      fallbackEl.textContent = fallbackDisplay;
      wrapper.appendChild(fallbackEl);
    }

    const meaningText = definition.meaning || "";
    if (meaningText) {
      const meaning = document.createElement("p");
      meaning.style.margin = (translationDisplay || fallbackDisplay) ? "6px 0 0" : "0";
      meaning.style.fontSize = "14px";
      meaning.style.lineHeight = "1.5";
      meaning.style.color = "#334155";
      meaning.textContent = meaningText;
      wrapper.appendChild(meaning);
    }

    if (definition.example) {
      const example = document.createElement("p");
      example.style.margin = "6px 0 0";
      example.style.fontSize = "13px";
      example.style.color = "#475467";
      example.textContent = definition.example;
      wrapper.appendChild(example);
    }

    if (definition.synonyms && definition.synonyms.length) {
      const synonyms = document.createElement("p");
      synonyms.style.margin = "6px 0 0";
      synonyms.style.fontSize = "13px";
      synonyms.style.color = "#0f172a";
      synonyms.textContent = "\u540c\u4e49\u8bcd\uff1a" + definition.synonyms.slice(0, 5).join("\u3001");
      wrapper.appendChild(synonyms);
    }

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

  chrome.runtime.sendMessage(
    {
      type: "WORDMATE_SAVE_LOCAL",
      payload: state.lastLookup
    },
    (response = {}) => {
      if (chrome.runtime.lastError) {
        console.error("[WordMate] Save local error", chrome.runtime.lastError);
        if (!silent) {
          showToast("\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5");
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
            console.error("[WordMate] Notion save error", chrome.runtime.lastError);
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
      console.warn("[WordMate] Audio playback failed, fallback to speech synthesis.", error);
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
    console.warn("[WordMate] speechSynthesis failed", error);
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
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", onStopDrag);
  });

  function onDrag(event) {
    if (!isDragging || !dom.panel) return;
    const x = event.clientX - startX;
    const y = event.clientY - startY;
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
  try {
    const settings = await chrome.runtime.sendMessage({
      type: "WORDMATE_GET_SETTINGS"
    });
    applySettings(settings || {});
  } catch (error) {
    console.warn("[WordMate] Failed to bootstrap settings", error);
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
