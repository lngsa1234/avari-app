-- Fix call_recaps UPDATE policy to allow any participant to merge their data.
-- Previously only the creator could update, which blocked the second participant
-- from merging their transcript into the existing recap.

-- Drop existing restrictive update policy
DROP POLICY IF EXISTS "Users can update their own recaps" ON public.call_recaps;

-- Create new policy: creator OR any listed participant can update
CREATE POLICY "Participants can update recaps"
  ON public.call_recaps
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR auth.uid() = ANY(participant_ids)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR auth.uid() = ANY(participant_ids)
  );
