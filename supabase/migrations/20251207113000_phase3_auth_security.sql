-- Phase 3: Enhanced Authentication & Security
-- First-login password change, session management, security features

-- ============================================
-- ENHANCE PROFILES TABLE
-- ============================================
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- ============================================
-- USER SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Session info
  session_token TEXT,
  
  -- Device info
  device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
  browser VARCHAR(100),
  os VARCHAR(100),
  device_name VARCHAR(255),
  
  -- Location
  ip_address VARCHAR(50),
  city VARCHAR(100),
  country VARCHAR(100),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_current BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- ============================================
-- LOGIN ATTEMPTS TABLE (Security Audit)
-- ============================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  email VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Attempt info
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(100),
  
  -- Device info
  ip_address VARCHAR(50),
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  
  -- Location
  city VARCHAR(100),
  country VARCHAR(100),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PASSWORD HISTORY (Prevent reuse)
-- ============================================
CREATE TABLE IF NOT EXISTS public.password_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON public.login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON public.login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_user ON public.password_history(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- User Sessions - Users can view their own, admin can view all
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Users can manage own sessions"
  ON public.user_sessions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "System can create sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (true);

-- Login Attempts - Admin only for viewing, system can insert
CREATE POLICY "Admin can view login attempts"
  ON public.login_attempts FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "System can log login attempts"
  ON public.login_attempts FOR INSERT
  WITH CHECK (true);

-- Password History - System only, no user access
CREATE POLICY "No direct access to password history"
  ON public.password_history FOR SELECT
  USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to log a login attempt
CREATE OR REPLACE FUNCTION public.log_login_attempt(
  p_email VARCHAR(255),
  p_success BOOLEAN,
  p_failure_reason VARCHAR(100) DEFAULT NULL,
  p_ip_address VARCHAR(50) DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_attempt_id UUID;
BEGIN
  -- Get user ID if exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  -- Insert login attempt
  INSERT INTO public.login_attempts (
    email, user_id, success, failure_reason, ip_address, user_agent
  ) VALUES (
    p_email, v_user_id, p_success, p_failure_reason, p_ip_address, p_user_agent
  ) RETURNING id INTO v_attempt_id;
  
  -- Update user stats
  IF v_user_id IS NOT NULL THEN
    IF p_success THEN
      UPDATE public.profiles SET
        last_login_at = NOW(),
        login_count = COALESCE(login_count, 0) + 1,
        failed_login_attempts = 0
      WHERE id = v_user_id;
    ELSE
      UPDATE public.profiles SET
        failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1
      WHERE id = v_user_id;
    END IF;
  END IF;
  
  RETURN v_attempt_id;
END;
$$;

-- Function to create a session
CREATE OR REPLACE FUNCTION public.create_user_session(
  p_user_id UUID,
  p_device_type VARCHAR(50) DEFAULT NULL,
  p_browser VARCHAR(100) DEFAULT NULL,
  p_os VARCHAR(100) DEFAULT NULL,
  p_ip_address VARCHAR(50) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Create new session
  INSERT INTO public.user_sessions (
    user_id, device_type, browser, os, ip_address, expires_at
  ) VALUES (
    p_user_id, p_device_type, p_browser, p_os, p_ip_address, 
    NOW() + INTERVAL '7 days'
  ) RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

-- Function to end a session
CREATE OR REPLACE FUNCTION public.end_user_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions SET
    is_active = false,
    ended_at = NOW()
  WHERE id = p_session_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to end all sessions except current
CREATE OR REPLACE FUNCTION public.end_all_other_sessions(p_current_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.user_sessions SET
    is_active = false,
    ended_at = NOW()
  WHERE user_id = auth.uid() 
    AND id != p_current_session_id 
    AND is_active = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to check if password change is required
CREATE OR REPLACE FUNCTION public.check_password_change_required(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_must_change BOOLEAN;
  v_changed_at TIMESTAMPTZ;
BEGIN
  SELECT must_change_password, password_changed_at 
  INTO v_must_change, v_changed_at
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Password change required if:
  -- 1. must_change_password is true
  -- 2. password_changed_at is NULL (never changed)
  RETURN COALESCE(v_must_change, false) OR v_changed_at IS NULL;
END;
$$;

-- Function to mark password as changed
CREATE OR REPLACE FUNCTION public.mark_password_changed(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET
    password_changed_at = NOW(),
    must_change_password = false
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.update_session_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_session_activity_trigger
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_session_activity();
