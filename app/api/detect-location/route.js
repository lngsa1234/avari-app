import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';
import { rateLimit, limits } from '@/lib/rateLimit';

export async function GET(request) {
  const { user, response } = await authenticateRequest(request);
  if (!user) return response;

  const limited = await rateLimit(request, limits.geocode, user.id);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  // Validate numeric + range to prevent forwarding junk to Nominatim
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) ||
      latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return NextResponse.json({ error: 'invalid coordinates' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lonNum}&format=json&accept-language=en`,
      {
        headers: {
          'User-Agent': 'Avari-App/1.0 (contact@avari.app)',
        },
      }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
  }
}
