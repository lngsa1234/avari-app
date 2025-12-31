'use client'

import { AuthProvider } from '@/components/AuthProvider'
import AppContainer from '@/components/AppContainer'

export default function Home() {
  return (
    <AuthProvider>
      <AppContainer />
    </AuthProvider>
  )
}
