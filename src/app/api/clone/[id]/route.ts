import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: clone, error } = await supabase
    .from('clones')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !clone) {
    return NextResponse.json({ error: 'Clone not found' }, { status: 404 });
  }

  // Get screenshot URL
  let screenshotUrl = null;
  let screenshot = '';
  if (clone.screenshot_path) {
    const { data: urlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(clone.screenshot_path);
    screenshotUrl = urlData.publicUrl;

    // Also fetch the actual screenshot data for the preview
    const { data: fileData } = await supabase.storage
      .from('screenshots')
      .download(clone.screenshot_path);
    if (fileData) {
      const buffer = Buffer.from(await fileData.arrayBuffer());
      screenshot = buffer.toString('base64');
    }
  }

  // Get HTML from storage
  let html = '';
  const htmlPath = `${user.id}/${params.id}.html`;
  const { data: htmlData } = await supabase.storage
    .from('html-dumps')
    .download(htmlPath);
  if (htmlData) {
    html = await htmlData.text();
  }

  return NextResponse.json({
    id: clone.id,
    url: clone.url,
    title: clone.title,
    screenshot,
    screenshotUrl,
    html,
    tree: clone.component_tree,
    metadata: clone.metadata,
    createdAt: clone.created_at,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get clone to find screenshot path
  const { data: clone } = await supabase
    .from('clones')
    .select('screenshot_path')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!clone) {
    return NextResponse.json({ error: 'Clone not found' }, { status: 404 });
  }

  // Delete storage files
  if (clone.screenshot_path) {
    await supabase.storage.from('screenshots').remove([clone.screenshot_path]);
  }
  const htmlPath = `${user.id}/${params.id}.html`;
  await supabase.storage.from('html-dumps').remove([htmlPath]);

  // Delete clone record
  const { error } = await supabase
    .from('clones')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
