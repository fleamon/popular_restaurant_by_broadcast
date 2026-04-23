# 백안맛지도 (Baekahn Matjido)

대한민국에서 가장 가독성 좋은 **전국 방송 맛집 지도** 웹앱.
TV·YouTube·블로그에 소개된 맛집을 지도 한 장으로 훑어보고, 좋아요/싫어요로 랭킹을 만들어갑니다.

- 브랜드 컬러: `#2B7FFF` (로고 배경 파랑)
- 스택: **Next.js 14**(App Router) + **FastAPI** + **Supabase** + **Vercel**
- 1인 개발자 친화 — 모노레포 · 함수형 지향 · 최소 설정

---

## 저장소 구조 (모노레포)

```
popular_restaurant_by_broadcast/
├── app/
│   ├── web/            # Next.js (Vercel 배포 대상)
│   └── api/            # FastAPI (REST API)
├── database/           # Supabase 스키마·마이그레이션·ERD
├── data/               # 수동 실행형 데이터 수집 스크립트
├── config/             # 로컬 시크릿 템플릿 (실제 값은 .gitignore)
├── .github/workflows/  # CI / 수동 ingest 워크플로
└── README.md
```

데이터베이스·데이터·앱 세 갈래를 유지하되, FastAPI 는 앱과 한 런타임 스택으로 묶어 `app/` 아래 둡니다.

---

## 주요 기능

| 탭 | 설명 |
|---|---|
| 홈 `/` | 전국 지도 + 좋아요 Top 맛집 핀 하이라이트 |
| 검색 `/search` | 시/도·시/군/구 · 채널(TV/YouTube) · 가게명 like 필터 |
| 투표 `/vote` | 맛집·채널별 좋아요/싫어요 랭킹 (아이디당 1회) |
| 소개 `/about` | 개발자 소개 + 후원 링크(커피/토스/카카오페이) |
| DB 관리 `/admin` | admin 계정만 노출. channels / restaurants / appearances CRUD |

헤더 좌측 로고는 마우스오버 시 흰색 로고 ↔ 파란 로고로 자연스럽게 전환됩니다.

---

## 로컬 실행 (3분 셋업)

