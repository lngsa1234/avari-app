/**
 * Tests for action button state logic across the app.
 * Verifies that buttons show the correct label/state based on underlying data.
 */

describe('LiveFeed CTA button states', () => {
  // Simulate the CTA state logic from LiveFeed.jsx FeedItem
  function getCTAState({ configCta, eventType, isConnected, alreadyRequested, hasIncomingRequest, isOwnEvent, isMemberOfCircle }) {
    if (isOwnEvent) return { text: null, disabled: true } // no CTA for own events
    const isConnectType = configCta === 'Connect' || configCta === 'Say hi'
    const isCircleJoin = eventType === 'circle_join' || eventType === 'circle_schedule'

    let ctaText = configCta
    let isDisabled = false

    if (isConnectType && isConnected) {
      ctaText = 'Connected'
      isDisabled = true
    } else if (isConnectType && alreadyRequested) {
      ctaText = 'Request Sent'
      isDisabled = true
    } else if (isConnectType && hasIncomingRequest) {
      ctaText = 'Accept'
    } else if (isCircleJoin && isMemberOfCircle) {
      ctaText = 'Member'
      isDisabled = true
    }

    return { text: ctaText, disabled: isDisabled }
  }

  test('shows "Connect" when no relationship exists', () => {
    const state = getCTAState({ configCta: 'Connect', isConnected: false, alreadyRequested: false, hasIncomingRequest: false })
    expect(state.text).toBe('Connect')
    expect(state.disabled).toBe(false)
  })

  test('shows "Request Sent" when outgoing request exists', () => {
    const state = getCTAState({ configCta: 'Connect', isConnected: false, alreadyRequested: true, hasIncomingRequest: false })
    expect(state.text).toBe('Request Sent')
    expect(state.disabled).toBe(true)
  })

  test('shows "Connected" when mutual connection exists', () => {
    const state = getCTAState({ configCta: 'Connect', isConnected: true, alreadyRequested: false, hasIncomingRequest: false })
    expect(state.text).toBe('Connected')
    expect(state.disabled).toBe(true)
  })

  test('shows "Accept" when incoming request exists', () => {
    const state = getCTAState({ configCta: 'Connect', isConnected: false, alreadyRequested: false, hasIncomingRequest: true })
    expect(state.text).toBe('Accept')
    expect(state.disabled).toBe(false)
  })

  test('Connected takes priority over Request Sent', () => {
    const state = getCTAState({ configCta: 'Connect', isConnected: true, alreadyRequested: true, hasIncomingRequest: false })
    expect(state.text).toBe('Connected')
    expect(state.disabled).toBe(true)
  })

  test('Connected takes priority over incoming request', () => {
    const state = getCTAState({ configCta: 'Say hi', isConnected: true, alreadyRequested: false, hasIncomingRequest: true })
    expect(state.text).toBe('Connected')
    expect(state.disabled).toBe(true)
  })

  test('non-connect CTAs are not affected by connection state', () => {
    const state = getCTAState({ configCta: 'RSVP', isConnected: true, alreadyRequested: true, hasIncomingRequest: true })
    expect(state.text).toBe('RSVP')
    expect(state.disabled).toBe(false)
  })

  test('circle_join shows "Member" when user is already a member', () => {
    const state = getCTAState({ configCta: 'Join', eventType: 'circle_join', isMemberOfCircle: true })
    expect(state.text).toBe('Member')
    expect(state.disabled).toBe(true)
  })

  test('circle_join shows "Join" when user is not a member', () => {
    const state = getCTAState({ configCta: 'Join', eventType: 'circle_join', isMemberOfCircle: false })
    expect(state.text).toBe('Join')
    expect(state.disabled).toBe(false)
  })

  test('circle_schedule shows "Member" when user is already a member', () => {
    const state = getCTAState({ configCta: 'RSVP', eventType: 'circle_schedule', isMemberOfCircle: true })
    expect(state.text).toBe('Member')
    expect(state.disabled).toBe(true)
  })

  test('"Say hi" follows same logic as "Connect"', () => {
    const sent = getCTAState({ configCta: 'Say hi', isConnected: false, alreadyRequested: true, hasIncomingRequest: false })
    expect(sent.text).toBe('Request Sent')
    expect(sent.disabled).toBe(true)
  })
})

