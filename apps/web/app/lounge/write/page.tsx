import type { Metadata } from "next";
import { BoardHero, PostWriteForm, type PostWriteFormConfig } from "@/components/board";
import { CreativeSpecFields } from "./CreativeSpecFields";
import styles from "@/components/board/PostWriteForm.module.css";
import specStyles from "./write.module.css";

export const metadata: Metadata = {
  title: "글쓰기 | 작당 라운지 - AI작당",
  description: "작당 라운지에 새 글을 작성합니다.",
};

/** 작당 라운지 글쓰기 설정 (게시판별 문구/링크/추천태그만 정의) */
const config: PostWriteFormConfig = {
  titleLabel: "제목",
  titlePlaceholder: "제목을 입력하세요",
  bodyLabel: "본문",
  bodyPlaceholder: "AI로 만든 창작물이나 직접 개발한 제품을 자유롭게 자랑하고 공유하세요.",
  tagPlaceholder: "태그를 입력하세요",
  suggestedTags: [
    "창작물", "자랑", "사이드프로젝트", "웹툰", "음악",
    "이미지생성", "봇", "디자인", "글쓰기", "영상",
    "취미", "피드백", "회고", "데모", "공유",
  ],
  dropzoneText: "파일을 끌어다 놓거나 클릭해서 선택하세요",
  cancelHref: "/lounge",
  submitLabel: "등록하기",
  board: "ai-creation",
  boardHref: "/lounge",
};

export default function LoungeWritePage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로 섹션: 작당 라운지 대메뉴 공통 히어로 */}
      <BoardHero menu="lounge" currentSub="AI 창작마당" />

      {/* writeLayout 안에 폼 + 창작 스펙 섹션을 함께 배치.
       * CreativeSpecFields는 PostWriteForm과 동일한 860px 너비 제약을 가지며
       * 시각적으로 글쓰기 카드의 연장처럼 보이도록 간격을 좁게 설정한다. */}
      <div className={specStyles.writeContainer}>
        <PostWriteForm config={config} />
        {/* AI 창작마당 전용 창작 스펙 입력 섹션 (선택) */}
        <CreativeSpecFields />
      </div>
    </main>
  );
}
