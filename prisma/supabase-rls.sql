-- Run ONCE in Supabase > SQL Editor, after `prisma migrate dev`, and again after adding new tables.
-- Locks every table in "public" against Supabase's auto-generated REST API (anon/authenticated keys).
-- Our app connects through Prisma as the owner role, which bypasses RLS, so the app is unaffected.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
