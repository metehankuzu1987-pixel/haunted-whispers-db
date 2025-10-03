import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'translationCache_v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (for localStorage fallback)

type CacheMap = Record<string, { translation: string; timestamp: number }>;

function readCache(): CacheMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheMap) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: CacheMap) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

function keyFor(text: string, from: string, to: string) {
  return `${from}->${to}:${text}`;
}

export function useTranslateContent(texts: string[] | undefined, from: string, to: string) {
  const [translations, setTranslations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanTexts = useMemo(() => (Array.isArray(texts) ? texts.map((t) => t ?? '').map(String) : []), [texts]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      if (!cleanTexts.length || from === to) {
        setTranslations(cleanTexts);
        return;
      }

      const result: string[] = new Array(cleanTexts.length).fill('');
      const missing: { index: number; text: string }[] = [];

      // Step 1: Try to get translations from database (permanent storage)
      try {
        const { data: dbTranslations } = await supabase
          .from('translations')
          .select('source_text, translated_text')
          .in('source_text', cleanTexts)
          .eq('source_lang', from)
          .eq('target_lang', to);

        const dbMap = new Map(
          (dbTranslations || []).map((t) => [t.source_text, t.translated_text])
        );

        cleanTexts.forEach((text, i) => {
          const dbMatch = dbMap.get(text);
          if (dbMatch) {
            result[i] = dbMatch;
          } else {
            missing.push({ index: i, text });
          }
        });
      } catch (err) {
        console.warn('DB translation lookup failed, falling back to cache:', err);
        // If DB fails, mark all as missing and we'll check cache next
        cleanTexts.forEach((text, i) => missing.push({ index: i, text }));
      }

      // Step 2: For remaining texts, check localStorage cache
      if (missing.length > 0) {
        const cache = readCache();
        const now = Date.now();
        const stillMissing: { index: number; text: string }[] = [];

        missing.forEach((m) => {
          const k = keyFor(m.text, from, to);
          const cached = cache[k];
          if (cached && now - cached.timestamp < TTL_MS) {
            result[m.index] = cached.translation;
          } else {
            stillMissing.push(m);
          }
        });

        missing.length = 0;
        missing.push(...stillMissing);
      }

      // Step 3: If all translations found, return early
      if (!missing.length) {
        setTranslations(result);
        return;
      }

      // Step 4: Use AI to translate remaining texts
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('translate', {
          body: { texts: missing.map((m) => m.text), sourceLang: from, targetLang: to },
        });
        if (error) throw error as any;

        const received: string[] = (data?.translations as string[]) || [];
        const cache = readCache();
        const now = Date.now();
        
        // Step 5: Save new translations to both database and cache
        const dbInserts = missing.map((m, idx) => {
          const translated = received[idx] ?? '';
          result[m.index] = translated;
          cache[keyFor(m.text, from, to)] = { translation: translated, timestamp: now };
          
          return {
            source_text: m.text,
            source_lang: from,
            target_lang: to,
            translated_text: translated,
          };
        });

        // Save to database (fire and forget)
        supabase.from('translations').upsert(dbInserts, { 
          onConflict: 'source_text,source_lang,target_lang',
          ignoreDuplicates: false 
        }).then(({ error: dbError }) => {
          if (dbError) console.warn('Failed to save translations to DB:', dbError);
        });

        // Save to cache
        writeCache(cache);
        
        if (!cancelled) setTranslations(result);
      } catch (e: any) {
        console.error('translate invoke error', e);
        if (!cancelled) setError(e?.message || 'Translation failed');
        if (!cancelled) setTranslations(cleanTexts); // graceful fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [cleanTexts, from, to]);

  return { translations, loading, error };
}
