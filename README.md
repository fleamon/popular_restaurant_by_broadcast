# 백안맛지도 (Baekahn Matjido)

대한민국에서 가장 가독성 좋은 **전국 방송 맛집 지도** 웹앱.
TV·YouTube·블로그에 소개된 맛집을 지도 한 장으로 훑어보고, 좋아요/싫어요로 랭킹을 만들어갑니다.

- 브랜드 컬러: `#2B7FFF` (로고 배경 파랑) · 본문 텍스트: `#2C42A3`
- 스택: **Next.js 16**(App Router · Turbopack) + **FastAPI** + **Supabase** + **Vercel**
- 1인 개발자 친화 — 모노레포 · 함수형 지향 · 최소 설정

---

## 저장소 구조 (모노레포)

```
popular_restaurant_by_broadcast/
├── app/
│   ├── web/                # Next.js (Vercel 배포 대상)
│   │   ├── public/         # 로고/아이콘 자산
│   │   └── src/
│   │       ├── app/        # App Router (page.tsx 가 곧 라우트)
│   │       ├── components/
│   │       └── lib/        # api/auth/me/role/supabase/theme
│   └── api/                # FastAPI (REST API)
│       ├── routers/        # auth/users/restaurants/channels/votes/admin
│       ├── services/       # Supabase 클라이언트
│       └── settings.py     # 시크릿 로더
├── database/               # Supabase 스키마·마이그레이션·시드·ERD
├── data/                   # 수동 실행 데이터 수집 스크립트
├── config/                 # 로컬 시크릿 템플릿 (실제 값은 .gitignore)
├── .github/workflows/      # CI / 수동 ingest 워크플로
└── README.md
```

---

## 페이지 구성

| 경로 | 설명 |
|---|---|
| `/` | **홈 = 검색 페이지**. 5개 캐스케이딩 필터(채널 타입/채널명/지역/카테고리/식당명) + 보기 토글(목록/격자/지도). 초기엔 전체 음식점 핀 표시 (서울 중심) |
| `/vote` | 인기 급상승 영상 + 맛집/채널/영상 좋아요 랭킹 |
| `/request` | 사용자 맛집 요청 폼 |
| `/about` | 개발자 소개 + 후원 링크 |
| `/admin` | **admin / superadmin** 만 접근. superadmin: 회원 관리. admin/superadmin: 맛집 입력 |
| `/auth/login` | 로그인 / 회원가입 (이메일+비밀번호 / 카카오 / 네이버 / 구글) |
| `/auth/callback` | OAuth 콜백 |
| `/blocked` | 차단된 계정 안내 (자동 로그아웃) |
| `/restaurants/[id]` | 맛집 상세 — YouTube 임베드 + 외부지도 + 공유바 |

헤더 좌측 로고는 마우스오버 시 흰색 ↔ 파란 로고로 전환되고, admin/superadmin 으로 로그인하면 우측 탭에 'DB 관리' 가 나타납니다.

---

## 빠른 시작 (5분)

