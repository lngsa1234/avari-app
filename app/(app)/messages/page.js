'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import MessagesPageView from '@/components/MessagesPageView'

export default function MessagesPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)

  const chatId = searchParams.get('id') || null
  const chatType = searchParams.get('type') || 'user'

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <MessagesPageView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
      initialChatId={chatId}
      initialChatType={chatType}
      previousView={getPreviousView(searchParams, 'home')}
    />
  )
}
