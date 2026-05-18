# 백안맛지도 (Baekahn Matjido)

대한민국 **방송·유튜브 맛집 지도 웹앱** — 화면에 들어오는 영역의 식당을 한 장의 지도로 훑어보고, 좋아요/싫어요로 랭킹을 만들어갑니다.

- 브랜드 컬러: `#2B7FFF` · 본문 텍스트 강조: `#2C42A3`
- 스택: **Next.js 16**(App Router · Turbopack) + **FastAPI** + **Supabase** + **OpenAI** + **YouTube/Kakao/Naver API**
- 1인 개발자 친화 — 모노레포 · 함수형 지향 · 최소 설정

---

## 📁 저장소 구조

```
popular_restaurant_by_broadcast/
├── app/
│   ├── web/                # Next.js (Vercel 배포 대상)
│   │   ├── public/         # 로고/아이콘 + 후원 QR (tome.jpeg 등)
│   │   └── src/
│   │       ├── app/        # App Router (page.tsx = 라우트)
│   │       ├── components/ # Map, NavTabs, VoteButton, VotePeriodCompare, DonationSection, admin/* ...
│   │       └── lib/        # api / supabase / me / role / geocode / kakao-share / auth
│   └── api/                # FastAPI (REST + SSE)
│       ├── routers/        # restaurants / channels / requests / votes / admin / auth / users
│       ├── services/       # supabase / kakao_geo / naver_match / youtube_api / openai_extract / ingest_channel
│       ├── deps.py         # 인증 의존성 (require_user / require_admin / require_superadmin)
│       ├── utils.py        # 공용 유틸 (norm_channel — 채널명 공백제거 비교)
│       ├── settings.py     # 시크릿 로더 (환경변수 우선 → config/secrets.json)
│       └── main.py
├── database/
│   ├── schema.sql          # 전체 스키마 (한 번에 실행 — 최신 상태)
│   └── migrations/         # 0001 ~ 누적 마이그레이션 (운영 DB 증분 적용)
├── data/                   # 콘솔용 일회성/배치 스크립트
│   ├── ingest_channels.py        # YouTube 채널 자동 수집 (CLI 진입점)
│   ├── seed_channel_thumbnails.py
│   ├── seed_naver_places.py
│   └── utils/                    # get_config / get_logger
├── config/
│   ├── secrets.example.json
│   └── secrets.json        # .gitignore (로컬 전용)
└── README.md
```

---

## 🚀 페이지 구성

| 경로 | 설명 |
|---|---|
| `/` | **검색 (홈)**. 채널 타입/채널명/시도/시군구/동/카테고리/이름 필터 + 지도·목록·격자 보기 + 카카오톡 공유 |
| `/vote` | 투표 규칙 안내 · 인기 급상승 영상 · 맛집/채널/영상 랭킹 · **기간별 투표 조회·비교** |
| `/request` | 요청 게시판 — 채널 추가요청 / 관리자 요청 / 버그 / 기타 / 공지사항 |
| `/about` | 사이트 소개 + 후원 (토스 QR 모달) — 검색·요청 탭으로 바로 가는 inline 링크 포함 |
| `/admin` | **admin / superadmin** 전용. 회원·채널 관리, 좌표 보정, 채널 자동 수집, **맛집/영상 통합 관리** (입력·수정·삭제), **수정/삭제 요청 승인** (superadmin) |
| `/auth/login` | 이메일+비밀번호 / 카카오 / 네이버 / 구글 로그인·회원가입 |
| `/auth/callback` | OAuth 콜백 |
| `/blocked` | 차단 계정 안내 |
| `/restaurants/[id]` | 맛집 상세 — YouTube 임베드, 네이버 plate 정보, 영상·채널·식당 투표 |

---

## 🔍 검색 동작 (`/`)

