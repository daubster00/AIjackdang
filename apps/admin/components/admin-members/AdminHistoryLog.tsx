"use client";

import { useState } from "react";

/**
 * 관리회원 상세 페이지의 "처리 이력"을 항목 리스트로 표기하고,
 * 항목 클릭 시 해당 작업의 정확한 상세 내역(무엇을·어떻게 처리했는지)을 모달로 보여준다.
 *
 * - 시각/마크업은 관리자 디자인 시스템 클래스(card/admin-table/modal 등)를 그대로 사용한다.
 * - 모달은 전역 overlay.js 가 아니라 이 컴포넌트의 자체 상태(open/close)로 제어한다.
 *   (이력마다 내용이 달라야 하므로 고정 id 모달을 쓰지 않는다.)
 * - 데이터는 더미(정적)이며, 이후 단계에서 API 조회 결과로 교체한다.
 */

// 작업 유형(actionType) → 배지 색 + 아이콘. 한 줄로 "어떤 종류의 처리였는지" 알려준다.
const ACTION_META: Record<string, { badge: string; icon: string }> = {
  "등록": { badge: "badge-blue", icon: "ri-user-add-line" },
  "등급 변경": { badge: "badge-purple", icon: "ri-award-line" },
  "권한 변경": { badge: "badge-cyan", icon: "ri-key-2-line" },
  "담당 변경": { badge: "badge-orange", icon: "ri-exchange-line" },
  "정지": { badge: "badge-red", icon: "ri-user-forbid-line" },
  "정지 해제": { badge: "badge-green", icon: "ri-user-follow-line" },
};

// 이력 상세의 한 항목(필드 1줄). label(항목명) / value(값).
export type HistoryDetailField = { label: string; value: string };

// 처리 이력 한 건.
export type HistoryEntry = {
  id: string;
  date: string; // 처리 날짜
  time: string; // 처리 시각
  actor: string; // 처리한 관리자(누가)
  actionType: string; // 작업 유형(ACTION_META 키)
  summary: string; // 리스트에 보이는 한 줄 요약
  fields: HistoryDetailField[]; // 모달에 보이는 상세 항목들(무엇을 어떻게)
  reason?: string; // 처리 사유(있으면 모달 하단에 별도 표기)
};

export function AdminHistoryLog({ entries }: { entries: HistoryEntry[] }) {
  // 현재 모달에 띄울 이력(없으면 닫힘 상태).
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  return (
    <>
      <article className="card">
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <div className="section-heading" style={{ marginBottom: 0 }}>
            <div>
              <h3 className="section-title">처리 이력</h3>
              <p className="section-description">
                이 관리자에게 적용된 처리 내역입니다. 항목을 클릭하면 어떤 작업을 어떻게 처리했는지 상세 내역을 볼 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 이력 항목 리스트(테이블) */}
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 150 }}>처리 일시</th>
                <th style={{ width: 110 }}>작업</th>
                <th>내용</th>
                <th style={{ width: 110 }}>처리자</th>
                <th style={{ width: 56, textAlign: "center" }}>상세</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const meta = ACTION_META[e.actionType] ?? { badge: "badge-gray", icon: "ri-history-line" };
                return (
                  <tr
                    key={e.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(e)}
                  >
                    <td className="num">
                      <div>{e.date}</div>
                      <div style={{ color: "var(--gray-500)", fontSize: 12 }}>{e.time}</div>
                    </td>
                    <td>
                      <span className={`badge ${meta.badge}`}>
                        <i className={meta.icon} />
                        {e.actionType}
                      </span>
                    </td>
                    <td>{e.summary}</td>
                    <td>{e.actor}</td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="상세 내역 보기"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelected(e);
                        }}
                      >
                        <i className="ri-arrow-right-s-line" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <div className="page-info">1–{entries.length} / 총 {entries.length}건</div>
          <div className="page-buttons">
            <button className="page-button" aria-label="이전 페이지"><i className="ri-arrow-left-s-line" /></button>
            <button className="page-button active">1</button>
            <button className="page-button" aria-label="다음 페이지"><i className="ri-arrow-right-s-line" /></button>
          </div>
        </div>
      </article>

      {/* ===== 처리 이력 상세 모달 (이 컴포넌트가 직접 제어) =====
          전역 overlay.js 가 페이지의 .overlay(등급 변경/정지 모달용)를 가로채지 않도록,
          여기서는 .overlay 클래스 대신 동일한 시각을 inline 스타일로 직접 그린다. */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(15, 23, 42, 0.42)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}
      <section
        className={`modal${selected ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="historyDetailTitle"
      >
        {selected && (
          <>
            <div className="modal-header">
              <div className="modal-title" id="historyDetailTitle">
                {(ACTION_META[selected.actionType]?.icon) && (
                  <i className={ACTION_META[selected.actionType].icon} style={{ marginRight: 8 }} />
                )}
                {selected.actionType} 상세
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="닫기"
                onClick={() => setSelected(null)}
              >
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="modal-body">
              <div className="component-stack">
                {/* 처리 메타: 누가 / 언제 */}
                <div className="alert alert-info">
                  <i className="ri-information-line" />
                  <div>
                    <strong>{selected.actor}</strong> 님이 {selected.date} {selected.time} 에 처리했습니다.
                  </div>
                </div>

                {/* 상세 항목: 무엇을 어떻게 처리했는지 */}
                <dl
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr",
                    gap: "10px 16px",
                    fontSize: 14,
                    margin: 0,
                  }}
                >
                  <dt style={{ color: "var(--gray-500)" }}>작업 유형</dt>
                  <dd style={{ margin: 0 }}>{selected.actionType}</dd>
                  {selected.fields.map((f) => (
                    <FieldRow key={f.label} label={f.label} value={f.value} />
                  ))}
                </dl>

                {/* 처리 사유(있을 때만) */}
                {selected.reason && (
                  <div>
                    <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 6 }}>처리 사유</p>
                    <div
                      style={{
                        background: "var(--gray-25)",
                        border: "1px solid var(--gray-200)",
                        borderRadius: "var(--radius-md, 8px)",
                        padding: "10px 12px",
                        fontSize: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      {selected.reason}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>
                닫기
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

// 상세 항목 한 줄. "변경 전 → 변경 후" 형태는 호출부에서 value 에 화살표를 넣어 표현한다.
function FieldRow({ label, value }: HistoryDetailField) {
  return (
    <>
      <dt style={{ color: "var(--gray-500)" }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </>
  );
}
