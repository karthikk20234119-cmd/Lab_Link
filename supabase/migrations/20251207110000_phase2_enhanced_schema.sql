-- Phase 2: Enhanced Database Schema
-- Chemical Management, System Settings, and Backups

-- ============================================
-- CHEMICAL HAZARD TYPES
-- ============================================
CREATE TABLE IF NOT EXISTS public.chemical_hazard_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  color_hex VARCHAR(7) DEFAULT '#DC2626',
  icon_name VARCHAR(50),
  safety_precautions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default hazard types
INSERT INTO public.chemical_hazard_types (name, code, description, color_hex, safety_precautions) VALUES
  ('Flammable', 'FLAM', 'Substances that can catch fire easily', '#EF4444', ARRAY['Keep away from heat sources', 'Store in cool, dry place', 'Use fire-resistant containers']),
  ('Corrosive', 'CORR', 'Substances that can cause severe damage to living tissue', '#F97316', ARRAY['Wear protective gloves', 'Use in ventilated area', 'Avoid skin contact']),
  ('Toxic', 'TOX', 'Substances harmful or fatal if inhaled, ingested, or absorbed', '#7C3AED', ARRAY['Handle with extreme care', 'Use fume hood', 'Wear full PPE']),
  ('Oxidizer', 'OXID', 'Substances that can intensify fire by providing oxygen', '#EAB308', ARRAY['Keep away from flammables', 'Store separately', 'Handle carefully']),
  ('Explosive', 'EXPL', 'Substances that can explode under certain conditions', '#DC2626', ARRAY['Avoid shock and friction', 'Store in approved containers', 'Limited quantities only']),
  ('Radioactive', 'RAD', 'Substances that emit ionizing radiation', '#A855F7', ARRAY['Use radiation shielding', 'Limit exposure time', 'Monitor radiation levels']),
  ('Biohazard', 'BIO', 'Biological substances that pose a threat to health', '#22C55E', ARRAY['Use biosafety cabinet', 'Autoclave waste', 'Follow BSL protocols']),
  ('Irritant', 'IRR', 'Substances that cause reversible irritation', '#3B82F6', ARRAY['Avoid eye contact', 'Use in ventilated area', 'Wash hands after use'])
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- CHEMICALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.chemicals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cas_number VARCHAR(50),
  formula VARCHAR(100),
  description TEXT,
  
  -- Inventory
  current_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'ml',
  minimum_quantity DECIMAL(10,3) DEFAULT 0,
  
  -- Classification
  hazard_type_id UUID REFERENCES public.chemical_hazard_types(id),
  storage_location VARCHAR(255),
  storage_conditions TEXT,
  
  -- Safety
  msds_url TEXT,
  safety_data JSONB DEFAULT '{}',
  
  -- Dates
  manufacture_date DATE,
  expiry_date DATE,
  received_date DATE DEFAULT CURRENT_DATE,
  
  -- Supplier
  supplier_name VARCHAR(255),
  supplier_contact VARCHAR(255),
  batch_number VARCHAR(100),
  
  -- Department
  department_id UUID REFERENCES public.departments(id),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_expired BOOLEAN DEFAULT false,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHEMICAL TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.chemical_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chemical_id UUID REFERENCES public.chemicals(id) ON DELETE CASCADE NOT NULL,
  
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('received', 'used', 'disposed', 'transferred', 'adjusted')),
  
  quantity DECIMAL(10,3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  
  -- Before/After
  quantity_before DECIMAL(10,3),
  quantity_after DECIMAL(10,3),
  
  -- Details
  purpose TEXT,
  notes TEXT,
  
  -- For transfers
  from_location VARCHAR(255),
  to_location VARCHAR(255),
  
  -- User
  performed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SYSTEM SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- App Branding
  app_name VARCHAR(100) DEFAULT 'LabLink',
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#0891B2',
  secondary_color VARCHAR(7) DEFAULT '#1E3A8A',
  
  -- Organization
  organization_name VARCHAR(255),
  organization_address TEXT,
  organization_phone VARCHAR(50),
  organization_email VARCHAR(255),
  
  -- Email Settings
  email_sender_name VARCHAR(100) DEFAULT 'LabLink',
  email_sender_address VARCHAR(255) DEFAULT 'lablink83@gmail.com',
  smtp_configured BOOLEAN DEFAULT false,
  
  -- Notification Settings
  enable_email_notifications BOOLEAN DEFAULT true,
  enable_low_stock_alerts BOOLEAN DEFAULT true,
  enable_expiry_alerts BOOLEAN DEFAULT true,
  expiry_alert_days INTEGER DEFAULT 30,
  low_stock_threshold_percent INTEGER DEFAULT 20,
  
  -- Borrow Settings
  max_borrow_days INTEGER DEFAULT 14,
  max_items_per_request INTEGER DEFAULT 5,
  require_approval BOOLEAN DEFAULT true,
  auto_approve_staff BOOLEAN DEFAULT false,
  
  -- QR Code Settings
  qr_code_prefix VARCHAR(50) DEFAULT 'LABLINK',
  qr_expiry_hours INTEGER DEFAULT 24,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.system_settings (app_name, organization_name) 
VALUES ('LabLink', 'Your Organization')
ON CONFLICT DO NOTHING;

-- ============================================
-- BACKUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  backup_name VARCHAR(255) NOT NULL,
  backup_type VARCHAR(50) NOT NULL CHECK (backup_type IN ('full', 'incremental', 'tables', 'schema')),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  
  -- Details
  file_path TEXT,
  file_size_bytes BIGINT,
  tables_included TEXT[],
  
  -- Timings
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error handling
  error_message TEXT,
  
  -- User
  created_by UUID REFERENCES auth.users(id),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chemicals_department ON public.chemicals(department_id);
CREATE INDEX IF NOT EXISTS idx_chemicals_hazard ON public.chemicals(hazard_type_id);
CREATE INDEX IF NOT EXISTS idx_chemicals_expiry ON public.chemicals(expiry_date);
CREATE INDEX IF NOT EXISTS idx_chemicals_active ON public.chemicals(is_active);
CREATE INDEX IF NOT EXISTS idx_chemical_transactions_chemical ON public.chemical_transactions(chemical_id);
CREATE INDEX IF NOT EXISTS idx_chemical_transactions_date ON public.chemical_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_backups_status ON public.backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_created ON public.backups(created_at);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.chemical_hazard_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- Chemical Hazard Types - Everyone can view
CREATE POLICY "Anyone can view hazard types"
  ON public.chemical_hazard_types FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage hazard types"
  ON public.chemical_hazard_types FOR ALL
  USING (public.is_admin_or_staff(auth.uid()));

-- Chemicals - Staff and above can view and manage
CREATE POLICY "Staff and above can view chemicals"
  ON public.chemicals FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Staff and above can manage chemicals"
  ON public.chemicals FOR ALL
  USING (public.is_admin_or_staff(auth.uid()));

-- Chemical Transactions - Staff and above
CREATE POLICY "Staff and above can view chemical transactions"
  ON public.chemical_transactions FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Staff and above can create chemical transactions"
  ON public.chemical_transactions FOR INSERT
  WITH CHECK (public.is_admin_or_staff(auth.uid()));

-- System Settings - Everyone can view, admin/staff can manage
CREATE POLICY "Everyone can view system settings"
  ON public.system_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage system settings"
  ON public.system_settings FOR ALL
  USING (public.is_admin_or_staff(auth.uid()));

-- Backups - Admin/Staff only
CREATE POLICY "Admin can view backups"
  ON public.backups FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Admin can manage backups"
  ON public.backups FOR ALL
  USING (public.is_admin_or_staff(auth.uid()));

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER update_chemicals_updated_at
  BEFORE UPDATE ON public.chemicals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_chemical_hazard_types_updated_at
  BEFORE UPDATE ON public.chemical_hazard_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
