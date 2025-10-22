/* global chrome */

const historyListEl = document.getElementById("history-list");
const historyEmptyEl = document.getElementById("history-empty");
const statusMessageEl = document.getElementById("status-message");

document.getElementById("open-options")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("refresh-history")?.addEventListener("click", () => {
  loadHistory();
});

document.getElementById("open-dashboard")?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options.html#dashboard") });
});

document.getElementById("export-history")?.addEventListener("click", () => {
  exportHistoryCsv();
});

document.getElementById("open-notion")?.addEventListener("click", async () => {
  const settings = await chrome.storage.sync.get(["notionDatabaseId"]);
  if (!settings.notionDatabaseId) {
    setStatus("\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u7ed1\u5b9a Notion \u6570\u636e\u5e93");
    return;
  }
  const notionLink = `https://www.notion.so/${settings.notionDatabaseId.replace(/-/g, "")}`;
  chrome.tabs.create({ url: notionLink });
});

async function loadHistory() {
  const { wordmateHistory = [] } = await chrome.storage.local.get("wordmateHistory");
  renderHistory(wordmateHistory.slice(0, 10));
}

function renderHistory(history) {
  historyListEl.innerHTML = "";
  if (!history || history.length === 0) {
    historyEmptyEl.style.display = "block";
    return;
  }
  historyEmptyEl.style.display = "none";
  history.forEach((item) => {
    const li = document.createElement("li");
    li.className = "wm-history-item";
    li.innerHTML = `
      <span class="wm-history-word">${item.word}</span>
      <span style="font-size:13px;color:#1f2937;">${item.translation || ""}</span>
      <div class="wm-history-meta">
        <span>${formatDate(item.savedAt)}</span>
        <span>${item.notionSynced ? "\u5df2\u540c\u6b65\u5230 Notion" : "\u672a\u540c\u6b65"}</span>
      </div>
    `;
    li.addEventListener("click", () => openLookupInActiveTab(item));
    historyListEl.appendChild(li);
  });
}

async function openLookupInActiveTab(entry) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("\u672a\u627e\u5230\u5f53\u524d\u6807\u7b7e\u9875");
    return;
  }
  chrome.tabs.sendMessage(tab.id, {
    action: "SHOW_LOOKUP_RESULT",
    payload: entry
  });
  window.close();
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

  const csvLines = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csvLines], { type: "text/csv" });
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
  const string = String(text ?? "");
  if (/[",\n]/.test(string)) {
    return `"${string.replace(/"/g, '""')}"`;
  }
  return string;
}

function formatDate(isoString) {
  if (!isoString) {
    return "-";
  }
  const date = new Date(isoString);
  return date.toLocaleString();
}

function setStatus(message) {
  if (!message) {
    statusMessageEl.textContent = "";
    return;
  }
  statusMessageEl.textContent = message;
  setTimeout(() => {
    statusMessageEl.textContent = "";
  }, 4000);
}

loadHistory();
