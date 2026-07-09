"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../../lib/api";
import { BotActivitySection } from "./_components/BotActivitySection";
import { BotTopicsSection } from "./_components/BotTopicsSection";
import { BotModelSection } from "./_components/BotModelSection";
import { BotProfileSection } from "./_components/BotProfileSection";

/**
 * 봇 상세·캐릭터 시트 편집 페이지 (Story 11.14 기반 + 11.15 탭 확장).
 *
 * 탭 구조:
 *  - 캐릭터·프롬프트 (11.14)
 *  - 활동 설정      (11.15 — BotActivitySection)
 *  - 주제 풀        (11.15 — BotTopicsSection)
 *  - 모델 할당      (11.15 — BotModelSection)
 */

// ── 로컬 타입 ─────────────────────────────────────────────────────────────────

interface AdminBotDetail {
  id: string;
  userId: string | null;
  nickname: string;
  hiddenIdentity: string | null;
  ageJob: string | null;
  tone: string | null;
  personaPrompt: string | null;
  infoRatio: number;
  intentionalFlaws: string | null;
  isAdminPersona: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  postCount: number;
  commentCount: number;
}

interface CharacterForm {
  nickname: string;
  hiddenIdentity: string;
  ageJob: string;
  tone: string;
  personaPrompt: string;
  infoRatio: number;
  intentionalFlaws: string;
}

