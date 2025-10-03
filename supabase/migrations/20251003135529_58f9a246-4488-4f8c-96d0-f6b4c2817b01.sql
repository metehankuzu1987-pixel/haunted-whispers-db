-- Fix security warnings: Set search_path for find_similar_places function
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
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;