import type { Metadata } from "next";

// 로그인·회원가입·비밀번호 재설정·콜백 — 색인 제외.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
