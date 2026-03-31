import { useState, useCallback } from 'react'
import { getPendingRequests, acceptCoffeeChat, declineCoffeeChat } from '@/lib/coffeeChatHelpers'
import { apiFetch } from '@/lib/apiFetch'
import { supabase } from '@/lib/supabase'

/**
 * useCoffeeChats — coffee chat requests, accept/decline handlers
 * upcomingCoffeeChats state is owned by useHomeData
 */
export default function useCoffeeChats(currentUser, { refreshCoffeeChats } = {}) {
  const [coffeeChatRequests, setCoffeeChatRequests] = useState([])

  const loadCoffeeChatRequests = useCallback(async () => {
    try {
      const requests = await getPendingRequests(supabase)
      setCoffeeChatRequests(requests)
    } catch (err) {
      console.error('Error loading coffee chat requests:', err)
      setCoffeeChatRequests([])
    }
  }, [supabase])

  const notifyEmail = (type, chatId) => {
    apiFetch('/api/notifications/coffee-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationType: type, chatId }),
    }).catch(err => console.error('[Email] notify failed:', err))
  }

  const handleAcceptCoffeeChat = useCallback(async (chatId) => {
    try {
      await acceptCoffeeChat(supabase, chatId)
      notifyEmail('accepted', chatId)
      setCoffeeChatRequests(prev => prev.filter(r => r.id !== chatId))
      await refreshCoffeeChats?.()
    } catch (err) {
      console.error('Error accepting coffee chat:', err)
    }
  }, [supabase, refreshCoffeeChats])

  const handleDeclineCoffeeChat = useCallback(async (chatId) => {
    try {
      await declineCoffeeChat(supabase, chatId)
      notifyEmail('declined', chatId)
      setCoffeeChatRequests(prev => prev.filter(r => r.id !== chatId))
    } catch (err) {
      console.error('Error declining coffee chat:', err)
    }
  }, [supabase])

  return {
    coffeeChatRequests,
    loadCoffeeChatRequests,
    handleAcceptCoffeeChat,
    handleDeclineCoffeeChat,
  }
}
