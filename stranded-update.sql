-- Run this in Supabase SQL Editor to add new features
-- (Safe to run even if some columns/tables already exist)

-- ── Add password_hash column (fixes cross-device login bug) ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash text;

-- ── Add media array column (up to 8 photos/videos) ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS media jsonb DEFAULT '[]';

-- ── Blocks table ──
CREATE TABLE IF NOT EXISTS public.blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

-- ── Reports table ──
CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete cascade,
  reported_id uuid references public.profiles(id) on delete cascade,
  reason      text not null,
  details     text,
  evidence_url text,
  status      text default 'pending',
  created_at  timestamptz default now()
);

-- ── RLS for new tables ──
ALTER TABLE public.blocks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blocks"   ON public.blocks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert block"  ON public.blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete block"  ON public.blocks FOR DELETE USING (true);

CREATE POLICY "Anyone can read reports"   ON public.reports FOR SELECT USING (true);
CREATE POLICY "Anyone can insert report"  ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update report"  ON public.reports FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete report"  ON public.reports FOR DELETE USING (true);
