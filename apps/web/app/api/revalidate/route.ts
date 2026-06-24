/**
 * On-Demand Revalidation Route Handler — Story 8.9 (AR-17)
 *
 * apps/api(Fastify)가 글 작성/수정/삭제 후 이 엔드포인트를 HTTP로 호출한다.
 * x-revalidate-secret 헤더로 무단 호출을 방지한다.
 *
 * POST /api/revalidate
 * Body: { path?: string; tag?: string }
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { path?: string; tag?: string };
  const { path, tag } = body;

  if (path) revalidatePath(path, "page");
  if (tag) revalidateTag(tag, "default");

  return NextResponse.json({ revalidated: true, path, tag });
}
