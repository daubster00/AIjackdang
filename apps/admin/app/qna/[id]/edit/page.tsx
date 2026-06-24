import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * Q&A 질문 수정 페이지 — UX-DR-A9 가드레일에 의해 비활성화.
 * 운영자는 Q&A 콘텐츠를 직접 수정할 수 없습니다.
 * 숨김·삭제·상태 강제 변경은 상세 페이지(/qna/[id])에서 처리하세요.
 */
export default async function QnaEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AdminShell breadcrumb={["관리자", "묻고답하기 관리", "질문 수정"]} activeKey="qna">
      <div className="page-header">
        <div>
          <h1 className="page-title">질문 수정</h1>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href={`/qna/${id}`}>
            <i className="ri-arrow-left-line" />
            상세로 돌아가기
          </Link>
        </div>
      </div>
      <section className="section">
        <article className="card">
          <div className="card-body">
            <div className="alert alert-warning">
              <i className="ri-prohibited-line" />
              <div>
                <strong>기능 비활성화 (UX-DR-A9)</strong>
                <br />
                운영자는 Q&A 콘텐츠를 직접 수정할 수 없습니다.
                Q&A 상태 강제 변경·숨김·삭제는 상세 페이지에서 처리하세요.
              </div>
            </div>
            <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
              <Link className="btn btn-primary" href={`/qna/${id}`}>
                상세 페이지로 이동
              </Link>
              <Link className="btn btn-outline" href="/qna">
                목록으로 이동
              </Link>
            </div>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
