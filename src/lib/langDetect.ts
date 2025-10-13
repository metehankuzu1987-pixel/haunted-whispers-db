// Simple language detection helper
// Detects Turkish if text contains Turkish-specific characters, otherwise assumes English
const TURKISH_CHARS = /[ğĞüÜşŞıİöÖçÇ]/;

export function detectLang(text: string): 'tr' | 'en' {
  if (!text || text.trim().length === 0) return 'tr';
  return TURKISH_CHARS.test(text) ? 'tr' : 'en';
}
