"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, Badge, Button, EmptyState, Icon, Modal } from "@/components/ui";
import styles from "./notifications.module.css";

/**
 * 알림 유형.
 * - reply: 내 글/답변에 달린 댓글·답변
 * - like: 내 글/답변을 좋아요·추천
 * - mention: 댓글에서 나를 멘션(@닉네임)
 * - accept: 내 답변이 채택됨
 * - rank: 등급 상승 (시스템)
 * - notice: 운영 공지 (시스템)
 */
type NotifType = "reply" | "like" | "mention" | "accept" | "rank" | "notice";

/** 날짜 그룹: 오늘 / 이번 주 / 이전 */
type NotifGroup = "today" | "week" | "earlier";

interface Notification {
  id: string;
  type: NotifType;
  /** 알림을 발생시킨 사람(시스템 알림이면 null) */
  actor: string | null;
  /** 행동 설명 (actor 뒤에 이어지는 문장) */
  action: string;
  /** 대상 글/답변 제목 */
  target: string;
  /** 출처 게시판 라벨 */
  board: string;
  /** 상대 시간 */
  time: string;
  href: string;
  read: boolean;
  group: NotifGroup;
  /**
   * 시스템 알림(등급·공지) 전용 상세 본문.
   * 값이 있으면 클릭 시 이동 대신 모달로 전체 내용을 보여준다.
   * cta 가 있으면 모달 하단에 이동 버튼을 노출한다.
   */
  detail?: {
    body: string;
    cta?: { label: string; href: string };
  };
}

/** 유형별 아이콘 + 색 토널 (아바타 위 작은 배지 / 시스템 알림의 큰 아이콘에 공통 사용) */
const typeMeta: Record<
  NotifType,
  { icon: string; toneClass: string; label: string }
> = {
  reply: { icon: "chat-3-line", toneClass: "toneReply", label: "댓글·답변" },
  like: { icon: "heart-3-fill", toneClass: "toneLike", label: "좋아요" },
  mention: { icon: "at-line", toneClass: "toneMention", label: "멘션" },
  accept: { icon: "check-double-line", toneClass: "toneAccept", label: "답변 채택" },
  rank: { icon: "medal-line", toneClass: "toneRank", label: "등급" },
  notice: { icon: "megaphone-line", toneClass: "toneNotice", label: "공지" },
};

/** 필터 탭 정의 */
const filters = [
  { value: "all", label: "전체" },
  { value: "unread", label: "안 읽음" },
  { value: "reply", label: "댓글·답변" },
  { value: "like", label: "좋아요" },
  { value: "mention", label: "멘션" },
  { value: "system", label: "시스템" },
] as const;

type FilterValue = (typeof filters)[number]["value"];

