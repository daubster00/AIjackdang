"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Icon,
  Input,
  Modal,
  RankBadge,
  Textarea,
} from "@/components/ui";
import type { RankTier } from "@/lib/ranks";
import styles from "./messages.module.css";

/** 쪽지 보관함 종류 */
type Box = "received" | "sent";

/** 쪽지 1건. (채팅이 아닌, 한 통씩 주고받는 단건 쪽지) */
interface Note {
  id: string;
  box: Box;
  /** 상대(받은 쪽지면 보낸 사람, 보낸 쪽지면 받는 사람) */
  partner: string;
  /** 상대 등급 */
  rank: RankTier;
  /** 쪽지 본문 */
  content: string;
  /** 보낸/받은 시각 (예: "2026.06.18 14:12") */
  date: string;
  /** 받은 쪽지 읽음 여부 (보낸 쪽지는 항상 true 취급) */
  read: boolean;
}

const initialNotes: Note[] = [
  {
    id: "r1",
    box: "received",
    partner: "자동화카페",
    rank: "expert",
    content:
      "안녕하세요! 올려주신 파일시스템 MCP 설정 템플릿 잘 봤습니다. 로컬 폴더를 통째로 노출하지 않고 권한 범위를 좁히는 방법이 궁금한데, 혹시 예시를 받아볼 수 있을까요? 감사합니다 🙌",
    date: "2026.06.18 14:12",
    read: false,
  },
  {
    id: "r2",
    box: "received",
    partner: "기획하는사람",
    rank: "practitioner",
    content:
      "자동화 외주 견적 글 잘 읽었습니다. 견적 산정할 때 참고하신 기준이 따로 있으신가요? 처음 외주를 맡기려는데 기준이 막막해서요.",
    date: "2026.06.18 12:02",
    read: false,
  },
  {
    id: "r3",
    box: "received",
    partner: "리뷰메이트",
    rank: "master",
    content:
      "체크리스트에 '접근성 점검' 항목도 넣으면 좋을 것 같아요. 키보드 포커스랑 대비비만 추가로 잡아도 품질이 확 올라가더라고요.",
    date: "2026.06.17 18:40",
    read: true,
  },
  {
    id: "r4",
    box: "received",
    partner: "코드작당러",
    rank: "rookie",
    content: "프롬프트 구조 팁 글에 댓글 남겼어요, 한번 봐주세요 😄",
    date: "2026.06.15 09:15",
    read: true,
  },
  {
    id: "s1",
    box: "sent",
    partner: "프론트라인",
    rank: "member",
    content:
      "사이드 프로젝트 후기 잘 봤습니다! 혹시 참고하신 레퍼런스 사이트를 공유해주실 수 있을까요?",
    date: "2026.06.17 18:30",
    read: true,
  },
  {
    id: "s2",
    box: "sent",
    partner: "리뷰메이트",
    rank: "master",
    content: "체크리스트 항목 추가 제안 감사합니다. 다음 버전에 반영할게요!",
    date: "2026.06.17 13:40",
    read: true,
  },
];

const boxes: { value: Box; label: string; icon: string }[] = [
  { value: "received", label: "받은 쪽지", icon: "inbox-line" },
  { value: "sent", label: "보낸 쪽지", icon: "send-plane-line" },
];

