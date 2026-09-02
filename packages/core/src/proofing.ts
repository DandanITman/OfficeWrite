/**
 * Proofing rules: the parts of a spelling, grammar and AutoCorrect
 * behaviour that are pure string work.
 *
 * Keeping them here rather than inside the editor extension means they can be
 * unit tested without a ProseMirror document, and reused by both the
 * as-you-type checker and the Editor pane.
 */

/**
 * AutoCorrect's replacement table, trimmed to the entries that fire in ordinary
 * English writing. A commercial checker ships thousands; these are the ones a user actually
 * notices missing.
 */
export const AUTOCORRECT_REPLACEMENTS: Record<string, string> = {
  abbout: 'about',
  accross: 'across',
  acheive: 'achieve',
  adn: 'and',
  agian: 'again',
  alot: 'a lot',
  allready: 'already',
  arent: "aren't",
  becuase: 'because',
  beleive: 'believe',
  calender: 'calendar',
  cant: "can't",
  comming: 'coming',
  definately: 'definitely',
  didnt: "didn't",
  doesnt: "doesn't",
  dont: "don't",
  embarass: 'embarrass',
  enviroment: 'environment',
  existance: 'existence',
  familar: 'familiar',
  finaly: 'finally',
  foriegn: 'foreign',
  freind: 'friend',
  goverment: 'government',
  grammer: 'grammar',
  happend: 'happened',
  hte: 'the',
  immediatly: 'immediately',
  independant: 'independent',
  isnt: "isn't",
  ive: "I've",
  knowlege: 'knowledge',
  liason: 'liaison',
  maintainance: 'maintenance',
  neccessary: 'necessary',
  noticable: 'noticeable',
  occassion: 'occasion',
  occured: 'occurred',
  paralell: 'parallel',
  persistant: 'persistent',
  posession: 'possession',
  prefered: 'preferred',
  publically: 'publicly',
  recieve: 'receive',
  recomend: 'recommend',
  refered: 'referred',
  relevent: 'relevant',
  rember: 'remember',
  seperate: 'separate',
  succesful: 'successful',
  taht: 'that',
  teh: 'the',
  thier: 'their',
  theyre: "they're",
  tommorow: 'tomorrow',
  truely: 'truly',
  untill: 'until',
  usualy: 'usually',
  wasnt: "wasn't",
  wich: 'which',
  wierd: 'weird',
  wiht: 'with',
  wont: "won't",
  writting: 'writing',
  yeild: 'yield',
  youre: "you're",
};

function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * The AutoCorrect replacement for a just-finished word, or null.
 *
 * Case follows the typed word, so "Teh" becomes "The" and "TEH" becomes "THE",
 * as expected. Replacements that are themselves capitalised ("I've") keep
 * their own capitalisation.
 */
export function autoCorrectWord(word: string): string | null {
  const lower = word.toLowerCase();
  const replacement = AUTOCORRECT_REPLACEMENTS[lower];
  if (!replacement) return null;
  if (replacement[0] === replacement[0].toUpperCase() && /[a-z]/.test(replacement)) {
    return replacement;
  }
  const corrected = matchCase(word, replacement);
  return corrected === word ? null : corrected;
}

/** "TWo" → "Two": AutoCorrect's "Correct TWo INitial CApitals" rule. */
export function fixTwoInitialCapitals(word: string): string | null {
  if (!/^[A-Z]{2}[a-z]+$/.test(word)) return null;
  return word[0] + word[1].toLowerCase() + word.slice(2);
}

/** A standalone lowercase "i" becomes "I". */
export function fixLoneI(word: string): string | null {
  return word === 'i' ? 'I' : null;
}

/**
 * The AutoFormat replacements applied to punctuation as you type:
 * en/em dashes, ellipses and a few arrows and fractions.
 */
export const AUTOFORMAT_SYMBOLS: Array<{ from: string; to: string }> = [
  { from: '--', to: '—' },
  { from: '...', to: '…' },
  { from: '-->', to: '→' },
  { from: '<--', to: '←' },
  { from: '(c)', to: '©' },
  { from: '(r)', to: '®' },
  { from: '(tm)', to: '™' },
  { from: '1/2', to: '½' },
  { from: '1/4', to: '¼' },
  { from: '3/4', to: '¾' },
];

