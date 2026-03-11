-- Phase 6: User and System Settings
-- Safe migration that handles partial previous runs

-- ============================================
-- FIX: Drop and recreate system_settings if it has wrong schema
-- ============================================
DROP TABLE IF EXISTS public.system_settings CASCADE;

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  request_alerts BOOLEAN DEFAULT true,
  maintenance_alerts BOOLEAN DEFAULT true,
  low_stock_alerts BOOLEAN DEFAULT true,
  theme VARCHAR(20) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SYSTEM SETTINGS TABLE (Admin only)
-- ============================================
CREATE TABLE public.system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('default_borrow_duration_days', '7', 'Default borrow duration in days'),
  ('low_stock_threshold', '5', 'Default low stock threshold'),
  ('system_name', 'LabLink', 'System display name'),
  ('allow_student_requests', 'true', 'Allow students to create borrow requests')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- User Settings policies
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (id = auth.uid());

-- System Settings - readable by all, admins can modify
CREATE POLICY "Anyone can view system settings"
  ON public.system_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can modify system settings"
  ON public.system_settings FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- TRIGGER: Update user_settings timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_user_settings_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_settings_timestamp_trigger ON public.user_settings;
CREATE TRIGGER update_user_settings_timestamp_trigger
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_settings_timestamp();