type ActiveTab = "character" | "profile" | "activity" | "topics" | "models";

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function formatDatetime(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

// ── 토스트 (화면 중앙 — 메모리 규칙) ────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff",
        borderRadius: 8,
        padding: "12px 20px",
        fontSize: 14,
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 240,
      }}
    >
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }}
        aria-label="닫기"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function BotDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [bot, setBot] = useState<AdminBotDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("character");

  const [form, setForm] = useState<CharacterForm>({
    nickname: "",
    hiddenIdentity: "",
    ageJob: "",
    tone: "",
    personaPrompt: "",
    infoRatio: 50,
    intentionalFlaws: "",
  });

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchBot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${id}`, {
        credentials: "include",
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("조회 실패");
      const data: AdminBotDetail = await res.json();
      setBot(data);
      setForm({
        nickname: data.nickname ?? "",
        hiddenIdentity: data.hiddenIdentity ?? "",
        ageJob: data.ageJob ?? "",
        tone: data.tone ?? "",
        personaPrompt: data.personaPrompt ?? "",
        infoRatio: data.infoRatio ?? 50,
        intentionalFlaws: data.intentionalFlaws ?? "",
      });
    } catch {
      showToast("봇 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchBot();
  }, [fetchBot]);

  async function handleSave() {
    if (!bot) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname || undefined,
          hiddenIdentity: form.hiddenIdentity || undefined,
          ageJob: form.ageJob || undefined,
          tone: form.tone || undefined,
          personaPrompt: form.personaPrompt || undefined,
          infoRatio: form.infoRatio,
          intentionalFlaws: form.intentionalFlaws || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "저장 실패");
      }
      const updated: AdminBotDetail = await res.json();
      setBot(updated);
      showToast("캐릭터 시트가 저장되었습니다.", "success");
    } catch (e) {
      showToast(`저장 중 오류가 발생했습니다: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── 로딩 상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AdminShell breadcrumb={["관리자", "활동 봇", "상세"]} activeKey="bots">
        <div style={{ padding: 60, textAlign: "center", color: "var(--gray-400)" }}>
          불러오는 중...
        </div>
      </AdminShell>
    );
  }

  // ── 404 상태 ──────────────────────────────────────────────────────────────
  if (notFound || !bot) {
    return (
      <AdminShell breadcrumb={["관리자", "활동 봇", "없음"]} activeKey="bots">
        <div style={{ padding: 60, textAlign: "center", color: "var(--gray-400)" }}>
          존재하지 않는 봇입니다.
          <br />
          <Link className="btn btn-outline" href="/bots" style={{ marginTop: 16, display: "inline-flex" }}>
            <i className="ri-arrow-left-line" />목록으로
          </Link>
        </div>
      </AdminShell>
    );
  }

  // ── 본 페이지 ─────────────────────────────────────────────────────────────
  return (
    <AdminShell breadcrumb={["관리자", "활동 봇", bot.nickname]} activeKey="bots">
      <div className="page-header">
        <div>
          <h1 className="page-title">봇 상세 · 캐릭터 편집</h1>
          <p className="page-description">
            봇 페르소나의 캐릭터 시트와 사전 프롬프트를 편집합니다. 저장 즉시 다음 생성 잡부터 반영됩니다.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/bots">
            <i className="ri-arrow-left-line" />목록으로
          </Link>
        </div>
      </div>

      {/* 상단 요약 카드 */}
      <section className="section">
        <article className="card">
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <i className="ri-robot-line" style={{ fontSize: 24, opacity: 0.7 }} />
                  <span style={{ fontSize: 22, fontWeight: 700 }}>{bot.nickname}</span>
                  <span className={`badge ${bot.isActive ? "badge-green" : "badge-orange"}`}>
                    {bot.isActive ? "활성" : "비활성"}
                  </span>
                  {bot.isAdminPersona && (
                    <span className="badge badge-purple">관리자봇</span>
                  )}
                </div>
                <div className="content-meta" style={{ fontSize: 13 }}>
                  <span>
                    <i className="ri-article-line" style={{ marginRight: 4 }} />
                    글 {bot.postCount.toLocaleString()}
                  </span>
                  <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                  <span>
                    <i className="ri-chat-3-line" style={{ marginRight: 4 }} />
                    댓글 {bot.commentCount.toLocaleString()}
                  </span>
                  <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                  <span>최근 활동 {formatDatetime(bot.lastActiveAt)}</span>
                  <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                  <span>생성 {formatDate(bot.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* ── 탭 내비게이션 ────────────────────────────────────────────────── */}
      <div className="line-tabs" role="tablist" style={{ marginBottom: 0 }}>
        <button
          role="tab"
          aria-selected={activeTab === "character"}
          className={`line-tab ${activeTab === "character" ? "active" : ""}`}
          onClick={() => setActiveTab("character")}
        >
          캐릭터·프롬프트
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "profile"}
          className={`line-tab ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          프로필 연출
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "activity"}
          className={`line-tab ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          활동 설정
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "topics"}
          className={`line-tab ${activeTab === "topics" ? "active" : ""}`}
          onClick={() => setActiveTab("topics")}
        >
          주제 풀
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "models"}
          className={`line-tab ${activeTab === "models" ? "active" : ""}`}
          onClick={() => setActiveTab("models")}
        >
          모델 할당
        </button>
      </div>

      {/* ── 탭 패널: 캐릭터·프롬프트 ─────────────────────────────────────── */}
      <div style={{ display: activeTab === "character" ? undefined : "none" }}>
        <section className="section">
          <div className="section-heading">
            <div>
              <h2 className="section-title">캐릭터 시트 편집</h2>
              <p className="section-description">
                변경 사항은 "저장" 버튼을 누를 때 DB에 즉시 반영됩니다. 캐시 없음 — 다음 생성 잡부터 적용.
              </p>
            </div>
            <div>
              <button
                className="btn btn-primary"
                type="button"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? (
                  <>
                    <i className="ri-loader-4-line" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line" />
                    저장
                  </>
                )}
              </button>
            </div>
          </div>

          <article className="card">
            <div className="card-body">
              <div className="component-stack">

                {/* 닉네임 */}
                <div className="field">
                  <label className="field-label" htmlFor="bot-nickname">
                    닉네임 <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    id="bot-nickname"
                    type="text"
                    className="control"
                    value={form.nickname}
                    onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
                    placeholder="예: dubu_2"
                  />
                </div>

                {/* 숨은 정체성 */}
                <div className="field">
                  <label className="field-label" htmlFor="bot-hidden-identity">
                    숨은 정체성
                    <span style={{ marginLeft: 6, fontSize: 11, color: "var(--gray-500)" }}>(내부 전용, 외부 미노출)</span>
                  </label>
                  <textarea
                    id="bot-hidden-identity"
                    className="control"
                    rows={3}
                    value={form.hiddenIdentity}
                    onChange={(e) => setForm((prev) => ({ ...prev, hiddenIdentity: e.target.value }))}
                    placeholder="예: 30대 직장인, 코딩에 입문한 지 6개월 된 비전공자"
                  />
                </div>

                {/* 나이대·직업 */}
                <div className="field">
                  <label className="field-label" htmlFor="bot-age-job">나이대·직업</label>
                  <input
                    id="bot-age-job"
                    type="text"
                    className="control"
                    value={form.ageJob}
                    onChange={(e) => setForm((prev) => ({ ...prev, ageJob: e.target.value }))}
                    placeholder="예: 30대 초반, 마케터"
                  />
                </div>

                {/* 말투·입버릇 */}
                <div className="field">
                  <label className="field-label" htmlFor="bot-tone">말투·입버릇</label>
                  <textarea
                    id="bot-tone"
                    className="control"
                    rows={3}
                    value={form.tone}
                    onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
                    placeholder="예: 친근하고 구어체 위주. 가끔 이모티콘 사용. ㅋㅋ 같은 구어체 허용."
                  />
                </div>

                {/* 사전 프롬프트 — 핵심 편집 대상 */}
                <div className="field">
                  <label className="field-label" htmlFor="bot-persona-prompt">
                    사전 프롬프트
                    <span style={{ marginLeft: 6, fontSize: 11, color: "var(--gray-500)" }}>(시스템 컨텍스트 — 생성 AI에 전달)</span>
                  </label>
                  <textarea
                    id="bot-persona-prompt"
                    className="control"
                    rows={12}
                    value={form.personaPrompt}
                    onChange={(e) => setForm((prev) => ({ ...prev, personaPrompt: e.target.value }))}
                    placeholder={`당신은 AI작당 커뮤니티의 일반 회원입니다.\n...\n(봇에게 전달할 역할·규칙·제약을 자세히 작성하세요)`}
                    style={{ fontFamily: "monospace", fontSize: 13 }}
                  />
                </div>

                {/* 정보 비율 */}
                <div className="field">
                  <label className="field-label" htmlFor="bot-info-ratio">
                    정보 비율 (info_ratio)
                    <span style={{ marginLeft: 6, fontSize: 11, color: "var(--gray-500)" }}>
                      0 = 잡담형 / 100 = 정보형 (현재: {form.infoRatio})
                    </span>
                  </label>
                  <input
                    id="bot-info-ratio"
                    type="number"
                    min={0}
                    max={100}
                    className="control"
                    value={form.infoRatio}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        infoRatio: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                      }))
                    }
                    style={{ maxWidth: 160 }}
                  />
                </div>

                {/* 의도적 약점·버릇 */}
                <div className="field">
                  <label className="field-label" htmlFor="bot-intentional-flaws">의도적 약점·버릇</label>
                  <textarea
                    id="bot-intentional-flaws"
                    className="control"
                    rows={3}
                    value={form.intentionalFlaws}
                    onChange={(e) => setForm((prev) => ({ ...prev, intentionalFlaws: e.target.value }))}
                    placeholder="예: 가끔 오타를 낸다. 질문형 문장을 자주 쓴다."
                  />
                </div>

              </div>

              {/* 하단 저장 버튼 */}
              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <Link className="btn btn-outline" href="/bots">
                  <i className="ri-arrow-left-line" />목록으로
                </Link>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? (
                    <>
                      <i className="ri-loader-4-line" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <i className="ri-save-line" />
                      저장
                    </>
                  )}
                </button>
              </div>
            </div>
          </article>
        </section>
      </div>

      {/* ── 탭 패널: 프로필 연출 ─────────────────────────────────────────── */}
      <div style={{ display: activeTab === "profile" ? undefined : "none" }}>
        <BotProfileSection botId={id} showToast={showToast} />
      </div>

      {/* ── 탭 패널: 활동 설정 ───────────────────────────────────────────── */}
      <div style={{ display: activeTab === "activity" ? undefined : "none" }}>
        <BotActivitySection botId={id} showToast={showToast} />
      </div>

      {/* ── 탭 패널: 주제 풀 ─────────────────────────────────────────────── */}
      <div style={{ display: activeTab === "topics" ? undefined : "none" }}>
        <BotTopicsSection botId={id} showToast={showToast} />
      </div>

      {/* ── 탭 패널: 모델 할당 ───────────────────────────────────────────── */}
      <div style={{ display: activeTab === "models" ? undefined : "none" }}>
        <BotModelSection botId={id} showToast={showToast} />
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}
