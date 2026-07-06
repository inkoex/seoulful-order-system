# Archived SQL (do not apply)

These are historical, one-off scripts from earlier development. They are kept for
reference only and are **superseded** by the live schema and `../migrations/`.

They are mutually inconsistent (different column names across files, e.g.
`phone_number/tower_dong/flat_ho` vs `phone/tower/flat_number`) and some grant
overly permissive RLS (`TO anon ... USING (true)`). Applying them would corrupt
or downgrade the current database.

See `../README.md` for the current source of truth.
