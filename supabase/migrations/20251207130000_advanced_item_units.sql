-- Advanced Features: Item Units, QR Codes, Activity Logs
-- Implements: Serial number management, QR tracking, usage logs

-- ============================================
-- ITEM UNITS TABLE (Individual units with serial numbers)
-- ============================================
CREATE TABLE IF NOT EXISTS public.item_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  
  -- Serial & Identification
  unit_serial_number VARCHAR(100) NOT NULL,
  unit_number INTEGER NOT NULL,
  
  -- QR Code
  qr_code_data TEXT NOT NULL,
  qr_code_url TEXT,
  
  -- Status
  status VARCHAR(30) DEFAULT 'available' CHECK (status IN ('available', 'issued', 'reserved', 'maintenance', 'damaged', 'scrapped', 'lost')),
  condition VARCHAR(30) DEFAULT 'good',
  
  -- Current assignment
  current_holder_id UUID REFERENCES auth.users(id),
  issued_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  
  -- Location
  current_location VARCHAR(255),
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACTIVITY LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Entity reference
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('item', 'item_unit', 'borrow_request', 'user', 'department', 'category')),
  entity_id UUID NOT NULL,
  
  -- Action
  action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'issued', 'returned', 'damaged', 'repaired', 'transferred', 'viewed', 'scanned')),
  
  -- Details
  description TEXT,
  old_values JSONB,
  new_values JSONB,
  
  -- User & metadata
  performed_by UUID REFERENCES auth.users(id),
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_units_serial ON public.item_units(item_id, unit_serial_number);
CREATE INDEX IF NOT EXISTS idx_item_units_item ON public.item_units(item_id);
CREATE INDEX IF NOT EXISTS idx_item_units_status ON public.item_units(status);
CREATE INDEX IF NOT EXISTS idx_item_units_holder ON public.item_units(current_holder_id);
CREATE INDEX IF NOT EXISTS idx_item_units_qr ON public.item_units(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.item_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Item Units - Based on role
CREATE POLICY "Anyone can view item units"
  ON public.item_units FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage item units"
  ON public.item_units FOR ALL
  USING (public.is_admin_or_staff(auth.uid()));

-- Activity Logs - Admin/Staff can view, everyone can insert (for scans)
CREATE POLICY "Staff can view activity logs"
  ON public.activity_logs FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Anyone can create activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- FUNCTION: Generate Item Units with Serial Numbers
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_item_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_i INTEGER;
  v_serial TEXT;
  v_qr_data TEXT;
  v_item_prefix TEXT;
BEGIN
  -- Only run on INSERT or when quantity increases
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.current_quantity > OLD.current_quantity) THEN
    
    -- Get item name prefix (first 3 chars uppercase)
    v_item_prefix := UPPER(SUBSTRING(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9]', '', 'g'), 1, 3));
    IF v_item_prefix = '' THEN v_item_prefix := 'ITM'; END IF;
    
    -- Generate units for the quantity
    FOR v_i IN 1..NEW.current_quantity LOOP
      -- Check if unit already exists
      IF NOT EXISTS (SELECT 1 FROM public.item_units WHERE item_id = NEW.id AND unit_number = v_i) THEN
        -- Generate serial number: PREFIX-ITEMCODE-001
        v_serial := v_item_prefix || '-' || COALESCE(NEW.item_code, NEW.id::TEXT) || '-' || LPAD(v_i::TEXT, 3, '0');
        
        -- Generate QR code data (unique identifier)
        v_qr_data := 'LABLINK:' || NEW.id::TEXT || ':' || v_i::TEXT || ':' || EXTRACT(EPOCH FROM NOW())::TEXT;
        
        INSERT INTO public.item_units (item_id, unit_serial_number, unit_number, qr_code_data, status, condition)
        VALUES (NEW.id, v_serial, v_i, v_qr_data, 'available', COALESCE(NEW.condition, 'good'));
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto unit generation
DROP TRIGGER IF EXISTS generate_item_units_trigger ON public.items;
CREATE TRIGGER generate_item_units_trigger
  AFTER INSERT OR UPDATE OF current_quantity ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_item_units();

-- ============================================
-- FUNCTION: Log Activity
-- ============================================
CREATE OR REPLACE FUNCTION public.log_activity(
  p_entity_type VARCHAR(50),
  p_entity_id UUID,
  p_action VARCHAR(50),
  p_description TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (entity_type, entity_id, action, description, old_values, new_values, performed_by)
  VALUES (p_entity_type, p_entity_id, p_action, p_description, p_old_values, p_new_values, auth.uid())
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================
-- FUNCTION: Get Item Unit by QR Code
-- ============================================
CREATE OR REPLACE FUNCTION public.get_item_by_qr(p_qr_code TEXT)
RETURNS TABLE (
  unit_id UUID,
  unit_serial TEXT,
  item_id UUID,
  item_name TEXT,
  item_code TEXT,
  category_name TEXT,
  department_name TEXT,
  image_url TEXT,
  status TEXT,
  condition TEXT,
  current_holder TEXT,
  issued_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    iu.id as unit_id,
    iu.unit_serial_number as unit_serial,
    i.id as item_id,
    i.name as item_name,
    i.item_code,
    c.name as category_name,
    d.name as department_name,
    i.image_url,
    iu.status::TEXT,
    iu.condition::TEXT,
    p.full_name as current_holder,
    iu.issued_date,
    iu.due_date
  FROM public.item_units iu
  JOIN public.items i ON i.id = iu.item_id
  LEFT JOIN public.categories c ON c.id = i.category_id
  LEFT JOIN public.departments d ON d.id = i.department_id
  LEFT JOIN public.profiles p ON p.id = iu.current_holder_id
  WHERE iu.qr_code_data = p_qr_code;
END;
$$;

-- ============================================
-- UPDATE TRIGGER
-- ============================================
CREATE TRIGGER update_item_units_updated_at
  BEFORE UPDATE ON public.item_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
