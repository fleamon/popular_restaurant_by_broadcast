# 백안맛지도 — ERD

```mermaid
erDiagram
    channels ||--o{ appearances : "1:N"
    restaurants ||--o{ appearances : "1:N"
    profiles ||--o{ votes : "1:N"
    restaurants ||..o{ votes : "target_type='restaurant'"
    channels    ||..o{ votes : "target_type='channel'"
    appearances ||..o{ votes : "target_type='appearance'"

    channels {
        bigserial id PK
        text name UK
        text channel_type  "tv/youtube/blog/other"
        text platform
        text wiki_url
        text thumbnail_url
        timestamptz created_at
        timestamptz updated_at
    }

    restaurants {
        bigserial id PK
        text current_name
        text previous_name
        text current_address
        text previous_address
        text cuisine
        text sido
        text sigungu
        text dong
        double lat
        double lng
        text naver_map_url
        text kakao_map_url
        numeric naver_rating
        numeric kakao_rating
        text phone
        text price_range
        bool is_closed
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    appearances {
        bigserial id PK
        bigint restaurant_id FK
        bigint channel_id FK
        date aired_at
        text episode_title
        text source_url
        text summary
        timestamptz created_at
    }

    profiles {
        uuid id PK "auth.users.id"
        text nickname
        text avatar_url
        bool is_admin
        timestamptz created_at
    }

    votes {
        bigserial id PK
        uuid user_id FK
        text target_type "restaurant/channel/appearance"
        bigint target_id
        smallint value "1=좋아요 / -1=싫어요"
        timestamptz created_at
    }
```

## 주요 제약
- `restaurants(current_name, current_address)` UNIQUE — 같은 가게 중복 수집 방지
- `votes(user_id, target_type, target_id)` UNIQUE — 아이디별 대상당 1회
- `votes.value` CHECK (1, -1) — 좋아요/싫어요 2진 투표

## 뷰
- `v_restaurant_score` — 맛집별 좋아요/싫어요/순점수
- `v_channel_score` — 채널별 좋아요/싫어요/순점수
- `v_top_representative_appearance` — 맛집의 "대표 방송 회차"(좋아요 최다 1개)
