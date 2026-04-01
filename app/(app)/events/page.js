'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import AllEventsView from '@/components/AllEventsView'

export default function AllEventsPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <AllEventsView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
    />
  )
}
