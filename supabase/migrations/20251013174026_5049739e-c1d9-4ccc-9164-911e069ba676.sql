-- Add new scan_mode setting with default value
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('scan_mode', 'ai_hybrid')
ON CONFLICT (setting_key) DO NOTHING;

-- Update comment for clarity
COMMENT ON COLUMN app_settings.setting_value IS 'Scan mode values: off (no scanning), ai_hybrid (AI with Lovable+OpenAI fallback), api_only (only API scanning), ai_api_both (AI first, fallback to API if failed)';