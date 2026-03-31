'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import CreateCircleView from '@/components/CreateCircleView'

export default function NewCirclePage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const handleNavigate = createOnNavigate(router)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <CreateCircleView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
    />
  )
}
