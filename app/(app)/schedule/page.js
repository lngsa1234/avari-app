'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import useConnections from '@/hooks/useConnections'
import ScheduleMeetupView from '@/components/ScheduleMeetupView'

export default function SchedulePage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)

  const connectionsHook = useConnections(currentUser, {})

  // Read pre-fill data from query params
  const initialType = searchParams.get('type') || null
  const circleId = searchParams.get('circleId') || null
  const circleName = searchParams.get('circleName') || null
  const connectionId = searchParams.get('connectionId') || null
  const connectionName = searchParams.get('connectionName') || null

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <ScheduleMeetupView
      currentUser={currentUser}
      supabase={supabase}
      connections={connectionsHook.connections}
      onNavigate={handleNavigate}
      previousView={getPreviousView(searchParams, 'home')}
      initialType={initialType}
      scheduleContext={{
        type: initialType,
        circleId,
        circleName,
        connectionId,
        connectionName,
      }}
    />
  )
}
