import type { Metadata } from "next";
import { BoardHero, PostWriteForm, type PostWriteFormConfig } from "@/components/board";
import styles from "@/components/board/PostWriteForm.module.css";

export const metadata: Metadata = {
  title: "글쓰기 | AI 자동화 - AI작당",
  description: "AI 자동화 게시판에 새 글을 작성합니다.",
};

/** AI 자동화 글쓰기 설정 (게시판별 문구/링크/추천태그만 정의) */
const config: PostWriteFormConfig = {
  titleLabel: "제목",
  titlePlaceholder: "제목을 입력하세요",
  bodyLabel: "본문",
  bodyPlaceholder: "자동화 워크플로, 도구 설정, 적용 사례를 자유롭게 작성하세요.",
  tagPlaceholder: "태그를 입력하세요",
  suggestedTags: [
    "n8n", "Make", "Zapier", "MCP", "자동화",
    "워크플로", "트리거", "API", "Slack", "스프레드시트",
    "요약", "리포트", "스케줄", "Webhook", "배포",
  ],
  dropzoneText: "파일을 끌어다 놓거나 클릭해서 선택하세요",
  cancelHref: "/automation",
  submitLabel: "등록하기",
  board: "automation-guide",
  boardHref: "/automation",
};

export default function AutomationWritePage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로 섹션: AI 자동화 대메뉴 공통 히어로 */}
      <BoardHero menu="automation" currentSub="자동화 가이드" />

      {/* 글쓰기 폼 (모든 게시판 공용) */}
      <PostWriteForm config={config} />
    </main>
  );
}
