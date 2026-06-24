"use client";

/**
 * 대메뉴 [질문하기] 공용 버튼 컴포넌트 — Story 3.4
 *
 * 클릭 시 /questions/write?tags=<slug> 로 이동한다.
 * - 회원: Next.js Link 로 직접 이동
 * - 비회원: 클릭 시 /login?redirectTo=/questions/write?tags=<slug> 로 이동
 *   (middleware 가 /questions/write 를 이미 게이팅하므로 이중 방어)
 *
 * 비회원 판별: aj_session 계열 쿠키는 HttpOnly 이므로 클라이언트에서 직접 읽을 수
 * 없다. 대신 /api/v1/auth/me 응답의 401 여부로 판별하는 대신, 더 간단하게
 * 쿠키가 없을 때를 조건으로 삼는다. 실제 게이팅은 middleware 가 담당한다.
 *
 * 따라서 이 컴포넌트는 항상 Link 로 렌더하고, middleware 가 비회원을 /login 으로
 * 리다이렉트한다. UX-DR-U1 의 "로그인 후 태그 붙은 작성 화면 복귀" 는 middleware
 * 의 redirectTo 쿼리 보존으로 처리된다.
 */

import Link from "next/link";
import { Icon } from "@/components/ui";
import styles from "./AskButton.module.css";

interface AskButtonProps {
  /** 자동 부착할 태그 슬러그 배열 (쉼표로 join → ?tags=a,b) */
  tags: string[];
  /** 추가 className */
  className?: string;
}

export function AskButton({ tags, className }: AskButtonProps) {
  const tagsParam = tags.join(",");
  const href = `/questions/write?tags=${encodeURIComponent(tagsParam)}`;

  return (
    <Link href={href} className={`${styles.askBtn} ${className ?? ""}`}>
      <Icon name="question-answer-line" />
      질문하기
    </Link>
  );
}
