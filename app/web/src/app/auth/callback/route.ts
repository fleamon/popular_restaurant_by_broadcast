import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase OAuth 콜백.
 *
 *  Supabase Auth(v2 + @supabase/ssr) 은 PKCE flow — provider 가 `?code=...` 를 들고 이쪽으로 보냄.
 *  이 code 를 서버에서 `exchangeCodeForSession(code)` 로 교환해야 세션 쿠키가 생성됨.
 *  교환 안 하면 DB 에는 회원가입 row 가 만들어졌어도 클라이언트 supabase-js 가 세션을 인지 못 함.
 *
 *  - `?next=` 쿼리로 콜백 후 이동할 경로를 받음 (default `/`). open-redirect 방지로 같은 origin 경로만 허용.
 *  - 메일 재설정 링크는 `type=recovery` 와 함께 들어옴 → /auth/reset-password 로 보냄.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const nextParam = url.searchParams.get("next") ?? "/";
  // open-redirect 방지 — 같은 origin 의 상대 경로만 허용
  const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => {
            toSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // 교환 실패 시 로그인 페이지로 — URL 쿼리에 사유 짧게 전달
      const redirect = new URL("/auth/login", url.origin);
      redirect.searchParams.set("error", error.message.slice(0, 200));
      return NextResponse.redirect(redirect);
    }
  }

  // 비밀번호 재설정 메일 링크는 reset-password 페이지로
  const dest = type === "recovery" ? "/auth/reset-password" : safeNext;
  return NextResponse.redirect(new URL(dest, url.origin));
}
