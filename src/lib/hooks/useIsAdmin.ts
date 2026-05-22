'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(user?.user_metadata?.role === 'admin')
      setLoading(false)
    })
  }, [])

  return { isAdmin, loading }
}
