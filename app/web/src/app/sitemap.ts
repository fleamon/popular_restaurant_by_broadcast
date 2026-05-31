import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.xn--0z2byb.com";
  return [
    { url: base,                  changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/vote`,        changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/request`,     changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/about`,       changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`,       changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`,     changeFrequency: "monthly", priority: 0.3 },
  ];
}
