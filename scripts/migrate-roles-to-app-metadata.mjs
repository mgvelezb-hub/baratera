/**
 * Migración única: copia role de user_metadata → app_metadata para los 3 usuarios de Baratera.
 * Correr UNA VEZ desde el directorio raíz del proyecto:
 *   node scripts/migrate-roles-to-app-metadata.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envRaw = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ROLES = {
  'admin@lamasbaratera.mx':  'admin',
  'user2@lamasbaratera.mx':  'encargado',
  // user1 no tiene rol — no se incluye
}

const { data: { users }, error } = await supabase.auth.admin.listUsers()
if (error) { console.error('Error listando usuarios:', error); process.exit(1) }

for (const user of users) {
  const role = ROLES[user.email]
  if (!role) continue

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { role },
  })

  if (updateError) {
    console.error(`❌ ${user.email}:`, updateError.message)
  } else {
    console.log(`✅ ${user.email} → app_metadata.role = '${role}'`)
  }
}

console.log('\nMigración completa. Ahora el hook useIsAdmin lee de app_metadata.')
