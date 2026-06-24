"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../../lib/api";
import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";
import type { AdminAdSlotItem, AdminAdStatsDay } from "@ai-jakdang/contracts";

/**
 * 광고 상세·성과 페이지 (Story 9.16).
 * GET /api/v1/admin/ads/:id + GET /api/v1/admin/ads/:id/stats 연동.
 * 성과 차트: createLineChart (노출/클릭 2개 시리즈) + 수치 테이블(UX-DR-A11).
 * 수정 버튼 → 인라인 편집 드로어 재사용.
 */

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

function computeStatus(ad: AdminAdSlotItem): { label: string; badge: string } {
  if (!ad.isActive) return { label: "일시중지", badge: "badge-orange" };
  const today = new Date().toISOString().slice(0, 10);
  if (ad.startDate && ad.startDate > today) return { label: "예약", badge: "badge-cyan" };
  if (ad.endDate && ad.endDate < today) return { label: "종료", badge: "badge-gray" };
  return { label: "노출중", badge: "badge-green" };
}

// ── 성과 차트 컴포넌트 ─────────────────────────────────────────────────────────

function AdStatsChart({ items }: { items: AdminAdStatsDay[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || items.length === 0) return;

    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary-600").trim() || "#2563eb";
    const accent = css.getPropertyValue("--brand-accent").trim() || "#06b6d4";

    const chart = createLineChart(canvasRef.current, {
      labels: items.map((d) => d.date.slice(5)), // MM-DD
      series: [
        {
          values: items.map((d) => d.impressions),
          color: primary,
          fill: "rgba(37,99,235,0.18)",
        },
        {
          values: items.map((d) => d.clicks),
          color: accent,
          fill: "rgba(6,182,212,0.13)",
        },
      ],
    });

    return () => {
      chart.destroy();
    };
  }, [items]);

  return (
    <div>
      <div className="chart-wrap">
        <canvas ref={canvasRef} aria-label="광고 노출·클릭 추이 선 그래프" role="img" />
      </div>
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "var(--primary-600)" }} />
          노출 수
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "var(--brand-accent)" }} />
          클릭 수
        </span>
      </div>
    </div>
  );
}

// ── 수정 드로어 ────────────────────────────────────────────────────────────────

