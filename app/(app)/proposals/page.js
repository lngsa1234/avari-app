'use client'

import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import MeetupProposalsView from '@/components/MeetupProposalsView'

export default function ProposalsPage() {
  const { profile: currentUser } = useAuth()

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <MeetupProposalsView
      currentUser={currentUser}
      supabase={supabase}
      isAdmin={currentUser.role === 'admin'}
    />
  )
}
