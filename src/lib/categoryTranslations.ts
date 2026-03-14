import { TFunction } from 'i18next';

// Maps default category names (stored in Portuguese in the DB) to i18n keys
const CATEGORY_KEY_MAP: Record<string, string> = {
  'alimentação': 'defaultCategories.food',
  'transporte': 'defaultCategories.transport',
  'moradia': 'defaultCategories.housing',
  'saúde': 'defaultCategories.health',
  'entretenimento': 'defaultCategories.entertainment',
  'educação': 'defaultCategories.education',
  'vestuário': 'defaultCategories.clothing',
  'outros': 'defaultCategories.other',
  'salário': 'defaultCategories.salary',
  'freelance': 'defaultCategories.freelance',
  'investimentos': 'defaultCategories.investments',
  'projetos': 'defaultCategories.projects',
};

/**
 * Translates a category name if it's a known default category.
 * Custom user-created categories are returned as-is.
 */
export function translateCategoryName(name: string | undefined, t: TFunction): string {
  if (!name) return t('categories.uncategorized', 'Sem categoria');
  const key = CATEGORY_KEY_MAP[name.toLowerCase()];
  return key ? t(key, name) : name;
}

/**
 * Returns the original (Portuguese) name for emoji/gradient matching,
 * regardless of current language.
 */
export function getOriginalCategoryKey(name: string | undefined): string {
  return name?.toLowerCase() || '';
}
