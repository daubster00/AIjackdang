import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 워크스페이스 공유 패키지는 TypeScript 소스를 그대로 export 하므로 Next 가 트랜스파일하도록 지정한다.
  // (비시각적 코드만 공유한다 — UI/스타일 패키지는 공유하지 않는다)
  transpilePackages: [
    "@ai-jakdang/contracts",
    "@ai-jakdang/core",
    "@ai-jakdang/utilities",
    "@ai-jakdang/auth",
  ],
};

export default nextConfig;
