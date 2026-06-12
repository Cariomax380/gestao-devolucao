import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = 'https://plxlhwvxloynwoyogdsf.supabase.co'
const SUPABASE_WS  = 'wss://plxlhwvxloynwoyogdsf.supabase.co'

function buildCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    // 'strict-dynamic' makes 'unsafe-inline' a no-op in modern browsers;
    // kept as fallback for browsers without strict-dynamic support.
    // 'unsafe-eval' is only added in dev — React uses eval() for stack traces.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${SUPABASE_URL} ${SUPABASE_WS}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp   = buildCSP(nonce)

  // Inject nonce into request headers so Next.js applies it to its own
  // inline scripts (hydration, __NEXT_DATA__) and so server components
  // can read it via headers().get('x-nonce').
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Re-create response preserving the nonce request header.
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthRoute   = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon')

  if (!isPublicAsset) {
    if (!isAuthRoute && !user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      const redirect = NextResponse.redirect(loginUrl)
      redirect.headers.set('Content-Security-Policy', csp)
      return redirect
    }

    if (pathname === '/login' && user) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      const redirect = NextResponse.redirect(dashboardUrl)
      redirect.headers.set('Content-Security-Policy', csp)
      return redirect
    }
  }

  supabaseResponse.headers.set('Content-Security-Policy', csp)
  return supabaseResponse
}

export const config = {
  // Exclui API routes — cada route handler verifica auth internamente
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js)$).*)',
  ],
}
