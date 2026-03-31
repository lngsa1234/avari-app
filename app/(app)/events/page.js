'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import AllEventsView from '@/components/AllEventsView'

export default function AllEventsPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const handleNavigate = createOnNavigate(router)

  if (!currentUser) return null

  return (
    <AllEventsView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
    />
  )
}
