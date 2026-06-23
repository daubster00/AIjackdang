import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { findBoard } from "@/lib/boards";
import { PostForm } from "../../../_components/PostForm";

/**
 * 게시글 수정 페이지 (/posts/[board]/[id]/edit).
 * 공통 PostForm(mode="edit")을 사용한다. 더미 기본값(defaults)으로 기존 글 값을 채운다.
 * 하단 버튼은 삭제(danger, 디자인만)/수정 저장이며 동작은 연결하지 않는다.
 */

/** 수정 화면에 미리 채울 더미 기본값(실제로는 id 로 조회한 값). */
const EDIT_DEFAULTS = {
  title: "Claude Code로 기존 PHP 프로젝트 한 번에 분석시키는 프롬프트",
  content:
    "기존 레거시 PHP 프로젝트를 Claude Code에 통째로 물려서 구조를 파악시키는 방법을 공유합니다.\n핵심은 디렉터리 단위로 요약 → 의존성 그래프 → 위험 지점 순으로 단계를 쪼개는 것입니다.",
  tags: ["ClaudeCode", "PHP", "코드분석", "프롬프트"],
  notice: false,
  pinned: true,
  featured: true,
  main: true,
  visibility: "public" as const,
};

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
        <PostForm mode="edit" board={board} defaults={EDIT_DEFAULTS} />
      </section>
    </AdminShell>
  );
}
