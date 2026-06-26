import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { findBoard } from "@/lib/boards";
import { PostForm } from "../../../_components/PostForm";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ board: string; id: string }>;
}) {
  const { board, id } = await params;
  const meta = findBoard(board);
  if (!meta) notFound();

  return (
    <AdminShell
      breadcrumb={["관리자", "게시글 관리", meta.label, `#${id} 수정`]}
      activeKey="posts"
      activeSubKey={board}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">게시글 수정</h1>
          <p className="page-description">
            <span className={`badge ${meta.badge}`} style={{ marginRight: 6 }}>
              {meta.label}
            </span>
            게시글 #{id} 을(를) 수정합니다.
          </p>
        </div>
      </div>

      <section className="section" aria-label="게시글 수정">
        <PostForm mode="edit" board={board} postId={id} />
      </section>
    </AdminShell>
  );
}
