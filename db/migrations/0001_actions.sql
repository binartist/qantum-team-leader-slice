-- Leader actions. Append-only. The connecting role may select and insert only.
-- See docs/technical-design.md section 4.

create table public.shortage_action (
  id                    uuid primary key default gen_random_uuid(),
  site_id               text not null,
  shortage_id           text not null,
  kind                  text not null check (kind in ('wait', 'escalate')),
  escalate_to           text check (escalate_to in ('purchasing', 'warehouse')),
  note                  text check (char_length(note) <= 500),
  shortfall_qty_at_time numeric check (shortfall_qty_at_time >= 0),
  created_by            text not null,
  created_at            timestamptz not null default now(),
  idempotency_key       text not null,
  check ((kind = 'escalate') = (escalate_to is not null)),
  unique (created_by, idempotency_key)
);

create table public.substitution_proposal (
  id                  uuid primary key default gen_random_uuid(),
  site_id             text not null,
  penetration_id      text not null,
  from_internal_code  text not null,
  to_internal_code    text not null,
  reason              text not null check (char_length(reason) between 1 and 500),
  status              text not null default 'proposed' check (status = 'proposed'),
  created_by          text not null,
  created_at          timestamptz not null default now(),
  idempotency_key     text not null,
  check (from_internal_code <> to_internal_code),
  unique (created_by, idempotency_key)
);

create index shortage_action_site_idx on public.shortage_action (site_id, shortage_id, created_at desc);
create index substitution_proposal_site_idx on public.substitution_proposal (site_id, created_at desc);

revoke all on table public.shortage_action from public;
revoke all on table public.substitution_proposal from public;
grant select, insert on table public.shortage_action to qantum_slice;
grant select, insert on table public.substitution_proposal to qantum_slice;