const initialNotifications: Notification[] = [
  {
    id: "n1",
    type: "reply",
    actor: "자동화카페",
    action: "님이 회원님의 질문에 답변을 남겼습니다.",
    target: "Claude Code가 기존 PHP 구조를 계속 잘못 이해합니다",
    board: "묻고답하기",
    time: "방금 전",
    href: "/questions/claude-code-php-misunderstanding",
    read: false,
    group: "today",
  },
  {
    id: "n2",
    type: "mention",
    actor: "리뷰메이트",
    action: "님이 댓글에서 회원님을 언급했습니다.",
    target: "n8n으로 Gmail 문의를 자동 분류할 수 있을까요?",
    board: "묻고답하기",
    time: "32분 전",
    href: "/questions/n8n-gmail-auto-classify",
    read: false,
    group: "today",
  },
  {
    id: "n3",
    type: "like",
    actor: "프론트라인",
    action: "님 외 11명이 회원님의 글을 좋아합니다.",
    target: "바이브 코딩으로 사이드 프로젝트 2주 만에 출시한 후기",
    board: "바이브 코딩",
    time: "2시간 전",
    href: "/vibe-coding/side-project-2weeks",
    read: false,
    group: "today",
  },
  {
    id: "n4",
    type: "accept",
    actor: "기획하는사람",
    action: "님이 회원님의 답변을 채택했습니다.",
    target: "비개발자인데 어떤 AI 코딩 툴부터 써야 할까요?",
    board: "묻고답하기",
    time: "5시간 전",
    href: "/questions/which-ai-tool-for-beginner",
    read: true,
    group: "today",
  },
  {
    id: "n5",
    type: "rank",
    actor: null,
    action: "축하합니다! 등급이 '실무자'로 올랐습니다.",
    target: "활동 점수 1,200점 달성",
    board: "AI작당",
    time: "어제",
    href: "#profile",
    read: true,
    group: "week",
    detail: {
      body: "그동안의 활동으로 등급이 '입문자'에서 '실무자'로 상승했습니다.\n\n실무자 등급부터는 글에 이미지 5장까지 첨부할 수 있고, 작당 라운지에 작업물을 등록할 수 있습니다. 다음 등급 '전문가'까지는 활동 점수 1,800점이 필요해요.",
      cta: { label: "내 등급 보기", href: "#profile" },
    },
  },
  {
    id: "n6",
    type: "reply",
    actor: "코드작당러",
    action: "님이 회원님의 답변에 댓글을 남겼습니다.",
    target: "프롬프트를 어떻게 짜야 답변 품질이 올라가나요?",
    board: "묻고답하기",
    time: "2일 전",
    href: "/questions/prompt-structure-tips",
    read: true,
    group: "week",
  },
  {
    id: "n7",
    type: "notice",
    actor: null,
    action: "실전자료 게시판에 새 카테고리 'MCP·Skills'가 열렸습니다.",
    target: "운영 공지 — 실전자료 개편 안내",
    board: "공지사항",
    time: "4일 전",
    href: "/resources/mcp-skills",
    read: true,
    group: "earlier",
    detail: {
      body: "실전자료 게시판을 4개 카테고리(프롬프트 / MCP·Skills / Rules·설정 / 템플릿·체크리스트)로 개편했습니다.\n\n특히 새로 추가된 'MCP·Skills' 카테고리에서는 실제 업무에 바로 쓰는 MCP 서버 설정과 스킬 모음을 공유합니다. 기존에 올라온 자료는 자동으로 알맞은 카테고리로 이동되었습니다.",
      cta: { label: "MCP·Skills 보러 가기", href: "/resources/mcp-skills" },
    },
  },
  {
    id: "n8",
    type: "like",
    actor: "사이드프로젝트",
    action: "님 외 4명이 회원님의 답변을 추천합니다.",
    target: "AI 자동화 외주 견적은 얼마가 적당할까요?",
    board: "묻고답하기",
    time: "6일 전",
    href: "/questions/automation-outsourcing-quote",
    read: true,
    group: "earlier",
  },
];

const groupLabels: Record<NotifGroup, string> = {
  today: "오늘",
  week: "이번 주",
  earlier: "이전",
};

