-- Profiles table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clones table
CREATE TABLE IF NOT EXISTS clones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  screenshot_path TEXT,
  component_tree JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clones_user_id ON clones(user_id);
CREATE INDEX IF NOT EXISTS idx_clones_created_at ON clones(created_at DESC);

ALTER TABLE clones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clones"
  ON clones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clones"
  ON clones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clones"
  ON clones FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clones"
  ON clones FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket for HTML dumps
INSERT INTO storage.buckets (id, name, public)
VALUES ('html-dumps', 'html-dumps', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'screenshots');

CREATE POLICY "Users can delete own screenshots"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can upload html dumps"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'html-dumps' AND auth.role() = 'authenticated');

CREATE POLICY "Users can read own html dumps"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'html-dumps' AND auth.uid()::text = (storage.foldername(name))[1]);
