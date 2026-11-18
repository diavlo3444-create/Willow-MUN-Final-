CREATE OR REPLACE FUNCTION public.wm_head_application_type_scope()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $body$
 SELECT CASE
  WHEN position('press' in lower(coalesce(p.title,'')||' '||coalesce(p.division,'')))>0 THEN 'press'
  WHEN position('media' in lower(coalesce(p.title,'')||' '||coalesce(p.division,'')))>0 THEN 'media'
  ELSE NULL END
 FROM public.wm_profiles p WHERE p.user_id=auth.uid() AND p.is_active=true AND p.role='department_head' LIMIT 1;
$body$;

CREATE OR REPLACE FUNCTION public.wm_applications_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $body$
DECLARE actor public.wm_profiles; requested_status text; actor_department_slug text; actor_application_type text;
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.department_id:=public.wm_map_application_department(NEW.application_type,NEW.department_id);
  IF NEW.gender IS NOT NULL THEN NEW.gender:=lower(trim(NEW.gender)); END IF;
  RETURN NEW;
 END IF;
 IF auth.uid() IS NOT NULL THEN
  SELECT * INTO actor FROM public.wm_profiles WHERE user_id=auth.uid() LIMIT 1;
  IF actor.role='department_head' THEN
   requested_status:=NEW.status;
   IF requested_status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'Department Heads can only accept or decline applications.'; END IF;
   SELECT d.slug INTO actor_department_slug FROM public.wm_departments d WHERE d.id=actor.department_id;
   IF actor_department_slug IS NULL OR lower(actor_department_slug)<>lower(public.wm_map_application_department(OLD.application_type,OLD.department_id)) THEN RAISE EXCEPTION 'Cross-department application update is forbidden.'; END IF;
   actor_application_type:=public.wm_head_application_type_scope();
   IF lower(actor_department_slug)='media-press' AND (actor_application_type IS NULL OR lower(OLD.application_type)<>actor_application_type) THEN RAISE EXCEPTION 'Media and Press applications are isolated.'; END IF;
   IF public.wm_head_gender() IS NULL OR lower(coalesce(OLD.gender,''))<>public.wm_head_gender() THEN RAISE EXCEPTION 'Cross-gender application update is forbidden.'; END IF;
   NEW:=OLD; NEW.status:=requested_status; NEW.decision_by:=auth.uid(); NEW.decision_by_name:=actor.full_name; NEW.decision_at:=now();
  ELSIF actor.role IN ('admin','super_admin') AND NEW.status IS DISTINCT FROM OLD.status THEN
   NEW.decision_by:=auth.uid(); NEW.decision_by_name:=actor.full_name; NEW.decision_at:=now();
  END IF;
 END IF;
 RETURN NEW;
END;
$body$;

DROP POLICY IF EXISTS "Department heads strict dept and gender select" ON public.wm_applications;
CREATE POLICY "Department heads strict dept and gender select" ON public.wm_applications FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.wm_profiles p JOIN public.wm_departments d ON d.id=p.department_id
 WHERE p.user_id=auth.uid() AND p.is_active=true AND p.role='department_head'
 AND lower(d.slug)=lower(public.wm_map_application_department(wm_applications.application_type,wm_applications.department_id))
 AND (lower(d.slug)<>'media-press' OR lower(wm_applications.application_type)=public.wm_head_application_type_scope())
 AND public.wm_head_gender() IS NOT NULL AND lower(coalesce(wm_applications.gender,''))=public.wm_head_gender()));

DROP POLICY IF EXISTS "Department heads strict dept and gender update" ON public.wm_applications;
CREATE POLICY "Department heads strict dept and gender update" ON public.wm_applications FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.wm_profiles p JOIN public.wm_departments d ON d.id=p.department_id
 WHERE p.user_id=auth.uid() AND p.is_active=true AND p.role='department_head'
 AND lower(d.slug)=lower(public.wm_map_application_department(wm_applications.application_type,wm_applications.department_id))
 AND (lower(d.slug)<>'media-press' OR lower(wm_applications.application_type)=public.wm_head_application_type_scope())
 AND public.wm_head_gender() IS NOT NULL AND lower(coalesce(wm_applications.gender,''))=public.wm_head_gender()))
WITH CHECK (status IN ('accepted','rejected'));
