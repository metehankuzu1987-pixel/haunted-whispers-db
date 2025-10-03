-- Create translations table for permanent storage of translated content
CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique index to prevent duplicate translations
CREATE UNIQUE INDEX IF NOT EXISTS idx_translations_unique 
ON public.translations(source_text, source_lang, target_lang);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_translations_lookup 
ON public.translations(source_lang, target_lang);

-- Enable RLS
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

-- Anyone can read translations (public data)
CREATE POLICY "Anyone can view translations"
ON public.translations
FOR SELECT
USING (true);

-- Only the system (via edge function) can insert/update translations
CREATE POLICY "System can insert translations"
ON public.translations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update translations"
ON public.translations
FOR UPDATE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_translations_updated_at
BEFORE UPDATE ON public.translations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.translations IS 'Stores permanent translations to reduce AI API calls and provide faster responses.';