- 채널명 / 시도 / 시군구 / 동읍면 — `<datalist>` 자동완성. 타이핑 중에는 옵션 부분일치 dropdown 만 보이고,
  **옵션과 정확 일치하거나 비어있을 때만** 백엔드 fetch 가 트리거 → 타자 중 지도 핀이 흔들리지 않음.
- 백엔드는 sido/sigungu/dong/channel_name 에 대해 `ilike '%v%'` 부분일치 지원.
- 모든 필터 상태가 URL 쿼리스트링에 기록 (`ct`/`cn`/`sido`/`sigungu`/`dong`/`cuisine`/`q`) → 카카오 공유 한 장으로 그대로 복원.

## 🗳 투표 규칙

- 한 아이디는 **하루(KST 자정 기준) 에 맛집·채널·영상 각 1회씩** 좋아요/싫어요 투표 가능.
- 같은 날 안에서: 같은 버튼 재클릭 = 오늘 분 취소 · 반대 버튼 = 오늘 분 전환.
- 어제 이전 표는 그대로 누적 — 매일 한 표씩 쌓이는 구조. 집계 뷰가 누적 합산.
- DB 무결성: `votes` 테이블에 `vote_date date GENERATED` (KST) + `UNIQUE(user_id, target_type, target_id, vote_date)`.
- 랭킹 정렬: `likes desc` → `dislikes asc` → `id desc` (모든 랭킹 동일).
- `/vote` 하단 **기간별 조회** — 대상(맛집·채널·영상) + 기간 지정 → 그 사이에 받은 좋아요/싫어요 합산. 누적해서 비교.

## 🛠 맛집/영상 통합 관리 (`/admin`)

- 한 화면에서 **신규 입력 + 수정 + 삭제** 모두 처리.
- admin 로그인 시 `charge_channel` 1개면 자동 선택, 여러 개면 첫 번째 자동 선택.
- 가게 이름 input 이 datalist — 옵션과 정확 일치 시 그 영상의 기존 값으로 폼 populate(수정 모드), 일치 안 하면 신규 모드.
- **admin**: 신규는 즉시 등록, 수정·삭제는 superadmin 에게 요청 (payload 에 변경 전/후 둘 다 스냅샷).
- **superadmin**: 모두 즉시 적용. 추가로 `/admin` 의 **맛집/영상 수정·삭제 요청** 패널에서 admin 요청을 한 화면에서 승인/반려.
- 수정 요청 비교 UI: 4열 표 (구분 · 필드 · 변경 전 · → · 변경 후), 변경 전 = 회색 + 취소선, 변경 후 = 굵은 초록.

## 🔐 권한 모델

| Role | 권한 |
|---|---|
| `user` | 검색·투표·요청 작성, 자기 요청 글 삭제 |
| `admin` | + 자기 `charge_channel` 채널 맛집 신규 입력. 그 채널 영상의 수정·삭제는 superadmin 에게 요청 |
| `superadmin` | + 회원/채널 관리, 좌표 보정, 채널 자동 수집, 공지사항 작성, 요청 다중 삭제, 채널 권한 부여, **맛집/영상 즉시 수정·삭제, 수정·삭제 요청 승인/반려** |

회원가입 직후 기본 role 은 `user`. `/admin` → 회원 관리에서 superadmin 이 승격하거나, 관리자 요청글에서 **✅ 채널 권한 부여** 클릭 시 자동으로 `admin` + charge_channel 부여.

---

# 🛠 로컬 개발 환경 셋업

### 사전 준비

- **Node.js** 20 이상 (`node -v`)
- **Python** 3.12 이상 (`python3.12 -v`)
- **Git**

### 1) 클론

```bash
git clone https://github.com/<your-org>/popular_restaurant_by_broadcast.git
cd popular_restaurant_by_broadcast
```

### 2) 의존성 설치

```bash
# 백엔드
python3.12 -m venv venv
source venv/bin/activate
pip install -r app/api/requirements.txt
pip install -r data/requirements.txt   # 콘솔 스크립트용 (선택)

# 프론트엔드
cd app/web && npm install && cd -
```

