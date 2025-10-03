-- Add English fields to places table
ALTER TABLE public.places 
ADD COLUMN name_en text,
ADD COLUMN description_en text;