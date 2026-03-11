-- Add staff_id column to profiles for staff/teacher/technician
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS staff_id TEXT,
ADD COLUMN IF NOT EXISTS register_number TEXT,
ADD COLUMN IF NOT EXISTS additional_info TEXT,
ADD COLUMN IF NOT EXISTS is_default_admin BOOLEAN DEFAULT FALSE;

-- Create index on staff_id
CREATE INDEX IF NOT EXISTS idx_profiles_staff_id ON public.profiles(staff_id);

-- Create a function to prevent modification of default admin
CREATE OR REPLACE FUNCTION public.protect_default_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if trying to modify default admin
  IF OLD.is_default_admin = TRUE THEN
    -- For updates, prevent email/password changes (handled by auth, but we protect the flag)
    IF TG_OP = 'UPDATE' THEN
      -- Ensure is_default_admin cannot be changed to false
      IF NEW.is_default_admin = FALSE THEN
        RAISE EXCEPTION 'Cannot modify default admin status';
      END IF;
    END IF;
    
    -- Prevent deletion of default admin
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete default admin account';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to protect default admin
DROP TRIGGER IF EXISTS protect_default_admin_trigger ON public.profiles;
CREATE TRIGGER protect_default_admin_trigger
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_default_admin();

-- Create OTP verification table for student registration
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on OTP table
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Create policy for OTP table
CREATE POLICY "Anyone can create OTP" ON public.otp_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read their OTP" ON public.otp_verifications
  FOR SELECT USING (true);

CREATE POLICY "System can update OTP" ON public.otp_verifications
  FOR UPDATE USING (true);

-- Create login tracking table
CREATE TABLE IF NOT EXISTS public.login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  logout_time TIMESTAMP WITH TIME ZONE,
  session_duration INTERVAL,
  ip_address TEXT,
  device_info TEXT
);

-- Enable RLS on login logs
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- Policies for login logs
CREATE POLICY "Admin can view all login logs" ON public.login_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own login logs" ON public.login_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create login logs" ON public.login_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update login logs" ON public.login_logs
  FOR UPDATE USING (true);