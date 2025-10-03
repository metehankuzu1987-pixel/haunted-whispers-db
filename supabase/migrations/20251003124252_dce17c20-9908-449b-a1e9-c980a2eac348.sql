-- Fix search_path for update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Re-create trigger for places table
CREATE TRIGGER update_places_updated_at
  BEFORE UPDATE ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add RLS policies for logs table (admin only)
CREATE POLICY "Admins can view logs"
  ON public.logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs"
  ON public.logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add RLS policies for moderation table (admin only)
CREATE POLICY "Admins can view moderation"
  ON public.moderation FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert moderation"
  ON public.moderation FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));