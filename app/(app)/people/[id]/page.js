'use client'

import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate, getPreviousView } from '@/lib/navigationAdapter'
import UserProfileView from '@/components/UserProfileView'

// UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function UserProfilePage() {
  const { id } = useParams()
  const { profile: currentUser, status } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handleNavigate = createOnNavigate(router, pathname)
  const [resolvedUserId, setResolvedUserId] = useState(UUID_RE.test(id) ? id : null)

  useEffect(() => {
    if (status === 'ready' && !currentUser) {
      router.replace(`/?next=/people/${id}`)
    }
  }, [status, currentUser, id, router])

  // Resolve username to UUID if needed
  useEffect(() => {
    if (UUID_RE.test(id)) {
      setResolvedUserId(id)
      return
    }
    // id is a username — look it up
    supabase
      .from('profiles')
      .select('id')
      .eq('username', id.toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setResolvedUserId(data.id)
        } else {
          // Username not found — redirect to people
          router.replace('/people')
        }
      })
      .catch(() => router.replace('/people'))
  }, [id, router])

  if (!currentUser || !resolvedUserId) return <div style={{ minHeight: "50vh" }} />

  return (
    <UserProfileView
      currentUser={currentUser}
      supabase={supabase}
      userId={resolvedUserId}
      onNavigate={handleNavigate}
      previousView={getPreviousView(searchParams, 'allPeople')}
    />
  )
}
