'use client'

import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import CoffeeChatDetailView from '@/components/CoffeeChatDetailView'

export default function EventDetailPage() {
  const { id } = useParams()
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const handleNavigate = createOnNavigate(router)

  if (!currentUser) return null

  return (
    <CoffeeChatDetailView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
      coffeeChatId={id}
      meetupId={id}
      previousView="coffee"
    />
  )
}
