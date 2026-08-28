-- Cadence R02E
-- Discussion authorization reconciliation.
--
-- Project permission decisions belong exclusively to the canonical
-- application ProjectAuthorisationService.
--
-- public.post_discussion_message remains a trusted service-role
-- transactional persistence function. p_author_user_id is attribution
-- identity, not project authorization evidence.

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
   * Validate content independently at the persistence boundary.
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
   * A reply may only reference a current message in the same project.
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
   * Write MessageCreated.v1 transactionally with the message.
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


-- Internal API persistence function only.
revoke all on function public.post_discussion_message(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  uuid
)
from public;

revoke all on function public.post_discussion_message(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  uuid
)
from anon, authenticated;

grant execute on function public.post_discussion_message(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  uuid
)
to service_role;


comment on function public.post_discussion_message(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  uuid
) is
  'Server-only Discussion persistence RPC. Project authorization is enforced by DiscussionService through ProjectAuthorisationService; User ID is attribution identity.';
