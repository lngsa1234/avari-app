'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import useConnections from '@/hooks/useConnections'
import ScheduleMeetupView from '@/components/ScheduleMeetupView'

export default function SchedulePage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router)

  const connectionsHook = useConnections(currentUser, {})

  // Read pre-fill data from query params
  const initialType = searchParams.get('type') || null
  const circleId = searchParams.get('circleId') || null
  const circleName = searchParams.get('circleName') || null
  const connectionId = searchParams.get('connectionId') || null
  const connectionName = searchParams.get('connectionName') || null

  if (!currentUser) return null

  return (
    <ScheduleMeetupView
      currentUser={currentUser}
      supabase={supabase}
      connections={connectionsHook.connections}
      onNavigate={handleNavigate}
      previousView="home"
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
