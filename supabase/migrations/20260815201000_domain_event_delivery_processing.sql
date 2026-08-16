-- Cadence v0.1
-- VS001-05
-- Atomic claiming and completion of per-consumer domain-event deliveries.
--
-- Delivery claims use PostgreSQL row locking with SKIP LOCKED so multiple
-- workers may safely process deliveries concurrently.
--
-- A claim token prevents a stale worker from completing or failing a
-- delivery after another worker has reclaimed it.

create or replace function public.claim_domain_event_delivery(
  p_consumer_name text,
  p_lease_seconds integer default 900
)
returns table (
  event_id uuid,
  consumer_name text,
  claim_token uuid,
  event_type text,
  event_version integer,
  aggregate_type text,
  aggregate_id uuid,
  project_id uuid,
  actor_type text,
  actor_id uuid,
  payload jsonb,
  correlation_id uuid,
  causation_id uuid,
  occurred_at timestamptz,
  processing_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_consumer_name is null
     or length(btrim(p_consumer_name)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'DOMAIN_EVENT_CONSUMER_REQUIRED';
  end if;

  if p_lease_seconds is null
   or p_lease_seconds <= 0 then
    raise exception using
      errcode = '22023',
      message = 'DOMAIN_EVENT_LEASE_INVALID';
  end if;

  return query
  with candidate as (
    select
      d.event_id,
      d.consumer_name
    from public.domain_event_deliveries d
    join public.domain_events e
      on e.id = d.event_id
    where d.consumer_name = p_consumer_name
      and (
        (
          d.status in ('pending', 'failed')
          and d.available_at <= now()
        )
        or
        (
          d.status = 'processing'
          and d.lease_expires_at is not null
          and d.lease_expires_at <= now()
        )
      )
    order by
      d.available_at asc,
      e.occurred_at asc,
      d.event_id asc
    for update of d skip locked
    limit 1
  ),
  claimed as (
    update public.domain_event_deliveries d
    set
      status = 'processing',
      processing_attempts =
        d.processing_attempts + 1,
      claimed_at = now(),
      claim_token = gen_random_uuid(),
      lease_expires_at =
        now()
        + make_interval(
            secs => p_lease_seconds
          ),
      last_error = null
    from candidate c
    where d.event_id = c.event_id
      and d.consumer_name =
        c.consumer_name
    returning
      d.event_id,
      d.consumer_name,
      d.claim_token,
      d.processing_attempts
  )
  select
    c.event_id,
    c.consumer_name,
    c.claim_token,
    e.event_type,
    e.event_version,
    e.aggregate_type,
    e.aggregate_id,
    e.project_id,
    e.actor_type,
    e.actor_id,
    e.payload,
    e.correlation_id,
    e.causation_id,
    e.occurred_at,
    c.processing_attempts
  from claimed c
  join public.domain_events e
    on e.id = c.event_id;
end;
$$;


create or replace function public.complete_domain_event_delivery(
  p_event_id uuid,
  p_consumer_name text,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.domain_event_deliveries
  set
    status = 'processed',
    processed_at = now(),
    claim_token = null,
    lease_expires_at = null,
    last_error = null
  where event_id = p_event_id
    and consumer_name =
      p_consumer_name
    and status = 'processing'
    and claim_token =
      p_claim_token;

  get diagnostics
    v_updated = row_count;

  return v_updated = 1;
end;
$$;


create or replace function public.fail_domain_event_delivery(
  p_event_id uuid,
  p_consumer_name text,
  p_claim_token uuid,
  p_error text,
  p_retry_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.domain_event_deliveries
  set
    status = 'failed',
    available_at =
      coalesce(
        p_retry_at,
        now()
      ),
    processed_at = null,
    claim_token = null,
    lease_expires_at = null,
    last_error =
      coalesce(
        p_error,
        'Unknown processing error.'
      )
  where event_id = p_event_id
    and consumer_name =
      p_consumer_name
    and status = 'processing'
    and claim_token =
      p_claim_token;

  get diagnostics
    v_updated = row_count;

  return v_updated = 1;
end;
$$;


/*
 * Event-processing functions are server-side infrastructure operations.
 */

revoke all on function public.claim_domain_event_delivery(
  text,
  integer
) from public;

revoke all on function public.claim_domain_event_delivery(
  text,
  integer
) from anon;

revoke all on function public.claim_domain_event_delivery(
  text,
  integer
) from authenticated;

grant execute on function public.claim_domain_event_delivery(
  text,
  integer
) to service_role;


revoke all on function public.complete_domain_event_delivery(
  uuid,
  text,
  uuid
) from public;

revoke all on function public.complete_domain_event_delivery(
  uuid,
  text,
  uuid
) from anon;

revoke all on function public.complete_domain_event_delivery(
  uuid,
  text,
  uuid
) from authenticated;

grant execute on function public.complete_domain_event_delivery(
  uuid,
  text,
  uuid
) to service_role;


revoke all on function public.fail_domain_event_delivery(
  uuid,
  text,
  uuid,
  text,
  timestamptz
) from public;

revoke all on function public.fail_domain_event_delivery(
  uuid,
  text,
  uuid,
  text,
  timestamptz
) from anon;

revoke all on function public.fail_domain_event_delivery(
  uuid,
  text,
  uuid,
  text,
  timestamptz
) from authenticated;

grant execute on function public.fail_domain_event_delivery(
  uuid,
  text,
  uuid,
  text,
  timestamptz
) to service_role;