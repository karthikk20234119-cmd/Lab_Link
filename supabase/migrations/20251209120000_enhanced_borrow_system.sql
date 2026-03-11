-- ============================================================================
-- Enhanced Borrow & Return System Migration
-- Created: 2025-12-09
-- Description: Adds department-based routing, staff custom messages, 
--              return requests with image verification, and notification triggers
-- ============================================================================

-- ============================================================================
-- PART 1: Enhanced borrow_requests table
-- ============================================================================

-- Add quantity field to borrow_requests (default 1 for existing records)
ALTER TABLE public.borrow_requests 
ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;

-- Add department tracking for routing purposes
ALTER TABLE public.borrow_requests 
ADD COLUMN IF NOT EXISTS item_department_id UUID REFERENCES public.departments(id);

-- Add staff message reference
ALTER TABLE public.borrow_requests 
ADD COLUMN IF NOT EXISTS staff_message TEXT;

-- Add collection details
ALTER TABLE public.borrow_requests 
ADD COLUMN IF NOT EXISTS collection_datetime TIMESTAMPTZ;

ALTER TABLE public.borrow_requests 
ADD COLUMN IF NOT EXISTS pickup_location TEXT;

ALTER TABLE public.borrow_requests 
ADD COLUMN IF NOT EXISTS conditions TEXT;

-- Extend status enum to include 'returned' and 'return_pending'
-- First check if we need to add new values
DO $$
BEGIN
    -- Check if 'returned' exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'returned' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'request_status')
    ) THEN
        ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'returned';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'return_pending' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'request_status')
    ) THEN
        ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'return_pending';
    END IF;
END $$;

-- ============================================================================
-- PART 2: Borrow Messages Table (for staff custom communication)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.borrow_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrow_request_id UUID REFERENCES public.borrow_requests(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'info', -- 'approval', 'rejection', 'info', 'return_notice', 'reply'
    subject TEXT,
    message TEXT NOT NULL,
    collection_datetime TIMESTAMPTZ,
    pickup_location TEXT,
    conditions TEXT,
    additional_instructions TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_borrow_messages_request ON public.borrow_messages(borrow_request_id);
CREATE INDEX IF NOT EXISTS idx_borrow_messages_recipient ON public.borrow_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_borrow_messages_unread ON public.borrow_messages(recipient_id, is_read) WHERE is_read = FALSE;

-- Enable RLS
ALTER TABLE public.borrow_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for borrow_messages
CREATE POLICY "Users can view their messages"
    ON public.borrow_messages FOR SELECT
    TO authenticated
    USING (recipient_id = auth.uid() OR sender_id = auth.uid());

CREATE POLICY "Staff can view messages for their requests"
    ON public.borrow_messages FOR SELECT
    TO authenticated
    USING (
        public.is_admin_or_staff(auth.uid()) AND
        EXISTS (
            SELECT 1 FROM public.borrow_requests br
            WHERE br.id = borrow_request_id
        )
    );

CREATE POLICY "Staff can create messages"
    ON public.borrow_messages FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_or_staff(auth.uid()) OR sender_id = auth.uid());

CREATE POLICY "Users can update their own messages read status"
    ON public.borrow_messages FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

