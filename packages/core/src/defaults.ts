import type { AppSettings } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accentColor: '#2563eb',
  defaultSaveLocation: '',
  defaultFontFamily: 'Calibri',
  defaultFontSize: 11,
  autoSaveIntervalMs: 30000,
  spellCheckEnabled: true,
  language: 'en-US',
  authorName: 'You',
  grammarCheckEnabled: true,
  autoCorrectEnabled: true,
  showFormattingMarks: false,
  showRuler: true,
  recentEmoji: [],
};

/**
 * Templates are stored as TipTap document JSON, which is unreadable written out
 * by hand at this volume. The builders below cover the handful of node shapes
 * the catalogue needs. Every attribute they set - textAlign, styleId, shading,
 * spacing - is one the ParagraphFormatting extension already understands, so a
 * template only ever puts the document in a state the ribbon can also reach.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
type TextNode = { type: 'text'; text: string; marks?: Mark[] };
type Block = { type: string; attrs?: Record<string, unknown>; content?: unknown[] };

type ParagraphAttrs = {
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  styleId?: string;
  spaceBefore?: number;
  spaceAfter?: number;
  shading?: string;
  borderColor?: string;
  borderSides?: string;
  lineHeight?: string;
  indentLevel?: number;
};

/** A run of text, optionally bold, italic or underlined. */
function t(text: string, ...marks: Array<'bold' | 'italic' | 'underline'>): TextNode {
  if (marks.length === 0) return { type: 'text', text };
  return { type: 'text', text, marks: marks.map((type) => ({ type })) };
}

/**
 * A paragraph. Called with no text it is a blank line - which these templates
 * use in the conventional way, as the spacing between blocks.
 */
function p(text = '', attrs: ParagraphAttrs = {}): Block {
  const node: Block = { type: 'paragraph' };
  if (Object.keys(attrs).length > 0) node.attrs = attrs;
  if (text) node.content = [t(text)];
  return node;
}

/** A paragraph of mixed runs, for the label-then-blank lines these forms lean on. */
function rich(attrs: ParagraphAttrs, ...runs: TextNode[]): Block {
  const node: Block = { type: 'paragraph', content: runs };
  if (Object.keys(attrs).length > 0) node.attrs = attrs;
  return node;
}

function h(level: 1 | 2 | 3, text: string, attrs: ParagraphAttrs = {}): Block {
  return { type: 'heading', attrs: { level, ...attrs }, content: [t(text)] };
}

function items(type: 'bulletList' | 'orderedList', list: string[]): Block {
  return {
    type,
    content: list.map((text) => ({
      type: 'listItem',
      content: [p(text)],
    })),
  };
}

const ul = (...list: string[]) => items('bulletList', list);
const ol = (...list: string[]) => items('orderedList', list);

/** An unchecked checklist, the shape a task-list template opens in. */
function checklist(...list: string[]): Block {
  return {
    type: 'taskList',
    content: list.map((text) => ({
      type: 'taskItem',
      attrs: { checked: false },
      content: [p(text)],
    })),
  };
}

const hr = (): Block => ({ type: 'horizontalRule' });

/** A table with a header row. Cells hold a single paragraph. */
function table(header: string[], ...rows: string[][]): Block {
  const row = (cells: string[], cellType: 'tableHeader' | 'tableCell'): Block => ({
    type: 'tableRow',
    content: cells.map((text) => ({ type: cellType, content: [p(text)] })),
  });
  return {
    type: 'table',
    content: [row(header, 'tableHeader'), ...rows.map((cells) => row(cells, 'tableCell'))],
  };
}

/**
 * The categories the template gallery filters by. They mirror the buckets a
 * word processor's template picker is expected to have, so someone arriving
 * with "I need to write a cover letter" finds it without reading every card.
 */
export const TEMPLATE_CATEGORIES = [
  'Basic',
  'Business',
  'Resumes and Cover Letters',
  'Letters',
  'Education',
  'Flyers',
  'Cards',
  'Holiday',
  'Personal',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  /** Extra search terms, for words people type that the name does not contain. */
  keywords: string[];
  content: { type: 'doc'; content: Block[] };
}

