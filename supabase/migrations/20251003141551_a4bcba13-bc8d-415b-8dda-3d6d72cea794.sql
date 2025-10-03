-- Site settings table for hero section
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_media_url TEXT,
  hero_media_type TEXT CHECK (hero_media_type IN ('video', 'image')),
  hero_title TEXT DEFAULT 'Tabirly Perili Yerler Databank''ı',
  hero_subtitle TEXT DEFAULT 'Dünyanın lanetli ve perili yerlerini keşfedin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Public can read site settings
CREATE POLICY "Anyone can view site settings"
  ON public.site_settings
  FOR SELECT
  USING (true);

-- Only admins can modify site settings
CREATE POLICY "Admins can insert site settings"
  ON public.site_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update site settings"
  ON public.site_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete site settings"
  ON public.site_settings
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.site_settings (hero_title, hero_subtitle)
VALUES ('Tabirly Perili Yerler Databank''ı', 'Dünyanın lanetli ve perili yerlerini keşfedin')
ON CONFLICT DO NOTHING;

-- Create storage bucket for hero media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hero-media',
  'hero-media',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for hero-media bucket
CREATE POLICY "Anyone can view hero media"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'hero-media');

CREATE POLICY "Admins can upload hero media"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'hero-media' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update hero media"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'hero-media' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete hero media"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'hero-media' AND
    has_role(auth.uid(), 'admin'::app_role)
  );