-- ============================================================================
-- PART 3: Return Requests Table (with image verification)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrow_request_id UUID REFERENCES public.borrow_requests(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    return_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    item_condition TEXT NOT NULL DEFAULT 'good', -- 'good', 'damaged', 'missing_parts', 'lost'
    condition_notes TEXT,
    return_image_url TEXT NOT NULL,
    additional_images TEXT[], -- Optional additional images
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_return_requests_borrow ON public.return_requests(borrow_request_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_student ON public.return_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_item ON public.return_requests(item_id);

-- Enable RLS
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for return_requests
CREATE POLICY "Students can view their own return requests"
    ON public.return_requests FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Staff can view all return requests"
    ON public.return_requests FOR SELECT
    TO authenticated
    USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Students can create return requests"
    ON public.return_requests FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Staff can update return requests"
    ON public.return_requests FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_staff(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_return_requests_updated_at
    BEFORE UPDATE ON public.return_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- PART 4: Auto-populate department_id on borrow request
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_borrow_request_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Get the department_id from the item
    SELECT department_id INTO NEW.item_department_id
    FROM public.items
    WHERE id = NEW.item_id;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS set_borrow_request_department_trigger ON public.borrow_requests;

CREATE TRIGGER set_borrow_request_department_trigger
    BEFORE INSERT ON public.borrow_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_borrow_request_department();

-- ============================================================================
-- PART 5: Helper function to get department staff
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_department_staff(dept_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ud.user_id
    FROM public.user_departments ud
    INNER JOIN public.user_roles ur ON ud.user_id = ur.user_id
    WHERE ud.department_id = dept_id
    AND ur.role = 'staff';
$$;

-- ============================================================================
-- PART 6: Notification triggers for borrow workflow
-- ============================================================================

-- Function to notify on new borrow request
CREATE OR REPLACE FUNCTION public.notify_borrow_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item_name TEXT;
    student_name TEXT;
    staff_user_id UUID;
BEGIN
    -- Get item and student names
    SELECT name INTO item_name FROM public.items WHERE id = NEW.item_id;
    SELECT full_name INTO student_name FROM public.profiles WHERE id = NEW.student_id;
    
    -- Notify all admins
    INSERT INTO public.notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id)
    SELECT 
        ur.user_id,
        'borrow_request',
        'New Borrow Request',
        student_name || ' requested to borrow ' || COALESCE(NEW.quantity, 1) || 'x ' || item_name,
        'borrow_request',
        NEW.id
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
    
    -- Notify department staff
    IF NEW.item_department_id IS NOT NULL THEN
        FOR staff_user_id IN SELECT * FROM public.get_department_staff(NEW.item_department_id)
        LOOP
            INSERT INTO public.notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id)
            VALUES (
                staff_user_id,
                'borrow_request',
                'New Borrow Request',
                student_name || ' requested to borrow ' || COALESCE(NEW.quantity, 1) || 'x ' || item_name,
                'borrow_request',
                NEW.id
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_borrow_request_trigger ON public.borrow_requests;

CREATE TRIGGER notify_borrow_request_trigger
    AFTER INSERT ON public.borrow_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_borrow_request();

-- Function to notify on borrow status change
CREATE OR REPLACE FUNCTION public.notify_borrow_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item_name TEXT;
    notif_title TEXT;
    notif_message TEXT;
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        SELECT name INTO item_name FROM public.items WHERE id = NEW.item_id;
        
        IF NEW.status::text = 'approved' THEN
            notif_title := 'Borrow Request Approved';
            notif_message := 'Your request to borrow ' || item_name || ' has been approved.';
            IF NEW.pickup_location IS NOT NULL THEN
                notif_message := notif_message || ' Pickup: ' || NEW.pickup_location;
            END IF;
        ELSIF NEW.status::text = 'rejected' THEN
            notif_title := 'Borrow Request Rejected';
            notif_message := 'Your request to borrow ' || item_name || ' was rejected.';
            IF NEW.rejection_reason IS NOT NULL THEN
                notif_message := notif_message || ' Reason: ' || NEW.rejection_reason;
            END IF;
        ELSIF NEW.status::text = 'returned' THEN
            notif_title := 'Item Return Confirmed';
            notif_message := 'Your return of ' || item_name || ' has been verified and accepted.';
        ELSE
            RETURN NEW;
        END IF;
        
        -- Notify the student
        INSERT INTO public.notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id)
        VALUES (
            NEW.student_id,
            'borrow_' || NEW.status::text,
            notif_title,
            notif_message,
            'borrow_request',
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_borrow_status_change_trigger ON public.borrow_requests;

CREATE TRIGGER notify_borrow_status_change_trigger
    AFTER UPDATE ON public.borrow_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_borrow_status_change();

-- Function to notify on return request submission
CREATE OR REPLACE FUNCTION public.notify_return_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item_name TEXT;
    student_name TEXT;
    item_dept_id UUID;
    staff_user_id UUID;
BEGIN
    -- Get item and student names
    SELECT name, department_id INTO item_name, item_dept_id FROM public.items WHERE id = NEW.item_id;
    SELECT full_name INTO student_name FROM public.profiles WHERE id = NEW.student_id;
    
    -- Notify all admins
    INSERT INTO public.notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id)
    SELECT 
        ur.user_id,
        'return_submitted',
        'Return Request Submitted',
        student_name || ' submitted return for ' || item_name || ' (Condition: ' || NEW.item_condition || ')',
        'return_request',
        NEW.id
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
    
    -- Notify department staff
    IF item_dept_id IS NOT NULL THEN
        FOR staff_user_id IN SELECT * FROM public.get_department_staff(item_dept_id)
        LOOP
            INSERT INTO public.notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id)
            VALUES (
                staff_user_id,
                'return_submitted',
                'Return Request Submitted',
                student_name || ' submitted return for ' || item_name || ' (Condition: ' || NEW.item_condition || ')',
                'return_request',
                NEW.id
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_return_request_trigger ON public.return_requests;

CREATE TRIGGER notify_return_request_trigger
    AFTER INSERT ON public.return_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_return_request();

-- Function to notify on return verification
CREATE OR REPLACE FUNCTION public.notify_return_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item_name TEXT;
    notif_title TEXT;
    notif_message TEXT;
BEGIN
    -- Only proceed if status changed to accepted or rejected
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('accepted', 'rejected') THEN
        SELECT name INTO item_name FROM public.items WHERE id = NEW.item_id;
        
        IF NEW.status = 'accepted' THEN
            notif_title := 'Return Accepted';
            notif_message := 'Your return of ' || item_name || ' has been verified and accepted. Thank you!';
            
            -- Also update the borrow_request status to 'returned'
            UPDATE public.borrow_requests
            SET status = 'returned'
            WHERE id = NEW.borrow_request_id;
        ELSE
            notif_title := 'Return Rejected';
            notif_message := 'Your return of ' || item_name || ' was rejected.';
            IF NEW.rejection_reason IS NOT NULL THEN
                notif_message := notif_message || ' Reason: ' || NEW.rejection_reason;
            END IF;
        END IF;
        
        -- Notify the student
        INSERT INTO public.notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id)
        VALUES (
            NEW.student_id,
            'return_' || NEW.status,
            notif_title,
            notif_message,
            'return_request',
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_return_verified_trigger ON public.return_requests;

CREATE TRIGGER notify_return_verified_trigger
    AFTER UPDATE ON public.return_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_return_verified();

-- ============================================================================
-- PART 7: Update existing borrow_requests to have department_id
-- ============================================================================

UPDATE public.borrow_requests br
SET item_department_id = i.department_id
FROM public.items i
WHERE br.item_id = i.id
AND br.item_department_id IS NULL;

-- ============================================================================
-- DONE
-- ============================================================================
