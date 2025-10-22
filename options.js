/* global chrome */
import { getSync, setSync, defaultSettings } from "./utils/storage.js";

const statusEl = document.getElementById("options-status");
const notionStatusEl = document.getElementById("notion-status");

const settingFields = document.querySelectorAll("[data-setting]");

document.getElementById("back-to-popup")?.addEventListener("click", () => {
  window.close();
});

document.getElementById("test-notion")?.addEventListener("click", async () => {
  const payload = collectNotionSettings();
  notionStatusEl.textContent = "\u6d4b\u8bd5\u4e2d...";
  try {
    const result = await chrome.runtime.sendMessage({
      type: "WORDMATE_TEST_NOTION",
      payload
    });
    if (result?.success) {
      notionStatusEl.textContent = "Notion \u8fde\u63a5\u6210\u529f";
      notionStatusEl.style.color = "#16a34a";
      await setSync({ notionConfigured: true });
    } else {
      throw new Error(result?.message || "\u672a\u77e5\u9519\u8bef");
    }
  } catch (error) {
    notionStatusEl.textContent = `\u8fde\u63a5\u5931\u8d25\uff1a${error.message}`;
    notionStatusEl.style.color = "#dc2626";
  }
});

document.getElementById("export-history-options")?.addEventListener("click", () => {
  exportHistoryCsv();
});

document.getElementById("clear-history")?.addEventListener("click", async () => {
  const confirmed = confirm("\u786e\u5b9a\u8981\u5220\u9664\u6240\u6709\u5386\u53f2\u8bb0\u5f55\u5417\uff1f\u8be5\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002");
  if (!confirmed) return;
  await chrome.storage.local.set({ wordmateHistory: [] });
  setStatus("\u5df2\u6e05\u7a7a\u5386\u53f2\u8bb0\u5f55");
});

document.getElementById("disconnect-notion")?.addEventListener("click", async () => {
  await setSync({
    notionToken: "",
    notionDatabaseId: "",
    notionConfigured: false,
    autoSaveNotion: false
  });
  document.getElementById("notionToken").value = "";
  document.getElementById("notionDatabaseId").value = "";
  document.getElementById("autoSaveNotion").checked = false;
  notionStatusEl.textContent = "\u5df2\u65ad\u5f00 Notion \u6388\u6743";
  notionStatusEl.style.color = "#4b5563";
  setStatus("\u5df2\u65ad\u5f00 Notion \u6388\u6743");
});

document.getElementById("reset-settings")?.addEventListener("click", async () => {
  await setSync(defaultSettings);
  await loadSettings();
  setStatus("\u5df2\u6062\u590d\u9ed8\u8ba4\u8bbe\u7f6e");
});

settingFields.forEach((field) => {
  const handler = async () => {
    const key = field.dataset.setting;
    const value = getFieldValue(field);
    await setSync({ [key]: value });
    setStatus("\u5df2\u4fdd\u5b58");
  };
  field.addEventListener("change", handler);
  field.addEventListener("input", debounce(handler, 300));
});

async function loadSettings() {
  const settings = await getSync();
  settingFields.forEach((field) => {
    const key = field.dataset.setting;
    if (!(key in settings)) {
      return;
    }
    applyFieldValue(field, settings[key]);
  });
  notionStatusEl.textContent = settings.notionConfigured ? "Notion \u5df2\u8fde\u63a5" : "\u672a\u914d\u7f6e";
  notionStatusEl.style.color = settings.notionConfigured ? "#16a34a" : "#4b5563";
}

function getFieldValue(field) {
  if (field.type === "checkbox") {
    return field.checked;
  }
  return field.value.trim();
}

function applyFieldValue(field, value) {
  if (field.type === "checkbox") {
    field.checked = Boolean(value);
  } else if (field.tagName === "SELECT" || field.tagName === "INPUT") {
    field.value = value ?? "";
  }
}

function collectNotionSettings() {
  const token = document.getElementById("notionToken").value.trim();
  const databaseId = document.getElementById("notionDatabaseId").value.trim();
  return {
    notionToken: token,
    notionDatabaseId: databaseId
  };
}

async function exportHistoryCsv() {
  const { wordmateHistory = [] } = await chrome.storage.local.get("wordmateHistory");
  if (!wordmateHistory.length) {
    setStatus("\u6682\u65e0\u6570\u636e\u53ef\u5bfc\u51fa");
    return;
  }
  const header = ["Word", "Translation", "Phonetic", "Source URL", "Saved At", "Notion Synced"];
  const rows = wordmateHistory.map((item) => [
    sanitizeCsv(item.word),
    sanitizeCsv(item.translation),
    sanitizeCsv(item.phonetic),
    sanitizeCsv(item.sourceUrl),
    sanitizeCsv(item.savedAt),
    item.notionSynced ? "Yes" : "No"
  ]);
  const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename: `wordmate-history-${Date.now()}.csv`,
    saveAs: true
  });
  setStatus("\u5df2\u5bfc\u51fa CSV");
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function sanitizeCsv(text = "") {
  const str = String(text ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function debounce(fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function setStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
  if (!message) return;
  setTimeout(() => {
    statusEl.textContent = "";
  }, 3500);
}

loadSettings();
