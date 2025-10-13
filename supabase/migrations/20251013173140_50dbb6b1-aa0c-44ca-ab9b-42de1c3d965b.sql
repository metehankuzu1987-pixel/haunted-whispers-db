-- api_scan_enabled default değerini true yap
UPDATE app_settings 
SET setting_value = 'true' 
WHERE setting_key = 'api_scan_enabled' AND setting_value = 'false';