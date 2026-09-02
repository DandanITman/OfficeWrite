export type TipTapNode = {
  type?: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};

type Token =
  | { kind: 'groupStart' }
  | { kind: 'groupEnd' }
  | { kind: 'control'; word: string; param?: number }
  | { kind: 'text'; text: string };

/**
 * Tokenise RTF into groups, control words and literal text.
 *
 * The previous importer ran `text.replace(/\\[a-z]+\d* ?/gi, '')` over the
 * whole file, which discarded every control word - so bold, italic,
 * alignment, headings and colours were lost and every RTF opened as
 * unformatted paragraphs.
 */
function tokenize(rtf: string): Token[] {
  const tokens: Token[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      tokens.push({ kind: 'text', text: buffer });
      buffer = '';
    }
  };

  for (let i = 0; i < rtf.length; i += 1) {
    const ch = rtf[i];

    if (ch === '{') {
      flush();
      tokens.push({ kind: 'groupStart' });
      continue;
    }
    if (ch === '}') {
      flush();
      tokens.push({ kind: 'groupEnd' });
      continue;
    }
    if (ch === '\r' || ch === '\n') continue;

    if (ch !== '\\') {
      buffer += ch;
      continue;
    }

    // Escape sequence or control word.
    const next = rtf[i + 1];
    if (next === undefined) break;

    if (next === '\\' || next === '{' || next === '}') {
      buffer += next;
      i += 1;
      continue;
    }

    if (next === "'") {
      // \'hh - a byte in the current code page.
      const hex = rtf.slice(i + 2, i + 4);
      const code = parseInt(hex, 16);
      if (Number.isFinite(code)) buffer += String.fromCharCode(code);
      i += 3;
      continue;
    }

    if (!/[a-zA-Z]/.test(next)) {
      // Control symbol such as \* or \~.
      flush();
      tokens.push({ kind: 'control', word: next });
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < rtf.length && /[a-zA-Z]/.test(rtf[j])) j += 1;
    const word = rtf.slice(i + 1, j);

    let param: number | undefined;
    let k = j;
    if (rtf[k] === '-' || /\d/.test(rtf[k] ?? '')) {
      let numStart = k;
      if (rtf[k] === '-') k += 1;
      while (k < rtf.length && /\d/.test(rtf[k])) k += 1;
      param = Number(rtf.slice(numStart, k));
    }
    // A single trailing space is a delimiter, not content.
    if (rtf[k] === ' ') k += 1;

    flush();
    tokens.push({ kind: 'control', word, param });
    i = k - 1;
  }

  flush();
  return tokens;
}

interface CharState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  superscript: boolean;
  subscript: boolean;
  fontSize?: number;
  colorIndex?: number;
  fontIndex?: number;
}

interface ParaState {
  align?: string;
  indentLevel?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  headingLevel?: number;
}

const DEFAULT_CHAR: CharState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  superscript: false,
  subscript: false,
};

/** Groups that carry metadata rather than document body text. */
const SKIPPED_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'header',
  'footer',
  'footnote',
  'xmlns',
  'themedata',
  'colorschememapping',
  'latentstyles',
  'listtable',
  'listoverridetable',
  'generator',
  'datastore',
]);

function marksFor(state: CharState, colors: string[], fonts: string[]) {
  const marks: Array<{ type: string; attrs?: Record<string, unknown> }> = [];
  if (state.bold) marks.push({ type: 'bold' });
  if (state.italic) marks.push({ type: 'italic' });
  if (state.underline) marks.push({ type: 'underline' });
  if (state.strike) marks.push({ type: 'strike' });
  if (state.superscript) marks.push({ type: 'superscript' });
  if (state.subscript) marks.push({ type: 'subscript' });

  const textStyle: Record<string, unknown> = {};
  if (state.fontSize) textStyle.fontSize = `${state.fontSize}pt`;
  if (state.colorIndex !== undefined && colors[state.colorIndex]) {
    textStyle.color = colors[state.colorIndex];
  }
  if (state.fontIndex !== undefined && fonts[state.fontIndex]) {
    textStyle.fontFamily = fonts[state.fontIndex];
  }
  if (Object.keys(textStyle).length) marks.push({ type: 'textStyle', attrs: textStyle });

  return marks;
}

