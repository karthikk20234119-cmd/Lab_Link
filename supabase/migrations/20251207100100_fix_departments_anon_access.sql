-- Fix: Allow anonymous users to read active departments for registration
-- This is needed because students need to see departments before they're authenticated

-- Drop the existing policy and recreate with anon access
DROP POLICY IF EXISTS "Everyone can view active departments" ON public.departments;

-- Create a policy that allows both authenticated and anonymous users to read active departments
CREATE POLICY "Allow public read of active departments"
  ON public.departments FOR SELECT
  USING (is_active = true);

-- Also ensure the anon role has usage on public schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.departments TO anon;