### 3) 시크릿 작성

```bash
cp config/secrets.example.json config/secrets.json
# 에디터로 열어 supabase / kakao / naver / openai / youtube 값 채우기
```

`config/secrets.json` 예시:

```json
{
  "supabase":     { "url": "https://xxx.supabase.co", "anon_key": "eyJ...", "service_role_key": "eyJ..." },
  "kakao":        { "rest_api_key": "...", "javascript_key": "..." },
  "naver":        { "client_id": "...", "client_secret": "..." },
  "openai":       { "api_key": "sk-...", "model": "gpt-4o-mini" },
  "youtube":      { "api_key": "AIza..." },
  "google_oauth": { "client_id": "", "client_secret": "" },
  "admin":        { "email": "", "signup_id": "", "signup_password": "" }
}
```

각 키 발급처:

| 키 | 발급 |
|---|---|
| `supabase.*` | https://supabase.com → 프로젝트 → Settings → API |
| `kakao.rest_api_key` / `javascript_key` | https://developers.kakao.com → 내 애플리케이션 |
| `naver.client_id` / `client_secret` | https://developers.naver.com → 애플리케이션 등록 (검색 API) |
| `openai.api_key` | https://platform.openai.com/api-keys |
| `youtube.api_key` | https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보 → YouTube Data API v3 활성화 |
| `google_oauth.*` | Google Cloud Console — OAuth 클라이언트 ID |

웹 환경변수 (`app/web/.env.local`):

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_KAKAO_JS_KEY=...

# 후원 (선택 — 비어있으면 후원 섹션 자동 숨김)
NEXT_PUBLIC_TOSS_QR=/tome.jpeg          # public/ 정적 이미지 경로 또는 외부 URL
NEXT_PUBLIC_KAKAOPAY_URL=https://qr.kakaopay.com/...
```

> `config/secrets.json`, `.env.local` 모두 `.gitignore` 처리되어 있어 커밋되지 않음.
> 변경 후 dev 서버 재시작 필수 (Next.js 의 `NEXT_PUBLIC_*` 은 빌드 시 inline).

### 4) Supabase 스키마 적용

신규 환경: [Supabase Dashboard](https://supabase.com) → SQL Editor → `database/schema.sql` 통째로 붙여넣고 Run.
운영 중인 DB: `database/migrations/` 의 새 파일만 순서대로 실행.

### 5) 실행

```bash
# 터미널 A — FastAPI
source venv/bin/activate
uvicorn app.api.main:app --reload
# → http://localhost:8000/docs (Swagger)

# 터미널 B — Next.js
cd app/web
npm run dev
# → http://localhost:3000
```

---

# 🗄 Supabase 셋업 (운영) — 단계별

> 무료 플랜으로 시작 가능. 한국 사용자라면 Region 은 `Northeast Asia (Seoul)` 권장.

### 1단계. 프로젝트 생성

1. https://supabase.com 가입 → 우측 상단 **New project**
2. Organization 선택 → 프로젝트 이름, DB password 설정
3. Region: **Northeast Asia (Seoul)**
4. Pricing plan: **Free**
5. 생성 후 좌측 **Settings → API** 탭에서 다음 값 복사:
   - `Project URL` → `supabase.url`
   - `anon public` 키 → `supabase.anon_key`
   - `service_role` 키 → `supabase.service_role_key` (절대 노출 X — 백엔드에서만 사용)

### 2단계. 스키마 적용

1. 좌측 **SQL Editor** → New query
2. 이 리포의 `database/schema.sql` 전체 복사 → 붙여넣기 → **Run**
3. 정상 종료되면 좌측 **Table Editor** 에서 `users`, `channels`, `restaurants`, `appearances`, `votes`, `requests` 테이블이 보임
4. `database/migrations/` 의 파일들은 `schema.sql` 에 모두 포함되어 있어 신규 환경에선 따로 실행할 필요 없음. **이미 운영 중인 DB** 만 새 파일을 차례로 실행 (0006 → 0007 → 0008 순서).

### 3단계. 인증 (Auth) Provider 설정

좌측 **Authentication → Providers**:

| Provider | 활성화 방법 |
|---|---|
| **Email** | 토글 On. 이메일 가입 즉시 활성화 원하면 **Confirm email** 옵션 Off |
| **Google** | Google Cloud Console 에서 OAuth Client ID/Secret 생성 → Supabase 의 Google provider 에 입력 |
| **Kakao** | 카카오 Developers 에서 OAuth Client ID/Secret → Supabase 에 입력 |
| **Naver** | Supabase 가 기본 지원 안 함 → **Authentication → Providers → Custom** 으로 추가. authorize/token/userinfo URL 입력 |

### 4단계. URL 등록 (가장 자주 빠지는 단계)

좌측 **Authentication → URL Configuration**:

- **Site URL**: 로컬 `http://localhost:3000` → 운영은 [도메인 운영](#-도메인-운영-가이드) 단계에서 갱신
- **Redirect URLs** (Add URL):
  - `http://localhost:3000/auth/callback`
  - 운영 도메인 등록 후엔: `https://white_eyes_matmap.com/auth/callback`, `https://xn--lo8h64a0d1a13a3lyqd.com/auth/callback` 등 모두 추가