interface EditFormData {
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

function EditDrawer({
  open,
  ad,
  onClose,
  onSaved,
}: {
  open: boolean;
  ad: AdminAdSlotItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditFormData>({
    name: ad.name,
    adType: ad.adType,
    placement: ad.placement,
    device: ad.device,
    startDate: ad.startDate ?? "",
    endDate: ad.endDate ?? "",
    isActive: ad.isActive,
    clickUrl: ad.clickUrl ?? "",
    imageUrl: ad.imageUrl ?? "",
    code: ad.code ?? "",
    memo: ad.memo ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        name: ad.name,
        adType: ad.adType,
        placement: ad.placement,
        device: ad.device,
        startDate: ad.startDate ?? "",
        endDate: ad.endDate ?? "",
        isActive: ad.isActive,
        clickUrl: ad.clickUrl ?? "",
        imageUrl: ad.imageUrl ?? "",
        code: ad.code ?? "",
        memo: ad.memo ?? "",
      });
      setError(null);
    }
  }, [open, ad]);

  const set = (k: keyof EditFormData, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("광고명을 입력해주세요."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ads/${ad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
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
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message ?? "수정에 실패했습니다.");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer open" aria-label="광고 수정 패널">
        <div className="drawer-header">
          <div>
            <div className="modal-title">광고 수정</div>
            <div className="card-subtitle">광고 정보를 수정합니다.</div>
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
              <label className="field-label" htmlFor="editAdName">광고명</label>
              <input className="control" id="editAdName" type="text" value={form.name}
                onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="editAdType">광고 유형</label>
                <select className="control" id="editAdType" value={form.adType}
                  onChange={(e) => set("adType", e.target.value)}>
                  {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="editAdPlacement">노출 위치</label>
                <select className="control" id="editAdPlacement" value={form.placement}
                  onChange={(e) => set("placement", e.target.value)}>
                  {PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <span className="field-label">PC / 모바일 구분</span>
              <div className="choice-row">
                {(["all", "pc", "mobile"] as const).map((d) => (
                  <label className="choice" key={d}>
                    <input type="radio" name="editAdDevice" checked={form.device === d}
                      onChange={() => set("device", d)} />
                    {DEVICE_LABEL[d]}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="editAdStart">노출 시작일</label>
                <input className="control" id="editAdStart" type="date" value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="editAdEnd">노출 종료일</label>
                <input className="control" id="editAdEnd" type="date" value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)} />
              </div>
            </div>
            <div className="field">
              <span className="field-label">노출 상태</span>
              <div className="choice-row">
                <label className="switch">
                  <input type="checkbox" checked={form.isActive}
                    onChange={(e) => set("isActive", e.target.checked)} />
                  <span className="switch-track" />
                </label>
                <span style={{ color: "var(--gray-500)" }}>활성</span>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="editAdUrl">클릭 URL</label>
              <input className="control" id="editAdUrl" type="url" value={form.clickUrl}
                onChange={(e) => set("clickUrl", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="editAdImageUrl">배너 이미지 URL</label>
              <input className="control" id="editAdImageUrl" type="url" value={form.imageUrl}
                onChange={(e) => set("imageUrl", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="editAdCode">광고 코드</label>
              <textarea className="control" id="editAdCode" rows={4} value={form.code}
                onChange={(e) => set("code", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="editAdMemo">관리자 메모</label>
              <textarea className="control" id="editAdMemo" rows={2} value={form.memo}
                onChange={(e) => set("memo", e.target.value)} />
            </div>
          </div>
          <div className="button-showcase" style={{ marginTop: "18px" }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button className="btn btn-outline" onClick={onClose}>취소</button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────

export default function AdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [adId, setAdId] = useState<string | null>(null);
  const [ad, setAd] = useState<AdminAdSlotItem | null>(null);
  const [stats, setStats] = useState<AdminAdStatsDay[]>([]);
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // resolve params
  useEffect(() => {
    params.then((p) => setAdId(p.id));
  }, [params]);

  const fetchAd = useCallback(async () => {
    if (!adId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ads/${adId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAd(data);
    } catch {
      setAd(null);
    } finally {
      setLoading(false);
    }
  }, [adId]);

  const fetchStats = useCallback(async () => {
    if (!adId) return;
    try {
      const p = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ads/${adId}/stats?${p.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.items ?? []);
    } catch {
      setStats([]);
    }
  }, [adId, dateFrom, dateTo]);

  useEffect(() => { fetchAd(); }, [fetchAd]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggle = async () => {
    if (!ad) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ads/${ad.id}/toggle`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      await fetchAd();
      showToast(ad.isActive ? "비활성화되었습니다." : "활성화되었습니다.");
    } catch {
      showToast("변경에 실패했습니다.");
    }
  };

  const PERIOD_OPTIONS = [
    { label: "7일", days: 7 },
    { label: "30일", days: 30 },
    { label: "90일", days: 90 },
  ];

  const setPeriod = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    setDateFrom(d.toISOString().slice(0, 10));
  };

  const summaryImpressions = stats.reduce((a, s) => a + s.impressions, 0);
  const summaryClicks = stats.reduce((a, s) => a + s.clicks, 0);
  const summaryCtr = summaryImpressions > 0 ? summaryClicks / summaryImpressions : 0;

  const placementLabel = ad
    ? (PLACEMENTS.find((p) => p.value === ad.placement)?.label ?? ad.placement)
    : "";

  return (
    <AdminShell breadcrumb={["관리자", "광고 관리", "광고 상세"]} activeKey="ads">
      {toast && (
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 9999, background: "var(--gray-900)", color: "#fff", padding: "12px 24px", borderRadius: 8 }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">광고 상세</h1>
          <p className="page-description">
            {ad ? `${ad.name} · 노출 위치·기간과 성과를 확인합니다.` : "광고 상세 정보"}
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/ads">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
          {ad && (
            <>
              <button className="btn btn-outline" onClick={() => setDrawerOpen(true)}>
                <i className="ri-edit-line" />
                수정
              </button>
              <button
                className={`btn ${ad.isActive ? "btn-outline" : "btn-primary"}`}
                onClick={handleToggle}
              >
                <i className={ad.isActive ? "ri-pause-circle-line" : "ri-play-circle-line"} />
                {ad.isActive ? "일시중지" : "활성화"}
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center" }}>불러오는 중...</div>
      ) : !ad ? (
        <div className="alert alert-error">
          <i className="ri-error-warning-line" />
          광고를 찾을 수 없습니다.
        </div>
      ) : (
        <>
          {/* 성과 요약 카드 */}
          <section className="grid stats-grid" aria-label="광고 성과 요약">
            {[
              { label: "총 노출 수", value: formatNum(ad.totalImpressions), icon: "ri-eye-line", tone: "blue" },
              { label: "총 클릭 수", value: formatNum(ad.totalClicks), icon: "ri-cursor-line", tone: "purple" },
              { label: "전체 CTR", value: formatCtr(ad.ctr), icon: "ri-percent-line", tone: "green" },
              { label: "노출 상태", value: computeStatus(ad).label, icon: "ri-megaphone-line", tone: "orange" },
            ].map((p) => (
              <article className="stat-card" key={p.label}>
                <div className="stat-head">
                  <span className="stat-label">{p.label}</span>
                  <span className={`stat-icon ${p.tone}`}>
                    <i className={p.icon} />
                  </span>
                </div>
                <div className="stat-value">{p.value}</div>
              </article>
            ))}
          </section>

          {/* 소재 미리보기 + 기본 정보 */}
          <section className="section">
            <div className="grid component-grid">
              <article className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">소재 미리보기</h2>
                    <div className="card-subtitle">실제 노출되는 배너입니다.</div>
                  </div>
                  <span className={`badge ${TYPE_BADGE[ad.adType] ?? "badge-gray"}`}>
                    {TYPE_LABEL[ad.adType] ?? ad.adType}
                  </span>
                </div>
                <div className="card-body">
                  {ad.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ad.imageUrl}
                      alt={ad.name}
                      style={{ maxWidth: "100%", borderRadius: 4 }}
                    />
                  ) : ad.code ? (
                    <div className="empty-state" style={{ padding: "28px" }}>
                      <span className="empty-icon"><i className="ri-code-line" /></span>
                      <div className="empty-title">코드 광고</div>
                      <div className="empty-desc">HTML/스크립트 기반 광고입니다.</div>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: "28px" }}>
                      <span className="empty-icon"><i className="ri-image-line" /></span>
                      <div className="empty-title">소재 없음</div>
                    </div>
                  )}
                  <div className="button-showcase" style={{ marginTop: "14px" }}>
                    {ad.clickUrl && (
                      <a
                        href={ad.clickUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                      >
                        <i className="ri-external-link-line" />
                        클릭 URL 열기
                      </a>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => setDrawerOpen(true)}>
                      <i className="ri-edit-line" />
                      소재 편집
                    </button>
                  </div>
                </div>
              </article>

              <article className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">노출 설정</h2>
                    <div className="card-subtitle">위치·기간·대상 기기입니다.</div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="detail-list">
                    <div className="detail-row">
                      <div className="detail-label">광고 유형</div>
                      <div className="detail-value">
                        <span className={`badge ${TYPE_BADGE[ad.adType] ?? "badge-gray"}`}>
                          {TYPE_LABEL[ad.adType] ?? ad.adType}
                        </span>
                      </div>
                    </div>
                    <div className="detail-row">
                      <div className="detail-label">노출 위치</div>
                      <div className="detail-value">{placementLabel}</div>
                    </div>
                    <div className="detail-row">
                      <div className="detail-label">대상 기기</div>
                      <div className="detail-value">{DEVICE_LABEL[ad.device] ?? ad.device}</div>
                    </div>
                    <div className="detail-row">
                      <div className="detail-label">노출 기간</div>
                      <div className="detail-value">
                        {formatDate(ad.startDate)} ~ {formatDate(ad.endDate)}
                      </div>
                    </div>
                    {ad.clickUrl && (
                      <div className="detail-row">
                        <div className="detail-label">클릭 URL</div>
                        <div className="detail-value" style={{ wordBreak: "break-all" }}>
                          {ad.clickUrl}
                        </div>
                      </div>
                    )}
                    <div className="detail-row">
                      <div className="detail-label">노출 상태</div>
                      <div className="detail-value">
                        <span className={`badge ${computeStatus(ad).badge}`}>
                          {computeStatus(ad).label}
                        </span>
                      </div>
                    </div>
                    {ad.memo && (
                      <div className="detail-row">
                        <div className="detail-label">메모</div>
                        <div className="detail-value">{ad.memo}</div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            </div>
          </section>

          {/* 일자별 성과 차트 + 테이블 */}
          <section className="section">
            <div className="section-heading">
              <div>
                <h2 className="section-title">기간별 성과</h2>
                <p className="section-description">노출·클릭·CTR 추이입니다. (UX-DR-A11: 차트 + 수치 테이블 제공)</p>
              </div>
              <div className="segmented" role="group" aria-label="조회 기간">
                {PERIOD_OPTIONS.map((o) => (
                  <button
                    key={o.days}
                    className="segment"
                    onClick={() => setPeriod(o.days)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <article className="card">
              <div className="card-body">
                {/* 기간 집계 카드 */}
                <div className="grid stats-grid" style={{ marginBottom: 20 }} aria-label="기간 성과 요약">
                  {[
                    { label: "기간 노출", value: formatNum(summaryImpressions) },
                    { label: "기간 클릭", value: formatNum(summaryClicks) },
                    { label: "기간 CTR", value: formatCtr(summaryCtr) },
                  ].map((s) => (
                    <article className="stat-card" key={s.label} style={{ padding: "12px 16px" }}>
                      <div className="stat-label">{s.label}</div>
                      <div className="stat-value" style={{ fontSize: "1.25rem" }}>{s.value}</div>
                    </article>
                  ))}
                </div>

                {/* 차트 */}
                {stats.length > 0 ? (
                  <AdStatsChart items={stats} />
                ) : (
                  <div className="empty-state" style={{ padding: 32 }}>
                    <div className="empty-title">성과 데이터가 없습니다.</div>
                    <div className="empty-desc">선택한 기간에 데이터가 없습니다.</div>
                  </div>
                )}
              </div>
            </article>

            {/* 수치 테이블 (UX-DR-A11) */}
            <article className="card" style={{ marginTop: 16 }}>
              <div className="table-wrap">
                <table className="admin-table" aria-label="일자별 노출·클릭·CTR 수치 데이터">
                  <thead>
                    <tr>
                      <th>일자</th>
                      <th>노출 수</th>
                      <th>클릭 수</th>
                      <th>CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: 24 }}>
                          데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      stats.map((d) => (
                        <tr key={d.date}>
                          <td className="num">{d.date}</td>
                          <td className="num">{formatNum(d.impressions)}</td>
                          <td className="num">{formatNum(d.clicks)}</td>
                          <td className="num">{formatCtr(d.ctr)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </>
      )}

      {/* 수정 드로어 */}
      {ad && (
        <EditDrawer
          open={drawerOpen}
          ad={ad}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => { fetchAd(); fetchStats(); }}
        />
      )}
    </AdminShell>
  );
}
