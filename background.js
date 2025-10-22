import { lookupWord } from "./utils/translation.js";
import { defaultSettings, getSync, setSync, onSyncChange } from "./utils/storage.js";
import {
  addHistoryEntry,
  markNotionSynced,
  queueNotionEntry,
  shiftPendingNotion
} from "./utils/history.js";
import {
  saveWordToNotion,
  ensureNotionConfiguration,
  testNotionConnection,
  isNotionConfigured
} from "./utils/notion.js";

const COMMANDS = {
  OPEN_FLOAT: "wordmate-open-float",
  PLAY_AUDIO: "wordmate-play-audio",
  SAVE_NOTION: "wordmate-save-notion",
  OPEN_DASHBOARD: "wordmate-open-dashboard"
};

const NOTION_QUEUE_ALARM = "WORDMATE_NOTION_QUEUE";

let contextMenuRegistered = false;

chrome.runtime.onInstalled.addListener(async () => {
  contextMenuRegistered = false; // 重置标志
  await initializeDefaults();
  await registerContextMenu();
  chrome.alarms.create(NOTION_QUEUE_ALARM, { periodInMinutes: 5 });
});

chrome.runtime.onStartup.addListener(async () => {
  contextMenuRegistered = false; // 重置标志
  await registerContextMenu();
  chrome.alarms.create(NOTION_QUEUE_ALARM, { periodInMinutes: 5 });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "wordmate-context-lookup" || !tab?.id) {
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: "OPEN_FLOAT" });
});

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case COMMANDS.OPEN_FLOAT:
      await broadcastToActiveTab({ action: "OPEN_FLOAT" });
      break;
    case COMMANDS.PLAY_AUDIO:
      await broadcastToActiveTab({ action: "REPLAY_AUDIO" });
      break;
    case COMMANDS.SAVE_NOTION:
      await broadcastToActiveTab({ action: "SAVE_NOTION" });
      break;
    case COMMANDS.OPEN_DASHBOARD:
      chrome.action.openPopup();
      break;
    default:
      break;
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) {
    return;
  }
  switch (message.type) {
    case "WORDMATE_LOOKUP":
      handleLookupRequest(message.payload, sendResponse);
      return true;
    case "WORDMATE_SAVE_LOCAL":
      handleSaveLocal(message.payload, sendResponse);
      return true;
    case "WORDMATE_SAVE_NOTION":
      handleSaveNotion(message.payload, sendResponse);
      return true;
    case "WORDMATE_GET_SETTINGS":
      getSync().then(sendResponse);
      return true;
    case "WORDMATE_UPDATE_SETTINGS":
      updateSettings(message.payload).then(sendResponse);
      return true;
    case "WORDMATE_TEST_NOTION":
      handleTestNotion(message.payload, sendResponse);
      return true;
    case "WORDMATE_CONTEXT_READY":
      registerContextMenu();
      sendResponse({ ok: true });
      break;
    default:
      break;
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === NOTION_QUEUE_ALARM) {
    await flushPendingNotionQueue();
  }
});

onSyncChange(async (changes) => {
  const payload = {};
  Object.entries(changes).forEach(([key, change]) => {
    payload[key] = change.newValue;
  });

  if (
    Object.prototype.hasOwnProperty.call(payload, "notionToken") ||
    Object.prototype.hasOwnProperty.call(payload, "notionDatabaseId")
  ) {
    await ensureNotionConfiguration();
  }

  if (Object.keys(payload).length > 0) {
    await broadcastSettingsUpdate(payload);
  }
});

async function initializeDefaults() {
  const current = await getSync();
  const merged = { ...defaultSettings, ...current };
  await setSync(merged);
}

async function registerContextMenu() {
  if (contextMenuRegistered) {
    return;
  }
  
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create(
        {
          id: "wordmate-context-lookup",
          title: "\u7528 WordMate \u89e3\u8bfb",
          contexts: ["selection"]
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn("[WordMate] Context menu creation failed:", chrome.runtime.lastError.message);
          } else {
            contextMenuRegistered = true;
          }
          resolve();
        }
      );
    });
  });
}

async function handleLookupRequest(payload, sendResponse) {
  try {
    const lookup = await lookupWord(payload);
    sendResponse(lookup);
  } catch (error) {
    console.error("[WordMate] Lookup failed", error);
    sendResponse(null);
  }
}

async function handleSaveLocal(payload, sendResponse) {
  try {
    const entry = await addHistoryEntry(payload);
    sendResponse({ success: true, entry, message: "\u5df2\u52a0\u5165\u751f\u8bcd\u5e93" });
  } catch (error) {
    console.error("[WordMate] Save local failed", error);
    sendResponse({ success: false, message: error.message });
  }
}

async function handleSaveNotion(payload, sendResponse) {
  try {
    const { configured } = await ensureNotionConfiguration();
    if (!configured) {
      throw new Error("\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u914d\u7f6e Notion");
    }
    const result = await saveWordToNotion(payload);
    if (payload?.id) {
      await markNotionSynced(payload.id);
    }
    sendResponse({ success: true, notion: result });
  } catch (error) {
    console.error("[WordMate] Notion sync failed", error);
    await queueNotionEntry(payload);
    sendResponse({ success: false, message: error.message });
  }
}

async function handleTestNotion(payload, sendResponse) {
  try {
    const result = await testNotionConnection(payload);
    await setSync({ notionConfigured: true });
    sendResponse({ success: true, workspace: result.parent });
  } catch (error) {
    console.error("[WordMate] Notion test failed", error);
    sendResponse({ success: false, message: error.message });
  }
}

async function flushPendingNotionQueue() {
  const settings = await getSync();
  if (!isNotionConfigured(settings)) {
    return;
  }
  let entry = await shiftPendingNotion();
  while (entry) {
    try {
      await saveWordToNotion(entry);
    } catch (error) {
      console.warn("[WordMate] Retry Notion failed, re-queue", error);
      await queueNotionEntry(entry);
      break;
    }
    entry = await shiftPendingNotion();
  }
}

async function updateSettings(values = {}) {
  await setSync(values);
  return getSync();
}

async function broadcastToActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const [tab] = tabs;
  if (!tab?.id) {
    return;
  }
  return chrome.tabs.sendMessage(tab.id, message);
}

async function broadcastSettingsUpdate(payload) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((tab) => {
      if (!tab.id) {
        return;
      }
      return chrome.tabs
        .sendMessage(tab.id, {
          action: "UPDATE_SETTINGS",
          payload
        })
        .catch(() => {});
    })
  );
}

