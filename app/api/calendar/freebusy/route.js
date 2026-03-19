import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { providerToken, timeMin, timeMax } = await request.json()

    if (!providerToken || !timeMin || !timeMax) {
      return NextResponse.json(
        { error: 'Missing required fields: providerToken, timeMin, timeMax' },
        { status: 400 }
      )
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: 'primary' }],
      }),
    })

    if (!response.ok) {
      console.error('Google Calendar API error:', response.status)
      return NextResponse.json({ available: false })
    }

    const data = await response.json()
    const busy = data.calendars?.primary?.busy || []

    return NextResponse.json({ busy })
  } catch (error) {
    console.error('FreeBusy API error:', error)
    return NextResponse.json({ available: false })
  }
}