/**
 * Parse an RTF document into the editor's document model, preserving character
 * and paragraph formatting.
 */
export function importFromRtf(rtf: string): TipTapNode {
  const tokens = tokenize(rtf);

  const content: TipTapNode[] = [];
  let inline: TipTapNode[] = [];

  const charStack: CharState[] = [{ ...DEFAULT_CHAR }];
  const paraStack: ParaState[] = [{}];
  // Depth at which a skipped destination started, or null when emitting.
  let skipDepth: number | null = null;
  let depth = 0;
  let pendingUnicodeSkip = 0;

  const colors: string[] = [];
  const fonts: string[] = [];
  // Depth at which each table group opened, mirroring skipDepth. Comparing
  // against a fixed depth of 1 left the tables "open" for the rest of the
  // document, so every following run was swallowed as table content.
  let colorTableDepth: number | null = null;
  let fontTableDepth: number | null = null;
  let pendingColor: { r?: number; g?: number; b?: number } = {};
  let fontBuffer = '';
  let fontIndex: number | null = null;

  const charState = () => charStack[charStack.length - 1];
  const paraState = () => paraStack[paraStack.length - 1];

  const pushText = (text: string) => {
    if (!text) return;
    const marks = marksFor(charState(), colors, fonts);
    inline.push({ type: 'text', text, marks: marks.length ? marks : undefined });
  };

  const endParagraph = () => {
    const p = paraState();
    const attrs: Record<string, unknown> = {};
    if (p.align) attrs.textAlign = p.align;
    if (p.indentLevel) attrs.indentLevel = p.indentLevel;
    if (p.spaceBefore) attrs.spaceBefore = p.spaceBefore;
    if (p.spaceAfter) attrs.spaceAfter = p.spaceAfter;

    const nodeContent = inline.length ? inline : undefined;
    if (p.headingLevel) {
      content.push({
        type: 'heading',
        attrs: { ...attrs, level: Math.min(p.headingLevel, 3) },
        content: nodeContent,
      });
    } else {
      content.push({ type: 'paragraph', attrs, content: nodeContent });
    }
    inline = [];
  };

  for (const token of tokens) {
    if (token.kind === 'groupStart') {
      depth += 1;
      charStack.push({ ...charState() });
      paraStack.push({ ...paraState() });
      continue;
    }

    if (token.kind === 'groupEnd') {
      if (fontTableDepth !== null && fontIndex !== null) {
        fonts[fontIndex] = fontBuffer.replace(/;$/, '').trim();
        fontBuffer = '';
        fontIndex = null;
      }
      if (colorTableDepth !== null && depth <= colorTableDepth) colorTableDepth = null;
      if (fontTableDepth !== null && depth <= fontTableDepth) fontTableDepth = null;
      if (skipDepth !== null && depth <= skipDepth) skipDepth = null;
      depth -= 1;
      if (charStack.length > 1) charStack.pop();
      if (paraStack.length > 1) paraStack.pop();
      continue;
    }

    if (token.kind === 'text') {
      if (colorTableDepth !== null) continue;
      if (fontTableDepth !== null) {
        fontBuffer += token.text;
        continue;
      }
      if (skipDepth !== null) continue;
      if (pendingUnicodeSkip > 0) {
        const skip = Math.min(pendingUnicodeSkip, token.text.length);
        pendingUnicodeSkip -= skip;
        const rest = token.text.slice(skip);
        if (rest) pushText(rest);
        continue;
      }
      pushText(token.text);
      continue;
    }

    const { word, param } = token;

    // Destination control words.
    if (word === 'fonttbl') {
      fontTableDepth = depth;
      continue;
    }
    if (word === 'colortbl') {
      colorTableDepth = depth;
      // The leading ';' in a colour table denotes the "auto" entry at index 0.
      colors.push('');
      continue;
    }
    if (SKIPPED_DESTINATIONS.has(word)) {
      if (skipDepth === null) skipDepth = depth;
      continue;
    }
    if (word === '*') {
      // \*\destination - an ignorable destination.
      if (skipDepth === null) skipDepth = depth;
      continue;
    }

    if (colorTableDepth !== null) {
      if (word === 'red') pendingColor.r = param ?? 0;
      else if (word === 'green') pendingColor.g = param ?? 0;
      else if (word === 'blue') {
        pendingColor.b = param ?? 0;
        const hex = (n: number) => n.toString(16).padStart(2, '0');
        colors.push(`#${hex(pendingColor.r ?? 0)}${hex(pendingColor.g ?? 0)}${hex(pendingColor.b ?? 0)}`);
        pendingColor = {};
      }
      continue;
    }

    if (fontTableDepth !== null) {
      if (word === 'f') {
        if (fontIndex !== null) fonts[fontIndex] = fontBuffer.replace(/;$/, '').trim();
        fontIndex = param ?? 0;
        fontBuffer = '';
      }
      continue;
    }

    if (skipDepth !== null) continue;

    switch (word) {
      case 'par':
        endParagraph();
        break;
      case 'pard':
        paraStack[paraStack.length - 1] = {};
        break;
      case 'plain':
        charStack[charStack.length - 1] = { ...DEFAULT_CHAR };
        break;
      case 'page':
        if (inline.length) endParagraph();
        content.push({ type: 'pageBreak' });
        break;
      case 'line':
        inline.push({ type: 'hardBreak' });
        break;
      case 'tab':
        pushText('\t');
        break;

      case 'b':
        charState().bold = param !== 0;
        break;
      case 'i':
        charState().italic = param !== 0;
        break;
      case 'ul':
        charState().underline = param !== 0;
        break;
      case 'ulnone':
        charState().underline = false;
        break;
      case 'strike':
        charState().strike = param !== 0;
        break;
      case 'super':
        charState().superscript = param !== 0;
        break;
      case 'sub':
        charState().subscript = param !== 0;
        break;
      case 'nosupersub':
        charState().superscript = false;
        charState().subscript = false;
        break;
      case 'fs':
        // Half-points.
        charState().fontSize = param !== undefined ? param / 2 : undefined;
        break;
      case 'cf':
        charState().colorIndex = param;
        break;
      case 'f':
        charState().fontIndex = param;
        break;

      case 'ql':
        paraState().align = 'left';
        break;
      case 'qc':
        paraState().align = 'center';
        break;
      case 'qr':
        paraState().align = 'right';
        break;
      case 'qj':
        paraState().align = 'justify';
        break;
      case 'li':
        // Twips -> the editor's 36px indent steps.
        paraState().indentLevel = param ? Math.max(0, Math.round(param / 15 / 36)) : 0;
        break;
      case 'sb':
        paraState().spaceBefore = param ? Math.round(param / 15) : undefined;
        break;
      case 'sa':
        paraState().spaceAfter = param ? Math.round(param / 15) : undefined;
        break;
      case 'outlinelevel':
      case 'outlinelvl':
        if (param !== undefined) paraState().headingLevel = param + 1;
        break;
      case 's':
        // Style index; the exporter writes headings as \s1..\s3.
        if (param !== undefined && param >= 1 && param <= 6) paraState().headingLevel = param;
        break;

      case 'u': {
        // \uN with N as a signed 16-bit code point, followed by \ucM fallback
        // characters that must be skipped.
        if (param !== undefined) {
          const code = param < 0 ? param + 65536 : param;
          pushText(String.fromCharCode(code));
          pendingUnicodeSkip = 1;
        }
        break;
      }
      case 'uc':
        pendingUnicodeSkip = 0;
        break;

      default:
        break;
    }
  }

  if (inline.length) endParagraph();
  if (!content.length) content.push({ type: 'paragraph' });

  return { type: 'doc', content };
}
