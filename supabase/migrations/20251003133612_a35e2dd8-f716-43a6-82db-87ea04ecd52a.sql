-- Create app_settings table for configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Insert default value: API method
INSERT INTO public.app_settings (setting_key, setting_value) 
VALUES ('data_collection_method', 'api')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view settings"
  ON public.app_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Unschedule existing cron job
SELECT cron.unschedule('ai-scan-every-2-hours');

-- Create dynamic trigger function
CREATE OR REPLACE FUNCTION public.trigger_active_scan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_method text;
  scan_url text;
BEGIN
  -- Get active method
  SELECT setting_value INTO active_method
  FROM public.app_settings
  WHERE setting_key = 'data_collection_method';
  
  -- Determine URL based on method
  IF active_method = 'ai' THEN
    scan_url := 'https://cgtlmnvwvhktopxavjan.supabase.co/functions/v1/ai-scan';
  ELSE
    scan_url := 'https://cgtlmnvwvhktopxavjan.supabase.co/functions/v1/api-scan';
  END IF;
  
  -- Send HTTP request
  PERFORM net.http_post(
    url := scan_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndGxtbnZ3dmhrdG9weGF2amFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNjg3MDMsImV4cCI6MjA3NDk0NDcwM30.WUt3C5x93sxAVeu5jAWpZV_AaWzslUCOhAIRp-MpThE'
    ),
    body := jsonb_build_object('auto', true)
  );
END;
$$;

-- Schedule new dynamic cron job (every 2 hours)
SELECT cron.schedule(
  'dynamic-scan-every-2-hours',
  '0 */2 * * *',
  'SELECT public.trigger_active_scan();'
);