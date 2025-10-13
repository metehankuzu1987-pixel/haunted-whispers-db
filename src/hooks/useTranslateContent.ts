import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'translationCache_v2';
const TTL_MS = 1 * 24 * 60 * 60 * 1000; // 1 day (for localStorage cache only)

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

  const cleanTexts = useMemo(() => {
    if (!Array.isArray(texts)) return [];
    return texts.map((t) => t ?? '').map(String);
  }, [JSON.stringify(texts)]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      if (!cleanTexts.length || from === to) {
        setTranslations(cleanTexts);
        return;
      }

      const cache = readCache();
      const result: string[] = new Array(cleanTexts.length).fill('');
      const missing: { index: number; text: string }[] = [];
      const now = Date.now();

      // Step 1: Check localStorage cache first (fastest)
      cleanTexts.forEach((text, i) => {
        const k = keyFor(text, from, to);
        const cached = cache[k];
        if (cached && now - cached.timestamp < TTL_MS) {
          result[i] = cached.translation;
        } else {
          missing.push({ index: i, text });
        }
      });

      if (!missing.length) {
        setTranslations(result);
        return;
      }

      setLoading(true);

      try {
        // Step 2: Check database for permanent translations
        const { data: dbTranslations, error: dbError } = await supabase
          .from('translations')
          .select('source_text, translated_text')
          .eq('source_lang', from)
          .eq('target_lang', to)
          .in('source_text', missing.map(m => m.text));

        if (dbError) throw dbError;

        // Apply database results
        const stillMissing: { index: number; text: string }[] = [];
        missing.forEach((m) => {
          const dbMatch = dbTranslations?.find(t => t.source_text === m.text);
          if (dbMatch) {
            result[m.index] = dbMatch.translated_text;
            // Save to localStorage cache for faster future access
            cache[keyFor(m.text, from, to)] = { 
              translation: dbMatch.translated_text, 
              timestamp: now 
            };
          } else {
            stillMissing.push(m);
          }
        });

        writeCache(cache);

        if (!stillMissing.length) {
          if (!cancelled) setTranslations(result);
          setLoading(false);
          return;
        }

        // Step 3: Use AI for remaining translations
        const { data, error } = await supabase.functions.invoke('translate', {
          body: { texts: stillMissing.map((m) => m.text), sourceLang: from, targetLang: to },
        });
        if (error) throw error as any;

        const received: string[] = (data?.translations as string[]) || [];
        
        // Quality control: only save if received length matches and translations are valid
        const shouldSaveToDb = received.length === stillMissing.length;
        const validDbTranslations: any[] = [];
        const validCacheEntries: Array<{ text: string; translation: string }> = [];

        stillMissing.forEach((m, idx) => {
          const translated = received[idx] ?? '';
          result[m.index] = translated;
          
          // Quality check: Don't save likely failed translations
          const isLikelyFailed = 
            from !== to && 
            m.text.length > 40 && 
            translated === m.text;
          
          if (!isLikelyFailed && shouldSaveToDb) {
            validDbTranslations.push({
              source_text: m.text,
              source_lang: from,
              target_lang: to,
              translated_text: translated
            });
            validCacheEntries.push({ text: m.text, translation: translated });
          }
        });

        // Insert valid translations into database
        if (validDbTranslations.length > 0) {
          await supabase
            .from('translations')
            .upsert(validDbTranslations, { onConflict: 'source_text,source_lang,target_lang' });
        }

        // Update cache only with valid translations
        validCacheEntries.forEach(({ text, translation }) => {
          cache[keyFor(text, from, to)] = { translation, timestamp: now };
        });

        writeCache(cache);
        if (!cancelled) setTranslations(result);
      } catch (e: any) {
        console.error('translate error', e);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cleanTexts), from, to]);

  return { translations, loading, error };
}
