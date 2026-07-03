/**
 * 관리자 페르소나의 검열(censor) 모델을 OpenAI로 전환하는 유틸.
 * (Google/Anthropic 크레딧 소진으로 censor callModel이 실패해 글이 held되는 것을 해소.)
 *
 * 실행: pnpm --filter @ai-jakdang/api tsx src/scripts/set-admin-censor-openai.ts
 */
import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { eq, and } from "drizzle-orm";

async function main(): Promise<void> {
  const db = getDb();
  const [persona] = await db
    .select({ id: schema.botPersonas.id, nickname: schema.botPersonas.nickname })
    .from(schema.botPersonas)
    .where(and(eq(schema.botPersonas.isAdminPersona, true), eq(schema.botPersonas.isActive, true)))
    .limit(1);
  if (!persona) {
    console.error("활성 관리자 페르소나 없음");
    return;
  }
  await db
    .update(schema.botModelAssignments)
    .set({ provider: "openai", model: "gpt-4o-mini", updatedAt: new Date() })
    .where(
      and(
        eq(schema.botModelAssignments.personaId, persona.id),
        eq(schema.botModelAssignments.purpose, "censor"),
      ),
    );
  console.info(`[set-censor] ${persona.nickname} censor → openai/gpt-4o-mini 로 전환 완료`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