이게 안 되면 OAuth 로그인 후 콜백에서 "redirect_uri_mismatch" 오류.

### 5단계. 첫 superadmin 만들기

1. 앱에서 회원가입 (이메일 또는 OAuth)
2. Supabase SQL Editor 에서:
   ```sql
   UPDATE public.users SET role = 'superadmin' WHERE email = 'you@example.com';
   ```
3. 다시 로그인하면 `/admin` 탭 접근 가능

### 6단계. (선택) 초기 데이터 채우기

`/admin` 의 **채널 자동 수집** 에 YouTube 채널 핸들 입력 (`@sungsikyung` 등) → SSE 로 진행 상황 표시되며 영상 메타 → OpenAI 추출 → Kakao/Naver 매칭 → DB 저장.

또는 콘솔에서 일괄 실행:

```bash
python -m data.ingest_channels --handles "@sungsikyung,@bimirya" --max 100
```

좌표 비어있는 맛집은 `/admin` → **🌏 기존 좌표 일괄 보정** (superadmin only) 으로 한 번에 정리.

---

# 🌐 Vercel 배포 — 단계별

> 모노레포라 root directory 설정이 필수. 못 하면 build 가 root 의 빈 package.json 을 보고 실패.

### 1단계. Vercel 가입 + GitHub 연결

1. https://vercel.com → GitHub 계정으로 가입
2. 첫 진입에서 GitHub 권한 허용 → 이 리포가 자동 노출

### 2단계. New Project

1. Vercel 대시보드 → **Add New → Project**
2. 이 리포 선택 → **Import**
3. 설정 화면에서:
   - **Project Name**: `baekahn-matjido` (자유)
   - **Framework Preset**: Next.js (자동 감지)
   - **Root Directory**: **`app/web`** 로 변경 ⚠️ (Edit 버튼 클릭해서 수정)
   - **Build Command**: 자동 (`next build`)
   - **Output Directory**: 자동 (`.next`)

### 3단계. Environment Variables 등록

같은 화면 또는 배포 후 **Settings → Environment Variables** 에서 다음 등록 (Production + Preview + Development 모두 체크):

| Name | Value | 비고 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://your-fastapi-host` | FastAPI 배포 호스트. 4단계 참고 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anon public key |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | `...` | 카카오 JavaScript 키 (지도 SDK + 공유) |
| `NEXT_PUBLIC_TOSS_QR` | `/tome.jpeg` | 토스 QR 이미지. 없으면 후원 버튼 자동 숨김 |
| `NEXT_PUBLIC_KAKAOPAY_URL` | `https://qr.kakaopay.com/...` | 카카오페이 송금링크 |

