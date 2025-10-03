import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeSlug } from "../_shared/normalize-slug.ts";
import { checkForDuplicates } from "../_shared/duplicate-checker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Place {
  name: string;
  category: string;
  description?: string;
  country_code: string;
  city?: string;
  lat?: number;
  lon?: number;
  sources: Array<{
    url: string;
    domain: string;
    type: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { category = 'haunted_location', country = 'TR', enabledApis = [] } = await req.json();

    console.log('Multi-scan started', { category, country, enabledApis });

    const allPlaces: Place[] = [];
    const errors: string[] = [];

    // 1. DBpedia API (No key required)
    if (enabledApis.includes('dbpedia')) {
      try {
        console.log('Fetching from DBpedia...');
        const dbpediaPlaces = await fetchFromDBpedia(category, country);
        allPlaces.push(...dbpediaPlaces);
        console.log(`DBpedia found ${dbpediaPlaces.length} places`);
      } catch (error) {
        const err = error as Error;
        errors.push(`DBpedia error: ${err.message}`);
      }
    }

    // 2. Foursquare API (Requires key)
    if (enabledApis.includes('foursquare')) {
      const foursquareKey = Deno.env.get('FOURSQUARE_API_KEY');
      if (foursquareKey) {
        try {
          console.log('Fetching from Foursquare...');
          const foursquarePlaces = await fetchFromFoursquare(category, country, foursquareKey);
          allPlaces.push(...foursquarePlaces);
          console.log(`Foursquare found ${foursquarePlaces.length} places`);
        } catch (error) {
          const err = error as Error;
          errors.push(`Foursquare error: ${err.message}`);
        }
      } else {
        errors.push('Foursquare API key not configured');
      }
    }

    // 3. Google Places API (Requires key)
    if (enabledApis.includes('google')) {
      const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
      if (googleKey) {
        try {
          console.log('Fetching from Google Places...');
          const googlePlaces = await fetchFromGoogle(category, country, googleKey);
          allPlaces.push(...googlePlaces);
          console.log(`Google Places found ${googlePlaces.length} places`);
        } catch (error) {
          const err = error as Error;
          errors.push(`Google error: ${err.message}`);
        }
      } else {
        errors.push('Google Places API key not configured');
      }
    }

    // 4. GeoNames API (Requires username)
    if (enabledApis.includes('geonames')) {
      const geonamesUsername = Deno.env.get('GEONAMES_USERNAME');
      if (geonamesUsername) {
        try {
          console.log('Fetching from GeoNames...');
          const geonamesPlaces = await fetchFromGeoNames(category, country, geonamesUsername);
          allPlaces.push(...geonamesPlaces);
          console.log(`GeoNames found ${geonamesPlaces.length} places`);
        } catch (error) {
          const err = error as Error;
          errors.push(`GeoNames error: ${err.message}`);
        }
      } else {
        errors.push('GeoNames username not configured');
      }
    }

    // 5. Atlas Obscura (Web scraping - No key required)
    if (enabledApis.includes('atlas')) {
      try {
        console.log('Fetching from Atlas Obscura...');
        const atlasPlaces = await fetchFromAtlasObscura(category, country);
        allPlaces.push(...atlasPlaces);
        console.log(`Atlas Obscura found ${atlasPlaces.length} places`);
      } catch (error) {
        const err = error as Error;
        errors.push(`Atlas Obscura error: ${err.message}`);
      }
    }

    // Deduplicate places
    const uniquePlaces = deduplicatePlaces(allPlaces);
    console.log(`Total unique places: ${uniquePlaces.length}`);

    // Save to database with comprehensive duplicate check
    let addedCount = 0;
    for (const place of uniquePlaces) {
      const slug = normalizeSlug(place.name);
      
      // Comprehensive duplicate check
      const duplicateCheck = await checkForDuplicates(supabase, {
        name: place.name,
        lat: place.lat,
        lon: place.lon,
        wikidata_id: null,
        osm_id: null
      });

      if (duplicateCheck.isDuplicate && duplicateCheck.existingPlaceId) {
        console.log(`Duplicate found: ${place.name} - ${duplicateCheck.reason}`);
        
        // Merge sources
        await supabase.rpc('merge_place_sources', {
          target_place_id: duplicateCheck.existingPlaceId,
          new_sources: place.sources
        });
        
        continue;
      }
      
      // Insert new place
      const { error } = await supabase.from('places').insert({
        name: place.name,
        slug,
        category: place.category,
        description: place.description,
        country_code: place.country_code,
        city: place.city,
        lat: place.lat,
        lon: place.lon,
        sources_json: place.sources,
        status: 'pending',
        ai_collected: 0,
        evidence_score: place.sources.length * 10,
      });

      if (!error) addedCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_found: allPlaces.length,
        unique_places: uniquePlaces.length,
        added: addedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Multi-scan error:', error);
    const err = error as Error;
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchFromDBpedia(category: string, country: string): Promise<Place[]> {
  const query = `
    PREFIX dbo: <http://dbpedia.org/ontology/>
    PREFIX dbr: <http://dbpedia.org/resource/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?place ?label ?abstract ?lat ?long WHERE {
      ?place a dbo:Place ;
             rdfs:label ?label ;
             dbo:abstract ?abstract .
      OPTIONAL { ?place geo:lat ?lat ; geo:long ?long . }
      FILTER (LANG(?label) = 'en')
      FILTER (LANG(?abstract) = 'en')
      FILTER (CONTAINS(LCASE(?abstract), "haunted") || CONTAINS(LCASE(?abstract), "ghost") || CONTAINS(LCASE(?abstract), "paranormal"))
    } LIMIT 50
  `;

  const response = await fetch('https://dbpedia.org/sparql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: `query=${encodeURIComponent(query)}`,
  });

  if (!response.ok) throw new Error(`DBpedia error: ${response.status}`);
  
  const data = await response.json();
  return (data.results?.bindings || []).map((item: any) => ({
    name: item.label?.value || 'Unknown',
    category: 'haunted_location',
    description: item.abstract?.value?.substring(0, 500),
    country_code: country,
    lat: parseFloat(item.lat?.value),
    lon: parseFloat(item.long?.value),
    sources: [{
      url: item.place?.value || 'https://dbpedia.org',
      domain: 'dbpedia.org',
      type: 'database',
    }],
  }));
}

async function fetchFromFoursquare(category: string, country: string, apiKey: string): Promise<Place[]> {
  const query = category === 'haunted_location' ? 'haunted,ghost,paranormal' : category;
  const response = await fetch(
    `https://api.foursquare.com/v3/places/search?query=${query}&near=${country}&limit=50`,
    { headers: { 'Authorization': apiKey, 'Accept': 'application/json' } }
  );

  if (!response.ok) throw new Error(`Foursquare error: ${response.status}`);
  
  const data = await response.json();
  return (data.results || []).map((item: any) => ({
    name: item.name,
    category: 'haunted_location',
    description: item.description,
    country_code: country,
    city: item.location?.locality,
    lat: item.geocodes?.main?.latitude,
    lon: item.geocodes?.main?.longitude,
    sources: [{
      url: `https://foursquare.com/v/${item.fsq_id}`,
      domain: 'foursquare.com',
      type: 'api',
    }],
  }));
}

async function fetchFromGoogle(category: string, country: string, apiKey: string): Promise<Place[]> {
  const query = category === 'haunted_location' ? 'haunted places' : category;
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + country)}&key=${apiKey}`
  );

  if (!response.ok) throw new Error(`Google error: ${response.status}`);
  
  const data = await response.json();
  return (data.results || []).map((item: any) => ({
    name: item.name,
    category: 'haunted_location',
    description: item.formatted_address,
    country_code: country,
    lat: item.geometry?.location?.lat,
    lon: item.geometry?.location?.lng,
    sources: [{
      url: `https://www.google.com/maps/place/?q=place_id:${item.place_id}`,
      domain: 'google.com',
      type: 'api',
    }],
  }));
}

