"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { API_BASE_URL } from "../../lib/api";

/**
 * 상단바 알림 벨 버튼 — 클릭 시 운영 항목(미처리 신고/답변 대기 문의/미해결 Q&A)을
 * 벨 버튼 **바로 아래에 앵커된 작은 드롭다운 팝오버**로 표시한다.
 *
 * [드롭다운 구조]
 * createPortal(document.body) 로 헤더 stacking context / overflow 에서 탈출하고
 * getBoundingClientRect 로 계산한 fixed 좌표로 벨 버튼 바로 밑에 위치시킨다.
 *
 *   투명 backdrop (fixed inset:0, z-index:999)  ← 바깥 클릭 닫기
 *   드롭다운 패널 (fixed, z-index:1000, width:320px)
 *     헤더   — 제목 + "모두 읽음" + 닫기 버튼
 *     목록   — 항목별 [아이콘][본문(클릭=해당 관리 페이지로 이동+읽음)][읽음 버튼]
 *              항목 사이에 구분선(border-bottom 1px var(--gray-200))
 *
 * [읽음 처리 — 항목별]
 * 각 알림 항목(신고/문의/Q&A)은 **개별적으로** 읽음 처리된다(하나를 읽어도 나머지는 그대로).
 * 항목별 실데이터 카운트라 개별 read 플래그가 없으므로, "그 항목을 확인한 시점의 카운트"를
 * id별로 localStorage 에 저장하고, 현재 카운트가 그보다 크면(새 항목 발생) 다시 미읽음으로 본다.
 *
 * [데이터 소스]
 * GET /api/v1/admin/dashboard/alerts — reports(미처리·검토중 신고 수), pendingQna(미해결 Q&A 수)
 * GET /api/v1/admin/inquiries?status=pending&pageSize=1 — meta.totalItems(미답변 문의 수)
 * 드롭다운을 열 때마다 최신 상태를 새로 가져온다.
 */

/** tone(아이콘 색상 계열)별 배경/글자색 인라인 스타일을 돌려준다(디자인 시스템 CSS 변수 사용). */
function toneStyle(tone: "danger" | "primary" | "warning"): { background: string; color: string } {
  switch (tone) {
    case "danger":
      return { background: "var(--danger-bg)", color: "var(--danger)" };
    case "warning":
      return { background: "var(--warning-bg)", color: "var(--warning)" };
    default:
      return { background: "var(--primary-50)", color: "var(--primary-600)" };
  }
}

/** 관리자 운영 알림 항목 — 실데이터 기반. */
interface AdminAlert {
  id: string;
  icon: string;
  tone: "danger" | "primary" | "warning";
  title: string;
  body: string;
  href: string;
}

