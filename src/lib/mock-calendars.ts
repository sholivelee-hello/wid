export interface CalendarSubscription {
  id: string;
  name: string;
  role?: string;
  defaultColor: string;
}

export const MOCK_CALENDARS: CalendarSubscription[] = [
  { id: 'me',           name: '내 캘린더', defaultColor: '#6366F1' },
  { id: 'kim_minji',    name: '김민지', role: '디자인', defaultColor: '#14B8A6' },
  { id: 'park_sejun',   name: '박서준', role: '백엔드', defaultColor: '#F59E0B' },
  { id: 'jeong_hayoon', name: '정하윤', role: 'PM', defaultColor: '#8B5CF6' },
  { id: 'choi_yujin',   name: '최유진', role: '프론트', defaultColor: '#10B981' },
];