async function fetchFromGeoNames(category: string, country: string, username: string): Promise<Place[]> {
  const response = await fetch(
    `http://api.geonames.org/searchJSON?q=haunted&country=${country}&maxRows=50&username=${username}`
  );

  if (!response.ok) throw new Error(`GeoNames error: ${response.status}`);
  
  const data = await response.json();
  return (data.geonames || []).map((item: any) => ({
    name: item.name,
    category: 'haunted_location',
    description: item.fcodeName,
    country_code: item.countryCode,
    city: item.adminName1,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lng),
    sources: [{
      url: `http://www.geonames.org/${item.geonameId}`,
      domain: 'geonames.org',
      type: 'database',
    }],
  }));
}

async function fetchFromAtlasObscura(category: string, country: string): Promise<Place[]> {
  // Simple scraping approach - in production, use a proper scraping service
  try {
    const response = await fetch(`https://www.atlasobscura.com/places?q=haunted`);
    if (!response.ok) throw new Error(`Atlas Obscura error: ${response.status}`);
    
    // This is a simplified version - real implementation would parse HTML
    return [];
  } catch (error) {
    const err = error as Error;
    console.log('Atlas Obscura scraping skipped:', err.message);
    return [];
  }
}

function deduplicatePlaces(places: Place[]): Place[] {
  const seen = new Map<string, Place>();
  
  for (const place of places) {
    const key = `${place.name.toLowerCase()}-${place.lat?.toFixed(2)}-${place.lon?.toFixed(2)}`;
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, place);
    } else {
      // Merge sources
      existing.sources.push(...place.sources);
    }
  }
  
  return Array.from(seen.values());
}