→ **Deploy** 클릭. `https://baekahn-matjido.vercel.app` 같은 임시 도메인이 나옴.

### 4단계. FastAPI 배포 (호스팅 비용 0원 옵션)

Vercel 은 Next.js 만 서빙. FastAPI 는 별도 호스트 필요. 모두 무료 옵션:

#### 옵션 A — Render Free Tier (가장 단순, 추천)

> 15분 idle 시 sleep → 첫 요청에 ~30초 cold start. 트래픽 적은 초기 운영엔 충분.

1. https://render.com → GitHub 가입
2. **New +** → **Web Service** → 이 리포 연결
3. 설정:
   - **Root Directory**: `app/api`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: **Free**
4. **Environment** 탭에서 시크릿 등록:
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   KAKAO_REST_API_KEY=...
   OPENAI_API_KEY=sk-...
   YOUTUBE_API_KEY=AIza...
   NAVER_CLIENT_ID=...
   NAVER_CLIENT_SECRET=...
   ADMIN_EMAIL=you@example.com
   ```
5. Deploy → URL 받음 (예: `https://baekahn-matjido-api.onrender.com`)
6. Vercel 의 `NEXT_PUBLIC_API_BASE_URL` 을 이 URL 로 갱신 → Vercel에서 **Redeploy**
7. 헬스체크: `curl https://baekahn-matjido-api.onrender.com/healthz` → `{"ok": true}`

#### 옵션 B — Cloudflare Tunnel + 자체 PC (sleep 없음, 전기료만)

집에 항상 켜둘 PC/맥미니/라즈베리파이 있을 때.

1. `flyctl auth login` 대신 https://dash.cloudflare.com → Zero Trust → Networks → Tunnels → Create
2. 터널 이름 부여 → connector 설치 명령 복사 → 자체 PC 에서 실행
3. Tunnel routes 에 hostname (예: `api.white_eyes_matmap.com`) → Service `http://localhost:8000`
4. 자체 PC 에서 `uvicorn app.api.main:app --host 0.0.0.0 --port 8000` 항상 실행 (systemd / launchd / pm2)
5. Vercel 의 `NEXT_PUBLIC_API_BASE_URL` = `https://api.white_eyes_matmap.com`

> Cloudflare Tunnel 은 완전 무료. 트래픽 제한 사실상 없음. PC 가 꺼지면 API 불가 — 데스크탑/홈서버 24h 가능 환경에서 추천.

### 5단계. 외부 콘솔에 운영 도메인 등록

