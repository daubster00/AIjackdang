"use client";

/**
 * 모델 할당 탭 (Story 11.15 — Task 8).
 *
 * - generation·censor 두 행 기본 표시
 * - image 행 선택적 추가
 * - provider(커스텀 드롭다운), model(텍스트), is_active(토글), note(텍스트)
 * - 저장 → PUT /model-assignments 일괄 upsert
 */

import { useState, useEffect, useCallback } from "react";
import { Select, type SelectOption } from "@/components/ui/Select";
import { API_BASE_URL } from "@/lib/api";

// ── 타입 ─────────────────────────────────────────────────────────────────────

type BotPurpose = "generation" | "censor" | "image";

interface ModelRow {
  provider: string;
  model: string;
  isActive: boolean;
  note: string;
}

type ModelRowsMap = Record<BotPurpose, ModelRow>;

export interface BotModelSectionProps {
  botId: string;
  showToast: (message: string, type: "success" | "error") => void;
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Claude (Anthropic)" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Gemini (Google)" },
];

// ── 프로바이더별 선택 가능한 모델 목록 ─────────────────────────────────────────
// 글 생성·검열(텍스트) 모델. 라인업 변경 시 이 맵만 갱신
// (비용 추정 맵 packages/server-bot/src/ai/pricing.ts 와 정합 유지).
const TEXT_MODELS: Record<string, SelectOption[]> = {
  anthropic: [
    { value: "claude-fable-5", label: "Claude Fable 5 (최상위·최고 성능)" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8 (최신 Opus·최고 품질)" },
    { value: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (최신·균형)" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (저비용·빠름)" },
    { value: "claude-opus-4-5", label: "Claude Opus 4.5 (구형)" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (구형)" },
  ],
  openai: [
    { value: "gpt-5.5", label: "GPT-5.5 (최신 플래그십)" },
    { value: "gpt-5.5-pro", label: "GPT-5.5 Pro (최고 성능·고비용)" },
    { value: "gpt-5.4", label: "GPT-5.4 (균형)" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 mini (저비용)" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 nano (최저비용)" },
    { value: "gpt-4.1", label: "GPT-4.1 (구형)" },
    { value: "gpt-4o", label: "GPT-4o (구형)" },
    { value: "gpt-4o-mini", label: "GPT-4o mini (구형·저비용)" },
  ],
  google: [
    { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash (최신·최고지능 Flash)" },
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (고품질·프리뷰)" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (최저비용)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (구형·고품질)" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (구형·균형)" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (구형·저비용)" },
  ],
};

// 이미지 생성 모델 (image 용도 전용).
// 기본값은 구글 gemini-3.1-flash-image (API 키만 있으면 되고 조직 인증 불필요).
// OpenAI gpt-image 계열은 조직 인증(Verify Organization)이 필요할 수 있음.
const IMAGE_MODELS: Record<string, SelectOption[]> = {
  google: [
    {
      value: "gemini-3.1-flash-image",
      label: "Gemini 3.1 Flash Image (Nano Banana 2·기본값·속도/비용/품질 균형·조직 인증 불필요·일반 본문 삽화 권장)",
    },
    {
      value: "gemini-3-pro-image",
      label: "Gemini 3 Pro Image (Nano Banana Pro·최고 품질·4K·글자/도표 렌더 정확·느리고 고비용·조직 인증 불필요)",
    },
    {
      value: "gemini-3.1-flash-lite-image",
      label: "Gemini 3.1 Flash-Lite Image (Nano Banana Lite·최저 비용·초저지연·품질은 낮음·대량 생성용)",
    },
  ],
  openai: [
    {
      value: "gpt-image-2",
      label: "GPT Image 2 (최신·고품질·복잡한 지시 이해 우수·느림·고비용·조직 인증(여권) 필요)",
    },
    {
      value: "gpt-image-1.5",
      label: "GPT Image 1.5 (중상 품질·균형·조직 인증 필요)",
    },
    {
      value: "gpt-image-1-mini",
      label: "GPT Image 1 mini (저비용·빠름·품질 보통·조직 인증 필요)",
    },
    {
      value: "gpt-image-1",
      label: "GPT Image 1 (구형·조직 인증 필요)",
    },
    {
      value: "dall-e-3",
      label: "DALL·E 3 (예술적·회화풍 스타일·저렴·조직 인증 불필요)",
    },
  ],
  anthropic: [], // Anthropic 은 이미지 생성 미지원
};

/**
 * 용도(purpose)·프로바이더 조합에 대한 선택 가능 모델 목록.
 * 저장돼 있던 값(currentValue)이 목록에 없으면(수동 입력·구모델) 맨 앞에 보존해 표시가 깨지지 않게 한다.
 */
function modelOptionsFor(purpose: BotPurpose, provider: string, currentValue: string): SelectOption[] {
  const base = (purpose === "image" ? IMAGE_MODELS : TEXT_MODELS)[provider] ?? [];
  if (currentValue && !base.some((o) => o.value === currentValue)) {
    return [{ value: currentValue, label: `${currentValue} (저장된 값)` }, ...base];
  }
  return base;
}

const DEFAULT_ROW: ModelRow = {
  provider: "anthropic",
  model: "",
  isActive: true,
  note: "",
};

const PURPOSE_LABELS: Record<BotPurpose, string> = {
  generation: "글 생성용 (generation)",
  censor: "검열관용 (censor)",
  image: "이미지 생성용 (image)",
};

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function BotModelSection({ botId, showToast }: BotModelSectionProps) {
  const [rows, setRows] = useState<ModelRowsMap>({
    generation: { ...DEFAULT_ROW },
    censor: { ...DEFAULT_ROW, isActive: true },
    image: { ...DEFAULT_ROW, provider: "google", model: "gemini-3.1-flash-image", isActive: false },
  });
  const [showImage, setShowImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/model-assignments`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("모델 할당 조회 실패");
      const data = await res.json();
      const items: Array<{
        purpose: BotPurpose;
        provider: string;
        model: string;
        isActive: boolean;
        note: string | null;
      }> = data.items ?? [];

      const next: ModelRowsMap = {
        generation: { ...DEFAULT_ROW },
        censor: { ...DEFAULT_ROW },
        image: { ...DEFAULT_ROW, provider: "google", model: "gemini-3.1-flash-image", isActive: false },
      };
      let hasImage = false;

      for (const item of items) {
        if (item.purpose === "generation" || item.purpose === "censor" || item.purpose === "image") {
          next[item.purpose] = {
            provider: item.provider,
            model: item.model,
            isActive: item.isActive,
            note: item.note ?? "",
          };
          if (item.purpose === "image") hasImage = true;
        }
      }

      setRows(next);
      setShowImage(hasImage);
    } catch {
      showToast("모델 할당 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [botId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function updateRow(purpose: BotPurpose, field: keyof ModelRow, value: string | boolean) {
    setRows((prev) => ({
      ...prev,
      [purpose]: { ...prev[purpose], [field]: value },
    }));
  }

  // 프로바이더 변경 시, 새 프로바이더에서 유효하지 않은 모델이면 선택을 비운다(재선택 유도).
  function handleProviderChange(purpose: BotPurpose, provider: string) {
    setRows((prev) => {
      const current = prev[purpose].model;
      const valid = (purpose === "image" ? IMAGE_MODELS : TEXT_MODELS)[provider] ?? [];
      const nextModel = valid.some((o) => o.value === current) ? current : "";
      return { ...prev, [purpose]: { ...prev[purpose], provider, model: nextModel } };
    });
  }

  async function handleSave() {
    // 활성화된 행만 포함 (model 이 비어 있으면 제외)
    const purposes: BotPurpose[] = ["generation", "censor", ...(showImage ? (["image"] as BotPurpose[]) : [])];
    const assignments = purposes
      .filter((p) => rows[p].model.trim() !== "")
      .map((purpose) => ({
        personaId: botId, // 서버가 URL param 으로 덮어쓰지만 스키마 요구사항 충족
        provider: rows[purpose].provider,
        model: rows[purpose].model.trim(),
        purpose,
        isActive: rows[purpose].isActive,
        note: rows[purpose].note.trim() || undefined,
      }));

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/model-assignments`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignments),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "저장 실패");
      }
      showToast("모델 할당이 저장되었습니다.", "success");
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--gray-400)" }}>
        불러오는 중...
      </div>
    );
  }

  const purposes: BotPurpose[] = ["generation", "censor", ...(showImage ? (["image"] as BotPurpose[]) : [])];

  return (
    <div className="component-stack">
      <section className="section">
        <div className="section-heading">
          <h2 className="section-title">모델 할당</h2>
          <p className="section-description">
            각 용도별 AI 모델을 지정합니다. model 명이 비어있는 행은 저장에서 제외됩니다.
          </p>
        </div>

        {purposes.map((purpose) => (
          <article className="card" key={purpose} style={{ marginBottom: 16 }}>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {PURPOSE_LABELS[purpose]}
                </h3>
                {/* is_active 토글 */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                  <span style={{ fontSize: 13, color: "var(--gray-600)" }}>활성화</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rows[purpose].isActive}
                    className={`btn btn-sm ${rows[purpose].isActive ? "btn-primary" : "btn-outline"}`}
                    onClick={() => updateRow(purpose, "isActive", !rows[purpose].isActive)}
                    style={{ minWidth: 54 }}
                  >
                    {rows[purpose].isActive ? "ON" : "OFF"}
                  </button>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
                {/* 프로바이더 */}
                <Select
                  label="프로바이더 (provider)"
                  options={PROVIDER_OPTIONS}
                  value={rows[purpose].provider}
                  onChange={(v) => handleProviderChange(purpose, v)}
                />
                {/* 모델명 — 선택박스 */}
                <Select
                  label="모델명 (model)"
                  placeholder={
                    (purpose === "image" ? IMAGE_MODELS : TEXT_MODELS)[rows[purpose].provider]?.length
                      ? "모델을 선택하세요"
                      : "선택 가능한 모델 없음"
                  }
                  options={modelOptionsFor(purpose, rows[purpose].provider, rows[purpose].model)}
                  value={rows[purpose].model}
                  onChange={(v) => updateRow(purpose, "model", v)}
                />
              </div>

              {/* 비고 */}
              <div className="field">
                <label className="field-label">비고 (note, 선택)</label>
                <input
                  type="text"
                  className="control"
                  value={rows[purpose].note}
                  onChange={(e) => updateRow(purpose, "note", e.target.value)}
                  placeholder="예: 고품질 글 생성용, 저비용 대안"
                />
              </div>
            </div>
          </article>
        ))}

        {/* 이미지 행 토글 */}
        {!showImage && (
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowImage(true)}
            >
              <i className="ri-image-line" />
              이미지 생성 모델 추가
            </button>
          </div>
        )}
        {showImage && (
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowImage(false)}
              style={{ color: "var(--gray-400)" }}
            >
              <i className="ri-close-line" />
              이미지 모델 제거
            </button>
          </div>
        )}
      </section>

      {/* 저장 버튼 */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 24 }}>
        <button
          type="button"
          className="btn btn-primary"
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
              모델 저장
            </>
          )}
        </button>
      </div>
    </div>
  );
}
