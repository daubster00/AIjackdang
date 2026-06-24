/**
 * Initial super_admin seed (ADR-0003, Story 9.1 AC#6).
 *
 * Idempotent: skips if the email already exists.
 * Password is read from SUPER_ADMIN_PASSWORD env var.
 * Argon2id hash is performed with @node-rs/argon2.
 *
 * Required env vars:
 *   SUPER_ADMIN_EMAIL     (default: superadmin@ai-jakdang.com)
 *   SUPER_ADMIN_NAME      (default: system_admin)
 *   SUPER_ADMIN_PHONE     (default: 010-0000-0000)
 *   SUPER_ADMIN_PASSWORD  (default: ChangeMe123!)
 *   DATABASE_URL          - PostgreSQL connection string
 */

import { hash as argon2Hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { getDb } from "../index.js";
import { adminUsers, adminAccounts } from "../schema/admin.js";

const SUPER_ADMIN_EMAIL    = process.env["SUPER_ADMIN_EMAIL"]    ?? "superadmin@ai-jakdang.com";
const SUPER_ADMIN_NAME     = process.env["SUPER_ADMIN_NAME"]     ?? "system_admin";
const SUPER_ADMIN_PHONE    = process.env["SUPER_ADMIN_PHONE"]    ?? "010-0000-0000";
const SUPER_ADMIN_PASSWORD = process.env["SUPER_ADMIN_PASSWORD"] ?? "ChangeMe123!";

async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, {
    algorithm: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function seedSuperAdmin(): Promise<void> {
  const db = getDb();

  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, SUPER_ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.info("[seed] super_admin already exists:", SUPER_ADMIN_EMAIL, "- skipping.");
    return;
  }

  const hashedPassword = await hashPassword(SUPER_ADMIN_PASSWORD);

  await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(adminUsers)
      .values({
        email: SUPER_ADMIN_EMAIL,
        name: SUPER_ADMIN_NAME,
        phone: SUPER_ADMIN_PHONE,
        role: "super_admin",
        status: "active",
      })
      .returning({ id: adminUsers.id });

    if (!newUser) throw new Error("Failed to insert admin_users row");

    await tx.insert(adminAccounts).values({
      adminUserId: newUser.id,
      providerId: "credential",
      accountId: SUPER_ADMIN_EMAIL,
      password: hashedPassword,
    });
  });

  console.info("[seed] super_admin created:", SUPER_ADMIN_EMAIL);
  console.warn("[seed] WARNING: Change SUPER_ADMIN_PASSWORD immediately!");
}

const isMain =
  process.argv[1]?.endsWith("super-admin.ts") ||
  process.argv[1]?.endsWith("super-admin.js");

if (isMain) {
  seedSuperAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[seed] Error:", err);
      process.exit(1);
    });
}
