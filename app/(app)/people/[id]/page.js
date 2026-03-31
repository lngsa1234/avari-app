'use client'

import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import UserProfileView from '@/components/UserProfileView'

export default function UserProfilePage() {
  const { id } = useParams()
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const handleNavigate = createOnNavigate(router)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <UserProfileView
      currentUser={currentUser}
      supabase={supabase}
      userId={id}
      onNavigate={handleNavigate}
      previousView="discover"
    />
  )
}
