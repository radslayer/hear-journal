// YouVersion USFM book codes
export const BOOK_USFM = {
  "genesis": "GEN", "exodus": "EXO", "leviticus": "LEV", "numbers": "NUM",
  "deuteronomy": "DEU", "joshua": "JOS", "judges": "JDG", "ruth": "RUT",
  "1 samuel": "1SA", "2 samuel": "2SA", "1 kings": "1KI", "2 kings": "2KI",
  "1 chronicles": "1CH", "2 chronicles": "2CH", "ezra": "EZR", "nehemiah": "NEH",
  "esther": "EST", "job": "JOB", "psalms": "PSA", "psalm": "PSA",
  "proverbs": "PRO", "ecclesiastes": "ECC", "song of solomon": "SNG",
  "song of songs": "SNG", "isaiah": "ISA", "jeremiah": "JER",
  "lamentations": "LAM", "ezekiel": "EZK", "daniel": "DAN", "hosea": "HOS",
  "joel": "JOL", "amos": "AMO", "obadiah": "OBA", "jonah": "JON",
  "micah": "MIC", "nahum": "NAM", "habakkuk": "HAB", "zephaniah": "ZEP",
  "haggai": "HAG", "zechariah": "ZEC", "malachi": "MAL",
  "matthew": "MAT", "mark": "MRK", "luke": "LUK", "john": "JHN",
  "acts": "ACT", "romans": "ROM", "1 corinthians": "1CO", "2 corinthians": "2CO",
  "galatians": "GAL", "ephesians": "EPH", "philippians": "PHP",
  "colossians": "COL", "1 thessalonians": "1TH", "2 thessalonians": "2TH",
  "1 timothy": "1TI", "2 timothy": "2TI", "titus": "TIT", "philemon": "PHM",
  "hebrews": "HEB", "james": "JAS", "1 peter": "1PE", "2 peter": "2PE",
  "1 john": "1JN", "2 john": "2JN", "3 john": "3JN", "jude": "JUD",
  "revelation": "REV",
};

export function toUSFM(reference) {
  const ref = reference.trim().toLowerCase();
  let bookName = null;
  let rest = "";
  const sorted = Object.keys(BOOK_USFM).sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (ref.startsWith(name)) {
      bookName = name;
      rest = ref.slice(name.length).trim();
      break;
    }
  }
  if (!bookName) return null;
  const code = BOOK_USFM[bookName];
  const match = rest.match(/^(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!match) return null;
  const chapter = match[1];
  const verse = match[2];
  const endVerse = match[3];
  if (!verse) return `${code}.${chapter}`;
  if (!endVerse) return `${code}.${chapter}.${verse}`;
  return `${code}.${chapter}.${verse}-${code}.${chapter}.${endVerse}`;
}

export const YV_TRANSLATIONS = [
  { id: 111,  label: "NIV" },
  { id: 1713, label: "CSB" },
  { id: 59,   label: "ESV" },
  { id: 3034, label: "NLT" },
  { id: 1,    label: "KJV" },
  { id: 114,  label: "NKJV" },
  { id: 100,  label: "NASB" },
  { id: 97,   label: "MSG" },
];

export const FALLBACK_TRANSLATIONS = [
  { id: "web", label: "WEB" },
  { id: "asv", label: "ASV" },
];

const YV_APP_KEY = "pefmsGP4jhN0KAGi0QuAQDBoDtLZgcAPlLzDK0yRyO5bttUl";
const YV_BASE = "https://api.youversion.com/v1";
const BIBLE_API_BASE = "https://bible-api.com";

function stripHTML(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}


const NOT_AVAILABLE = "That verse is not available in that translation from YouVersion at this time.\n\nYou can cut/paste your favorite version here, or use one of those licensed by YouVersion for this application.";

export async function fetchVerse(reference, translationId) {
  const isYV = typeof translationId === "number";

  if (isYV) {
    const usfm = toUSFM(reference);
    if (!usfm) throw new Error("Could not parse reference. Try: John 3:16 or Romans 8:28");
    const url = `${YV_BASE}/bibles/${translationId}/passages/${usfm}`;
    const res = await fetch(url, {
      headers: { "X-YVP-App-Key": YV_APP_KEY },
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error("API key error. Please check your YouVersion credentials.");
      throw new Error(NOT_AVAILABLE);
    }
    const data = await res.json();
    const raw = data?.data?.content || data?.content || "";
    const text = stripHTML(raw);
    if (!text) throw new Error(NOT_AVAILABLE);
    return text;
  } else {
    const ref = encodeURIComponent(reference.trim());
    const res = await fetch(`${BIBLE_API_BASE}/${ref}?translation=${translationId}`);
    if (!res.ok) throw new Error("Verse not found. Try: John 3:16 or Romans 8:28");
    const data = await res.json();
    return data.text?.trim() || "";
  }
}