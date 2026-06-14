import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isPublicRoute = request.nextUrl.pathname.startsWith('/catalogo')
    || request.nextUrl.pathname.startsWith('/api/cron/')

  // ── Bloqueo de plataforma (lockdown) ───────────────────────────
  // Si el developer activó el bloqueo, solo el rol 'developer' puede
  // entrar. A cualquier otro usuario logueado se le cierra la sesión y
  // se le manda a /login con aviso. Fail-open: si la consulta falla, NO
  // se bloquea (evita dejar fuera a todos por un error transitorio).
  if (user && !isAuthRoute && !isPublicRoute) {
    const rol = (user.app_metadata as Record<string, string> | null)?.role
    if (rol !== 'developer') {
      let bloqueado = false
      try {
        const { data } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', 'lockdown')
          .maybeSingle()
        bloqueado = (data?.valor as { activo?: boolean } | null)?.activo === true
      } catch {
        bloqueado = false
      }
      if (bloqueado) {
        await supabase.auth.signOut()            // revoca sesión + limpia cookies
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.search = ''
        url.searchParams.set('bloqueado', '1')
        const redirect = NextResponse.redirect(url)
        // Propaga a la redirección las cookies ya limpiadas por signOut
        supabaseResponse.cookies.getAll().forEach(c => redirect.cookies.set(c.name, c.value, c))
        return redirect
      }
    }
  }

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/inventario'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
