-- Phase 8: Advanced Analytics and QR Management
-- Adds tables for report templates and QR scan logging

-- ============================================
-- QR SCAN LOGS TABLE
-- Track when and where QR codes are scanned
-- ============================================
CREATE TABLE IF NOT EXISTS public.qr_scan_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scan_location VARCHAR(255),
  device_info JSONB,
  scan_result VARCHAR(50) CHECK (scan_result IN ('success', 'not_found', 'invalid', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REPORT TEMPLATES TABLE
-- Save custom report configurations
-- ============================================
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('inventory', 'usage', 'maintenance', 'department', 'custom')),
  config JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYTICS CACHE TABLE
-- Cache computed analytics for faster loading
-- ============================================
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  cache_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_item ON public.qr_scan_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_user ON public.qr_scan_logs(scanned_by);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_date ON public.qr_scan_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON public.report_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON public.analytics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON public.analytics_cache(expires_at);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.qr_scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;

-- QR Scan Logs - Staff can view all, users can view their own
CREATE POLICY "Staff can view all scan logs"
  ON public.qr_scan_logs FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Users can view own scan logs"
  ON public.qr_scan_logs FOR SELECT
  USING (scanned_by = auth.uid());

CREATE POLICY "Authenticated users can create scan logs"
  ON public.qr_scan_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Report Templates - Public ones are visible to all, private to owner
CREATE POLICY "View public or own report templates"
  ON public.report_templates FOR SELECT
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create report templates"
  ON public.report_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own report templates"
  ON public.report_templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own report templates"
  ON public.report_templates FOR DELETE
  USING (created_by = auth.uid());

-- Analytics Cache - Staff can manage
CREATE POLICY "Staff can manage analytics cache"
  ON public.analytics_cache FOR ALL
  USING (public.is_admin_or_staff(auth.uid()));

-- ============================================
-- FUNCTION: Log QR Scan
-- ============================================
CREATE OR REPLACE FUNCTION public.log_qr_scan(
  p_item_id UUID,
  p_scan_result VARCHAR DEFAULT 'success',
  p_device_info JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.qr_scan_logs (item_id, scanned_by, scan_result, device_info)
  VALUES (p_item_id, auth.uid(), p_scan_result, p_device_info)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================
-- FUNCTION: Get Item Scan Count
-- ============================================
CREATE OR REPLACE FUNCTION public.get_item_scan_count(p_item_id UUID, p_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.qr_scan_logs
  WHERE item_id = p_item_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- ============================================
-- FUNCTION: Clean Expired Cache
-- ============================================
CREATE OR REPLACE FUNCTION public.clean_expired_analytics_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.analytics_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
