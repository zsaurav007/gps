import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reason = url.searchParams.get('reason') || 'expired'
  
  // 1. Destroy the session cookie
  const cookieStore = await cookies()
  cookieStore.delete('school_session')
  
  // 2. Route based on the security trigger
  if (reason === 'school_deleted') {
    // Redirecting to a non-existent URL forces Next.js to render the global not-found.tsx
    return NextResponse.redirect(new URL('/404', request.url))
  }
  
  if (reason === 'suspended') {
    return NextResponse.redirect(new URL('/login?error=account_suspended', request.url))
  }

  // Fallback
  return NextResponse.redirect(new URL('/login', request.url))
}