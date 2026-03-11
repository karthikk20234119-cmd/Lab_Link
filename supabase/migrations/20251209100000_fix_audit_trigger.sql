-- Fix: Update audit trigger to not assume created_by column exists
-- This fixes the error: record "new" has no field "created_by"

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
  v_user_id UUID;
BEGIN
  -- Get the current user ID (auth.uid() returns the authenticated user's ID)
  v_user_id := auth.uid();
  
  -- Determine the action
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
    
    -- Use auth.uid() directly since not all tables have created_by
    INSERT INTO public.audit_logs (
      user_id, action, entity_type, entity_id, old_values, new_values
    ) VALUES (
      v_user_id,
      v_action,
      TG_TABLE_NAME,
      NEW.id,
      v_old_values,
      v_new_values
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    
    -- Only log if values actually changed
    IF v_old_values IS DISTINCT FROM v_new_values THEN
      INSERT INTO public.audit_logs (
        user_id, action, entity_type, entity_id, old_values, new_values
      ) VALUES (
        v_user_id,
        v_action,
        TG_TABLE_NAME,
        NEW.id,
        v_old_values,
        v_new_values
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    
    INSERT INTO public.audit_logs (
      user_id, action, entity_type, entity_id, old_values, new_values
    ) VALUES (
      v_user_id,
      v_action,
      TG_TABLE_NAME,
      OLD.id,
      v_old_values,
      v_new_values
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;
