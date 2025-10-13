import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeSlug } from "../_shared/normalize-slug.ts";
import { checkForDuplicates } from "../_shared/duplicate-checker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper functions
async function fetchFromLovableAI(apiKey: string, prompt: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const error: any = new Error(`Lovable AI error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("No content from Lovable AI");
  
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : (parsed.places || []);
}

async function fetchFromOpenAI(apiKey: string, model: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("No content from OpenAI");
  
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : (parsed.places || []);
}

function deduplicatePlaces(places: any[]) {
  const seen = new Set();
  return places.filter(place => {
    const key = `${place.name}-${place.country_code}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("AI scan started");

    // Get AI provider settings
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['ai_provider_scan', 'openai_api_key', 'ai_model']);

    const settings = Object.fromEntries(
      settingsData?.map(s => [s.setting_key, s.setting_value]) || []
    );

    const provider = settings.ai_provider_scan || 'lovable';
    const openaiKey = settings.openai_api_key || '';
    const aiModel = settings.ai_model || 'gpt-4o-mini';

    // Create scan log
    const { data: scanLog } = await supabase
      .from("ai_scan_logs")
      .insert({
        status: "running",
        search_query: "haunted places, abandoned hospitals, creepy locations"
      })
      .select()
      .single();

    const scanId = scanLog?.id;

    // AI prompt
    const prompt = `Sen bir paranormal araştırmacı asistanısın. Dünya genelinde gizemli, terk edilmiş ve paranormal aktivite ile ilişkilendirilen 3 yeni mekan öner.

Her mekan için şunları sağla:
- name: Mekanın tam adı (Türkçe veya orijinal dil)
- category: Kategori (Terk edilmiş, Hastane, Orman, Şato, Kilise, Köprü, Otel, Diğer'den biri)
- description: Kısa açıklama (max 200 karakter, Türkçe)
- country_code: ISO 2 harfli ülke kodu (örn: TR, US, JP)
- city: Şehir adı
- evidence_score: Güvenilirlik puanı (0-100)
- source: Kaynak URL (Wikipedia, haber sitesi vb.)

JSON array formatında döndür: [{name, category, description, country_code, city, evidence_score, source}]`;

    let allPlaces: any[] = [];
    let notifications: string[] = [];

    // Try Lovable AI first if enabled
    if (provider === 'lovable' || provider === 'both') {
      notifications.push('🔍 Lovable AI taraması başlatılıyor...');
      
      try {
        const lovablePlaces = await fetchFromLovableAI(lovableApiKey, prompt);
        allPlaces.push(...lovablePlaces);
        notifications.push(`✅ Lovable AI: ${lovablePlaces.length} yer bulundu (Ücretsiz)`);
        console.log(`Lovable AI found ${lovablePlaces.length} places`);
      } catch (error: any) {
        console.error("Lovable AI error:", error);
        
        if (error.status === 429) {
          notifications.push('⚠️ Lovable AI rate limit aşıldı!');
          
          // Fallback to OpenAI if in "both" mode
          if (provider === 'both' && openaiKey) {
            notifications.push('🔄 OpenAI\'a geçiliyor...');
            try {
              const openaiPlaces = await fetchFromOpenAI(openaiKey, aiModel, prompt);
              allPlaces.push(...openaiPlaces);
              notifications.push(`✅ OpenAI: ${openaiPlaces.length} yer bulundu (Fallback)`);
              console.log(`OpenAI fallback found ${openaiPlaces.length} places`);
            } catch (openaiError: any) {
              notifications.push(`❌ OpenAI hatası: ${openaiError.message}`);
              throw openaiError;
            }
          } else {
            throw error;
          }
        } else if (error.status === 402) {
          notifications.push('💳 Lovable AI kredisi bitti!');
          
          if (provider === 'both' && openaiKey) {
            notifications.push('🔄 OpenAI\'a geçiliyor...');
            const openaiPlaces = await fetchFromOpenAI(openaiKey, aiModel, prompt);
            allPlaces.push(...openaiPlaces);
            notifications.push(`✅ OpenAI: ${openaiPlaces.length} yer bulundu (Fallback)`);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    // Use OpenAI if it's the only provider
    if (provider === 'openai' && openaiKey) {
      notifications.push('🔍 OpenAI taraması başlatılıyor...');
      
      try {
        const openaiPlaces = await fetchFromOpenAI(openaiKey, aiModel, prompt);
        allPlaces.push(...openaiPlaces);
        
        const estimatedCost = (openaiPlaces.length * 500 * 0.0001).toFixed(4);
        notifications.push(`✅ OpenAI: ${openaiPlaces.length} yer bulundu (~$${estimatedCost})`);
        console.log(`OpenAI found ${openaiPlaces.length} places`);
      } catch (error: any) {
        notifications.push(`❌ OpenAI hatası: ${error.message}`);
        throw error;
      }
    }

    // Deduplicate results
    if (allPlaces.length > 0) {
      notifications.push('🔄 Sonuçlar birleştiriliyor...');
      const uniquePlaces = deduplicatePlaces(allPlaces);
      notifications.push(`✨ ${uniquePlaces.length} benzersiz yer hazır`);
      
      console.log(`Deduplicated to ${uniquePlaces.length} places`);

      // Insert places
      let addedCount = 0;

      for (const place of uniquePlaces) {
        const slug = normalizeSlug(place.name);

        // Check for duplicates
        const duplicateCheck = await checkForDuplicates(supabase, {
          name: place.name,
          lat: place.lat || null,
          lon: place.lon || null,
          wikidata_id: place.wikidata_id || null,
          osm_id: place.osm_id || null
        });

        if (duplicateCheck.isDuplicate && duplicateCheck.existingPlaceId) {
          console.log(`Duplicate found: ${place.name} - ${duplicateCheck.reason}`);
          
          const newSource = {
            url: place.source || 'AI generated',
            type: 'ai',
            domain: place.source ? new URL(place.source).hostname : 'ai.gateway.lovable.dev'
          };
          
          await supabase.rpc('merge_place_sources', {
            target_place_id: duplicateCheck.existingPlaceId,
            new_sources: [newSource]
          });
          
          continue;
        }

        // Insert new place
        const { error: insertError } = await supabase.from("places").insert({
          name: place.name,
          slug,
          category: place.category || "Diğer",
          description: place.description,
          country_code: place.country_code || "XX",
          city: place.city,
          evidence_score: place.evidence_score || 60,
          status: "pending",
          ai_collected: 1,
          human_approved: 0,
          sources_json: place.source ? [{ 
            url: place.source, 
            type: "web", 
            domain: new URL(place.source).hostname 
          }] : [],
          last_ai_scan_at: new Date().toISOString(),
          ai_scan_count: 1
        });

        if (!insertError) {
          addedCount++;
          console.log(`Added place: ${place.name}`);
        } else {
          console.error(`Error inserting ${place.name}:`, insertError);
        }
      }

      notifications.push(`💾 ${addedCount}/${uniquePlaces.length} yer veritabanına eklendi`);

      // Update scan log
      if (scanId) {
        await supabase
          .from("ai_scan_logs")
          .update({
            status: "completed",
            scan_completed_at: new Date().toISOString(),
            places_found: uniquePlaces.length,
            places_added: addedCount
          })
          .eq("id", scanId);
      }

      console.log(`AI scan completed. Added ${addedCount}/${uniquePlaces.length} places`);

      return new Response(
        JSON.stringify({
          success: true,
          places_found: uniquePlaces.length,
          places_added: addedCount,
          notifications,
          provider_used: provider
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error("No places found from any AI provider");
    }
  } catch (error: any) {
    console.error("AI scan error:", error);

    return new Response(
      JSON.stringify({ 
        error: error.message,
        notifications: [`❌ Tarama hatası: ${error.message}`]
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
