'use client'

import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import UserProfileView from '@/components/UserProfileView'

export default function UserProfilePage() {
  const { id } = useParams()
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <UserProfileView
      currentUser={currentUser}
      supabase={supabase}
      userId={id}
      onNavigate={handleNavigate}
      previousView={getPreviousView(searchParams, 'allPeople')}
    />
  )
}
