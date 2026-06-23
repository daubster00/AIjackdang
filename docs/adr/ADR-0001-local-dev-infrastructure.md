# ADR-0001: 로컬 개발 인프라 (docker-compose + pg_bigm + ClamAV + S3 + 소셜 OAuth)

- **상태(Status)**: Accepted (2026-06-17)
- **맥락 출처**: `_bmad-output/planning-artifacts/architecture.md` (Pre-Implementation 블로커 `local-dev-infra`)
- **결정자**: 아키텍처 워크플로우 (Party Mode — Amelia가 day-1 블로커로 지적)

---

## 1. Context (배경)

DB 스키마·인증 Story를 시작하는 day-1에 다음이 없어 개발자가 막힌다:

- **pg_bigm**(한국어 n-gram 전문 검색 확장)은 표준 `postgres` 이미지에 없다 → `CREATE EXTENSION pg_bigm` 즉시 에러.
- **ClamAV**(업로드 파일 보안 스캔, NFR-2) 로컬 데몬(`clamd`) 구성이 없다.
- **객체 스토리지**: 운영은 Cloudflare R2(S3 호환)지만, 로컬에서 R2에 의존하면 오프라인 개발이 막힌다.
- **소셜 OAuth**(구글/네이버/카카오): `localhost` 콜백은 `redirect_uri_mismatch`를 유발하고, 카카오·네이버는 표준 OIDC가 아니다.

> 주의: 루트 `.env.example` 주석은 "PostgreSQL 18"이라 적혀 있으나 아키텍처 확정 버전은 **17**(pg_bigm 지원 확인). 본 ADR 적용 시 `.env.example` 주석을 17로 정정한다.

## 2. Decision (결정)

로컬 개발은 **`docker-compose.dev.yml` 한 파일**로 부팅한다. 앱(web/admin/api/worker)은 호스트에서 `pnpm dev:*`로 실행하고, **상태 저장 의존성(Postgres/Redis/ClamAV/MinIO)만 도커**로 띄운다(앱은 도커에 넣지 않아 HMR·디버깅 빠르게).

| 서비스 | 이미지/빌드 | 포트 | 용도 |
|---|---|---|---|
| `postgres` | 커스텀 빌드(`infra/postgres/Dockerfile`, PG17 + pg_bigm) | 5432 | DB + 전문검색 |
| `redis` | `redis:7-alpine` | 6379 | BullMQ + 캐시 + SSE Pub/Sub |
| `clamav` | `clamav/clamav:latest` | 3310 | 업로드 파일 스캔(clamd) |
| `minio` | `minio/minio` | 9000/9001 | 로컬 S3 호환(운영 R2 대체) |
| `minio-setup` | `minio/mc` | — | 버킷 부트스트랩 |

- **객체 스토리지**: 코드는 S3 호환 클라이언트만 사용 → 로컬은 **MinIO**(`S3_ENDPOINT=http://localhost:9000`), 운영은 **R2**(엔드포인트만 교체). 코드 변경 없음.
- **소셜 OAuth**: ① 각 플랫폼 **개발용 앱**(localhost 콜백 등록) credential을 `.env`에 + ② 빠른 로컬 반복을 위한 **dev-bypass 가짜 로그인**(개발 모드 전용, `AUTH_DEV_BYPASS=true`일 때만 노출). 외부 콜백 없이 시드 유저로 로그인.

## 3. 구체 산출물 (그대로 사용)

### 3-1. `infra/postgres/Dockerfile`
> ⚠️ pg_bigm은 PGDG apt에 패키지가 없어(`postgresql-17-pg-bigm` 미존재) **소스에서 빌드**한다. 빌드에는 `ca-certificates`(git https), `libicu-dev`(PG17 헤더의 ICU 의존)가 필요하다 — 실 빌드에서 확인됨.
```dockerfile
FROM postgres:17
ARG PG_BIGM_TAG=v1.2-20250903
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends build-essential git ca-certificates libicu-dev postgresql-server-dev-17; \
    git clone --depth 1 --branch "${PG_BIGM_TAG}" https://github.com/pgbigm/pg_bigm.git /tmp/pg_bigm; \
    cd /tmp/pg_bigm; make USE_PGXS=1; make USE_PGXS=1 install; \
    apt-get purge -y --auto-remove build-essential git libicu-dev postgresql-server-dev-17; \
    rm -rf /var/lib/apt/lists/* /tmp/pg_bigm
COPY ./init/01-pg_bigm.sql /docker-entrypoint-initdb.d/01-pg_bigm.sql
```

### 3-2. `infra/postgres/init/01-pg_bigm.sql`
```sql
CREATE EXTENSION IF NOT EXISTS pg_bigm;
-- GIN 인덱스 예시는 packages/database 스키마 마이그레이션에서 컬럼별로 생성
-- 예: CREATE INDEX idx_posts_search ON posts USING gin (search_text gin_bigm_ops);
```

