// i18n Çeviri Sistemi
export type Language = 'tr' | 'en';

export const translations = {
  tr: {
    'app.title': 'Tabirly Haunted DB',
    'app.subtitle': 'Dünyanın Lanetli ve Perili Yerleri',
    
    'disclosure.aiCollected': 'AI ile toplandı',
    'disclosure.aiTooltip': 'Bu bilgiler açık kaynaklardan otomatik tarandı',
    'disclosure.humanApproved': 'İnsan onaylı',
    'disclosure.humanTooltip': 'Moderatör/topluluk onayından geçti',
    
    'nav.home': 'Anasayfa',
    'nav.back': 'Geri',
    'nav.refresh': 'Yenile',
    'nav.admin': 'Admin',
    
    'filters.title': 'Filtrele',
    'filters.search': 'Ara',
    'filters.country': 'Ülke',
    'filters.city': 'Şehir',
    'filters.category': 'Kategori',
    'filters.score': 'Doğrulama puanı',
    'filters.sort': 'Sırala',
    'filters.apply': 'Uygula',
    'filters.clear': 'Temizle',
    
    'sort.score': 'Puan',
    'sort.new': 'En yeni',
    'sort.votes': 'En çok oy',
    'sort.az': 'A-Z',
    
    'category.cursed': 'Lanetli',
    'category.haunted': 'Perili',
    'category.legend': 'Efsane',
    'category.abandoned': 'Terk edilmiş',
    'category.hotel': 'Otel',
    'category.school': 'Okul',
    'category.hospital': 'Hastane',
    'category.castle': 'Kale',
    'category.forest': 'Orman',
    
    'list.noResults': 'Sonuç bulunamadı',
    'list.loading': 'Yükleniyor...',
    'list.results': 'sonuç',
    
    'place.detail': 'Detay',
    'place.sources': 'Kaynaklar',
    'place.coordinates': 'Koordinatlar',
    'place.score': 'Doğrulama',
    'place.scoreTooltip': 'Kaynak sayısı ve güvenilirliğe göre hesaplanır',
    'place.readMore': 'Daha fazla',
    'place.readLess': 'Daha az',
    
    'vote.title': 'Bu bilgi güvenilir mi?',
    'vote.up': 'Güvenilir',
    'vote.down': 'Şüpheli',
    'vote.success': 'Oyunuz kaydedildi',
    
    'rating.title': 'Puanla',
    'rating.success': 'Puanınız kaydedildi',
    
    'comments.title': 'Yorumlar',
    'comments.add': 'Yorum ekle',
    'comments.nickname': 'Takma ad',
    'comments.message': 'Mesaj (max 200 karakter)',
    'comments.submit': 'Gönder',
    'comments.success': 'Yorumunuz eklendi',
    'comments.empty': 'Henüz yorum yok',
    
    'report.button': 'Hata bildir',
    'report.title': 'Hata bildirimi',
    'report.category': 'Kategori',
    'report.message': 'Açıklama',
    'report.submit': 'Gönder',
    'report.success': 'Bildiriminiz alındı',
    
    'footer.openData': 'Açık veri ile beslenir',
    'footer.removal': 'Kaldırma talebi',
    'footer.contact': 'İletişim',
    'footer.version': 'Sürüm',
  },
  
  en: {
    'app.title': 'Tabirly Haunted DB',
    'app.subtitle': 'World\'s Cursed and Haunted Places',
    
    'disclosure.aiCollected': 'AI collected',
    'disclosure.aiTooltip': 'Automatically scraped from open sources',
    'disclosure.humanApproved': 'Human approved',
    'disclosure.humanTooltip': 'Verified by moderator/community',
    
    'nav.home': 'Home',
    'nav.back': 'Back',
    'nav.refresh': 'Refresh',
    'nav.admin': 'Admin',
    
    'filters.title': 'Filter',
    'filters.search': 'Search',
    'filters.country': 'Country',
    'filters.city': 'City',
    'filters.category': 'Category',
    'filters.score': 'Verification score',
    'filters.sort': 'Sort',
    'filters.apply': 'Apply',
    'filters.clear': 'Clear',
    
    'sort.score': 'Score',
    'sort.new': 'Newest',
    'sort.votes': 'Most voted',
    'sort.az': 'A-Z',
    
    'category.cursed': 'Cursed',
    'category.haunted': 'Haunted',
    'category.legend': 'Legend',
    'category.abandoned': 'Abandoned',
    'category.hotel': 'Hotel',
    'category.school': 'School',
    'category.hospital': 'Hospital',
    'category.castle': 'Castle',
    'category.forest': 'Forest',
    
    'list.noResults': 'No results found',
    'list.loading': 'Loading...',
    'list.results': 'results',
    
    'place.detail': 'Details',
    'place.sources': 'Sources',
    'place.coordinates': 'Coordinates',
    'place.score': 'Verification',
    'place.scoreTooltip': 'Calculated based on source count and reliability',
    'place.readMore': 'Read more',
    'place.readLess': 'Read less',
    
    'vote.title': 'Is this information reliable?',
    'vote.up': 'Reliable',
    'vote.down': 'Suspicious',
    'vote.success': 'Vote recorded',
    
    'rating.title': 'Rate',
    'rating.success': 'Rating recorded',
    
    'comments.title': 'Comments',
    'comments.add': 'Add comment',
    'comments.nickname': 'Nickname',
    'comments.message': 'Message (max 200 chars)',
    'comments.submit': 'Submit',
    'comments.success': 'Comment added',
    'comments.empty': 'No comments yet',
    
    'report.button': 'Report error',
    'report.title': 'Error report',
    'report.category': 'Category',
    'report.message': 'Description',
    'report.submit': 'Submit',
    'report.success': 'Report received',
    
    'footer.openData': 'Powered by open data',
    'footer.removal': 'Removal request',
    'footer.contact': 'Contact',
    'footer.version': 'Version',
  }
};

export const useTranslation = (lang: Language = 'tr') => {
  const t = (key: keyof typeof translations.tr): string => {
    return translations[lang][key] || translations.tr[key] || key;
  };
  
  return { t };
};