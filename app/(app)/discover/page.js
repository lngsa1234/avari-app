'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import { useToast } from '@/components/Toast'
import useConnections from '@/hooks/useConnections'
import useHomeData from '@/hooks/useHomeData'
import NetworkDiscoverView from '@/components/NetworkDiscoverView'

export default function DiscoverPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const handleNavigate = createOnNavigate(router)

  const homeData = useHomeData(currentUser)
  const connectionsHook = useConnections(currentUser, {
    refreshConnectionRequests: homeData.loadConnectionRequests, toast
  })

  if (!currentUser) return null

  return (
    <NetworkDiscoverView
      currentUser={currentUser}
      supabase={supabase}
      connections={connectionsHook.connections}
      meetups={homeData.meetups}
      onNavigate={handleNavigate}
      toast={toast}
      onHostMeetup={(requestData) => {
        const params = new URLSearchParams()
        params.set('type', 'community')
        if (requestData?.topic) params.set('topic', requestData.topic)
        if (requestData?.description) params.set('description', requestData.description)
        router.push(`/schedule?${params}`)
      }}
    />
  )
}
