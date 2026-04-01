'use client'

import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import CircleDetailView from '@/components/CircleDetailView'

export default function CircleDetailPage() {
  const { id } = useParams()
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <CircleDetailView
      currentUser={currentUser}
      supabase={supabase}
      onNavigate={handleNavigate}
      circleId={id}
      previousView={getPreviousView(searchParams, 'connectionGroups')}
    />
  )
}
