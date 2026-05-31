"use client";

import { useEffect, useState } from "react";

import ChannelIngest from "@/components/admin/ChannelIngest";
import ChannelManagement from "@/components/admin/ChannelManagement";
import RestaurantManagement from "@/components/admin/RestaurantManagement";
import RestaurantRequestApproval from "@/components/admin/RestaurantRequestApproval";
import UserManagement from "@/components/admin/UserManagement";
import { useMe } from "@/lib/me";
import { isAdmin, isSuperadmin } from "@/lib/role";

/** /admin — DB 관리 페이지.
 * 권한 가드만 담당하고, 실제 UI 는 components/admin/* 컴포넌트로 위임.
 * 한 번 admin 으로 검증되면 verifiedAdmin true 유지 — TOKEN_REFRESHED 등으로 me 가
 * 잠깐 null 이 되어도 페이지가 깜빡 사라지지 않게.
 */
export default function AdminPage() {
  const { me, loading } = useMe();
  const [verifiedAdmin, setVerifiedAdmin] = useState(false);
  // 회원관리/채널관리 등에서 채널 목록이 바뀌면 RestaurantManagement 의 옵션을 즉시 갱신할 키
  const [channelsRevision, setChannelsRevision] = useState(0);
  const bumpChannels = () => setChannelsRevision((v) => v + 1);

  useEffect(() => {
    if (me && isAdmin(me)) setVerifiedAdmin(true);
  }, [me]);

  if (!verifiedAdmin) {
    if (loading) return <div className="text-sm font-bold text-neutral-500">권한 확인 중…</div>;
    if (!isAdmin(me)) return <div className="text-sm font-bold text-red-500">관리자만 접근할 수 있습니다.</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="font-soft text-3xl font-bold tracking-tight" style={{ color: "rgb(20 30 80)" }}>DB 관리</h1>

      {isSuperadmin(me) && <ChannelIngest     onChanged={bumpChannels} />}
      {isSuperadmin(me) && <UserManagement    onChannelsChanged={bumpChannels} />}
      {isSuperadmin(me) && <RestaurantRequestApproval onChanged={bumpChannels} />}
      {isSuperadmin(me) && <ChannelManagement onChanged={bumpChannels} channelsRevision={channelsRevision} />}
      {me && <RestaurantManagement me={me} channelsRevision={channelsRevision} />}
    </div>
  );
}
