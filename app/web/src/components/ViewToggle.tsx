"use client";

import Image from "next/image";

export type SearchView = "list" | "grid" | "map";

const VIEWS: { key: SearchView; icon: string; label: string }[] = [
  { key: "list", icon: "/icon-result-list.png", label: "목록으로 보기" },
  { key: "grid", icon: "/icon-result-grid.png", label: "격자로 보기" },
  { key: "map",  icon: "/icon-result-map.png",  label: "지도에서 보기" },
];

type Props = {
  value: SearchView;
  onChange: (v: SearchView) => void;
};

export default function ViewToggle({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      {VIEWS.map((v) => {
        const active = value === v.key;
        return (
          <button
            key={v.key}
            onClick={() => onChange(v.key)}
            aria-label={v.label}
            title={v.label}
            className={[
              "relative h-12 w-12 rounded-md transition-colors",
              active ? "bg-brand-surface ring-1 ring-brand" : "hover:bg-neutral-50",
            ].join(" ")}
          >
            <Image
              src={v.icon}
              alt=""
              fill
              sizes="48px"
              className="object-contain p-2"
            />
          </button>
        );
      })}
    </div>
  );
}
