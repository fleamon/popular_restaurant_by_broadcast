import { getSupabaseBrowser } from "./supabase";

type Provider = "kakao" | "google" | "naver";

export async function signInWithProvider(provider: Provider) {
  const sb = getSupabaseBrowser();
  // Supabase 기본 OAuth — Kakao / Google 은 provider 문자열 그대로.
  // Naver 는 Supabase Dashboard → Auth → Providers 의 "Custom OAuth" 로 등록 후
  // provider 이름을 'naver' 로 지정하면 동일 흐름으로 작동.
  await sb.auth.signInWithOAuth({
    provider: provider as never,
    options: { redirectTo: `${location.origin}/auth/callback` },
  });
}

export async function signOut() {
  await getSupabaseBrowser().auth.signOut();
  location.href = "/";
}
