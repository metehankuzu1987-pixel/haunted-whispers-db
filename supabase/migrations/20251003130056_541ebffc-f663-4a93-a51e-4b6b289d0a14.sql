DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='user_roles' 
      AND policyname='Users can view their own roles'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
END
$$;