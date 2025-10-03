import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // AI prompt to find new places
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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content from AI");
    }

    console.log("AI response:", content);

    let places: any[] = [];
    try {
      const parsed = JSON.parse(content);
      // Handle both array and object with places property
      places = Array.isArray(parsed) ? parsed : (parsed.places || []);
    } catch (e) {
      console.error("JSON parse error:", e);
      throw new Error("Failed to parse AI response as JSON");
    }

    console.log(`Found ${places.length} places from AI`);

    let addedCount = 0;

    for (const place of places) {
      // Create slug
      const slug = place.name
        .toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if exists
      const { data: existing } = await supabase
        .from("places")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (existing) {
        console.log(`Place already exists: ${place.name}`);
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

    // Update scan log
    if (scanId) {
      await supabase
        .from("ai_scan_logs")
        .update({
          status: "completed",
          scan_completed_at: new Date().toISOString(),
          places_found: places.length,
          places_added: addedCount
        })
        .eq("id", scanId);
    }

    console.log(`AI scan completed. Added ${addedCount}/${places.length} places`);

    return new Response(
      JSON.stringify({
        success: true,
        places_found: places.length,
        places_added: addedCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("AI scan error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
