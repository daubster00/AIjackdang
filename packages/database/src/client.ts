import { env } from "@ai-jakdang/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

export type Database = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let db: Database | undefined;

/**
 * Drizzle 데이터베이스 인스턴스를 반환한다(지연 초기화).
 *
 * DB 는 API 서버와 Worker 만 직접 접근한다. Next.js 에서 직접 호출하지 않는다.
 * 연결 풀은 프로세스당 한 번만 생성한다.
 *
 * 연결 문자열은 @ai-jakdang/config 의 `env.DATABASE_URL` 단일 진입점에서 온다.
 */
export function getDb(connectionString: string = env.DATABASE_URL): Database {
  if (!db) {
    pool = new pg.Pool({ connectionString });
    db = drizzle(pool, { schema });
  }
  return db;
}

/** 연결 풀을 종료한다(테스트·종료 훅에서 사용). */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}
