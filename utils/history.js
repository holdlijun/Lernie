import { pushToLocalArray, getLocal, setLocal } from "./storage.js";

const HISTORY_KEY = "wordmateHistory";
const PENDING_NOTION_KEY = "wordmatePendingNotion";

export async function addHistoryEntry(entry) {
  const normalized = {
    id: crypto.randomUUID(),
    word: entry.word,
    translation: entry.translation,
    definitions: entry.definitions || [],
    phonetic: entry.phonetic || "",
    phonetics: entry.phonetics || [],
    examples: entry.examples || [],
    audio: entry.audio || {},
    context: entry.context || {},
    grammar: entry.grammar || [],
    sourceUrl: entry.sourceUrl || "",
    pageTitle: entry.pageTitle || "",
    savedAt: new Date().toISOString(),
    notionSynced: entry.notionSynced ?? false
  };
  await pushToLocalArray(HISTORY_KEY, normalized);
  return normalized;
}

export async function listHistory(limit = 20) {
  const { [HISTORY_KEY]: history = [] } = await getLocal([HISTORY_KEY]);
  if (!Array.isArray(history)) {
    return [];
  }
  return limit ? history.slice(0, limit) : history;
}

export async function markNotionSynced(id) {
  const { [HISTORY_KEY]: history = [] } = await getLocal([HISTORY_KEY]);
  if (!Array.isArray(history)) return;
  const next = history.map((item) =>
    item.id === id ? { ...item, notionSynced: true } : item
  );
  await setLocal({ [HISTORY_KEY]: next });
}

export async function queueNotionEntry(entry) {
  const { [PENDING_NOTION_KEY]: queue = [] } = await getLocal([PENDING_NOTION_KEY]);
  queue.push(entry);
  await setLocal({ [PENDING_NOTION_KEY]: queue });
}

export async function shiftPendingNotion() {
  const { [PENDING_NOTION_KEY]: queue = [] } = await getLocal([PENDING_NOTION_KEY]);
  if (!Array.isArray(queue) || queue.length === 0) {
    return null;
  }
  const [first, ...rest] = queue;
  await setLocal({ [PENDING_NOTION_KEY]: rest });
  return first;
}

export async function getPendingNotionQueue() {
  const { [PENDING_NOTION_KEY]: queue = [] } = await getLocal([PENDING_NOTION_KEY]);
  return Array.isArray(queue) ? queue : [];
}
