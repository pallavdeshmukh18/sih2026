-- Enforce overlaps at the database boundary, including concurrent walk-ins.
-- Existing overlapping appointments must be reviewed before applying this migration.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_active_overlap
EXCLUDE USING gist (
    doctor_id WITH =,
    tsrange(
        scheduled_at AT TIME ZONE 'UTC',
        (scheduled_at AT TIME ZONE 'UTC') + duration_minutes * INTERVAL '1 minute',
        '[)'
    ) WITH &&
) WHERE (status IN ('scheduled', 'confirmed'));