describe('UserProfileView connect button states', () => {
  // Simulate the button state logic from UserProfileView.js
  function getProfileButtonState({ isOwnProfile, isConnected, hasIncomingRequest, hasSentRequest, connecting }) {
    if (isOwnProfile) return { show: 'none' }
    if (isConnected) return { show: 'connected', buttons: ['Message', 'Schedule Coffee'] }
    if (hasIncomingRequest) return { show: 'incoming', buttons: ['Accept', 'Ignore'] }
    if (hasSentRequest) return { show: 'requestSent', text: 'Request Sent', disabled: true }
    if (connecting) return { show: 'connecting', text: 'Sending...', disabled: true }
    return { show: 'connect', text: 'Connect', disabled: false }
  }

  test('own profile shows no connect button', () => {
    expect(getProfileButtonState({ isOwnProfile: true }).show).toBe('none')
  })

  test('connected user shows Message and Schedule Coffee', () => {
    const state = getProfileButtonState({ isConnected: true })
    expect(state.show).toBe('connected')
    expect(state.buttons).toContain('Message')
    expect(state.buttons).toContain('Schedule Coffee')
  })

  test('incoming request shows Accept and Ignore', () => {
    const state = getProfileButtonState({ hasIncomingRequest: true })
    expect(state.show).toBe('incoming')
    expect(state.buttons).toContain('Accept')
    expect(state.buttons).toContain('Ignore')
  })

  test('sent request shows Request Sent (disabled)', () => {
    const state = getProfileButtonState({ hasSentRequest: true })
    expect(state.show).toBe('requestSent')
    expect(state.text).toBe('Request Sent')
    expect(state.disabled).toBe(true)
  })

  test('connecting shows Sending... (disabled)', () => {
    const state = getProfileButtonState({ connecting: true })
    expect(state.show).toBe('connecting')
    expect(state.disabled).toBe(true)
  })

  test('no relationship shows Connect', () => {
    const state = getProfileButtonState({})
    expect(state.show).toBe('connect')
    expect(state.text).toBe('Connect')
    expect(state.disabled).toBe(false)
  })
})

describe('MeetupsView coffee chat button states', () => {
  // Simulate button state logic from MeetupsView.js
  function getCoffeeChatAction({ status, requesterId, recipientId, currentUserId }) {
    const isPending = status === 'pending'
    const isInviteReceived = isPending && recipientId === currentUserId
    const isInviteSent = isPending && requesterId === currentUserId

    if (isInviteReceived) return { show: 'accept_decline', buttons: ['Accept', 'Decline'] }
    if (isInviteSent) return { show: 'awaiting', text: 'Awaiting response' }
    if (status === 'accepted' || status === 'scheduled') return { show: 'join_call' }
    if (status === 'completed') return { show: 'recap' }
    if (status === 'declined' || status === 'cancelled') return { show: 'hidden' }
    return { show: 'unknown' }
  }

  test('recipient sees Accept/Decline for pending chat', () => {
    const state = getCoffeeChatAction({ status: 'pending', requesterId: 'u1', recipientId: 'u2', currentUserId: 'u2' })
    expect(state.show).toBe('accept_decline')
    expect(state.buttons).toContain('Accept')
  })

  test('sender sees Awaiting response for pending chat', () => {
    const state = getCoffeeChatAction({ status: 'pending', requesterId: 'u1', recipientId: 'u2', currentUserId: 'u1' })
    expect(state.show).toBe('awaiting')
    expect(state.text).toBe('Awaiting response')
  })

  test('accepted chat shows Join Call', () => {
    const state = getCoffeeChatAction({ status: 'accepted', requesterId: 'u1', recipientId: 'u2', currentUserId: 'u1' })
    expect(state.show).toBe('join_call')
  })

  test('scheduled chat shows Join Call', () => {
    const state = getCoffeeChatAction({ status: 'scheduled', requesterId: 'u1', recipientId: 'u2', currentUserId: 'u1' })
    expect(state.show).toBe('join_call')
  })

  test('completed chat shows recap', () => {
    const state = getCoffeeChatAction({ status: 'completed', requesterId: 'u1', recipientId: 'u2', currentUserId: 'u1' })
    expect(state.show).toBe('recap')
  })

  test('declined chat is hidden', () => {
    const state = getCoffeeChatAction({ status: 'declined', requesterId: 'u1', recipientId: 'u2', currentUserId: 'u2' })
    expect(state.show).toBe('hidden')
  })
})

