# Supabase schema

## Source of truth

The **live database** (Supabase project `szzhsmodfbnrtcpxgwan`) is authoritative.
Its schema was built up incrementally over time and is **not** fully reproducible
from the SQL files that used to sit in this folder — those were ad-hoc, mutually
contradictory one-off scripts (see `archive/`).

For the current table/column shapes, use:

- **`app/lib/database.types.ts`** — TypeScript row/insert/update types generated
  from the live schema. Regenerate after any schema change:

  ```sh
  supabase gen types typescript --project-id szzhsmodfbnrtcpxgwan > app/lib/database.types.ts
  ```

- A full DDL dump, when needed:

  ```sh
  supabase db dump --project-id szzhsmodfbnrtcpxgwan -f supabase/schema.snapshot.sql
  ```

## Making schema changes

Add a **new** timestamped file under `migrations/` and apply it (Supabase MCP
`apply_migration`, the dashboard SQL editor, or `supabase db push`). Never edit an
already-applied migration. Keep migrations forward-only and idempotent where
practical (`CREATE OR REPLACE`, `IF EXISTS`).

### Migrations applied 2026-07-06 (hardening)

| File | What |
|------|------|
| `20260706000000_atomic_order_pricing_and_limits.sql` | delivery fee + subtotal in `create_order_with_items`; `enforce_notice_limits` |
| `20260706000001_secure_order_edit_rpc.sql` | server-authoritative `update_order_with_token` (new overload) |
| `20260706000002_replace_notice_targeting.sql` | atomic notice product/limit replacement |
| `20260706000003_drop_legacy_order_rpcs.sql` | drop old update RPC + token-leaking lookup RPCs |
| `20260706000004_lock_down_rpc_grants.sql` | order/notice RPCs → `service_role` only |
| `20260706000005_revoke_anon_definer_functions.sql` | dashboard-stats / order-number RPCs → `service_role` only |

> Note: the three pre-existing migrations (`20240125…`, `20260126…`) predate a lot
> of ad-hoc dashboard edits, so `migrations/` alone will not rebuild the DB
> byte-for-byte. Treat the live DB + generated types as the reference.

## `archive/`

Historical, superseded SQL kept only for reference. **Do not apply these** — they
contain conflicting definitions (e.g. `phone_number/tower_dong` vs `phone/tower`)
and overly permissive RLS policies that later work replaced.
