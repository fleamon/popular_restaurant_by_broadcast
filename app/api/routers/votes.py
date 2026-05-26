"""좋아요/싫어요 투표 — 음식점/채널/영상 모두 동일 모델.

규칙:
- user 당 (target_type, target_id) **하루 1회** (KST 기준).
- 같은 값 재클릭 → 오늘 분 취소(DELETE). 반대 값 클릭 → 오늘 분 갱신(UPDATE). 없으면 신규(INSERT).
- 어제 이전 분은 그대로 누적 — 매일 한 표씩 쌓이는 구조이고 집계 뷰가 그대로 합산함.
- '하루' 경계는 KST. DB 의 generated column `vote_date` 가 같은 정의로 유니크/조회 일관성 보장.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import require_user
from ..models.schemas import VoteRequest, VoteTarget
from ..services.supabase_client import exec_with_retry, get_anon_client, get_service_client

router = APIRouter(prefix="/votes", tags=["votes"])

_KST = timezone(timedelta(hours=9))


def _today_kst_iso() -> str:
    return datetime.now(_KST).date().isoformat()


@router.post("")
def cast_vote(body: VoteRequest, user: dict = Depends(require_user)) -> dict:
    """오늘(KST) 한 표를 set/toggle.

    Supabase upsert 는 generated 컬럼(vote_date) 을 포함한 conflict key 와 잘 안 맞아 select-후-쓰기 로 처리.
    동일 사용자의 동시 클릭 race 는 traffic 상 사실상 발생하지 않아 락 생략.
    """
    sb = get_service_client()
    today = _today_kst_iso()
    try:
        existing = exec_with_retry(
            sb.table("votes").select("id, value")
              .eq("user_id", user["sequence"])
              .eq("target_type", body.target_type)
              .eq("target_id", body.target_id)
              .eq("vote_date", today)
              .limit(1)
        ).data or []
        if existing:
            row = existing[0]
            if row["value"] == body.value:
                exec_with_retry(sb.table("votes").delete().eq("id", row["id"]))
            else:
                exec_with_retry(sb.table("votes").update({"value": body.value}).eq("id", row["id"]))
        else:
            exec_with_retry(sb.table("votes").insert({
                "user_id": user["sequence"],
                "target_type": body.target_type,
                "target_id": body.target_id,
                "value": body.value,
            }))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"vote failed: {e}")
    return {"ok": True}


@router.delete("")
def retract_vote(
    target_type: VoteTarget = Query(...),
    target_id: int = Query(...),
    user: dict = Depends(require_user),
) -> dict:
    """오늘(KST) 분 투표만 취소. 어제 이전 표는 그대로 둠."""
    sb = get_service_client()
    exec_with_retry(sb.table("votes").delete()
        .eq("user_id", user["sequence"])
        .eq("target_type", target_type)
        .eq("target_id", target_id)
        .eq("vote_date", _today_kst_iso())
    )
    return {"ok": True}


@router.get("/mine")
def my_votes(target_type: VoteTarget = Query(...), user: dict = Depends(require_user)) -> dict:
    """오늘(KST) 분 내 투표 — 버튼의 활성 상태 표시용.

    어제 이전 표는 누적 점수에는 반영되지만 여기서는 반환하지 않음 → 매일 새로 한 표를 행사할 수 있다는 신호.
    """
    sb = get_service_client()
    rows = exec_with_retry(
        sb.table("votes").select("target_id, value")
          .eq("user_id", user["sequence"])
          .eq("target_type", target_type)
          .eq("vote_date", _today_kst_iso())
    ).data or []
    return {str(r["target_id"]): r["value"] for r in rows}


@router.get("/my-history")
def my_vote_history(user: dict = Depends(require_user)) -> dict:
    """내가 투표한 항목별 좋아요/싫어요 누적 집계."""
    sb = get_service_client()
    uid = user["sequence"]
    rows = exec_with_retry(
        sb.table("votes").select("target_type, target_id, value")
          .eq("user_id", uid)
    ).data or []

    summary: dict = defaultdict(lambda: {"likes": 0, "dislikes": 0})
    for r in rows:
        key = (r["target_type"], r["target_id"])
        if r["value"] == 1:
            summary[key]["likes"] += 1
        else:
            summary[key]["dislikes"] += 1

    restaurant_ids = [tid for (tt, tid) in summary if tt == "restaurant"]
    channel_ids = [tid for (tt, tid) in summary if tt == "channel"]
    appearance_ids = [tid for (tt, tid) in summary if tt == "appearance"]

    restaurants: list[dict] = []
    if restaurant_ids:
        rr = exec_with_retry(
            sb.table("restaurants").select("id, current_name, current_address")
              .in_("id", restaurant_ids)
        ).data or []
        rs_scores = {
            r["restaurant_id"]: r
            for r in (exec_with_retry(
                sb.table("v_restaurant_score").select("restaurant_id, likes, dislikes")
                  .in_("restaurant_id", restaurant_ids)
            ).data or [])
        }
        for r in rr:
            sc = rs_scores.get(r["id"], {})
            s = summary[("restaurant", r["id"])]
            restaurants.append({
                "id": r["id"],
                "name": r["current_name"],
                "address": r["current_address"],
                "likes": int(sc.get("likes") or 0),
                "dislikes": int(sc.get("dislikes") or 0),
                "my_likes": s["likes"],
                "my_dislikes": s["dislikes"],
            })

    channels: list[dict] = []
    if channel_ids:
        cr = exec_with_retry(
            sb.table("channels").select("id, name")
              .in_("id", channel_ids)
        ).data or []
        ch_scores = {
            c["channel_id"]: c
            for c in (exec_with_retry(
                sb.table("v_channel_score").select("channel_id, likes, dislikes")
                  .in_("channel_id", channel_ids)
            ).data or [])
        }
        for c in cr:
            sc = ch_scores.get(c["id"], {})
            s = summary[("channel", c["id"])]
            channels.append({
                "id": c["id"],
                "name": c["name"],
                "likes": int(sc.get("likes") or 0),
                "dislikes": int(sc.get("dislikes") or 0),
                "my_likes": s["likes"],
                "my_dislikes": s["dislikes"],
            })

    appearances: list[dict] = []
    if appearance_ids:
        ar = exec_with_retry(
            sb.table("appearances")
              .select("id, episode_title, restaurant_id, channel_id, restaurants(current_name), channels(name)")
              .in_("id", appearance_ids)
        ).data or []
        ap_scores = {
            a["appearance_id"]: a
            for a in (exec_with_retry(
                sb.table("v_appearance_score").select("appearance_id, likes, dislikes")
                  .in_("appearance_id", appearance_ids)
            ).data or [])
        }
        for a in ar:
            sc = ap_scores.get(a["id"], {})
            s = summary[("appearance", a["id"])]
            appearances.append({
                "id": a["id"],
                "episode_title": a.get("episode_title"),
                "restaurant_id": a.get("restaurant_id"),
                "channel_id": a.get("channel_id"),
                "restaurant_name": (a.get("restaurants") or {}).get("current_name"),
                "channel_name": (a.get("channels") or {}).get("name"),
                "likes": int(sc.get("likes") or 0),
                "dislikes": int(sc.get("dislikes") or 0),
                "my_likes": s["likes"],
                "my_dislikes": s["dislikes"],
            })

    return {"restaurants": restaurants, "channels": channels, "appearances": appearances}


@router.get("/ranking")
def period_ranking(
    target_type: VoteTarget = Query(...),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    limit: int = Query(100),
) -> list:
    """기간별 투표 랭킹 — from/to 없으면 전체 기간."""
    sb = get_service_client()

    q = sb.table("votes").select("target_id, value").eq("target_type", target_type)
    if from_date:
        q = q.gte("vote_date", from_date.isoformat())
    if to_date:
        q = q.lte("vote_date", to_date.isoformat())

    rows = exec_with_retry(q).data or []

    agg: dict = defaultdict(lambda: {"likes": 0, "dislikes": 0})
    for r in rows:
        tid = r["target_id"]
        if r["value"] == 1:
            agg[tid]["likes"] += 1
        else:
            agg[tid]["dislikes"] += 1

    sorted_ids = sorted(
        agg.keys(),
        key=lambda tid: agg[tid]["likes"] - agg[tid]["dislikes"],
        reverse=True,
    )[:limit]

    if not sorted_ids:
        return []

    if target_type == "restaurant":
        detail = exec_with_retry(
            sb.table("restaurants").select("id, current_name").in_("id", sorted_ids)
        ).data or []
        name_map = {r["id"]: r["current_name"] for r in detail}
        return [
            {
                "id": tid,
                "name": name_map.get(tid, f"#{tid}"),
                "likes": agg[tid]["likes"],
                "dislikes": agg[tid]["dislikes"],
                "net_score": agg[tid]["likes"] - agg[tid]["dislikes"],
            }
            for tid in sorted_ids
        ]
    elif target_type == "channel":
        detail = exec_with_retry(
            sb.table("channels").select("id, name").in_("id", sorted_ids)
        ).data or []
        name_map = {c["id"]: c["name"] for c in detail}
        return [
            {
                "id": tid,
                "name": name_map.get(tid, f"#{tid}"),
                "likes": agg[tid]["likes"],
                "dislikes": agg[tid]["dislikes"],
                "net_score": agg[tid]["likes"] - agg[tid]["dislikes"],
            }
            for tid in sorted_ids
        ]
    else:
        detail = exec_with_retry(
            sb.table("appearances")
              .select("id, episode_title, restaurant_id, channel_id, restaurants(current_name), channels(name)")
              .in_("id", sorted_ids)
        ).data or []
        app_map = {a["id"]: a for a in detail}
        return [
            {
                "appearance_id": tid,
                "id": tid,
                "restaurant_id": app_map.get(tid, {}).get("restaurant_id"),
                "restaurant_name": (app_map.get(tid, {}).get("restaurants") or {}).get("current_name"),
                "channel_id": app_map.get(tid, {}).get("channel_id"),
                "channel_name": (app_map.get(tid, {}).get("channels") or {}).get("name"),
                "episode_title": app_map.get(tid, {}).get("episode_title"),
                "likes": agg[tid]["likes"],
                "dislikes": agg[tid]["dislikes"],
                "net_score": agg[tid]["likes"] - agg[tid]["dislikes"],
                "trend_score": None,
                "source_url": None,
                "youtube_video_id": None,
                "thumbnail_url": None,
                "aired_at": None,
            }
            for tid in sorted_ids
        ]


@router.get("/score")
def vote_score(
    target_type: VoteTarget = Query(...),
    target_id: int = Query(...),
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
) -> dict:
    """특정 대상이 [from, to] (KST 자정 경계, inclusive) 기간에 받은 좋아요/싫어요 합산.

    vote_date(KST date) 컬럼이 있으면 그걸 쓰면 가장 깔끔하지만, 운영 DB 마이그레이션 적용 여부와
    무관하게 동작하도록 created_at(timestamptz) 기반 범위 비교로 구현.
    KST 자정 경계 → UTC 로 환산하여 created_at >= from_kst_midnight AND < (to_kst_midnight + 1day).
    """
    if to_date < from_date:
        raise HTTPException(status_code=400, detail="to must be on or after from")
    kst_start    = datetime.combine(from_date, time.min, tzinfo=_KST)
    kst_end_excl = datetime.combine(to_date,   time.min, tzinfo=_KST) + timedelta(days=1)
    sb = get_anon_client()

    def _count(value: int) -> int:
        res = exec_with_retry(
            sb.table("votes").select("id", count="exact").limit(1)
              .eq("target_type", target_type).eq("target_id", target_id).eq("value", value)
              .gte("created_at", kst_start.isoformat())
              .lt("created_at",  kst_end_excl.isoformat())
        )
        return res.count or 0

    likes = _count(1)
    dislikes = _count(-1)
    return {"likes": likes, "dislikes": dislikes, "net_score": likes - dislikes}
