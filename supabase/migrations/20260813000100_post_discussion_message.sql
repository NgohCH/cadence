-- Cadence v0.1
-- VS001-04
-- Atomic creation of a discussion message, its initial immutable version,
-- and the MessageCreated.v1 domain event.
--
-- This function is intended for the Cadence API service only.
-- RBAC is checked again inside the transaction as defence in depth.

create or replace function public.post_discussion_message(
  p_project_id uuid,
  p_author_user_id uuid,
  p_content text,
  p_thread_parent_id uuid,
  p_correlation_id uuid,
  p_causation_id uuid default null
)
returns table (
  id uuid,
  project_id uuid,
  author_user_id uuid,
  author_type text,
  thread_parent_id uuid,
  current_version integer,
  content text,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_message_id uuid;
  v_created_at timestamptz;
begin
  /*
   * Validate content at the database boundary as well as the API boundary.
   */
  if p_content is null
     or length(btrim(p_content)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'DISCUSSION_CONTENT_REQUIRED';
  end if;

  if length(p_content) > 20000 then
    raise exception using
      errcode = '22023',
      message = 'DISCUSSION_CONTENT_TOO_LONG';
  end if;

  /*
   * Confirm that the supplied author is still an active project member
   * and still holds message.create at the moment of persistence.
   *
   * The API performs this check too. Repeating it here prevents a race
   * where access is revoked between the service check and the insert.
   */
  if not public.has_project_permission(
    p_project_id,
    'message.create',
    p_author_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'DISCUSSION_PERMISSION_DENIED';
  end if;

  /*
   * A reply may only point to a current message in the same project.
   */
  if p_thread_parent_id is not null
     and not exists (
       select 1
       from public.messages m
       where m.id = p_thread_parent_id
         and m.project_id = p_project_id
         and m.deleted_at is null
     ) then
    raise exception using
      errcode = '23503',
      message = 'DISCUSSION_PARENT_MESSAGE_NOT_FOUND';
  end if;

  /*
   * Create the message envelope.
   */
  insert into public.messages (
    project_id,
    author_user_id,
    author_type,
    thread_parent_id,
    current_version
  )
  values (
    p_project_id,
    p_author_user_id,
    'human',
    p_thread_parent_id,
    1
  )
  returning
    messages.id,
    messages.created_at
  into
    v_message_id,
    v_created_at;

  /*
   * Create immutable version 1.
   */
  insert into public.message_versions (
    message_id,
    version_number,
    content,
    editor_user_id,
    editor_type,
    change_reason
  )
  values (
    v_message_id,
    1,
    p_content,
    p_author_user_id,
    'human',
    null
  );

  /*
   * Write the transactional outbox event.
   *
   * MessageCreated.v1 is represented by:
   *   event_type    = MessageCreated
   *   event_version = 1
   */
  insert into public.domain_events (
    event_type,
    event_version,
    aggregate_type,
    aggregate_id,
    project_id,
    actor_type,
    actor_id,
    payload,
    correlation_id,
    causation_id
  )
  values (
    'MessageCreated',
    1,
    'message',
    v_message_id,
    p_project_id,
    'human',
    p_author_user_id,
    jsonb_build_object(
      'message_id', v_message_id,
      'project_id', p_project_id,
      'author_user_id', p_author_user_id,
      'thread_parent_id', p_thread_parent_id,
      'version_number', 1
    ),
    p_correlation_id,
    p_causation_id
  );

  /*
   * Return the API/domain representation of the newly-created message.
   */
  return query
  select
    m.id,
    m.project_id,
    m.author_user_id,
    m.author_type,
    m.thread_parent_id,
    m.current_version,
    mv.content,
    m.created_at,
    m.edited_at
  from public.messages m
  join public.message_versions mv
    on mv.message_id = m.id
   and mv.version_number = m.current_version
  where m.id = v_message_id;
end;
$$;

revoke all on function public.post_discussion_message(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  uuid
) from public;

revoke all on function public.post_discussion_message(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  uuid
) from anon;

revoke all on function public.post_discussion_message(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  uuid
) from authenticated;

grant execute on function public.post_discussion_message(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  uuid
) to service_role;
