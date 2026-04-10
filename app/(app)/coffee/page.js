'use client'

import { useSearchParams, usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import useHomeData from '@/hooks/useHomeData'
import useConnections from '@/hooks/useConnections'
import MeetupsView from '@/components/MeetupsView'
import CallHistoryView from '@/components/CallHistoryView'

export default function CoffeePage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const view = searchParams.get('view') // 'past', 'history', or null
  // Include ?view= in the from param so back navigation preserves the active tab
  const fullPath = view ? `${pathname}?view=${view}` : pathname
  const handleNavigate = createOnNavigate(router, fullPath)

  const homeData = useHomeData(currentUser)
  const connectionsHook = useConnections(currentUser, {})

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  // Call history sub-view
  if (view === 'history') {
    return <CallHistoryView currentUser={currentUser} supabase={supabase} />
  }

  return (
    <MeetupsView
      currentUser={currentUser}
      connections={connectionsHook.connections}
      supabase={supabase}
      meetups={homeData.meetups}
      userSignups={homeData.userSignups}
      onNavigate={handleNavigate}
      initialView={view === 'past' ? 'past' : null}
      pastOnly={view === 'past'}
    />
  )
}
