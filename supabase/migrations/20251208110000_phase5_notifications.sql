-- Phase 5: Notifications System
-- Real-time notifications for users

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_read BOOLEAN DEFAULT false,
  link VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- System can create notifications for any user
CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create a notification
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
  INSERT INTO public.notifications (user_id, title, message, type, link, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_link, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE id = p_notification_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to get unread count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = auth.uid() AND is_read = false;
  
  RETURN v_count;
END;
$$;

-- ============================================
-- TRIGGER: Auto-notify on low stock
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  IF NEW.current_quantity <= NEW.reorder_threshold AND OLD.current_quantity > OLD.reorder_threshold THEN
    -- Notify all admins about low stock
    FOR v_admin IN SELECT id FROM public.profiles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_admin.id,
        'Low Stock Alert',
        'Item "' || NEW.name || '" is running low. Current quantity: ' || NEW.current_quantity,
        'warning',
        '/items/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_low_stock_trigger ON public.items;
CREATE TRIGGER notify_low_stock_trigger
  AFTER UPDATE OF current_quantity ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_stock();

-- ============================================
-- TRIGGER: Notify on request status change
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.requester_id,
      'Request Status Updated',
      'Your borrow request has been ' || NEW.status,
      CASE 
        WHEN NEW.status = 'approved' THEN 'success'
        WHEN NEW.status = 'rejected' THEN 'error'
        ELSE 'info'
      END,
      '/my-requests'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_request_status_trigger ON public.borrow_requests;
CREATE TRIGGER notify_request_status_trigger
  AFTER UPDATE OF status ON public.borrow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_request_status_change();
