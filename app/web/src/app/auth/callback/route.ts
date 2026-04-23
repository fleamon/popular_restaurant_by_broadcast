import { NextResponse } from "next/server";

// Supabase OAuth 콜백. 실제 세션 교환은 클라이언트에서 supabase-js 가 처리하므로
// 여기서는 루트로 리다이렉트만 한다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/", url.origin));
}
