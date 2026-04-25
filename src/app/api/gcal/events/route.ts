import { NextRequest, NextResponse } from 'next/server';
import { MOCK_GCAL_EVENTS } from '@/lib/mock-gcal';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get('from'); // YYYY-MM-DD
  const to = searchParams.get('to');

  // TODO: integrate real Google Calendar API when credentials are set up
  // For now, return mock data filtered by date range
  let events = MOCK_GCAL_EVENTS;
  if (from) events = events.filter(e => e.date >= from);
  if (to) events = events.filter(e => e.date <= to);

  return NextResponse.json(events);
}
