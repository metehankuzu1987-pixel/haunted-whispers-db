-- Update Foursquare API key in app_settings
UPDATE app_settings 
SET setting_value = '3IMEN5F1DJGSCXASFB0ZIDONH5AMI3AD4TQG4LPSMHZY1XKR',
    updated_at = NOW()
WHERE setting_key = 'foursquare_api_key';