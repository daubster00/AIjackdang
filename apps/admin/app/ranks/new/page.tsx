"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "@/lib/api";
import { notifyDialog } from "@/lib/dialog";

/**
 * 새 등급 추가 페이지(/ranks/new).
 * POST /api/v1/admin/grades — 등급 신규 생성 (super_admin).
 * 등록 성공 시 /ranks 목록으로 이동한다.
 */

const NEW_PERMS = [
  { key: "write", label: "글쓰기", desc: "게시글 작성", on: true },
  { key: "comment", label: "댓글", desc: "댓글 작성", on: true },
  { key: "resource", label: "실전자료 등록", desc: "자료 업로드", on: false },
  { key: "link", label: "링크 첨부", desc: "외부 링크 삽입", on: false },
  { key: "file", label: "파일 첨부", desc: "파일 업로드", on: false },
  { key: "report", label: "신고", desc: "콘텐츠 신고", on: true },
  { key: "limit", label: "일일 작성 제한 완화", desc: "하루 작성 한도 상향", on: false },
] as const;

export default function RankNewPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [maxPoints, setMaxPoints] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      // 같은 파일 재선택 허용을 위해 value 초기화
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("등급명을 입력해주세요."); return; }
    const levelNum = parseInt(level, 10);
    if (isNaN(levelNum) || levelNum < 1) { setError("레벨은 1 이상의 정수여야 합니다."); return; }
    const minPtsNum = parseInt(minPoints, 10);
    if (isNaN(minPtsNum) || minPtsNum < 0) { setError("달성 기준(최소 포인트)은 0 이상의 정수여야 합니다."); return; }

    const body: Record<string, unknown> = {
      level: levelNum,
      name: name.trim(),
      minPoints: minPtsNum,
      imageUrl: imageUrl ?? null,
    };
    if (maxPoints.trim() !== "") {
      const maxPtsNum = parseInt(maxPoints, 10);
      if (isNaN(maxPtsNum) || maxPtsNum < 0) { setError("최대 포인트는 0 이상의 정수여야 합니다."); return; }
      body.maxPoints = maxPtsNum;
    } else {
      body.maxPoints = null;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/grades`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        setError("동일한 레벨(level)의 등급이 이미 존재합니다. 다른 레벨을 입력해주세요.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(d?.error?.message ?? "등급 추가에 실패했습니다.");
      }
      await notifyDialog("등급이 추가되었습니다.");
      router.push("/ranks");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "등급 추가에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell breadcrumb={["관리자", "등급 관리", "새 등급"]} activeKey="ranks">
      <form onSubmit={handleSubmit}>
        <div className="page-header">
          <div>
            <h1 className="page-title">새 등급 추가</h1>
            <p className="page-description">
              새 등급의 이름·레벨·달성 기준(작당력 임계값)을 입력해 등급을 생성합니다.
            </p>
          </div>
          <div className="page-actions">
            <Link className="btn btn-outline" href="/ranks">
              <i className="ri-arrow-left-line" />
              취소
            </Link>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <i className="ri-add-line" />
              {saving ? "추가 중..." : "등급 추가"}
            </button>
          </div>
        </div>

        {/* 안내 */}
        <div className="alert alert-info" style={{ marginBottom: "20px" }}>
          <i className="ri-information-line" />
          <div>
            새 등급은 누적 작당력(기여 점수) 기준을 넘으면 <strong>자동으로 부여</strong>됩니다.
            등급 순서(Lv.)는 레벨 번호로 결정됩니다.
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "20px" }}>
            <i className="ri-error-warning-line" />
            {error}
          </div>
        )}

        {/* 뱃지 이미지 업로드 + 기본 정보 2단 그리드 */}
        <section className="section">
          <div
            className="grid"
            style={{
              gridTemplateColumns: "minmax(220px, 280px) 1fr",
              gap: "20px",
              alignItems: "start",
            }}
          >
            {/* 좌: 뱃지 이미지 업로드 */}
            <article className="card">
              <div
                className="card-body component-stack"
                style={{ alignItems: "center", textAlign: "center" }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="뱃지 이미지 미리보기"
                    width={140}
                    height={140}
                    style={{ borderRadius: 12, objectFit: "contain" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 12,
                      background: "var(--gray-100)",
                      border: "2px dashed var(--gray-300)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: 8,
                      color: "var(--gray-400)",
                    }}
                    aria-label="뱃지 이미지 미리보기"
                  >
                    <i className="ri-image-add-line" style={{ fontSize: 36 }} />
                    <span style={{ fontSize: 12 }}>이미지 없음</span>
                  </div>
                )}
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
                  <i className="ri-upload-line" />
                  {uploading ? "업로드 중..." : "뱃지 이미지 업로드"}
                </button>
                <div className="field-help">
                  권장 규격: 240×240 px · PNG(투명 배경) · 최대 5 MB.
                </div>
              </div>
            </article>

            {/* 우: 등급 기본 정보 폼 */}
            <article className="card">
              <div className="card-body component-stack">
                <div className="section-heading" style={{ marginBottom: 0 }}>
                  <div>
                    <h2 className="section-title" style={{ fontSize: "18px" }}>기본 정보</h2>
                    <p className="section-description">새 등급의 레벨·이름과 달성 기준을 입력합니다.</p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="newTierLevel">등급 레벨 (Lv.)</label>
                    <input
                      className="control"
                      id="newTierLevel"
                      type="number"
                      placeholder="예: 6"
                      min={1}
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      required
                    />
                    <div className="field-help">기존 등급(1~5)과 겹치지 않는 정수를 입력하세요.</div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="newTierLabel">등급명</label>
                    <input
                      className="control"
                      id="newTierLabel"
                      type="text"
                      placeholder="예: 슈퍼마스터"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <div className="field-help">회원 프로필·게시글 작성자 옆 등에 표시됩니다.</div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="newTierThreshold">
                      달성 기준 — 최소 누적 작당력
                    </label>
                    <div className="input-icon">
                      <i className="ri-copper-coin-line" />
                      <input
                        className="control"
                        id="newTierThreshold"
                        type="number"
                        placeholder="예: 10000"
                        min={0}
                        value={minPoints}
                        onChange={(e) => setMinPoints(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field-help">
                      이 수치 이상의 누적 작당력을 가진 회원에게 자동 부여됩니다.
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="newTierMaxPoints">
                      최대 포인트 (선택)
                    </label>
                    <div className="input-icon">
                      <i className="ri-copper-coin-line" />
                      <input
                        className="control"
                        id="newTierMaxPoints"
                        type="number"
                        placeholder="최고 등급이면 비워두세요"
                        min={0}
                        value={maxPoints}
                        onChange={(e) => setMaxPoints(e.target.value)}
                      />
                    </div>
                    <div className="field-help">최고 등급은 비워두면 제한 없음으로 설정됩니다.</div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* 권한 설정 (디자인용) */}
        <section className="section">
          <div className="section-heading">
            <div>
              <h2 className="section-title">권한 설정</h2>
              <p className="section-description">
                이 등급 회원에게 허용할 활동을 선택합니다.
              </p>
            </div>
          </div>

          <article className="card">
            <div className="card-body component-stack">
              {NEW_PERMS.map((perm) => (
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

        {/* 하단 액션 */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
          <Link className="btn btn-outline" href="/ranks">
            <i className="ri-arrow-left-line" />
            취소
          </Link>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            <i className="ri-add-line" />
            {saving ? "추가 중..." : "등급 추가"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
