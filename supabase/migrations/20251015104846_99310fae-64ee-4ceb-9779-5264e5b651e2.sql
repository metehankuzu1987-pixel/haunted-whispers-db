-- Fix AI scanning configuration issues

-- 1. Add missing settings for AI scan functionality
INSERT INTO app_settings (setting_key, setting_value) 
VALUES 
  ('data_collection_method', 'ai'),
  ('scanning_enabled', 'true'),
  ('scan_mode', 'ai_api_both')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Fix AI model prefix (OpenAI requires "openai/" prefix)
UPDATE app_settings 
SET setting_value = 'openai/gpt-4o-mini', updated_at = NOW()
WHERE setting_key = 'ai_model' AND setting_value = 'gpt-4o-mini';

-- 3. Manually trigger a scan to test the configuration
SELECT public.trigger_active_scan();