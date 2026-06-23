"use client";

/**
 * 코드블록 복사 버튼 — Story 2.6 (AC #4).
 *
 * 서버 컴포넌트가 렌더한 `dangerouslySetInnerHTML` HTML 안의
 * `pre code` 요소에 [복사] 버튼을 동적으로 삽입한다.
 *
 * 사용법:
 *   <CodeBlockCopyButton html={post.contentHtml} />
 *
 * 이 컴포넌트는 `useEffect` 로 마운트 후 DOM 을 조작하므로
 * 가로 스크롤·복사 버튼이 SSR 에서는 나타나지 않고 하이드레이션 이후에 활성화된다.
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui";
import styles from "./CodeBlockCopyButton.module.css";

interface CodeBlockCopyButtonProps {
  /** 서버에서 새니타이즈된 HTML 문자열 */
  html: string;
  /** 추가 CSS 클래스 */
  className?: string;
}

export function CodeBlockCopyButton({ html, className }: CodeBlockCopyButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const codeBlocks = container.querySelectorAll<HTMLElement>("pre code");

    const cleanups: Array<() => void> = [];

    codeBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (!pre || pre.querySelector(`.${styles.copyBtn}`)) {
        // 이미 버튼이 삽입된 경우 중복 삽입 방지
        return;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = styles.copyBtn;
      btn.setAttribute("aria-label", "코드 복사");
      btn.textContent = "복사";

      const handleClick = () => {
        const code = codeEl.textContent ?? "";
        navigator.clipboard
          .writeText(code)
          .then(() => {
            btn.textContent = "✓ 복사됨";
            toast({ tone: "success", title: "코드가 복사되었습니다." });
            setTimeout(() => {
              btn.textContent = "복사";
            }, 2000);
          })
          .catch(() => {
            toast({ tone: "danger", title: "복사에 실패했습니다.", description: "브라우저가 클립보드 접근을 허용하지 않습니다." });
          });
      };

      btn.addEventListener("click", handleClick);
      pre.appendChild(btn);

      cleanups.push(() => {
        btn.removeEventListener("click", handleClick);
        if (pre.contains(btn)) pre.removeChild(btn);
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [html, toast]);

  return (
    <div
      ref={containerRef}
      className={[styles.articleContent, className].filter(Boolean).join(" ")}
      // html 은 서버에서 sanitize-html 로 이미 정제된 값이다.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
