import { getSupabaseBrowser } from "./supabase";

type Provider = "kakao" | "google" | "naver";

export async function signInWithProvider(provider: Provider) {
  const sb = getSupabaseBrowser();
  // Supabase 기본 OAuth — Kakao / Google 은 provider 문자열 그대로.
  // Naver 는 Custom OAuth 로 등록 시 동일 흐름.
  await sb.auth.signInWithOAuth({
    provider: provider as never,
    options: { redirectTo: `${location.origin}/auth/callback` },
  });
}

export async function signOut() {
  await getSupabaseBrowser().auth.signOut();
  location.href = "/";
}

// ─────────────────────────────────────────────────────────────────────
// 이메일 + 비밀번호
// ─────────────────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string) {
  const sb = getSupabaseBrowser();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export type SignUpInput = {
  email: string;
  password: string;
  nickname: string;
};

export async function signUpWithEmail({ email, password, nickname }: SignUpInput) {
  const sb = getSupabaseBrowser();
  // 비밀번호는 Supabase Auth 가 안전하게 해싱해 저장 (관리자도 평문을 알 수 없음).
  // raw_user_meta_data 의 nickname 은 handle_new_user 트리거가 public.users 로 복사.
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  if (error) throw error;
  return data;
}

/** 이미 로그인된 사용자에게 admin 권한을 부여. FastAPI 에서 admin 시크릿 검증. */
export async function grantAdmin(adminId: string, adminPassword: string) {
  const sb = getSupabaseBrowser();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const res = await fetch(`${base}/auth/grant-admin`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ admin_id: adminId, admin_password: adminPassword }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`admin 권한 부여 실패: ${txt}`);
  }
}
