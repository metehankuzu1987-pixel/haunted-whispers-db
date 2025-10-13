// Category translation dictionary - maps technical category keys to human-friendly labels
export const categoryTranslations: Record<string, { tr: string; en: string }> = {
  'Perili Mekan': { tr: 'Perili Mekan', en: 'Haunted Location' },
  'Lanetli Alan': { tr: 'Lanetli Alan', en: 'Cursed Site' },
  'Gizemli Yer': { tr: 'Gizemli Yer', en: 'Mysterious Place' },
  'Paranormal Olay': { tr: 'Paranormal Olay', en: 'Paranormal Event' },
  'UFO Görülmesi': { tr: 'UFO Görülmesi', en: 'UFO Sighting' },
  'Şeytan Çıkarma': { tr: 'Şeytan Çıkarma', en: 'Exorcism' },
  'Hayalet Şehir': { tr: 'Hayalet Şehir', en: 'Ghost Town' },
  'Terk Edilmiş Bina': { tr: 'Terk Edilmiş Bina', en: 'Abandoned Building' },
  'Mezarlık': { tr: 'Mezarlık', en: 'Cemetery' },
  'Efsanevi Yer': { tr: 'Efsanevi Yer', en: 'Legendary Place' },
};

// Helper to get translated category label
export function getCategoryLabel(category: string, lang: 'tr' | 'en'): string {
  const translation = categoryTranslations[category];
  if (translation) {
    return translation[lang];
  }
  // Fallback: return the category as-is
  return category;
}
