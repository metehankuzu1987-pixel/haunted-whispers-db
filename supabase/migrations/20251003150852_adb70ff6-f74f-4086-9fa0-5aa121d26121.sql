-- Security Fix: Require authentication for inserting comments
DROP POLICY IF EXISTS "Anyone can insert comments" ON public.comments;

CREATE POLICY "Authenticated users can insert comments"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Security Fix: Restrict sources table modifications to admins only
CREATE POLICY "Only admins can insert sources"
ON public.sources
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update sources"
ON public.sources
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete sources"
ON public.sources
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));