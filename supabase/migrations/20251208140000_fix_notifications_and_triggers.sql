-- Fix notifications table and triggers
-- This migration fixes the column mismatch between 'type' and 'notification_type'

-- ============================================
-- 1. ADD 'type' COLUMN IF IT DOESN'T EXIST
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN type VARCHAR(50) DEFAULT 'info' 
    CHECK (type IN ('info', 'warning', 'success', 'error'));
  END IF;
END $$;

-- ============================================
-- 2. ADD 'link' COLUMN IF IT DOESN'T EXIST
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'link'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN link VARCHAR(255);
  END IF;
END $$;

-- ============================================
-- 3. ADD 'metadata' COLUMN IF IT DOESN'T EXIST
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- ============================================
-- 4. FIX THE REQUEST STATUS TRIGGER
-- Uses student_id instead of requester_id
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status changes
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.student_id,  -- Fixed: use student_id, not requester_id
      'Request Status Updated',
      'Your borrow request has been ' || NEW.status,
      CASE 
        WHEN NEW.status::text = 'approved' THEN 'success'
        WHEN NEW.status::text = 'rejected' THEN 'error'
        WHEN NEW.status::text = 'returned' THEN 'info'
        ELSE 'info'
      END,
      '/my-requests'
    );
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main transaction
    RAISE WARNING 'Notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS notify_request_status_trigger ON public.borrow_requests;
CREATE TRIGGER notify_request_status_trigger
  AFTER UPDATE OF status ON public.borrow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_request_status_change();

-- ============================================
-- 5. CREATE INDEXES IF THEY DON'T EXIST
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at);

-- ============================================
-- 6. ENSURE RLS POLICIES EXIST
-- ============================================
-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());
