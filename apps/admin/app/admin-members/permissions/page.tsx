"use client";

import { useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 권한 설정 페이지 — 관리자 등급별로 페이지 접근/글작성/수정/삭제 권한을 매트릭스 토글로 부여·회수(디자인만).
 * 마스터 등급 선택 시 모든 토글이 켜진 채 비활성(전체 권한 고정).
 * 클라이언트 컴포넌트 — 탭 전환과 토글 상태 표현이 필요하다.
 */

// 관리 등급 목록. id(등급 식별자), locked(잠금 여부)=true 이면 마스터(전체 권한 고정).
const ADMIN_GRADES = [
  { id: "master", label: "마스터", locked: true },
  { id: "operator", label: "운영자", locked: false },
  { id: "moderator", label: "모더레이터", locked: false },
];

// 권한 매트릭스 행 — 관리자 페이지 목록.
const PAGES = [
  "대시보드",
  "접속 통계",
  "게시글 관리",
  "묻고답하기 관리",
  "실전자료 관리",
  "댓글·후기 관리",
  "신고 관리",
  "쪽지 관리",
  "유저 회원 관리",
  "관리회원 관리",
  "포인트 관리",
  "등급·뱃지 관리",
  "광고 관리",
  "사이트 설정",
] as const;

// 권한 열 종류(permCol). key 는 권한 식별자, label 은 표시 텍스트.
const PERM_COLS = [
  { key: "access", label: "접근" },
  { key: "write", label: "글작성" },
  { key: "edit", label: "수정" },
  { key: "del", label: "삭제" },
] as const;

type PermKey = (typeof PERM_COLS)[number]["key"];
type PageName = (typeof PAGES)[number];

// permMatrix(권한 초기값 매트릭스): 운영자·모더레이터 등급의 초기 더미 권한.
const INITIAL_OPERATOR: Record<PageName, Record<PermKey, boolean>> = {
  "대시보드":        { access: true,  write: false, edit: false, del: false },
  "접속 통계":       { access: true,  write: false, edit: false, del: false },
  "게시글 관리":     { access: true,  write: true,  edit: true,  del: true  },
  "묻고답하기 관리": { access: true,  write: true,  edit: true,  del: false },
  "실전자료 관리":   { access: true,  write: false, edit: false, del: false },
  "댓글·후기 관리":  { access: true,  write: false, edit: true,  del: true  },
  "신고 관리":       { access: true,  write: false, edit: true,  del: false },
  "쪽지 관리":       { access: true,  write: false, edit: false, del: false },
  "유저 회원 관리":  { access: false, write: false, edit: false, del: false },
  "관리회원 관리":   { access: false, write: false, edit: false, del: false },
  "포인트 관리":     { access: false, write: false, edit: false, del: false },
  "등급·뱃지 관리":  { access: false, write: false, edit: false, del: false },
  "광고 관리":       { access: false, write: false, edit: false, del: false },
  "사이트 설정":     { access: false, write: false, edit: false, del: false },
};

const INITIAL_MODERATOR: Record<PageName, Record<PermKey, boolean>> = {
  "대시보드":        { access: true,  write: false, edit: false, del: false },
  "접속 통계":       { access: false, write: false, edit: false, del: false },
  "게시글 관리":     { access: false, write: false, edit: false, del: false },
  "묻고답하기 관리": { access: false, write: false, edit: false, del: false },
  "실전자료 관리":   { access: false, write: false, edit: false, del: false },
  "댓글·후기 관리":  { access: true,  write: false, edit: true,  del: true  },
  "신고 관리":       { access: true,  write: false, edit: true,  del: false },
  "쪽지 관리":       { access: false, write: false, edit: false, del: false },
  "유저 회원 관리":  { access: false, write: false, edit: false, del: false },
  "관리회원 관리":   { access: false, write: false, edit: false, del: false },
  "포인트 관리":     { access: false, write: false, edit: false, del: false },
  "등급·뱃지 관리":  { access: false, write: false, edit: false, del: false },
  "광고 관리":       { access: false, write: false, edit: false, del: false },
  "사이트 설정":     { access: false, write: false, edit: false, del: false },
};

// allOn(전체 권한 ON 매트릭스) — 마스터 등급 표시용.
const ALL_ON: Record<PageName, Record<PermKey, boolean>> = Object.fromEntries(
  PAGES.map((p) => [p, { access: true, write: true, edit: true, del: true }])
) as Record<PageName, Record<PermKey, boolean>>;

export default function AdminMembersPermissionsPage() {
  // selectedGrade(현재 선택된 등급 id).
  const [selectedGrade, setSelectedGrade] = useState<string>("operator");

  // perms(등급별 권한 상태). 마스터는 allOn 고정이므로 운영자/모더레이터만 관리.
  const [operatorPerms, setOperatorPerms] = useState({ ...INITIAL_OPERATOR });
  const [moderatorPerms, setModeratorPerms] = useState({ ...INITIAL_MODERATOR });

  // 현재 등급의 locked(수정 불가 여부)와 매트릭스 데이터.
  const currentGrade = ADMIN_GRADES.find((g) => g.id === selectedGrade);
  const isLocked = currentGrade?.locked ?? false;

  const currentPerms =
    selectedGrade === "master"
      ? ALL_ON
      : selectedGrade === "operator"
      ? operatorPerms
      : moderatorPerms;

  // 토글 핸들러 — locked(마스터) 등급에서는 호출되지 않는다.
  const handleToggle = (page: PageName, col: PermKey) => {
    if (isLocked) return;
    const setter = selectedGrade === "operator" ? setOperatorPerms : setModeratorPerms;
    setter((prev) => ({
      ...prev,
      [page]: { ...prev[page], [col]: !prev[page][col] },
    }));
  };

  return (
    <AdminShell
      breadcrumb={["관리자", "관리회원 관리", "권한 설정"]}
      activeKey="admin-members"
      activeSubKey="permissions"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">권한 설정</h1>
          <p className="page-description">관리 등급별로 각 페이지에 대한 접근·글작성·수정·삭제 권한을 설정합니다.</p>
        </div>
      </div>

      {/* 마스터 고정 안내 */}
      {isLocked && (
        <div className="alert alert-info" style={{ marginBottom: "16px" }}>
          <i className="ri-shield-keyhole-line" />
          <div>
            <strong>마스터 등급</strong>은 전체 권한이 고정 부여됩니다.
            마스터 계정으로만 모든 관리 항목에 접근 가능하며, 개별 권한을 변경할 수 없습니다.
          </div>
        </div>
      )}

      <section className="section">
        <article className="card">
          {/* 등급 선택 탭 */}
          <div className="line-tabs" role="tablist" aria-label="관리 등급 선택">
            {ADMIN_GRADES.map((g) => (
              <button
                key={g.id}
                className={`line-tab${selectedGrade === g.id ? " active" : ""}`}
                role="tab"
                aria-selected={selectedGrade === g.id}
                onClick={() => setSelectedGrade(g.id)}
              >
                {g.label}
                {g.locked && <i className="ri-lock-line" style={{ marginLeft: 4, fontSize: 12 }} />}
              </button>
            ))}
          </div>

          {/* 권한 매트릭스 테이블 */}
          <div className="table-wrap" style={{ marginTop: "16px" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>페이지</th>
                  {PERM_COLS.map((col) => (
                    <th key={col.key} style={{ width: 90, textAlign: "center" }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PAGES.map((page) => (
                  <tr key={page}>
                    <td style={{ fontWeight: 500 }}>{page}</td>
                    {PERM_COLS.map((col) => {
                      const checked = currentPerms[page][col.key];
                      return (
                        <td key={col.key} style={{ textAlign: "center" }}>
                          <label
                            className="switch"
                            aria-label={`${page} ${col.label}`}
                            title={isLocked ? "마스터 등급은 권한을 변경할 수 없습니다" : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isLocked}
                              onChange={() => handleToggle(page, col.key)}
                            />
                            <span className="switch-track" />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 저장 버튼 영역 */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "16px",
              padding: "16px 18px 18px",
              borderTop: "1px solid var(--gray-200)",
            }}
          >
            <button className="btn btn-outline" disabled={isLocked}>
              <i className="ri-refresh-line" />
              초기화
            </button>
            <button className="btn btn-primary" disabled={isLocked}>
              <i className="ri-save-line" />
              권한 저장
            </button>
          </div>

          {isLocked && (
            <p style={{ textAlign: "right", fontSize: 13, color: "var(--gray-500)", margin: "0 18px 16px" }}>
              마스터 등급은 전체 권한이 고정되어 저장 버튼이 비활성화됩니다.
            </p>
          )}
        </article>
      </section>
    </AdminShell>
  );
}
