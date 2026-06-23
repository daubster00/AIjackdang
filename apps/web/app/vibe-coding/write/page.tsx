import type { Metadata } from "next";
import { BoardHero, PostWriteForm, type PostWriteFormConfig } from "@/components/board";
import styles from "@/components/board/PostWriteForm.module.css";

export const metadata: Metadata = {
  title: "글쓰기 | 바이브코딩 가이드 - AI작당",
  description: "바이브코딩 가이드에 새 글을 작성합니다.",
};

/** 바이브코딩 가이드 글쓰기 설정 (게시판별 문구/링크/추천태그만 정의) */
const config: PostWriteFormConfig = {
  titleLabel: "제목",
  titlePlaceholder: "제목을 입력하세요",
  bodyLabel: "본문",
  bodyPlaceholder: "내용을 입력하세요. 코드, 이미지, 링크를 자유롭게 사용할 수 있습니다.",
  tagPlaceholder: "태그를 입력하세요",
  suggestedTags: [
    "ClaudeCode", "Cursor", "n8n", "MCP", "바이브코딩",
    "자동화", "프롬프트", "수익화", "React", "PHP",
    "Make", "Zapier", "Rules", "Codex", "배포",
  ],
  dropzoneText: "파일을 끌어다 놓거나 클릭해서 선택하세요",
  cancelHref: "/vibe-coding",
  submitLabel: "등록하기",
  board: "vibe-coding-guide",
  boardHref: "/vibe-coding",
};

export default function VibeCodingWritePage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로 섹션: 바이브 코딩 대메뉴 공통 히어로 */}
      <BoardHero menu="vibe-coding" currentSub="바이브코딩 가이드" />

      {/* 글쓰기 폼 (모든 게시판 공용) */}
      <PostWriteForm config={config} />
    </main>
  );
}
