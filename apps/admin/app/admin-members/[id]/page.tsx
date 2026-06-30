import { AdminShell } from "@/components/layout/AdminShell";
import { AdminMemberDetailClient } from "./AdminMemberDetailClient";

/**
 * 관리회원 상세 페이지 (서버 컴포넌트 셸).
 *
 * params.id(관리회원 고유 식별자)를 받아 클라이언트 컴포넌트에 전달한다.
 * 실제 데이터 조회 및 모달 로직은 AdminMemberDetailClient 에서 처리한다.
 * Next 15+ 규약: params 는 Promise<{ id: string }> 로 타입 선언 후 await 한다.
 */
export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // id(관리회원 고유 식별자)를 await 로 언래핑
  const { id } = await params;

  return (
    <AdminShell
      breadcrumb={["관리자", "관리회원 관리", "상세"]}
      activeKey="admin-members"
      activeSubKey=""
    >
      <AdminMemberDetailClient memberId={id} />
    </AdminShell>
  );
}
