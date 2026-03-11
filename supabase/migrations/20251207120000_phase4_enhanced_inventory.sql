-- Phase 4: Enhanced Inventory System
-- Add missing columns to items table and create supporting structures

-- ============================================
-- ITEM TYPES ENUM
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.item_type AS ENUM ('equipment', 'consumable', 'chemical', 'tool', 'glassware', 'electronic', 'furniture', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.item_condition AS ENUM ('new', 'excellent', 'good', 'fair', 'poor', 'damaged', 'scrapped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- ENHANCE ITEMS TABLE
-- ============================================
ALTER TABLE public.items 
  ADD COLUMN IF NOT EXISTS asset_tag VARCHAR(100),
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'equipment',
  ADD COLUMN IF NOT EXISTS condition VARCHAR(50) DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS lab_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shelf_location VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sub_images TEXT[],
  ADD COLUMN IF NOT EXISTS is_borrowable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
  ADD COLUMN IF NOT EXISTS last_maintenance_date DATE,
  ADD COLUMN IF NOT EXISTS next_maintenance_date DATE,
  ADD COLUMN IF NOT EXISTS maintenance_interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS supplier_contact VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================
-- ITEM IMAGES TABLE (for gallery)
-- ============================================
CREATE TABLE IF NOT EXISTS public.item_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  caption VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STOCK ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'expiry_warning', 'expired', 'warranty_expiry', 'maintenance_due')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ITEM TRANSACTIONS (Movement history)
-- ============================================
CREATE TABLE IF NOT EXISTS public.item_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('received', 'issued', 'returned', 'transferred', 'adjusted', 'disposed', 'lost', 'damaged')),
  quantity INTEGER NOT NULL,
  quantity_before INTEGER,
  quantity_after INTEGER,
  from_location VARCHAR(255),
  to_location VARCHAR(255),
  related_user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_items_asset_tag ON public.items(asset_tag);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON public.items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_type ON public.items(item_type);
CREATE INDEX IF NOT EXISTS idx_items_condition ON public.items(condition);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status);
CREATE INDEX IF NOT EXISTS idx_item_images_item ON public.item_images(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_item ON public.stock_alerts(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_unread ON public.stock_alerts(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_item_transactions_item ON public.item_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_item_transactions_date ON public.item_transactions(created_at);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_transactions ENABLE ROW LEVEL SECURITY;

-- Item Images - Everyone can view, staff can manage
CREATE POLICY "Anyone can view item images"
  ON public.item_images FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage item images"
  ON public.item_images FOR ALL
  USING (public.is_admin_or_staff(auth.uid()));

-- Stock Alerts - Staff and above
CREATE POLICY "Staff can view stock alerts"
  ON public.stock_alerts FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Staff can manage stock alerts"
  ON public.stock_alerts FOR ALL
  USING (public.is_admin_or_staff(auth.uid()));

-- Item Transactions - Staff can view and create
CREATE POLICY "Staff can view item transactions"
  ON public.item_transactions FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Staff can create item transactions"
  ON public.item_transactions FOR INSERT
  WITH CHECK (public.is_admin_or_staff(auth.uid()));

-- ============================================
-- FUNCTION: Generate Item Code
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_item_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_count INTEGER;
  v_code TEXT;
BEGIN
  -- Get prefix from category or use default
  SELECT COALESCE(UPPER(SUBSTRING(c.name, 1, 3)), 'ITM')
  INTO v_prefix
  FROM public.categories c
  WHERE c.id = NEW.category_id;
  
  IF v_prefix IS NULL THEN
    v_prefix := 'ITM';
  END IF;
  
  -- Get count of items in this category
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.items
  WHERE category_id = NEW.category_id;
  
  -- Generate code: PREFIX-YEAR-SEQUENCE
  v_code := v_prefix || '-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(v_count::TEXT, 4, '0');
  
  NEW.item_code := v_code;
  RETURN NEW;
END;
$$;

-- Create trigger for auto item code
DROP TRIGGER IF EXISTS generate_item_code_trigger ON public.items;
CREATE TRIGGER generate_item_code_trigger
  BEFORE INSERT ON public.items
  FOR EACH ROW
  WHEN (NEW.item_code IS NULL)
  EXECUTE FUNCTION public.generate_item_code();

-- ============================================
-- FUNCTION: Check Low Stock
-- ============================================
CREATE OR REPLACE FUNCTION public.check_stock_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for low stock
  IF NEW.current_quantity <= NEW.reorder_threshold AND NEW.current_quantity > 0 THEN
    INSERT INTO public.stock_alerts (item_id, alert_type, message)
    VALUES (NEW.id, 'low_stock', 'Item "' || NEW.name || '" is running low. Current: ' || NEW.current_quantity)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Check for out of stock
  IF NEW.current_quantity <= 0 THEN
    INSERT INTO public.stock_alerts (item_id, alert_type, message)
    VALUES (NEW.id, 'out_of_stock', 'Item "' || NEW.name || '" is out of stock!')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_stock_alerts_trigger ON public.items;
CREATE TRIGGER check_stock_alerts_trigger
  AFTER UPDATE OF current_quantity ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stock_alerts();

-- ============================================
-- INSERT DEFAULT CATEGORIES (only if not exists)
-- ============================================
DO $$
BEGIN
  INSERT INTO public.categories (name, description, color_hex, icon_name, low_stock_threshold)
  SELECT 'Electronics', 'Electronic equipment and components', '#3B82F6', 'Cpu', 5
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Electronics');
  
  INSERT INTO public.categories (name, description, color_hex, icon_name, low_stock_threshold)
  SELECT 'Glassware', 'Laboratory glassware and containers', '#8B5CF6', 'FlaskConical', 10
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Glassware');
  
  INSERT INTO public.categories (name, description, color_hex, icon_name, low_stock_threshold)
  SELECT 'Chemicals', 'Chemical substances and reagents', '#EF4444', 'FlaskRound', 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Chemicals');
  
  INSERT INTO public.categories (name, description, color_hex, icon_name, low_stock_threshold)
  SELECT 'Tools', 'Hand tools and measuring instruments', '#F59E0B', 'Wrench', 5
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Tools');
  
  INSERT INTO public.categories (name, description, color_hex, icon_name, low_stock_threshold)
  SELECT 'Consumables', 'Disposable and consumable items', '#10B981', 'Package', 20
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Consumables');
  
  INSERT INTO public.categories (name, description, color_hex, icon_name, low_stock_threshold)
  SELECT 'Safety Equipment', 'Personal protective equipment', '#EC4899', 'Shield', 10
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Safety Equipment');
  
  INSERT INTO public.categories (name, description, color_hex, icon_name, low_stock_threshold)
  SELECT 'Furniture', 'Lab furniture and fixtures', '#6366F1', 'Armchair', 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Furniture');
  
  INSERT INTO public.categories (name, description, color_hex, icon_name, low_stock_threshold)
  SELECT 'Computers', 'Computers and peripherals', '#14B8A6', 'Monitor', 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Computers');
END $$;
