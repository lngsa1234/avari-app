'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import MessagesPageView from '@/components/MessagesPageView'

export default function MessagesPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router)

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
      previousView="home"
    />
  )
}
