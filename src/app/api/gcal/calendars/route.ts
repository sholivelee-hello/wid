import { NextResponse } from 'next/server';
import { MOCK_CALENDARS } from '@/lib/mock-calendars';

export async function GET() {
  // TODO: real Google Calendar API integration when OAuth set up
  return NextResponse.json(MOCK_CALENDARS);
}
