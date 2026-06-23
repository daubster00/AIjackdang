import type { Metadata } from "next";
import { BoardHero, PostWriteForm, type PostWriteFormConfig } from "@/components/board";
import styles from "@/components/board/PostWriteForm.module.css";

export const metadata: Metadata = {
  title: "글쓰기 | 내가 만든 AI 제품 - AI작당",
  description: "내가 만든 AI 제품을 소개하는 새 글을 작성합니다.",
};

/**
 * 내가 만든 AI 제품 글쓰기 설정.
 * 공용 PostWriteForm을 재사용하고 제품 소개 톤에 맞는 문구·링크·추천태그만 여기서 정의한다.
 * 창작 스펙(CreativeSpecFields)은 AI 창작마당(/lounge/write) 전용이므로 여기엔 포함하지 않는다.
 */
const config: PostWriteFormConfig = {
  titleLabel: "제목",
  titlePlaceholder: "제목을 입력하세요",
  bodyLabel: "본문",
  bodyPlaceholder:
    "직접 만든 AI 제품을 소개해 주세요. 어떤 문제를 풀어주는지, 만든 과정과 사용 방법, 사용한 기술 등을 자유롭게 공유하세요.",
  tagPlaceholder: "태그를 입력하세요",
  suggestedTags: [
    "사이드프로젝트", "출시", "생산성", "크롬확장", "봇",
    "학습", "데모", "웹앱", "모바일앱", "API",
    "회고", "피드백", "공유", "스타트업", "MVP",
  ],
  dropzoneText: "파일을 끌어다 놓거나 클릭해서 선택하세요",
  cancelHref: "/lounge/products",
  submitLabel: "등록하기",
  submitAlert: "등록 기능은 아직 개발 중입니다.",
};

export default function LoungeProductsWritePage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로: lounge 대메뉴 공통 히어로, 현재 서브메뉴 = 내가 만든 AI 제품 */}
      <BoardHero menu="lounge" currentSub="내가 만든 AI 제품" />

      {/* 공용 글쓰기 폼. 제품 전용 config만 주입한다. 창작 스펙 섹션 없음. */}
      <PostWriteForm config={config} />
    </main>
  );
}
