-- Delegate QR check-out, repeat-departure confirmation, and Super Admin attendance reset.

alter table public.wm_qr_passes
  add column if not exists checked_out_at timestamptz,
  add column if not exists checked_out_gate text,
  add column if not exists checked_out_by uuid,
  add column if not exists checked_out_by_name text;

create table if not exists public.wm_qr_attendance_resets (
  id uuid primary key default gen_random_uuid(),
  reset_by uuid,
  reset_by_name text not null,
  reset_by_role text not null,
  passes_reset integer not null default 0,
  checkins_cleared integer not null default 0,
  checkouts_cleared integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.wm_qr_attendance_resets enable row level security;
revoke all on public.wm_qr_attendance_resets from public, anon, authenticated;
grant select, insert on public.wm_qr_attendance_resets to service_role;

CREATE OR REPLACE FUNCTION public.wm_atomic_qr_checkout(p_token text, p_gate_location text, p_scanner_id uuid, p_scanner_name text, p_scanner_role text, p_commit boolean DEFAULT false, p_confirm_repeat boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_token text := trim(coalesce(p_token, ''));
  v_gate text := coalesce(nullif(trim(coalesce(p_gate_location, '')), ''), 'Main Entrance');
  v_now timestamptz := now();
  v_pass public.wm_qr_passes;
  v_app public.wm_applications;
  v_profile public.wm_profiles;
  v_dept_name text;
  v_committee_name text;
  v_eligible boolean := true;
  v_reason text;
  v_checkout_count integer := 0;
  v_updated public.wm_qr_passes;
  v_status text;
  v_result text;
  v_message text;
begin
  if v_token = '' then
    return jsonb_build_object('status','invalid','result','invalid_token','message','Empty QR token provided.','gate_location',v_gate);
  end if;

  select * into v_pass
  from public.wm_qr_passes
  where token_value = v_token
     or upper(token_value) = upper(v_token)
     or token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
  limit 1 for update;

  if not found then
    insert into public.wm_qr_scans(pass_id,token_fingerprint,holder_name,result,gate_location,scanned_by,scanned_by_name,scanner_role,scanned_at,token_value_masked,detail_message)
    values(null,encode(extensions.digest(lower(v_token),'sha256'),'hex'),null,'invalid_token',v_gate,p_scanner_id,p_scanner_name,p_scanner_role,v_now,public.wm_mask_qr_token(v_token),'No conference pass matches this QR token.');
    return jsonb_build_object('status','invalid','result','invalid_token','message','QR code does not match any issued Willow MUN pass.','gate_location',v_gate,'scanned_at',v_now);
  end if;

  if v_pass.department_id is not null then
    select name into v_dept_name from public.wm_departments where id::text=v_pass.department_id::text limit 1;
  end if;

  if v_pass.application_id is not null then
    select * into v_app from public.wm_applications where id::text=v_pass.application_id limit 1;
    if not found then
      v_eligible := false; v_reason := 'Linked application record was not found.';
    elsif lower(coalesce(v_app.status,'')) <> 'accepted' then
      v_eligible := false; v_reason := 'Applicant is not accepted.';
    end if;
    if v_app.id is not null and lower(coalesce(v_app.application_type,''))='delegate' then
      v_committee_name := nullif(trim(coalesce(v_app.position,'')),'');
      if v_committee_name is null and jsonb_typeof(v_app.answers)='array' then
        select nullif(trim(elem->>'answer'),'') into v_committee_name
        from jsonb_array_elements(v_app.answers) elem
        where lower(coalesce(elem->>'label','')) like '%committee%' limit 1;
      end if;
    end if;
  end if;

  if v_eligible and v_pass.user_id is not null then
    select * into v_profile from public.wm_profiles where user_id=v_pass.user_id limit 1;
    if not found or v_profile.is_active is distinct from true then
      v_eligible := false; v_reason := 'Staff account is inactive or no longer provisioned.';
    end if;
  end if;

  select count(*)::integer into v_checkout_count
  from public.wm_qr_scans
  where pass_id=v_pass.id and result='valid_checkout';

  if v_pass.active is distinct from true then
    return jsonb_build_object('status','revoked','result','revoked_pass','message',coalesce(nullif(v_pass.revoke_reason,''),'This pass has been revoked.'),'pass_id',v_pass.id,'holder_name',v_pass.holder_name,'gate_location',v_gate,'scanned_at',v_now);
  end if;
  if not v_eligible then
    return jsonb_build_object('status','not_eligible','result','not_eligible','message',coalesce(v_reason,'Holder is not eligible.'),'pass_id',v_pass.id,'holder_name',v_pass.holder_name,'gate_location',v_gate,'scanned_at',v_now);
  end if;
  if v_pass.checked_in_at is null then
    return jsonb_build_object('status','not_checked_in','result','not_checked_in','message','This delegate is not currently checked in, so they cannot be checked out.','pass_id',v_pass.id,'holder_name',v_pass.holder_name,'gate_location',v_gate,'scanned_at',v_now);
  end if;

  if v_checkout_count >= 1 and not p_confirm_repeat then
    return jsonb_build_object(
      'status','checkout_warning',
      'result','checkout_repeat_warning',
      'message',v_pass.holder_name || ' was checked out before. Are you sure you want to check them out again?',
      'pass_id',v_pass.id,'holder_name',v_pass.holder_name,'role_label',v_pass.role_label,'category',v_pass.category,
      'department_id',v_pass.department_id,'department_name',v_dept_name,'committee_name',v_committee_name,
      'application_id',v_pass.application_id,'application_code',v_app.application_code,'application_status',v_app.status,
      'user_id',v_pass.user_id,'pass_active',v_pass.active,'checked_in_at',v_pass.checked_in_at,
      'checked_in_gate',v_pass.checked_in_gate,'checked_out_at',v_pass.checked_out_at,
      'checked_out_gate',v_pass.checked_out_gate,'prior_checkout_count',v_checkout_count,
      'gate_location',v_gate,'scanned_at',v_now,'committed',false
    );
  end if;

  if not p_commit then
    return jsonb_build_object(
      'status','valid','result','valid_checkout_preview','message','Pass verified. Confirm check-out.',
      'pass_id',v_pass.id,'holder_name',v_pass.holder_name,'role_label',v_pass.role_label,'category',v_pass.category,
      'department_id',v_pass.department_id,'department_name',v_dept_name,'committee_name',v_committee_name,
      'application_id',v_pass.application_id,'application_code',v_app.application_code,'application_status',v_app.status,
      'user_id',v_pass.user_id,'pass_active',v_pass.active,'checked_in_at',v_pass.checked_in_at,
      'checked_in_gate',v_pass.checked_in_gate,'checked_out_at',v_pass.checked_out_at,
      'checked_out_gate',v_pass.checked_out_gate,'prior_checkout_count',v_checkout_count,
      'gate_location',v_gate,'scanned_at',v_now,'committed',false
    );
  end if;

  update public.wm_qr_passes
  set checked_in_at=null, checked_in_gate=null, checked_in_by=null, checked_in_by_name=null,
      checked_out_at=v_now, checked_out_gate=v_gate, checked_out_by=p_scanner_id, checked_out_by_name=p_scanner_name
  where id=v_pass.id and active=true and checked_in_at is not null
  returning * into v_updated;

  if not found then
    return jsonb_build_object('status','not_checked_in','result','not_checked_in','message','Attendance status changed at another terminal. Scan again.','pass_id',v_pass.id,'holder_name',v_pass.holder_name,'gate_location',v_gate,'scanned_at',v_now);
  end if;

  insert into public.wm_qr_scans(pass_id,token_fingerprint,holder_name,result,gate_location,scanned_by,scanned_by_name,scanner_role,scanned_at,token_value_masked,application_id,application_code,department_name,committee_name,previous_checked_in_at,previous_checked_in_gate,detail_message)
  values(v_pass.id,encode(extensions.digest(lower(trim(v_pass.token_value)),'sha256'),'hex'),v_pass.holder_name,'valid_checkout',v_gate,p_scanner_id,p_scanner_name,p_scanner_role,v_now,public.wm_mask_qr_token(v_pass.token_value),v_pass.application_id,v_app.application_code,v_dept_name,v_committee_name,v_pass.checked_in_at,v_pass.checked_in_gate,'Delegate checked out.');

  return jsonb_build_object(
    'status','checked_out','result','valid_checkout','message','Check-out recorded successfully.',
    'pass_id',v_updated.id,'holder_name',v_updated.holder_name,'role_label',v_updated.role_label,'category',v_updated.category,
    'department_id',v_updated.department_id,'department_name',v_dept_name,'committee_name',v_committee_name,
    'application_id',v_updated.application_id,'application_code',v_app.application_code,'application_status',v_app.status,
    'user_id',v_updated.user_id,'pass_active',v_updated.active,'checked_in_at',null,'checked_in_gate',null,
    'checked_out_at',v_updated.checked_out_at,'checked_out_gate',v_updated.checked_out_gate,
    'prior_checkout_count',v_checkout_count,'checked_in_by_name',null,'gate_location',v_gate,'scanned_at',v_now,'committed',true
  );
end;
$function$


revoke all on function public.wm_atomic_qr_checkout(text,text,uuid,text,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.wm_atomic_qr_checkout(text,text,uuid,text,text,boolean,boolean) to service_role;

create or replace function public.wm_clear_previous_checkout_on_new_checkin()
returns trigger language plpgsql set search_path = public as $function$
begin
  if new.checked_in_at is not null and (old.checked_in_at is null or new.checked_in_at is distinct from old.checked_in_at) then
    new.checked_out_at := null;
    new.checked_out_gate := null;
    new.checked_out_by := null;
    new.checked_out_by_name := null;
  end if;
  return new;
end;
$function$;
drop trigger if exists wm_qr_clear_checkout_on_checkin on public.wm_qr_passes;
create trigger wm_qr_clear_checkout_on_checkin before update of checked_in_at on public.wm_qr_passes
for each row execute function public.wm_clear_previous_checkout_on_new_checkin();
revoke all on function public.wm_clear_previous_checkout_on_new_checkin() from public, anon, authenticated;
