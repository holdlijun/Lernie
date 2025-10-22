/* global chrome */

const SYNC_KEYS = [
  "translationProvider",
  "autoPlayAudio",
  "autoSaveNotion",
  "notionToken",
  "notionDatabaseId",
  "audioProvider",
  "defaultTab",
  "theme",
  "autoOpenPanel",
  "notionConfigured",
  "openAIApiKey",
  "openAIModel"
];

export const defaultSettings = {
  translationProvider: "google",
  autoPlayAudio: false,
  autoSaveNotion: false,
  notionToken: "",
  notionDatabaseId: "",
  audioProvider: "google",
  defaultTab: "definition",
  theme: "auto",
  autoOpenPanel: true,
  notionConfigured: false,
  openAIApiKey: "",
  openAIModel: "gpt-4o-mini"
};

export async function getSync(keys = null) {
  const queryKeys = keys ?? SYNC_KEYS;
  const data = await chrome.storage.sync.get(queryKeys);
  return { ...defaultSettings, ...data };
}

export async function setSync(values) {
  if (!values || typeof values !== "object") {
    return;
  }
  await chrome.storage.sync.set(values);
}

export async function getLocal(keys) {
  return chrome.storage.local.get(keys);
}

export async function setLocal(values) {
  await chrome.storage.local.set(values);
}

export function onSyncChange(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      callback(changes);
    }
  });
}

export async function pushToLocalArray(key, value, limit = 200) {
  const result = await chrome.storage.local.get(key);
  const list = Array.isArray(result[key]) ? result[key] : [];
  list.unshift(value);
  if (list.length > limit) {
    list.length = limit;
  }
  await chrome.storage.local.set({ [key]: list });
  return list;
}
