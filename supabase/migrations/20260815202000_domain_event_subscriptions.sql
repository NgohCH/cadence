-- Cadence v0.1
-- VS001-05
-- Generic domain-event subscription registry and transactional fan-out.
--
-- Producers write only to public.domain_events.
-- They do not know which modules consume an event.
--
-- When a domain event is inserted, active subscriptions are materialised
-- as independent delivery records in public.domain_event_deliveries.
--
-- public.domain_events.status describes outbox fan-out state.
-- public.domain_event_deliveries.status describes per-consumer processing.

create table public.domain_event_subscriptions (
  consumer_name text not null
    check (length(btrim(consumer_name)) > 0),

  event_type text not null
    check (length(btrim(event_type)) > 0),

  event_version integer not null
    check (event_version > 0),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  primary key (
    consumer_name,
    event_type,
    event_version
  )
);

create index domain_event_subscriptions_event_idx
  on public.domain_event_subscriptions (
    event_type,
    event_version,
    is_active
  );

alter table public.domain_event_subscriptions
  enable row level security;


/*
 * Register the first Cadence asynchronous consumer.
 *
 * The Discussion module does not reference this consumer.
 * The subscription belongs to event infrastructure configuration.
 */

/*
 * VS001-05 cutover.
 *
 * Existing outbox events predate asynchronous consumer registration.
 * They are not replayed automatically into newly-added consumers.
 *
 * Mark currently pending legacy events as having completed their
 * pre-subscription outbox lifecycle. Explicit replay, if required later,
 * must be a deliberate administrative operation.
 */

update public.domain_events
set
  status = 'processed',
  processed_at = coalesce(
    processed_at,
    now()
  ),
  last_error = null
where status = 'pending';

insert into public.domain_event_subscriptions (
  consumer_name,
  event_type,
  event_version
)
values (
  'team-agent.message-created.v1',
  'MessageCreated',
  1
);


/*
 * Materialise independent consumer deliveries whenever a new domain
 * event is committed to the transactional outbox.
 *
 * Because this is an AFTER INSERT trigger on domain_events, delivery
 * registration occurs in the same PostgreSQL transaction as the event.
 *
 * If fan-out fails, the originating transaction also fails.
 */

create or replace function public.fan_out_domain_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.domain_event_deliveries (
    event_id,
    consumer_name
  )
  select
    new.id,
    s.consumer_name
  from public.domain_event_subscriptions s
  where s.event_type = new.event_type
    and s.event_version = new.event_version
    and s.is_active = true
  on conflict (
    event_id,
    consumer_name
  )
  do nothing;

  /*
   * At this point all currently registered deliveries have been
   * materialised successfully.
   *
   * Individual consumer completion is tracked separately in
   * domain_event_deliveries.
   */
  update public.domain_events
  set
    status = 'processed',
    processed_at = now(),
    last_error = null
  where id = new.id;

  return new;
end;
$$;


create trigger domain_events_fan_out_after_insert
after insert on public.domain_events
for each row
execute function public.fan_out_domain_event();