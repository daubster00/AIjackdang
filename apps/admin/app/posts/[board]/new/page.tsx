import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { findBoard } from "@/lib/boards";
import { PostForm } from "../../_components/PostForm";

/**
 * 새 게시글 작성 페이지 (/posts/[board]/new).
 * 공통 PostForm(mode="new")을 사용한다. 입력은 모두 비어 있고, 하단 버튼은 임시저장/발행이다.
 * 동작(서버 액션)은 연결하지 않으며 디자인만 제공한다.
 */
export default async function NewPostPage({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const { board } = await params;
  const meta = findBoard(board);
  if (!meta) notFound();

  return (
    <AdminShell
      breadcrumb={["관리자", "게시글 관리", meta.label, "새 게시글"]}
      activeKey="posts"
      activeSubKey={board}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">새 게시글 작성</h1>
          <p className="page-description">
            <span className={`badge ${meta.badge}`} style={{ marginRight: 6 }}>
              {meta.label}
            </span>
            게시판에 새 게시글을 작성합니다.
          </p>
        </div>
      </div>

      <section className="section" aria-label="새 게시글 작성">
        <PostForm mode="new" board={board} />
      </section>
    </AdminShell>
  );
}
