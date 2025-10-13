import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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

// Check OpenAI daily limits
async function checkOpenAILimits(supabase: SupabaseClient) {
  const { data: settings } = await supabase
    .from('app_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['openai_daily_limit', 'openai_max_requests_per_day', 'openai_max_cost_per_day']);
  
  const dailyLimit = parseInt(settings?.find((s: any) => s.setting_key === 'openai_daily_limit')?.setting_value || '1');
  const maxRequests = parseInt(settings?.find((s: any) => s.setting_key === 'openai_max_requests_per_day')?.setting_value || '5');
  const maxCost = parseFloat(settings?.find((s: any) => s.setting_key === 'openai_max_cost_per_day')?.setting_value || '1.00');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: todayUsage, count } = await supabase
    .from('openai_usage_logs')
    .select('cost_usd', { count: 'exact' })
    .gte('created_at', today.toISOString())
    .eq('function_name', 'ai-scan');
  
  const todayRequestCount = count || 0;
  const todayCost = todayUsage?.reduce((sum: number, log: any) => sum + (log.cost_usd || 0), 0) || 0;
  
  if (todayRequestCount >= dailyLimit) {
    throw new Error(`Günlük OpenAI tarama limiti doldu (${dailyLimit}/${dailyLimit}). Yarın tekrar deneyin.`);
  }
  
  if (todayRequestCount >= maxRequests) {
    throw new Error(`Günlük maksimum OpenAI istek sayısına ulaşıldı (${maxRequests}). Yarın tekrar deneyin.`);
  }
  
  if (todayCost >= maxCost) {
    throw new Error(`Günlük OpenAI maliyet limiti aşıldı ($${todayCost.toFixed(2)}/$${maxCost.toFixed(2)}). Yarın tekrar deneyin.`);
  }
  
  return { allowed: true, todayUsage: todayRequestCount, todayCost };
}

// Get AI health status
async function getAIHealthStatus(supabase: SupabaseClient, provider: string) {
  const { data } = await supabase
    .from('ai_health_status')
    .select('*')
    .eq('provider', provider)
    .maybeSingle();
  
  return data;
}

