-- Add reminder_time column to subscriptions (default 09:00)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS reminder_time text DEFAULT '09:00';