const doc = (...content: Block[]) => ({ type: 'doc' as const, content });

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Start with an empty page',
    category: 'Basic',
    keywords: ['empty', 'new', 'plain'],
    content: doc(p()),
  },

  // ---------------------------------------------------------------- Business

  {
    id: 'letter',
    name: 'Business Letter',
    description: 'Formal letter with date and signature block',
    category: 'Business',
    keywords: ['formal', 'correspondence', 'block format'],
    content: doc(
      p('[Your Name]'),
      p('[Your Address]'),
      p(),
      p('[Date]'),
      p(),
      p('Dear [Recipient],'),
      p(),
      p('Write your letter here.'),
      p(),
      p('Sincerely,'),
      p('[Your Name]'),
    ),
  },
  {
    id: 'report',
    name: 'Simple Report',
    description: 'Report with title and sections',
    category: 'Business',
    keywords: ['summary', 'findings', 'document'],
    content: doc(
      h(1, 'Report Title'),
      p(),
      h(2, 'Introduction'),
      p('Write your introduction here.'),
      h(2, 'Summary'),
      p('Write your summary here.'),
    ),
  },
  {
    id: 'memo',
    name: 'Business Memo',
    description: 'Internal memo with a To / From / Subject header block',
    category: 'Business',
    keywords: ['memorandum', 'internal', 'announcement', 'notice'],
    content: doc(
      h(1, 'Memorandum'),
      p('', { borderColor: '#2f5496', borderSides: 'bottom', spaceAfter: 12 }),
      rich({}, t('To: ', 'bold'), t('[Recipient or team]')),
      rich({}, t('From: ', 'bold'), t('[Your name and title]')),
      rich({}, t('Date: ', 'bold'), t('[Date]')),
      rich({}, t('Subject: ', 'bold'), t('[One line that says what this is about]')),
      p('', { borderColor: '#2f5496', borderSides: 'bottom', spaceAfter: 12 }),
      h(2, 'Purpose'),
      p('State in one or two sentences what you are asking the reader to know or do.'),
      h(2, 'Background'),
      p('Give only the context the reader needs to act. Leave the rest out.'),
      h(2, 'What happens next'),
      ul(
        'Action, owner, and the date it is due.',
        'Action, owner, and the date it is due.',
      ),
      p(),
      p('Questions? Reach me at [email] or [phone].'),
    ),
  },
  {
    id: 'agenda',
    name: 'Meeting Agenda',
    description: 'Timed agenda with topics, owners and desired outcomes',
    category: 'Business',
    keywords: ['meeting', 'schedule', 'topics', 'standup'],
    content: doc(
      h(1, 'Meeting Agenda'),
      p('[Meeting name] · [Date] · [Start time – end time]', { styleId: 'subtitle' }),
      rich({}, t('Location: ', 'bold'), t('[Room or link]')),
      rich({}, t('Attendees: ', 'bold'), t('[Names]')),
      rich({}, t('Goal: ', 'bold'), t('[What this meeting has to produce]')),
      p(),
      h(2, 'Topics'),
      table(
        ['Time', 'Topic', 'Lead', 'Outcome wanted'],
        ['0:00', 'Welcome and goal for the meeting', '[Name]', 'Shared context'],
        ['0:05', '[Topic]', '[Name]', '[Decision, update or discussion]'],
        ['0:20', '[Topic]', '[Name]', '[Decision, update or discussion]'],
        ['0:40', 'Actions and owners', '[Name]', 'Everyone knows their next step'],
      ),
      p(),
      h(2, 'Come prepared to'),
      ul('[Read this beforehand]', '[Bring these numbers]'),
      h(2, 'Parking lot'),
      p('Anything raised that deserves its own meeting goes here.'),
    ),
  },
  {
    id: 'minutes',
    name: 'Meeting Minutes',
    description: 'Record of decisions, discussion and follow-up actions',
    category: 'Business',
    keywords: ['meeting', 'notes', 'record', 'action items'],
    content: doc(
      h(1, 'Meeting Minutes'),
      p('[Meeting name] · [Date]', { styleId: 'subtitle' }),
      rich({}, t('Present: ', 'bold'), t('[Names]')),
      rich({}, t('Apologies: ', 'bold'), t('[Names]')),
      rich({}, t('Minutes by: ', 'bold'), t('[Your name]')),
      p(),
      h(2, 'Decisions made'),
      ol('[Decision, and who made the call]', '[Decision, and who made the call]'),
      h(2, 'Discussion'),
      h(3, '[Topic]'),
      p('What was raised, what the options were, and where it landed.'),
      h(3, '[Topic]'),
      p('What was raised, what the options were, and where it landed.'),
      h(2, 'Action items'),
      table(
        ['Action', 'Owner', 'Due'],
        ['[What needs doing]', '[Name]', '[Date]'],
        ['[What needs doing]', '[Name]', '[Date]'],
      ),
      p(),
      h(2, 'Next meeting'),
      p('[Date, time and the one thing it must cover.]'),
    ),
  },
  {
    id: 'proposal',
    name: 'Project Proposal',
    description: 'Problem, approach, timeline and budget, in that order',
    category: 'Business',
    keywords: ['pitch', 'plan', 'scope', 'statement of work'],
    content: doc(
      h(1, '[Project name]'),
      p('Proposal prepared for [client or sponsor] by [your name], [date]', {
        styleId: 'subtitle',
      }),
      h(2, 'Summary'),
      p(
        'One paragraph a busy reader could stop after: what the problem is, what you propose, and what it costs.',
      ),
      h(2, 'The problem'),
      p('Describe the current situation and what it is costing in time, money or risk.'),
      h(2, 'Proposed approach'),
      ol(
        '[Phase one - what gets done and what it produces]',
        '[Phase two - what gets done and what it produces]',
        '[Phase three - what gets done and what it produces]',
      ),
      h(2, 'Timeline'),
      table(
        ['Milestone', 'Deliverable', 'Date'],
        ['[Milestone]', '[What you hand over]', '[Date]'],
        ['[Milestone]', '[What you hand over]', '[Date]'],
      ),
      p(),
      h(2, 'Budget'),
      table(
        ['Item', 'Basis', 'Cost'],
        ['[Item]', '[Hours × rate, or fixed fee]', '[Amount]'],
        ['[Item]', '[Hours × rate, or fixed fee]', '[Amount]'],
        ['Total', '', '[Amount]'],
      ),
      p(),
      h(2, 'Out of scope'),
      p('Name the things this proposal does not cover, so nobody assumes them.'),
      h(2, 'Next step'),
      p('Say exactly what you need from the reader and by when.'),
    ),
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'Line-item invoice with totals and payment terms',
    category: 'Business',
    keywords: ['bill', 'billing', 'payment', 'freelance', 'receipt'],
    content: doc(
      h(1, 'Invoice', { textAlign: 'right' }),
      p('Invoice #[0001] · [Date]', { textAlign: 'right', styleId: 'subtitle' }),
      p('[Your business name]', { spaceBefore: 12 }),
      p('[Street address] · [City, State ZIP]'),
      p('[email@address.com] · [(000) 000-0000]'),
      p(),
      rich({}, t('Bill to: ', 'bold'), t('[Client name]')),
      p('[Client address]'),
      rich({}, t('Due: ', 'bold'), t('[Date]')),
      p(),
      table(
        ['Description', 'Qty', 'Rate', 'Amount'],
        ['[Work performed]', '[0]', '[0.00]', '[0.00]'],
        ['[Work performed]', '[0]', '[0.00]', '[0.00]'],
        ['[Work performed]', '[0]', '[0.00]', '[0.00]'],
        ['Subtotal', '', '', '[0.00]'],
        ['Tax', '', '[0%]', '[0.00]'],
        ['Total due', '', '', '[0.00]'],
      ),
      p(),
      h(2, 'Payment'),
      p('[Bank details, payment link, or cheque instructions.]'),
      p('Payment is due within [30] days. Thank you for your business.', {
        styleId: 'subtitle',
      }),
    ),
  },
  {
    id: 'statusreport',
    name: 'Weekly Status Report',
    description: 'Progress, next steps and blockers on one page',
    category: 'Business',
    keywords: ['update', 'progress', 'weekly', 'standup', 'project'],
    content: doc(
      h(1, 'Weekly Status'),
      p('[Project or team] · Week of [date]', { styleId: 'subtitle' }),
      rich({}, t('Overall: ', 'bold'), t('[On track / at risk / off track] - one sentence why.')),
      p(),
      h(2, 'Done this week'),
      ul('[Finished thing, with the number that proves it]', '[Finished thing]'),
      h(2, 'Planned for next week'),
      ul('[Next thing, and who owns it]', '[Next thing, and who owns it]'),
      h(2, 'Blockers'),
      ul('[What is stuck, who can unstick it, and by when]'),
      h(2, 'Numbers'),
      table(
        ['Metric', 'Last week', 'This week', 'Target'],
        ['[Metric]', '[0]', '[0]', '[0]'],
        ['[Metric]', '[0]', '[0]', '[0]'],
      ),
    ),
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Masthead, lead story and short items for a team or club',
    category: 'Business',
    keywords: ['bulletin', 'update', 'company', 'club', 'email'],
    content: doc(
      p('[ORGANISATION NAME]', {
        textAlign: 'center',
        styleId: 'subtitle',
        spaceAfter: 0,
      }),
      h(1, 'The [Newsletter Name]', { textAlign: 'center' }),
      p('Issue [00] · [Month Year]', { textAlign: 'center', styleId: 'subtitle' }),
      hr(),
      h(2, '[Lead story headline]'),
      p(
        'Open with the news itself, not a wind-up. Two or three short paragraphs is the whole story; anything longer belongs on its own page.',
      ),
      p('Write the second paragraph here.'),
      h(2, 'In brief'),
      ul(
        '[Short item - one sentence each]',
        '[Short item]',
        '[Short item]',
      ),
      h(2, 'Dates for the diary'),
      table(
        ['Date', 'What', 'Where'],
        ['[Date]', '[Event]', '[Place]'],
        ['[Date]', '[Event]', '[Place]'],
      ),
      p(),
      hr(),
      p('Got something for the next issue? Send it to [email] by [date].', {
        textAlign: 'center',
        styleId: 'subtitle',
      }),
    ),
  },

  // ------------------------------------------ Resumes and Cover Letters

  {
    id: 'resume',
    /**
     * The Harvard format, as taught by Harvard's Office of Career Services.
     * Its distinguishing features are Education first rather than Experience,
     * a Leadership & Activities section, and Skills & Interests last. Bullets
     * lead with an action verb and carry a number, because the format's whole
     * argument is that accomplishments beat duties.
     */
    name: 'Resume',
    description: 'Harvard-format resume: education first, then experience',
    category: 'Resumes and Cover Letters',
    keywords: ['cv', 'job', 'application', 'harvard', 'graduate'],
    content: doc(
      h(1, 'Your Name'),
      p('Street Address • City, State ZIP • email@address.com • (000) 000-0000'),
      h(2, 'Education'),
      p('University Name, City, State'),
      p('Degree, Concentration. GPA 0.00. Graduation Month Year'),
      p('Relevant coursework: list courses that support the role you are applying for.'),
      h(2, 'Experience'),
      p('Organization, City, State'),
      p('Position Title. Month Year – Month Year'),
      ul(
        'Begin with an action verb and state the result, with a number wherever you can.',
        'Describe what you achieved, not the duties you were assigned.',
        'Use past tense for previous roles and present tense for current ones.',
      ),
      h(2, 'Leadership & Activities'),
      p('Organization, City, State'),
      p('Role. Month Year – Month Year'),
      ul('Describe the contribution and its effect on the group.'),
      h(2, 'Skills & Interests'),
      p('Technical: software, tools and methods'),
      p('Language: language and level of fluency'),
      p('Interests: a short, genuine list'),
    ),
  },
  {
    id: 'resume-modern',
    name: 'Skills-First Resume',
    description: 'Leads with a summary and skills, for career changers',
    category: 'Resumes and Cover Letters',
    keywords: ['cv', 'functional', 'career change', 'job', 'modern'],
    content: doc(
      h(1, 'YOUR NAME', { textAlign: 'center' }),
      p('[Job title you are applying for]', { textAlign: 'center', styleId: 'subtitle' }),
      p('[City, State] • [email@address.com] • [(000) 000-0000] • [portfolio or profile]', {
        textAlign: 'center',
      }),
      hr(),
      h(2, 'Summary'),
      p(
        'Two sentences: what you do, how long you have done it, and the single result you are proudest of. Name the role you want.',
      ),
      h(2, 'Core Skills'),
      table(
        ['Skill area', 'Skill area', 'Skill area'],
        ['[Skill]', '[Skill]', '[Skill]'],
        ['[Skill]', '[Skill]', '[Skill]'],
      ),
      p(),
      h(2, 'Selected Achievements'),
      ul(
        '[Result, with the number and the timeframe that make it real.]',
        '[Result, with the number and the timeframe that make it real.]',
        '[Result, with the number and the timeframe that make it real.]',
      ),
      h(2, 'Experience'),
      rich({}, t('[Job Title]', 'bold'), t(' - [Company], [City]. [Month Year – Month Year]')),
      ul('[What you owned, and what changed because of it.]'),
      rich({}, t('[Job Title]', 'bold'), t(' - [Company], [City]. [Month Year – Month Year]')),
      ul('[What you owned, and what changed because of it.]'),
      h(2, 'Education & Certifications'),
      p('[Degree or certificate], [Institution], [Year]'),
    ),
  },
  {
    id: 'coverletter',
    name: 'Cover Letter',
    description: 'Three-paragraph letter tied to one specific job',
    category: 'Resumes and Cover Letters',
    keywords: ['job', 'application', 'hiring', 'letter'],
    content: doc(
      p('[Your Name]'),
      p('[City, State] • [email@address.com] • [(000) 000-0000]'),
      p(),
      p('[Date]'),
      p(),
      p('[Hiring manager name]'),
      p('[Company name]'),
      p('[Company address]'),
      p(),
      p('Dear [Hiring manager name],'),
      p(),
      p(
        'Open by naming the role and where you saw it, then say in one sentence why you are a serious candidate for it. Avoid "I am writing to apply".',
      ),
      p(),
      p(
        'Spend the middle paragraph on one accomplishment that matches what the posting asks for. Give the situation, what you did, and the result with a number in it. One good example beats three vague ones.',
      ),
      p(),
      p(
        'Close on the company rather than yourself: what you noticed about their work and what you would want to contribute. Then ask for the conversation.',
      ),
      p(),
      p('Thank you for your time.'),
      p(),
      p('Sincerely,'),
      p('[Your Name]'),
    ),
  },
  {
    id: 'thankyou',
    name: 'Interview Thank-You Note',
    description: 'Short follow-up to send within a day of an interview',
    category: 'Resumes and Cover Letters',
    keywords: ['follow up', 'interview', 'note', 'email', 'job'],
    content: doc(
      p('[Date]'),
      p(),
      p('Dear [Interviewer name],'),
      p(),
      p(
        'Thank you for taking the time to talk with me about the [role] on [day]. I enjoyed hearing about [something specific they said].',
      ),
      p(),
      p(
        'Our conversation about [topic] made me more interested, not less. [Add the one thing you wish you had said, or a short answer you have improved on reflection.]',
      ),
      p(),
      p(
        'I would be glad to send over [work sample, references, anything promised]. Please let me know if anything else would help.',
      ),
      p(),
      p('Best regards,'),
      p('[Your Name]'),
      p('[email@address.com] • [(000) 000-0000]'),
    ),
  },

  // ----------------------------------------------------------------- Letters

  {
    id: 'resignation',
    name: 'Resignation Letter',
    description: 'Brief, gracious notice with a clear last working day',
    category: 'Letters',
    keywords: ['quit', 'notice', 'leaving', 'two weeks', 'job'],
    content: doc(
      p('[Your Name]'),
      p('[Your Address]'),
      p(),
      p('[Date]'),
      p(),
      p('[Manager name]'),
      p('[Company name]'),
      p(),
      p('Dear [Manager name],'),
      p(),
      p(
        'I am writing to give notice of my resignation from my position as [job title] at [company]. My last working day will be [date], which gives [notice period] as required.',
      ),
      p(),
      p(
        'Thank you for the opportunity. [Name one thing you genuinely valued - a project, a skill you gained, a person you learned from.]',
      ),
      p(),
      p(
        'I will do what I can to hand over smoothly. I am happy to document [responsibilities] and help brief whoever takes them on.',
      ),
      p(),
      p('With thanks,'),
      p('[Your Name]'),
    ),
  },
  {
    id: 'recommendation',
    name: 'Letter of Recommendation',
    description: 'Reference letter with a specific example and a clear endorsement',
    category: 'Letters',
    keywords: ['reference', 'endorsement', 'recommend', 'student', 'employee'],
    content: doc(
      p('[Your Name], [Your Title]'),
      p('[Organisation] • [email@address.com] • [(000) 000-0000]'),
      p(),
      p('[Date]'),
      p(),
      p('To the [admissions committee / hiring manager / whom it may concern],'),
      p(),
      p(
        'I am pleased to recommend [name] for [role, programme or award]. I have known [name] for [length of time] as their [manager, teacher, supervisor], during which they [one-line summary of what they did for you].',
      ),
      p(),
      p(
        'The clearest example I can give is [situation]. [Name] [what they did], and the result was [outcome, with a number if you have one]. It showed me [the quality this demonstrates].',
      ),
      p(),
      p(
        '[Second short paragraph on how they work with other people - that is usually what the reader cannot tell from the application itself.]',
      ),
      p(),
      p(
        'I recommend [name] without reservation. Please contact me at [email] or [phone] if it would help to discuss this further.',
      ),
      p(),
      p('Sincerely,'),
      p('[Your Name]'),
      p('[Your Title]'),
    ),
  },
  {
    id: 'complaint',
    name: 'Complaint Letter',
    description: 'States the problem, the evidence and the remedy you want',
    category: 'Letters',
    keywords: ['refund', 'dispute', 'customer service', 'formal', 'issue'],
    content: doc(
      p('[Your Name]'),
      p('[Your Address] • [email@address.com] • [(000) 000-0000]'),
      p(),
      p('[Date]'),
      p(),
      p('[Company name] - Customer Relations'),
      p('[Company address]'),
      p(),
      rich({}, t('Re: ', 'bold'), t('[Order, account or reference number]')),
      p(),
      p('Dear Sir or Madam,'),
      p(),
      p(
        'On [date] I [bought / was billed for / arranged] [product or service] at [place or through channel]. [State plainly what went wrong.]',
      ),
      p(),
      rich({}, t('What I have already done: ', 'bold'), t('[calls, dates, names, reference numbers].')),
      rich({}, t('What I am enclosing: ', 'bold'), t('[receipt, photographs, prior correspondence].')),
      p(),
      p(
        'To resolve this I am asking for [refund, replacement, repair, specific amount]. I would appreciate a reply by [date, usually 14 days].',
      ),
      p(),
      p('Yours faithfully,'),
      p('[Your Name]'),
    ),
  },

  // --------------------------------------------------------------- Education

  {
    id: 'essay',
    name: 'Academic Essay',
    description: 'MLA-style heading, double spacing and a Works Cited page',
    category: 'Education',
    keywords: ['mla', 'paper', 'school', 'college', 'assignment', 'citation'],
    content: doc(
      p('[Your Name]', { lineHeight: '2' }),
      p('[Instructor Name]', { lineHeight: '2' }),
      p('[Course]', { lineHeight: '2' }),
      p('[Day Month Year]', { lineHeight: '2' }),
      p('[Title of Your Essay]', { textAlign: 'center', lineHeight: '2' }),
      p(
        'Open with the specific thing you are going to argue about, not with a definition or a sweeping claim about history. End this paragraph with your thesis: one sentence a reader could disagree with.',
        { lineHeight: '2' },
      ),
      p(
        'Each body paragraph makes one point. State it, support it with evidence, quote or cite the source, then explain how the evidence proves the point - that last step is the one students skip.',
        { lineHeight: '2' },
      ),
      p(
        'Deal with the strongest objection to your thesis rather than the weakest. Saying why it does not sink your argument is what makes the argument credible.',
        { lineHeight: '2' },
      ),
      p(
        'Close by saying what follows from the argument. Do not simply restate the introduction in different words.',
        { lineHeight: '2' },
      ),
      { type: 'pageBreak' },
      p('Works Cited', { textAlign: 'center', lineHeight: '2' }),
      p('Author Last, First. Title of Book. Publisher, Year.', { lineHeight: '2' }),
      p(
        'Author Last, First. "Title of Article." Journal, vol. 0, no. 0, Year, pp. 00–00.',
        { lineHeight: '2' },
      ),
    ),
  },
  {
    id: 'lessonplan',
    name: 'Lesson Plan',
    description: 'Objectives, timing, materials and assessment for one lesson',
    category: 'Education',
    keywords: ['teaching', 'class', 'school', 'curriculum', 'teacher'],
    content: doc(
      h(1, 'Lesson Plan'),
      p('[Subject] · [Year or grade] · [Date] · [Length]', { styleId: 'subtitle' }),
      h(2, 'Learning objectives'),
      p('By the end of this lesson students will be able to:'),
      ul(
        '[Verb the students can be seen doing - identify, compare, calculate, explain.]',
        '[A second objective, if the lesson genuinely has one.]',
      ),
      h(2, 'Materials'),
      ul('[Handout, equipment, slides, text]'),
      h(2, 'Lesson sequence'),
      table(
        ['Time', 'What the teacher does', 'What students do'],
        ['5 min', 'Starter that surfaces prior knowledge', 'Answer on whiteboards'],
        ['15 min', '[Direct instruction - the new idea]', '[Take notes, ask questions]'],
        ['20 min', '[Guided practice, circulating]', '[Work in pairs on the task]'],
        ['10 min', '[Set the independent task]', '[Work alone]'],
        ['5 min', 'Exit question', 'Answer the exit question'],
      ),
      p(),
      h(2, 'Assessment'),
      p('How you will know they learned it - the exit question, the task, the marking criteria.'),
      h(2, 'Differentiation'),
      ul(
        'Support: [scaffold, sentence starters, worked example]',
        'Extension: [harder case, second representation, explain it to someone else]',
      ),
      h(2, 'Homework'),
      p('[Task and due date.]'),
    ),
  },
  {
    id: 'studynotes',
    name: 'Cornell Study Notes',
    description: 'Cue column, notes and a summary you write from memory',
    category: 'Education',
    keywords: ['cornell', 'revision', 'lecture', 'study', 'notes', 'school'],
    content: doc(
      h(1, '[Topic]'),
      p('[Course] · [Date] · [Source: lecture, chapter, video]', { styleId: 'subtitle' }),
      table(
        ['Cues and questions', 'Notes'],
        ['[Question this section answers]', '[The point, in your own words. Do not transcribe.]'],
        ['[Key term]', '[Definition, plus an example that is not the one you were given.]'],
        ['[Question]', '[Notes]'],
        ['[Question]', '[Notes]'],
      ),
      p(),
      h(2, 'Summary'),
      p(
        'Cover the notes column and write this from memory in three or four sentences. If you cannot, you have found the part to reread.',
      ),
      h(2, 'Still unclear'),
      ul('[The thing to ask about or look up.]'),
    ),
  },
  {
    id: 'bookreport',
    name: 'Book Report',
    description: 'Summary, characters, themes and your own verdict',
    category: 'Education',
    keywords: ['reading', 'review', 'literature', 'school', 'english'],
    content: doc(
      h(1, '[Book Title]'),
      p('by [Author] · Report by [Your Name] · [Date]', { styleId: 'subtitle' }),
      rich({}, t('Genre: ', 'bold'), t('[Genre]')),
      rich({}, t('Published: ', 'bold'), t('[Year]')),
      rich({}, t('Pages: ', 'bold'), t('[000]')),
      h(2, 'What happens'),
      p(
        'Summarise the plot in one paragraph without giving away the ending - unless your teacher asked you to.',
      ),
      h(2, 'Main characters'),
      ul(
        '[Name] - [who they are and what they want]',
        '[Name] - [who they are and what they want]',
      ),
      h(2, 'Setting'),
      p('[Where and when, and why it matters to the story.]'),
      h(2, 'Themes'),
      p('[What the book is actually about underneath the plot. Give one example from the text.]'),
      h(2, 'A passage worth quoting'),
      p('"[Quotation]" (p. 00)', { styleId: 'quote' }),
      p('[Why you chose it.]'),
      h(2, 'What I thought'),
      p(
        'Give your opinion and the reason for it. Say who you would recommend it to, and who you would not.',
      ),
    ),
  },
  {
    id: 'syllabus',
    name: 'Course Syllabus',
    description: 'Course outline with policies, schedule and grading',
    category: 'Education',
    keywords: ['course', 'outline', 'teaching', 'university', 'class'],
    content: doc(
      h(1, '[Course Number]: [Course Title]'),
      p('[Term Year] · [Days and times] · [Room]', { styleId: 'subtitle' }),
      rich({}, t('Instructor: ', 'bold'), t('[Name] · [email] · Office hours [times, place]')),
      h(2, 'Course description'),
      p('[Two or three sentences on what the course covers and who it is for.]'),
      h(2, 'Learning outcomes'),
      ol(
        '[What a student who passes can do that they could not before.]',
        '[Outcome]',
        '[Outcome]',
      ),
      h(2, 'Required materials'),
      ul('[Text, edition, and whether it must be bought]'),
      h(2, 'Schedule'),
      table(
        ['Week', 'Topic', 'Reading', 'Due'],
        ['1', '[Topic]', '[Reading]', '-'],
        ['2', '[Topic]', '[Reading]', '[Assignment]'],
        ['3', '[Topic]', '[Reading]', '-'],
        ['4', '[Topic]', '[Reading]', '[Assignment]'],
      ),
      p(),
      h(2, 'Grading'),
      table(
        ['Component', 'Weight'],
        ['[Assignments]', '[00%]'],
        ['[Midterm]', '[00%]'],
        ['[Final]', '[00%]'],
        ['[Participation]', '[00%]'],
      ),
      p(),
      h(2, 'Course policies'),
      p('[Late work, attendance, academic honesty, accommodations, and where to get help.]'),
    ),
  },

  // ------------------------------------------------------------------ Flyers

  {
    id: 'eventflyer',
    name: 'Event Flyer',
    description: 'Big headline, the details, and a tear-off line of contacts',
    category: 'Flyers',
    keywords: ['poster', 'event', 'announcement', 'community', 'sale'],
    content: doc(
      p('', { shading: '#2f5496', spaceAfter: 18 }),
      h(1, '[EVENT NAME]', { textAlign: 'center', styleId: 'title' }),
      p('[The one line that makes someone stop and read]', {
        textAlign: 'center',
        styleId: 'subtitle',
      }),
      p('', { borderColor: '#2f5496', borderSides: 'bottom', spaceAfter: 18 }),
      rich({ textAlign: 'center' }, t('[Day, Date]', 'bold')),
      rich({ textAlign: 'center' }, t('[Start time – end time]', 'bold')),
      rich({ textAlign: 'center' }, t('[Venue name, street address]', 'bold')),
      p(),
      p(
        'Two or three sentences on what will actually happen, who it is for, and what it costs. Anything longer will not be read standing up.',
        { textAlign: 'center' },
      ),
      p(),
      p('[Free entry · Tickets [price] · Register at [link]]', {
        textAlign: 'center',
        styleId: 'subtitle',
      }),
      p(),
      hr(),
      p('Questions? [Name] · [email@address.com] · [(000) 000-0000]', {
        textAlign: 'center',
      }),
    ),
  },
  {
    id: 'forsaleflyer',
    name: 'For Sale Flyer',
    description: 'Item, price, condition and contact - a noticeboard sheet',
    category: 'Flyers',
    keywords: ['selling', 'classified', 'advert', 'noticeboard', 'poster'],
    content: doc(
      h(1, 'FOR SALE', { textAlign: 'center', styleId: 'title' }),
      p('[Item name]', { textAlign: 'center', styleId: 'subtitle' }),
      hr(),
      rich({ textAlign: 'center' }, t('[$000]', 'bold')),
      p('[Or nearest offer]', { textAlign: 'center', styleId: 'subtitle' }),
      p(),
      h(2, 'Details'),
      table(
        ['', ''],
        ['Condition', '[New / like new / used]'],
        ['Age', '[How old it is]'],
        ['Reason for selling', '[Short and honest]'],
        ['Collection', '[Pickup only / can deliver locally]'],
      ),
      p(),
      h(2, 'What is included'),
      ul('[Item and accessories]', '[Manual, box, spares]'),
      p(),
      p('Insert a photograph above this line - a flyer without one gets ignored.', {
        textAlign: 'center',
        styleId: 'subtitle',
      }),
      hr(),
      p('Contact [Name] · [(000) 000-0000] · [email@address.com]', { textAlign: 'center' }),
    ),
  },

  // ------------------------------------------------------------------- Cards

  {
    id: 'invitation',
    name: 'Party Invitation',
    description: 'Centred invitation with the who, what, where and RSVP',
    category: 'Cards',
    keywords: ['party', 'rsvp', 'birthday', 'celebration', 'invite'],
    content: doc(
      p(),
      p('You are invited to', { textAlign: 'center', styleId: 'subtitle' }),
      h(1, '[The Occasion]', { textAlign: 'center', styleId: 'title' }),
      p('in honour of [name]', { textAlign: 'center', styleId: 'subtitle' }),
      p('', { borderColor: '#2f5496', borderSides: 'bottom', spaceAfter: 18 }),
      rich({ textAlign: 'center' }, t('[Day, Date]', 'bold')),
      p('[Time]', { textAlign: 'center' }),
      p('[Venue]', { textAlign: 'center' }),
      p('[Street address]', { textAlign: 'center' }),
      p(),
      p('[Dress code, or what to bring, or "just yourself"]', {
        textAlign: 'center',
        styleId: 'subtitle',
      }),
      p(),
      p('', { borderColor: '#2f5496', borderSides: 'top', spaceBefore: 12 }),
      rich({ textAlign: 'center' }, t('RSVP by [date] ', 'bold'), t('to [name] on [phone or email]')),
    ),
  },
  {
    id: 'greetingcard',
    name: 'Greeting Card',
    description: 'Folded quarter-page card: front, inside and a blank back',
    category: 'Cards',
    keywords: ['card', 'birthday', 'thank you', 'congratulations', 'fold'],
    content: doc(
      p('Print double-sided and fold twice. This page is the front.', {
        styleId: 'subtitle',
      }),
      p(),
      p(),
      h(1, '[Happy Birthday]', { textAlign: 'center', styleId: 'title' }),
      p('[A short line, or leave it blank]', { textAlign: 'center', styleId: 'subtitle' }),
      { type: 'pageBreak' },
      p('Inside - left panel', { styleId: 'subtitle' }),
      p(),
      p('[Write the message here. Say the specific thing; that is the whole point of a card.]'),
      p(),
      p('[With love,]', { textAlign: 'right' }),
      p('[Your name]', { textAlign: 'right' }),
      { type: 'pageBreak' },
      p('Back panel', { styleId: 'subtitle' }),
      p(),
      p('[Small note, quotation, or leave blank]', { textAlign: 'center', styleId: 'subtitle' }),
    ),
  },

  // ----------------------------------------------------------------- Holiday

  {
    id: 'holidayparty',
    name: 'Holiday Party Invitation',
    description: 'Seasonal invitation with RSVP and what-to-bring lines',
    category: 'Holiday',
    keywords: ['christmas', 'seasonal', 'party', 'december', 'invite', 'office'],
    content: doc(
      p('', { shading: '#c00000', spaceAfter: 18 }),
      p('Please join us for the', { textAlign: 'center', styleId: 'subtitle' }),
      h(1, '[Annual Holiday Party]', { textAlign: 'center', styleId: 'title' }),
      p('hosted by [name or team]', { textAlign: 'center', styleId: 'subtitle' }),
      p(),
      rich({ textAlign: 'center' }, t('[Friday, 00 December]', 'bold')),
      p('[Time] until [time]', { textAlign: 'center' }),
      p('[Venue, street address]', { textAlign: 'center' }),
      p(),
      h(2, 'On the night', { textAlign: 'center' }),
      ul('[Food and drink]', '[Music, games, or the gift exchange]', '[Anything else]'),
      p(),
      p('[Bring a wrapped gift under [amount] if you are joining the exchange.]', {
        textAlign: 'center',
        styleId: 'subtitle',
      }),
      p('', { borderColor: '#c00000', borderSides: 'top', spaceBefore: 12 }),
      rich({ textAlign: 'center' }, t('RSVP by [date] ', 'bold'), t('to [name] at [email]')),
    ),
  },
  {
    id: 'holidaynewsletter',
    name: 'Holiday Family Letter',
    description: "The year's news for the people on your card list",
    category: 'Holiday',
    keywords: ['christmas', 'family', 'annual', 'year in review', 'card'],
    content: doc(
      h(1, 'Season’s Greetings from the [Family Name]s', { textAlign: 'center' }),
      p('[Year]', { textAlign: 'center', styleId: 'subtitle' }),
      hr(),
      p('Dear friends and family,'),
      p(),
      p(
        'Open with the one thing that actually defined the year for you. Everyone writes "where did the year go" - write something only your family could write.',
      ),
      h(2, 'The news'),
      ul(
        '[Person] - [what they did this year, in one sentence]',
        '[Person] - [what they did this year, in one sentence]',
        '[Person] - [what they did this year, in one sentence]',
      ),
      h(2, 'Where we went'),
      p('[The trip, the move, the weekend that was worth the drive.]'),
      h(2, 'What we are looking forward to'),
      p('[One or two things in the year ahead.]'),
      p(),
      p(
        'Thank you for the letters, calls and visits. We hope the season is kind to you and we would love to see you in [next year].',
      ),
      p(),
      p('With love,'),
      p('[Your names]'),
      p('[Address] · [email@address.com]', { styleId: 'subtitle' }),
    ),
  },

  // ---------------------------------------------------------------- Personal

  {
    id: 'todolist',
    name: 'To-Do List',
    description: 'Checklist split into today, this week and waiting on',
    category: 'Personal',
    keywords: ['tasks', 'checklist', 'planner', 'productivity', 'todo'],
    content: doc(
      h(1, 'To-Do'),
      p('[Week of date]', { styleId: 'subtitle' }),
      h(2, 'Today'),
      checklist('[The one thing that has to happen today]', '[Task]', '[Task]'),
      h(2, 'This week'),
      checklist('[Task]', '[Task]', '[Task]'),
      h(2, 'Waiting on someone else'),
      checklist('[What, who, and since when]'),
      h(2, 'Someday'),
      checklist('[The thing you keep moving forward - decide to drop it or schedule it]'),
    ),
  },
  {
    id: 'weeklyplanner',
    name: 'Weekly Planner',
    description: 'Week-at-a-glance grid with priorities and notes',
    category: 'Personal',
    keywords: ['schedule', 'calendar', 'planner', 'week', 'timetable'],
    content: doc(
      h(1, 'Week of [date]'),
      h(2, 'Top three priorities'),
      ol('[Priority]', '[Priority]', '[Priority]'),
      h(2, 'The week'),
      table(
        ['Day', 'Morning', 'Afternoon', 'Evening'],
        ['Monday', '', '', ''],
        ['Tuesday', '', '', ''],
        ['Wednesday', '', '', ''],
        ['Thursday', '', '', ''],
        ['Friday', '', '', ''],
        ['Saturday', '', '', ''],
        ['Sunday', '', '', ''],
      ),
      p(),
      h(2, 'Notes'),
      p(),
    ),
  },
  {
    id: 'recipe',
    name: 'Recipe',
    description: 'Ingredients and numbered method, sized for one card',
    category: 'Personal',
    keywords: ['cooking', 'food', 'kitchen', 'card', 'baking'],
    content: doc(
      h(1, '[Recipe Name]'),
      p('[One line on where it came from or why it is worth making]', { styleId: 'subtitle' }),
      table(
        ['Serves', 'Prep', 'Cook', 'Total'],
        ['[0]', '[00 min]', '[00 min]', '[00 min]'],
      ),
      p(),
      h(2, 'Ingredients'),
      ul(
        '[Quantity] [ingredient]',
        '[Quantity] [ingredient]',
        '[Quantity] [ingredient]',
        '[Quantity] [ingredient]',
      ),
      h(2, 'Method'),
      ol(
        '[Step. Start with the verb and say what it should look like when it is done.]',
        '[Step]',
        '[Step]',
        '[Step]',
      ),
      h(2, 'Notes'),
      ul('[Substitutions]', '[How to store it, and for how long]', '[What you would do differently]'),
    ),
  },
  {
    id: 'budget',
    name: 'Monthly Budget',
    description: 'Income against planned and actual spending',
    category: 'Personal',
    keywords: ['money', 'finance', 'expenses', 'savings', 'tracker'],
    content: doc(
      h(1, 'Monthly Budget'),
      p('[Month Year]', { styleId: 'subtitle' }),
      h(2, 'Income'),
      table(
        ['Source', 'Planned', 'Actual'],
        ['[Salary, after tax]', '[0.00]', '[0.00]'],
        ['[Other income]', '[0.00]', '[0.00]'],
        ['Total income', '[0.00]', '[0.00]'],
      ),
      p(),
      h(2, 'Fixed costs'),
      table(
        ['Item', 'Planned', 'Actual'],
        ['[Rent or mortgage]', '[0.00]', '[0.00]'],
        ['[Utilities]', '[0.00]', '[0.00]'],
        ['[Insurance]', '[0.00]', '[0.00]'],
        ['[Subscriptions]', '[0.00]', '[0.00]'],
      ),
      p(),
      h(2, 'Variable costs'),
      table(
        ['Item', 'Planned', 'Actual'],
        ['[Groceries]', '[0.00]', '[0.00]'],
        ['[Transport]', '[0.00]', '[0.00]'],
        ['[Eating out]', '[0.00]', '[0.00]'],
        ['[Everything else]', '[0.00]', '[0.00]'],
      ),
      p(),
      h(2, 'Left over'),
      p('Income minus everything above. Decide where it goes before the month starts, or it goes nowhere.'),
    ),
  },
];