// Update AI health after a call
async function updateAIHealth(supabase: SupabaseClient, provider: string, success: boolean, errorCode?: number) {
  const { data: current } = await supabase
    .from('ai_health_status')
    .select('*')
    .eq('provider', provider)
    .maybeSingle();
  
  const now = new Date().toISOString();
  
  if (success) {
    await supabase
      .from('ai_health_status')
      .upsert({
        provider,
        last_success_at: now,
        consecutive_failures: 0,
        status: 'healthy',
        updated_at: now
      });
  } else {
    const consecutiveFailures = (current?.consecutive_failures || 0) + 1;
    let status = 'unhealthy';
    
    if (errorCode === 429) {
      status = 'rate_limited';
    } else if (errorCode === 402) {
      status = 'no_credits';
    }
    
    await supabase
      .from('ai_health_status')
      .upsert({
        provider,
        last_failure_at: now,
        consecutive_failures: consecutiveFailures,
        status,
        updated_at: now
      });
  }
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
      .in('setting_key', ['ai_scan_mode', 'openai_api_key', 'ai_model']);

    const settings = Object.fromEntries(
      settingsData?.map(s => [s.setting_key, s.setting_value]) || []
    );

    const rawAiScanMode = settings.ai_scan_mode || 'both';
    const aiScanMode = ['off', 'lovable', 'openai', 'both'].includes(rawAiScanMode) 
      ? rawAiScanMode as 'off' | 'lovable' | 'openai' | 'both'
      : 'both';
    const openaiKey = settings.openai_api_key || '';
    const aiModel = settings.ai_model || 'gpt-4o-mini';
    
    // Check if AI scanning is disabled
    if (aiScanMode === 'off') {
      console.log("AI scan is disabled in settings");
      return new Response(
        JSON.stringify({ error: 'AI scan is disabled' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Check Lovable AI health status
    const lovableHealth = await getAIHealthStatus(supabase, 'lovable');
    const now = new Date();
    const currentMonth = now.getMonth();
    const lastFailureMonth = lovableHealth?.last_failure_at ? new Date(lovableHealth.last_failure_at).getMonth() : null;
    
    // Lovable AI kotası yenilendi mi kontrol et
    const shouldRetryLovable = !lovableHealth || 
                                lovableHealth.status === 'healthy' ||
                                (lovableHealth.status === 'rate_limited' && lastFailureMonth !== currentMonth) ||
                                (lovableHealth.status === 'no_credits' && lastFailureMonth !== currentMonth);

    // Lovable AI çağrısı
    if ((aiScanMode === 'lovable' || aiScanMode === 'both') && shouldRetryLovable) {
      notifications.push('🔮 Lovable AI ile tarama başlatıldı...');
      try {
        const lovablePlaces = await fetchFromLovableAI(lovableApiKey, prompt);
        allPlaces.push(...lovablePlaces);
        notifications.push(`✅ Lovable AI: ${lovablePlaces.length} yer bulundu`);
        await updateAIHealth(supabase, 'lovable', true);
      } catch (lovableError: any) {
        console.error('Lovable AI error:', lovableError);
        
        const errorCode = lovableError.status || 500;
        await updateAIHealth(supabase, 'lovable', false, errorCode);
        
        if (errorCode === 429 || errorCode === 402) {
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          const renewalDate = nextMonth.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
          notifications.push(`⚠️ Lovable AI ${errorCode === 429 ? 'rate limit' : 'kredi'} sınırına ulaştı (Kota yenilenmesi: ${renewalDate})`);
        } else {
          notifications.push(`⚠️ Lovable AI başarısız: ${lovableError.message}`);
        }
        
        // OpenAI'a geç
        if (aiScanMode === 'both' && openaiKey && (errorCode === 429 || errorCode === 402)) {
          notifications.push('🔄 OpenAI\'a geçiliyor...');
          try {
            const limitCheck = await checkOpenAILimits(supabase);
            notifications.push(`ℹ️ OpenAI kullanımı: ${limitCheck.todayUsage + 1}/günlük limit`);
            
            const openaiPlaces = await fetchFromOpenAI(openaiKey, aiModel, prompt);
            allPlaces.push(...openaiPlaces);
            
            const estimatedTokens = 500 * openaiPlaces.length;
            const estimatedCost = estimatedTokens * 0.00001;
            
            await supabase.from('openai_usage_logs').insert({
              function_name: 'ai-scan',
              tokens_used: estimatedTokens,
              cost_usd: estimatedCost,
              success: true
            });
            
            notifications.push(`✅ OpenAI: ${openaiPlaces.length} yer bulundu (~$${estimatedCost.toFixed(4)})`);
            await updateAIHealth(supabase, 'openai', true);
          } catch (openaiError: any) {
            console.error('OpenAI error:', openaiError);
            notifications.push(`❌ ${openaiError.message}`);
            await updateAIHealth(supabase, 'openai', false);
            throw new Error('Her iki AI sağlayıcı da başarısız oldu');
          }
        } else if (aiScanMode === 'lovable') {
          throw lovableError;
        }
      }
    } else if ((aiScanMode === 'lovable' || aiScanMode === 'both') && !shouldRetryLovable) {
      // Lovable AI kota yenilenmesini bekliyor
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const renewalDate = nextMonth.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
      notifications.push(`⏳ Lovable AI kota yenilenmesini bekliyor (${renewalDate})`);
      
      if (aiScanMode === 'both' && openaiKey) {
        notifications.push('🔄 OpenAI\'a geçiliyor...');
        try {
          const limitCheck = await checkOpenAILimits(supabase);
          notifications.push(`ℹ️ OpenAI kullanımı: ${limitCheck.todayUsage + 1}/günlük limit`);
          
          const openaiPlaces = await fetchFromOpenAI(openaiKey, aiModel, prompt);
          allPlaces.push(...openaiPlaces);
          
          const estimatedTokens = 500 * openaiPlaces.length;
          const estimatedCost = estimatedTokens * 0.00001;
          
          await supabase.from('openai_usage_logs').insert({
            function_name: 'ai-scan',
            tokens_used: estimatedTokens,
            cost_usd: estimatedCost,
            success: true
          });
          
          notifications.push(`✅ OpenAI: ${openaiPlaces.length} yer bulundu (~$${estimatedCost.toFixed(4)})`);
          await updateAIHealth(supabase, 'openai', true);
        } catch (openaiError: any) {
          console.error('OpenAI error:', openaiError);
          notifications.push(`❌ ${openaiError.message}`);
          await updateAIHealth(supabase, 'openai', false);
          throw openaiError;
        }
      }
    }

    // Sadece OpenAI kullanılacaksa
    if (aiScanMode === 'openai' && openaiKey) {
      notifications.push('🤖 OpenAI ile tarama başlatıldı...');
      try {
        const limitCheck = await checkOpenAILimits(supabase);
        notifications.push(`ℹ️ OpenAI kullanımı: ${limitCheck.todayUsage + 1}/günlük limit`);
        
        const openaiPlaces = await fetchFromOpenAI(openaiKey, aiModel, prompt);
        allPlaces.push(...openaiPlaces);
        
        const estimatedTokens = 500 * openaiPlaces.length;
        const estimatedCost = estimatedTokens * 0.00001;
        
        await supabase.from('openai_usage_logs').insert({
          function_name: 'ai-scan',
          tokens_used: estimatedTokens,
          cost_usd: estimatedCost,
          success: true
        });
        
        notifications.push(`✅ OpenAI: ${openaiPlaces.length} yer bulundu (~$${estimatedCost.toFixed(4)})`);
        await updateAIHealth(supabase, 'openai', true);
      } catch (openaiError: any) {
        console.error('OpenAI error:', openaiError);
        notifications.push(`❌ ${openaiError.message}`);
        await updateAIHealth(supabase, 'openai', false);
        throw openaiError;
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
          provider_used: aiScanMode
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
