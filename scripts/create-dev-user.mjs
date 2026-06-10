/**
 * Crea el usuario developer dev@dev.mx con role='developer' en app_metadata.
 * Ejecutar UNA VEZ desde la raíz del proyecto:
 *   node scripts/create-dev-user.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envRaw = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envRaw.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase.auth.admin.createUser({
  email:          'dev@dev.mx',
  password:       'Dev2026!',
  app_metadata:   { role: 'developer' },
  email_confirm:  true,
})

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log('✅ dev@dev.mx creado — id:', data.user.id)
console.log('   Contraseña: Dev2026!')
console.log('   Rol:        developer (app_metadata)')