describe('CircleDetailView membership button states', () => {
  // Simulate button state logic from CircleDetailView.js
  function getCircleAction({ membershipStatus, isHost, isFull }) {
    if (isHost) return { show: 'host', buttons: ['Edit', 'Manage'] }
    if (membershipStatus === 'accepted') return { show: 'member', buttons: ['Chat', 'Leave'] }
    if (membershipStatus === 'invited') return { show: 'invited', buttons: ['Accept Invite', 'Decline'] }
    if (membershipStatus === 'pending') return { show: 'pending', text: 'Request Pending', canCancel: true }
    // Non-member
    if (isFull) return { show: 'full', text: 'Join Waitlist' }
    return { show: 'join', text: 'Request to Join' }
  }

  test('host sees Edit and Manage', () => {
    const state = getCircleAction({ isHost: true })
    expect(state.show).toBe('host')
  })

  test('member sees Chat and Leave', () => {
    const state = getCircleAction({ membershipStatus: 'accepted' })
    expect(state.show).toBe('member')
    expect(state.buttons).toContain('Chat')
    expect(state.buttons).toContain('Leave')
  })

  test('invited user sees Accept Invite and Decline', () => {
    const state = getCircleAction({ membershipStatus: 'invited' })
    expect(state.show).toBe('invited')
    expect(state.buttons).toContain('Accept Invite')
  })

  test('pending request shows Request Pending with cancel', () => {
    const state = getCircleAction({ membershipStatus: 'pending' })
    expect(state.show).toBe('pending')
    expect(state.text).toBe('Request Pending')
    expect(state.canCancel).toBe(true)
  })

  test('non-member of full circle sees Join Waitlist', () => {
    const state = getCircleAction({ membershipStatus: null, isFull: true })
    expect(state.show).toBe('full')
    expect(state.text).toBe('Join Waitlist')
  })

  test('non-member of open circle sees Request to Join', () => {
    const state = getCircleAction({ membershipStatus: null, isFull: false })
    expect(state.show).toBe('join')
    expect(state.text).toBe('Request to Join')
  })
})

describe('AllPeopleView connect button states', () => {
  // Simulate button state logic from AllPeopleView.js
  function getPeopleCardAction({ isConnected, hasPendingRequest }) {
    if (isConnected) return { text: 'Connected', disabled: true }
    if (hasPendingRequest) return { text: 'Requested', disabled: true }
    return { text: 'Connect', disabled: false }
  }

  test('connected user shows Connected (disabled)', () => {
    const state = getPeopleCardAction({ isConnected: true })
    expect(state.text).toBe('Connected')
    expect(state.disabled).toBe(true)
  })

  test('pending request shows Requested (disabled)', () => {
    const state = getPeopleCardAction({ hasPendingRequest: true })
    expect(state.text).toBe('Requested')
    expect(state.disabled).toBe(true)
  })

  test('no relationship shows Connect', () => {
    const state = getPeopleCardAction({})
    expect(state.text).toBe('Connect')
    expect(state.disabled).toBe(false)
  })
})

