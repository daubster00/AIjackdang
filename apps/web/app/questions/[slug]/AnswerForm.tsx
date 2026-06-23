"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import { LightEditor } from "@/components/board";
import styles from "../questions.module.css";

const MAX_LENGTH = 2000;

/**
 * 질문에 답변을 작성하는 폼. 답변은 댓글보다 길게 쓰므로 한도를 2000자로 둔다.
 * 본문은 경량 에디터(LightEditor)를 써서 코드·정렬·링크·이미지 정도의 가벼운 서식을 지원한다.
 */
export function AnswerForm() {
  // 빈 답변 제출을 막기 위한 순수 텍스트 길이와 글자 수 초과 여부
  const [textLength, setTextLength] = useState(0);
  const [isOverLimit, setIsOverLimit] = useState(false);

  return (
    <form className={styles.answerForm}>
      <span className="sr-only" id="answer-label">
        답변 작성
      </span>
      <LightEditor
        ariaLabel="답변 작성"
        placeholder="질문자에게 도움이 되도록 구체적으로 답변해 주세요. (코드/예시/근거를 함께 적으면 채택될 확률이 올라갑니다.)"
        minHeight={180}
        maxLength={MAX_LENGTH}
        onChange={({ text, isOverLimit }) => {
          setTextLength(text.trim().length);
          setIsOverLimit(isOverLimit);
        }}
      />
      <div className={styles.answerFormActions}>
        <Button
          leftIcon={<Icon name="chat-check-line" />}
          disabled={textLength === 0 || isOverLimit}
        >
          답변 등록
        </Button>
      </div>
    </form>
  );
}
