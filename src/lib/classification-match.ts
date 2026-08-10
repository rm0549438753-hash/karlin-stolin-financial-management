/**
 * Text-matching helpers for classification rules.
 *
 * Lives in a browser-safe module (not *.server.ts) because both the rules
 * engine and the settings UI need to agree on how a rule's word list is read.
 */

/**
 * A rule's `match_text` holds a comma-separated list of terms; the rule matches
 * when ANY of them matches. Newlines and semicolons work as separators too, so
 * a pasted list is fine.
 */
export function splitTerms(matchText: string | null | undefined): string[] {
  return (matchText ?? "")
    .split(/[,\n;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Split free text into words, treating any non letter/digit as a separator. */
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

const HEBREW = /[\u0590-\u05FF]/;
// Single-letter prefixes (ה, ו, ב, ל, מ, כ, ש) plus the common combinations.
const HE_PREFIXES = ["כשה", "ולה", "מה", "שה", "וה", "בה", "לה", "כה", "כש", "ול", "וב", "ומ", "ה", "ו", "ב", "ל", "מ", "כ", "ש"];
// Feminine / plural endings, longest first.
const HE_SUFFIXES = ["ותיהם", "ותיו", "ויות", "ניות", "יות", "ות", "ים", "יה", "ה", "ת", "י", "ן"];

/**
 * Reduce a word to a rough stem so inflections collapse together:
 * עמלה / עמלת / עמלות / העמלה / ועמלות all reduce to "עמל".
 * Deliberately shallow — a matching aid, not a morphological analyser.
 */
function stem(word: string): string {
  let w = word;
  if (!HEBREW.test(w)) {
    return w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
  }
  for (const p of HE_PREFIXES) {
    if (w.length - p.length >= 3 && w.startsWith(p)) {
      w = w.slice(p.length);
      break;
    }
  }
  for (const s of HE_SUFFIXES) {
    if (w.length - s.length >= 2 && w.endsWith(s)) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  return w;
}

/** Does a single term match this field value, under the rule's options? */
export function termMatchesField(
  term: string,
  value: string,
  wholeWord: boolean,
  smart: boolean,
): boolean {
  if (!value) return false;
  const haystack = value.toLowerCase();

  // Legacy behaviour: a rule that isn't set to whole-word is a free substring match.
  if (!wholeWord && haystack.includes(term)) return true;

  const tokens = tokenize(haystack);
  const termTokens = tokenize(term);
  if (termTokens.length === 0) return false;

  // A multi-word term ("עמלת ניהול") must appear as a consecutive run of words.
  const runMatches = (compare: (a: string, b: string) => boolean) => {
    for (let i = 0; i + termTokens.length <= tokens.length; i++) {
      if (termTokens.every((tt, j) => compare(tokens[i + j]!, tt))) return true;
    }
    return false;
  };

  if (runMatches((a, b) => a === b)) return true;
  if (!smart) return false;

  return runMatches((a, b) => {
    const sa = stem(a);
    const sb = stem(b);
    if (sa === sb) return true;
    // Allow one to be a longer form of the other, e.g. "עמל" vs "עמלת".
    return sb.length >= 3 && (sa.startsWith(sb) || sb.startsWith(sa));
  });
}
