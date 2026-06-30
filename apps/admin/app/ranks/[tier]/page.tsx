"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "@/lib/api";
import { confirmDialog, notifyDialog } from "@/lib/dialog";
import type { AdminGrade } from "@ai-jakdang/contracts";

/**
 * 등급 상세·설정 페이지(/ranks/[tier]).
 * [tier] param = grade UUID.
 * GET /api/v1/admin/grades 목록을 받아 해당 id를 찾은 뒤 표시한다.
 * 없는 id 면 "등급을 찾을 수 없습니다." 오류를 표시한다.
 *
 * PATCH /api/v1/admin/grades/:id — 설정 저장 (staff+)
 * DELETE /api/v1/admin/grades/:id — 등급 삭제 (super_admin), 인라인 2단계 확인
 */

// 레벨별 뱃지 이미지 (로컬 정적 에셋)
const GRADE_BADGE_BY_LEVEL: Record<number, string> = {
  1: "/badges/rookie.png",
  2: "/badges/member.png",
  3: "/badges/practitioner.png",
  4: "/badges/expert.png",
  5: "/badges/master.png",
};

function badgeForLevel(level: number): string {
  return GRADE_BADGE_BY_LEVEL[level] ?? "/badges/rookie.png";
}

export default function RankTierSettingsPage({
  params,
}: {
  /** Next.js App Router: params 는 Promise */
  params: Promise<{ tier: string }>;
}) {
  // React 19 use() 로 Promise params 언랩
  const { tier } = use(params);
  const router = useRouter();

  const [allGrades, setAllGrades] = useState<AdminGrade[]>([]);
  const [grade, setGrade] = useState<AdminGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 폼 상태 (등급 로드 후 초기화)
  const [name, setName] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [maxPoints, setMaxPoints] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 저장·삭제 상태
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 등급 목록을 받아 tier(UUID)로 찾기
  const fetchGrade = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/grades`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items: AdminGrade[] };
      const items = data.items ?? [];
      setAllGrades(items);
      const found = items.find((g) => g.id === tier);
      if (!found) {
        setNotFound(true);
        return;
      }
      setGrade(found);
      setName(found.name);
      setMinPoints(String(found.minPoints));
      setMaxPoints(found.maxPoints != null ? String(found.maxPoints) : "");
      setImageUrl(found.imageUrl ?? null);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [tier]);

  useEffect(() => {
    fetchGrade();
  }, [fetchGrade]);

  // 인접 등급 계산 (이전·다음)
  const sorted = [...allGrades].sort((a, b) => a.level - b.level);
  const idx = grade ? sorted.findIndex((g) => g.id === grade.id) : -1;
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

  // 뱃지 이미지 업로드
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/grades/upload-badge`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(d?.error?.message ?? "이미지 업로드에 실패했습니다.");
      }
      const { url } = (await res.json()) as { url: string };
      setImageUrl(url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // 설정 저장 (PATCH)
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!grade) return;
    if (!name.trim()) { setSaveError("등급명을 입력해주세요."); return; }
    const minPtsNum = parseInt(minPoints, 10);
    if (isNaN(minPtsNum) || minPtsNum < 0) { setSaveError("달성 기준은 0 이상의 정수여야 합니다."); return; }

    const body: Record<string, unknown> = {
      name: name.trim(),
      minPoints: minPtsNum,
      imageUrl: imageUrl ?? null,
    };
    if (maxPoints.trim() !== "") {
      const maxPtsNum = parseInt(maxPoints, 10);
      if (isNaN(maxPtsNum) || maxPtsNum < 0) { setSaveError("최대 포인트는 0 이상의 정수여야 합니다."); return; }
      body.maxPoints = maxPtsNum;
    } else {
      body.maxPoints = null;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/grades/${grade.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(d?.error?.message ?? "저장에 실패했습니다.");
      }
      const updated = (await res.json()) as AdminGrade;
      setGrade(updated);
      setName(updated.name);
      setMinPoints(String(updated.minPoints));
      setMaxPoints(updated.maxPoints != null ? String(updated.maxPoints) : "");
      setImageUrl(updated.imageUrl ?? null);
      await notifyDialog("설정이 저장되었습니다.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // 등급 삭제 (DELETE) — confirmDialog 모달 확인 후 진행
  async function handleDeleteClick() {
    if (!grade) return;
    if (!(await confirmDialog({ title: "등급 삭제", message: "정말 삭제하시겠습니까?", tone: "danger" }))) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/grades/${grade.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(d?.error?.message ?? "삭제에 실패했습니다.");
      }
      await notifyDialog("등급이 삭제되었습니다.");
      router.push("/ranks");
      router.refresh();
    } catch (err) {
      await notifyDialog(err instanceof Error ? err.message : "삭제에 실패했습니다.", "danger");
    } finally {
      setDeleting(false);
    }
  }

  // ── 로딩 / 오류 화면 ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AdminShell breadcrumb={["관리자", "등급 관리", "불러오는 중..."]} activeKey="ranks">
        <div style={{ padding: 60, textAlign: "center", color: "var(--gray-400)" }}>
          불러오는 중...
        </div>
      </AdminShell>
    );
  }

  if (notFound || !grade) {
    return (
      <AdminShell breadcrumb={["관리자", "등급 관리", "오류"]} activeKey="ranks">
        <div className="page-header">
          <div>
            <h1 className="page-title">등급을 찾을 수 없습니다</h1>
            <p className="page-description">요청한 등급 ID({tier})가 존재하지 않습니다.</p>
          </div>
          <div className="page-actions">
            <Link className="btn btn-outline" href="/ranks">
              <i className="ri-arrow-left-line" />
              목록으로
            </Link>
          </div>
        </div>
      </AdminShell>
    );
  }

  // ── 메인 렌더 ────────────────────────────────────────────────────────────────

  return (
    <AdminShell
      breadcrumb={["관리자", "등급 관리", grade.name]}
      activeKey="ranks"
    >
      <form onSubmit={handleSave}>
        <div className="page-header">
          <div>
            <h1 className="page-title">{grade.name} 등급 설정</h1>
            <p className="page-description">
              누적 작당력(기여 점수) 기준·이름을 설정합니다.
              Lv.{grade.level} — 자동 부여 등급.
            </p>
          </div>
          <div className="page-actions">
            <Link className="btn btn-outline" href="/ranks">
              <i className="ri-arrow-left-line" />
              목록으로
            </Link>

            {/* 삭제 버튼 — confirmDialog 모달 확인 */}
            <button
              className="btn btn-danger"
              type="button"
              onClick={handleDeleteClick}
              disabled={deleting}
            >
              <i className="ri-delete-bin-line" />
              {deleting ? "삭제 중..." : "등급 삭제"}
            </button>

            <button className="btn btn-primary" type="submit" disabled={saving}>
              <i className="ri-save-line" />
              {saving ? "저장 중..." : "설정 저장"}
            </button>
          </div>
        </div>

        {/* 자동 부여 안내 */}
        <div className="alert alert-info" style={{ marginBottom: "20px" }}>
          <i className="ri-information-line" />
          <div>
            이 등급은 회원의 <strong>누적 작당력</strong>이 기준을 넘으면 자동으로 부여됩니다.
            운영자는 수동으로 지급하지 않습니다.
          </div>
        </div>

        {saveError && (
          <div className="alert alert-error" style={{ marginBottom: "16px" }}>
            <i className="ri-error-warning-line" />
            {saveError}
          </div>
        )}

        {/* 뱃지 이미지 + 기본 설정 2단 그리드 */}
        <section className="section">
          <div
            className="grid"
            style={{
              gridTemplateColumns: "minmax(220px, 280px) 1fr",
              gap: "20px",
              alignItems: "start",
            }}
          >
            {/* 좌: 뱃지 이미지 미리보기 + 업로드 */}
            <article className="card">
              <div
                className="card-body component-stack"
                style={{ alignItems: "center", textAlign: "center" }}
              >
                <img
                  src={imageUrl ?? badgeForLevel(grade.level)}
                  alt={`${grade.name} 뱃지`}
                  width={140}
                  height={140}
                  style={{ borderRadius: 12, objectFit: "contain" }}
                />
                <div>
                  <div className="card-title">{grade.name}</div>
                  <div className="card-subtitle">
                    Lv.{grade.level} · 누적 작당력 {grade.minPoints.toLocaleString()} 이상
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={handleImageSelect}
                />
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i className="ri-image-edit-line" />
                  {uploading ? "업로드 중..." : "뱃지 이미지 등록 / 교체"}
                </button>
                <div className="field-help">
                  권장 규격: 240×240 px · PNG(투명 배경) · 최대 5 MB.
                </div>
              </div>
            </article>

            {/* 우: 등급 기본 설정 폼 */}
            <article className="card">
              <div className="card-body component-stack">
                <div className="section-heading" style={{ marginBottom: 0 }}>
                  <div>
                    <h2 className="section-title" style={{ fontSize: "18px" }}>
                      기본 설정
                    </h2>
                    <p className="section-description">
                      등급명과 자동 부여 기준(작당력 임계값)을 설정합니다.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="tierLabel">
                      등급명
                    </label>
                    <input
                      className="control"
                      id="tierLabel"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <div className="field-help">
                      회원 프로필·게시글 작성자 옆 등에 표시됩니다.
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="tierThreshold">
                      달성 기준 — 최소 누적 작당력
                    </label>
                    <div className="input-icon">
                      <i className="ri-copper-coin-line" />
                      <input
                        className="control"
                        id="tierThreshold"
                        type="number"
                        value={minPoints}
                        onChange={(e) => setMinPoints(e.target.value)}
                        min={0}
                        required
                      />
                    </div>
                    <div className="field-help">
                      {prev
                        ? `이전 등급 ${prev.name}(작당력 ${prev.minPoints.toLocaleString()}) 보다 커야 합니다.`
                        : "가장 낮은 등급입니다. 보통 0으로 둡니다."}
                      {next
                        ? ` 다음 등급 ${next.name}(작당력 ${next.minPoints.toLocaleString()}) 미만이어야 합니다.`
                        : ""}
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="tierMaxPoints">
                      최대 포인트 (선택)
                    </label>
                    <div className="input-icon">
                      <i className="ri-copper-coin-line" />
                      <input
                        className="control"
                        id="tierMaxPoints"
                        type="number"
                        placeholder="최고 등급이면 비워두세요"
                        value={maxPoints}
                        onChange={(e) => setMaxPoints(e.target.value)}
                        min={0}
                      />
                    </div>
                    <div className="field-help">
                      비워두면 제한 없음(최고 등급)으로 설정됩니다.
                    </div>
                  </div>
                </div>

                {/* 상태 토글 (디자인용) */}
                <div className="field">
                  <span className="field-label">상태</span>
                  <div className="choice-row">
                    <label className="switch" aria-label="등급 활성화">
                      <input type="checkbox" defaultChecked />
                      <span className="switch-track" />
                    </label>
                    <span style={{ color: "var(--gray-500)" }}>
                      이 등급을 사용합니다(끄면 등급 산정에서 제외).
                    </span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* 이 등급의 권한 토글 (디자인용) */}
        <section className="section">
          <div className="section-heading">
            <div>
              <h2 className="section-title">{grade.name} 등급 권한</h2>
              <p className="section-description">
                이 등급 회원에게 허용할 활동을 토글로 설정합니다.
              </p>
            </div>
          </div>

          <article className="card">
            <div className="card-body component-stack">
              {[
                { key: "write", label: "글쓰기", desc: "게시글 작성 허용", on: true },
                { key: "comment", label: "댓글", desc: "댓글 작성 허용", on: true },
                { key: "resource", label: "실전자료 등록", desc: "자료 업로드 허용", on: grade.level >= 3 },
                { key: "link", label: "링크 첨부", desc: "외부 링크 삽입 허용", on: grade.level >= 2 },
                { key: "file", label: "파일 첨부", desc: "파일 업로드 허용", on: grade.level >= 3 },
                { key: "report", label: "신고", desc: "콘텐츠 신고 허용", on: true },
                { key: "limit", label: "일일 작성 제한 완화", desc: "하루 작성 한도 상향", on: grade.level >= 3 },
              ].map((perm) => (
                <div className="choice-row" key={perm.key}>
                  <label className="switch" aria-label={`${perm.label} 허용`}>
                    <input type="checkbox" defaultChecked={perm.on} />
                    <span className="switch-track" />
                  </label>
                  <div>
                    <strong>{perm.label}</strong>
                    <span style={{ color: "var(--gray-500)", marginLeft: 8, fontSize: 13 }}>
                      {perm.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </form>
    </AdminShell>
  );
}
