import type { Metadata } from "next";
import { BoardHero, PostWriteForm, type PostWriteFormConfig } from "@/components/board";
import styles from "@/components/board/PostWriteForm.module.css";

export const metadata: Metadata = {
  title: "질문하기 | 묻고답하기 - AI작당",
  description: "묻고답하기에 새 질문을 작성합니다.",
};

/** 묻고답하기 글쓰기 설정 (헤더·팁 박스는 질문 게시판 전용) */
const config: PostWriteFormConfig = {
  header: {
    badgeIcon: "question-answer-line",
    badgeLabel: "묻고답하기",
    title: "질문하기",
    description: "막히는 부분을 구체적으로 적을수록 더 빠르고 정확한 답변을 받을 수 있어요.",
  },
  tip: {
    title: "좋은 질문을 위한 체크리스트",
    items: [
      "무엇을 하려고 했는지 + 어떤 문제가 생겼는지 함께 적어주세요.",
      "사용 중인 도구·버전·에러 메시지를 코드블록으로 붙여주세요.",
      "이미 시도해 본 방법이 있다면 적어주면 중복 답변을 줄일 수 있어요.",
    ],
  },
  titleLabel: "질문 제목",
  titleInputId: "question-title",
  titlePlaceholder:
    "핵심을 한 문장으로 — 예: Claude Code가 PHP 구조를 잘못 이해할 때 컨텍스트 잡는 법?",
  bodyLabel: "질문 내용",
  bodyPlaceholder:
    "질문 내용을 입력하세요. 코드, 에러 메시지, 스크린샷을 함께 올리면 답변받기 쉬워요.",
  tagPlaceholder: "주제 태그를 입력하세요 (예: ClaudeCode)",
  suggestedTags: [
    "ClaudeCode", "Cursor", "n8n", "MCP", "바이브코딩",
    "자동화", "프롬프트", "수익화", "입문", "React",
    "PHP", "배포", "외주", "Make", "Zapier",
  ],
  dropzoneText: "에러 로그·스크린샷을 끌어다 놓거나 클릭해서 선택하세요",
  cancelHref: "/questions",
  submitLabel: "질문 등록",
  submitIcon: "question-answer-line",
  submitAlert: "질문 등록 기능은 아직 개발 중입니다.",
};

export default function QuestionWritePage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로 섹션: 묻고답하기 대메뉴 공통 히어로 */}
      <BoardHero menu="questions" currentSub="묻고답하기" />

      {/* 글쓰기 폼 (모든 게시판 공용) */}
      <PostWriteForm config={config} />
    </main>
  );
}
