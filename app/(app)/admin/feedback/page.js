'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import AdminFeedbackView from '@/components/AdminFeedbackView'

export default function AdminFeedbackPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const handleNavigate = createOnNavigate(router, pathname)

  if (!currentUser || currentUser.role !== 'admin') {
    return <div style={{ textAlign: 'center', padding: '48px', color: '#7A6855' }}>Admin access required.</div>
  }

  return <AdminFeedbackView currentUser={currentUser} supabase={supabase} onNavigate={handleNavigate} />
}
