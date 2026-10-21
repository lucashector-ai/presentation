-- Funções transacionais chamadas pelo servidor (service role).
-- Garantem que salvar cenas (com reordenação) e publicar sejam atômicos e respeitem a revisão (optimistic concurrency).

create or replace function public.save_project_scenes(p_project_id uuid, p_base_revision int, p_scenes jsonb, p_schema_version int default 1)
returns table (revision int, saved_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_current int;
  v_scene jsonb;
  v_idx int := 0;
begin
  select current_revision into v_current from public.projects where id = p_project_id and deleted_at is null for update;
  if v_current is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_current <> p_base_revision then raise exception 'REVISION_CONFLICT:%', v_current using errcode = 'P0001'; end if;

  delete from public.project_scenes where project_id = p_project_id;
  for v_scene in select * from jsonb_array_elements(p_scenes) loop
    insert into public.project_scenes (project_id, scene_key, order_index, title, width, height, background, content_json, schema_version)
    values (
      p_project_id,
      v_scene->>'id',
      v_idx,
      coalesce(v_scene->>'title', ''),
      (v_scene->'size'->>'width')::int,
      (v_scene->'size'->>'height')::int,
      coalesce(v_scene->>'background', '#101820'),
      v_scene,
      p_schema_version
    );
    v_idx := v_idx + 1;
  end loop;

  update public.projects set current_revision = v_current + 1, updated_at = now() where id = p_project_id;
  return query select v_current + 1, now();
end $$;

create or replace function public.publish_project(p_project_id uuid, p_base_revision int, p_user_id uuid, p_document jsonb, p_schema_version int default 1)
returns table (published_revision int, published_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_current int;
begin
  select current_revision into v_current from public.projects where id = p_project_id and deleted_at is null for update;
  if v_current is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_current <> p_base_revision then raise exception 'REVISION_CONFLICT:%', v_current using errcode = 'P0001'; end if;

  insert into public.project_snapshots (project_id, revision, content_json, schema_version, created_by)
  values (p_project_id, v_current, p_document, p_schema_version, p_user_id)
  on conflict (project_id, revision) do update set content_json = excluded.content_json, created_at = now(), created_by = excluded.created_by;

  update public.projects set published_revision = v_current, status = 'published', updated_at = now() where id = p_project_id;
  return query select v_current, now();
end $$;

-- Incremento de visualizações sem corrida.
create or replace function public.increment_share_views(p_link_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.share_links set view_count = view_count + 1 where id = p_link_id;
$$;
