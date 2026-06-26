"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import type { AdminAdSlotItem } from "@ai-jakdang/contracts";

/**
 * 광고 관리 페이지 (Story 9.16).
 * super_admin 전용. GET /api/v1/admin/ads 실제 API 연동.
 * 등록(POST), 토글(PATCH toggle), 삭제(DELETE + 사유 모달).
 */

const PLACEMENTS: { label: string; value: string }[] = [
  { label: "메인 상단", value: "main_top" },
  { label: "메인 중간", value: "main_middle" },
  { label: "게시글 목록 상단", value: "post_list_top" },
  { label: "게시글 목록 중간", value: "post_list_middle" },
  { label: "게시글 상세 본문 상단", value: "post_detail_top" },
  { label: "게시글 상세 본문 하단", value: "post_detail_bottom" },
  { label: "실전자료 다운로드 영역", value: "resource_download" },
  { label: "사이드바", value: "sidebar" },
  { label: "모바일 하단", value: "mobile_bottom" },
];

const TYPE_BADGE: Record<string, string> = {
  adsense: "badge-green",
  direct_banner: "badge-blue",
  text: "badge-gray",
  affiliate: "badge-purple",
  internal: "badge-cyan",
};

const TYPE_LABEL: Record<string, string> = {
  adsense: "애드센스",
  direct_banner: "직접배너",
  text: "텍스트",
  affiliate: "제휴링크",
  internal: "내부홍보",
};

const DEVICE_LABEL: Record<string, string> = {
  all: "PC·모바일",
  pc: "PC",
  mobile: "모바일",
};

function computeStatus(ad: AdminAdSlotItem): { label: string; badge: string } {
  if (!ad.isActive) return { label: "일시중지", badge: "badge-orange" };
  const today = new Date().toISOString().slice(0, 10);
  if (ad.startDate && ad.startDate > today) return { label: "예약", badge: "badge-cyan" };
  if (ad.endDate && ad.endDate < today) return { label: "종료", badge: "badge-gray" };
  return { label: "노출중", badge: "badge-green" };
}

