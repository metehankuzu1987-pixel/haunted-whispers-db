import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts, sourceLang = "tr", targetLang = "en" } = await req.json();

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const system = `You are a professional Turkish <> English translator.\nRules:\n- Return ONLY a JSON array of translated strings, same order and length as input.\n- No explanations, no extra keys, no markdown.\n- Preserve proper nouns and place names accurately.\n- Keep neutral tone; do not summarize or add info.\n- If a text is empty, return empty string at the same index.`;

    const user = `Source language: ${sourceLang}\nTarget language: ${targetLang}\nTranslate the following array and return a JSON array with the translations in the same order:\n${JSON.stringify(texts)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("translate gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";

    let translations: string[] = [];
    try {
      // Try parsing as JSON array directly
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) translations = parsed.map((x) => (typeof x === "string" ? x : String(x ?? "")));
    } catch {
      // Fallback: try to extract JSON array from content
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

    // As a last resort, return empty strings for unmatched length
    if (translations.length !== texts.length) {
      const result: string[] = new Array(texts.length).fill("");
      for (let i = 0; i < Math.min(texts.length, translations.length); i++) {
        result[i] = translations[i] ?? "";
      }
      translations = result;
    }

    return new Response(JSON.stringify({ translations }), {
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