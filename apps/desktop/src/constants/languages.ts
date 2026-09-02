/**
 * The proofing languages Officewrite ships dictionaries for.
 *
 * One list, three consumers: the Review tab's Language menu, the Backstage
 * Options picker and the status bar. `label` is what a menu shows; `shortLabel`
 * is the compact form the status bar has room for.
 */
export interface ProofingLanguage {
  id: string;
  label: string;
  shortLabel: string;
}

export const PROOFING_LANGUAGES: ProofingLanguage[] = [
  { id: 'en-US', label: 'English (United States)', shortLabel: 'English (U.S.)' },
  { id: 'en-GB', label: 'English (United Kingdom)', shortLabel: 'English (U.K.)' },
  { id: 'de-DE', label: 'German (Germany)', shortLabel: 'German' },
  { id: 'es-ES', label: 'Spanish (Spain)', shortLabel: 'Spanish' },
  { id: 'fr-FR', label: 'French (France)', shortLabel: 'French' },
];

/** Falls back to the raw tag so an unknown language still reads sensibly. */
export function languageShortLabel(id: string): string {
  return PROOFING_LANGUAGES.find((language) => language.id === id)?.shortLabel ?? id;
}

export function languageLabel(id: string): string {
  return PROOFING_LANGUAGES.find((language) => language.id === id)?.label ?? id;
}
