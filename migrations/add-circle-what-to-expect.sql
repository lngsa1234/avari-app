-- Add what_to_expect column to connection_groups for host-editable circle expectations
ALTER TABLE connection_groups ADD COLUMN IF NOT EXISTS what_to_expect TEXT;
