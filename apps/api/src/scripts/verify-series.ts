import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { and, asc, eq } from "drizzle-orm";
import { getBotSetting } from "../lib/botSettings.js";

const BOARDS = ["vibe-coding-guide", "automation-guide"];

async function main(): Promise<void> {
  const db = getDb();
  for (const board of BOARDS) {
    const rows = await db
      .select({ title: schema.posts.title, content: schema.posts.contentJson, thumb: schema.posts.thumbnailUrl })
      .from(schema.posts)
      .where(and(eq(schema.posts.board, board), eq(schema.posts.status, "published")))
      .orderBy(asc(schema.posts.createdAt));
    console.info(`\n===== ${board} — 발행 ${rows.length}편 =====`);
    for (const r of rows) {
      const nodes = (r.content as any)?.content ?? [];
      const imgs = nodes.filter((n: any) => n.type === "image");
      const headings = nodes.filter((n: any) => n.type === "heading").length;
      const raw = JSON.stringify(r.content);
      console.info(
        `  ${r.title}\n    이미지 ${imgs.length}개 · 소제목 ${headings}개 · 썸네일 ${r.thumb ? "O" : "X"} · 잔여마커 ${raw.includes("[[IMG:") ? "있음!" : "없음"}`,
      );
    }
  }
  const progress = (await getBotSetting("guide_progress")) as any;
  console.info("\n[guide_progress]");
  for (const k of Object.keys(progress ?? {})) {
    console.info(`  ${k}: published=[${progress[k].published.join(",")}]`);
  }
}

main().then(async () => { await closeDb(); process.exit(0); }).catch(async (e) => { console.error(e); await closeDb(); process.exit(1); });
