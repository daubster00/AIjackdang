import { defineConfig } from "drizzle-kit";

// 운영 DB 변경은 마이그레이션 SQL 로만 처리한다.
// 개발: drizzle-kit generate -> SQL 검토 -> drizzle-kit migrate
// 운영에서 drizzle-kit push 를 직접 실행하지 않는다.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/ai_jakdang",
  },
  strict: true,
  verbose: true,
});