const groupOrder: NotifGroup[] = ["today", "week", "earlier"];

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<FilterValue>("all");
  /** 모달로 열려 있는 알림 (없으면 null) */
  const [activeNotif, setActiveNotif] = useState<Notification | null>(null);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const visible = useMemo(() => {
    return items.filter((n) => {
      switch (filter) {
        case "all":
          return true;
        case "unread":
          return !n.read;
        case "system":
          return n.type === "rank" || n.type === "notice";
        default:
          return n.type === filter;
      }
    });
  }, [items, filter]);

  /** 필터 적용 후 날짜 그룹별로 묶는다 */
  const grouped = useMemo(() => {
    return groupOrder
      .map((group) => ({
        group,
        list: visible.filter((n) => n.group === group),
      }))
      .filter((section) => section.list.length > 0);
  }, [visible]);

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  /** 알림 클릭 시: 읽음 처리 후 상세 모달을 연다 (이동은 모달 안 버튼으로) */
  function openDetail(notif: Notification) {
    markRead(notif.id);
    setActiveNotif(notif);
  }

  /** 모달의 "게시글 바로 보기" 등 이동 버튼이 가리킬 경로(시스템 알림은 detail.cta, 일반 알림은 href) */
  const moveTarget = activeNotif
    ? activeNotif.detail?.cta ?? { label: "게시글 바로 보기", href: activeNotif.href }
    : null;

  return (
    <main id="main" className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headInner}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              <Icon name="notification-3-line" />
              알림
            </h1>
            {unreadCount > 0 && (
              <Badge tone="primary" variant="solid" className={styles.unreadBadge}>
                안 읽음 {unreadCount}
              </Badge>
            )}
          </div>

          <div className={styles.headActions}>
            <button
              type="button"
              className={styles.markAllButton}
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <Icon name="check-double-line" />
              모두 읽음
            </button>
            <Link href="/settings/notifications" className={styles.settingsLink} aria-label="알림 설정">
              <Icon name="settings-3-line" />
            </Link>
          </div>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="알림 필터">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              className={styles.tab}
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.listLayout}>
        {grouped.length === 0 ? (
          <EmptyState
            icon="notification-off-line"
            title="표시할 알림이 없어요"
            description="새로운 댓글·답변·좋아요가 생기면 여기에서 가장 먼저 알려드릴게요."
          />
        ) : (
          grouped.map((section) => (
            <section key={section.group} className={styles.group} aria-label={groupLabels[section.group]}>
              <h2 className={styles.groupLabel}>{groupLabels[section.group]}</h2>
              <ul className={styles.list}>
                {section.list.map((n) => (
                  <NotificationRow key={n.id} notif={n} onOpen={() => openDetail(n)} />
                ))}
              </ul>
            </section>
          ))
        )}

        {grouped.length > 0 && (
          <button type="button" className={styles.loadMore}>
            지난 알림 더 보기
          </button>
        )}
      </div>

      {/* 알림 상세 모달 (모든 알림 클릭 시 열림 → 이동은 모달 안 버튼으로) */}
      <Modal
        open={activeNotif !== null}
        onClose={() => setActiveNotif(null)}
        title={activeNotif?.target ?? ""}
        size="sm"
        footer={
          activeNotif && (
            <div className={styles.modalFooter}>
              <Button variant="ghost" onClick={() => setActiveNotif(null)}>
                닫기
              </Button>
              {moveTarget && (
                <Link href={moveTarget.href} onClick={() => setActiveNotif(null)}>
                  <Button>{moveTarget.label}</Button>
                </Link>
              )}
            </div>
          )
        }
      >
        {activeNotif && (
          <div className={styles.modalBody}>
            <div className={styles.modalMeta}>
              {(() => {
                const meta = typeMeta[activeNotif.type];
                return (
                  <span className={`${styles.modalIcon} ${styles[meta.toneClass]}`} aria-hidden="true">
                    <Icon name={meta.icon} />
                  </span>
                );
              })()}
              <div>
                <p className={styles.modalAction}>
                  {activeNotif.actor && <strong className={styles.actor}>{activeNotif.actor}</strong>}
                  {activeNotif.action}
                </p>
                <span className={styles.modalTime}>
                  {activeNotif.board} · {activeNotif.time}
                </span>
              </div>
            </div>
            {activeNotif.detail
              ? activeNotif.detail.body.split("\n\n").map((para, i) => (
                  <p key={i} className={styles.modalText}>
                    {para}
                  </p>
                ))
              : (
                  <p className={styles.modalText}>{activeNotif.target}</p>
                )}
          </div>
        )}
      </Modal>
    </main>
  );
}

/** 알림 1건. 사람이 발생시킨 알림은 아바타+유형배지, 시스템 알림은 큰 유형 아이콘으로 표현한다. */
function NotificationRow({
  notif,
  onOpen,
}: {
  notif: Notification;
  onOpen: () => void;
}) {
  const meta = typeMeta[notif.type];
  const isSystem = notif.actor === null;

  const inner = (
    <>
      {/* 시각 표식: 사람 알림은 아바타 + 우하단 유형 배지, 시스템 알림은 큰 유형 아이콘 */}
      {isSystem ? (
        <span className={`${styles.systemIcon} ${styles[meta.toneClass]}`} aria-hidden="true">
          <Icon name={meta.icon} />
        </span>
      ) : (
        <span className={styles.avatarWrap}>
          <Avatar name={notif.actor ?? ""} size="md" />
          <span className={`${styles.typeBadge} ${styles[meta.toneClass]}`} aria-hidden="true">
            <Icon name={meta.icon} />
          </span>
        </span>
      )}

      <div className={styles.body}>
        <p className={styles.text}>
          {notif.actor && <strong className={styles.actor}>{notif.actor}</strong>}
          {notif.action}
        </p>
        <p className={styles.targetText}>{notif.target}</p>
        <div className={styles.metaRow}>
          <span className={styles.boardTag}>{notif.board}</span>
          <span className={styles.metaDivider} aria-hidden="true">
            ·
          </span>
          <span className={styles.time}>{notif.time}</span>
        </div>
      </div>

      {!notif.read && <span className={styles.unreadDot} aria-label="안 읽은 알림" />}
    </>
  );

  return (
    <li className={`${styles.item} ${notif.read ? "" : styles.itemUnread}`}>
      <button type="button" className={styles.itemLink} onClick={onOpen}>
        {inner}
      </button>
    </li>
  );
}
