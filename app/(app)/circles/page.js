'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import useConnections from '@/hooks/useConnections'
import ConnectionGroupsView from '@/components/ConnectionGroupsView'

export default function CirclesPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const handleNavigate = createOnNavigate(router)

  const connectionsHook = useConnections(currentUser, {})

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <ConnectionGroupsView
      currentUser={currentUser}
      supabase={supabase}
      connections={connectionsHook.connections}
      onNavigate={handleNavigate}
    />
  )
}
