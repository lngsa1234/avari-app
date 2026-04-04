'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import UserProfileView from '@/components/UserProfileView'
import EditProfileModal from '@/components/EditProfileModal'
import { invalidateQuery } from '@/hooks/useSupabaseQuery'

export default function MyProfilePage() {
  const { profile: currentUser, refreshProfile, signOut } = useAuth()
  const [showEdit, setShowEdit] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <>
      <UserProfileView
        currentUser={currentUser}
        supabase={supabase}
        userId={currentUser.id}
        onNavigate={handleNavigate}
        previousView={getPreviousView(searchParams, 'home')}
        onEditProfile={() => setShowEdit(true)}
        onSignOut={signOut}
        onAdminDashboard={() => router.push('/admin')}
        hideBack
      />
      {showEdit && (
        <EditProfileModal
          currentUser={currentUser}
          onClose={() => setShowEdit(false)}
          onSaved={(savedProfile) => {
            const key = `user-profile-${currentUser.id}-${currentUser.id}`
            invalidateQuery(key, prev => prev ? { ...prev, profile: { ...prev.profile, ...savedProfile } } : prev, { revalidate: false })
            refreshProfile?.()
          }}
        />
      )}
    </>
  )
}