### 0. 사전 요구사항
- Node.js 20+
- Python 3.12+
- Supabase 프로젝트 1개 ([supabase.com](https://supabase.com))
- (선택) 카카오 JavaScript Key — 지도 표시용. [developers.kakao.com](https://developers.kakao.com)

### 1. 시크릿 파일 만들기
```bash
cp config/secrets.example.json config/secrets.json
# 에디터로 열어 값 채우기 (이 파일은 .gitignore 처리됨)
```

### 2. Supabase 스키마 적용
Supabase Dashboard → **SQL Editor** → `database/schema.sql` 전체 붙여넣기 후 실행.
(선택) `database/seed.sql` 을 실행해 데모 데이터 주입.

### 3. FastAPI 실행
```bash
cd app/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../..                           # repo 루트로
uvicorn app.api.main:app --reload  # http://localhost:8000/docs
```

### 4. Next.js 실행
```bash
cd app/web
cp .env.local.example .env.local   # 값 채우기
npm install
npm run dev                        # http://localhost:3000
```

### 5. (선택) 데이터 수집 스크립트
```bash
cd data
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py --dry-run           # 추출·정규화까지만
python main.py --commit            # Supabase 에 upsert
```

---

## 데이터베이스

- 모든 테이블 첫 컬럼은 `id bigserial` (auto increment)
- 한글·이모지 완전 지원 (UTF-8)
- 핵심 테이블: `channels`, `restaurants`, `appearances`, `profiles`, `votes`
- 집계 뷰: `v_restaurant_score`, `v_channel_score`, `v_top_representative_appearance`
- RLS 활성화: 읽기 공개, 쓰기는 admin(`profiles.is_admin`) 또는 service_role 만 가능

관계도와 컬럼 설명은 **[database/ERD.md](database/ERD.md)** 참고.

### 나를 admin 으로 지정
Supabase SQL Editor 에서 최초 로그인 이후 1회 실행:
```sql
update public.profiles p set is_admin = true
  from auth.users u
 where p.id = u.id and u.email = 'your@email.com';
```

---

## OAuth (카카오 / 네이버 / 구글)

Supabase Dashboard → **Authentication → Providers** 에서 각 provider 활성화.

- **Google**: Supabase 기본 제공. Google Cloud Console → OAuth 2.0 Client ID 생성 → Client ID/Secret 입력 → Redirect URL 을 Supabase 에 등록된 값으로 설정.
- **Kakao**: Supabase 기본 제공. [Kakao Developers](https://developers.kakao.com) 에서 앱 생성 → REST API 키 + Redirect URI 등록.
- **Naver**: Supabase 기본 제공 아님. **Custom OAuth** 로 구성 필요.
  1. [네이버 개발자 센터](https://developers.naver.com/apps/) 에서 "네이버 아이디로 로그인" 앱 등록.
  2. Supabase → Authentication → Providers → Custom(OIDC/OAuth) 로 Naver 엔드포인트 등록
     - Authorize URL: `https://nid.naver.com/oauth2.0/authorize`
     - Token URL: `https://nid.naver.com/oauth2.0/token`
     - User Info URL: `https://openapi.naver.com/v1/nid/me`
  3. Provider 이름을 `naver` 로 설정 → 프론트에서 `signInWithOAuth({ provider: 'naver' })` 동일 흐름.

Redirect URL 예시:
- 로컬: `http://localhost:3000/auth/callback`
- 운영: `https://<your-domain>/auth/callback`

---

## 배포 (Vercel + Supabase)

### Vercel (프론트)
1. GitHub 저장소를 Vercel 에 Import.
2. **Root Directory** 를 `app/web` 으로 지정.
3. **Environment Variables** 등록:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_KAKAO_JS_KEY`
   - `NEXT_PUBLIC_API_BASE_URL` (FastAPI 배포 URL)
4. Deploy.

### FastAPI 배포
Vercel Python 함수로도 가능하지만, 외부 API 호출이 많아 **Fly.io / Railway / Render** 같은 상시 실행 환경을 추천합니다. `uvicorn app.api.main:app --host 0.0.0.0 --port $PORT` 로 실행.

### GitHub Actions
- `.github/workflows/web-deploy.yml` — PR/main push 시 Next.js 타입체크+빌드.
- `.github/workflows/data-ingest.yml` — 수동 트리거(workflow_dispatch)로 데이터 수집. Repo Secrets 등록 필요.

---

## 시크릿 관리 규칙

| 위치 | 목적 | Git 추적 |
|---|---|---|
| `config/secrets.example.json` | 키 **이름**만 (템플릿) | ✅ |
| `config/secrets.json` | 로컬 실제 값 | ❌ (`.gitignore`) |
| `app/web/.env.local` | Next.js 로컬 환경변수 | ❌ (`.gitignore`) |
| **Vercel** Env Vars | Next.js 운영 값 | — |
| **Supabase** Project Settings → API | SUPABASE_URL, keys | — |
| **GitHub** Settings → Secrets | Actions 에서 사용 | — |

환경변수가 있으면 환경변수가 우선, 없으면 `config/secrets.json` fallback — 로더는 `app/api/settings.py` 와 `data/utils/config.py` 에 있습니다.

---

## 개발 원칙

- **함수형 지향**: 순수 함수 위주, 사이드이펙트는 라우터·`load.py`·클라이언트 경계에만.
- **가독성 > 영리함**: 1인 개발자가 3개월 뒤 다시 읽어도 이해되는 코드.
- **최소 의존성**: 지금 당장 쓰지 않을 라이브러리는 추가하지 않음.

---

## 라이선스
MIT (기본값 — 필요 시 교체).
