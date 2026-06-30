"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { MemberActivityTabs } from "../_components/MemberActivityTabs";
import { API_BASE_URL } from "../../../lib/api";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { dbBoardToAdminSlug } from "@/lib/boards";
import { getCrossLink } from "@/lib/contentCrossLink";

// ── 로컬 타입 ──────────────────────────────────────────────────────────────────

interface AdminUserSanctionItem {
  id: string;
  type: "warning" | "suspend" | "permaban";
  reason: string;
  issuedBy: string | null;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}

interface AdminUserPostItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
  /** DB posts.board 값 (예: "vibe-coding-guide"). 관리자 상세 URL 구성에 사용. */
  board: string;
}

interface AdminUserCommentItem {
  id: string;
  targetType: string;
  targetId: string;
  content: string;
  createdAt: string;
  /** 댓글 대상이 게시글(post)인 경우 DB posts.board 값. getCrossLink 에서 사용. */
  board?: string | null;
}

interface AdminUserSessionItem {
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

interface AdminUserMemberDetail {
  id: string;
  nickname: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  image: string | null;
  defaultAvatarIndex: number;
  bio: string | null;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  birthDate: string | null;
  termsAgreedAt: string | null;
  marketingAgreedAt: string | null;
  status: "active" | "suspended" | "withdrawn";
  suspendedUntil: string | null;
  createdAt: string;
  totalPoints: number;
  gradeLevel: number;
  gradeName: string;
  postCount: number;
  reportCount: number;
  sanctions: AdminUserSanctionItem[];
  recentPosts: AdminUserPostItem[];
  recentComments: AdminUserCommentItem[];
  loginSessions: AdminUserSessionItem[];
}

/**
 * 유저 회원 상세 페이지 (Story 9.12).
 * 실제 API 연동 + 제재/포인트/등급 모달 액션.
 * #5: 프로필 아바타 실이미지 표시
 * #20: 보유 뱃지 섹션 제거 (badges/user_badges 테이블 DROP)
 * #21: 기본정보에 성별/생년월일/마케팅동의/약관동의/연락처 추가 (2줄 그리드)
 * #22: 활동내역을 4탭으로 분리 (게시글/댓글/로그인기록/제재이력)
 */

// 등급 레벨 → 배지 색
const GRADE_BADGE: Record<number, string> = {
  1: "badge-gray",
  2: "badge-blue",
  3: "badge-cyan",
  4: "badge-purple",
  5: "badge-orange",
};

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "active": return ["badge-green", "정상"];
    case "suspended": return ["badge-red", "이용제한"];
    case "withdrawn": return ["badge-gray", "탈퇴"];
    default: return ["badge-gray", status];
  }
}

function sanctionTypeBadge(type: string): [string, string] {
  switch (type) {
    case "warning": return ["badge-orange", "경고"];
    case "suspend": return ["badge-red", "일시정지"];
    case "permaban": return ["badge-red", "영구정지"];
    default: return ["badge-gray", type];
  }
}

function postStatusBadge(status: string): [string, string] {
  switch (status) {
    case "published": return ["badge-green", "게시됨"];
    case "draft": return ["badge-gray", "임시저장"];
    case "hidden": return ["badge-orange", "숨김"];
    default: return ["badge-gray", status];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

function formatDatetime(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function formatGender(g: "male" | "female" | "other" | null): string {
  if (!g) return "—";
  return g === "male" ? "남성" : g === "female" ? "여성" : "기타";
}

// ── 토스트 ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff", borderRadius: 8, padding: "12px 20px",
        fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }}
        aria-label="닫기"
      ><i className="ri-close-line" /></button>
    </div>
  );
}

