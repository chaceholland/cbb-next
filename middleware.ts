import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// chace-sports.vercel.app is the "one link" for all trackers — land visitors on
// the My Sports hub instead of the CBB app root. cbb-next.vercel.app unaffected.
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  if (host.startsWith('chace-sports.')) {
    return NextResponse.redirect(new URL('/hub', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: '/' };
