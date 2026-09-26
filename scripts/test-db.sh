#!/usr/bin/env bash
# Phase A database validation against the local Supabase Postgres.
#
# - applies migrations 007/008/009 (idempotent)
# - inserts production-like fixtures (including the Twister duplicate pair)
# - re-applies the migrations over populated data to exercise the merge +
#   historical backfill
# - asserts backfill/merge/read-model behavior, RPC validation/anti-abuse,
#   atomic create+rating, rating edits, first-photo-wins and vote aggregates
# - asserts anon direct writes/reads are locked down, including the effective
#   closure of the legacy Supabase Storage write policies from migration 002
#   (RLS default-deny; the migration also attempts the table-privilege revoke)
# - re-applies the migrations a third time and asserts full idempotence
#
# Usage: npm run test:db   (requires `supabase start` and psql)
set -euo pipefail

cd "$(dirname "$0")/.."

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if ! supabase status >/dev/null 2>&1; then
  echo "Supabase is not running. Start it with: supabase start" >&2
  exit 1
fi

run_sql() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q "$@"
}

expect_ok() {
  local label="$1" sql="$2"
  if run_sql -c "set role anon; ${sql}" >/dev/null 2>&1; then
    echo "  ok: anon may ${label}"
  else
    echo "  FAIL: anon may not ${label}" >&2
    exit 1
  fi
}

expect_denied() {
  local label="$1" sql="$2"
  if run_sql -c "set role anon; ${sql}" >/dev/null 2>&1; then
    echo "  FAIL: anon was allowed to ${label}" >&2
    exit 1
  fi
  echo "  ok: anon denied ${label}"
}

echo "==> applying Phase A migrations"
run_sql -f supabase/migrations/007_ratings_merges_and_votes.sql
run_sql -f supabase/migrations/008_rating_rpcs_and_read_models.sql
run_sql -f supabase/migrations/009_lock_down_legacy_storage_writes.sql

echo "==> inserting production-like fixtures"
run_sql -f tests/db/phase_a_fixtures.sql

echo "==> re-applying migrations over populated data (merge + backfill)"
run_sql -f supabase/migrations/007_ratings_merges_and_votes.sql
run_sql -f supabase/migrations/008_rating_rpcs_and_read_models.sql
run_sql -f supabase/migrations/009_lock_down_legacy_storage_writes.sql

echo "==> backfill / merge / nullable-legacy assertions"
run_sql -f tests/db/phase_a_assertions.sql

echo "==> RPC validation, create/rate/photo/vote assertions"
run_sql -f tests/db/phase_a_rpc_assertions.sql

echo "==> public write/read lockdown (RLS + grants)"
expect_ok "read lemonades" "select count(*) from public.lemonades;"
expect_denied "insert lemonades" "insert into public.lemonades (name, description) values ('anon','x');"
expect_denied "update lemonades" "update public.lemonades set name = name where false;"
expect_denied "delete lemonades" "delete from public.lemonades where false;"
expect_denied "read lemonade_ratings" "select count(*) from public.lemonade_ratings;"
expect_denied "insert lemonade_ratings" "insert into public.lemonade_ratings (lemonade_id, score) values ('03134887-0000-4000-8000-000000000001', 5);"
expect_denied "read matchup_votes" "select count(*) from public.matchup_votes;"
expect_denied "read listing_summaries" "select count(*) from public.listing_summaries;"
expect_denied "execute rate_lemonade" "select public.rate_lemonade('03134887-0000-4000-8000-000000000001', 5, null, null, null, null, null, 'aaaaaaaa-0000-4000-8000-000000000001');"
expect_denied "execute search_lemonades" "select public.search_lemonades('a', 1);"

if run_sql -c "set role service_role; select count(*) from public.listing_summaries;" >/dev/null 2>&1; then
  echo "  ok: service_role may read listing_summaries"
else
  echo "  FAIL: service_role cannot read listing_summaries" >&2
  exit 1
fi

echo "==> legacy storage write lockdown (009)"
run_sql -f tests/db/storage_lockdown_assertions.sql

echo "==> idempotence (third migration application)"
run_sql -f supabase/migrations/007_ratings_merges_and_votes.sql
run_sql -f supabase/migrations/008_rating_rpcs_and_read_models.sql
run_sql -f supabase/migrations/009_lock_down_legacy_storage_writes.sql
run_sql -f tests/db/phase_a_idempotence_assertions.sql
run_sql -f tests/db/storage_lockdown_assertions.sql

echo "==> Twister merge photo guard: a reversed photo layout must abort 007"
# Flip the fixture pair so the alias would hold the only photo, re-apply 007
# inside a transaction that is rolled back, and require the migration to abort
# loudly instead of merging the photo away. Everything is rolled back, so the
# harness state is unchanged.
guard_output=$(
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=0 <<'SQL' 2>&1
begin;
-- The fresh run re-created the canonical-name guard; unmerging the alias
-- would violate it, so drop it for this rolled-back probe.
drop index if exists public.lemonades_canonical_name_unique;
update public.lemonades set merged_into = null, merge_reason = null
 where id = '0c0cd8a0-0000-4000-8000-000000000002';
update public.lemonades set image_url = null
 where id = '03134887-0000-4000-8000-000000000001';
update public.lemonades
   set image_url = 'https://example.supabase.co/storage/v1/object/public/limo-images/loser.jpg'
 where id = '0c0cd8a0-0000-4000-8000-000000000002';
\i supabase/migrations/007_ratings_merges_and_votes.sql
rollback;
SQL
)
if ! grep -q 'Twister merge refused' <<<"$guard_output"; then
  echo "  FAIL: reversed Twister photo layout did not abort migration 007" >&2
  echo "$guard_output" >&2
  exit 1
fi
if [ "$(run_sql -tA -c "select count(*) from public.lemonades where id = '03134887-0000-4000-8000-000000000001' and image_url is not null and merged_into is null")" != "1" ]; then
  echo "  FAIL: guard test did not roll back the fixture changes" >&2
  exit 1
fi
echo "  ok: reversed layout aborted 007, correct merge preserved"

echo "All Phase A database checks passed."
