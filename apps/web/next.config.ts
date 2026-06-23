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

  /**
   * API 프록시 rewrite (Dev Notes §쿠키·세션 전략).
   *
   * /api/v1/auth/* → API 서버(4003)로 프록시.
   * 브라우저 입장에서 Same-Origin 요청이므로 httpOnly 쿠키가 정상 설정된다.
   * (First-party 쿠키 보장)
   */
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4003";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
