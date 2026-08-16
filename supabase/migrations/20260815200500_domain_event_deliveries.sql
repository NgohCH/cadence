-- Cadence v0.1
-- VS001-05
-- Per-consumer delivery tracking for asynchronous domain events.
--
-- public.domain_events remains the transactional outbox.
-- This table records independent processing state for each consumer so
-- one consumer may succeed, fail, or retry without affecting another.

create table public.domain_event_deliveries (
  event_id uuid not null
    references public.domain_events(id)
    on delete cascade,

  consumer_name text not null
    check (length(btrim(consumer_name)) > 0),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'processing',
        'processed',
        'failed'
      )
    ),

  processing_attempts integer not null default 0
    check (processing_attempts >= 0),

  available_at timestamptz not null default now(),

  claimed_at timestamptz,
  claim_token uuid,

  lease_expires_at timestamptz,

  processed_at timestamptz,

  last_error text,

  created_at timestamptz not null default now(),

  primary key (
    event_id,
    consumer_name
  )
);

create index domain_event_deliveries_pending_idx
  on public.domain_event_deliveries (
    consumer_name,
    status,
    available_at,
    created_at
  );

create index domain_event_deliveries_event_idx
  on public.domain_event_deliveries (
    event_id
  );

create index domain_event_deliveries_lease_idx
  on public.domain_event_deliveries (
    consumer_name,
    lease_expires_at
  )
  where status = 'processing'
    and lease_expires_at is not null;


-- Delivery processing is server-side infrastructure.
-- Browser-authenticated clients do not receive direct table policies.

alter table public.domain_event_deliveries
  enable row level security;