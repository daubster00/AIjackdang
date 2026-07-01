#!/usr/bin/env bash
# ===========================================================================
# AI작당 운영 배포 스크립트 (서버에서 실행)
#   위치: 리포지토리 루트/deploy/
#   전제: deploy/.env 가 채워져 있고 Docker/Compose 설치됨
#   사용: cd ~/aijakdang/deploy && ./deploy.sh
# 멱등: 재실행해도 DB 데이터를 지우지 않는다(마이그레이션·시드는 idempotent).
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"
APP_IMAGE="aijakdang-app:latest"

echo "▶ 1/6  앱 이미지 빌드 ($APP_IMAGE) — web/admin next build 포함(수분 소요)"
$COMPOSE build api          # api 서비스 build 정의가 aijakdang-app:latest 를 생성
$COMPOSE build postgres     # PostgreSQL 17 + pg_bigm

echo "▶ 2/6  상태 저장 서비스 기동 (postgres/redis/minio/clamav)"
$COMPOSE up -d postgres redis minio minio-setup clamav

echo "▶ 3/6  PostgreSQL 헬스 대기"
until $COMPOSE exec -T postgres pg_isready -U "$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2)" >/dev/null 2>&1; do
  printf '.'; sleep 2
done
echo " ready"

echo "▶ 4/6  DB 마이그레이션 (bot_* 포함 0001~0030 + 기본 설정값·금칙어·권한·역할)"
$COMPOSE run --rm api pnpm --filter @ai-jakdang/database db:migrate

echo "▶ 5/6  시드 — 최고관리자 + 등급(설정값). 콘텐츠/봇은 시드하지 않음(빈 상태 유지)"
$COMPOSE run --rm api pnpm seed:super-admin
$COMPOSE run --rm api pnpm seed:grades

echo "▶ 6/6  전체 서비스 기동 (api/worker/web/admin/caddy)"
$COMPOSE up -d

echo ""
echo "✅ 배포 완료. 상태:"
$COMPOSE ps
echo ""
echo "확인:"
echo "  https://aijackdang.com          (사용자)"
echo "  https://admin.aijackdang.com    (관리자)"
echo "  https://api.aijackdang.com/health (API 헬스)"
