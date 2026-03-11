-- ==========================================
-- TallyPrime Integration Schema
-- Phase 1: Master Data Sync, Purchase Orders, Stock Journals
-- ==========================================

-- 1. Tally Configuration Table
CREATE TABLE IF NOT EXISTS tally_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host TEXT NOT NULL DEFAULT 'localhost',
  port INTEGER NOT NULL DEFAULT 9000,
  company_name TEXT NOT NULL DEFAULT '',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only one config row allowed
CREATE UNIQUE INDEX IF NOT EXISTS tally_config_singleton ON tally_config ((true));

-- 2. Vendors / Suppliers Table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tally_ledger_name TEXT,
  gstin TEXT,
  pan TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  payment_terms TEXT,
  credit_limit NUMERIC(15,2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Purchase Orders Table
CREATE TYPE purchase_order_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'sent_to_tally',
  'rejected',
  'cancelled'
);

CREATE TYPE tally_sync_status AS ENUM (
  'pending',
  'synced',
  'failed',
  'not_applicable'
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  department_id UUID REFERENCES departments(id),
  status purchase_order_status NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_gst NUMERIC(15,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  tally_voucher_number TEXT,
  tally_sync_status tally_sync_status NOT NULL DEFAULT 'not_applicable',
  tally_sync_error TEXT,
  tally_synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-generate PO numbers
CREATE SEQUENCE IF NOT EXISTS po_number_seq START WITH 1001;

-- 4. Purchase Order Items Table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  chemical_id UUID REFERENCES chemicals(id),
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(15,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'Nos',
  rate NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  cgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  hsn_code TEXT,
  batch_number TEXT,
  manufacture_date DATE,
  expiry_date DATE,
  tally_stock_item_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tally Sync Mappings Table
CREATE TABLE IF NOT EXISTS tally_sync_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('stock_item', 'ledger', 'godown', 'cost_center')),
  lablink_id UUID NOT NULL,
  lablink_name TEXT NOT NULL,
  tally_name TEXT NOT NULL,
  sync_status tally_sync_status NOT NULL DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_type, lablink_id)
);

-- 6. Tally Sync Logs Table
CREATE TABLE IF NOT EXISTS tally_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation TEXT NOT NULL CHECK (operation IN (
    'sync_stock_item', 'sync_ledger', 'sync_godown', 'sync_cost_center',
    'create_purchase_voucher', 'create_stock_journal', 'test_connection',
    'sync_batch', 'post_depreciation', 'budget_check'
  )),
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  tally_request_xml TEXT,
  tally_response TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- Row Level Security Policies
-- ==========================================

ALTER TABLE tally_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_sync_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_sync_logs ENABLE ROW LEVEL SECURITY;

-- Tally Config: Only admin/staff can read/write
CREATE POLICY "Admin and staff can read tally config" ON tally_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

CREATE POLICY "Admin can manage tally config" ON tally_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Vendors: Admin/staff can CRUD
CREATE POLICY "Admin and staff can read vendors" ON vendors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

CREATE POLICY "Admin and staff can manage vendors" ON vendors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

-- Purchase Orders: Admin/staff can CRUD  
CREATE POLICY "Admin and staff can read purchase orders" ON purchase_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

CREATE POLICY "Admin and staff can manage purchase orders" ON purchase_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

-- Purchase Order Items: Same as parent
CREATE POLICY "Admin and staff can read po items" ON purchase_order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

CREATE POLICY "Admin and staff can manage po items" ON purchase_order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

-- Sync Mappings: Admin/staff can read, admin can write
CREATE POLICY "Admin and staff can read sync mappings" ON tally_sync_mappings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

CREATE POLICY "Admin can manage sync mappings" ON tally_sync_mappings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Sync Logs: Admin/staff can read
CREATE POLICY "Admin and staff can read sync logs" ON tally_sync_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

CREATE POLICY "Admin and staff can insert sync logs" ON tally_sync_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'staff'))
  );

-- ==========================================
-- Helper Function: Generate PO Number
-- ==========================================
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO-' || LPAD(nextval('po_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_po_number();

-- ==========================================
-- Helper Function: Auto-update updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION update_tally_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tally_config_updated_at
  BEFORE UPDATE ON tally_config
  FOR EACH ROW EXECUTE FUNCTION update_tally_updated_at();

CREATE TRIGGER trigger_update_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_tally_updated_at();

CREATE TRIGGER trigger_update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_tally_updated_at();

CREATE TRIGGER trigger_update_sync_mappings_updated_at
  BEFORE UPDATE ON tally_sync_mappings
  FOR EACH ROW EXECUTE FUNCTION update_tally_updated_at();
