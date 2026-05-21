// /ads.txt — Google AdSense 가 요구하는 신뢰 파일.
//   NEXT_PUBLIC_ADSENSE_CLIENT (예: "ca-pub-XXXXXXXXXXXXXXXX") 에서 "pub-XXX" 부분만 추출해 동적 응답.
//   env 만 채우면 운영 도메인의 https://your-domain.com/ads.txt 가 자동으로 정확한 값 노출.
//   env 가 비어있으면 404 (등록 안 한 상태).

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
  const pub = client.replace(/^ca-/, "").trim(); // "ca-pub-..." → "pub-..."
  if (!pub.startsWith("pub-")) {
    return new Response("", { status: 404, headers: { "content-type": "text/plain" } });
  }
  const body = `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
