ALTER TABLE staff_profiles
  ADD COLUMN phone text,
  ADD COLUMN date_of_birth date,
  ADD COLUMN notes text;
CREATE UNIQUE INDEX staff_profiles_phone_key ON staff_profiles(phone) WHERE phone IS NOT NULL;
