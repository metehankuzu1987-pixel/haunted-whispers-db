import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeSlug, extractExternalId } from "./normalize-slug.ts";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingPlaceId?: string;
  reason?: string;
  similarPlaces?: any[];
}

export async function checkForDuplicates(
  supabase: SupabaseClient,
  place: {
    name: string;
    lat?: number | null;
    lon?: number | null;
    wikidata_id?: string | null;
    osm_id?: string | null;
  }
): Promise<DuplicateCheckResult> {
  
  // 1. External ID kontrolü (en güvenilir)
  const externalId = extractExternalId(
    place.wikidata_id || null,
    place.osm_id || null
  );
  
  if (externalId) {
    const column = externalId.type === 'wikidata' ? 'wikidata_id' : 'osm_id';
    const { data } = await supabase
      .from('places')
      .select('id')
      .eq(column, externalId.id)
      .maybeSingle();
    
    if (data) {
      return {
        isDuplicate: true,
        existingPlaceId: data.id,
        reason: `Duplicate ${externalId.type} ID: ${externalId.id}`
      };
    }
  }
  
  // 2. Slug kontrolü
  const slug = normalizeSlug(place.name);
  const { data: slugMatch } = await supabase
    .from('places')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  
  if (slugMatch) {
    return {
      isDuplicate: true,
      existingPlaceId: slugMatch.id,
      reason: `Duplicate slug: ${slug}`
    };
  }
  
  // 3. Fuzzy name matching + koordinat yakınlığı
  if (place.lat && place.lon) {
    const { data: similarPlaces, error } = await supabase
      .rpc('find_similar_places', {
        p_name: place.name,
        p_lat: place.lat,
        p_lon: place.lon,
        p_similarity_threshold: 0.75
      });
    
    if (!error && similarPlaces && similarPlaces.length > 0) {
      // İlk sonuç %90+ benzer VE 1km içindeyse kesin duplikat
      const topMatch = similarPlaces[0];
      if (topMatch.similarity_score > 0.9 && topMatch.distance_km !== null && topMatch.distance_km < 1) {
        return {
          isDuplicate: true,
          existingPlaceId: topMatch.place_id,
          reason: `Similar name (${Math.round(topMatch.similarity_score * 100)}%) and close location (${topMatch.distance_km.toFixed(2)}km)`,
          similarPlaces
        };
      }
      
      // Olası duplikatlar varsa uyar ama engelleme
      return {
        isDuplicate: false,
        similarPlaces
      };
    }
  }
  
  return { isDuplicate: false };
}
