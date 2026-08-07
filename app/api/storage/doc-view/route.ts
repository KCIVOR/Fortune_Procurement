import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ACCREDITATION_DOCS_BUCKET } from '@/lib/accreditation-documents';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(req, { key: 'storage:doc-view', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const path = req.nextUrl.searchParams.get('path');
  if (!path) return new NextResponse('Missing path', { status: 400 });

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data, error } = await supabase.storage
    .from(ACCREDITATION_DOCS_BUCKET)
    .createSignedUrl(path, 60);

  if (error || !data?.signedUrl) {
    return new NextResponse('Access denied or file not found', { status: 403 });
  }

  return NextResponse.redirect(data.signedUrl);
}