function formatDate(d: string | null): string {
  if (!d) return "상시";
  return d.slice(0, 10).replace(/-/g, ".");
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

function formatCtr(ctr: number): string {
  return (ctr * 100).toFixed(2) + "%";
}

// ── 삭제 모달 ──────────────────────────────────────────────────────────────────

function DeleteModal({
  ad,
  onConfirm,
  onClose,
}: {
  ad: AdminAdSlotItem;
  onConfirm: (id: string, note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">광고 삭제</div>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: 12 }}>
            <strong>{ad.name}</strong> 광고를 삭제하시겠습니까?
            <br />
            <span style={{ color: "var(--gray-500)", fontSize: "0.875rem" }}>
              삭제된 광고는 복구할 수 없습니다.
            </span>
          </p>
          <div className="field">
            <label className="field-label" htmlFor="deleteNote">
              삭제 사유 <span style={{ color: "var(--red-500)" }}>*</span>
            </label>
            <textarea
              className="control"
              id="deleteNote"
              rows={3}
              placeholder="삭제 사유를 입력해주세요."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn-danger"
            disabled={!note.trim()}
            onClick={() => note.trim() && onConfirm(ad.id, note.trim())}
          >
            삭제 확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 등록/수정 드로어 폼 ────────────────────────────────────────────────────────

interface AdFormData {
  name: string;
  adType: string;
  placement: string;
  device: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  clickUrl: string;
  imageUrl: string;
  code: string;
  memo: string;
}

const EMPTY_FORM: AdFormData = {
  name: "",
  adType: "direct_banner",
  placement: "main_top",
  device: "all",
  startDate: "",
  endDate: "",
  isActive: true,
  clickUrl: "",
  imageUrl: "",
  code: "",
  memo: "",
};

function AdFormDrawer({
  open,
  editAd,
  onClose,
  onSaved,
}: {
  open: boolean;
  editAd: AdminAdSlotItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AdFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editAd) {
      setForm({
        name: editAd.name,
        adType: editAd.adType,
        placement: editAd.placement,
        device: editAd.device,
        startDate: editAd.startDate ?? "",
        endDate: editAd.endDate ?? "",
        isActive: editAd.isActive,
        clickUrl: editAd.clickUrl ?? "",
        imageUrl: editAd.imageUrl ?? "",
        code: editAd.code ?? "",
        memo: editAd.memo ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [editAd, open]);

  const set = (k: keyof AdFormData, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("광고명을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        adType: form.adType,
        placement: form.placement,
        device: form.device,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        isActive: form.isActive,
        clickUrl: form.clickUrl || null,
        imageUrl: form.imageUrl || null,
        code: form.code || null,
        memo: form.memo || null,
      };

      const url = editAd
        ? `${API_BASE_URL}/api/v1/admin/ads/${editAd.id}`
        : `${API_BASE_URL}/api/v1/admin/ads`;
      const method = editAd ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? "저장에 실패했습니다.");
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer open" id="adForm" aria-label="광고 등록 패널">
        <div className="drawer-header">
          <div>
            <div className="modal-title">{editAd ? "광고 수정" : "광고 등록"}</div>
            <div className="card-subtitle">노출 위치와 기간, 광고 소재를 입력합니다.</div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="패널 닫기">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="drawer-body">
          <div className="component-stack">
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 8 }}>
                <i className="ri-error-warning-line" />
                {error}
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="adName">
                광고명
              </label>
              <input
                className="control"
                id="adName"
                type="text"
                placeholder="예: AI 자동화 부트캠프 모집 배너"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="adType">
                  광고 유형
                </label>
                <select
                  className="control"
                  id="adType"
                  value={form.adType}
                  onChange={(e) => set("adType", e.target.value)}
                >
                  {Object.entries(TYPE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="adPlacement">
                  노출 위치
                </label>
                <select
                  className="control"
                  id="adPlacement"
                  value={form.placement}
                  onChange={(e) => set("placement", e.target.value)}
                >
                  {PLACEMENTS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <span className="field-label">PC / 모바일 구분</span>
              <div className="choice-row">
                {(["all", "pc", "mobile"] as const).map((d) => (
                  <label className="choice" key={d}>
                    <input
                      type="radio"
                      name="adDevice"
                      checked={form.device === d}
                      onChange={() => set("device", d)}
                    />
                    {DEVICE_LABEL[d]}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="adStart">
                  노출 시작일
                </label>
                <div className="input-icon">
                  <i className="ri-calendar-line" />
                  <input
                    className="control"
                    id="adStart"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="adEnd">
                  노출 종료일
                </label>
                <div className="input-icon">
                  <i className="ri-calendar-line" />
                  <input
                    className="control"
                    id="adEnd"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set("endDate", e.target.value)}
                    placeholder="비워두면 상시 노출"
                  />
                </div>
              </div>
            </div>

            <div className="field">
              <span className="field-label">노출 상태</span>
              <div className="choice-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => set("isActive", e.target.checked)}
                  />
                  <span className="switch-track" />
                </label>
                <span style={{ color: "var(--gray-500)" }}>
                  활성화하면 시작일부터 즉시 노출됩니다.
                </span>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="adUrl">
                클릭 URL
              </label>
              <div className="input-icon">
                <i className="ri-links-line" />
                <input
                  className="control"
                  id="adUrl"
                  type="url"
                  placeholder="https://"
                  value={form.clickUrl}
                  onChange={(e) => set("clickUrl", e.target.value)}
                />
              </div>
              <div className="field-help">광고를 클릭하면 이동할 주소입니다.</div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="adImageUrl">
                배너 이미지 URL
              </label>
              <div className="input-icon">
                <i className="ri-image-line" />
                <input
                  className="control"
                  id="adImageUrl"
                  type="url"
                  placeholder="https://cdn.example.com/banner.jpg"
                  value={form.imageUrl}
                  onChange={(e) => set("imageUrl", e.target.value)}
                />
              </div>
              <div className="field-help">권장 비율 728×90</div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="adCode">
                광고 코드
              </label>
              <textarea
                className="control"
                id="adCode"
                rows={4}
                placeholder="애드센스 등 외부 스크립트 코드를 붙여넣으세요 (직접배너는 비워둠)"
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
              />
              <div className="field-help">애드센스·제휴 위젯 등 스크립트 기반 광고에 사용합니다.</div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="adMemo">
                관리자 메모
              </label>
              <textarea
                className="control"
                id="adMemo"
                rows={2}
                placeholder="내부 참고용 메모 (사용자에게 노출되지 않음)"
                value={form.memo}
                onChange={(e) => set("memo", e.target.value)}
              />
            </div>
          </div>

          <div className="button-showcase" style={{ marginTop: "18px" }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button className="btn btn-outline" onClick={onClose}>
              취소
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────

function AdsPageContent() {
  const [ads, setAds] = useState<AdminAdSlotItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [placementFilter, setPlacementFilter] = useState("");
  const [adTypeFilter, setAdTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<{ role?: string } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editAd, setEditAd] = useState<AdminAdSlotItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAdSlotItem | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);

  const PAGE_SIZE = 20;

  const showToast = (msg: string, undo?: () => void) => {
    setToast({ msg, undo });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSession(d?.user ?? null))
      .catch(() => setSession(null));
  }, []);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (placementFilter) params.set("placement", placementFilter);
      if (adTypeFilter) params.set("adType", adTypeFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ads?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("API 오류");
      const data = await res.json();
      setAds(data.items ?? []);
      setTotalItems(data.meta?.totalItems ?? 0);
    } catch {
      setAds([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, placementFilter, adTypeFilter, statusFilter]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // 통계 집계
  const activeCount = ads.filter((a) => {
    const s = computeStatus(a);
    return s.label === "노출중";
  }).length;
  const totalImpressions = ads.reduce((acc, a) => acc + a.totalImpressions, 0);
  const totalClicks = ads.reduce((acc, a) => acc + a.totalClicks, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  const STATS = [
    { label: "총 노출 수", value: formatNum(totalImpressions), icon: "ri-eye-line", tone: "blue" },
    { label: "총 클릭 수", value: formatNum(totalClicks), icon: "ri-cursor-line", tone: "purple" },
    { label: "평균 CTR", value: formatCtr(avgCtr), icon: "ri-percent-line", tone: "green" },
    { label: "활성 광고 수", value: String(activeCount), icon: "ri-megaphone-line", tone: "orange" },
  ];

  const handleToggle = async (ad: AdminAdSlotItem) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ads/${ad.id}/toggle`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("토글 실패");
      const wasActive = ad.isActive;
      await fetchAds();
      showToast(
        wasActive ? "광고가 비활성화되었습니다." : "광고가 활성화되었습니다.",
        async () => {
          await fetch(`${API_BASE_URL}/api/v1/admin/ads/${ad.id}/toggle`, {
            method: "PATCH",
            credentials: "include",
          });
          fetchAds();
        },
      );
    } catch {
      showToast("토글에 실패했습니다.");
    }
  };

  const handleDelete = async (id: string, note: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ads/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error("삭제 실패");
      setDeleteTarget(null);
      await fetchAds();
      showToast("광고가 삭제되었습니다.");
    } catch {
      showToast("삭제에 실패했습니다.");
    }
  };

  const isSuperAdmin = session?.role === "super_admin";

  return (
    <AdminShell breadcrumb={["관리자", "광고 관리"]} activeKey="ads" adminUser={session as Parameters<typeof AdminShell>[0]["adminUser"]}>
      {/* 토스트 */}
      {toast && (
        <div className="toast-stack" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 9999 }}>
          <div className="toast">
            <span>{toast.msg}</span>
            {toast.undo && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { toast.undo?.(); setToast(null); }}
                style={{ marginLeft: 12 }}
              >
                되돌리기
              </button>
            )}
          </div>
        </div>
      )}

      {!isSuperAdmin ? (
        <div className="alert alert-error">
          <i className="ri-lock-line" />
          최고 관리자(super_admin)만 접근할 수 있습니다.
        </div>
      ) : (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">광고 관리</h1>
              <p className="page-description">노출 위치별 광고 성과를 확인하고 등록·편집합니다.</p>
            </div>
            <div className="page-actions">
              <button
                className="btn btn-primary"
                onClick={() => { setEditAd(null); setDrawerOpen(true); }}
              >
                <i className="ri-add-line" />
                광고 등록
              </button>
            </div>
          </div>

          <section className="grid stats-grid" aria-label="광고 성과 요약">
            {STATS.map((s) => (
              <article className="stat-card" key={s.label}>
                <div className="stat-head">
                  <span className="stat-label">{s.label}</span>
                  <span className={`stat-icon ${s.tone}`}>
                    <i className={s.icon} />
                  </span>
                </div>
                <div className="stat-value">{s.value}</div>
              </article>
            ))}
          </section>

          <div className="alert alert-warning" style={{ marginBottom: "18px" }}>
            <i className="ri-alert-line" />
            <div>
              <strong>가독성·신뢰 우선</strong>
              <br />
              실전자료 다운로드 버튼 근처에 광고를 과도하게 배치하면 사용자 신뢰도를 떨어뜨립니다. 다운로드 영역
              광고는 1개 이하로 유지하세요.
            </div>
          </div>

          <section className="section">
            <div className="section-heading">
              <div>
                <h2 className="section-title">광고 목록</h2>
                <p className="section-description">노출 위치·기기·상태별로 광고를 관리합니다.</p>
              </div>
            </div>

            <article className="card">
              <div className="filter-panel">
                <div className="filter-row">
                  <div className="input-icon">
                    <i className="ri-search-line" />
                    <input
                      className="control"
                      type="search"
                      placeholder="광고명 검색"
                      aria-label="광고명 검색"
                      value={q}
                      onChange={(e) => { setQ(e.target.value); setPage(1); }}
                    />
                  </div>
                  <select
                    className="control"
                    value={placementFilter}
                    onChange={(e) => { setPlacementFilter(e.target.value); setPage(1); }}
                    aria-label="위치 필터"
                    style={{ minWidth: 140 }}
                  >
                    <option value="">위치: 전체</option>
                    {PLACEMENTS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="control"
                    value={adTypeFilter}
                    onChange={(e) => { setAdTypeFilter(e.target.value); setPage(1); }}
                    aria-label="유형 필터"
                    style={{ minWidth: 120 }}
                  >
                    <option value="">유형: 전체</option>
                    {Object.entries(TYPE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <select
                    className="control"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    aria-label="상태 필터"
                    style={{ minWidth: 120 }}
                  >
                    <option value="">상태: 전체</option>
                    <option value="active">노출중</option>
                    <option value="scheduled">예약</option>
                    <option value="inactive">일시중지</option>
                    <option value="expired">종료</option>
                  </select>
                  <div className="filter-actions">
                    <button
                      className="btn btn-outline"
                      onClick={() => { setQ(""); setPlacementFilter(""); setAdTypeFilter(""); setStatusFilter(""); setPage(1); }}
                    >
                      <i className="ri-refresh-line" />
                      초기화
                    </button>
                  </div>
                </div>
              </div>

              <div className="table-toolbar">
                <div className="toolbar-left">
                  <span className="selection-info">
                    총 {loading ? "..." : totalItems}개의 광고
                  </span>
                </div>
                <div className="toolbar-right">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { setEditAd(null); setDrawerOpen(true); }}
                  >
                    <i className="ri-add-line" />
                    광고 등록
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>광고명</th>
                      <th>유형</th>
                      <th>위치</th>
                      <th>PC/모바일</th>
                      <th>시작일</th>
                      <th>종료일</th>
                      <th>상태</th>
                      <th>노출 수</th>
                      <th>클릭 수</th>
                      <th>CTR</th>
                      <th style={{ width: "60px" }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: 24 }}>
                          불러오는 중...
                        </td>
                      </tr>
                    ) : ads.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: 24 }}>
                          등록된 광고가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      ads.map((ad) => {
                        const st = computeStatus(ad);
                        const placementLabel =
                          PLACEMENTS.find((p) => p.value === ad.placement)?.label ?? ad.placement;
                        return (
                          <tr key={ad.id}>
                            <td>
                              <Link className="content-title" href={`/ads/${ad.id}`}>
                                {ad.name}
                              </Link>
                              <div className="content-meta">{placementLabel}</div>
                            </td>
                            <td>
                              <span className={`badge ${TYPE_BADGE[ad.adType] ?? "badge-gray"}`}>
                                {TYPE_LABEL[ad.adType] ?? ad.adType}
                              </span>
                            </td>
                            <td>{placementLabel}</td>
                            <td>{DEVICE_LABEL[ad.device] ?? ad.device}</td>
                            <td className="num">{formatDate(ad.startDate)}</td>
                            <td className="num">{formatDate(ad.endDate)}</td>
                            <td>
                              <span className={`badge ${st.badge}`}>{st.label}</span>
                            </td>
                            <td className="num">{formatNum(ad.totalImpressions)}</td>
                            <td className="num">{formatNum(ad.totalClicks)}</td>
                            <td className="num">{formatCtr(ad.ctr)}</td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="icon-button row-action-button"
                                  aria-label="행 메뉴"
                                >
                                  <i className="ri-more-2-fill" />
                                </button>
                                <div className="action-menu">
                                  <Link href={`/ads/${ad.id}`}>
                                    <i className="ri-bar-chart-line" />
                                    성과 보기
                                  </Link>
                                  <button
                                    onClick={() => { setEditAd(ad); setDrawerOpen(true); }}
                                  >
                                    <i className="ri-edit-line" />
                                    수정
                                  </button>
                                  <button onClick={() => handleToggle(ad)}>
                                    <i className="ri-stop-circle-line" />
                                    {ad.isActive ? "중지" : "활성화"}
                                  </button>
                                  <button
                                    className="danger"
                                    onClick={() => setDeleteTarget(ad)}
                                  >
                                    <i className="ri-delete-bin-line" />
                                    삭제
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="page-info">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalItems)} / 총 {totalItems}개
                </div>
                <div className="page-buttons">
                  <button
                    className="page-button"
                    aria-label="이전 페이지"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <i className="ri-arrow-left-s-line" />
                  </button>
                  <button className="page-button active">{page}</button>
                  <button
                    className="page-button"
                    aria-label="다음 페이지"
                    disabled={page * PAGE_SIZE >= totalItems}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <i className="ri-arrow-right-s-line" />
                  </button>
                </div>
              </div>
            </article>
          </section>
        </>
      )}

      {/* 등록/수정 드로어 */}
      <AdFormDrawer
        open={drawerOpen}
        editAd={editAd}
        onClose={() => setDrawerOpen(false)}
        onSaved={fetchAds}
      />

      {/* 삭제 모달 */}
      {deleteTarget && (
        <DeleteModal
          ad={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </AdminShell>
  );
}

export default function AdminAdsPage() {
  return <AdsPageContent />;
}
