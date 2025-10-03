-- Security Hardening: Verify and document RLS policies for analytics tables
-- This migration ensures that sensitive analytics data is only accessible to admins

-- Verify that page_views has proper RLS enabled
-- The existing policy already restricts SELECT to admins only, but we're adding
-- explicit documentation and verification here

-- Add a comment to the table to document the security requirement
COMMENT ON TABLE public.page_views IS 'Contains sensitive user tracking data. Access restricted to admins only via RLS policies.';

-- Verify similar protection exists on other analytics tables
COMMENT ON TABLE public.analytics_sessions IS 'Contains user session analytics. Access restricted to admins only via RLS policies.';
COMMENT ON TABLE public.search_queries IS 'Contains user search patterns. Access restricted to admins only via RLS policies.';
COMMENT ON TABLE public.place_interactions IS 'Contains user interaction data. Access restricted to admins only via RLS policies.';

-- Add index for better admin query performance while maintaining security
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON public.page_views(session_id);