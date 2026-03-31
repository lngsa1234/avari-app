'use client'

import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import CircleDetailView from '@/components/CircleDetailView'

export default function CircleDetailPage() {
  const { id } = useParams()
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const handleNavigate = createOnNavigate(router)

  if (!currentUser) return null

  return (
    <CircleDetailView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
      circleId={id}
      previousView="circles"
    />
  )
}
