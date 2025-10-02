-- Tabirly Haunted DB - Ana Veritabanı Şeması

-- Yer (place) tablosu
CREATE TABLE IF NOT EXISTS public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  country_code TEXT NOT NULL,
  city TEXT,
  lat REAL,
  lon REAL,
  wikidata_id TEXT,
  osm_id TEXT,
  evidence_score INTEGER DEFAULT 0 CHECK (evidence_score >= 0 AND evidence_score <= 100),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pending_high', 'approved', 'rejected')),
  ai_collected INTEGER DEFAULT 1,
  human_approved INTEGER DEFAULT 0,
  votes_up INTEGER DEFAULT 0,
  votes_down INTEGER DEFAULT 0,
  rating_sum INTEGER DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  sources_json JSONB DEFAULT '[]'::jsonb,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kaynak (source) tablosu
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  domain TEXT,
  type TEXT,
  http_status INTEGER,
  content_hash TEXT,
  fetched_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Yer-kaynak ilişkisi
CREATE TABLE IF NOT EXISTS public.place_sources (
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE,
  confidence INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (place_id, source_id)
);

-- Moderasyon tablosu
CREATE TABLE IF NOT EXISTS public.moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'edit')),
  note TEXT,
  actor TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Yorumlar tablosu
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  message TEXT NOT NULL CHECK (length(message) <= 200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log tablosu
CREATE TABLE IF NOT EXISTS public.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL,
  scope TEXT,
  message TEXT NOT NULL,
  meta_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_places_country ON public.places(country_code);
CREATE INDEX IF NOT EXISTS idx_places_status ON public.places(status);
CREATE INDEX IF NOT EXISTS idx_places_score ON public.places(evidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_places_category ON public.places(category);
CREATE INDEX IF NOT EXISTS idx_places_slug ON public.places(slug);
CREATE INDEX IF NOT EXISTS idx_comments_place ON public.comments(place_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON public.logs(created_at DESC);

-- Updated_at otomatik güncellemesi için trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_places_updated_at
BEFORE UPDATE ON public.places
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Politikaları
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Herkes onaylanmış yerleri görebilir
CREATE POLICY "Anyone can view approved places"
ON public.places FOR SELECT
USING (status = 'approved');

-- Herkes kaynakları görebilir
CREATE POLICY "Anyone can view sources"
ON public.sources FOR SELECT
USING (true);

-- Herkes yer-kaynak ilişkilerini görebilir
CREATE POLICY "Anyone can view place_sources"
ON public.place_sources FOR SELECT
USING (true);

-- Herkes yorumları görebilir
CREATE POLICY "Anyone can view comments"
ON public.comments FOR SELECT
USING (true);

-- Herkes yorum ekleyebilir (backend rate-limit ile korunacak)
CREATE POLICY "Anyone can insert comments"
ON public.comments FOR INSERT
WITH CHECK (true);

-- Admin kullanıcı için örnek veri
-- Not: İlk versiyonda basit admin password kullanacağız (edge function'da kontrol)

-- Örnek veri
INSERT INTO public.places (name, slug, category, description, country_code, city, evidence_score, status, ai_collected, human_approved, sources_json) VALUES
('Gölyazı Hayalet Köyü', 'golyazi-hayalet-koyu', 'Terk edilmiş', 'Gölyazı, Bursa yakınlarında tarihi bir köy. Birçok eski Rum evinin harabeye dönmüştüğü bu bölgede geceleri gizemli sesler duyulduğu rivayet edilir.', 'TR', 'Bursa', 85, 'approved', 1, 1, '[{"url":"https://tr.wikipedia.org/wiki/Gölyazı","domain":"wikipedia.org","type":"encyclopedia"}]'::jsonb),
('Büyükada Rum Yetimhanesi', 'buyukada-rum-yetimhanesi', 'Terk edilmiş', 'Büyükada''daki dev ahşap yapı, Avrupa''nın en büyük ahşap binalarından biri. 1960''lardan beri terk edilmiş durumda ve gizemli olaylarla ünlü.', 'TR', 'İstanbul', 92, 'approved', 1, 1, '[{"url":"https://tr.wikipedia.org/wiki/Büyükada_Rum_Yetimhanesi","domain":"wikipedia.org","type":"encyclopedia"}]'::jsonb),
('Beelitz-Heilstätten Hastanesi', 'beelitz-heilstatten-hastanesi', 'Hastane', 'Berlin yakınlarındaki terk edilmiş tüberküloz hastanesi. I. ve II. Dünya Savaşı sırasında askeri hastane olarak kullanıldı. Karanlık koridorları ve çürümüş odalarıyla ünlü.', 'DE', 'Brandenburg', 88, 'approved', 1, 1, '[{"url":"https://en.wikipedia.org/wiki/Beelitz-Heilstätten","domain":"wikipedia.org","type":"encyclopedia"}]'::jsonb),
('Poveglia Adası', 'poveglia-adasi', 'Terk edilmiş', 'Venedik lagününde karantina adası olarak kullanılan, sonra akıl hastanesine dönüştürülen ada. İtalya''nın en lanetli yeri olarak bilinir.', 'IT', 'Venedik', 95, 'approved', 1, 1, '[{"url":"https://en.wikipedia.org/wiki/Poveglia","domain":"wikipedia.org","type":"encyclopedia"}]'::jsonb),
('Aokigahara Ormanı', 'aokigahara-ormani', 'Orman', 'Fuji Dağı eteğindeki yoğun orman. "İntihar Ormanı" olarak da bilinen bu yer, gizemli olaylar ve kaybolmalarla ünlü.', 'JP', 'Yamanashi', 90, 'approved', 1, 1, '[{"url":"https://en.wikipedia.org/wiki/Aokigahara","domain":"wikipedia.org","type":"encyclopedia"}]'::jsonb),
('Çernobil Radyasyon Bölgesi', 'cernobil-radyasyon-bolgesi', 'Terk edilmiş', '1986 nükleer kazasından sonra tamamen terk edilen bölge. Hayalet şehir Pripyat ve çevresindeki gizemli atmosfer ile ünlü.', 'UA', 'Pripyat', 98, 'approved', 1, 1, '[{"url":"https://en.wikipedia.org/wiki/Chernobyl_disaster","domain":"wikipedia.org","type":"encyclopedia"}]'::jsonb)