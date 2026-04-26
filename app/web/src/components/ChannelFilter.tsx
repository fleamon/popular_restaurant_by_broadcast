"use client";

import type { Channel } from "@/lib/api";

type Props = {
  channels: Channel[];
  value: number | "";
  onChange: (id: number | "") => void;
};

export default function ChannelFilter({ channels, value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
    >
      <option value="">전체 채널</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>
          [{c.channel_type}] {c.name}
        </option>
      ))}
    </select>
  );
}
