-- Make the Super Admin attendance reset a single atomic database transaction.
create or replace function public.wm_reset_all_qr_attendance(
  p_reset_by uuid,
  p_reset_by_name text,
  p_reset_by_role text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_passes integer := 0;
  v_checkins integer := 0;
  v_checkouts integer := 0;
begin
  select count(*) filter (where result='valid_checkin')::integer,
         count(*) filter (where result='valid_checkout')::integer
    into v_checkins, v_checkouts
  from public.wm_qr_scans
  where result in ('valid_checkin','valid_checkout');

  update public.wm_qr_passes
  set checked_in_at=null, checked_in_gate=null, checked_in_by=null, checked_in_by_name=null,
      checked_out_at=null, checked_out_gate=null, checked_out_by=null, checked_out_by_name=null;
  get diagnostics v_passes = row_count;

  delete from public.wm_qr_scans where result in ('valid_checkin','valid_checkout');

  insert into public.wm_qr_attendance_resets(
    reset_by, reset_by_name, reset_by_role, passes_reset, checkins_cleared, checkouts_cleared
  ) values (
    p_reset_by, coalesce(nullif(trim(p_reset_by_name),''),'Super Admin'),
    coalesce(nullif(trim(p_reset_by_role),''),'super_admin'), v_passes, v_checkins, v_checkouts
  );

  return jsonb_build_object('success',true,'passes_reset',v_passes,'checkins_cleared',v_checkins,'checkouts_cleared',v_checkouts);
end;
$function$;
revoke all on function public.wm_reset_all_qr_attendance(uuid,text,text) from public, anon, authenticated;
grant execute on function public.wm_reset_all_qr_attendance(uuid,text,text) to service_role;
