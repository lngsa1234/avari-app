'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import UserProfileView from '@/components/UserProfileView'

export default function MyProfilePage() {
  const { profile: currentUser, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <UserProfileView
      currentUser={currentUser}
      supabase={supabase}
      userId={currentUser.id}
      onNavigate={handleNavigate}
      previousView={getPreviousView(searchParams, 'home')}
      onSignOut={signOut}
      onAdminDashboard={() => router.push('/admin')}
    />
  )
}
