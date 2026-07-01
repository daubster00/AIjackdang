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

# 전체 워크스페이스 복사 후 의존성 설치
COPY . .
RUN pnpm install --frozen-lockfile

# web·admin 프로덕션 빌드 (메모리 상한은 script 내부 설정 재사용)
RUN pnpm --filter @ai-jakdang/web build \
  && pnpm --filter @ai-jakdang/admin build

ENV NODE_ENV=production

# 기본 CMD 는 compose 의 command 로 덮어쓴다.
CMD ["pnpm", "--filter", "@ai-jakdang/api", "start"]
