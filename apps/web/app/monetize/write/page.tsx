import type { Metadata } from "next";
import { BoardHero, PostWriteForm, type PostWriteFormConfig } from "@/components/board";
import styles from "@/components/board/PostWriteForm.module.css";

export const metadata: Metadata = {
  title: "글쓰기 | AI 수익화 - AI작당",
  description: "AI 수익화 게시판에 새 글을 작성합니다.",
};

/** AI 수익화 글쓰기 설정 (게시판별 문구/링크/추천태그만 정의) */
const config: PostWriteFormConfig = {
  titleLabel: "제목",
  titlePlaceholder: "제목을 입력하세요",
  bodyLabel: "본문",
  bodyPlaceholder: "외주·판매 노하우, 견적과 계약 팁, 수익화 사례를 자유롭게 작성하세요.",
  tagPlaceholder: "태그를 입력하세요",
  suggestedTags: [
    "외주", "견적", "협상", "계약", "프롬프트",
    "판매", "수익", "서비스화", "단가", "디자인",
    "마케팅", "고객", "후기", "납기", "수정",
  ],
  dropzoneText: "파일을 끌어다 놓거나 클릭해서 선택하세요",
  cancelHref: "/monetize",
  submitLabel: "등록하기",
  board: "monetization-tips",
  boardHref: "/monetize",
};

export default function MonetizeWritePage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로 섹션: AI 수익화 대메뉴 공통 히어로 */}
      <BoardHero menu="monetize" currentSub="외주·판매 팁" />

      {/* 글쓰기 폼 (모든 게시판 공용) */}
      <PostWriteForm config={config} />
    </main>
  );
}
