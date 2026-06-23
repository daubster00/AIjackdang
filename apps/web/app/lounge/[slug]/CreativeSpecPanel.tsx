"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";
import type { CreativeSpec } from "@ai-jakdang/contracts";
import styles from "./CreativeSpecPanel.module.css";

/**
 * 창작 스펙 패널 — 글 상세 우측에 표시되는 AI 창작 스펙 정보.
 * spec 데이터가 없으면 null 반환하여 렌더 자체를 생략한다.
 * 반응형: 데스크톱에서 우측 사이드 패널, 모바일에서 본문 하단 블록.
 *
 * Story 2.11: spec은 API 응답 postDetail.creativeSpec에서 전달됨.
 * CreativeSpec 타입은 @ai-jakdang/contracts에서 import.
 */

/** AI 툴·모델 항목 1개 (contracts AiTool 타입과 동일) */
export type { CreativeSpec };

interface Props {
  spec: CreativeSpec | null | undefined;
}

export function CreativeSpecPanel({ spec }: Props) {
  // spec 없으면 렌더 생략 — 레이아웃이 깨지지 않도록 null 반환
  if (!spec) return null;

  return (
    <aside className={styles.panel} aria-label="창작 스펙">
      <h3 className={styles.panelTitle}>
        <Icon name="magic-line" className={styles.panelIcon} aria-hidden="true" />
        창작 스펙
      </h3>

      {/* 창작물 유형 (mediaType 배열) */}
      {spec.mediaType && spec.mediaType.length > 0 && (
        <Section label="창작물 유형">
          <div className={styles.chips}>
            {spec.mediaType.map((t) => (
              <span key={t} className={styles.chip}>
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* 사용 AI 툴·모델 */}
      {spec.tools && spec.tools.length > 0 && (
        <Section label="사용 AI 툴·모델">
          <ol className={styles.toolList}>
            {spec.tools.map((tool, idx) => (
              <li key={idx} className={styles.toolItem}>
                <span className={styles.toolName}>{tool.name}</span>
                {tool.model && (
                  <span className={styles.toolMeta}>{tool.model}</span>
                )}
                {tool.role && (
                  <span className={styles.toolRole}>{tool.role}</span>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Positive Prompt */}
      {spec.prompt && (
        <Section label="Prompt">
          <PromptBlock text={spec.prompt} copyLabel="프롬프트" />
        </Section>
      )}

      {/* Negative Prompt */}
      {spec.negPrompt && (
        <Section label="Negative Prompt">
          <PromptBlock text={spec.negPrompt} copyLabel="네거티브 프롬프트" />
        </Section>
      )}

      {/* 주요 파라미터 */}
      {spec.params && Object.keys(spec.params).length > 0 && (
        <Section label="주요 파라미터">
          <dl className={styles.paramList}>
            {Object.entries(spec.params).map(([k, v]) => (
              <div key={k} className={styles.paramRow}>
                <dt className={styles.paramKey}>{k}</dt>
                <dd className={styles.paramValue}>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* 후처리·워크플로 */}
      {spec.postProcess && (
        <Section label="후처리·워크플로">
          <p className={styles.plainText}>{spec.postProcess}</p>
        </Section>
      )}

      {/* 비용 (costType: "free"|"paid" → 한국어 표기 변환) */}
      {(spec.costType || spec.timeSpent) && (
        <Section label="비용">
          <div className={styles.metaRow}>
            {spec.costType && (
              <span
                className={`${styles.costBadge} ${
                  spec.costType === "paid" ? styles.costPaid : styles.costFree
                }`}
              >
                {spec.costType === "paid" ? "유료" : "무료"}
              </span>
            )}
            {spec.timeSpent && (
              <span className={styles.metaItem}>
                <Icon name="time-line" aria-hidden="true" />
                {spec.timeSpent}
              </span>
            )}
          </div>
        </Section>
      )}

      {/* 라이선스 (licenseNote: license + commercial 병합 텍스트) */}
      {spec.licenseNote && (
        <Section label="라이선스">
          <div className={styles.metaCol}>
            <span className={styles.licenseText}>{spec.licenseNote}</span>
          </div>
        </Section>
      )}
    </aside>
  );
}

/* ── 내부 섹션 래퍼 ── */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>{label}</span>
      {children}
    </div>
  );
}

/* ── 프롬프트 코드블록 + 복사 버튼 ── */
function PromptBlock({ text, copyLabel }: { text: string; copyLabel: string }) {
  // 복사 성공 시 잠깐 "복사됨" 문구 표시
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // 2초 후 원래 상태로 복원
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("클립보드 복사에 실패했습니다.");
    }
  }

  return (
    <div className={styles.promptWrap}>
      <button
        type="button"
        className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`}
        onClick={handleCopy}
        aria-label={`${copyLabel} 복사`}
        title={copied ? "복사됨!" : `${copyLabel} 복사`}
      >
        <Icon name={copied ? "check-line" : "clipboard-line"} aria-hidden="true" />
        {copied ? "복사됨" : "복사"}
      </button>
      {/* 사용자 입력 텍스트는 textContent로만 렌더 (XSS 안전) */}
      <pre className={styles.promptCode}>
        <code>{text}</code>
      </pre>
    </div>
  );
}
