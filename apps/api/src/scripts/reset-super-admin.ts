/**
 * 관리자 마스터 계정 리셋 스크립트.
 *
 * 루트 `.env` 의 SUPER_ADMIN_* 값으로 super_admin(최고 관리자) 계정을 생성/갱신하고,
 * 그 외 **모든** 관리자 계정(admin_users)을 삭제한다.
 * (admin_accounts·admin_sessions 는 admin_user_id 의 onDelete:cascade 로 함께 정리됨.)
 *
 * .env 는 @ai-jakdang/config 가 import 시점에 process.loadEnvFile 로 자동 로드한다
 * (별도 dotenv 불필요). DB 접속 문자열은 env.DATABASE_URL 단일 진입점에서 온다.
 *
 * 실행: pnpm --filter @ai-jakdang/api admin:reset
 */

import { hash as argon2Hash } from "@node-rs/argon2";
import { and, eq, ne } from "drizzle-orm";
// getDb 가 @ai-jakdang/config 의 env(=루트 .env 로드)를 끌어온다.
import { getDb, closeDb, schema } from "@ai-jakdang/database";

function fail(message: string): never {
  console.error(`[admin:reset] ${message}`);
  process.exit(1);
}

const EMAIL = process.env["SUPER_ADMIN_EMAIL"]?.trim();
const PASSWORD = process.env["SUPER_ADMIN_PASSWORD"];
const NAME = process.env["SUPER_ADMIN_NAME"]?.trim() || "최고관리자";
const PHONE = process.env["SUPER_ADMIN_PHONE"]?.trim() || "010-0000-0000";

if (!EMAIL) fail("SUPER_ADMIN_EMAIL 이 .env 에 비어 있습니다. 이메일을 채운 뒤 다시 실행하세요.");
if (!PASSWORD) fail("SUPER_ADMIN_PASSWORD 가 .env 에 비어 있습니다. 비밀번호를 채운 뒤 다시 실행하세요.");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(EMAIL)) fail(`SUPER_ADMIN_EMAIL 형식이 올바르지 않습니다: ${EMAIL}`);
if (PASSWORD.length < 8) fail("SUPER_ADMIN_PASSWORD 는 최소 8자 이상으로 설정하세요.");

/** super-admin 시드와 동일한 Argon2id 파라미터 */
async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, {
    algorithm: 2, // Argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function main(): Promise<void> {
  const db = getDb();
  const hashedPassword = await hashPassword(PASSWORD as string);

  await db.transaction(async (tx) => {
    // 1) 마스터(EMAIL) 외 모든 관리자 삭제 — accounts/sessions cascade
    const deleted = await tx
      .delete(schema.adminUsers)
      .where(ne(schema.adminUsers.email, EMAIL as string))
      .returning({ email: schema.adminUsers.email });
    if (deleted.length > 0) {
      console.info(
        `[admin:reset] 마스터 외 기존 관리자 ${deleted.length}건 삭제:`,
        deleted.map((d) => d.email).join(", "),
      );
    } else {
      console.info("[admin:reset] 삭제 대상(마스터 외 관리자) 없음.");
    }

    // 2) 마스터 계정 upsert
    const existing = await tx
      .select({ id: schema.adminUsers.id })
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.email, EMAIL as string))
      .limit(1);

    let adminId: string;
    if (existing[0]) {
      adminId = existing[0].id;
      await tx
        .update(schema.adminUsers)
        .set({ name: NAME, phone: PHONE, role: "super_admin", status: "active", updatedAt: new Date() })
        .where(eq(schema.adminUsers.id, adminId));
      console.info("[admin:reset] 기존 마스터 계정 갱신:", EMAIL);
    } else {
      const [created] = await tx
        .insert(schema.adminUsers)
        .values({ email: EMAIL as string, name: NAME, phone: PHONE, role: "super_admin", status: "active" })
        .returning({ id: schema.adminUsers.id });
      if (!created) throw new Error("admin_users insert 실패");
      adminId = created.id;
      console.info("[admin:reset] 새 마스터 계정 생성:", EMAIL);
    }

    // 3) credential 자격증명(비밀번호) upsert
    const account = await tx
      .select({ id: schema.adminAccounts.id })
      .from(schema.adminAccounts)
      .where(
        and(
          eq(schema.adminAccounts.adminUserId, adminId),
          eq(schema.adminAccounts.providerId, "credential"),
        ),
      )
      .limit(1);

    if (account[0]) {
      await tx
        .update(schema.adminAccounts)
        .set({ accountId: EMAIL as string, password: hashedPassword, updatedAt: new Date() })
        .where(eq(schema.adminAccounts.id, account[0].id));
    } else {
      await tx.insert(schema.adminAccounts).values({
        adminUserId: adminId,
        providerId: "credential",
        accountId: EMAIL as string,
        password: hashedPassword,
      });
    }
  });

  console.info("[admin:reset] 완료 — 이제 관리자 페이지에는 이 super_admin 계정만 존재합니다.");
  console.info(`[admin:reset] 로그인 이메일: ${EMAIL}`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[admin:reset] 오류:", err);
    await closeDb();
    process.exit(1);
  });
