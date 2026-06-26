"use client";

import { useState } from "react";
import type { PostWriteFormConfig } from "@/components/board";
import { PostWriteForm } from "@/components/board";
import type { CreativeSpec } from "@ai-jakdang/contracts";
import { CreativeSpecFields } from "./CreativeSpecFields";

/** 정적 config (서버 컴포넌트에서 넘겨줄 값) */
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

/**
 * AI 창작마당 글쓰기 — 클라이언트 컴포넌트 래퍼.
 * Story 2.11: CreativeSpecFields에서 수집한 spec을 PostWriteForm에 주입.
 * item 13: CreativeSpecFields를 PostWriteForm 카드 안 afterAttachment 슬롯에 주입.
 *   기존처럼 폼 바깥에 별도 카드로 렌더하지 않는다.
 */
export function LoungeWriteClient() {
  const [creativeSpec, setCreativeSpec] = useState<CreativeSpec | null>(null);

  const configWithSpec: PostWriteFormConfig = {
    ...config,
    creativeSpec: creativeSpec ?? undefined,
  };

  return (
    <PostWriteForm
      config={configWithSpec}
      afterAttachment={
        <CreativeSpecFields onSpecChange={setCreativeSpec} />
      }
    />
  );
}
