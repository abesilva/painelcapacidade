
-- Table to persist asepsia hours per line
CREATE TABLE public.line_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id text NOT NULL UNIQUE,
  asepsia_hours numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.line_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read line_parameters"
  ON public.line_parameters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors can upsert line_parameters"
  ON public.line_parameters FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can update line_parameters"
  ON public.line_parameters FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

-- Table to persist daily discounts per line/day/shift
CREATE TABLE public.line_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  shift_id integer NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line_id, day_of_week, shift_id)
);

ALTER TABLE public.line_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read line_discounts"
  ON public.line_discounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors can upsert line_discounts"
  ON public.line_discounts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can update line_discounts"
  ON public.line_discounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

-- Table to store emails for report delivery
CREATE TABLE public.report_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.report_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read report_emails"
  ON public.report_emails FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert report_emails"
  ON public.report_emails FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete own report_emails"
  ON public.report_emails FOR DELETE TO authenticated
  USING (auth.uid() = created_by);
