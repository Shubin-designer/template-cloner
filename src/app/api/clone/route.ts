import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('clones')
    .select('id, url, title, screenshot_path, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Generate public URLs for screenshots
  const clones = (data || []).map((clone) => {
    let screenshotUrl = null;
    if (clone.screenshot_path) {
      const { data: urlData } = supabase.storage
        .from('screenshots')
        .getPublicUrl(clone.screenshot_path);
      screenshotUrl = urlData.publicUrl;
    }
    return {
      id: clone.id,
      url: clone.url,
      title: clone.title,
      screenshotUrl,
      createdAt: clone.created_at,
    };
  });

  return NextResponse.json({
    clones,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
