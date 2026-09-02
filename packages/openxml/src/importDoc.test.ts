import { describe, expect, it } from 'vitest';
import { importFromDocText } from './importDoc';

describe('importFromDocText', () => {
  it('converts paragraph text to TipTap doc', () => {
    const doc = importFromDocText('First paragraph.\n\nSecond paragraph.');
    expect(doc.type).toBe('doc');
    expect(doc.content).toHaveLength(2);
    expect(doc.content?.[0].content?.[0].text).toBe('First paragraph.');
  });
});
