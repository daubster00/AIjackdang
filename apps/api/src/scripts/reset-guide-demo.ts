/**
 * 가이드 데모 초기화: 두 가이드 게시판의 시리즈 게시글 전체 삭제 + 진척도 리셋.
 * (코드 수정 후 전편을 깨끗이 다시 발행하기 위함.)
 */
import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { or, like } from "drizzle-orm";
import { setBotSetting } from "../lib/botSettings.js";
import { GUIDE_SERIES } from "../services/bot/curriculum.js";

async function main(): Promise<void> {
  const db = getDb();
  const conds = GUIDE_SERIES.map((s) => like(schema.posts.title, `${s.title}%`));
  const del = await db
    .delete(schema.posts)
    .where(or(...conds))
    .returning({ id: schema.posts.id });
  console.info(`삭제된 시리즈 게시글: ${del.length}개`);
  await setBotSetting("guide_progress", {});
  console.info("guide_progress 초기화 완료");
}

main().then(async () => { await closeDb(); process.exit(0); }).catch(async (e) => { console.error(e); await closeDb(); process.exit(1); });
