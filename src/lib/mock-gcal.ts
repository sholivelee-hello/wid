export interface GCalEvent {
  id: string;
  calendarId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM (start)
  endTime?: string; // HH:MM (end)
  location?: string;
}

const today = new Date();
const daysFromToday = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const MOCK_GCAL_EVENTS: GCalEvent[] = [
  { id: 'g1', calendarId: 'kim_minji', title: '스프린트 플래닝', date: daysFromToday(-2), time: '10:00', endTime: '11:00' },
  { id: 'g2', calendarId: 'jeong_hayoon', title: '디자인 리뷰', date: daysFromToday(-1), time: '14:00', endTime: '15:00' },
  { id: 'g3', calendarId: 'me', title: '1:1 미팅 (팀장)', date: daysFromToday(0), time: '11:00', endTime: '11:30' },
  { id: 'g4', calendarId: 'me', title: '제품 데모', date: daysFromToday(0), time: '15:30', endTime: '16:30' },
  { id: 'g5', calendarId: 'park_sejun', title: '분기 OKR 회의', date: daysFromToday(1), time: '09:30', endTime: '11:00' },
  { id: 'g6', calendarId: 'me', title: '고객사 방문', date: daysFromToday(2), time: '13:00', endTime: '17:00', location: '강남' },
  { id: 'g7', calendarId: 'me', title: '팀 회식', date: daysFromToday(3), time: '19:00', endTime: '21:00' },
  { id: 'g8', calendarId: 'me', title: '전사 타운홀', date: daysFromToday(5), time: '16:00', endTime: '17:30' },
  { id: 'g9', calendarId: 'park_sejun', title: '코드 리뷰 세션', date: daysFromToday(7), time: '11:00', endTime: '12:00' },
  { id: 'g10', calendarId: 'me', title: '파트너 미팅', date: daysFromToday(8), time: '14:00', endTime: '15:30' },
  { id: 'g11', calendarId: 'choi_yujin', title: '보안 교육', date: daysFromToday(10), time: '10:00', endTime: '11:00' },
];
