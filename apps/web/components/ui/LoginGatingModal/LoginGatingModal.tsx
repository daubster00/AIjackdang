"use client";

/**
 * 로그인 유도 모달 (Story 1.7 — AC #2, #3, #4, #7).
 *
 * 비회원이 행동 진입점을 클릭했을 때 표시된다.
 * - AI작당 가입 혜택 가치 강조 (UX-DR-U15: 차분한 실전 동료 톤)
 * - [로그인] → /login?redirectTo={현재URL+행동힌트}
 * - [가입하기] → /signup?redirectTo={현재URL+행동힌트}
 * - Esc·바깥 클릭·닫기 버튼으로 닫기 (Modal이 처리)
 * - 포커스 트랩·배경 스크롤 잠금 (Modal이 처리, UX-DR-U13)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import styles from "./LoginGatingModal.module.css";

const BENEFITS = [
  { icon: "download-2-line", text: "실전자료를 바로 다운로드" },
  { icon: "question-answer-line", text: "질문 올리고 답변받기" },
  { icon: "heart-3-line", text: "좋아요·댓글로 의견 나누기" },
] as const;

export interface LoginGatingModalProps {
  open: boolean;
  onClose: () => void;
  /** 시도한 행동 힌트. redirectTo 쿼리에 포함됨. */
  intendedAction?: string;
  /**
   * 로그인/가입 후 이동할 경로를 직접 지정할 때 사용.
   * 지정하면 intendedAction 무시. 예: "/resources/slug?download=true" (Story 4.6)
   */
  redirectOverride?: string;
}

export function LoginGatingModal({ open, onClose, intendedAction, redirectOverride }: LoginGatingModalProps) {
  const pathname = usePathname();

  const returnTo = redirectOverride
    ? redirectOverride
    : intendedAction
      ? `${pathname}?action=${encodeURIComponent(intendedAction)}`
      : pathname;

  const loginHref = `/login?redirectTo=${encodeURIComponent(returnTo)}`;
  const signupHref = `/signup?redirectTo=${encodeURIComponent(returnTo)}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI작당 회원이 되면"
      size="sm"
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Link href={signupHref} onClick={onClose} className={styles.signupLink}>
            가입하기
          </Link>
          <Link href={loginHref} onClick={onClose}>
            <Button variant="primary">로그인</Button>
          </Link>
        </div>
      }
    >
      <div className={styles.content}>
        <div className={styles.iconWrapper} aria-hidden="true">
          <Icon name="user-add-line" />
        </div>

        <p className={styles.subtitle}>
          30초 가입으로 시작할 수 있어요.
        </p>

        <ul className={styles.benefits} aria-label="AI작당 회원 혜택">
          {BENEFITS.map(({ icon, text }) => (
            <li key={text} className={styles.benefitItem}>
              <span className={styles.benefitIcon} aria-hidden="true">
                <Icon name={icon} />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
