#!/usr/bin/env bash
# ===========================================================================
# 운영 deploy/.env 생성기
#   - 시크릿(DB PW, AUTH_SECRET, ADMIN_AUTH_SECRET, MinIO 키)은 강한 난수로 생성
#   - 외부 API 키(OAuth/AI/검색/SMTP/SUPER_ADMIN_PASSWORD)는 소스 env 에서 이관
#   사용: ./make-env.sh <소스env경로>   (예: ./make-env.sh ../.env.local-source)
#   출력: deploy/.env  (이미 있으면 .env.bak 로 백업)
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")"

SRC="${1:?소스 env 경로를 인자로 주세요 (로컬 .env 를 서버로 옮긴 파일)}"
OUT=".env"

# 소스 env 에서 KEY 값 추출(맨 앞 매칭, 공백/따옴표 정리)
val() {
  grep -E "^$1=" "$SRC" 2>/dev/null | head -1 | cut -d= -f2- | sed -E 's/^["'"'"']//; s/["'"'"']$//' | sed -E 's/[[:space:]]+$//'
}
gen() { openssl rand -base64 "${1:-36}" | tr -d '\n/+=' | cut -c1-"${2:-40}"; }

[ -f "$OUT" ] && cp "$OUT" "$OUT.bak"

PG_PW="$(gen 36 40)"
S3_KEY="$(gen 24 20)"
S3_SECRET="$(gen 48 44)"
AUTH_SECRET="$(gen 48 44)"
ADMIN_AUTH_SECRET="$(gen 48 44)"

cat > "$OUT" <<EOF
NODE_ENV=production
AUTH_DEV_BYPASS=false

WEB_PUBLIC_URL=https://aijackdang.com
ADMIN_PUBLIC_URL=https://admin.aijackdang.com
API_PUBLIC_URL=https://api.aijackdang.com
NEXT_PUBLIC_API_URL=https://api.aijackdang.com
# SEO 기준 도메인(canonical·OG·sitemap·robots). 웹 공개 URL과 동일해야 한다.
NEXT_PUBLIC_SITE_URL=https://aijackdang.com
BETTER_AUTH_URL=https://api.aijackdang.com
COOKIE_DOMAIN=.aijackdang.com
API_INTERNAL_URL=http://api:4003
WEB_PORT=3003
ADMIN_PORT=3004
API_PORT=4003
API_HOST=0.0.0.0

POSTGRES_USER=aijakdang
POSTGRES_PASSWORD=${PG_PW}
POSTGRES_DB=ai_jakdang
DATABASE_URL=postgres://aijakdang:${PG_PW}@postgres:5432/ai_jakdang

REDIS_URL=redis://redis:6379

AUTH_SECRET=${AUTH_SECRET}
ADMIN_AUTH_SECRET=${ADMIN_AUTH_SECRET}

CLAMD_HOST=clamav
CLAMD_PORT=3310

S3_ENDPOINT=http://minio:9000
S3_REGION=auto
S3_ACCESS_KEY_ID=${S3_KEY}
S3_SECRET_ACCESS_KEY=${S3_SECRET}
S3_FORCE_PATH_STYLE=true
S3_BUCKET_PUBLIC=ai-jakdang-public
S3_BUCKET_PRIVATE=ai-jakdang-private
S3_PUBLIC_BASE_URL=https://cdn.aijackdang.com

GOOGLE_CLIENT_ID=$(val GOOGLE_CLIENT_ID)
GOOGLE_CLIENT_SECRET=$(val GOOGLE_CLIENT_SECRET)
NAVER_CLIENT_ID=$(val NAVER_CLIENT_ID)
NAVER_CLIENT_SECRET=$(val NAVER_CLIENT_SECRET)
KAKAO_REST_API_KEY=$(val KAKAO_REST_API_KEY)
KAKAO_CLIENT_SECRET=$(val KAKAO_CLIENT_SECRET)
KAKAO_ENABLED=true

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=$(val SMTP_USER)
SMTP_PASSWORD=$(val SMTP_PASSWORD)
SMTP_FROM=$(val SMTP_FROM)

SUPER_ADMIN_EMAIL=$(val SUPER_ADMIN_EMAIL)
SUPER_ADMIN_PASSWORD=$(val SUPER_ADMIN_PASSWORD)
SUPER_ADMIN_NAME=$(val SUPER_ADMIN_NAME)
SUPER_ADMIN_PHONE=$(val SUPER_ADMIN_PHONE)

SEEDING_BOT_ENABLED=false
OPENAI_API_KEY=$(val OPENAI_API_KEY)
ANTHROPIC_API_KEY=$(val ANTHROPIC_API_KEY)
GEMINI_API_KEY=$(val GEMINI_API_KEY)
BRAVE_SEARCH_API_KEY=$(val BRAVE_SEARCH_API_KEY)
GOOGLE_SEARCH_API_KEY=$(val GOOGLE_SEARCH_API_KEY)
GOOGLE_SEARCH_CX=$(val GOOGLE_SEARCH_CX)
NAVER_SEARCH_CLIENT_ID=$(val NAVER_SEARCH_CLIENT_ID)
NAVER_SEARCH_CLIENT_SECRET=$(val NAVER_SEARCH_CLIENT_SECRET)
UNSPLASH_ACCESS_KEY=$(val UNSPLASH_ACCESS_KEY)
PEXELS_API_KEY=$(val PEXELS_API_KEY)
TELEGRAM_BOT_TOKEN=$(val TELEGRAM_BOT_TOKEN)
TELEGRAM_CHAT_ID=$(val TELEGRAM_CHAT_ID)
EOF

chmod 600 "$OUT"
echo "생성 완료: $OUT (권한 600)"
echo "SUPER_ADMIN_EMAIL = $(val SUPER_ADMIN_EMAIL)"
