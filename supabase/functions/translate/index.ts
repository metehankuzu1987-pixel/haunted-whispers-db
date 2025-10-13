import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function translateWithLovableAI(texts: string[], apiKey: string, sourceLang: string, targetLang: string) {
  const system = `You are a professional Turkish <> English translator.\nRules:\n- Return ONLY a JSON array of translated strings, same order and length as input.\n- No explanations, no extra keys, no markdown.\n- Preserve proper nouns and place names accurately.\n- Keep neutral tone; do not summarize or add info.\n- If a text is empty, return empty string at the same index.`;

  const user = `Source language: ${sourceLang}\nTarget language: ${targetLang}\nTranslate the following array and return a JSON array with the translations in the same order:\n${JSON.stringify(texts)}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const error: any = new Error(`Lovable AI error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  
  let translations: string[] = [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) translations = parsed.map((x) => (typeof x === "string" ? x : String(x ?? "")));
  } catch {
    const start = content.indexOf("[");
    const end = content.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const parsed = JSON.parse(content.slice(start, end + 1));
        if (Array.isArray(parsed)) translations = parsed.map((x) => (typeof x === "string" ? x : String(x ?? "")));
      } catch (e) {
        console.error("Failed to parse extracted JSON array:", e);
      }
    }
  }
  
  return translations;
}

async function translateWithOpenAI(texts: string[], apiKey: string, model: string, sourceLang: string, targetLang: string) {
  const system = `You are a professional Turkish <> English translator.\nRules:\n- Return ONLY a JSON array of translated strings, same order and length as input.\n- No explanations, no extra keys, no markdown.\n- Preserve proper nouns and place names accurately.\n- Keep neutral tone; do not summarize or add info.\n- If a text is empty, return empty string at the same index.`;

  const user = `Source language: ${sourceLang}\nTarget language: ${targetLang}\nTranslate the following array and return a JSON array with the translations in the same order:\n${JSON.stringify(texts)}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  
  let translations: string[] = [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) translations = parsed.map((x) => (typeof x === "string" ? x : String(x ?? "")));
  } catch {
    const start = content.indexOf("[");
    const end = content.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const parsed = JSON.parse(content.slice(start, end + 1));
        if (Array.isArray(parsed)) translations = parsed.map((x) => (typeof x === "string" ? x : String(x ?? "")));
      } catch (e) {
        console.error("Failed to parse extracted JSON array:", e);
      }
    }
  }
  
  return translations;
}

// Check OpenAI translation limits
async function checkOpenAITranslateLimits(supabase: SupabaseClient) {
  const { data: settings } = await supabase
    .from('app_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['openai_max_requests_per_day', 'openai_max_cost_per_day']);
  
  const maxRequests = parseInt(settings?.find((s: any) => s.setting_key === 'openai_max_requests_per_day')?.setting_value || '5');
  const maxCost = parseFloat(settings?.find((s: any) => s.setting_key === 'openai_max_cost_per_day')?.setting_value || '1.00');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: todayUsage, count } = await supabase
    .from('openai_usage_logs')
    .select('cost_usd', { count: 'exact' })
    .gte('created_at', today.toISOString());
  
  const todayRequestCount = count || 0;
  const todayCost = todayUsage?.reduce((sum: number, log: any) => sum + (log.cost_usd || 0), 0) || 0;
  
  if (todayRequestCount >= maxRequests) {
    throw new Error(`Günlük maksimum OpenAI istek sayısına ulaşıldı (${maxRequests})`);
  }
  
  if (todayCost >= maxCost) {
    throw new Error(`Günlük OpenAI maliyet limiti aşıldı ($${todayCost.toFixed(2)}/$${maxCost.toFixed(2)})`);
  }
  
  return { allowed: true, todayUsage: todayRequestCount, todayCost };
}

// Update AI health after translation
async function updateTranslateAIHealth(supabase: SupabaseClient, provider: string, success: boolean, errorCode?: number) {
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { texts, sourceLang = "tr", targetLang = "en" } = await req.json();

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get AI provider settings
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['ai_provider_translate', 'openai_api_key', 'ai_model']);

    const settings = Object.fromEntries(
      settingsData?.map(s => [s.setting_key, s.setting_value]) || []
    );

    const provider = settings.ai_provider_translate || 'lovable';
    const openaiKey = settings.openai_api_key || '';
    const aiModel = settings.ai_model || 'gpt-4o-mini';

    let translations: string[] = [];
    let notification = '';

    try {
      if (provider === 'openai' && openaiKey) {
        await checkOpenAITranslateLimits(supabase);
        
        notification = '🌐 OpenAI ile çevriliyor...';
        console.log(notification);
        translations = await translateWithOpenAI(texts, openaiKey, aiModel, sourceLang, targetLang);
        
        await supabase.from('openai_usage_logs').insert({
          function_name: 'translate',
          tokens_used: translations.join('').length,
          cost_usd: 0.001,
          success: true
        });
        
        await updateTranslateAIHealth(supabase, 'openai', true);
        notification = `✅ Çeviri tamamlandı (OpenAI)`;
      } else {
        notification = '🌐 Lovable AI ile çevriliyor...';
        console.log(notification);
        translations = await translateWithLovableAI(texts, lovableApiKey, sourceLang, targetLang);
        
        await updateTranslateAIHealth(supabase, 'lovable', true);
        notification = `✅ Çeviri tamamlandı (Ücretsiz)`;
      }
    } catch (error: any) {
      console.error("Translation error:", error);
      
      await updateTranslateAIHealth(supabase, provider === 'openai' ? 'openai' : 'lovable', false, error.status);
      
      if (error.status === 429 && openaiKey) {
        await checkOpenAITranslateLimits(supabase);
        
        notification = '⚠️ Lovable AI limiti aşıldı, OpenAI\'a geçiliyor...';
        console.log(notification);
        translations = await translateWithOpenAI(texts, openaiKey, aiModel, sourceLang, targetLang);
        
        await supabase.from('openai_usage_logs').insert({
          function_name: 'translate',
          tokens_used: translations.join('').length,
          cost_usd: 0.001,
          success: true
        });
        
        await updateTranslateAIHealth(supabase, 'openai', true);
        notification = `✅ Çeviri tamamlandı (OpenAI - Fallback)`;
      } else if (error.status === 402 && openaiKey) {
        await checkOpenAITranslateLimits(supabase);
        
        notification = '💳 Lovable AI kredisi bitti, OpenAI\'a geçiliyor...';
        console.log(notification);
        translations = await translateWithOpenAI(texts, openaiKey, aiModel, sourceLang, targetLang);
        
        await supabase.from('openai_usage_logs').insert({
          function_name: 'translate',
          tokens_used: translations.join('').length,
          cost_usd: 0.001,
          success: true
        });
        
        await updateTranslateAIHealth(supabase, 'openai', true);
        notification = `✅ Çeviri tamamlandı (OpenAI - Fallback)`;
      } else if (error.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (error.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        throw error;
      }
    }

    // Ensure correct length
    if (translations.length !== texts.length) {
      const result: string[] = new Array(texts.length).fill("");
      for (let i = 0; i < Math.min(texts.length, translations.length); i++) {
        result[i] = translations[i] ?? "";
      }
      translations = result;
    }

    console.log(notification);

    return new Response(JSON.stringify({ translations, notification }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});