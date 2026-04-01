'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import AllPeopleView from '@/components/AllPeopleView'

export default function AllPeoplePage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <AllPeopleView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
      previousView={getPreviousView(searchParams, 'home')}
    />
  )
}
