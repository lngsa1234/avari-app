'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import AllPeopleView from '@/components/AllPeopleView'

export default function AllPeoplePage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const handleNavigate = createOnNavigate(router)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <AllPeopleView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
      previousView="discover"
    />
  )
}