// ── 공통 모달 래퍼 ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--gray-0, #fff)", borderRadius: 8, padding: 24,
          width: 460, maxWidth: "95vw", boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onClose, onConfirm, confirmLabel, danger, disabled }: {
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
      <button className="btn btn-outline" onClick={onClose}>취소</button>
      <button
        className={danger ? "btn btn-danger" : "btn btn-primary"}
        onClick={onConfirm}
        disabled={disabled}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

// ── 이용제한 모달 ─────────────────────────────────────────────────────────────

function SanctionModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (type: "warning" | "suspend" | "permaban", reason: string, endsAt: string | null) => void;
}) {
  const [type, setType] = useState<"warning" | "suspend" | "permaban">("warning");
  const [reason, setReason] = useState("");
  const [endsAt, setEndsAt] = useState("");

  return (
    <Modal title="이용제한 / 제재" onClose={onClose}>
      <div className="component-stack">
        <div className="field">
          <span className="field-label">제재 유형</span>
          <div className="choice-row">
            <label className="choice">
              <input type="radio" name="sanctionType" checked={type === "warning"} onChange={() => setType("warning")} />
              경고
            </label>
            <label className="choice">
              <input type="radio" name="sanctionType" checked={type === "suspend"} onChange={() => setType("suspend")} />
              일시정지
            </label>
            <label className="choice">
              <input type="radio" name="sanctionType" checked={type === "permaban"} onChange={() => setType("permaban")} />
              영구정지
            </label>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sanctionReason">사유 <span style={{ color: "var(--danger)" }}>*</span></label>
          <textarea
            className="control"
            id="sanctionReason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="제재 사유를 입력하세요 (필수)"
          />
        </div>

        {type === "suspend" && (
          <div className="field">
            <label className="field-label" htmlFor="sanctionEndsAt">정지 종료일</label>
            <input
              className="control"
              id="sanctionEndsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        )}
      </div>
      <ModalFooter
        onClose={onClose}
        onConfirm={() => onConfirm(type, reason, type === "suspend" && endsAt ? new Date(endsAt).toISOString() : null)}
        confirmLabel="제재 적용"
        danger
        disabled={!reason.trim()}
      />
    </Modal>
  );
}

// ── 포인트 조정 모달 ──────────────────────────────────────────────────────────

function PointsModal({
  currentPoints,
  onClose,
  onGrant,
  onDeduct,
  isSuperAdmin,
}: {
  currentPoints: number;
  onClose: () => void;
  onGrant: (amount: number, reason: string) => void;
  onDeduct: (amount: number, reason: string) => void;
  isSuperAdmin: boolean;
}) {
  const [action, setAction] = useState<"grant" | "deduct">("grant");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const isDeduct = action === "deduct";
  const disabled = !amount || Number(amount) <= 0 || (isDeduct && !reason.trim());

  return (
    <Modal title="포인트 조정" onClose={onClose}>
      <div className="component-stack">
        <div className="alert alert-info">
          <i className="ri-information-line" />
          <div>현재 보유 포인트: <strong>{currentPoints.toLocaleString()} P</strong></div>
        </div>
        <div className="field">
          <span className="field-label">조정 유형</span>
          <div className="choice-row">
            <label className="choice">
              <input type="radio" name="pointAction" checked={action === "grant"} onChange={() => setAction("grant")} />
              지급(+)
            </label>
            {isSuperAdmin && (
              <label className="choice">
                <input type="radio" name="pointAction" checked={action === "deduct"} onChange={() => setAction("deduct")} />
                차감(-) <span style={{ fontSize: 11, color: "var(--gray-500)" }}>[최고관리자]</span>
              </label>
            )}
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pointAmount">포인트 수량</label>
          <input
            className="control"
            id="pointAmount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="예: 500"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pointReason">
            사유 {isDeduct && <span style={{ color: "var(--danger)" }}>*</span>}
          </label>
          <textarea
            className="control"
            id="pointReason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isDeduct ? "차감 사유를 입력하세요 (필수)" : "이벤트 보상, 우수 답변 등 (선택)"}
          />
        </div>
      </div>
      <ModalFooter
        onClose={onClose}
        onConfirm={() => {
          const n = Number(amount);
          if (action === "grant") onGrant(n, reason);
          else onDeduct(n, reason);
        }}
        confirmLabel="적용하기"
        disabled={disabled}
      />
    </Modal>
  );
}

// ── 등급 변경 모달 ────────────────────────────────────────────────────────────

const GRADE_OPTIONS = [
  { level: 1, name: "새내기" },
  { level: 2, name: "작당원" },
  { level: 3, name: "실전러" },
  { level: 4, name: "고수" },
  { level: 5, name: "마스터" },
];

function GradeModal({
  currentLevel,
  onClose,
  onConfirm,
}: {
  currentLevel: number;
  onClose: () => void;
  onConfirm: (targetLevel: number, reason: string) => void;
}) {
  const [targetLevel, setTargetLevel] = useState(currentLevel);
  const [reason, setReason] = useState("");

  return (
    <Modal title="등급 변경 [최고관리자]" onClose={onClose}>
      <div className="component-stack">
        <div className="alert alert-warning">
          <i className="ri-alert-line" />
          <div>등급 변경은 포인트를 조정하여 해당 등급에 진입시킵니다.</div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="targetGrade">목표 등급</label>
          <select
            className="control"
            id="targetGrade"
            value={targetLevel}
            onChange={(e) => setTargetLevel(Number(e.target.value))}
          >
            {GRADE_OPTIONS.map((g) => (
              <option key={g.level} value={g.level}>Lv.{g.level} {g.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="gradeReason">
            사유 <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <textarea
            className="control"
            id="gradeReason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="등급 변경 사유를 입력하세요 (필수)"
          />
        </div>
      </div>
      <ModalFooter
        onClose={onClose}
        onConfirm={() => onConfirm(targetLevel, reason)}
        confirmLabel="등급 변경"
        disabled={!reason.trim()}
      />
    </Modal>
  );
}

// ── 제재 해제 모달 ────────────────────────────────────────────────────────────

function RemoveSanctionModal({
  sanction,
  onClose,
  onConfirm,
}: {
  sanction: AdminUserSanctionItem;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [, typeName] = sanctionTypeBadge(sanction.type);
  return (
    <Modal title="제재 해제 [최고관리자]" onClose={onClose}>
      <p style={{ fontSize: 14, color: "var(--gray-600)", marginBottom: 16 }}>
        <strong>{typeName}</strong> 제재를 해제합니다. 남은 동일 유형 제재가 없으면 계정 상태가 정상으로 복구됩니다.
      </p>
      <ModalFooter
        onClose={onClose}
        onConfirm={onConfirm}
        confirmLabel="해제 확정"
        danger
      />
    </Modal>
  );
}

// ── 메인 페이지 컴포넌트 ───────────────────────────────────────────────────────

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;

  const [member, setMember] = useState<AdminUserMemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [sanctionOpen, setSanctionOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [removeSanctionItem, setRemoveSanctionItem] = useState<AdminUserSanctionItem | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchMember = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/members/${userId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMember(data);
    } catch {
      showToast("회원 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [userId, showToast]);

  useEffect(() => {
    fetchMember();
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.user?.role === "super_admin") setIsSuperAdmin(true); })
      .catch(() => {});
  }, [fetchMember]);

  // ── 제재 생성 ───────────────────────────────────────────────────────────────
  async function handleSanction(type: "warning" | "suspend" | "permaban", reason: string, endsAt: string | null) {
    setSanctionOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/members/${userId}/sanctions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, reason, endsAt }),
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("제재가 적용되었습니다.", "success");
      fetchMember();
    } catch {
      showToast("제재 적용 중 오류가 발생했습니다.", "error");
    }
  }

  // ── 제재 해제 ───────────────────────────────────────────────────────────────
  async function handleRemoveSanction(sanctionId: string) {
    setRemoveSanctionItem(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/members/${userId}/sanctions/${sanctionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("제재가 해제되었습니다.", "success");
      fetchMember();
    } catch {
      showToast("제재 해제 중 오류가 발생했습니다.", "error");
    }
  }

  // ── 포인트 지급 ─────────────────────────────────────────────────────────────
  async function handleGrantPoints(amount: number, reason: string) {
    setPointsOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/members/${userId}/points`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason }),
      });
      if (!res.ok) throw new Error();
      showToast(`${amount.toLocaleString()} 포인트가 지급되었습니다.`, "success");
      fetchMember();
    } catch {
      showToast("포인트 지급 중 오류가 발생했습니다.", "error");
    }
  }

  // ── 포인트 차감 ─────────────────────────────────────────────────────────────
  async function handleDeductPoints(amount: number, reason: string) {
    setPointsOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/members/${userId}/points`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason }),
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast(`${amount.toLocaleString()} 포인트가 차감되었습니다.`, "success");
      fetchMember();
    } catch {
      showToast("포인트 차감 중 오류가 발생했습니다.", "error");
    }
  }

  // ── 등급 변경 ───────────────────────────────────────────────────────────────
  async function handleChangeGrade(targetLevel: number, reason: string) {
    setGradeOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/members/${userId}/grade`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLevel, reason }),
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("등급이 변경되었습니다.", "success");
      fetchMember();
    } catch {
      showToast("등급 변경 중 오류가 발생했습니다.", "error");
    }
  }

  if (loading) {
    return (
      <AdminShell breadcrumb={["관리자", "유저 회원 관리", "상세"]} activeKey="members">
        <div style={{ padding: 60, textAlign: "center", color: "var(--gray-400)" }}>불러오는 중...</div>
      </AdminShell>
    );
  }

  if (!member) {
    return (
      <AdminShell breadcrumb={["관리자", "유저 회원 관리", "없음"]} activeKey="members">
        <div style={{ padding: 60, textAlign: "center", color: "var(--gray-400)" }}>
          회원을 찾을 수 없습니다.
          <br />
          <Link className="btn btn-outline" href="/members" style={{ marginTop: 16, display: "inline-flex" }}>
            <i className="ri-arrow-left-line" />목록으로
          </Link>
        </div>
      </AdminShell>
    );
  }

  const [statusCls, statusLabel] = statusBadge(member.status);
  const gradeCls = GRADE_BADGE[member.gradeLevel] ?? "badge-gray";

  return (
    <AdminShell breadcrumb={["관리자", "유저 회원 관리", member.nickname]} activeKey="members">
      {/* 클라이언트 탭 컨트롤러 */}
      <MemberActivityTabs />

      <div className="page-header">
        <div>
          <h1 className="page-title">유저 회원 상세</h1>
          <p className="page-description">{member.email} · 활동 내역을 확인하고 처리 액션을 수행합니다.</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/members">
            <i className="ri-arrow-left-line" />목록으로
          </Link>
          <button className="btn btn-outline" onClick={() => setPointsOpen(true)}>
            <i className="ri-coin-line" />포인트 조정
          </button>
          {isSuperAdmin && (
            <button className="btn btn-outline" onClick={() => setGradeOpen(true)}>
              <i className="ri-award-line" />등급 변경
            </button>
          )}
          <button className="btn btn-danger" onClick={() => setSanctionOpen(true)}>
            <i className="ri-user-forbid-line" />이용제한
          </button>
        </div>
      </div>

      {/* 프로필 헤더 — #5: 실이미지 표시 */}
      <section className="section">
        <article className="card">
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "flex-start", gap: "24px" }}>
              <div style={{ display: "flex", gap: "20px", flex: 1, alignItems: "center" }}>
                <UserAvatar
                  size={72}
                  alt={member.nickname}
                  avatarUrl={member.avatarUrl}
                  image={member.image}
                  defaultAvatarIndex={member.defaultAvatarIndex}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1.2 }}>{member.nickname}</span>
                    <span className={`badge ${gradeCls}`}>Lv.{member.gradeLevel} {member.gradeName}</span>
                  </div>
                  <div className="content-meta" style={{ marginBottom: "10px" }}>
                    <span>{member.email}</span>
                    <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                    <span>가입 {formatDate(member.createdAt)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                    <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-primary, #6366f1)", lineHeight: 1 }}>
                      {member.totalPoints.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 500, opacity: 0.6 }}>P 보유</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                <span className={`badge ${statusCls}`} style={{ fontSize: "13px", padding: "4px 12px" }}>
                  {statusLabel}
                </span>
                <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                  <span className="content-meta" style={{ fontSize: "12px" }}>
                    <i className="ri-article-line" style={{ marginRight: "4px" }} />
                    글 {member.postCount}
                  </span>
                  <span className="content-meta" style={{ fontSize: "12px" }}>
                    <i className="ri-flag-line" style={{ marginRight: "4px" }} />
                    신고 {member.reportCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* 기본 정보 — #21: 성별/생년월일/마케팅동의/약관동의/연락처 추가 (2줄 그리드) */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">기본 정보</h2>
          </div>
        </div>
        <article className="card">
          <div className="card-body">
            <div className="detail-list">
              <div className="detail-row">
                <div className="detail-label">이메일</div>
                <div className="detail-value">{member.email}</div>
              </div>
              {member.name && (
                <div className="detail-row">
                  <div className="detail-label">이름</div>
                  <div className="detail-value">{member.name}</div>
                </div>
              )}
              {member.bio && (
                <div className="detail-row">
                  <div className="detail-label">소개</div>
                  <div className="detail-value">{member.bio}</div>
                </div>
              )}
              <div className="detail-row">
                <div className="detail-label">포인트</div>
                <div className="detail-value">{member.totalPoints.toLocaleString()} P</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">등급</div>
                <div className="detail-value">
                  <span className={`badge ${gradeCls}`}>{member.gradeName}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>Lv.{member.gradeLevel}</span>
                </div>
              </div>
            </div>

            {/* 추가 정보 2줄 그리드 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                borderTop: "1px solid var(--border)",
                marginTop: 16,
                paddingTop: 12,
              }}
            >
              {/* 1줄: 연락처 / 성별 / 생년월일 */}
              <div className="detail-row" style={{ borderRight: "1px solid var(--border)" }}>
                <div className="detail-label">연락처</div>
                <div className="detail-value">{member.phone || "—"}</div>
              </div>
              <div className="detail-row" style={{ borderRight: "1px solid var(--border)", paddingLeft: 16 }}>
                <div className="detail-label">성별</div>
                <div className="detail-value">{formatGender(member.gender)}</div>
              </div>
              <div className="detail-row" style={{ paddingLeft: 16 }}>
                <div className="detail-label">생년월일</div>
                <div className="detail-value">{member.birthDate || "—"}</div>
              </div>
              {/* 2줄: 약관 동의 / 마케팅 동의 */}
              <div className="detail-row" style={{ borderRight: "1px solid var(--border)" }}>
                <div className="detail-label">약관 동의</div>
                <div className="detail-value" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={`badge ${member.termsAgreedAt ? "badge-green" : "badge-gray"}`}>
                    {member.termsAgreedAt ? "동의" : "미동의"}
                  </span>
                  {member.termsAgreedAt && (
                    <span style={{ fontSize: 11, opacity: 0.6 }}>{formatDate(member.termsAgreedAt)}</span>
                  )}
                </div>
              </div>
              <div className="detail-row" style={{ paddingLeft: 16 }}>
                <div className="detail-label">마케팅 동의</div>
                <div className="detail-value" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={`badge ${member.marketingAgreedAt ? "badge-green" : "badge-gray"}`}>
                    {member.marketingAgreedAt ? "동의" : "미동의"}
                  </span>
                  {member.marketingAgreedAt && (
                    <span style={{ fontSize: 11, opacity: 0.6 }}>{formatDate(member.marketingAgreedAt)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* 활동 내역 — #22: 4탭 (작성한 게시글 / 작성한 댓글 / 로그인 기록 / 제재 이력) */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">활동 내역</h2>
            <p className="section-description">작성 게시글·댓글, 로그인 기록, 제재 이력을 탭으로 확인합니다.</p>
          </div>
        </div>

        <article className="card" id="member-activity-tabs">
          <div className="line-tabs" role="tablist" aria-label="활동 내역">
            <button className="line-tab active" data-tab="posts">
              작성한 게시글 ({member.recentPosts.length})
            </button>
            <button className="line-tab" data-tab="comments">
              작성한 댓글 ({member.recentComments.length})
            </button>
            <button className="line-tab" data-tab="sessions">
              로그인 기록 ({member.loginSessions.length})
            </button>
            <button className="line-tab" data-tab="sanctions">
              제재 이력 ({member.sanctions.length})
            </button>
          </div>

          {/* 작성한 게시글 패널 */}
          <div data-tab-panel="posts">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>제목</th>
                    <th style={{ width: 90 }}>상태</th>
                    <th style={{ width: 100 }}>작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {member.recentPosts.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: 24, opacity: 0.5 }}>
                        작성한 게시글이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    member.recentPosts.map((p) => {
                      const [sCls, sLabel] = postStatusBadge(p.status);
                      const href = `/posts/${dbBoardToAdminSlug(p.board)}/${p.id}`;
                      return (
                        <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => router.push(href)}>
                          <td>
                            <Link
                              href={href}
                              className="content-title"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {p.title}
                            </Link>
                          </td>
                          <td>
                            <span className={`badge ${sCls}`}>{sLabel}</span>
                          </td>
                          <td className="num">{formatDate(p.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 작성한 댓글 패널 */}
          <div data-tab-panel="comments">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>내용</th>
                    <th style={{ width: 100 }}>대상 유형</th>
                    <th style={{ width: 100 }}>작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {member.recentComments.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: 24, opacity: 0.5 }}>
                        작성한 댓글이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    member.recentComments.map((c) => {
                      // getCrossLink: post → /posts/{boardSlug}/{postId}, question/answer → /qna/:id, resource → /resources/:id
                      const href = getCrossLink(c.targetType, c.targetId, c.board);
                      return (
                        <tr
                          key={c.id}
                          style={{ cursor: href ? "pointer" : undefined }}
                          onClick={() => { if (href) router.push(href); }}
                        >
                          <td>
                            {href ? (
                              <Link
                                href={href}
                                className="content-title"
                                style={{ maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {c.content}
                              </Link>
                            ) : (
                              <div className="content-title" style={{ maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {c.content}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-blue">{c.targetType}</span>
                          </td>
                          <td className="num">{formatDate(c.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 로그인 기록 패널 */}
          <div data-tab-panel="sessions">
            <div style={{ padding: "12px 16px 8px", fontSize: 12, color: "var(--gray-500)", background: "var(--surface-subtle, var(--gray-50))", borderBottom: "1px solid var(--border)" }}>
              <i className="ri-information-line" style={{ marginRight: 4 }} />
              명시적 로그아웃 이력은 기록되지 않습니다. 로그인 시각과 세션 갱신·만료 정보를 표시합니다.
            </div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>로그인 시각</th>
                    <th>마지막 갱신</th>
                    <th>세션 만료</th>
                  </tr>
                </thead>
                <tbody>
                  {member.loginSessions.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: 24, opacity: 0.5 }}>
                        로그인 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    member.loginSessions.map((s, i) => (
                      <tr key={i}>
                        <td className="num">{formatDatetime(s.createdAt)}</td>
                        <td className="num">{formatDatetime(s.updatedAt)}</td>
                        <td className="num">{formatDatetime(s.expiresAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 제재 이력 패널 */}
          <div data-tab-panel="sanctions">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>제재 유형</th>
                    <th>사유</th>
                    <th>시작일</th>
                    <th>종료일</th>
                    {isSuperAdmin && <th style={{ width: 80 }}>해제</th>}
                  </tr>
                </thead>
                <tbody>
                  {member.sanctions.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 5 : 4} style={{ textAlign: "center", padding: 24, opacity: 0.5 }}>
                        제재 이력이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    member.sanctions.map((s) => {
                      const [typeCls, typeName] = sanctionTypeBadge(s.type);
                      return (
                        <tr key={s.id}>
                          <td><span className={`badge ${typeCls}`}>{typeName}</span></td>
                          <td><div className="content-title">{s.reason}</div></td>
                          <td className="num">{formatDate(s.startsAt)}</td>
                          <td className="num">{s.endsAt ? formatDate(s.endsAt) : (s.type === "permaban" ? "영구" : "—")}</td>
                          {isSuperAdmin && (
                            <td>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => setRemoveSanctionItem(s)}
                              >
                                해제
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </section>

      {/* ===== 모달 ===== */}

      {sanctionOpen && (
        <SanctionModal onClose={() => setSanctionOpen(false)} onConfirm={handleSanction} />
      )}

      {pointsOpen && (
        <PointsModal
          currentPoints={member.totalPoints}
          onClose={() => setPointsOpen(false)}
          onGrant={handleGrantPoints}
          onDeduct={handleDeductPoints}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {gradeOpen && (
        <GradeModal
          currentLevel={member.gradeLevel}
          onClose={() => setGradeOpen(false)}
          onConfirm={handleChangeGrade}
        />
      )}

      {removeSanctionItem && (
        <RemoveSanctionModal
          sanction={removeSanctionItem}
          onClose={() => setRemoveSanctionItem(null)}
          onConfirm={() => handleRemoveSanction(removeSanctionItem.id)}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}
