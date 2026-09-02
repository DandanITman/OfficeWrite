import { describe, expect, it } from 'vitest';
import {
  autoCorrectWord,
  checkGrammar,
  fixTwoInitialCapitals,
  readabilityStats,
  smartQuote,
} from './proofing';

describe('AutoCorrect', () => {
  it('replaces a known typo and follows the typed capitalisation', () => {
    expect(autoCorrectWord('teh')).toBe('the');
    expect(autoCorrectWord('Teh')).toBe('The');
    expect(autoCorrectWord('TEH')).toBe('THE');
  });

  it('keeps a replacement that carries its own capitalisation', () => {
    expect(autoCorrectWord('ive')).toBe("I've");
  });

  it('leaves words it does not know alone', () => {
    expect(autoCorrectWord('the')).toBeNull();
    expect(autoCorrectWord('Officewrite')).toBeNull();
  });

  it('fixes two initial capitals', () => {
    expect(fixTwoInitialCapitals('THe')).toBe('The');
    // An all-caps acronym is not a mistake.
    expect(fixTwoInitialCapitals('PDF')).toBeNull();
  });

  it('chooses the opening or closing curly quote from the previous character', () => {
    expect(smartQuote('"', '')).toBe('“');
    expect(smartQuote('"', ' ')).toBe('“');
    expect(smartQuote('"', 'd')).toBe('”');
    expect(smartQuote("'", 'n')).toBe('’');
  });
});

describe('grammar rules', () => {
  const rules = (text: string) => checkGrammar(text).map((issue) => issue.rule);

  it('flags a repeated word and suggests dropping one', () => {
    const [issue] = checkGrammar('The the cat sat.');
    expect(issue.rule).toBe('repeated-word');
    expect(issue.suggestions).toEqual(['The']);
  });

  it('flags the wrong article', () => {
    const issue = checkGrammar('Eat a apple daily.').find((i) => i.rule === 'article-agreement');
    expect(issue?.suggestions).toEqual(['an']);
  });

  it('accepts an article that matches the following sound', () => {
    expect(rules('Eat an apple daily.')).not.toContain('article-agreement');
    expect(rules('It took an hour.')).not.toContain('article-agreement');
    expect(rules('She is a university lecturer.')).not.toContain('article-agreement');
  });

  it('flags "should of" and offers "should have"', () => {
    const issue = checkGrammar('We should of asked.').find((i) => i.rule === 'modal-of');
    expect(issue?.suggestions).toEqual(['should have']);
  });

  it('flags spacing mistakes', () => {
    expect(rules('Two  spaces here.')).toContain('double-space');
    expect(rules('A space before , the comma.')).toContain('space-before-punctuation');
    expect(rules('Missing,space here.')).toContain('missing-space');
  });

  it('flags a sentence that starts lowercase', () => {
    expect(rules('Done. now this.')).toContain('sentence-capital');
  });

  it('reports nothing for clean prose', () => {
    expect(checkGrammar('The quick brown fox jumps over the lazy dog.')).toEqual([]);
  });

  it('never returns overlapping ranges', () => {
    const issues = checkGrammar('the the  cat is a apple , really.');
    for (let i = 1; i < issues.length; i += 1) {
      expect(issues[i].from).toBeGreaterThanOrEqual(issues[i - 1].to);
    }
  });
});

describe('readability', () => {
  it('counts words and sentences', () => {
    const stats = readabilityStats('The cat sat on the mat. It slept.');
    expect(stats.words).toBe(8);
    expect(stats.sentences).toBe(2);
    expect(stats.readingEase).toBeGreaterThan(80);
  });

  it('returns zeroes for empty text rather than NaN', () => {
    expect(readabilityStats('   ')).toEqual({
      words: 0,
      sentences: 0,
      syllables: 0,
      readingEase: 0,
      gradeLevel: 0,
    });
  });
});
