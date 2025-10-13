-- Clean up erroneous translation records where translated_text = source_text
-- for long texts (>40 chars) in different languages
DELETE FROM translations
WHERE translated_text = source_text
  AND source_lang <> target_lang
  AND char_length(source_text) > 40;