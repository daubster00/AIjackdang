# ===========================================================================
# AI작당 통합 앱 이미지 (api · worker · web · admin 공용)
# ---------------------------------------------------------------------------
# - api/worker 는 tsx 로 TS 소스를 직접 실행(별도 컴파일 없음)
# - web/admin 은 이 이미지 빌드 단계에서 `next build` 까지 수행
# - 4개 서비스가 같은 이미지를 쓰고, compose 에서 command 만 다르게 준다.
# - base: node:22-slim (Debian glibc) — @node-rs/argon2 등 prebuilt napi 바이너리 호환
#   (alpine/musl 은 prebuilt 미호환이라 사용하지 않는다)
# ===========================================================================
FROM node:22-slim

# 네이티브 모듈 빌드 폴백 대비(대부분 prebuilt 사용) + git(일부 postinstall)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# corepack 로 pnpm 고정 버전 활성화
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.16.1 --activate

WORKDIR /app

# ── 클라이언트 번들에 인라인되는 공개 URL (빌드 타임 주입 필수) ──
ARG NEXT_PUBLIC_API_URL=https://api.aijackdang.com
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# ── SEO 사이트 URL (canonical·OG·JSON-LD·sitemap·robots 기준 도메인, 빌드 타임 주입 필수) ──
# Next.js 는 NEXT_PUBLIC_* 을 build 시 번들에 인라인한다. 여기서 안 주면 lib/seo/site-url.ts
# 의 fallback(https://aijackdang.com)이 박힌다. 실도메인과 다르면 검색엔진에 잘못된 URL이 노출된다.
ARG NEXT_PUBLIC_SITE_URL=https://aijackdang.com
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# ── 웹 서버→API 내부 프록시 목적지 (빌드 타임 주입 필수) ──
# Next.js rewrites() 목적지는 build 시점에 routes-manifest.json 으로 구워진다.
# 여기서 안 주면 next.config.ts 의 fallback http://localhost:4003 이 박혀
# 운영 web 컨테이너가 자기 자신 4003 으로 프록시→ECONNREFUSED→소셜/세션 500.
ARG API_INTERNAL_URL=http://api:4003
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

# ── 카카오 로그인 버튼 활성 플래그 (클라이언트 번들에 인라인) ──
# LoginForm/SignupForm 이 NEXT_PUBLIC_KAKAO_ENABLED==="true" 일 때만 카카오 버튼 활성.
ARG NEXT_PUBLIC_KAKAO_ENABLED=true
ENV NEXT_PUBLIC_KAKAO_ENABLED=${NEXT_PUBLIC_KAKAO_ENABLED}

# 전체 워크스페이스 복사 후 의존성 설치
COPY . .
RUN pnpm install --frozen-lockfile

# web·admin 프로덕션 빌드 (메모리 상한은 script 내부 설정 재사용)
RUN pnpm --filter @ai-jakdang/web build \
  && pnpm --filter @ai-jakdang/admin build

ENV NODE_ENV=production

# 기본 CMD 는 compose 의 command 로 덮어쓴다.
CMD ["pnpm", "--filter", "@ai-jakdang/api", "start"]
