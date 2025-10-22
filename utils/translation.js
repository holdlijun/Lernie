import { getSync } from "./storage.js";

const GOOGLE_TRANSLATE_ENDPOINT =
  "https://translate.googleapis.com/translate_a/single";
const GOOGLE_TRANSLATE_PARAMS = "client=gtx&sl=auto&tl=zh-CN&dt=t&dt=bd";

export async function lookupWord({ text, context = "", sourceUrl = "", pageTitle = "" }) {
  const word = (text || "").trim();
  if (!word) {
    throw new Error("Missing lookup text");
  }

  const settings = await getSync();
  const translationProvider = settings.translationProvider || "google";

  const [dictionary, translation] = await Promise.all([
    fetchFreeDictionary(word).catch(() => null),
    translateContext(word, context, translationProvider).catch(() => null)
  ]);

  const translationAlternatives = Array.isArray(translation?.translations)    ? translation.translations.filter(Boolean)    : [];  
  console.info('[WordMate] translationAlternatives', translationAlternatives);

  const definitions = buildDefinitions(dictionary, translation, translationAlternatives);

  const primaryMeaning =
    sanitizeTranslationValue(translation?.wordTranslation || "") ||
    (definitions.length ? definitions[0].translation || definitions[0].meaning : "") ||
    "\u672a\u627e\u5230\u91ca\u4e49";

  const phonetics = buildPhonetics(dictionary);
  const phonetic =
    phonetics.primary ||
    sanitizeTranslationValue(translation?.phonetic || "") ||
    "";

  const audioDefault =
    dictionary?.phonetics?.find((item) => item.audio)?.audio || buildFallbackAudioUrl(word);

  const examples = buildExamples(dictionary, translation, context);

  return {
    word,
    translation: primaryMeaning,
    translations: translationAlternatives,
    definitions,
    phonetic,
    phonetics: phonetics.items,
    examples,
    audio: {
      default: audioDefault,
      fallback: buildFallbackAudioUrl(word),
      preferred: selectPreferredAudio(dictionary)
    },
    context: {
      original: context,
      translation: sanitizeTranslationValue(
        translation?.contextTranslation || translation?.wordTranslation || ""
      ),
      provider: translation?.provider || translationProvider
    },
    grammar: translation?.grammarTips || [],
    sourceUrl,
    pageTitle
  };
}

async function fetchFreeDictionary(word) {
  const endpoint = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Dictionary lookup failed: ${response.status}`);
  }
  const json = await response.json();
  const [entry] = Array.isArray(json) ? json : [];
  return entry;
}

async function translateContext(word, context, provider) {
  if (provider !== "gpt") {
    const wordResult = await translateWithGoogle(word);
    let contextResult = emptyTranslation();
    if (context) {
      try {
        contextResult = await translateWithGoogle(context);
      } catch (_) {
        contextResult = emptyTranslation();
      }
    }
    return {
      provider: "google",
      wordTranslation: wordResult.primary,
      translations: wordResult.translations,
      dictionary: wordResult.dictionary,
      contextTranslation: contextResult.primary,
      contextTranslations: contextResult.translations
    };
  }

  const wordPlaceholder = `\u3010GPT\u3011${word}`;
  const contextPlaceholder = context ? `\u3010GPT\u3011${context}` : "";

  return {
    provider: "gpt",
    wordTranslation: wordPlaceholder,
    translations: wordPlaceholder ? [wordPlaceholder] : [],
    dictionary: [],
    contextTranslation: contextPlaceholder,
    contextTranslations: contextPlaceholder ? [contextPlaceholder] : [],
    grammarTips: [
      {
        title: "\u6682\u672a\u63a5\u5165 GPT",
        detail: "\u5f53\u524d\u7248\u672c\u4f7f\u7528\u5360\u4f4d\u7ed3\u679c\uff0c\u8bf7\u5728\u8bbe\u7f6e\u4e2d\u914d\u7f6e OpenAI API \u540e\u542f\u7528\u3002"
      }
    ]
  };
}

async function translateWithGoogle(text) {
  if (!text) {
    return emptyTranslation();
  }

  const url = `${GOOGLE_TRANSLATE_ENDPOINT}?${GOOGLE_TRANSLATE_PARAMS}&q=${encodeURIComponent(
    text
  )}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Google translate failed");
  }
  const json = await response.json();
  const segments = Array.isArray(json?.[0]) ? json[0] : [];
  const translations = segments
    .filter(Array.isArray)
    .map((segment) => sanitizeTranslationValue(segment[0]))
    .filter(Boolean);
  console.log(translations);
  const dictionary = parseGoogleDictionary(json?.[1]);

  return {
    primary: translations[0] || "",
    translations,
    dictionary
  };
}

