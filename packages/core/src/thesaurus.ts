/**
 * A small offline thesaurus for the Review tab.
 *
 * A commercial thesaurus is usually a licensed data set backed by an online
 * service. This is a
 * hand-built local list covering the words writers most often reach for: it is
 * deliberately modest, and `lookupThesaurus` says so by returning no entry
 * rather than guessing.
 */

export interface ThesaurusEntry {
  word: string;
  /** Grouped by sense, the way the thesaurus pane lists them. */
  senses: Array<{ partOfSpeech: string; synonyms: string[] }>;
  antonyms: string[];
}

const DATA: Record<string, ThesaurusEntry> = {};

function entry(
  word: string,
  senses: Array<[string, string[]]>,
  antonyms: string[] = [],
): void {
  DATA[word] = {
    word,
    senses: senses.map(([partOfSpeech, synonyms]) => ({ partOfSpeech, synonyms })),
    antonyms,
  };
}

entry('good', [['adjective', ['excellent', 'fine', 'superior', 'worthy', 'admirable']]], ['bad', 'poor']);
entry('bad', [['adjective', ['poor', 'inferior', 'substandard', 'unsatisfactory', 'awful']]], ['good', 'excellent']);
entry('big', [['adjective', ['large', 'substantial', 'considerable', 'sizeable', 'immense']]], ['small', 'tiny']);
entry('small', [['adjective', ['little', 'compact', 'slight', 'minor', 'modest']]], ['big', 'large']);
entry('important', [['adjective', ['significant', 'crucial', 'vital', 'essential', 'key']]], ['trivial', 'minor']);
entry('happy', [['adjective', ['glad', 'pleased', 'delighted', 'content', 'cheerful']]], ['sad', 'unhappy']);
entry('sad', [['adjective', ['unhappy', 'sorrowful', 'downcast', 'dejected', 'gloomy']]], ['happy', 'cheerful']);
entry('quick', [['adjective', ['fast', 'rapid', 'swift', 'speedy', 'brisk']]], ['slow']);
entry('slow', [['adjective', ['gradual', 'unhurried', 'leisurely', 'sluggish']]], ['quick', 'fast']);
entry('easy', [['adjective', ['simple', 'straightforward', 'effortless', 'uncomplicated']]], ['difficult', 'hard']);
entry('hard', [
  ['adjective', ['difficult', 'demanding', 'challenging', 'arduous']],
  ['adjective', ['firm', 'solid', 'rigid', 'unyielding']],
], ['easy', 'soft']);
entry('difficult', [['adjective', ['hard', 'demanding', 'challenging', 'tough', 'tricky']]], ['easy', 'simple']);
entry('new', [['adjective', ['recent', 'fresh', 'modern', 'novel', 'current']]], ['old']);
entry('old', [['adjective', ['aged', 'ancient', 'former', 'previous', 'dated']]], ['new', 'modern']);
entry('show', [
  ['verb', ['display', 'present', 'reveal', 'demonstrate', 'exhibit']],
  ['noun', ['display', 'exhibition', 'presentation']],
], ['hide', 'conceal']);
entry('make', [['verb', ['create', 'produce', 'build', 'construct', 'form']]], ['destroy']);
entry('get', [['verb', ['obtain', 'acquire', 'receive', 'gain', 'secure']]], ['lose']);
entry('use', [
  ['verb', ['employ', 'utilise', 'apply', 'operate']],
  ['noun', ['purpose', 'function', 'application']],
]);
entry('help', [
  ['verb', ['assist', 'aid', 'support', 'facilitate']],
  ['noun', ['assistance', 'aid', 'support', 'guidance']],
], ['hinder']);
entry('start', [['verb', ['begin', 'commence', 'initiate', 'launch', 'open']]], ['finish', 'end']);
entry('finish', [['verb', ['complete', 'conclude', 'end', 'finalise', 'wrap up']]], ['start', 'begin']);
entry('change', [
  ['verb', ['alter', 'modify', 'adjust', 'revise', 'amend']],
  ['noun', ['alteration', 'modification', 'shift', 'revision']],
]);
entry('think', [['verb', ['believe', 'consider', 'reckon', 'judge', 'suppose']]]);
entry('say', [['verb', ['state', 'declare', 'mention', 'remark', 'express']]]);
entry('tell', [['verb', ['inform', 'notify', 'advise', 'report', 'relate']]]);
entry('ask', [['verb', ['enquire', 'question', 'request', 'query']]], ['answer']);
entry('answer', [
  ['verb', ['reply', 'respond', 'retort']],
  ['noun', ['reply', 'response', 'solution']],
], ['question', 'ask']);
entry('idea', [['noun', ['concept', 'notion', 'thought', 'proposal', 'suggestion']]]);
entry('problem', [['noun', ['issue', 'difficulty', 'complication', 'obstacle', 'snag']]], ['solution']);
entry('result', [['noun', ['outcome', 'consequence', 'effect', 'conclusion', 'upshot']]], ['cause']);
entry('reason', [['noun', ['cause', 'motive', 'justification', 'rationale', 'basis']]]);
entry('need', [
  ['verb', ['require', 'want', 'demand', 'call for']],
  ['noun', ['requirement', 'necessity', 'demand']],
]);
entry('work', [
  ['noun', ['job', 'employment', 'occupation', 'labour', 'effort']],
  ['verb', ['function', 'operate', 'perform', 'labour']],
]);
entry('report', [
  ['noun', ['account', 'statement', 'summary', 'record', 'review']],
  ['verb', ['describe', 'relate', 'announce', 'document']],
]);
entry('plan', [
  ['noun', ['scheme', 'strategy', 'proposal', 'programme', 'blueprint']],
  ['verb', ['arrange', 'organise', 'devise', 'schedule']],
]);
entry('team', [['noun', ['group', 'crew', 'squad', 'unit', 'staff']]]);
entry('goal', [['noun', ['aim', 'objective', 'target', 'purpose', 'ambition']]]);
entry('clear', [['adjective', ['obvious', 'evident', 'plain', 'apparent', 'transparent']]], ['unclear', 'vague']);
entry('increase', [
  ['verb', ['raise', 'grow', 'expand', 'boost', 'escalate']],
  ['noun', ['rise', 'growth', 'gain', 'upturn']],
], ['decrease', 'reduce']);
entry('decrease', [
  ['verb', ['reduce', 'lower', 'diminish', 'lessen', 'shrink']],
  ['noun', ['reduction', 'decline', 'drop', 'fall']],
], ['increase', 'grow']);
entry('improve', [['verb', ['enhance', 'refine', 'upgrade', 'better', 'strengthen']]], ['worsen']);
entry('build', [['verb', ['construct', 'assemble', 'erect', 'develop', 'create']]], ['demolish']);
entry('write', [['verb', ['compose', 'draft', 'pen', 'record', 'author']]]);
entry('read', [['verb', ['peruse', 'study', 'scan', 'review']]]);
entry('find', [['verb', ['discover', 'locate', 'identify', 'detect', 'uncover']]], ['lose']);
entry('keep', [['verb', ['retain', 'hold', 'preserve', 'maintain', 'store']]], ['discard']);
entry('give', [['verb', ['provide', 'supply', 'offer', 'grant', 'deliver']]], ['take']);
entry('take', [['verb', ['seize', 'grasp', 'accept', 'remove', 'carry']]], ['give']);
entry('very', [['adverb', ['extremely', 'highly', 'exceedingly', 'particularly', 'remarkably']]]);
entry('really', [['adverb', ['genuinely', 'truly', 'actually', 'indeed']]]);
entry('however', [['adverb', ['nevertheless', 'nonetheless', 'even so', 'yet']]]);
entry('because', [['conjunction', ['since', 'as', 'given that', 'owing to the fact that']]]);
entry('also', [['adverb', ['additionally', 'furthermore', 'moreover', 'as well', 'too']]]);
entry('interesting', [['adjective', ['engaging', 'compelling', 'intriguing', 'absorbing', 'fascinating']]], ['dull', 'boring']);
entry('beautiful', [['adjective', ['lovely', 'attractive', 'gorgeous', 'stunning', 'elegant']]], ['ugly']);
entry('strong', [['adjective', ['powerful', 'robust', 'sturdy', 'forceful', 'resilient']]], ['weak']);
entry('weak', [['adjective', ['feeble', 'frail', 'fragile', 'ineffective']]], ['strong']);
entry('clean', [['adjective', ['spotless', 'tidy', 'immaculate', 'pristine']]], ['dirty']);
entry('safe', [['adjective', ['secure', 'protected', 'sheltered', 'harmless']]], ['dangerous']);
entry('cheap', [['adjective', ['inexpensive', 'affordable', 'economical', 'low-cost']]], ['expensive']);
entry('expensive', [['adjective', ['costly', 'pricey', 'dear', 'extravagant']]], ['cheap', 'affordable']);

/** The thesaurus entry for a word, or null when the list has nothing for it. */
export function lookupThesaurus(word: string): ThesaurusEntry | null {
  const key = word.trim().toLowerCase();
  const found = DATA[key];
  if (!found) return null;
  if (word === key) return found;

  // Follow the capitalisation of what the user selected, so replacing a word at
  // the start of a sentence does not lowercase it.
  const capitalise = (value: string) => value[0].toUpperCase() + value.slice(1);
  const isCapitalised = word[0] === word[0].toUpperCase();
  if (!isCapitalised) return found;
  return {
    word,
    senses: found.senses.map((sense) => ({ ...sense, synonyms: sense.synonyms.map(capitalise) })),
    antonyms: found.antonyms.map(capitalise),
  };
}

/** How many words the built-in thesaurus knows, shown in the pane's footer. */
export const THESAURUS_WORD_COUNT = Object.keys(DATA).length;
