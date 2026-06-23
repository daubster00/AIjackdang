"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";
import styles from "./CreativeSpecFields.module.css";

/**
 * AI 창작마당 전용 창작 스펙 입력 섹션.
 * PostWriteForm 안에 침습적으로 삽입하지 않고, 글쓰기 페이지에서
 * PostWriteForm 바로 아래에 별도 섹션으로 렌더한다.
 *
 * 전 항목 선택 입력이므로 스펙 섹션 자체도 접을 수 있다.
 * 제출은 상위 alert 수준(목업)이므로 데이터를 외부로 올리지 않는다.
 */

/** 창작물 유형 옵션 */
const CREATION_TYPES = ["이미지", "영상", "오디오·음악", "3D", "기타"] as const;

/** AI 툴 행 1개를 표현하는 타입 */
interface AiToolRow {
  id: number;
  name: string;
  model: string;
  role: string;
}

/** 파라미터 행 1개(key-value) */
interface ParamRow {
  id: number;
  key: string;
  value: string;
}

let _uid = 0;
function uid() {
  return ++_uid;
}

export function CreativeSpecFields() {
  // 접이식 토글 — 기본은 닫힘(선택 섹션)
  const [open, setOpen] = useState(false);

  // 창작물 유형 (복수 선택 가능)
  const [types, setTypes] = useState<string[]>([]);

  // 사용 AI 툴·모델 행 추가형
  const [toolRows, setToolRows] = useState<AiToolRow[]>([
    { id: uid(), name: "", model: "", role: "" },
  ]);

  // 프롬프트 (코드블록형 textarea)
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("");

  // 주요 파라미터 key-value 행 추가형
  const [params, setParams] = useState<ParamRow[]>([
    { id: uid(), key: "", value: "" },
  ]);

  // 후처리·워크플로 자유 텍스트
  const [postProcess, setPostProcess] = useState("");

  // 비용 정보
  const [costType, setCostType] = useState<"유료" | "무료" | "">("");
  const [duration, setDuration] = useState("");

  // 라이선스·상업적 사용
  const [license, setLicense] = useState("");
  const [commercial, setCommercial] = useState<"가능" | "불가" | "">("");

  /* ── AI 툴 행 조작 ── */
  function addToolRow() {
    setToolRows((prev) => [...prev, { id: uid(), name: "", model: "", role: "" }]);
  }
  function removeToolRow(id: number) {
    setToolRows((prev) => prev.filter((r) => r.id !== id));
  }
  function updateToolRow(id: number, field: keyof Omit<AiToolRow, "id">, value: string) {
    setToolRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  /* ── 파라미터 행 조작 ── */
  function addParamRow() {
    setParams((prev) => [...prev, { id: uid(), key: "", value: "" }]);
  }
  function removeParamRow(id: number) {
    setParams((prev) => prev.filter((r) => r.id !== id));
  }
  function updateParam(id: number, field: "key" | "value", value: string) {
    setParams((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  /* ── 창작물 유형 토글 ── */
  function toggleType(t: string) {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  return (
    <section className={styles.specSection} aria-label="창작 스펙 섹션">
      {/* 접이식 헤더 — 클릭 시 토글 */}
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.toggleLeft}>
          <Icon name="magic-line" className={styles.toggleIcon} aria-hidden="true" />
          창작 스펙 추가
          <span className={styles.toggleHint}>
            (선택 · AI 툴·프롬프트·파라미터 등)
          </span>
        </span>
        <Icon
          name={open ? "arrow-up-s-line" : "arrow-down-s-line"}
          className={styles.toggleCaret}
          aria-hidden="true"
        />
      </button>

      {/* 접힌 상태일 땐 렌더하지 않음 */}
      {open && (
        <div className={styles.specBody}>
          {/* ── 1. 창작물 유형 ── */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>창작물 유형</legend>
            <div className={styles.typeChips}>
              {CREATION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.typeChip} ${types.includes(t) ? styles.typeChipActive : ""}`}
                  onClick={() => toggleType(t)}
                  aria-pressed={types.includes(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>

          {/* ── 2. 사용 AI 툴·모델 (행 추가형) ── */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>사용 AI 툴·모델</legend>
            <p className={styles.fieldHint}>
              여러 툴을 파이프라인 순서로 추가할 수 있습니다.
            </p>
            <div className={styles.rowList}>
              {toolRows.map((row, idx) => (
                <div key={row.id} className={styles.toolRow}>
                  <span className={styles.rowIdx}>{idx + 1}</span>
                  <input
                    className={styles.rowInput}
                    type="text"
                    placeholder="툴 이름 (예: Midjourney)"
                    value={row.name}
                    onChange={(e) => updateToolRow(row.id, "name", e.target.value)}
                    aria-label={`${idx + 1}번째 AI 툴 이름`}
                  />
                  <input
                    className={styles.rowInput}
                    type="text"
                    placeholder="모델·버전 (예: v6.1)"
                    value={row.model}
                    onChange={(e) => updateToolRow(row.id, "model", e.target.value)}
                    aria-label={`${idx + 1}번째 AI 툴 모델·버전`}
                  />
                  <input
                    className={`${styles.rowInput} ${styles.rowInputRole}`}
                    type="text"
                    placeholder="역할 (예: 배경 생성)"
                    value={row.role}
                    onChange={(e) => updateToolRow(row.id, "role", e.target.value)}
                    aria-label={`${idx + 1}번째 AI 툴 역할`}
                  />
                  {toolRows.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeToolRow(row.id)}
                      aria-label={`${idx + 1}번째 툴 행 삭제`}
                    >
                      <Icon name="close-line" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className={styles.addRowBtn} onClick={addToolRow}>
              <Icon name="add-line" />
              툴 추가
            </button>
          </fieldset>

          {/* ── 3. 프롬프트 (코드블록형 textarea) ── */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>프롬프트</legend>
            <div className={styles.codeTextareaWrap}>
              <label className={styles.codeLabel} htmlFor="spec-prompt">
                Positive Prompt
              </label>
              <textarea
                id="spec-prompt"
                className={styles.codeTextarea}
                rows={4}
                placeholder="positive prompt를 입력하세요..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className={styles.codeTextareaWrap}>
              <label className={styles.codeLabel} htmlFor="spec-neg-prompt">
                Negative Prompt
              </label>
              <textarea
                id="spec-neg-prompt"
                className={styles.codeTextarea}
                rows={3}
                placeholder="negative prompt를 입력하세요..."
                value={negPrompt}
                onChange={(e) => setNegPrompt(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </fieldset>

          {/* ── 4. 주요 파라미터 (key-value 행 추가형) ── */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>주요 파라미터</legend>
            <p className={styles.fieldHint}>
              시드·화면비·해상도·steps·CFG·sampler 등을 자유롭게 추가하세요.
            </p>
            <div className={styles.rowList}>
              {params.map((row, idx) => (
                <div key={row.id} className={styles.paramRow}>
                  <input
                    className={styles.paramKey}
                    type="text"
                    placeholder="파라미터 이름"
                    value={row.key}
                    onChange={(e) => updateParam(row.id, "key", e.target.value)}
                    aria-label={`${idx + 1}번째 파라미터 이름`}
                  />
                  <span className={styles.paramSep}>:</span>
                  <input
                    className={styles.paramValue}
                    type="text"
                    placeholder="값"
                    value={row.value}
                    onChange={(e) => updateParam(row.id, "value", e.target.value)}
                    aria-label={`${idx + 1}번째 파라미터 값`}
                  />
                  {params.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeParamRow(row.id)}
                      aria-label={`${idx + 1}번째 파라미터 삭제`}
                    >
                      <Icon name="close-line" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className={styles.addRowBtn} onClick={addParamRow}>
              <Icon name="add-line" />
              파라미터 추가
            </button>
          </fieldset>

          {/* ── 5. 후처리·워크플로 ── */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>후처리·워크플로</legend>
            <p className={styles.fieldHint}>
              업스케일·인페인팅·ControlNet/LoRA·img2img 등 사용한 후처리 과정을 자유롭게 적어주세요.
            </p>
            <textarea
              className={styles.plainTextarea}
              rows={3}
              placeholder="예: Real-ESRGAN으로 4× 업스케일 후 Adobe Lightroom으로 색보정"
              value={postProcess}
              onChange={(e) => setPostProcess(e.target.value)}
              aria-label="후처리·워크플로"
            />
          </fieldset>

          {/* ── 6. 비용 ── */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>비용</legend>
            <div className={styles.inlineGroup}>
              {/* 유료/무료 라디오 */}
              <div className={styles.radioGroup} role="radiogroup" aria-label="유료/무료">
                {(["유료", "무료"] as const).map((v) => (
                  <label key={v} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="spec-cost"
                      value={v}
                      checked={costType === v}
                      onChange={() => setCostType(v)}
                      className={styles.radioInput}
                    />
                    {v}
                  </label>
                ))}
              </div>
              {/* 제작 소요 시간 */}
              <div className={styles.durationField}>
                <label htmlFor="spec-duration" className={styles.inlineLabel}>
                  제작 소요 시간
                </label>
                <input
                  id="spec-duration"
                  className={styles.inlineInput}
                  type="text"
                  placeholder="예: 2시간 30분"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          {/* ── 7. 라이선스·상업적 사용 ── */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>라이선스·상업적 사용</legend>
            <div className={styles.inlineGroup}>
              <input
                className={styles.licenseInput}
                type="text"
                placeholder="라이선스 (예: CC BY-NC 4.0, 개인 사용만 허용)"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                aria-label="라이선스"
              />
              <div className={styles.radioGroup} role="radiogroup" aria-label="상업적 사용">
                <span className={styles.inlineLabel}>상업적 사용</span>
                {(["가능", "불가"] as const).map((v) => (
                  <label key={v} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="spec-commercial"
                      value={v}
                      checked={commercial === v}
                      onChange={() => setCommercial(v)}
                      className={styles.radioInput}
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        </div>
      )}
    </section>
  );
}
