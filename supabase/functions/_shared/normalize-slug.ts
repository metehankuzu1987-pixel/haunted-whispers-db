// Gelişmiş slug normalizasyon fonksiyonu
export function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Türkçe karakterleri dönüştür
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    // İngilizce ortak kelimeleri temizle
    .replace(/^(the|a|an|le|la|el|il|der|die|das)\s+/i, '')
    // Parantez içindeki bilgileri koru ama düzelt
    .replace(/\s*\(.*?\)\s*/g, '-')
    // Özel karakterleri temizle
    .replace(/[^a-z0-9]+/g, '-')
    // Başta ve sonda tire olmasın
    .replace(/^-+|-+$/g, '')
    // Art arda gelen tireleri tek tireye indir
    .replace(/-+/g, '-');
}

// Koordinat tabanlı hash (benzer lokasyonları gruplamak için)
export function getLocationHash(lat: number | null, lon: number | null): string | null {
  if (lat === null || lon === null) return null;
  // 0.01 derece hassasiyetle (~1km) grid oluştur
  const latRounded = Math.round(lat * 100) / 100;
  const lonRounded = Math.round(lon * 100) / 100;
  return `${latRounded},${lonRounded}`;
}

// Wikidata/OSM ID'den unique identifier oluştur
export function extractExternalId(
  wikidataId: string | null,
  osmId: string | null
): { type: string; id: string } | null {
  if (wikidataId) return { type: 'wikidata', id: wikidataId };
  if (osmId) return { type: 'osm', id: osmId };
  return null;
}