function parseGoogleDictionary(rawDictionary) {
  if (!Array.isArray(rawDictionary)) {
    return [];
  }

  return rawDictionary
    .filter(Array.isArray)
    .map((entry) => {
      const [partOfSpeech, directTranslations, detailedEntries] = entry;
      const part = typeof partOfSpeech === "string" ? partOfSpeech : "";
      const baseTranslations = Array.isArray(directTranslations)
        ? directTranslations.map(sanitizeTranslationValue).filter(Boolean)
        : [];
      const detailedTranslations = Array.isArray(detailedEntries)
        ? detailedEntries
            .map((item) => sanitizeTranslationValue(item?.[0]))
            .filter(Boolean)
        : [];
      const allTranslations = dedupeStrings([...baseTranslations, ...detailedTranslations]);
      return {
        partOfSpeech: part,
        translations: allTranslations
      };
    })
    .filter((entry) => entry.partOfSpeech && entry.translations.length);
}

function buildDefinitions(dictionary, translation, translationAlternatives = []) {
  const translationText = sanitizeTranslationValue(translation?.wordTranslation || "");
  const translationMap = buildTranslationMap(translation?.dictionary, translationAlternatives);
  console.info("[WordMate] buildDefinitions", {
    hasDictionary: Boolean(dictionary),
    translationText,
    translationAlternatives,
    translationMapKeys: Array.from(translationMap.keys())
  });
  const grouped = new Map();

  if (dictionary?.meanings?.length) {
    dictionary.meanings.forEach((meaning) => {
      const partLabel = meaning.partOfSpeech || "";
      const partKey = normalizePartOfSpeech(meaning.partOfSpeech);
      const candidates = [
        ...(translationMap.get(partKey) || []),
        ...(translationMap.get("default") || []),
        ...translationAlternatives,
        translationText
      ];
      const translationsList = selectChineseCandidates(candidates, translationText);
      if (!translationsList.length) {
        return;
      }
      if (!grouped.has(partLabel)) {
        grouped.set(partLabel, new Set());
      }
      const bucket = grouped.get(partLabel);
      translationsList.forEach((item) => bucket.add(item));
    });
  }

  translationMap.forEach((translationsList, partKey) => {
    if (partKey === "default") {
      return;
    }
    const partLabel = partKey || "";
    const normalizedList = selectChineseCandidates(translationsList, translationText);
    if (!normalizedList.length) {
      return;
    }
    if (!grouped.has(partLabel)) {
      grouped.set(partLabel, new Set());
    }
    const bucket = grouped.get(partLabel);
    normalizedList.forEach((item) => bucket.add(item));
  });

  if (!grouped.size) {
    const fallbackList = selectChineseCandidates(
      translationAlternatives.length ? translationAlternatives : translationText ? [translationText] : [],
      translationText
    );
    if (fallbackList.length) {
      return [
        {
          partOfSpeech: "",
          meaning: "",
          translation: fallbackList[0],
          translations: fallbackList,
          example: "",
          synonyms: []
        }
      ];
    }
    return [];
  }

  const definitions = Array.from(grouped.entries())
    .map(([part, values]) => {
      const translationsList = Array.from(values);
      console.info("[WordMate] definition entry", { part, translationsList });
      return {
        partOfSpeech: part,
        meaning: "",
        translation: translationsList[0] || "",
        translations: translationsList,
        example: "",
        synonyms: []
      };
    })
    .filter((item) => item.translations.length);

  console.info("[WordMate] definitions result", definitions);
  return definitions;
}

function buildExamples(dictionary, translation, context) {
  const examples = collectDictionaryExamples(dictionary);
  if (!examples.length && context) {
    examples.push({
      en: context,
      zh: sanitizeTranslationValue(translation?.contextTranslation || ""),
      audio: ""
    });
  }
  return examples;
}

