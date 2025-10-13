-- Initialize categories in app_settings
INSERT INTO public.app_settings (setting_key, setting_value, updated_at)
VALUES ('categories', '["Terk edilmiş", "Hastane", "Orman", "Şato", "Kilise", "Köprü", "Otel", "Lanetli", "Perili", "Efsane", "Okul", "Kale", "Diğer"]', NOW())
ON CONFLICT (setting_key) DO NOTHING;