
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'student', 'technician');

-- Create enum for item status
CREATE TYPE public.item_status AS ENUM ('available', 'borrowed', 'under_maintenance', 'damaged', 'archived');

-- Create enum for safety level
CREATE TYPE public.safety_level AS ENUM ('low', 'medium', 'high', 'hazardous');

-- Create enum for request status
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for damage severity
CREATE TYPE public.damage_severity AS ENUM ('minor', 'moderate', 'severe');

-- Create enum for maintenance status
CREATE TYPE public.maintenance_status AS ENUM ('pending', 'in_progress', 'on_hold', 'completed', 'scrapped');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  college_name TEXT,
  profile_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  UNIQUE (user_id, role)
);

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  head_user_id UUID REFERENCES public.profiles(id),
  location_building TEXT,
  contact_email TEXT,
  budget DECIMAL(12,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_departments junction table
CREATE TABLE public.user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, department_id)
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_category_id UUID REFERENCES public.categories(id),
  low_stock_threshold INT DEFAULT 5,
  color_hex TEXT DEFAULT '#0891B2',
  icon_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id),
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  
  item_code TEXT UNIQUE,
  serial_number TEXT,
  model_number TEXT,
  brand TEXT,
  
  image_url TEXT,
  storage_location TEXT,
  
  specifications JSONB,
  power_rating TEXT,
  voltage TEXT,
  
  purchase_date DATE,
  warranty_until DATE,
  expiry_date DATE,
  
  supplier_name TEXT,
  purchase_price DECIMAL(12,2),
  invoice_reference TEXT,
  
  safety_level safety_level DEFAULT 'low',
  hazard_type TEXT,
  storage_requirements TEXT,
  special_handling_notes TEXT,
  
  status item_status DEFAULT 'available',
  current_quantity INT DEFAULT 1,
  reorder_threshold INT DEFAULT 1,
  
  manual_url TEXT,
  sds_url TEXT,
  calibration_cert_url TEXT,
  other_docs JSONB,
  
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- Create stock_history table
CREATE TABLE public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  quantity_change INT NOT NULL,
  reason TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create borrow_requests table
CREATE TABLE public.borrow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  requested_start_date DATE NOT NULL,
  requested_end_date DATE NOT NULL,
  purpose TEXT,
  status request_status DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_date TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create issued_items table
CREATE TABLE public.issued_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  borrow_request_id UUID REFERENCES public.borrow_requests(id),
  issued_to UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  issued_by UUID REFERENCES public.profiles(id) NOT NULL,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  condition_at_issue TEXT DEFAULT 'Good',
  quantity_issued INT DEFAULT 1,
  status TEXT DEFAULT 'active',
  returned_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create return_logs table
CREATE TABLE public.return_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issued_item_id UUID REFERENCES public.issued_items(id) ON DELETE CASCADE NOT NULL,
  returned_by_staff UUID REFERENCES public.profiles(id) NOT NULL,
  returned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  condition_at_return TEXT,
  damage_reported BOOLEAN DEFAULT FALSE,
  damage_report_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create damage_reports table
CREATE TABLE public.damage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  reported_by UUID REFERENCES public.profiles(id) NOT NULL,
  damage_type TEXT,
  severity damage_severity DEFAULT 'minor',
  description TEXT,
  photos_urls TEXT[],
  status request_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create maintenance_records table
CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  damage_report_id UUID REFERENCES public.damage_reports(id),
  assigned_to UUID REFERENCES public.profiles(id),
  reason TEXT,
  status maintenance_status DEFAULT 'pending',
  start_date DATE,
  estimated_completion DATE,
  actual_completion DATE,
  cost DECIMAL(12,2),
  repair_notes TEXT,
  parts_used TEXT,
  repair_photos_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update damage_reports to reference maintenance
ALTER TABLE public.return_logs 
ADD CONSTRAINT fk_damage_report 
FOREIGN KEY (damage_report_id) REFERENCES public.damage_reports(id);

-- Create qr_codes table
CREATE TABLE public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL UNIQUE,
  qr_image_url TEXT,
  qr_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issued_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Create function to check if user is admin or staff
CREATE OR REPLACE FUNCTION public.is_admin_or_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'staff')
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admin and staff can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for departments
CREATE POLICY "Everyone can view active departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admin can manage departments"
  ON public.departments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_departments
CREATE POLICY "Users can view their department assignments"
  ON public.user_departments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Admin can manage department assignments"
  ON public.user_departments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for categories
CREATE POLICY "Everyone can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for items
CREATE POLICY "Everyone can view available items"
  ON public.items FOR SELECT
  TO authenticated
  USING (status != 'archived');

CREATE POLICY "Admin and staff can manage items"
  ON public.items FOR ALL
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for stock_history
CREATE POLICY "Admin and staff can view stock history"
  ON public.stock_history FOR SELECT
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Admin and staff can add stock history"
  ON public.stock_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for borrow_requests
CREATE POLICY "Users can view their own requests"
  ON public.borrow_requests FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Admin and staff can view all requests"
  ON public.borrow_requests FOR SELECT
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Students can create requests"
  ON public.borrow_requests FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admin and staff can update requests"
  ON public.borrow_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for issued_items
CREATE POLICY "Users can view their issued items"
  ON public.issued_items FOR SELECT
  TO authenticated
  USING (issued_to = auth.uid() OR public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Staff can manage issued items"
  ON public.issued_items FOR ALL
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for return_logs
CREATE POLICY "Staff can manage return logs"
  ON public.return_logs FOR ALL
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for damage_reports
CREATE POLICY "Users can view their damage reports"
  ON public.damage_reports FOR SELECT
  TO authenticated
  USING (reported_by = auth.uid() OR public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Users can create damage reports"
  ON public.damage_reports FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY "Staff can update damage reports"
  ON public.damage_reports FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for maintenance_records
CREATE POLICY "Technicians can view assigned maintenance"
  ON public.maintenance_records FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid() OR public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Staff can manage maintenance records"
  ON public.maintenance_records FOR ALL
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Technicians can update their assignments"
  ON public.maintenance_records FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid() AND public.has_role(auth.uid(), 'technician'));

-- RLS Policies for qr_codes
CREATE POLICY "Everyone can view QR codes"
  ON public.qr_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage QR codes"
  ON public.qr_codes FOR ALL
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for notifications
CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for audit_logs
CREATE POLICY "Admin can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can create audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, phone, address, college_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'college_name'
  );
  
  -- Insert default role (student)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  -- If department is provided, link user to department
  IF NEW.raw_user_meta_data->>'department_id' IS NOT NULL THEN
    INSERT INTO public.user_departments (user_id, department_id)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'department_id')::UUID);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add update triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_borrow_requests_updated_at
  BEFORE UPDATE ON public.borrow_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_maintenance_records_updated_at
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert default departments
INSERT INTO public.departments (name, is_active) VALUES
  ('CSE', true),
  ('EEE', true),
  ('Plastic', true),
  ('Polymer', true),
  ('Civil', true),
  ('Mechanical', true),
  ('Web Design', true);

-- Insert default categories
INSERT INTO public.categories (name, description, color_hex) VALUES
  ('Electronics', 'Electronic components and equipment', '#0891B2'),
  ('Tools', 'Hand tools and power tools', '#10B981'),
  ('Chemicals', 'Laboratory chemicals and reagents', '#DC2626'),
  ('Equipment', 'Laboratory equipment and machinery', '#1E3A8A'),
  ('Components', 'Electronic and mechanical components', '#F59E0B'),
  ('Safety', 'Safety equipment and PPE', '#7C3AED');
