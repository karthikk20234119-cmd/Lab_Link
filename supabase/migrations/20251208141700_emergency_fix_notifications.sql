-- Emergency fix for notifications trigger
-- This migration drops the problematic trigger and recreates it properly

-- Drop the problematic trigger first
DROP TRIGGER IF EXISTS notify_request_status_trigger ON public.borrow_requests;

-- Drop the old function
DROP FUNCTION IF EXISTS public.notify_request_status_change();

-- Add 'type' column if it doesn't exist (for older table version)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN type VARCHAR(50) DEFAULT 'info';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Column type may already exist or table structure is different';
END $$;

-- Add 'link' column if it doesn't exist
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Column link may already exist';
END $$;

-- Create a SAFE version of the notification function that handles errors gracefully
CREATE OR REPLACE FUNCTION public.notify_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_type TEXT;
BEGIN
  -- Only trigger when status actually changes
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Determine notification type based on new status
    CASE NEW.status::text
      WHEN 'approved' THEN v_notification_type := 'success';
      WHEN 'rejected' THEN v_notification_type := 'error';
      ELSE v_notification_type := 'info';
    END CASE;
    
    -- Try to insert notification, but don't fail if it doesn't work
    BEGIN
      -- Check if 'type' column exists, if not use notification_type
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'type'
      ) THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          NEW.student_id,
          'Request Status Updated',
          'Your borrow request has been ' || NEW.status::text,
          v_notification_type,
          '/my-requests'
        );
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'notification_type'
      ) THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type)
        VALUES (
          NEW.student_id,
          'Request Status Updated',
          'Your borrow request has been ' || NEW.status::text,
          v_notification_type
        );
      ELSE
        -- Fallback: just insert without type
        INSERT INTO public.notifications (user_id, title, message)
        VALUES (
          NEW.student_id,
          'Request Status Updated',
          'Your borrow request has been ' || NEW.status::text
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log the error but don't fail the main transaction
        RAISE WARNING 'Notification creation failed: %. Status update will continue.', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER notify_request_status_trigger
  AFTER UPDATE OF status ON public.borrow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_request_status_change();
