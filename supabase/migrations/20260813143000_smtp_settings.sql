/*
  smtp_settings — single-row SMTP config for app transactional email.
  RLS deny-all for authenticated/anon. Reads/writes go through service role only
  (admin API + sendSmtpMail). Password must never be selected by the browser client.
*/

CREATE TABLE IF NOT EXISTS public.smtp_settings (
  id           boolean PRIMARY KEY DEFAULT true,
  CONSTRAINT smtp_settings_single_row CHECK (id = true),
  host         text,
  port         integer NOT NULL DEFAULT 587,
  secure       boolean NOT NULL DEFAULT false,
  username     text,
  password     text,
  from_email   text,
  from_name    text NOT NULL DEFAULT 'Fortune Procurement',
  updated_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.smtp_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.smtp_settings FROM anon, authenticated;

-- No policies on purpose: service role bypasses RLS; browser client cannot read password.
