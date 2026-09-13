ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