### 3-3. `docker-compose.dev.yml` (리포 루트)
```yaml
services:
  postgres:
    build: ./infra/postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_jakdang
    ports: ["5433:5432"]   # 호스트 5433 (기본 5432 충돌 회피)
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d ai_jakdang"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6380:6379"]   # 호스트 6380 (기본 6379 충돌 회피)
    volumes: ["redisdata:/data"]

  clamav:
    image: clamav/clamav:latest
    ports: ["3310:3310"]
    volumes: ["clamdb:/var/lib/clamav"]   # 바이러스 DB 캐시(최초 freshclam 시간 단축)
    healthcheck:
      test: ["CMD", "clamdcheck.sh"]
      interval: 30s
      timeout: 10s
      retries: 10

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: ["miniodata:/data"]

  minio-setup:
    image: minio/mc
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "
      until mc alias set local http://minio:9000 minioadmin minioadmin; do sleep 1; done;
      mc mb -p local/ai-jakdang-public;
      mc anonymous set download local/ai-jakdang-public;
      mc mb -p local/ai-jakdang-private;
      exit 0;
      "

volumes:
  pgdata:
  redisdata:
  clamdb:
  miniodata:
```

실행: `docker compose -f docker-compose.dev.yml up -d` → 이후 `pnpm dev:api` 등.

### 3-4. `.env.example` 추가 키
```bash
# --- 데이터베이스 (PostgreSQL 17 + pg_bigm) ---  ← 주석 18→17 정정
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ai_jakdang

# --- 파일 보안 스캔 (ClamAV / clamd) ---
CLAMD_HOST=localhost
CLAMD_PORT=3310

# --- S3 호환 스토리지 (로컬=MinIO / 운영=Cloudflare R2) ---
S3_ENDPOINT=http://localhost:9000        # 운영: https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=minioadmin              # 운영: R2 access key
S3_SECRET_ACCESS_KEY=minioadmin          # 운영: R2 secret key
S3_FORCE_PATH_STYLE=true                 # MinIO 필요, R2도 호환
S3_BUCKET_PUBLIC=ai-jakdang-public
S3_BUCKET_PRIVATE=ai-jakdang-private

# --- 소셜 OAuth (개발용 앱 credential) ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
# 콜백: http://localhost:4003/api/v1/auth/callback/{provider}

# --- 개발 전용 로그인 우회 (production 금지) ---
AUTH_DEV_BYPASS=true
```

## 4. 소셜 OAuth 로컬 전략 (상세)

- **콜백 URL 통일**: `http://localhost:4003/api/v1/auth/callback/{google|naver|kakao}` — 각 플랫폼 개발자 콘솔에 등록.
- **구글**: Better Auth 네이티브 지원. dev OAuth 클라이언트 생성 + localhost 콜백.
- **네이버/카카오**: Better Auth가 **네이티브 provider로 정식 지원**(2026-06-17 확인) → genericOAuth/커스텀 어댑터 불필요. 키 발급 후 `socialProviders`에 구성만 하면 됨. **카카오 이메일(`account_email`)은 비즈앱(사업자 검수) 필요** → 미검수 시 이메일 없는 가입 허용 = `users.email` nullable 설계 필요(제품 결정).
- **dev-bypass**: `AUTH_DEV_BYPASS=true`이고 `NODE_ENV!=production`일 때만, api가 시드 유저로 즉시 세션 발급하는 `/api/v1/auth/dev-login` 노출. 외부 콜백 없이 UI 반복 개발용. **production 빌드에서 라우트 자체가 비활성.**

## 4-1. 검증 (2026-06-17, 실 기동)
- 실제 빌드·기동 성공. PostgreSQL **17.10** + **pg_bigm 1.2**, `bigm_similarity('클로드 코드','클로드코드')=0.833`(한국어 동작). redis PING→PONG, clamav healthy, minio 버킷(public/private) 생성.
- **호스트 포트 충돌 회피**: 같은 머신의 다른 스택(`infra-*`)이 5432·6379 점유 → 본 프로젝트는 **postgres 5433 / redis 6380**으로 매핑(컨테이너 내부 포트는 5432/6379 유지). `.env`의 `DATABASE_URL`/`REDIS_URL`도 5433/6380.

## 5. Consequences (영향)

- ✅ day-1 블로커 해소: 한 명령으로 검색·스캔·스토리지·큐 로컬 부팅. 오프라인 개발 가능.
- ✅ 로컬↔운영 스토리지 코드 동일(엔드포인트만 교체).
- ⚠️ ClamAV 최초 부팅 시 `freshclam` 바이러스 DB 다운로드로 수 분 소요(볼륨 캐시로 이후 단축).
- ⚠️ pg_bigm은 PostgreSQL **17** 기준. 18로 올리려면 `postgresql-18-pg-bigm` 패키지 존재 여부 선검증 필요 → 현재는 17 고정.
- ⚠️ `AUTH_DEV_BYPASS`는 개발 전용. production 환경변수에서 반드시 제거/false + 라우트 가드.

## 6. 후속 (이 ADR이 남기는 작업)

- 인증 Story 전: `better-auth-poc`(네이버/카카오) 해소 → 본 ADR §4 확정.
- 첫 구현 Story("ADR 고정 + turbo.json")에서 위 파일들(`docker-compose.dev.yml`, `infra/postgres/*`)을 실제 생성.
- `.env.example` 주석 18→17 정정 및 위 키 반영.
