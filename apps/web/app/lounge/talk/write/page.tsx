import type { Metadata } from "next";
import { BoardHero, PostWriteForm, type PostWriteFormConfig } from "@/components/board";
import styles from "@/components/board/PostWriteForm.module.css";

export const metadata: Metadata = {
  title: "글쓰기 | 작당 수다방 - AI작당",
  description: "작당 수다방에 새 글을 작성합니다.",
};

/**
 * 작당 수다방 글쓰기 설정.
 * 공용 PostWriteForm을 재사용하고 수다방 톤에 맞는 문구·링크·추천태그만 여기서 정의한다.
 * 새 글쓰기 폼을 별도로 만들지 않는다.
 */
const config: PostWriteFormConfig = {
  titleLabel: "제목",
  titlePlaceholder: "수다 주제를 입력하세요",
  bodyLabel: "본문",
  bodyPlaceholder:
    "AI 관련 잡담을 자유롭게 나눠요. 신기한 앱 발견, AI 실패담, 모델 비교 후기 등 주제는 자유입니다.",
  tagPlaceholder: "태그를 입력하세요",
  suggestedTags: [
    "잡담", "AI비교", "AI앱추천", "이미지생성", "프롬프트",
    "실패담", "팁", "음성AI", "ChatGPT", "Claude",
    "공유", "질문", "후기", "추천", "일상",
  ],
  dropzoneText: "파일을 끌어다 놓거나 클릭해서 선택하세요",
  cancelHref: "/lounge/talk",
  submitLabel: "등록하기",
  submitAlert: "등록 기능은 아직 개발 중입니다.",
};

export default function LoungeTalkWritePage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로: lounge 대메뉴 공통 히어로, 현재 서브메뉴 = 작당 수다방 */}
      <BoardHero menu="lounge" currentSub="작당 수다방" />

      {/* 공용 글쓰기 폼. 수다방 전용 config만 주입한다. */}
      <PostWriteForm config={config} />
    </main>
  );
}
