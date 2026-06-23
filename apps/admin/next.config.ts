import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 사용자 사이트의 styles/components 는 절대 공유하지 않는다.
  // 관리자 디자인 시스템은 관리자 앱 "전용" 시각 자산이므로 여기서만 공유한다.
  transpilePackages: [
    "@ai-jakdang/contracts",
    "@ai-jakdang/auth",
    "@ai-jakdang/admin-design-system",
  ],
};

export default nextConfig;
