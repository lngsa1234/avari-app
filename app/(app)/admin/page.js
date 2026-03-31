'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { Calendar, MessageCircle, Users, BarChart3 } from 'lucide-react'

/**
 * Admin dashboard — quick links to admin tools.
 * The full admin dashboard with meetup management will be migrated
 * when MainApp is decomposed (Phase 4).
 */
export default function AdminPage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: '#7A6855' }}>
        Admin access required.
      </div>
    )
  }

  const actions = [
    { label: 'Review Proposals', icon: Calendar, href: '/proposals' },
    { label: 'View Feedback', icon: MessageCircle, href: '/admin/feedback' },
    { label: 'View Analytics', icon: BarChart3, href: '/admin/analytics' },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#F4EEE6] to-[#E8DDD0] rounded-lg p-6 border border-[#D4A574]">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Admin Dashboard</h3>
        <p className="text-sm text-gray-600">Manage meetups and view signups</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map(({ label, icon: Icon, href }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
          >
            <Icon className="w-5 h-5 mr-2" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
