-- ==========================================
-- Master Fix Migration
-- Fixes: OTP RLS, notifications schema + triggers,
-- borrow flow RLS, verify_otp function, public scan logging
-- ==========================================

-- ==========================================
-- PART 1: FIX OTP RLS — Remove exposed USING (true)
-- ==========================================

-- Drop the overly permissive anon read policy
DROP POLICY IF EXISTS "Anon can read OTP for verification" ON public.otp_verifications;

-- OTP records should NEVER be directly readable — use verify_otp() RPC instead
CREATE POLICY "No direct OTP reads"
  ON public.otp_verifications FOR SELECT
  USING (false);

-- Also block direct inserts from client — must use create_otp() RPC
DROP POLICY IF EXISTS "Allow OTP insert" ON public.otp_verifications;
CREATE POLICY "No direct OTP inserts"
  ON public.otp_verifications FOR INSERT
  WITH CHECK (false);

-- Create create_otp SECURITY DEFINER function with rate limiting
CREATE OR REPLACE FUNCTION public.create_otp(
  p_email TEXT,
  p_otp TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Rate limit: max 5 OTPs per email per 10 minutes
  SELECT COUNT(*) INTO v_count
  FROM public.otp_verifications
  WHERE email = p_email
    AND created_at > NOW() - INTERVAL '10 minutes';

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Too many OTP requests. Please wait before trying again.';
  END IF;

  INSERT INTO public.otp_verifications (email, otp, expires_at)
  VALUES (p_email, p_otp, NOW() + INTERVAL '10 minutes');
END;
$$;

-- Create verify_otp SECURITY DEFINER function (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.verify_otp(
  p_email TEXT,
  p_otp TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Find matching unexpired, unverified OTP
  SELECT id, otp, expires_at, verified
  INTO v_record
  FROM public.otp_verifications
  WHERE email = p_email
    AND otp = p_otp
    AND verified = false
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired OTP');
  END IF;

  -- Mark as verified
  UPDATE public.otp_verifications
  SET verified = true
  WHERE id = v_record.id;

  RETURN jsonb_build_object('valid', true, 'id', v_record.id);
END;
$$;

-- ==========================================
-- PART 2: FIX NOTIFICATIONS — Add missing columns + fix triggers
-- ==========================================

-- Add phase5-style columns to phase1 table (for Header.tsx compatibility)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link VARCHAR(255);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Fix notify_low_stock: use user_roles (not profiles.role), correct column names
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  IF NEW.current_quantity <= NEW.reorder_threshold 
     AND (OLD.current_quantity > OLD.reorder_threshold OR OLD.current_quantity IS NULL) THEN
    -- Notify all admins about low stock (using user_roles table)
    FOR v_admin IN 
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, notification_type,
        related_entity_type, related_entity_id, link
      ) VALUES (
        v_admin.user_id,
        'Low Stock Alert',
        'Item "' || NEW.name || '" is running low. Current quantity: ' || NEW.current_quantity,
        'warning',
        'item', NEW.id::text, '/items/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix notify_request_status_change: use student_id, correct column names
CREATE OR REPLACE FUNCTION public.notify_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO public.notifications (
      user_id, title, message, notification_type,
      related_entity_type, related_entity_id, link
    ) VALUES (
      NEW.student_id,
      'Request Status Updated',
      'Your borrow request has been ' || NEW.status,
      CASE 
        WHEN NEW.status = 'approved' THEN 'success'
        WHEN NEW.status = 'rejected' THEN 'error'
        WHEN NEW.status = 'returned' THEN 'info'
        ELSE 'info'
      END,
      'borrow_request', NEW.id::text, '/my-requests'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate triggers to use SECURITY DEFINER versions
DROP TRIGGER IF EXISTS notify_low_stock_trigger ON public.items;
CREATE TRIGGER notify_low_stock_trigger
  AFTER UPDATE OF current_quantity ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_stock();

DROP TRIGGER IF EXISTS notify_request_status_trigger ON public.borrow_requests;
CREATE TRIGGER notify_request_status_trigger
  AFTER UPDATE OF status ON public.borrow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_request_status_change();

-- Fix create_notification helper to use correct column names
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title VARCHAR(255),
  p_message TEXT DEFAULT NULL,
  p_type VARCHAR(50) DEFAULT 'info',
  p_link VARCHAR(255) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, notification_type, link, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_link, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- ==========================================
-- PART 3: FIX BORROW FLOW — Add actual_return_date + fix RLS
-- ==========================================

-- Add missing column that ReturnVerificationDialog.tsx tries to write
ALTER TABLE public.borrow_requests 
  ADD COLUMN IF NOT EXISTS actual_return_date TIMESTAMPTZ;

-- Fix student RLS: allow updating from 'approved' to 'return_pending'
DROP POLICY IF EXISTS "Students can update own pending requests" ON public.borrow_requests;
CREATE POLICY "Students can update own requests"
  ON public.borrow_requests FOR UPDATE
  USING (student_id = auth.uid() AND status IN ('pending', 'approved'))
  WITH CHECK (student_id = auth.uid() AND status IN ('pending', 'return_pending'));

-- ==========================================
-- PART 4: PUBLIC SCAN LOGGING — SECURITY DEFINER function for anon
-- ==========================================

CREATE OR REPLACE FUNCTION public.log_public_scan(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rate limit: max 100 scan logs per item per hour
  IF (SELECT COUNT(*) FROM public.activity_logs 
      WHERE entity_id = p_item_id::text 
      AND action = 'scanned' 
      AND created_at > NOW() - INTERVAL '1 hour') >= 100 THEN
    RETURN; -- Silently skip if rate limited
  END IF;

  INSERT INTO public.activity_logs (entity_type, entity_id, action, description)
  VALUES ('item', p_item_id::text, 'scanned', 'QR code was scanned (public)');
END;
$$;
