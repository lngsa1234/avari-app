-- Remove mutual connection: deletes both directions of user_interests
-- Uses SECURITY DEFINER so it can delete the other user's interest record
-- (RLS only allows users to delete their own records)
CREATE OR REPLACE FUNCTION public.remove_mutual_connection(other_user_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_interests
  WHERE (user_id = auth.uid() AND interested_in_user_id = other_user_id)
     OR (user_id = other_user_id AND interested_in_user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
