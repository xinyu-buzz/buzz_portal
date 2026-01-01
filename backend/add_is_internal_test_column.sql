-- Migration: Add is_internal_test column to bookings table
-- This column tracks whether a booking is for internal testing purposes

ALTER TABLE public.bookings 
ADD COLUMN is_internal_test boolean DEFAULT false NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.bookings.is_internal_test IS 'Indicates if this booking is for internal testing purposes (true) or a real customer booking (false)';

