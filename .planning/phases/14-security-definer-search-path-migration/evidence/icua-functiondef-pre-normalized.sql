CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO <NORMALIZED>
AS $function$
  SELECT COALESCE(
    (SELECT is_admin AND mfa_verified AND guild_member
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$
;
