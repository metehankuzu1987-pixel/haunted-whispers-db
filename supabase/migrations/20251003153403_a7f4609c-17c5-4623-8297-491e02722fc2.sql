-- Add ignored_ips setting to app_settings
INSERT INTO public.app_settings (setting_key, setting_value, updated_at)
VALUES ('ignored_ips', '[]', now())
ON CONFLICT (setting_key) DO NOTHING;
