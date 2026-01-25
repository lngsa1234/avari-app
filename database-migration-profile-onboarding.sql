-- Database Migration: Enhanced Profile Onboarding Fields
-- Adds new fields for the multi-step onboarding flow

-- 1. Add vibe_category to profiles (emotional intent)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_category TEXT
  CHECK (vibe_category IN ('advice', 'vent', 'grow'));
COMMENT ON COLUMN profiles.vibe_category IS 'User emotional intent: advice (mentorship), vent (support), grow (skills)';

-- 2. Add industry field
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry TEXT;
COMMENT ON COLUMN profiles.industry IS 'User industry (e.g., Fintech, AI, HealthTech, SaaS)';

-- 3. Add career_stage field
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_stage TEXT
  CHECK (career_stage IN ('emerging', 'scaling', 'leading', 'legacy'));
COMMENT ON COLUMN profiles.career_stage IS 'Career stage: emerging (early), scaling (mid), leading (manager), legacy (executive)';

-- 4. Add open_to_hosting field
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS open_to_hosting BOOLEAN DEFAULT false;
COMMENT ON COLUMN profiles.open_to_hosting IS 'Whether user is willing to host meetups';

-- 5. Add hook field ("Ask me about")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hook TEXT;
COMMENT ON COLUMN profiles.hook IS 'The Hook - what others can ask the user about';

-- 5b. Add country field
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;
COMMENT ON COLUMN profiles.country IS 'User country for location-based filtering';

-- 6. Add profile_completion_percentage for nudges
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completion INTEGER DEFAULT 0;
COMMENT ON COLUMN profiles.profile_completion IS 'Profile completion percentage (0-100)';

-- 7. Add onboarding_completed flag
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether user has completed the onboarding flow';

-- 8. Create indexes for filtering/matching
CREATE INDEX IF NOT EXISTS idx_profiles_vibe ON profiles(vibe_category);
CREATE INDEX IF NOT EXISTS idx_profiles_industry ON profiles(industry);
CREATE INDEX IF NOT EXISTS idx_profiles_stage ON profiles(career_stage);
CREATE INDEX IF NOT EXISTS idx_profiles_hosting ON profiles(open_to_hosting) WHERE open_to_hosting = true;

-- 9. Create function to calculate profile completion
CREATE OR REPLACE FUNCTION calculate_profile_completion(profile_row profiles)
RETURNS INTEGER AS $$
DECLARE
  completion INTEGER := 0;
  total_fields INTEGER := 10;
  filled_fields INTEGER := 0;
BEGIN
  -- Required fields (worth more)
  IF profile_row.name IS NOT NULL AND profile_row.name != '' THEN filled_fields := filled_fields + 1; END IF;
  IF profile_row.career IS NOT NULL AND profile_row.career != '' THEN filled_fields := filled_fields + 1; END IF;
  IF profile_row.vibe_category IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF profile_row.career_stage IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;

  -- Optional but valuable fields
  IF profile_row.industry IS NOT NULL AND profile_row.industry != '' THEN filled_fields := filled_fields + 1; END IF;
  IF profile_row.city IS NOT NULL AND profile_row.city != '' THEN filled_fields := filled_fields + 1; END IF;
  IF profile_row.state IS NOT NULL AND profile_row.state != '' THEN filled_fields := filled_fields + 1; END IF;
  IF profile_row.hook IS NOT NULL AND profile_row.hook != '' THEN filled_fields := filled_fields + 1; END IF;
  IF profile_row.bio IS NOT NULL AND profile_row.bio != '' THEN filled_fields := filled_fields + 1; END IF;
  IF profile_row.profile_picture IS NOT NULL AND profile_row.profile_picture != '' THEN filled_fields := filled_fields + 1; END IF;

  completion := (filled_fields * 100) / total_fields;
  RETURN completion;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 10. Create trigger to auto-update profile_completion
CREATE OR REPLACE FUNCTION update_profile_completion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_completion := calculate_profile_completion(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profile_completion ON profiles;
CREATE TRIGGER trigger_update_profile_completion
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_completion();

-- 11. Update existing profiles to calculate their completion
UPDATE profiles SET profile_completion = calculate_profile_completion(profiles.*);
