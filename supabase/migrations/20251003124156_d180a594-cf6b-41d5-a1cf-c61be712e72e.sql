-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for admin access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles (only admins can manage roles)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update places table policies to allow admin access
DROP POLICY IF EXISTS "Anyone can view approved places" ON public.places;

CREATE POLICY "Anyone can view approved places"
  ON public.places FOR SELECT
  USING (status = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert places"
  ON public.places FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update places"
  ON public.places FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete places"
  ON public.places FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add AI scan tracking columns
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS last_ai_scan_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS ai_scan_count INTEGER DEFAULT 0;

-- Create AI scan logs table
CREATE TABLE IF NOT EXISTS public.ai_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scan_completed_at TIMESTAMP WITH TIME ZONE,
  places_found INTEGER DEFAULT 0,
  places_added INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  error_message TEXT,
  search_query TEXT
);

ALTER TABLE public.ai_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view scan logs"
  ON public.ai_scan_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert scan logs"
  ON public.ai_scan_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);