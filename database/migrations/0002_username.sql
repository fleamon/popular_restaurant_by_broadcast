-- 마이그레이션 #0002 : 이메일/비밀번호 회원가입을 위한 username 컬럼 추가
-- 멱등 — schema.sql 에도 반영되어 있으므로 이미 적용된 환경에선 변화 없음.

alter table public.profiles
  add column if not exists username text unique;

-- raw_user_meta_data 의 nickname / username 도 자동 복사하도록 트리거 갱신
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, username, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
