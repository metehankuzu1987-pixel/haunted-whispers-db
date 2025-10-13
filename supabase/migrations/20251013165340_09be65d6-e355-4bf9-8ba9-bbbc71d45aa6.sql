-- AI Sağlayıcı ayarlarını ekle
INSERT INTO app_settings (setting_key, setting_value, updated_by) 
VALUES 
  ('ai_provider_scan', 'both', NULL),
  ('ai_provider_translate', 'lovable', NULL),
  ('openai_api_key', '', NULL),
  ('ai_model', 'gpt-4o-mini', NULL),
  ('ai_notifications_enabled', 'true', NULL)
ON CONFLICT (setting_key) DO NOTHING;