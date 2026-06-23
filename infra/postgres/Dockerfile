# PostgreSQL 17 + pg_bigm (한국어 2-gram 전문검색 확장)
# pg_bigm은 PGDG apt에 패키지가 없어 소스에서 빌드한다(태그 고정).
# 참고: docs/adr/ADR-0001-local-dev-infrastructure.md
FROM postgres:17

ARG PG_BIGM_TAG=v1.2-20250903

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends build-essential git ca-certificates libicu-dev postgresql-server-dev-17; \
    git clone --depth 1 --branch "${PG_BIGM_TAG}" https://github.com/pgbigm/pg_bigm.git /tmp/pg_bigm; \
    cd /tmp/pg_bigm; \
    make USE_PGXS=1; \
    make USE_PGXS=1 install; \
    apt-get purge -y --auto-remove build-essential git libicu-dev postgresql-server-dev-17; \
    rm -rf /var/lib/apt/lists/* /tmp/pg_bigm

# init 스크립트는 데이터 디렉터리가 비어 있는 최초 부팅 시 1회 실행된다.
COPY ./init/01-pg_bigm.sql /docker-entrypoint-initdb.d/01-pg_bigm.sql
