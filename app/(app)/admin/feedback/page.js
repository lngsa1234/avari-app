'use client'

import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import AdminFeedbackView from '@/components/AdminFeedbackView'

export default function AdminFeedbackPage() {
  const { profile: currentUser } = useAuth()

  if (!currentUser || currentUser.role !== 'admin') {
    return <div style={{ textAlign: 'center', padding: '48px', color: '#7A6855' }}>Admin access required.</div>
  }

  return <AdminFeedbackView currentUser={currentUser} supabase={supabase} />
}
