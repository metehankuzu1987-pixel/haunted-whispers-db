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

    const { category = 'haunted_location', country = 'TR', enabledApis = [], location, limit = 20 } = await req.json();

    const near = resolveLocation(country, location);
    console.log('Multi-scan started', { category, country, near, enabledApis, limit });

    // Fetch API keys from database
    const { data: apiSettings } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['google_places_api_key', 'foursquare_api_key', 'geonames_username']);
    
    const apiKeys: Record<string, string> = {};
    if (apiSettings) {
      apiSettings.forEach(setting => {
        apiKeys[setting.setting_key] = setting.setting_value || '';
      });
    }

    const allPlaces: Place[] = [];
    const errors: string[] = [];

    // 1. DBpedia API (No key required)
    if (enabledApis.includes('dbpedia')) {
      try {
        console.log('Fetching from DBpedia...');
        const dbpediaPlaces = await fetchFromDBpedia(category, country, limit);
        allPlaces.push(...dbpediaPlaces);
        console.log(`DBpedia found ${dbpediaPlaces.length} places`);
      } catch (error) {
        const err = error as Error;
        errors.push(`DBpedia error: ${err.message}`);
      }
    }

    // 2. Foursquare API (Requires key)
    if (enabledApis.includes('foursquare')) {
      const foursquareKey = apiKeys['foursquare_api_key'];
      if (foursquareKey) {
        try {
          console.log('Fetching from Foursquare...');
          const foursquarePlaces = await fetchFromFoursquare(category, near, limit, foursquareKey);
          allPlaces.push(...foursquarePlaces);
          console.log(`Foursquare found ${foursquarePlaces.length} places`);
        } catch (error) {
          const err = error as Error;
          console.error('Foursquare API error details:', err);
          errors.push(`Foursquare error: ${err.message}`);
        }
      } else {
        console.error('Foursquare API key not configured');
        errors.push('Foursquare API key not configured');
      }
    }

    // 3. Google Places API (Requires key)
    if (enabledApis.includes('google')) {
      const googleKey = apiKeys['google_places_api_key'];
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
      const geonamesUsername = apiKeys['geonames_username'];
      if (geonamesUsername) {
        try {
          console.log('Fetching from GeoNames...');
          const geonamesPlaces = await fetchFromGeoNames(category, country, geonamesUsername, limit);
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

async function fetchFromDBpedia(category: string, country: string, limit: number): Promise<Place[]> {
  const capped = Math.min(Math.max(limit || 20, 1), 50);
  const query = `
    PREFIX dbo: <http://dbpedia.org/ontology/>
    PREFIX dbr: <http://dbpedia.org/resource/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>
    
    SELECT DISTINCT ?place ?label ?abstract ?lat ?long WHERE {
      ?place a dbo:Place ;
             rdfs:label ?label ;
             dbo:abstract ?abstract .
      OPTIONAL { ?place geo:lat ?lat ; geo:long ?long . }
      FILTER (LANG(?label) = 'en')
      FILTER (LANG(?abstract) = 'en')
      FILTER (CONTAINS(LCASE(?abstract), "haunted") OR CONTAINS(LCASE(?abstract), "ghost") OR CONTAINS(LCASE(?abstract), "paranormal"))
    } LIMIT ${capped}
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

async function fetchFromFoursquare(category: string, near: string, limit: number, apiKey: string): Promise<Place[]> {
  const query = category === 'haunted_location' ? 'haunted,ghost,paranormal' : category;
  const capped = Math.min(Math.max(limit || 20, 1), 50);
  const url = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&near=${encodeURIComponent(near)}&limit=${capped}`;
  
  console.log('Foursquare request URL:', url);
  console.log('Foursquare API key length:', apiKey?.length || 0);
  
  const response = await fetch(url, {
    headers: { 
      'Authorization': apiKey,
      'Accept': 'application/json'
    }
  });

  console.log('Foursquare response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Foursquare error response:', errorText);
    throw new Error(`Foursquare API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('Foursquare data received:', JSON.stringify(data).substring(0, 200));
  
  return (data.results || []).map((item: any) => ({
    name: item.name,
    category: 'haunted_location',
    description: item.description,
    country_code: '',
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

async function fetchFromGeoNames(category: string, country: string, username: string, limit: number): Promise<Place[]> {
  const capped = Math.min(Math.max(limit || 20, 1), 100);
  
  // Category-based query mapping
  const queryMap: Record<string, string> = {
    'haunted_location': 'haunted ghost abandoned',
    'cursed_site': 'cursed mysterious',
    'forgotten_village': 'village abandoned old',
  };
  
  const query = queryMap[category] || 'haunted';
  
  // Make country filter optional - if empty, search globally
  const countryParam = country ? `&country=${country}` : '';
  const url = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(query)}${countryParam}&maxRows=${capped}&username=${username}`;
  
  console.log('GeoNames request URL:', url);
  
  const response = await fetch(url);

  if (!response.ok) throw new Error(`GeoNames error: ${response.status}`);
  
  const data = await response.json();
  console.log('GeoNames results count:', data.geonames?.length || 0);
  
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
  try {
    const searchTerm = category === 'haunted_location' ? 'haunted' : 'abandoned';
    const url = `https://www.atlasobscura.com/search?q=${encodeURIComponent(searchTerm)}`;
    
    console.log('Atlas Obscura request URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DataCollector/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    if (!response.ok) {
      console.error('Atlas Obscura error:', response.status);
      return [];
    }
    
    const html = await response.text();
    const places: Place[] = [];
    
    // Regex patterns for scraping
    const titleRegex = /<a[^>]*class="[^"]*content-card__title[^"]*"[^>]*>([^<]+)<\/a>/g;
    const locationRegex = /<div[^>]*class="[^"]*content-card__location[^"]*"[^>]*>([^<]+)<\/div>/g;
    const linkRegex = /<a[^>]*href="(\/places\/[^"]+)"[^>]*class="[^"]*content-card/g;
    
    const titles: string[] = [];
    const locations: string[] = [];
    const links: string[] = [];
    
    let match;
    while ((match = titleRegex.exec(html)) !== null) {
      titles.push(match[1].trim());
    }
    while ((match = locationRegex.exec(html)) !== null) {
      locations.push(match[1].trim());
    }
    while ((match = linkRegex.exec(html)) !== null) {
      links.push(`https://www.atlasobscura.com${match[1]}`);
    }
    
    console.log(`Atlas Obscura scraped: ${titles.length} titles, ${locations.length} locations, ${links.length} links`);
    
    // Combine results (max 20)
    const count = Math.min(titles.length, locations.length, links.length, 20);
    for (let i = 0; i < count; i++) {
      const locationParts = locations[i].split(',').map(s => s.trim());
      const city = locationParts[0] || '';
      const countryName = locationParts[locationParts.length - 1] || '';
      
      // Try to extract country code from country name
      const countryCodeMap: Record<string, string> = {
        'United States': 'US', 'Turkey': 'TR', 'United Kingdom': 'GB',
        'Germany': 'DE', 'France': 'FR', 'Italy': 'IT', 'Japan': 'JP',
        'Spain': 'ES', 'Mexico': 'MX', 'Canada': 'CA', 'Australia': 'AU'
      };
      const countryCode = countryCodeMap[countryName] || country || '';
      
      places.push({
        name: titles[i],
        category: 'haunted_location',
        description: `Atlas Obscura featured location in ${locations[i]}`,
        country_code: countryCode,
        city: city,
        lat: undefined,
        lon: undefined,
        sources: [{
          url: links[i],
          domain: 'atlasobscura.com',
          type: 'website',
        }],
      });
    }
    
    console.log(`Atlas Obscura returning ${places.length} places`);
    return places;
    
  } catch (error) {
    const err = error as Error;
    console.error('Atlas Obscura scraping error:', err.message);
    return [];
  }
}

function resolveLocation(country: string, location?: string): string {
  if (location && location.trim().length > 0) return location.trim();
  const map: Record<string, string> = {
    TR: 'Turkey', US: 'United States', UK: 'United Kingdom', GB: 'United Kingdom',
    DE: 'Germany', FR: 'France', IT: 'Italy', JP: 'Japan', UA: 'Ukraine'
  };
  const code = (country || '').toUpperCase();
  return map[code] || country;
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
