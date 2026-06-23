-- pg_bigm 확장 활성화 (한국어 등 CJK n-gram 전문검색)
-- 참고: docs/adr/ADR-0001-local-dev-infrastructure.md
CREATE EXTENSION IF NOT EXISTS pg_bigm;

-- 컬럼별 GIN 인덱스는 packages/database 스키마 마이그레이션에서 생성한다.
-- 예) CREATE INDEX idx_posts_search ON posts USING gin (search_text gin_bigm_ops);