function collectDictionaryExamples(dictionary) {
  if (!dictionary?.meanings?.length) {
    return [];
  }
  const seen = new Set();
  const examples = [];
  dictionary.meanings.forEach((meaning) => {
    (meaning.definitions || []).forEach((definition) => {
      const example = coerceString(definition.example);
      if (!example) {
        return;
      }
      const key = example.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      examples.push({ en: example, zh: "", audio: "" });
    });
  });
  return examples.slice(0, 5);
}

function buildPhonetics(dictionary) {
  const items = [];
  let primary = "";
  if (dictionary?.phonetics?.length) {
    dictionary.phonetics.forEach((item) => {
      if (!item) {
        return;
      }
      const text = coerceString(item.text);
      const audio = coerceString(item.audio);
      const source = coerceString(item.sourceUrl || item.source || "");
      if (!text && !audio) {
        return;
      }
      if (!primary && text) {
        primary = text;
      }
      items.push({
        text,
        audio,
        source
      });
    });
  }

  const display = items
    .map((item, index) => {
      if (!item.text) {
        return "";
      }
      const label = index === 0 ? "\u97f3\u6807" : `\u97f3\u6807${index + 1}`;
      return `${label}: ${item.text}`;
    })
    .filter(Boolean)
    .join("\n");

  return {
    items,
    display,
    primary
  };
}

function buildTranslationMap(entries = [], fallbackList = []) {
  const map = new Map();
  if (Array.isArray(entries)) {
    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const partKey = normalizePartOfSpeech(entry.partOfSpeech);
      if (!partKey) {
        return;
      }
      const translations = Array.isArray(entry.translations)
        ? dedupeStrings(entry.translations.map(sanitizeTranslationValue).filter(Boolean))
        : [];
      if (!translations.length) {
        return;
      }
      map.set(partKey, translations);
    });
  }

  if (!map.size && fallbackList.length) {
    map.set("default", dedupeStrings(fallbackList));
  } else if (fallbackList.length) {
    const merged = dedupeStrings([...(map.get("default") || []), ...fallbackList]);
    if (merged.length) {
      map.set("default", merged);
    }
  }

  return map;
}

function emptyTranslation() {
  return { primary: "", translations: [], dictionary: [] };
}

function normalizePartOfSpeech(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function sanitizeTranslationValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  const stripped = value.replace(/[\u0000-\u001f\u200b-\u200d\ufeff]/g, "").trim();
  if (!stripped) {
    return "";
  }
  const normalized = stripped.replace(/\s+/g, " ");
  const checkBase = normalized.replace(/[\u3001\u3002\uff0c\uff1b\uff1a\uff0f,;\\ufffd\\ufffd\\ufffd\\ufffd\s]/g, "");
  if (/^[-_=#0-9.]+$/.test(checkBase)) {
    return "";
  }
  return normalized;
}

function containsChinese(text = "") {
  return /[\u4e00-\u9fff]/.test(text);
}

function selectChineseCandidates(values = [], fallback = "") {
  const collected = [];
  values.forEach((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) {
      return;
    }
    const segments = splitChineseSegments(text);
    if (segments.length) {
      segments.forEach((segment) => collected.push(segment));
    } else {
      collected.push(text);
    }
  });

  const unique = dedupeStrings(collected);
  const chinese = unique.filter((item) => containsChinese(item));
  if (chinese.length) {
    return chinese;
  }

  if (fallback) {
    const fallbackSegments = splitChineseSegments(fallback);
    if (fallbackSegments.length) {
      return dedupeStrings(fallbackSegments);
    }
    if (containsChinese(fallback)) {
      return [fallback];
    }
  }

  return unique;
}

function splitChineseSegments(text) {
  return String(text)
    .split(/[\u3001\u3002\uff0c\uff1b\uff1a\uff0f,;\\ufffd\\ufffd\\ufffd\\ufffd\/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function sanitizeSynonyms(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  const filtered = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value && !/[0-9_]/.test(value));
  return dedupeStrings(filtered);
}

function dedupeStrings(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    if (typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(trimmed);
  });
  return result;
}

function buildFallbackAudioUrl(word) {
  return `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`;
}

function selectPreferredAudio(dictionary) {
  if (!dictionary || !dictionary.phonetics) return "";
  const entry = dictionary.phonetics.find((item) => item.audio);
  return entry ? entry.audio : "";
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
      .join("");
  }
  if (value == null) {
    return "";
  }
  return String(value);
}











