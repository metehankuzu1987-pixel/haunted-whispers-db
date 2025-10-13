-- Create OpenAI usage logs table
CREATE TABLE public.openai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  function_name TEXT NOT NULL,
  tokens_used INTEGER,
  cost_usd NUMERIC(10, 6),
  success BOOLEAN DEFAULT true
);

-- Create AI health status table
CREATE TABLE public.ai_health_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  status TEXT DEFAULT 'healthy',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.openai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_health_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for openai_usage_logs
CREATE POLICY "Admins can view OpenAI usage logs"
  ON public.openai_usage_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert OpenAI usage logs"
  ON public.openai_usage_logs
  FOR INSERT
  WITH CHECK (true);

-- RLS policies for ai_health_status
CREATE POLICY "Admins can view AI health status"
  ON public.ai_health_status
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can update AI health status"
  ON public.ai_health_status
  FOR UPDATE
  USING (true);

CREATE POLICY "System can insert AI health status"
  ON public.ai_health_status
  FOR INSERT
  WITH CHECK (true);

-- Insert default settings
INSERT INTO public.app_settings (setting_key, setting_value) VALUES
  ('openai_daily_limit', '1'),
  ('openai_max_requests_per_day', '5'),
  ('openai_max_cost_per_day', '1.00')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert initial AI health status
INSERT INTO public.ai_health_status (provider, status) VALUES
  ('lovable', 'healthy'),
  ('openai', 'healthy')
ON CONFLICT (provider) DO NOTHING;