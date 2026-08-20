import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth/jwt'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const path = request.nextUrl.pathname

  // ---------------------------------------------------------
  // 1. Supabase Auth Management (For Master / Platform Admin)
  // ---------------------------------------------------------
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This ensures the Supabase session is refreshed if it exists
  const { data: { user: adminUser } } = await supabase.auth.getUser()

  // Protect Platform Admin Routes
  if (path.startsWith('/platform-dashboard') && !adminUser) {
    return NextResponse.redirect(new URL('/admin-login', request.url))
  }

  // Redirect authenticated admins away from the admin login page
  if (path === '/admin-login' && adminUser) {
    return NextResponse.redirect(new URL('/platform-dashboard', request.url))
  }

  // ---------------------------------------------------------
  // 2. Custom JWT Auth Management (For Headmasters & Teachers)
  // ---------------------------------------------------------
  
  // Protect School Workspace Routes
  if (path.startsWith('/school-dashboard')) {
    const sessionCookie = request.cookies.get('school_session')?.value
    const sessionPayload = sessionCookie ? await decrypt(sessionCookie) : null

    // If there is no cookie, or the JWT is invalid/expired, redirect to login
    if (!sessionPayload) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Redirect authenticated school users away from the public login page
  if (path === '/login' && request.cookies.has('school_session')) {
    const sessionCookie = request.cookies.get('school_session')?.value
    const sessionPayload = sessionCookie ? await decrypt(sessionCookie) : null
    
    if (sessionPayload) {
      return NextResponse.redirect(new URL('/school-dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}