export function NotificationMenu() {
  // open(드롭다운 열림 여부)
  const [open, setOpen] = useState(false);
  // mounted(클라이언트 마운트 여부) — 포털 대상 document.body 접근 가드
  const [mounted, setMounted] = useState(false);

  // 벨 버튼 ref — getBoundingClientRect 로 드롭다운 위치 계산
  const bellRef = useRef<HTMLButtonElement>(null);
  // dropdownPos(드롭다운 fixed 좌표) — { top, right }
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  // 실데이터 카운트
  const [reportCount, setReportCount] = useState<number>(0);
  const [inquiryCount, setInquiryCount] = useState<number>(0);
  const [qnaCount, setQnaCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  /**
   * 읽음 처리한 알림 — **id별** "확인한 시점의 카운트"를 localStorage 에 영속한다.
   * 알림 항목이 실데이터 집계(미처리 신고/문의/Q&A 카운트)라 개별 read 플래그가 없으므로,
   * id별로 확인한 카운트를 저장하고, 현재 카운트가 그보다 크면 다시 미읽음으로 본다.
   * → 항목별 독립 읽음 처리(하나를 읽어도 다른 항목은 그대로 — 사용자 요청).
   */
  const [ackMap, setAckMap] = useState<Record<string, number>>({});

  /** 운영 알림을 최신 상태로 불러온다. */
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, inquiriesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/admin/dashboard/alerts`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/api/v1/admin/inquiries?status=pending&pageSize=1`, {
          credentials: "include",
        }),
      ]);

      if (alertsRes.ok) {
        const data = (await alertsRes.json()) as {
          reports?: number;
          pendingQna?: number;
        };
        setReportCount(data.reports ?? 0);
        setQnaCount(data.pendingQna ?? 0);
      }

      if (inquiriesRes.ok) {
        const data = (await inquiriesRes.json()) as {
          meta?: { totalItems?: number };
        };
        setInquiryCount(data.meta?.totalItems ?? 0);
      }
    } catch {
      // 네트워크 오류 — 조용히 실패
    } finally {
      setLoading(false);
    }
  }, []);

  // 마운트 시 클라이언트 플래그 + 저장된 읽음 맵 복원
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("aj_admin_alerts_ack_v2");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, number>;
        if (parsed && typeof parsed === "object") setAckMap(parsed);
      }
    } catch {
      // localStorage 접근 불가 / 파싱 실패 — 무시
    }
  }, []);

  // 앱 로드 시 한 번 가져와서 배지를 표시한다
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // 드롭다운이 열릴 때마다 최신 데이터를 가져온다 (읽음 상태는 시그니처로 영속되므로 초기화하지 않는다)
  useEffect(() => {
    if (open) {
      fetchAlerts();
    }
  }, [open, fetchAlerts]);

  // Esc 키로 닫기
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /** 벨 버튼 클릭 — getBoundingClientRect 로 드롭다운 위치를 계산한 후 연다. */
  const handleBellClick = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,                        // 버튼 하단 + 8px 간격
        right: window.innerWidth - rect.right,       // 버튼 오른쪽 끝 정렬
      });
    }
    setOpen(true);
  }, [open]);

  // 실데이터 기반 알림 항목 구성 — 카운트가 0이면 항목을 표시하지 않는다
  const alerts: AdminAlert[] = [
    ...(reportCount > 0
      ? [
          {
            id: "reports",
            icon: "ri-alarm-warning-line",
            tone: "danger" as const,
            title: "미처리 신고",
            body: `신고 ${reportCount}건이 검토를 기다리고 있습니다.`,
            href: "/reports",
          },
        ]
      : []),
    ...(inquiryCount > 0
      ? [
          {
            id: "inquiries",
            icon: "ri-questionnaire-line",
            tone: "warning" as const,
            title: "답변 대기 문의",
            body: `미답변 1:1 문의가 ${inquiryCount}건 있습니다.`,
            href: "/inquiries",
          },
        ]
      : []),
    ...(qnaCount > 0
      ? [
          {
            id: "qna",
            icon: "ri-chat-check-line",
            tone: "primary" as const,
            title: "미해결 Q&A",
            body: `답변이 달리지 않은 Q&A가 ${qnaCount}건 있습니다.`,
            href: "/qna",
          },
        ]
      : []),
  ];

  // id별 현재 카운트
  const countById: Record<string, number> = {
    reports: reportCount,
    inquiries: inquiryCount,
    qna: qnaCount,
  };
  /** 특정 알림 항목이 읽음 상태인지 — 확인한 카운트가 현재 카운트 이상이면 읽음. */
  const isAlertRead = useCallback(
    (id: string) => {
      const acked = ackMap[id];
      return acked !== undefined && acked >= (countById[id] ?? 0);
    },
    // countById 는 매 렌더 새 객체라 의존성에서 제외하고 원시 카운트로 갱신
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ackMap, reportCount, inquiryCount, qnaCount],
  );
  // unreadCount(안 읽음 알림 개수) — 헤더 배지·빨간점에 사용
  const unreadCount = alerts.filter((a) => !isAlertRead(a.id)).length;

  /** localStorage 영속 헬퍼. */
  const persistAck = useCallback((next: Record<string, number>) => {
    try {
      localStorage.setItem("aj_admin_alerts_ack_v2", JSON.stringify(next));
    } catch {
      // localStorage 접근 불가 — 무시
    }
  }, []);

  /** 단일 항목만 읽음 처리(다른 항목은 그대로) — 항목 클릭/읽음 버튼에서 호출(#49). */
  const acknowledgeOne = useCallback(
    (id: string) => {
      setAckMap((prev) => {
        const next = { ...prev, [id]: countById[id] ?? 0 };
        persistAck(next);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistAck, reportCount, inquiryCount, qnaCount],
  );

  /** 현재 보이는 모든 항목을 읽음 처리 — "모두 읽음" 버튼에서 호출. */
  const acknowledgeAll = useCallback(
    () => {
      setAckMap((prev) => {
        const next = { ...prev };
        for (const a of alerts) next[a.id] = countById[a.id] ?? 0;
        persistAck(next);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistAck, reportCount, inquiryCount, qnaCount],
  );

  return (
    <>
      {/* 벨 버튼 */}
      <button
        ref={bellRef}
        type="button"
        /* 빨간 점(notification-dot::after)은 미읽음이 있을 때만 표시 — 읽음 처리 후 사라지게(새#2) */
        className={`icon-button${unreadCount > 0 ? " notification-dot" : ""}`}
        aria-label="알림"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ width: 40, height: 40, position: "relative" }}
        onClick={handleBellClick}
      >
        <i className="ri-notification-3-line" style={{ fontSize: 22 }} />
        {unreadCount > 0 && (
          <span
            className="nav-badge"
            style={{
              position: "absolute", top: 4, right: 4,
              minWidth: 16, height: 16, fontSize: 10,
              lineHeight: "16px", padding: "0 4px", borderRadius: 999,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 팝오버 — document.body 포털로 헤더 stacking context / overflow 에서 탈출 */}
      {mounted && open && dropdownPos && createPortal(
        <>
          {/* 투명 backdrop — 바깥 클릭 시 드롭다운 닫힘. 페이지 스크롤은 잠그지 않는다. */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* 드롭다운 패널 */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="운영 알림"
            style={{
              position: "fixed",
              top: dropdownPos.top,
              right: dropdownPos.right,
              zIndex: 1000,
              width: 320,
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px var(--gray-200)",
              overflow: "hidden",
            }}
          >
            {/* 드롭다운 헤더 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: "1px solid var(--gray-200)",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-900)" }}>
                운영 알림
                {unreadCount > 0 && (
                  <span className="nav-badge" style={{ marginLeft: 6 }}>
                    {unreadCount}
                  </span>
                )}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {alerts.length > 0 && (
                  <button
                    type="button"
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "var(--primary-600)",
                      fontSize: 12,
                      fontWeight: 650,
                      cursor: "pointer",
                      padding: 0,
                      width: "auto",
                      minHeight: 0,
                    }}
                    onClick={acknowledgeAll}
                  >
                    모두 읽음
                  </button>
                )}
                <button
                  type="button"
                  className="icon-button"
                  aria-label="닫기"
                  style={{ width: 28, height: 28 }}
                  onClick={() => setOpen(false)}
                >
                  <i className="ri-close-line" style={{ fontSize: 16 }} />
                </button>
              </div>
            </div>

            {/* 알림 목록 */}
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {loading ? (
                <div
                  style={{
                    padding: "24px 14px",
                    textAlign: "center",
                    fontSize: 13,
                    color: "var(--gray-400)",
                  }}
                >
                  불러오는 중...
                </div>
              ) : alerts.length === 0 ? (
                <div
                  style={{
                    padding: "32px 14px",
                    textAlign: "center",
                    fontSize: 13,
                    color: "var(--gray-400)",
                  }}
                >
                  <i
                    className="ri-checkbox-circle-line"
                    style={{ fontSize: 26, display: "block", marginBottom: 8 }}
                  />
                  미처리 운영 항목이 없습니다.
                </div>
              ) : (
                alerts.map((n, idx) => {
                  const ts = toneStyle(n.tone);
                  const isRead = isAlertRead(n.id);
                  const isLast = idx === alerts.length - 1;
                  return (
                    <div
                      key={n.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: "11px 14px",
                        background: isRead ? "transparent" : "var(--primary-50)",
                        /* 항목 사이 구분선 — 마지막 항목 제외. gray-100 은 파란 배경(primary-50)에서
                           안 보여서(N10+#2) gray-200 으로 강화 — 흰 배경에서도 정상 보임. */
                        borderBottom: isLast ? "none" : "1px solid var(--gray-200)",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          flex: "0 0 auto",
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          ...ts,
                        }}
                      >
                        <i className={n.icon} />
                      </span>
                      {/* 본문 — 클릭 시 해당 관리 페이지로 이동 + 이 항목만 읽음 처리(#50) */}
                      <Link
                        href={n.href}
                        role="menuitem"
                        onClick={() => {
                          acknowledgeOne(n.id);
                          setOpen(false);
                        }}
                        style={{
                          minWidth: 0,
                          flex: 1,
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 13,
                            fontWeight: 650,
                            color: "var(--gray-900)",
                          }}
                        >
                          {n.title}
                          {!isRead && (
                            <span
                              aria-hidden="true"
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: "var(--danger)",
                                flex: "0 0 auto",
                              }}
                            />
                          )}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: "var(--gray-500)",
                            marginTop: 2,
                            lineHeight: 1.45,
                          }}
                        >
                          {n.body}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            marginTop: 6,
                            fontSize: 11,
                            fontWeight: 650,
                            color: "var(--primary-600)",
                          }}
                        >
                          바로가기
                          <i className="ri-arrow-right-line" style={{ fontSize: 12 }} />
                        </span>
                      </Link>
                      {/* 읽음 버튼 — 이동 없이 이 항목만 읽음 처리(#49). 읽은 항목엔 미표시 */}
                      {!isRead && (
                        <button
                          type="button"
                          aria-label={`${n.title} 읽음 처리`}
                          title="읽음 처리"
                          onClick={() => acknowledgeOne(n.id)}
                          style={{
                            flex: "0 0 auto",
                            border: 0,
                            background: "transparent",
                            color: "var(--gray-400)",
                            cursor: "pointer",
                            padding: 4,
                            minHeight: 0,
                            width: "auto",
                            lineHeight: 1,
                          }}
                        >
                          <i className="ri-check-double-line" style={{ fontSize: 16 }} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