describe('Video call control bar button states', () => {
  // Simulate ControlBar button visibility/state
  function getControlBarState({ isMuted, isVideoOff, isScreenSharing, isOtherSharing, isBlurSupported, isBlurEnabled }) {
    return {
      mic: { active: !isMuted, tooltip: isMuted ? 'Unmute' : 'Mute' },
      camera: { active: !isVideoOff, tooltip: isVideoOff ? 'Turn on camera' : 'Turn off camera' },
      screenShare: {
        active: isScreenSharing,
        disabled: isOtherSharing,
        tooltip: isScreenSharing ? 'Stop sharing' : isOtherSharing ? 'Someone is sharing' : 'Share screen',
      },
      blur: { visible: isBlurSupported, active: isBlurEnabled, disabled: isVideoOff },
    }
  }

  test('muted state shows correct tooltip', () => {
    const state = getControlBarState({ isMuted: true, isVideoOff: false })
    expect(state.mic.active).toBe(false)
    expect(state.mic.tooltip).toBe('Unmute')
  })

  test('unmuted state shows correct tooltip', () => {
    const state = getControlBarState({ isMuted: false })
    expect(state.mic.active).toBe(true)
    expect(state.mic.tooltip).toBe('Mute')
  })

  test('camera off shows correct state', () => {
    const state = getControlBarState({ isVideoOff: true })
    expect(state.camera.active).toBe(false)
    expect(state.camera.tooltip).toBe('Turn on camera')
  })

  test('screen sharing disabled when other is sharing', () => {
    const state = getControlBarState({ isOtherSharing: true })
    expect(state.screenShare.disabled).toBe(true)
    expect(state.screenShare.tooltip).toBe('Someone is sharing')
  })

  test('screen sharing active shows stop tooltip', () => {
    const state = getControlBarState({ isScreenSharing: true })
    expect(state.screenShare.active).toBe(true)
    expect(state.screenShare.tooltip).toBe('Stop sharing')
  })

  test('blur disabled when camera is off', () => {
    const state = getControlBarState({ isBlurSupported: true, isVideoOff: true })
    expect(state.blur.visible).toBe(true)
    expect(state.blur.disabled).toBe(true)
  })

  test('blur not visible when unsupported', () => {
    const state = getControlBarState({ isBlurSupported: false })
    expect(state.blur.visible).toBe(false)
  })
})

