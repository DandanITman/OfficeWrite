import { describe, expect, it } from 'vitest';
import { checkAccessibility } from './accessibility';
import { contrastRatio, parseColor, relativeLuminance } from './contrast';

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const text = (value: string, marks?: unknown[]) => ({ type: 'text', text: value, marks });

const rules = (result: ReturnType<typeof checkAccessibility>) => result.map((issue) => issue.rule);

describe('contrast', () => {
  it('parses the three colour notations the editor emits', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#ff8800')).toEqual([255, 136, 0]);
    expect(parseColor('rgb(18, 52, 86)')).toEqual([18, 52, 86]);
  });

  it('rejects anything it cannot read rather than guessing', () => {
    expect(parseColor('rebeccapurple')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
    expect(parseColor('')).toBeNull();
  });

  it('puts black and white at the ends of the scale', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('is symmetric, so argument order cannot change the verdict', () => {
    expect(contrastRatio('#336699', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#336699') as number,
      10,
    );
  });
});

describe('checkAccessibility', () => {
  it('finds nothing wrong with a plain document', () => {
    expect(checkAccessibility(doc(para(text('Hello'))))).toEqual([]);
  });

  it('flags a picture with no alt text, and clears once it has some', () => {
    const missing = doc({ type: 'image', attrs: { src: 'x.png', alt: '' } });
    expect(rules(checkAccessibility(missing))).toContain('image-alt');

    const described = doc({ type: 'image', attrs: { src: 'x.png', alt: 'A bar chart' } });
    expect(rules(checkAccessibility(described))).not.toContain('image-alt');
  });

  it('flags a table with no header row', () => {
    const table = doc({
      type: 'table',
      content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [para(text('a'))] }] }],
    });
    expect(rules(checkAccessibility(table))).toContain('table-header');
  });

  it('accepts a table whose first row is headers', () => {
    const table = doc({
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [para(text('Name'))] }] },
      ],
    });
    expect(rules(checkAccessibility(table))).not.toContain('table-header');
  });

  it('flags merged cells, which break the row and column relationship', () => {
    const table = doc({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [{ type: 'tableHeader', attrs: { colspan: 2 }, content: [para(text('Both'))] }],
        },
      ],
    });
    expect(rules(checkAccessibility(table))).toContain('table-merged');
  });

  it('flags a skipped heading level but allows going back up', () => {
    const skipped = doc(
      { type: 'heading', attrs: { level: 1 }, content: [text('Title')] },
      { type: 'heading', attrs: { level: 3 }, content: [text('Too deep')] },
    );
    expect(rules(checkAccessibility(skipped))).toContain('heading-skip');

    // 1 -> 2 -> 1 is a normal outline, not a skip.
    const fine = doc(
      { type: 'heading', attrs: { level: 1 }, content: [text('One')] },
      { type: 'heading', attrs: { level: 2 }, content: [text('Two')] },
      { type: 'heading', attrs: { level: 1 }, content: [text('Back')] },
    );
    expect(rules(checkAccessibility(fine))).not.toContain('heading-skip');
  });

  it('flags link text that describes nothing, and accepts text that does', () => {
    const link = (label: string) =>
      doc(para(text(label, [{ type: 'link', attrs: { href: 'https://example.com' } }])));

    expect(rules(checkAccessibility(link('click here')))).toContain('link-text');
    // Trailing punctuation and casing must not smuggle it past the check.
    expect(rules(checkAccessibility(link('Click Here.')))).toContain('link-text');
    expect(rules(checkAccessibility(link('the release notes')))).not.toContain('link-text');
  });

  it('flags low-contrast text against the page, and passes readable text', () => {
    const coloured = (color: string) => doc(para(text('faint', [{ type: 'textStyle', attrs: { color } }])));

    expect(rules(checkAccessibility(coloured('#f2f0a0')))).toContain('contrast');
    expect(rules(checkAccessibility(coloured('#222222')))).not.toContain('contrast');
  });

  it('measures against the page colour when one is set', () => {
    const white = doc(para(text('x', [{ type: 'textStyle', attrs: { color: '#ffffff' } }])));
    // White on white is unreadable; white on near-black is fine.
    expect(rules(checkAccessibility(white, '#ffffff'))).toContain('contrast');
    expect(rules(checkAccessibility(white, '#111111'))).not.toContain('contrast');
  });

  it('gives every issue a stable id and a fix', () => {
    const issues = checkAccessibility(doc({ type: 'image', attrs: { src: 'x.png', alt: '' } }));
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe(`${issues[0].rule}:${issues[0].pos}`);
    expect(issues[0].fix.length).toBeGreaterThan(0);
  });

  it('survives an empty or malformed document', () => {
    expect(checkAccessibility(null)).toEqual([]);
    expect(checkAccessibility({})).toEqual([]);
    expect(checkAccessibility(doc())).toEqual([]);
  });
});
