// 소셜 로그인 버튼용 인라인 SVG 로고. CDN 의존성 없음, 색상 정확.

export function KakaoLogo({ size = 22 }: { size?: number }) {
  // 카카오 공식 심볼: 둥근 라벨/말풍선 안 검정 K
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#000000"
        d="M12 4C6.477 4 2 7.582 2 12c0 2.835 1.85 5.318 4.61 6.733L5.5 22l3.992-2.605c.815.13 1.65.205 2.508.205 5.523 0 10-3.582 10-8s-4.477-7.6-10-7.6z"
      />
    </svg>
  );
}

export function NaverLogo({ size = 22 }: { size?: number }) {
  // 네이버 N — 흰색 N, 녹색 배경은 버튼에서 처리
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#FFFFFF"
        d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727z"
      />
    </svg>
  );
}

export function GoogleLogo({ size = 22 }: { size?: number }) {
  // 구글 G — 4색 멀티컬러
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.49-1.13 2.75-2.4 3.6v3h3.88c2.27-2.09 3.57-5.17 3.57-8.84z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3c-1.07.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.25 21.31 7.31 24 12 24z"/>
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.27C.46 8.24 0 10.06 0 12s.46 3.76 1.27 5.38l4-3.09z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
    </svg>
  );
}
