-- Phase 9: Audit Logging Triggers
-- Automatically log CRUD operations on key tables

-- ============================================
-- FUNCTION: Generic Audit Log Trigger
-- ============================================
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

-- ============================================
-- AUDIT TRIGGERS FOR KEY TABLES
-- ============================================

-- Items Table
DROP TRIGGER IF EXISTS audit_items_trigger ON public.items;
CREATE TRIGGER audit_items_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Profiles Table
DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Categories Table
DROP TRIGGER IF EXISTS audit_categories_trigger ON public.categories;
CREATE TRIGGER audit_categories_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Departments Table
DROP TRIGGER IF EXISTS audit_departments_trigger ON public.departments;
CREATE TRIGGER audit_departments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Borrow Requests Table
DROP TRIGGER IF EXISTS audit_borrow_requests_trigger ON public.borrow_requests;
CREATE TRIGGER audit_borrow_requests_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.borrow_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Issued Items Table
DROP TRIGGER IF EXISTS audit_issued_items_trigger ON public.issued_items;
CREATE TRIGGER audit_issued_items_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.issued_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Maintenance Records Table
DROP TRIGGER IF EXISTS audit_maintenance_records_trigger ON public.maintenance_records;
CREATE TRIGGER audit_maintenance_records_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Chemicals Table
DROP TRIGGER IF EXISTS audit_chemicals_trigger ON public.chemicals;
CREATE TRIGGER audit_chemicals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.chemicals
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Damage Reports Table
DROP TRIGGER IF EXISTS audit_damage_reports_trigger ON public.damage_reports;
CREATE TRIGGER audit_damage_reports_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.damage_reports
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ============================================
-- SEED SOME INITIAL AUDIT LOG DATA FOR TESTING
-- ============================================
INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_values)
SELECT 
  auth.uid(),
  'system_init',
  'system',
  gen_random_uuid(),
  '{"message": "Audit logging system initialized"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.audit_logs LIMIT 1);

-- Log existing items if any (one-time migration)
INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_values, created_at)
SELECT 
  items.created_by,
  'create',
  'items',
  items.id,
  jsonb_build_object('name', items.name, 'status', items.status),
  items.created_at
FROM public.items
WHERE NOT EXISTS (
  SELECT 1 FROM public.audit_logs al 
  WHERE al.entity_id = items.id AND al.entity_type = 'items'
);
