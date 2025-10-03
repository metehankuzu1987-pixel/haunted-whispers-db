import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeSlug } from "../_shared/normalize-slug.ts";
import { checkForDuplicates } from "../_shared/duplicate-checker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Starting API scan...');
    
    // Create initial scan log
    const { data: logData, error: logError } = await supabase
      .from('ai_scan_logs')
      .insert({
        status: 'running',
        search_query: 'API: Wikidata + Wikipedia + OSM',
        scan_started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating scan log:', logError);
      throw logError;
    }

    const scanLogId = logData.id;
    let foundCount = 0;
    let addedCount = 0;

    // Wikidata SPARQL query for paranormal/haunted places
    const sparqlQuery = `
      SELECT DISTINCT ?place ?placeLabel ?coord ?countryLabel ?description WHERE {
        VALUES ?type {
          wd:Q2160801     # haunted house
          wd:Q5084        # ghost town
          wd:Q39614       # cemetery
          wd:Q44539       # temple (ruins)
          wd:Q23413       # castle (often haunted)
        }
        ?place wdt:P31 ?type .
        OPTIONAL { ?place wdt:P625 ?coord . }
        OPTIONAL { ?place wdt:P17 ?country . }
        OPTIONAL { ?place schema:description ?description . FILTER(LANG(?description) = "en") }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT 50
    `;

    const wikidataUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
    
    console.log('Fetching from Wikidata...');
    const wikidataResponse = await fetch(wikidataUrl, {
      headers: { 'User-Agent': 'ParanormalPlacesBot/1.0' }
    });

    if (!wikidataResponse.ok) {
      throw new Error(`Wikidata API error: ${wikidataResponse.status}`);
    }

    const wikidataData = await wikidataResponse.json();
    const results = wikidataData.results?.bindings || [];
    foundCount = results.length;

    console.log(`Found ${foundCount} places from Wikidata`);

    for (const result of results) {
      try {
        const name = result.placeLabel?.value;
        if (!name || name.startsWith('Q')) continue; // Skip items without proper labels

        // Extract coordinates first (needed for duplicate check)
        let lat = null;
        let lon = null;
        if (result.coord?.value) {
          const coordMatch = result.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
          if (coordMatch) {
            lon = parseFloat(coordMatch[1]);
            lat = parseFloat(coordMatch[2]);
          }
        }

        const wikidataId = result.place?.value.split('/').pop() || null;

        // Comprehensive duplicate check
        const duplicateCheck = await checkForDuplicates(supabase, {
          name,
          lat,
          lon,
          wikidata_id: wikidataId,
          osm_id: null
        });

        if (duplicateCheck.isDuplicate && duplicateCheck.existingPlaceId) {
          console.log(`Duplicate found: ${name} - ${duplicateCheck.reason}`);
          
          // Merge sources
          const newSource = {
            url: result.place?.value || 'https://wikidata.org',
            domain: 'wikidata.org',
            type: 'api'
          };
          
          await supabase.rpc('merge_place_sources', {
            target_place_id: duplicateCheck.existingPlaceId,
            new_sources: [newSource]
          });
          
          continue;
        }

        // Generate slug using shared utility
        const slug = normalizeSlug(name);

        // Extract country
        const countryLabel = result.countryLabel?.value || 'Unknown';
        const countryCode = countryLabel.substring(0, 2).toUpperCase();

        // Description from Wikidata
        let description = result.description?.value || null;

        // Try to get more detailed description from Wikipedia if available
        if (!description && result.place?.value) {
          const wikidataId = result.place.value.split('/').pop();
          try {
            // Get Wikipedia page title from Wikidata ID
            const wikiResponse = await fetch(
              `https://en.wikipedia.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=sitelinks&sitefilter=enwiki&format=json`
            );
            const wikiData = await wikiResponse.json();
            const pageTitle = wikiData.entities?.[wikidataId]?.sitelinks?.enwiki?.title;

            if (pageTitle) {
              // Get extract from Wikipedia
              const extractResponse = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(pageTitle)}&format=json`
              );
              const extractData = await extractResponse.json();
              const pages = extractData.query?.pages;
              if (pages) {
                const pageId = Object.keys(pages)[0];
                description = pages[pageId]?.extract?.substring(0, 500) || description;
              }
            }
          } catch (wikiError) {
            console.error('Error fetching Wikipedia data:', wikiError);
          }
        }

        // Determine category based on type
        let category = 'haunted';
        const typeUri = results.find((r: any) => r.placeLabel?.value === name)?.type?.value;
        if (typeUri?.includes('Q5084')) category = 'abandoned';
        if (typeUri?.includes('Q39614')) category = 'cemetery';

        // Calculate evidence score (API data gets lower score than AI verified)
        const evidenceScore = Math.floor(Math.random() * 30) + 40; // 40-70

        // Insert place
        const { error: insertError } = await supabase
          .from('places')
          .insert({
            name,
            slug,
            category,
            description,
            country_code: countryCode,
            city: null,
            lat,
            lon,
            wikidata_id: result.place?.value.split('/').pop() || null,
            evidence_score: evidenceScore,
            status: 'pending',
            ai_collected: 0, // API collected, not AI
            human_approved: 0,
            sources_json: [
              {
                url: result.place?.value || 'https://wikidata.org',
                domain: 'wikidata.org',
                type: 'api'
              }
            ]
          });

        if (insertError) {
          console.error('Error inserting place:', insertError);
        } else {
          addedCount++;
          console.log(`Added: ${name}`);
        }

      } catch (placeError) {
        console.error('Error processing place:', placeError);
      }
    }

    // Update scan log
    await supabase
      .from('ai_scan_logs')
      .update({
        status: 'completed',
        places_found: foundCount,
        places_added: addedCount,
        scan_completed_at: new Date().toISOString()
      })
      .eq('id', scanLogId);

    console.log(`API scan completed. Found: ${foundCount}, Added: ${addedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `API scan completed. Found ${foundCount} places, added ${addedCount} new places.`,
        foundCount,
        addedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in api-scan:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
