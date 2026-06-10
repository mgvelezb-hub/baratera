'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CONFIG_DEFAULTS, mergeConfig, type AppConfig } from '@/lib/config'
import { setSemaforoFactor } from '@/lib/types'

// Caché a nivel módulo — un solo fetch por página aunque varios
// componentes usen el hook. Fallback silencioso a CONFIG_DEFAULTS.

let cache: { config: AppConfig; ts: number } | null = null
let pending: Promise<AppConfig> | null = null
const CACHE_TTL = 60_000

async function fetchConfig(): Promise<AppConfig> {
  const { data, error } = await createClient()
    .from('configuracion')
    .select('clave, valor')

  const config = error ? structuredClone(CONFIG_DEFAULTS) : mergeConfig(data)
  // Propagar el factor del semáforo a la función pura de types.ts
  setSemaforoFactor(config.inventario.semaforo_factor)
  return config
}

function getConfig(): Promise<AppConfig> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return Promise.resolve(cache.config)
  if (!pending) {
    pending = fetchConfig()
      .then(config => {
        cache = { config, ts: Date.now() }
        return config
      })
      .finally(() => { pending = null })
  }
  return pending
}

export function invalidateConfigCache() {
  cache = null
}

export function useConfig() {
  const [config, setConfig]   = useState<AppConfig>(CONFIG_DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getConfig().then(c => {
      if (mounted) {
        setConfig(c)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  return { config, loading }
}
