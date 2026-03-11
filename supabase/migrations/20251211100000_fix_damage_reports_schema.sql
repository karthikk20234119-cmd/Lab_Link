-- Add missing columns to damage_reports table
-- This migration adds the resolved_notes and reviewed_at columns that are expected by the frontend

-- Add resolved_notes column for storing resolution/action notes
ALTER TABLE public.damage_reports
ADD COLUMN IF NOT EXISTS resolved_notes TEXT NULL;

-- Rename reviewed_date to reviewed_at for consistency with frontend code
-- First check if reviewed_at exists, if not, check if reviewed_date exists
DO $$
BEGIN
    -- Check if reviewed_at already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'damage_reports' 
        AND column_name = 'reviewed_at'
    ) THEN
        -- Check if reviewed_date exists and rename it
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'damage_reports' 
            AND column_name = 'reviewed_date'
        ) THEN
            ALTER TABLE public.damage_reports
            RENAME COLUMN reviewed_date TO reviewed_at;
        ELSE
            -- If neither exists, add reviewed_at
            ALTER TABLE public.damage_reports
            ADD COLUMN reviewed_at TIMESTAMPTZ NULL;
        END IF;
    END IF;
END $$;

-- Create a new enum type for damage report status if using request_status
-- The frontend expects: pending, reviewing, resolved, rejected, maintenance_scheduled
-- First drop the constraint if it's using the request_status enum

-- Check if status column is using request_status enum and alter it
DO $$
BEGIN
    -- Check if damage_report_status type exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'damage_report_status'
    ) THEN
        -- Create the new enum type
        CREATE TYPE public.damage_report_status AS ENUM (
            'pending',
            'reviewing', 
            'resolved',
            'rejected',
            'maintenance_scheduled'
        );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Type already exists, ignore
END $$;

-- Alter the status column to use TEXT type for more flexibility
-- since we need different status values than the original request_status enum
ALTER TABLE public.damage_reports
ALTER COLUMN status TYPE TEXT USING status::TEXT;

-- Set default value
ALTER TABLE public.damage_reports
ALTER COLUMN status SET DEFAULT 'pending';

-- Add comment for documentation
COMMENT ON COLUMN public.damage_reports.resolved_notes IS 'Notes about how the damage was resolved or maintenance was scheduled';
COMMENT ON COLUMN public.damage_reports.reviewed_at IS 'Timestamp when the damage report was reviewed by staff';

-- Add index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_damage_reports_status ON public.damage_reports(status);

-- Add updated_at column if it doesn't exist
ALTER TABLE public.damage_reports
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_damage_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_damage_reports_updated_at ON public.damage_reports;
CREATE TRIGGER update_damage_reports_updated_at
  BEFORE UPDATE ON public.damage_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_damage_reports_updated_at();
