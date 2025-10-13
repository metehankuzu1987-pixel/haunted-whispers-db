-- Admin Panel Yeniden Yapılandırma: AI ve API Tarama Sistemlerini Ayır

-- 1. ai_provider_scan'ı ai_scan_mode'a dönüştür
UPDATE public.app_settings 
SET setting_key = 'ai_scan_mode'
WHERE setting_key = 'ai_provider_scan';

-- 2. data_collection_method'dan API tarama durumunu belirle ve yeni ayarı ekle
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES (
  'api_scan_enabled',
  (SELECT CASE WHEN setting_value = 'api' THEN 'true' ELSE 'false' END 
   FROM app_settings 
   WHERE setting_key = 'data_collection_method')
);

-- 3. Eski data_collection_method'u sil
DELETE FROM public.app_settings 
WHERE setting_key = 'data_collection_method';