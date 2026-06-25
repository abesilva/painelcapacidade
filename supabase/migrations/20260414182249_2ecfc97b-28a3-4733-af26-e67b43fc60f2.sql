
CREATE TABLE public.month_plan_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_date date NOT NULL,
  line_id text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_asepsia boolean NOT NULL DEFAULT false,
  machines_per_shift jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (plan_date, line_id)
);

ALTER TABLE public.month_plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read month_plan_days"
ON public.month_plan_days FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Editors can insert month_plan_days"
ON public.month_plan_days FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors can update month_plan_days"
ON public.month_plan_days FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors can delete month_plan_days"
ON public.month_plan_days FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role));
