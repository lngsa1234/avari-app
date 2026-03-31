'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import UserProfileView from '@/components/UserProfileView'

export default function MyProfilePage() {
  const { profile: currentUser, signOut } = useAuth()
  const router = useRouter()
  const handleNavigate = createOnNavigate(router)

  if (!currentUser) return null

  return (
    <UserProfileView
      currentUser={currentUser}
      supabase={supabase}
      userId={currentUser.id}
      onNavigate={handleNavigate}
      previousView="home"
      onSignOut={signOut}
      onAdminDashboard={() => router.push('/admin')}
    />
  )
}
