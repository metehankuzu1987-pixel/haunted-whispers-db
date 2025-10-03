-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add UNIQUE constraints
ALTER TABLE places ADD CONSTRAINT places_slug_unique UNIQUE (slug);
CREATE UNIQUE INDEX places_wikidata_id_unique ON places (wikidata_id) WHERE wikidata_id IS NOT NULL;
CREATE UNIQUE INDEX places_osm_id_unique ON places (osm_id) WHERE osm_id IS NOT NULL;

-- Create GIN index for fuzzy name search
CREATE INDEX places_name_trgm_idx ON places USING gin (name gin_trgm_ops);

-- Function to find similar places
CREATE OR REPLACE FUNCTION find_similar_places(
  p_name TEXT,
  p_lat REAL DEFAULT NULL,
  p_lon REAL DEFAULT NULL,
  p_similarity_threshold REAL DEFAULT 0.75
)
RETURNS TABLE (
  place_id UUID,
  place_name TEXT,
  place_slug TEXT,
  similarity_score REAL,
  distance_km REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    name,
    slug,
    similarity(name, p_name) as sim_score,
    CASE 
      WHEN p_lat IS NOT NULL AND lat IS NOT NULL THEN
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(p_lat)) * cos(radians(lat)) * 
            cos(radians(lon) - radians(p_lon)) + 
            sin(radians(p_lat)) * sin(radians(lat))
          ))
        )
      ELSE NULL
    END as dist
  FROM places
  WHERE similarity(name, p_name) > p_similarity_threshold
    OR (
      p_lat IS NOT NULL 
      AND lat IS NOT NULL 
      AND (
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(p_lat)) * cos(radians(lat)) * 
            cos(radians(lon) - radians(p_lon)) + 
            sin(radians(p_lat)) * sin(radians(lat))
          ))
        )
      ) < 1.0
    )
  ORDER BY sim_score DESC, dist ASC NULLS LAST
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to merge place sources
CREATE OR REPLACE FUNCTION merge_place_sources(
  target_place_id UUID,
  new_sources JSONB
)
RETURNS VOID AS $$
DECLARE
  existing_sources JSONB;
  merged_sources JSONB;
BEGIN
  SELECT sources_json INTO existing_sources
  FROM places
  WHERE id = target_place_id;
  
  merged_sources := (
    SELECT jsonb_agg(DISTINCT source)
    FROM (
      SELECT jsonb_array_elements(COALESCE(existing_sources, '[]'::jsonb)) as source
      UNION
      SELECT jsonb_array_elements(new_sources) as source
    ) combined
  );
  
  UPDATE places
  SET 
    sources_json = merged_sources,
    evidence_score = LEAST(100, evidence_score + 5),
    ai_scan_count = ai_scan_count + 1,
    last_ai_scan_at = NOW(),
    updated_at = NOW()
  WHERE id = target_place_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;