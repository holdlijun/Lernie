import { getSync, setSync } from "./storage.js";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

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

export async function ensureNotionConfiguration() {
  const settings = await getSync();
  const configured = isNotionConfigured(settings);
  if (configured && !settings.notionConfigured) {
    await setSync({ notionConfigured: true });
  }
  return { settings, configured };
}

export function isNotionConfigured(settings) {
  return Boolean(settings.notionToken && settings.notionDatabaseId);
}

export async function saveWordToNotion(entry) {
  const { settings, configured } = await ensureNotionConfiguration();
  if (!configured) {
    throw new Error("Notion \u672a\u914d\u7f6e");
  }

  const payload = buildNotionPayload(entry, settings.notionDatabaseId);
  const response = await fetch(`${NOTION_API_BASE}/pages`, {
    method: "POST",
    headers: notionHeaders(settings.notionToken),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion \u540c\u6b65\u5931\u8d25\uff1a${response.status} ${errorText}`);
  }

  const json = await response.json();
  return json;
}

export function buildNotionPayload(entry, databaseId) {
  const examples = (entry.examples || [])
    .map((item, index) => `${index + 1}. ${coerceString(item.en)}\n${coerceString(item.zh)}`)
    .join("\n\n")
    .trim();

  const meaningText = buildMeaningText(entry) || coerceString(entry.translation);

  const phoneticText = buildPhoneticText(entry);
  const contextText = buildContextText(entry);

  const properties = {
    Word: {
      title: [
        {
          text: {
            content: coerceString(entry.word)
          }
        }
      ]
    },
    Meaning: buildRichTextProperty(meaningText),
    Phonetic: buildRichTextProperty(phoneticText || entry.phonetic),
    Examples: buildRichTextProperty(examples),
    Context: buildRichTextProperty(contextText),
    Source: entry.sourceUrl ? { url: entry.sourceUrl } : undefined,
    SourceTitle: buildRichTextProperty(entry.pageTitle),
    Created: {
      date: {
        start: new Date().toISOString()
      }
    }
  };

  const statusProperty = buildStatusProperty(entry.status);
  if (statusProperty) {
    properties.Status = statusProperty;
  }

  Object.keys(properties).forEach((key) => {
    if (properties[key] === undefined) {
      delete properties[key];
    }
  });

  return {
    parent: { database_id: databaseId },
    properties
  };
}

export async function testNotionConnection({ notionToken, notionDatabaseId }) {
  if (!notionToken || !notionDatabaseId) {
    throw new Error("Notion Token \u6216 Database ID \u672a\u914d\u7f6e");
  }
  const response = await fetch(`${NOTION_API_BASE}/databases/${notionDatabaseId}`, {
    method: "GET",
    headers: notionHeaders(notionToken)
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Notion \u8fde\u63a5\u5931\u8d25\uff1a${response.status} ${payload}`);
  }
  return response.json();
}

function notionHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json"
  };
}

function buildRichTextProperty(value) {
  const text = coerceString(value);
  if (!text) {
    return undefined;
  }
  return {
    rich_text: [
      {
        text: {
          content: text
        }
      }
    ]
  };
}

function buildStatusProperty(statusName) {
  const name = coerceString(statusName);
  if (!name) {
    return undefined;
  }
  return {
    status: {
      name
    }
  };
}

function coerceString(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && typeof item.text === "string") {
          return item.text;
        }
        return [];
      })
      .join("")
      .trim();
  }
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

function buildPhoneticText(entry) {
  const phonetics = Array.isArray(entry.phonetics) ? entry.phonetics : [];
  const texts = [];
  if (phonetics.length) {
    phonetics.forEach((item) => {
      const text = coerceString(item?.text);
      if (text) {
        texts.push(text);
      }
    });
  }
  const unique = dedupeStrings(texts);
  if (unique.length) {
    return unique.join("\n");
  }
  return coerceString(entry.phonetic);
}

function buildMeaningText(entry) {
  const definitions = Array.isArray(entry.definitions) ? entry.definitions : [];
  if (!definitions.length) {
    const translations = Array.isArray(entry.translations) ? entry.translations : [];
    const fallbackList = dedupeStrings(translations.map((item) => coerceString(item)).filter(Boolean));
    if (fallbackList.length) {
      return fallbackList.join("\uff1b");
    }
    return coerceString(entry.translation);
  }
  return definitions
    .map((item, index) => {
      const lines = [];
      const partLabel = formatPartOfSpeechLabel(item.partOfSpeech, index);
      const translations = extractTranslations(item);
      const meaningText = coerceString(item.meaning);

      if (translations.length) {
        lines.push(partLabel + "\uff1a" + translations.slice(0, 3).join("\uff1b"));
        if (meaningText) {
          lines.push("\u82f1\u91ca\uff1a" + meaningText);
        }
      } else if (meaningText) {
        lines.push(partLabel + "\uff1a" + meaningText);
      } else {
        lines.push(partLabel);
      }

      if (item.example) {
        lines.push("\u4f8b\u53e5\uff1a" + coerceString(item.example));
      }

      const synonyms = Array.isArray(item.synonyms) ? sanitizeSynonyms(item.synonyms) : [];
      if (synonyms.length) {
        lines.push("\u540c\u4e49\u8bcd\uff1a" + synonyms.slice(0, 6).join("\u3001"));
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

function buildContextText(entry) {
  const context = entry.context || {};
  const parts = [];
  if (context.translation) {
    parts.push("\u8bed\u5883\u7ffb\u8bd1\uff1a" + coerceString(context.translation));
  }
  if (context.original) {
    parts.push("\u539f\u6587\uff1a" + coerceString(context.original));
  }
  return parts.join("\n");
}

function formatPartOfSpeechLabel(value, index) {
  if (!value) {
    return "\u91ca\u4e49" + (index + 1);
  }
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "");
  return PART_OF_SPEECH_LABELS[normalized] || value;
}

function extractTranslations(item) {
  const pool = [];
  if (Array.isArray(item.translations)) {
    pool.push(...item.translations);
  }
  if (item.translation) {
    pool.push(item.translation);
  }
  return dedupeStrings(
    pool
      .map((value) => coerceString(value))
      .filter((value) => value && !/[0-9_]{3,}/.test(value))
  );
}

function sanitizeSynonyms(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return dedupeStrings(
    values
      .map((value) => coerceString(value))
      .filter((value) => value && !/[0-9_]{3,}/.test(value))
  );
}

function dedupeStrings(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const text = coerceString(value);
    if (!text) {
      return;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(text);
  });
  return result;
}
