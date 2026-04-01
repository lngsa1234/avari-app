'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import AllCirclesView from '@/components/AllCirclesView'

export default function BrowseCirclesPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <AllCirclesView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
      previousView={getPreviousView(searchParams, 'discover')}
    />
  )
}
