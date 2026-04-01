'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import MeetupProposalsView from '@/components/MeetupProposalsView'

export default function ProposalsPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <MeetupProposalsView
      currentUser={currentUser}
      supabase={supabase}
      isAdmin={currentUser.role === 'admin'}
      onNavigate={handleNavigate}
    />
  )
}
