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
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (e: unknown) {
    throw mapAuthError(e);
  }
}

/** Supabase / network 에러 → 한국어 메시지로 번역. 디버깅 단서 보존 */
function mapAuthError(e: unknown): Error {
  // 네트워크 자체가 깨진 경우 (광고차단, 프로젝트 paused, 잘못된 SUPABASE_URL …)
  if (e instanceof TypeError && /fetch/i.test(e.message)) {
    return new Error(
      "Supabase 서버에 연결할 수 없습니다. " +
      "(① Supabase 프로젝트 paused 여부 / ② 광고차단 확장 / ③ .env.local 의 NEXT_PUBLIC_SUPABASE_URL 확인)"
    );
  }
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    if (msg.includes("invalid") && (msg.includes("credentials") || msg.includes("login"))) {
      return new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    if (msg.includes("email not confirmed")) {
      return new Error("이메일 인증이 완료되지 않았습니다. 받은 메일의 링크를 클릭하거나, 관리자에게 인증 면제를 요청하세요.");
    }
    if (msg.includes("user already registered")) {
      return new Error("이미 가입된 이메일입니다.");
    }
    return e;
  }
  return new Error("알 수 없는 오류가 발생했습니다.");
}

export type SignUpInput = {
  email: string;
  password: string;
  nickname: string;
};

/** 비밀번호 재설정 메일 전송 — 로그인 못 한 상태에서도 호출 가능.
 *  메일의 링크 클릭 → redirectTo 페이지 (/auth/reset-password) 에서 새 비번 입력.
 */
export async function sendPasswordReset(email: string) {
  const sb = getSupabaseBrowser();
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  } catch (e: unknown) {
    throw mapAuthError(e);
  }
}

/** 현재 비밀번호 확인 후 새 비밀번호로 변경 — 로그인 상태에서 마이페이지에서 호출. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const sb = getSupabaseBrowser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) throw new Error("로그인 정보를 가져올 수 없습니다.");
  // 현재 비밀번호 검증 — re-authenticate
  const { error: reAuthError } = await sb.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reAuthError) throw new Error("현재 비밀번호가 올바르지 않습니다.");
  try {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  } catch (e: unknown) {
    throw mapAuthError(e);
  }
}

/** 새 비밀번호 적용 — reset-password 페이지에서 호출. 로그인된 세션(또는 recovery 세션)이 있을 때만 동작. */
export async function updatePassword(newPassword: string) {
  const sb = getSupabaseBrowser();
  try {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  } catch (e: unknown) {
    throw mapAuthError(e);
  }
}

export async function signUpWithEmail({ email, password, nickname }: SignUpInput) {
  const sb = getSupabaseBrowser();
  // 비밀번호는 Supabase Auth 가 안전하게 해싱해 저장 (관리자도 평문을 알 수 없음).
  // raw_user_meta_data 의 nickname 은 handle_new_user 트리거가 public.users 로 복사.
  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { nickname } },
    });
    if (error) throw error;
    return data;
  } catch (e: unknown) {
    throw mapAuthError(e);
  }
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
