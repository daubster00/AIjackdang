import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * Q&A 새 질문 작성 페이지 — UX-DR-A9 가드레일에 의해 비활성화.
 * 운영자는 Q&A 콘텐츠를 직접 작성·수정할 수 없습니다.
 * 숨김·삭제·상태 변경만 허용됩니다.
 */
export default function QnaNewPage() {
  return (
    <AdminShell breadcrumb={["관리자", "묻고답하기 관리", "새 질문"]} activeKey="qna">
      <div className="page-header">
        <div>
          <h1 className="page-title">새 질문 작성</h1>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/qna">
            <i className="ri-arrow-left-line" />
            목록으로
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
                운영자는 Q&A 콘텐츠를 직접 작성할 수 없습니다.
                질문 작성은 일반 사용자만 할 수 있으며, 운영자는 숨김·삭제·상태 강제 변경만 처리합니다.
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <Link className="btn btn-primary" href="/qna">
                Q&A 관리 목록으로 이동
              </Link>
            </div>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