(다음 [도메인 운영](#-도메인-운영-가이드) 섹션 마치고 와서 적용)

| 콘솔 | 등록 위치 | 등록 값 |
|---|---|---|
| **Kakao Developers** | 내 애플리케이션 → 플랫폼 → **Web** → 사이트 도메인 | `https://white_eyes_matmap.com`, `https://xn--lo8h64a0d1a13a3lyqd.com` 둘 다 추가 |
| **Kakao Developers** | 카카오 로그인 → Redirect URI | `https://xxx.supabase.co/auth/v1/callback` |
| **Naver Developers** | 애플리케이션 → API 설정 → 웹 서비스 URL | 두 도메인 모두 |
| **Google Cloud Console** | OAuth 클라이언트 → 승인된 자바스크립트 출처 / 리디렉션 URI | 두 도메인 + Supabase callback URL |
| **Supabase** | Authentication → URL Configuration | Site URL = 주 도메인, Redirect URLs 에 두 도메인의 `/auth/callback` 모두 추가 |

---

# 🌍 도메인 운영 가이드

> 이 프로젝트는 **`white_eyes_matmap.com`** (영문) + **`백안맛지도.com`** (한글 IDN) 두 도메인으로 운영.
> 한글 도메인은 Punycode 로 `xn--lo8h64a0d1a13a3lyqd.com` 로 표기됨 — 브라우저 주소창에는 한글 그대로 보임.

## 비용 구조 (호스팅 0원, 도메인만)

| 항목 | 비용 | 비고 |
|---|---|---|
| Vercel (웹) | 0원 | Free Plan, 100GB 월 트래픽 |
| Supabase (DB + Auth) | 0원 | Free Plan, 500MB DB |
| Render (API) | 0원 | Free Tier, 15분 idle sleep |
| `white_eyes_matmap.com` | 약 **15,000원/년** | .com 일반 가격 |
| `백안맛지도.com` | 약 **15,000원/년** | IDN .com 동일 가격 |
| **총** | **약 30,000원/년** | 도메인만 |

## 1단계. 도메인 등록

### 영문 도메인 — `white_eyes_matmap.com`

**옵션 1: Porkbun** (영문, 카드결제, 약 $11/년 ≈ 15,000원)

1. https://porkbun.com → Sign up
2. 검색창에 `white_eyes_matmap.com` → Add to cart
3. WHOIS Privacy: **무료** 자동 적용
4. Auto-renew: ON (도메인 만료 방지)
5. 결제 (해외 카드 또는 PayPal)

**옵션 2: 가비아** (한국, 한국 카드/계좌, 약 17,000원/년)

1. https://www.gabia.com → 도메인 검색
2. `white_eyes_matmap.com` 등록 → 가입 → 결제
3. WHOIS 보호 설정

### 한글 도메인 — `백안맛지도.com`

**가비아 추천** — 한글 입력 인터페이스로 등록 편리:

1. https://www.gabia.com 도메인 검색창에 직접 `백안맛지도.com` 입력 → 검색
2. 표시되는 Punycode (`xn--lo8h64a0d1a13a3lyqd.com`) 확인 후 등록
3. 결제 (한국 카드/계좌)

> Porkbun 등 영문 등록자에서도 가능. 도메인 입력 시 `xn--lo8h64a0d1a13a3lyqd.com` Punycode 직접 입력 필요.
> Punycode 변환: https://www.punycoder.com 에 `백안맛지도.com` 입력 → 변환 결과 사용.

## 2단계. Vercel 에 도메인 연결

1. Vercel 대시보드 → 프로젝트 선택 → **Settings → Domains**
2. **Add Domain** → `white_eyes_matmap.com` 입력 → Add
   - Vercel 이 표시하는 DNS 레코드 (보통 A 레코드 `76.76.21.21` 또는 nameserver) 메모
3. **Add Domain** → `xn--lo8h64a0d1a13a3lyqd.com` 입력 → Add (한글 도메인도 Punycode 로)
4. (선택) **Redirect** 설정 — 한쪽을 주 도메인으로, 다른 쪽을 redirect 로:
   - 예: `xn--lo8h64a0d1a13a3lyqd.com` → `white_eyes_matmap.com` 으로 301 redirect
   - 또는 둘 다 동일하게 서비스 (canonical 은 SEO 측면 한 쪽 권장)

## 3단계. DNS 레코드 설정

도메인 등록자(가비아/Porkbun) 의 DNS 관리 페이지로 이동.

### A 레코드 방식 (가장 단순)

| Type | Host/Name | Value | TTL |
|---|---|---|---|
| A | `@` (또는 도메인명) | `76.76.21.21` | 자동 |
| CNAME | `www` | `cname.vercel-dns.com` | 자동 |

> Vercel 이 "Configure DNS" 에서 보여주는 정확한 값을 따르세요. 위 IP 는 예시.

### 옵션: Cloudflare DNS 사용 (CDN + 보안 + 분석 무료)

1. https://dash.cloudflare.com → Add a Site → 도메인 입력
2. Cloudflare 가 알려주는 2개의 nameserver 메모
3. 도메인 등록자(가비아/Porkbun) → DNS 관리 → **nameserver 변경** → Cloudflare nameserver 로 교체
4. Cloudflare DNS 에서 A 레코드 → Vercel IP 입력 + Proxy status: **DNS only** (Vercel 이 자체 CDN/SSL 처리하므로 Cloudflare proxy 켜면 충돌 가능)
5. nameserver 전파 ~수시간

> 영문/한글 도메인 둘 다 동일 절차.

## 4단계. SSL 인증서

Vercel 이 자동 발급 (Let's Encrypt). 도메인 추가 후 1-5분 내 자동 활성. 별도 작업 없음.

## 5단계. 운영 도메인을 모든 외부 콘솔에 등록

[Vercel 배포 5단계](#5단계-외부-콘솔에-운영-도메인-등록) 표 참고. **반드시 두 도메인 모두 등록**.

## 6단계. 환경변수 갱신

Vercel Project Settings → Environment Variables 에서 다음 값을 새 도메인으로 갱신:

- (필요 시) `NEXT_PUBLIC_API_BASE_URL` — Cloudflare Tunnel 사용 시 `https://api.white_eyes_matmap.com`

→ **Redeploy** 트리거.

## 7단계. 헬스체크

| 항목 | 확인 방법 |
|---|---|
| 영문 도메인 | `https://white_eyes_matmap.com/about` 정상 렌더, SSL 자물쇠 표시 |
| 한글 도메인 | 브라우저 주소창에 `백안맛지도.com` 입력 → 정상 렌더 |
| API | `https://baekahn-matjido-api.onrender.com/healthz` → `{"ok": true}` |
| 지도 | `/` 진입 후 카카오 지도 로드. 회색이면 Kakao 콘솔에 도메인 등록 누락 |
| 로그인 | `/auth/login` → OAuth 로그인 콜백 성공 (두 도메인 모두) |
| 검색 | 시도/시군구 datalist 자동완성 + 옵션 선택 시 핀 갱신 |
| 투표 | 로그인 후 좋아요 클릭, 같은 버튼 재클릭 시 취소 (KST 자정 갱신) |

---

## 🔧 운영 후 주기적 관리

- **Vercel** 은 main 브랜치 push 시 자동 재배포. PR 은 Preview 환경 자동 생성.
- **Render Free** 는 main push 시 자동 재배포 (sleep 모드 유지). 트래픽 늘면 유료 플랜 고려 ($7/월부터).
- DB 스키마 변경: 새 마이그레이션 파일을 `database/migrations/000N_*.sql` 로 추가 → Supabase SQL Editor 에서 실행 → 코드 push.
- 도메인 만료 알림: 등록자 계정의 auto-renew **반드시 ON**.

---

## 📜 콘솔 스크립트

| 스크립트 | 설명 |
|---|---|
| `python -m data.ingest_channels --handles "@sungsikyung,@bimirya" --max 100` | YouTube 채널 자동 수집 — 영상 메타 + OpenAI 추출 + Kakao/Naver 매칭 → DB |
| `python -m data.seed_channel_thumbnails` | 채널 썸네일 일괄 보정 |
| `python -m data.seed_naver_places --sleep 0.3` | 기존 식당의 naver_place_id 일괄 매칭 |

---

## 🧪 검증

PR 보내실 때 다음을 통과시켜 주세요:

```bash
# TypeScript 타입 + 미사용 변수 체크
cd app/web && npx tsc --noEmit --noUnusedLocals --noUnusedParameters

# Python 문법 sanity
python3 -c "import ast, glob; [ast.parse(open(f).read()) for f in glob.glob('app/api/**/*.py', recursive=True)]"
```

UI 변경은 `npm run dev` 로 띄워서 직접 클릭/탭 전환 확인.

---

## 🤝 기여

- 이슈 환영. 데이터 정확도 보강 PR (가게 이름·주소·channel handle 등) 환영합니다.
- 권한이 필요한 작업(채널 추가/관리)은 `/request` 의 **관리자 요청** 으로 superadmin 에게 권한 부여를 받을 수 있습니다.