/** 쪽지 본문 미리보기를 한 줄 길이로 자른다. */
function preview(text: string, max = 60) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default function MessagesPage() {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [box, setBox] = useState<Box>("received");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** 읽기 모달에 띄운 쪽지 */
  const [reading, setReading] = useState<Note | null>(null);
  /** 쪽지 쓰기 모달 표시 여부 */
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeText, setComposeText] = useState("");

  const list = useMemo(() => notes.filter((n) => n.box === box), [notes, box]);

  const unreadCount = useMemo(
    () => notes.filter((n) => n.box === "received" && !n.read).length,
    [notes],
  );

  const allChecked = list.length > 0 && list.every((n) => selected.has(n.id));

  /** 보관함 전환 시 선택 상태 초기화 */
  function switchBox(next: Box) {
    setBox(next);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allChecked ? new Set() : new Set(list.map((n) => n.id)));
  }

  function deleteSelected() {
    setNotes((prev) => prev.filter((n) => !selected.has(n.id)));
    setSelected(new Set());
  }

  /** 쪽지 읽기: 읽음 처리 + 모달 오픈 */
  function openNote(note: Note) {
    setReading(note);
    if (note.box === "received" && !note.read) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, read: true } : n)));
    }
  }

  function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setReading(null);
  }

  /** 쪽지 쓰기 모달 열기 (받는 사람 미리 채움 가능) */
  function openCompose(to = "") {
    setComposeTo(to);
    setComposeText("");
    setReading(null);
    setComposeOpen(true);
  }

  /** 쪽지 보내기(목업): 보낸 쪽지함에 추가 */
  function sendNote() {
    const to = composeTo.trim();
    const text = composeText.trim();
    if (!to || !text) return;
    const now = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(new Date())
      .replace(/\. /g, ".")
      .replace(/\.$/, "");
    setNotes((prev) => [
      {
        id: `s${Date.now()}`,
        box: "sent",
        partner: to,
        rank: "member",
        content: text,
        date: now,
        read: true,
      },
      ...prev,
    ]);
    setComposeOpen(false);
    setBox("sent");
  }

  return (
    <main id="main" className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headInner}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              <Icon name="mail-line" />
              쪽지함
            </h1>
            {unreadCount > 0 && (
              <Badge tone="primary" variant="solid" className={styles.unreadBadge}>
                안 읽음 {unreadCount}
              </Badge>
            )}
          </div>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Icon name="edit-box-line" />}
            onClick={() => openCompose()}
          >
            쪽지 쓰기
          </Button>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="쪽지함 보관함">
          {boxes.map((b) => (
            <button
              key={b.value}
              type="button"
              role="tab"
              className={styles.tab}
              aria-selected={box === b.value}
              onClick={() => switchBox(b.value)}
            >
              <Icon name={b.icon} />
              {b.label}
              {b.value === "received" && unreadCount > 0 && (
                <span className={styles.tabCount}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.listLayout}>
        {list.length === 0 ? (
          <EmptyState
            icon={box === "received" ? "inbox-line" : "send-plane-line"}
            title={box === "received" ? "받은 쪽지가 없어요" : "보낸 쪽지가 없어요"}
            description={
              box === "received"
                ? "다른 회원이 보낸 쪽지가 여기에 표시됩니다."
                : "‘쪽지 쓰기’로 다른 회원에게 쪽지를 보내보세요."
            }
          />
        ) : (
          <>
            {/* 일괄 작업 바 */}
            <div className={styles.bulkBar}>
              <label className={styles.checkAll}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleSelectAll}
                  aria-label="전체 선택"
                />
                <span>전체 선택</span>
              </label>
              <button
                type="button"
                className={styles.bulkDelete}
                onClick={deleteSelected}
                disabled={selected.size === 0}
              >
                <Icon name="delete-bin-6-line" />
                선택 삭제{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
            </div>

            <ul className={styles.list}>
              {list.map((n) => {
                const isUnread = n.box === "received" && !n.read;
                return (
                  <li
                    key={n.id}
                    className={`${styles.item} ${isUnread ? styles.itemUnread : ""} ${
                      selected.has(n.id) ? styles.itemChecked : ""
                    }`}
                  >
                    <label className={styles.checkbox} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(n.id)}
                        onChange={() => toggleSelect(n.id)}
                        aria-label="쪽지 선택"
                      />
                    </label>

                    <button type="button" className={styles.itemMain} onClick={() => openNote(n)}>
                      <Avatar name={n.partner} size="md" />
                      <span className={styles.itemBody}>
                        <span className={styles.itemTop}>
                          <span className={styles.partner}>
                            {box === "sent" && <span className={styles.toLabel}>받는 사람</span>}
                            {n.partner}
                            <RankBadge rank={n.rank} size={15} />
                          </span>
                          <span className={styles.date}>{n.date}</span>
                        </span>
                        <span className={`${styles.excerpt} ${isUnread ? styles.excerptUnread : ""}`}>
                          {preview(n.content)}
                        </span>
                      </span>
                      {isUnread && <span className={styles.unreadDot} aria-label="안 읽음" />}
                    </button>

                    <button
                      type="button"
                      className={styles.itemDelete}
                      onClick={() => deleteNote(n.id)}
                      aria-label="쪽지 삭제"
                    >
                      <Icon name="delete-bin-6-line" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* ── 쪽지 읽기 모달 ── */}
      <Modal
        open={reading !== null}
        onClose={() => setReading(null)}
        title="쪽지 보기"
        footer={
          reading && (
            <>
              <Button variant="ghost" onClick={() => deleteNote(reading.id)}>
                <Icon name="delete-bin-6-line" /> 삭제
              </Button>
              {reading.box === "received" && (
                <Button variant="primary" onClick={() => openCompose(reading.partner)}>
                  <Icon name="reply-line" /> 답장하기
                </Button>
              )}
            </>
          )
        }
      >
        {reading && (
          <div className={styles.readView}>
            <div className={styles.readHead}>
              <Avatar name={reading.partner} size="md" />
              <div className={styles.readMeta}>
                <span className={styles.readPartner}>
                  <span className={styles.readDir}>
                    {reading.box === "received" ? "보낸 사람" : "받는 사람"}
                  </span>
                  {reading.partner}
                  <RankBadge rank={reading.rank} size={16} showLabel />
                </span>
                <span className={styles.readDate}>{reading.date}</span>
              </div>
            </div>
            <p className={styles.readContent}>{reading.content}</p>
          </div>
        )}
      </Modal>

      {/* ── 쪽지 쓰기 / 답장 모달 ── */}
      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="쪽지 쓰기"
        footer={
          <>
            <Button variant="secondary" onClick={() => setComposeOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={sendNote}
              disabled={!composeTo.trim() || !composeText.trim()}
              leftIcon={<Icon name="send-plane-fill" />}
            >
              보내기
            </Button>
          </>
        }
      >
        <div className={styles.composeForm}>
          <Input
            label="받는 사람"
            required
            placeholder="닉네임 입력"
            value={composeTo}
            onChange={(e) => setComposeTo(e.target.value)}
            leftIcon={<Icon name="user-line" />}
          />
          <Textarea
            label="내용"
            required
            placeholder="쪽지 내용을 입력하세요."
            rows={6}
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            currentLength={composeText.length}
            maxLengthHint={1000}
          />
        </div>
      </Modal>
    </main>
  );
}
