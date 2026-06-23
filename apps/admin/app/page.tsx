import { redirect } from "next/navigation";

// 관리자 진입 시 대시보드로 이동(자리표시).
export default function AdminIndexPage() {
  redirect("/dashboard");
}