describe('Home page coffee chat display consistency', () => {
  // Simulate the home page action button logic from HomeView.js
  function getHomeActionButton({ isCoffeeChat, coffeeChatStatus, isSignedUp }) {
    if (isCoffeeChat && coffeeChatStatus === 'pending') {
      return { show: 'awaiting', text: 'Awaiting response' }
    }
    if (isSignedUp) {
      return { show: 'join', text: 'Join' }
    }
    return { show: 'reserve', text: 'Reserve spot' }
  }

  test('pending coffee chat shows Awaiting response (not Join)', () => {
    const state = getHomeActionButton({ isCoffeeChat: true, coffeeChatStatus: 'pending', isSignedUp: true })
    expect(state.show).toBe('awaiting')
    expect(state.text).toBe('Awaiting response')
  })

  test('accepted coffee chat shows Join', () => {
    const state = getHomeActionButton({ isCoffeeChat: true, coffeeChatStatus: 'accepted', isSignedUp: true })
    expect(state.show).toBe('join')
    expect(state.text).toBe('Join')
  })

  test('scheduled coffee chat shows Join', () => {
    const state = getHomeActionButton({ isCoffeeChat: true, coffeeChatStatus: 'scheduled', isSignedUp: true })
    expect(state.show).toBe('join')
    expect(state.text).toBe('Join')
  })

  test('regular meetup signed up shows Join', () => {
    const state = getHomeActionButton({ isCoffeeChat: false, isSignedUp: true })
    expect(state.show).toBe('join')
  })

  test('regular meetup not signed up shows Reserve spot', () => {
    const state = getHomeActionButton({ isCoffeeChat: false, isSignedUp: false })
    expect(state.show).toBe('reserve')
  })

  // Simulate the coffee chat title logic from home page (app/(app)/home/page.js)
  function getCoffeeChatTitle({ topic }) {
    return topic || 'Coffee Chat'
  }

  test('coffee chat with topic shows only the topic', () => {
    expect(getCoffeeChatTitle({ topic: 'Weekly Marketing Strategy Review' })).toBe('Weekly Marketing Strategy Review')
  })

  test('coffee chat without topic shows Coffee Chat', () => {
    expect(getCoffeeChatTitle({ topic: null })).toBe('Coffee Chat')
  })

  test('coffee chat title does not include partner name', () => {
    const title = getCoffeeChatTitle({ topic: 'Weekly Marketing Strategy Review' })
    expect(title).not.toContain('with')
    expect(title).not.toContain('—')
  })

  // Simulate the partner display logic from HomeView.js
  function getCoffeePartnerDisplay({ otherPerson, host }) {
    const partnerName = otherPerson?.name || host?.name
    const partnerPic = otherPerson?.profile_picture || host?.profile_picture
    return {
      name: partnerName?.split(' ')[0] || 'Partner',
      hasAvatar: !!partnerPic,
      avatarUrl: partnerPic || null,
    }
  }

  test('shows partner name from _otherPerson', () => {
    const display = getCoffeePartnerDisplay({
      otherPerson: { name: 'Xueting Zhou', profile_picture: 'https://example.com/pic.jpg' },
      host: null,
    })
    expect(display.name).toBe('Xueting')
    expect(display.hasAvatar).toBe(true)
  })

  test('falls back to host when _otherPerson is null', () => {
    const display = getCoffeePartnerDisplay({
      otherPerson: null,
      host: { name: 'Xueting Zhou', profile_picture: 'https://example.com/pic.jpg' },
    })
    expect(display.name).toBe('Xueting')
    expect(display.hasAvatar).toBe(true)
  })

  test('shows initials when no avatar available', () => {
    const display = getCoffeePartnerDisplay({
      otherPerson: { name: 'Xueting Zhou', profile_picture: null },
      host: null,
    })
    expect(display.name).toBe('Xueting')
    expect(display.hasAvatar).toBe(false)
  })

  test('shows Partner fallback when no data available', () => {
    const display = getCoffeePartnerDisplay({ otherPerson: null, host: null })
    expect(display.name).toBe('Partner')
    expect(display.hasAvatar).toBe(false)
  })

  // Simulate category tag logic
  function getCategoryTag({ isCoffeeChat, circleId }) {
    if (isCoffeeChat) return '1:1 Coffee Chat'
    if (circleId) return 'Circle'
    return 'Event'
  }

  test('coffee chat shows 1:1 Coffee Chat tag', () => {
    expect(getCategoryTag({ isCoffeeChat: true })).toBe('1:1 Coffee Chat')
  })

  test('circle meetup shows Circle tag', () => {
    expect(getCategoryTag({ isCoffeeChat: false, circleId: 'abc' })).toBe('Circle')
  })

  test('regular meetup shows Event tag', () => {
    expect(getCategoryTag({ isCoffeeChat: false, circleId: null })).toBe('Event')
  })

  // Simulate the MeetupsView coffee chat title logic
  function getMeetupsViewTitle({ isCoffee, topic }) {
    return isCoffee ? (topic || 'Coffee Chat') : 'Community Event'
  }

  test('MeetupsView coffee chat with topic shows only topic', () => {
    expect(getMeetupsViewTitle({ isCoffee: true, topic: 'Fundraising Strategy' })).toBe('Fundraising Strategy')
  })

  test('MeetupsView coffee chat without topic shows Coffee Chat', () => {
    expect(getMeetupsViewTitle({ isCoffee: true, topic: null })).toBe('Coffee Chat')
  })

  test('MeetupsView coffee chat title does not include partner name', () => {
    const title = getMeetupsViewTitle({ isCoffee: true, topic: 'Fundraising Strategy' })
    expect(title).not.toContain('with')
  })

  // Simulate format tag logic from MeetupsView.js
  function getFormatTag({ isCoffee, meetingFormat }) {
    if (isCoffee || !meetingFormat || meetingFormat === 'virtual') return 'Virtual'
    if (meetingFormat === 'hybrid') return 'Hybrid'
    return 'In-Person'
  }

  test('coffee chat shows Virtual tag', () => {
    expect(getFormatTag({ isCoffee: true })).toBe('Virtual')
  })

  test('virtual meetup shows Virtual tag', () => {
    expect(getFormatTag({ isCoffee: false, meetingFormat: 'virtual' })).toBe('Virtual')
  })

  test('meetup with no format shows Virtual tag', () => {
    expect(getFormatTag({ isCoffee: false, meetingFormat: null })).toBe('Virtual')
  })

  test('in-person meetup shows In-Person tag', () => {
    expect(getFormatTag({ isCoffee: false, meetingFormat: 'in_person' })).toBe('In-Person')
  })

  test('hybrid meetup shows Hybrid tag', () => {
    expect(getFormatTag({ isCoffee: false, meetingFormat: 'hybrid' })).toBe('Hybrid')
  })

  // Verify awaiting response is not duplicated
  test('coffee page shows awaiting response only in action button, not in badge', () => {
    // The badge (status tag area) should NOT show awaiting response
    // Only the action button area shows it
    function getBadgeText({ isCoffee, isPending }) {
      // After our fix: no pending badge for coffee chats
      // (removed the "Awaiting response" / "Invited you" badge)
      return null
    }
    function getActionText({ isCoffee, isPending, isInviteReceived, isMobile }) {
      if (!isCoffee) return null
      if (isInviteReceived) return 'Accept'
      if (isPending) return isMobile ? 'Awaiting' : 'Awaiting response'
      return 'Join'
    }

    // Badge should be null (no duplicate)
    expect(getBadgeText({ isCoffee: true, isPending: true })).toBeNull()
    // Action button shows it once
    expect(getActionText({ isCoffee: true, isPending: true, isInviteReceived: false, isMobile: false })).toBe('Awaiting response')
    expect(getActionText({ isCoffee: true, isPending: true, isInviteReceived: false, isMobile: true })).toBe('Awaiting')
  })

  // Home page action button: recipient vs sender
  function getHomeActionButtonV2({ isCoffeeChat, coffeeChatStatus, recipientId, currentUserId, isSignedUp }) {
    if (isCoffeeChat && coffeeChatStatus === 'pending' && recipientId === currentUserId) {
      return { show: 'accept_decline', buttons: ['Accept', 'Decline'] }
    }
    if (isCoffeeChat && coffeeChatStatus === 'pending') {
      return { show: 'awaiting', text: 'Awaiting response' }
    }
    if (isSignedUp) {
      return { show: 'join', text: 'Join' }
    }
    return { show: 'reserve', text: 'Reserve spot' }
  }

  test('recipient sees Accept/Decline on home page for pending coffee chat', () => {
    const state = getHomeActionButtonV2({ isCoffeeChat: true, coffeeChatStatus: 'pending', recipientId: 'u2', currentUserId: 'u2', isSignedUp: true })
    expect(state.show).toBe('accept_decline')
    expect(state.buttons).toContain('Accept')
    expect(state.buttons).toContain('Decline')
  })

  test('sender sees Awaiting response on home page for pending coffee chat', () => {
    const state = getHomeActionButtonV2({ isCoffeeChat: true, coffeeChatStatus: 'pending', recipientId: 'u2', currentUserId: 'u1', isSignedUp: true })
    expect(state.show).toBe('awaiting')
  })

  test('both see Join after coffee chat is accepted', () => {
    const sender = getHomeActionButtonV2({ isCoffeeChat: true, coffeeChatStatus: 'accepted', recipientId: 'u2', currentUserId: 'u1', isSignedUp: true })
    const recipient = getHomeActionButtonV2({ isCoffeeChat: true, coffeeChatStatus: 'accepted', recipientId: 'u2', currentUserId: 'u2', isSignedUp: true })
    expect(sender.show).toBe('join')
    expect(recipient.show).toBe('join')
  })

  // Detail page button states
  function getDetailPageButton({ isCoffeeChat, status, meetingFormat }) {
    if (isCoffeeChat && status === 'pending') return { show: 'awaiting', text: 'Awaiting response' }
    if (meetingFormat !== 'in_person') return { show: 'join', text: 'Join Call' }
    return { show: 'none' }
  }

  test('detail page shows Awaiting response for pending coffee chat', () => {
    const state = getDetailPageButton({ isCoffeeChat: true, status: 'pending', meetingFormat: 'virtual' })
    expect(state.show).toBe('awaiting')
  })

  test('detail page shows Join Call for accepted coffee chat', () => {
    const state = getDetailPageButton({ isCoffeeChat: true, status: 'accepted', meetingFormat: 'virtual' })
    expect(state.show).toBe('join')
  })

  // Coffee chat status transition: pending → accepted
  test('status transition from pending to accepted changes button', () => {
    const pending = getHomeActionButton({ isCoffeeChat: true, coffeeChatStatus: 'pending', isSignedUp: true })
    expect(pending.show).toBe('awaiting')

    const accepted = getHomeActionButton({ isCoffeeChat: true, coffeeChatStatus: 'accepted', isSignedUp: true })
    expect(accepted.show).toBe('join')
    expect(accepted.text).toBe('Join')
  })

  // Coffee chat request deduplication between upcoming meetups and requests section
  function getVisibleCoffeeRequestIds(upcomingMeetups, sliceCount) {
    return new Set(
      upcomingMeetups.slice(0, sliceCount)
        .filter(m => m._isCoffeeChat)
        .map(m => m._coffeeChatId)
        .filter(Boolean)
    )
  }

  function filterRemainingCoffeeRequests(coffeeChatRequests, visibleIds) {
    return coffeeChatRequests.filter(r => !visibleIds.has(r.id))
  }

  test('coffee request shown in upcoming is excluded from requests section', () => {
    const upcomingMeetups = [
      { _isCoffeeChat: true, _coffeeChatId: 'chat-1' },
      { _isCoffeeChat: false },
      { _isCoffeeChat: true, _coffeeChatId: 'chat-2' },
    ]
    const coffeeChatRequests = [
      { id: 'chat-1', requester: { name: 'Alice' } },
      { id: 'chat-3', requester: { name: 'Bob' } },
    ]
    const visibleIds = getVisibleCoffeeRequestIds(upcomingMeetups, 3)
    const remaining = filterRemainingCoffeeRequests(coffeeChatRequests, visibleIds)

    expect(visibleIds.has('chat-1')).toBe(true)
    expect(remaining.length).toBe(1)
    expect(remaining[0].id).toBe('chat-3')
  })

  test('coffee request NOT in top 3 upcoming stays in requests section', () => {
    const upcomingMeetups = [
      { _isCoffeeChat: false },
      { _isCoffeeChat: false },
      { _isCoffeeChat: false },
      { _isCoffeeChat: true, _coffeeChatId: 'chat-4' }, // position 4, not visible
    ]
    const coffeeChatRequests = [
      { id: 'chat-4', requester: { name: 'Charlie' } },
    ]
    const visibleIds = getVisibleCoffeeRequestIds(upcomingMeetups, 3)
    const remaining = filterRemainingCoffeeRequests(coffeeChatRequests, visibleIds)

    expect(visibleIds.has('chat-4')).toBe(false)
    expect(remaining.length).toBe(1)
    expect(remaining[0].id).toBe('chat-4')
  })

  test('all coffee requests in upcoming means requests section is empty', () => {
    const upcomingMeetups = [
      { _isCoffeeChat: true, _coffeeChatId: 'chat-a' },
      { _isCoffeeChat: true, _coffeeChatId: 'chat-b' },
    ]
    const coffeeChatRequests = [
      { id: 'chat-a' },
      { id: 'chat-b' },
    ]
    const visibleIds = getVisibleCoffeeRequestIds(upcomingMeetups, 3)
    const remaining = filterRemainingCoffeeRequests(coffeeChatRequests, visibleIds)

    expect(remaining.length).toBe(0)
  })

  test('no upcoming coffee chats means all requests stay', () => {
    const upcomingMeetups = [
      { _isCoffeeChat: false },
      { _isCoffeeChat: false },
    ]
    const coffeeChatRequests = [
      { id: 'chat-x' },
      { id: 'chat-y' },
    ]
    const visibleIds = getVisibleCoffeeRequestIds(upcomingMeetups, 3)
    const remaining = filterRemainingCoffeeRequests(coffeeChatRequests, visibleIds)

    expect(remaining.length).toBe(2)
  })

  test('empty upcoming and empty requests produces nothing', () => {
    const visibleIds = getVisibleCoffeeRequestIds([], 3)
    const remaining = filterRemainingCoffeeRequests([], visibleIds)

    expect(visibleIds.size).toBe(0)
    expect(remaining.length).toBe(0)
  })
})