### 0. 사전 요구사항
- Node.js 20+ · Python 3.12+
- Supabase 프로젝트 1개 ([supabase.com](https://supabase.com))
- 카카오 JavaScript 키 ([developers.kakao.com](https://developers.kakao.com)) — 지도 표시 필수

### 1. 시크릿 파일 만들기
```bash
cp config/secrets.example.json config/secrets.json
# 에디터로 열어 값 채우기 (이 파일은 .gitignore 처리됨)
```
필요한 키 (자세한 설명은 §시크릿 관리):
- `supabase.url` / `supabase.anon_key` / `supabase.service_role_key`
- `kakao.javascript_key`
- `admin.signup_id` / `admin.signup_password` (관리자 회원가입 시크릿)

### 2. Supabase 스키마 적용
Supabase Dashboard → **SQL Editor** → `database/schema.sql` 전체 붙여넣고 Run.
> ⚠️ 스키마는 모든 객체를 DROP CASCADE 후 재생성합니다. 운영 데이터가 있다면 백업하세요.

(선택) `database/seed.sql` 실행 — 채널 8 / 음식점 120 / appearances ~200건의 더미 데이터 주입.

### 3. FastAPI 실행
```bash
cd app/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../..
uvicorn app.api.main:app --reload   # http://localhost:8000/docs
```

### 4. Next.js 실행
```bash
cd app/web
cp .env.local.example .env.local    # 값 채우기
npm install
npm run dev                          # http://localhost:3000
```

`.env.local` 키:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (또는 신형 Publishable key 도 동일하게 사용 가능)
- `NEXT_PUBLIC_KAKAO_JS_KEY`
- `NEXT_PUBLIC_API_BASE_URL` (= `http://localhost:8000`)

### 5. 자기 자신을 superadmin 으로 지정
회원가입 1회 후 SQL Editor:
```sql
update public.users set role = 'superadmin' where email = 'your@email.com';
```
이후 헤더에 'DB 관리' 탭이 나타나고, /admin 에서 다른 사용자 권한도 GUI 로 변경 가능.

### 6. (선택) 데이터 수집 스크립트
```bash
cd data
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py --dry-run             # 추출/정규화만
python main.py --commit              # Supabase upsert
```

---

## 데이터베이스

### 핵심 테이블
| 테이블 | 역할 |
|---|---|
| `users` | 자체 회원 테이블. `email` 유니크, `role` enum(superadmin/admin/user), `charge_channel TEXT[]`, `is_blocked`, `password_hash`(OAuth 사용자는 NULL), `last_login_at`, soft delete |
| `channels` | 방송/유튜브/블로그 채널. `thumbnail_url` 은 지도 핀 표시용 |
| `restaurants` | 맛집 마스터. `(current_name, current_address)` 유니크 |
| `appearances` | 음식점 ↔ 채널 N:M, 영상 단위. `youtube_video_id` / `thumbnail_url` 포함 |
| `votes` | 좋아요/싫어요 polymorphic — `target_type` ∈ {restaurant, channel, appearance} |

### 집계 뷰
- `v_restaurant_score` / `v_channel_score` / `v_appearance_score` — 좋아요/싫어요/순점수
- `v_top2_appearances` — 음식점별 좋아요 최다 영상 2개 (동률은 최신순)
- `v_trending_appearances` — 인기 급상승. **로직**: `trend_score = 3 × 최근7일 좋아요 + (전체 좋아요 - 최근7일 좋아요)` — 새로 뜨는 영상이 누적 영상보다 빠르게 위로 올라옴

### RLS
- 읽기: 모두 공개
- `users` 본인 row 또는 superadmin 만 읽기/수정
- `channels`/`restaurants`/`appearances` 쓰기: admin/superadmin 만
- `votes` 쓰기: 자기 user_id 로만 1회 (UPSERT 로 갱신 가능)

ERD: **[database/ERD.md](database/ERD.md)** (구버전 기준 — 신규 v_top2_appearances/v_trending_appearances 미반영)

### 마이그레이션 파일
- `database/schema.sql` — 항상 최신 전체 스키마 (DROP CASCADE + CREATE)
- `database/migrations/0001_init.sql` — v1 (구버전 profiles 기반, 참고용)
- `database/migrations/0002_username.sql` — v1 → username 컬럼 추가
- `database/migrations/0003_full_reset.sql` — v1 → v2 완전 재구성 (= schema.sql)

---

## 인증 / 권한

### 회원가입 흐름
**페이지**: `/auth/login` → 회원가입 탭

| 필드 | 비고 |
|---|---|
| 닉네임 | profiles 표시 이름 |
| 이메일 | **로그인 식별자**. unique. |
| 비밀번호 | 6자 이상 — Supabase Auth 가 **bcrypt** 로 안전 저장 |
| 비밀번호 확인 | 일치 검증 |
| 관리자 가입 ☑ (선택) | 펼치면 `관리자 ID/PW` 입력. `config/secrets.json` 의 `admin.signup_id`/`admin.signup_password` 와 일치하면 즉시 `role=admin` 부여 |

> 별도 username/id 입력 칸은 없습니다 (이메일이 곧 ID).

### 로그인
- 이메일 + 비밀번호
- 또는 OAuth: 카카오 / 네이버 / 구글 (각각 회사 공식 로고 인라인 SVG)

### 차단 (Block)
- superadmin 이 `/admin` → 회원 목록에서 **차단** 버튼 클릭 → `users.is_blocked = true`
- 차단된 사용자가 로그인 또는 페이지 접근 시 `useMe` hook 이 자동으로 `/blocked` 로 리다이렉트하고 세션 로그아웃

### OAuth Provider 설정 (Supabase Dashboard)
- **Google**: 기본 제공. Google Cloud Console → OAuth 2.0 Client ID → Supabase 에 Client ID/Secret 등록
- **Kakao**: 기본 제공. Kakao Developers → 앱 생성 → REST API 키 + Redirect URI 등록
- **Naver**: 기본 미지원. **Custom OAuth** 설정 필요
  1. [네이버 개발자 센터](https://developers.naver.com/apps/) 에서 "네이버 아이디로 로그인" 앱 등록
  2. Supabase → Auth → Providers → Custom 에 등록
     - Authorize: `https://nid.naver.com/oauth2.0/authorize`
     - Token: `https://nid.naver.com/oauth2.0/token`
     - User Info: `https://openapi.naver.com/v1/nid/me`
  3. Provider 이름 `naver` 로 설정

Redirect URL: `http://localhost:3000/auth/callback` (로컬), `https://<도메인>/auth/callback` (운영)

### Supabase 이메일 인증 끄기 (로컬 테스트 편의)
Dashboard → Authentication → Providers → **Email** → **Confirm email** 토글 해제. 운영에서는 켜두세요.

---

## 배포

### Vercel (Next.js)
1. GitHub 저장소 Import
2. **Root Directory** = `app/web`
3. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_KAKAO_JS_KEY`, `NEXT_PUBLIC_API_BASE_URL`
4. Deploy

### FastAPI
외부 API 호출이 많아 **Fly.io / Railway / Render** 같은 상시 실행 환경 권장.
실행 명령: `uvicorn app.api.main:app --host 0.0.0.0 --port $PORT`

### GitHub Actions
- `.github/workflows/web-deploy.yml` — PR/main push 시 Next.js 타입체크+빌드
- `.github/workflows/data-ingest.yml` — workflow_dispatch 수동 트리거 데이터 수집

---

## 시크릿 관리 규칙

| 위치 | 목적 | Git 추적 |
|---|---|---|
| `config/secrets.example.json` | 키 **이름** 템플릿 | ✅ |
| `config/secrets.json` | 로컬 실제 값 | ❌ |
| `app/web/.env.local` | Next.js 로컬 env | ❌ |
| **Vercel** Env Vars | Next.js 운영 값 | — |
| **Supabase** Project Settings → API | URL · anon · service_role | — |
| **GitHub** Settings → Secrets | Actions 에서 사용 | — |

`config/secrets.json` 키 구조:
```json
{
  "supabase":     { "url": "...", "anon_key": "...", "service_role_key": "..." },
  "naver":        { "client_id": "...", "client_secret": "..." },
  "kakao":        { "rest_api_key": "...", "javascript_key": "..." },
  "google_oauth": { "client_id": "...", "client_secret": "..." },
  "admin":        { "email": "...", "signup_id": "...", "signup_password": "..." }
}
```

> **service_role_key** 와 **admin.signup_*** 는 절대 브라우저 코드/Vercel public env 에 넣지 마세요. FastAPI 서버 환경에만 보관.

환경변수가 있으면 환경변수가 우선, 없으면 `config/secrets.json` 으로 fallback. 로더는 `app/api/settings.py` 와 `data/utils/config.py`.

---

## 주요 API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET  | `/restaurants` | 필터 조회 (sido/sigungu/cuisine/channel_id/channel_type/q) |
| GET  | `/restaurants/top` | 좋아요 최다 N개 |
| GET  | `/restaurants/{id}` | 단건 |
| GET  | `/restaurants/{id}/top-appearance` | 대표 영상 1개 |
| GET  | `/restaurants/{id}/top-appearances` | 좋아요 최다 영상 2개 (동률은 최신순) |
| POST | `/restaurants` | admin/superadmin 만. admin 은 charge_channel 내 채널만 |
| GET  | `/channels` | 전체 채널 |
| GET  | `/channels/ranking` | 채널 좋아요 랭킹 |
| GET  | `/channels/appearances/ranking` | 영상 좋아요 랭킹 |
| GET  | `/channels/appearances/trending` | 인기 급상승 영상 |
| POST | `/votes` | 좋아요/싫어요 (요청 본문 target_type/target_id/value) |
| GET  | `/auth/me` | 현재 로그인 사용자 (public.users row) |
| POST | `/auth/grant-admin` | admin id/pw 시크릿 검증 후 권한 격상 |
| GET  | `/users` | superadmin 만. 페이지네이션 + email/nickname 검색 |
| PATCH| `/users/{seq}` | superadmin 만. role/charge_channel/is_blocked/nickname 수정 |
| GET  | `/healthz` | 헬스체크 |

상세 스펙: `http://localhost:8000/docs` (Swagger UI)

---

## 개발 원칙

- **함수형 지향** — 순수 함수 위주, 사이드이펙트는 라우터·`load.py`·클라이언트 경계에만
- **가독성 > 영리함** — 1인 개발자가 3개월 뒤 다시 읽어도 이해되는 코드
- **최소 의존성** — 지금 당장 쓰지 않을 라이브러리는 추가하지 않음

---

## 알려진 제약 / 향후 정비 포인트

1. **카카오톡 공유 SDK 미연동** — 현재 Web Share API 폴백 + 링크 복사. 정식 연동은 [Kakao SDK JS](https://developers.kakao.com/docs/latest/ko/message/js-link) 추가 필요
2. **네이버 Place API 자동 조회** — 현재는 URL/place_id 만 저장. 표시 시점 실시간 조회는 후속 작업
3. **첫 superadmin** 은 SQL 직접 실행으로 지정 (자기 권한 격상 UI 는 보안상 의도적으로 미제공)
4. **위키 파서** — `data/sources/wiki.py` 의 `parse_restaurants()` 는 페이지별 구조에 맞춰 커스터마이징 필요. 현재는 일반 wikitable 만 추출

---

## 라이선스
MIT (기본값 — 필요 시 교체).
