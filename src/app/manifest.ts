import type { MetadataRoute } from 'next';

// Android '홈 화면에 추가' / PWA 설치 시 쓰이는 앱 아이콘·이름 정의.
// iOS 홈 화면 아이콘은 src/app/apple-icon.png 파일 컨벤션이 담당.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WID — What I Do',
    short_name: 'WID',
    description: '개인 업무일지 시스템',
    start_url: '/',
    display: 'standalone',
    // 다크 전용 앱 — 설치형 시작 화면(splash)도 본문 배경색과 동일하게.
    background_color: '#161621',
    theme_color: '#7D74F8',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
