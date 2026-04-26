"use client";

// MVP: 하드코딩 시도 목록. 구·동 레벨은 맛집 데이터 유입 후 DB에서 distinct 조회로 교체.
const SIDO = [
  "전체",
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function RegionSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none"
    >
      {SIDO.map((s) => (
        <option key={s} value={s === "전체" ? "" : s}>
          {s}
        </option>
      ))}
    </select>
  );
}