/**
 * Which curly quote a straight quote should become, given the character before
 * it. An opening quote follows nothing, whitespace or an opening bracket.
 */
export function smartQuote(quote: '"' | "'", previousChar: string): string {
  const opening = previousChar === '' || /[\s([{“‘—–-]/.test(previousChar);
  if (quote === '"') return opening ? '“' : '”';
  return opening ? '‘' : '’';
}

export type ProofingIssueKind = 'spelling' | 'grammar';

export interface ProofingIssue {
  /** Offset into the checked text, not into the document. */
  from: number;
  to: number;
  kind: ProofingIssueKind;
  /** The flagged text, so callers can show it without re-slicing. */
  text: string;
  message: string;
  suggestions: string[];
  rule: string;
}

/** Phrases that are simply wrong, with the correction offered. */
const PHRASE_RULES: Array<{ pattern: RegExp; message: string; fix: (match: string) => string; rule: string }> = [
  {
    pattern: /\b(should|could|would|must|might)\s+of\b/gi,
    message: 'Use "have" rather than "of" after a modal verb.',
    fix: (match) => match.replace(/of$/i, 'have'),
    rule: 'modal-of',
  },
  {
    pattern: /\birregardless\b/gi,
    message: '"Irregardless" is not standard; use "regardless".',
    fix: (match) => matchCase(match, 'regardless'),
    rule: 'irregardless',
  },
  {
    pattern: /\bfor all intensive purposes\b/gi,
    message: 'The phrase is "for all intents and purposes".',
    fix: () => 'for all intents and purposes',
    rule: 'intents-purposes',
  },
  {
    pattern: /\bless\s+(people|items|things|files|words|pages)\b/gi,
    message: 'Use "fewer" with things you can count.',
    fix: (match) => match.replace(/^less/i, 'fewer'),
    rule: 'fewer-less',
  },
  {
    pattern: /\bthere\s+(is|was)\s+(many|several|few|two|three|both)\b/gi,
    message: 'Plural subject: use "there are" or "there were".',
    fix: (match) => match.replace(/\bis\b/i, 'are').replace(/\bwas\b/i, 'were'),
    rule: 'there-agreement',
  },
];

const VOWEL_SOUND_EXCEPTIONS = new Set(['one', 'once', 'university', 'universal', 'unique', 'user', 'union', 'european', 'ubiquitous']);
const CONSONANT_SOUND_EXCEPTIONS = new Set(['hour', 'honest', 'honour', 'honor', 'heir', 'mba', 'fbi', 'hr']);

function startsWithVowelSound(word: string): boolean {
  const lower = word.toLowerCase();
  if (CONSONANT_SOUND_EXCEPTIONS.has(lower)) return true;
  if (VOWEL_SOUND_EXCEPTIONS.has(lower)) return false;
  return /^[aeiou]/.test(lower);
}

/**
 * Grammar and style problems in a block of text.
 *
 * Offsets are relative to `text`. Every rule here is deliberately conservative:
 * a checker that cries wolf gets switched off, so anything ambiguous (its/it's,
 * their/there in general position, passive voice) is left alone.
 */
export function checkGrammar(text: string): ProofingIssue[] {
  const issues: ProofingIssue[] = [];
  const push = (issue: ProofingIssue) => {
    if (issue.to > issue.from) issues.push(issue);
  };

  // Repeated word: "the the".
  const repeated = /\b(\p{L}{2,})(\s+)\1\b/giu;
  for (let m = repeated.exec(text); m; m = repeated.exec(text)) {
    push({
      from: m.index,
      to: m.index + m[0].length,
      kind: 'grammar',
      text: m[0],
      message: `Repeated word: "${m[1]}".`,
      suggestions: [m[1]],
      rule: 'repeated-word',
    });
  }

  // Two or more spaces between words.
  const doubleSpace = /(\S) {2,}(?=\S)/g;
  for (let m = doubleSpace.exec(text); m; m = doubleSpace.exec(text)) {
    push({
      from: m.index + 1,
      to: m.index + m[0].length,
      kind: 'grammar',
      text: m[0].slice(1),
      message: 'Extra space between words.',
      suggestions: [' '],
      rule: 'double-space',
    });
  }

  // Space before a comma, full stop or other closing punctuation.
  const spaceBeforePunct = / +([,.;:!?])/g;
  for (let m = spaceBeforePunct.exec(text); m; m = spaceBeforePunct.exec(text)) {
    push({
      from: m.index,
      to: m.index + m[0].length,
      kind: 'grammar',
      text: m[0],
      message: 'Remove the space before the punctuation mark.',
      suggestions: [m[1]],
      rule: 'space-before-punctuation',
    });
  }

  // Missing space after a comma or full stop, ignoring decimals and initials.
  const missingSpace = /([,;:])(?=\p{L})|(\.)(?=\p{Lu}\p{Ll})/gu;
  for (let m = missingSpace.exec(text); m; m = missingSpace.exec(text)) {
    const mark = m[1] ?? m[2];
    push({
      from: m.index,
      to: m.index + 1,
      kind: 'grammar',
      text: mark,
      message: 'Add a space after the punctuation mark.',
      suggestions: [`${mark} `],
      rule: 'missing-space',
    });
  }

  // "a apple" / "an book".
  const article = /\b(a|an|A|An)\s+(\p{L}+)/gu;
  for (let m = article.exec(text); m; m = article.exec(text)) {
    const isAn = m[1].toLowerCase() === 'an';
    const needsAn = startsWithVowelSound(m[2]);
    if (isAn === needsAn) continue;
    const replacement = matchCase(m[1], needsAn ? 'an' : 'a');
    push({
      from: m.index,
      to: m.index + m[1].length,
      kind: 'grammar',
      text: m[1],
      message: `Use "${replacement}" before "${m[2]}".`,
      suggestions: [replacement],
      rule: 'article-agreement',
    });
  }

  // A sentence that starts lowercase.
  const sentenceStart = /(^|[.!?]["'”’)]?\s+)(\p{Ll})/gu;
  for (let m = sentenceStart.exec(text); m; m = sentenceStart.exec(text)) {
    const at = m.index + m[1].length;
    push({
      from: at,
      to: at + 1,
      kind: 'grammar',
      text: m[2],
      message: 'Start the sentence with a capital letter.',
      suggestions: [m[2].toUpperCase()],
      rule: 'sentence-capital',
    });
  }

  for (const rule of PHRASE_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      push({
        from: m.index,
        to: m.index + m[0].length,
        kind: 'grammar',
        text: m[0],
        message: rule.message,
        suggestions: [rule.fix(m[0])],
        rule: rule.rule,
      });
    }
  }

  // Keep the leftmost issue when two rules overlap, so the underline and the
  // Editor pane agree on what is being reported.
  const ordered = issues.sort((a, b) => a.from - b.from || b.to - a.to);
  const kept: ProofingIssue[] = [];
  for (const issue of ordered) {
    if (kept.some((existing) => issue.from < existing.to && existing.from < issue.to)) continue;
    kept.push(issue);
  }
  return kept;
}

/** Readability statistics, as the Word Count and readability panel show. */
export interface ReadabilityStats {
  words: number;
  sentences: number;
  syllables: number;
  /** Flesch Reading Ease, 0–100, higher is easier. */
  readingEase: number;
  /** Flesch–Kincaid US school grade level. */
  gradeLevel: number;
}

function countSyllables(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!lower) return 0;
  if (lower.length <= 3) return 1;
  const groups = lower
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

export function readabilityStats(text: string): ReadabilityStats {
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0).length;
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);

  if (!words.length || !sentences) {
    return { words: words.length, sentences, syllables, readingEase: 0, gradeLevel: 0 };
  }

  const wordsPerSentence = words.length / sentences;
  const syllablesPerWord = syllables / words.length;
  const readingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const gradeLevel = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;

  return {
    words: words.length,
    sentences,
    syllables,
    readingEase: Math.max(0, Math.min(100, Math.round(readingEase * 10) / 10)),
    gradeLevel: Math.max(0, Math.round(gradeLevel * 10) / 10),
  };
}
