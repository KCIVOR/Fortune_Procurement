-- Rev #3 follow-up: system_expiry_settings is dead config.
-- Manual per-record expiry (supplier_accreditations.valid_until /
-- supplier_products.valid_until) replaced the global auto-calculated expiry;
-- no approval/verification flow or the nightly expiry cron job reads this
-- table anymore (confirmed by codebase audit). Dropping it removes its RLS
-- policies automatically. valid_until columns, status constraints, and the
-- cron job are untouched.

DROP TABLE IF EXISTS public.system_expiry_settings;
