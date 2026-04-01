'use client'

import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import CoffeeChatDetailView from '@/components/CoffeeChatDetailView'

export default function EventDetailPage() {
  const { id } = useParams()
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  const category = searchParams.get('category')

  return (
    <CoffeeChatDetailView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
      coffeeChatId={id}
      meetupId={id}
      meetupCategory={category || undefined}
      previousView={getPreviousView(searchParams, 'meetups')}
    />
  )
}
