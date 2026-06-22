/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // 정적 프리렌더 시 외부 API(Render) 가 콜드스타트/재배포 중이어도 빌드가 무한정 기다리지 않도록 헤드룸.
  // 실제 fetch 들은 AbortSignal.timeout 으로 더 짧게 끊고 빈 값 폴백 → 콘텐츠는 ISR 이 채운다.
  staticPageGenerationTimeout: 120,
};

export default nextConfig;
