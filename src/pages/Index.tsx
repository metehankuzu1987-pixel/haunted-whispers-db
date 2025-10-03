import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { Filters, FilterState } from '@/components/Filters';
import { PlaceCard } from '@/components/PlaceCard';
import { Place } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation, Language } from '@/lib/i18n';
import { Loader2 } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';

const COUNTRIES = [
  { code: 'TR', name: 'Türkiye' },
  { code: 'DE', name: 'Almanya' },
  { code: 'IT', name: 'İtalya' },
  { code: 'JP', name: 'Japonya' },
  { code: 'UA', name: 'Ukrayna' },
  { code: 'US', name: 'ABD' },
  { code: 'GB', name: 'İngiltere' },
  { code: 'FR', name: 'Fransa' },
  { code: 'ES', name: 'İspanya' },
  { code: 'RO', name: 'Romanya' },
];

const CATEGORIES = [
  'Lanetli',
  'Perili',
  'Efsane',
  'Terk edilmiş',
  'Otel',
  'Okul',
  'Hastane',
  'Kale',
  'Orman',
];

const Index = () => {
  const [lang, setLang] = useState<Language>('tr');
  const { t } = useTranslation(lang);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    country: '',
    city: '',
    category: '',
    minScore: 60,
    sort: 'score',
    search: '',
  });
  const { trackPageView, trackSearch } = useAnalytics();

  const fetchPlaces = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('places')
        .select('*')
        .eq('status', 'approved')
        .gte('evidence_score', filters.minScore);

      if (filters.country) {
        query = query.eq('country_code', filters.country);
      }

      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }

      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Sıralama
      switch (filters.sort) {
        case 'score':
          query = query.order('evidence_score', { ascending: false });
          break;
        case 'new':
          query = query.order('created_at', { ascending: false });
          break;
        case 'votes':
          query = query.order('votes_up', { ascending: false });
          break;
        case 'az':
          query = query.order('name', { ascending: true });
          break;
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      const placesData = (data || []).map(d => ({
        ...d,
        sources_json: (d.sources_json as any) || []
      })) as Place[];
      
      setPlaces(placesData);
      
      // Track search
      trackSearch(filters.search, filters, placesData.length);
    } catch (error) {
      console.error('Veri çekilirken hata:', error);
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaces();
  }, [filters]);

  useEffect(() => {
    // Track page view on mount
    trackPageView('/');
  }, []);

  return (
    <div className="min-h-screen">
      <Header lang={lang} onLangChange={setLang} onRefresh={fetchPlaces} />
      
      <HeroSection />

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Filtreler */}
        <div className="mb-6">
          <Filters
            lang={lang}
            filters={filters}
            onFiltersChange={setFilters}
            countries={COUNTRIES}
            categories={CATEGORIES}
          />
        </div>

        {/* Sonuç Sayısı */}
        <div className="mb-4 text-sm text-muted-foreground">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('list.loading')}
            </span>
          ) : (
            <span>
              {places.length} {t('list.results')}
            </span>
          )}
        </div>

        {/* Liste */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : places.length === 0 ? (
            <div className="text-center py-12 glass rounded-xl">
              <p className="text-muted-foreground">{t('list.noResults')}</p>
            </div>
          ) : (
            places.map((place) => <PlaceCard key={place.id} place={place} lang={lang} />)
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border/30 text-center text-sm text-muted-foreground">
          <p>
            {t('footer.openData')} • {t('footer.removal')}:{' '}
            <a href="mailto:iletisim@tabirly.com" className="text-primary hover:underline">
              iletisim@tabirly.com
            </a>
          </p>
          <p className="mt-2">
            {t('footer.contact')}:{' '}
            <a href="mailto:iletisim@tabirly.com" className="text-primary hover:underline">
              iletisim@tabirly.com
            </a>
          </p>
          <p className="mt-2">{t('footer.version')} 1.0.0 • Tabirly</p>
        </footer>
      </main>
    </div>
  );
};

export default Index;