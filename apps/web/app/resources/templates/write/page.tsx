/**
 * /resources/templates/write → /resources/new 리다이렉트 (Story 4.4)
 *
 * 단일 7-Step 등록 폼(/resources/new)으로 통합됨.
 * 기존 링크 유입 시 깨진 링크 없이 새 등록 폼으로 이동한다.
 */

import { redirect } from "next/navigation";

export default function TemplatesWriteRedirect() {
  redirect("/resources/new");
}
