"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { resolveRank, rankTierFromGradeLevel, type RankTier } from "@/lib/ranks";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast/Toast";
import { RankBadge } from "../RankBadge";
import { MessageModal } from "../MessageModal";
import { Icon } from "../Icon";
import styles from "./AuthorName.module.css";


const TIER_ORDER: RankTier[] = ["rookie", "member", "practitioner", "expert", "master"];

/** 닉네임 문자열로부터 등급을 결정적으로 도출 (목업 데이터에 rank 가 없을 때 다양하게 보이도록) */
function rankFromName(name: string): RankTier {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return TIER_ORDER[sum % TIER_ORDER.length];
}

export interface AuthorNameProps {
  /** 표시할 닉네임 */
  name: string;
  /**
   * 작성자 userId. 쪽지 보내기 모달의 recipientId에 전달된다.
   * 미지정이면 쪽지 발송 API 호출이 비활성화된다.
   */
  authorId?: string;
  /** 등급(키 또는 한국어 라벨). 미지정 시 닉네임으로부터 결정적으로 도출 */
  rank?: RankTier | string;
  /** gradeLevel(1~5) — API 응답의 숫자 레벨을 직접 전달할 때 사용 (AC#5, Story 6.6).
   *  rank prop보다 우선 적용된다. 미지정 시 rank prop 또는 닉네임 기반 폴백 사용. */
  gradeLevel?: number;
  /** 등급 뱃지 한 변 크기(px). 기본 16 */
  badgeSize?: number;
  /** 등급명 라벨 텍스트도 함께 표기할지. 기본 false (뱃지 이미지만) */
  showLabel?: boolean;
  /** 트리거(닉네임)에 붙일 추가 클래스 */
  className?: string;
  /** 쪽지 모달 아바타에 사용할 작성자 프로필 이미지 URL */
  authorAvatarUrl?: string | null;
}

/**
 * 게시글·댓글 작성자 닉네임 표기 공용 컴포넌트.
 * - 닉네임을 클릭하면 작은 메뉴(쪽지 보내기 / 팔로우 / 계정 바로가기)가 열린다.
 *   "쪽지 보내기"는 쪽지 발송 모달을 띄우고, "계정 바로가기"는 공개 프로필로 이동한다(디자인 단계엔 공용 샘플 프로필).
 * - 닉네임 옆에 항상 등급 뱃지를 함께 표기한다(lib/ranks + RankBadge 사용).
 * - 메뉴는 카드의 overflow:hidden 에 잘리지 않도록 body 포털에 fixed 로 렌더한다.
 */
export function AuthorName({ name, authorId, rank, gradeLevel, badgeSize = 16, showLabel = false, className, authorAvatarUrl }: AuthorNameProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  // 본인 여부 — 닉네임 일치(항상 사용 가능) 또는 userId 일치(authorId 전달 시) 중 하나라도 맞으면 본인.
  // authorId 없이 name만 넘기는 호출부도 닉네임 비교로 커버한다.
  const isSelf = !!user && (
    (!!user.nickname && user.nickname === name) ||
    (!!authorId && user.id === authorId)
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // gradeLevel(숫자) 우선 → rank(키/라벨) → 닉네임 해시 폴백
  const resolved: RankTier | string = gradeLevel !== undefined
    ? rankTierFromGradeLevel(gradeLevel)
    : (rank && resolveRank(rank) ? rank : rankFromName(name));

  function openMenu() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
    setMenuOpen(true);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onReposition() {
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    // 스크롤/리사이즈 시에는 위치가 어긋나므로 닫는다.
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [menuOpen]);

  return (
    <span className={cn(styles.root, className)}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
        title={`${name} 님`}
      >
        <span className={styles.name}>{name}</span>
        <RankBadge
          rank={resolved}
          size={badgeSize}
          showLabel={showLabel}
          ariaLabel={`등급: ${resolveRank(resolved)?.label ?? String(resolved)}`}
        />
      </button>

      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className={styles.menu}
            style={{ top: pos.top, left: pos.left }}
          >
            <div className={styles.menuHeader}>{name}</div>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                setMenuOpen(false);
                if (isSelf) {
                  toast({ tone: "warning", title: "자기 자신에게는 쪽지를 보낼 수 없습니다." });
                  return;
                }
                setDmOpen(true);
              }}
            >
              <Icon name="mail-send-line" />
              쪽지 보내기
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                setMenuOpen(false);
                if (isSelf) {
                  toast({ tone: "warning", title: "자기 자신은 팔로우할 수 없습니다." });
                  return;
                }
                if (!authorId) {
                  toast({ tone: "warning", title: "팔로우 대상 정보를 찾을 수 없습니다." });
                  return;
                }
                if (following) {
                  // 언팔로우: DELETE /api/v1/follows/:targetNickname
                  void fetch(`/api/v1/follows/${encodeURIComponent(name)}`, {
                    method: "DELETE",
                    credentials: "include",
                  })
                    .then((res) => {
                      if (res.ok || res.status === 204) {
                        setFollowing(false);
                        toast({ tone: "success", title: "팔로우를 취소했습니다." });
                      } else {
                        toast({ tone: "danger", title: "언팔로우에 실패했습니다." });
                      }
                    })
                    .catch(() => toast({ tone: "danger", title: "언팔로우 중 오류가 발생했습니다." }));
                } else {
                  // 팔로우: POST /api/v1/follows
                  void fetch("/api/v1/follows", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ followingId: authorId }),
                  })
                    .then((res) => {
                      if (res.ok || res.status === 201) {
                        setFollowing(true);
                        toast({ tone: "success", title: "팔로우했습니다." });
                      } else {
                        toast({ tone: "danger", title: "팔로우에 실패했습니다." });
                      }
                    })
                    .catch(() => toast({ tone: "danger", title: "팔로우 중 오류가 발생했습니다." }));
                }
              }}
            >
              <Icon name={following ? "user-follow-line" : "user-add-line"} />
              {following ? "팔로잉" : "팔로우"}
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              disabled={blocking}
              onClick={() => {
                if (isSelf) {
                  toast({ tone: "warning", title: "자기 자신은 차단할 수 없습니다." });
                  return;
                }
                if (!window.confirm(`${name} 님을 차단하시겠습니까?`)) return;
                setBlocking(true);
                void fetch("/api/v1/blocks", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ blockedNickname: name }),
                })
                  .then((res) => {
                    if (res.ok || res.status === 409) {
                      window.location.reload();
                    }
                  })
                  .catch(() => null)
                  .finally(() => setBlocking(false));
                setMenuOpen(false);
              }}
            >
              <Icon name="user-forbid-line" />
              {blocking ? "처리 중..." : "차단하기"}
            </button>
            <Link
              href={`/u/${encodeURIComponent(name)}`}
              role="menuitem"
              className={styles.menuItem}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name="external-link-line" />
              계정 바로가기
            </Link>
          </div>,
          document.body,
        )}

      <MessageModal
        open={dmOpen}
        onClose={() => setDmOpen(false)}
        recipient={name}
        recipientId={authorId ?? ""}
        recipientAvatarUrl={authorAvatarUrl ?? undefined}
      />
    </span>
  );
}
