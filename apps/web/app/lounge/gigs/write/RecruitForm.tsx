"use client";

// 작당 의뢰소 전용 구조화 글쓰기 폼.
// Story 2.12: 실 API 연동 (POST /api/v1/posts, board=gigs + recruitPost).
// 필수/선택 필드 + 인라인 검증 + 거래주의 고지 배너 포함.

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { LightEditor } from "@/components/board";
import { useToast } from "@/components/ui/Toast/Toast";
import { GIG_FIELDS, type GigField, type GigType, type GigStatus } from "../constants";
import styles from "../gigs.module.css";

// 첨부 파일 최대 개수
const MAX_FILES = 5;

// 진행방식 선택지
const WORK_STYLES = ["원격", "대면", "혼합"] as const;
type WorkStyle = (typeof WORK_STYLES)[number];

// 연락방법 선택지
const CONTACT_TYPES = ["사이트 쪽지", "이메일", "오픈채팅 링크"] as const;
type ContactType = (typeof CONTACT_TYPES)[number];

// 진행방식 → API enum 매핑
const WORK_STYLE_API: Record<WorkStyle, "remote" | "onsite" | "hybrid"> = {
  "원격": "remote",
  "대면": "onsite",
  "혼합": "hybrid",
};

// ── 폼 state 타입 ──────────────────────────────────────────
type FormState = {
  type: GigType | "";
  fields: GigField[];
  status: GigStatus;
  contactTypes: ContactType[];
  externalContact: string; // 이메일 또는 오픈채팅 링크
  budget: string;
  period: string;
  workStyle: WorkStyle | "";
  title: string;
  bodyHtml: string; // LightEditor HTML
  bodyText: string; // 순수 텍스트 (검증용)
};

// ── 인라인 오류 타입 ──────────────────────────────────────
type FormErrors = Partial<Record<keyof FormState | "contactRoot", string>>;

export function RecruitForm() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>({
    type: "",
    fields: [],
    status: "모집중",
    contactTypes: ["사이트 쪽지"], // 기본값: 사이트 쪽지
    externalContact: "",
    budget: "",
    period: "",
    workStyle: "",
    title: "",
    bodyHtml: "",
    bodyText: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // 첨부 파일 state
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일 추가 (최대 MAX_FILES개까지)
  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) return prev;
      return [...prev, ...Array.from(fileList).slice(0, remaining)];
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ── 검증 ────────────────────────────────────────────────
  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!form.type) errs.type = "글유형을 선택하세요.";
    if (form.fields.length === 0) errs.fields = "분야를 하나 이상 선택하세요.";
    if (!form.status) errs.status = "모집상태를 선택하세요.";
    if (form.contactTypes.length === 0) errs.contactRoot = "연락방법을 하나 이상 선택하세요.";
    // 외부 연락(이메일 또는 오픈채팅) 선택 시 URL/이메일 필수
    const needsExternal = form.contactTypes.some((c) => c !== "사이트 쪽지");
    if (needsExternal && !form.externalContact.trim()) {
      errs.externalContact = "이메일 또는 오픈채팅 링크를 입력하세요.";
    }
    if (!form.title.trim()) errs.title = "제목을 입력하세요.";
    if (!form.bodyText.trim()) errs.bodyText = "본문을 입력하세요.";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // 첫 번째 오류 필드로 포커스 이동 (접근성)
      const firstErrorId = Object.keys(errs)[0];
      document.getElementById(`field-${firstErrorId}`)?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      // HTML → 간단한 Tiptap 호환 JSON 래핑
      // (LightEditor는 HTML을 반환하므로 paragraph 노드로 감싸서 전송)
      const contentJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: form.bodyText }],
          },
        ],
      };

      // 연락방법 타입 변환 (한국어 → API 값)
      const contactTypes = form.contactTypes.map((c) => {
        if (c === "사이트 쪽지") return "dm";
        if (c === "이메일") return "email";
        return "openchat";
      });

      const body = {
        board: "gigs",
        title: form.title.trim(),
        contentJson,
        status: "published",
        tags: [],
        recruitPost: {
          postKind: form.type === "의뢰" ? "request" : "offer",
          fields: form.fields as string[],
          recruitStatus: form.status === "모집중" ? "open" : "closed",
          budget: form.budget.trim() || undefined,
          duration: form.period.trim() || undefined,
          workMode: form.workStyle ? WORK_STYLE_API[form.workStyle as WorkStyle] : undefined,
          contactMethod: {
            types: contactTypes,
            external: form.externalContact.trim() || undefined,
          },
        },
      };

      const res = await fetch("/api/v1/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        toast({ tone: "danger", title: "로그인 후 이용해 주세요." });
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data.error?.message ?? "등록에 실패했습니다." });
        return;
      }

      const result = (await res.json()) as { slug: string };
      toast({ tone: "success", title: "의뢰·구직 글이 등록되었습니다." });
      router.push(`/lounge/gigs/${result.slug}`);
    } catch {
      toast({ tone: "danger", title: "등록에 실패했습니다. 잠시 후 다시 시도해주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  // ── 필드 토글 핸들러 ───────────────────────────────────
  function toggleField(f: GigField) {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.includes(f)
        ? prev.fields.filter((x) => x !== f)
        : [...prev.fields, f],
    }));
    setErrors((e) => ({ ...e, fields: undefined }));
  }

  function toggleContactType(c: ContactType) {
    setForm((prev) => {
      const next = prev.contactTypes.includes(c)
        ? prev.contactTypes.filter((x) => x !== c)
        : [...prev.contactTypes, c];
      return { ...prev, contactTypes: next };
    });
    setErrors((e) => ({ ...e, contactRoot: undefined }));
  }

  const needsExternalInput = form.contactTypes.some((c) => c !== "사이트 쪽지");

  // 비로그인 게이트 — ready=true이고 세션 없음이 확인된 경우만 차단
  if (ready && !user) {
    return (
      <EmptyState
        icon="lock-line"
        title="로그인 후 이용해 주세요"
        description="의뢰·구직 글을 작성하려면 로그인이 필요합니다."
        actions={
          <Link href={`/login?redirectTo=${encodeURIComponent(pathname)}`}>
            <Button variant="primary">로그인하기</Button>
          </Link>
        }
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="의뢰·구직 글쓰기 폼">
      {/* ── 거래주의 고지 배너 (항상 상단 노출) ── */}
      <div className={styles.caution} role="note" aria-label="거래 주의 안내">
        <span className={styles.cautionIcon} aria-hidden="true">
          <Icon name="alert-line" />
        </span>
        <div className={styles.cautionText}>
          <strong>거래 보증 없음 · 직거래 사기 주의</strong>
          AI작당은 거래를 보증하지 않습니다. 직거래 시 사기에 주의하고, 선입금·계약은 신중히 진행하세요.
        </div>
      </div>

      {/* ── 구조화 필드 카드 ── */}
      <div className={styles.formCard} style={{ marginTop: "var(--space-5)" }}>
        <div className={styles.formCardHeader}>
          <span className={styles.formCardIcon} aria-hidden="true">
            <Icon name="file-list-3-line" />
          </span>
          <span className={styles.formCardTitle}>의뢰·구직 정보</span>
        </div>

        <div className={styles.formSection}>
          {/* 글유형 (필수) */}
          <div className={styles.formField}>
            <label className={styles.formLabel} id="label-type">
              글유형 <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <div
              className={styles.radioGroup}
              role="radiogroup"
              aria-labelledby="label-type"
              aria-required="true"
              id="field-type"
            >
              {(["의뢰", "구직"] as GigType[]).map((t) => (
                <label
                  key={t}
                  className={`${styles.optionPill} ${form.type === t ? styles.optionPillSelected : ""}`}
                >
                  <input
                    type="radio"
                    name="gig-type"
                    value={t}
                    className={styles.hiddenInput}
                    checked={form.type === t}
                    onChange={() => {
                      setForm((p) => ({ ...p, type: t }));
                      setErrors((e) => ({ ...e, type: undefined }));
                    }}
                  />
                  {t}
                </label>
              ))}
            </div>
            {errors.type && <span className={styles.fieldError} role="alert">{errors.type}</span>}
          </div>

          {/* 분야 (다중, 필수) */}
          <div className={styles.formField}>
            <label className={styles.formLabel} id="label-fields">
              분야{" "}
              <span className={styles.required} aria-hidden="true">*</span>
              <span className={styles.optional}>(다중 선택)</span>
            </label>
            <div
              className={styles.checkboxGroup}
              role="group"
              aria-labelledby="label-fields"
              id="field-fields"
            >
              {GIG_FIELDS.map((f) => (
                <label
                  key={f}
                  className={`${styles.optionPill} ${form.fields.includes(f) ? styles.optionPillSelected : ""}`}
                >
                  <input
                    type="checkbox"
                    value={f}
                    className={styles.hiddenInput}
                    checked={form.fields.includes(f)}
                    onChange={() => toggleField(f)}
                  />
                  {f}
                </label>
              ))}
            </div>
            {errors.fields && <span className={styles.fieldError} role="alert">{errors.fields}</span>}
          </div>

          {/* 모집상태 (필수, 기본 모집중) */}
          <div className={styles.formField}>
            <label className={styles.formLabel} id="label-status">
              모집상태 <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <div
              className={styles.radioGroup}
              role="radiogroup"
              aria-labelledby="label-status"
              id="field-status"
            >
              {(["모집중", "마감"] as GigStatus[]).map((s) => (
                <label
                  key={s}
                  className={`${styles.optionPill} ${form.status === s ? styles.optionPillSelected : ""}`}
                >
                  <input
                    type="radio"
                    name="gig-status"
                    value={s}
                    className={styles.hiddenInput}
                    checked={form.status === s}
                    onChange={() => {
                      setForm((p) => ({ ...p, status: s }));
                      setErrors((e) => ({ ...e, status: undefined }));
                    }}
                  />
                  {s}
                </label>
              ))}
            </div>
            {errors.status && <span className={styles.fieldError} role="alert">{errors.status}</span>}
          </div>

          {/* 연락방법 (필수, 사이트 쪽지 기본 + 외부 선택) */}
          <div className={styles.formField}>
            <label className={styles.formLabel} id="label-contact">
              연락방법 <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <div
              className={styles.checkboxGroup}
              role="group"
              aria-labelledby="label-contact"
              id="field-contactRoot"
            >
              {CONTACT_TYPES.map((c) => (
                <label
                  key={c}
                  className={`${styles.optionPill} ${form.contactTypes.includes(c) ? styles.optionPillSelected : ""}`}
                >
                  <input
                    type="checkbox"
                    value={c}
                    className={styles.hiddenInput}
                    checked={form.contactTypes.includes(c)}
                    onChange={() => toggleContactType(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
            {errors.contactRoot && (
              <span className={styles.fieldError} role="alert">{errors.contactRoot}</span>
            )}

            {/* 외부 연락처 입력 (이메일 또는 오픈채팅 선택 시만 노출) */}
            {needsExternalInput && (
              <div className={styles.externalContact} style={{ marginTop: "var(--space-3)" }}>
                <span className={styles.externalContactLabel}>
                  이메일 주소 또는 오픈채팅 링크를 입력하세요.
                </span>
                <input
                  id="field-externalContact"
                  type="text"
                  className={`${styles.titleInput} ${errors.externalContact ? styles.inputError : ""}`}
                  placeholder="예) example@email.com 또는 https://open.kakao.com/..."
                  value={form.externalContact}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, externalContact: e.target.value }));
                    setErrors((er) => ({ ...er, externalContact: undefined }));
                  }}
                  aria-describedby={errors.externalContact ? "err-externalContact" : undefined}
                />
                {errors.externalContact && (
                  <span id="err-externalContact" className={styles.fieldError} role="alert">
                    {errors.externalContact}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 예산/희망단가 (선택) */}
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="field-budget">
              예산 / 희망단가 <span className={styles.optional}>(선택)</span>
            </label>
            <input
              id="field-budget"
              type="text"
              className={styles.titleInput}
              placeholder="예) 50만원 ~ 100만원, 협의 가능, 편당 3만원"
              value={form.budget}
              onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
            />
          </div>

          {/* 작업기간/마감 (선택) */}
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="field-period">
              작업기간 / 마감 <span className={styles.optional}>(선택)</span>
            </label>
            <input
              id="field-period"
              type="text"
              className={styles.titleInput}
              placeholder="예) 3주 이내, 2026.07.31 마감, 상시 모집"
              value={form.period}
              onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}
            />
          </div>

          {/* 진행방식 (선택) */}
          <div className={styles.formField}>
            <label className={styles.formLabel} id="label-workStyle">
              진행방식 <span className={styles.optional}>(선택)</span>
            </label>
            <div className={styles.radioGroup} role="radiogroup" aria-labelledby="label-workStyle">
              {WORK_STYLES.map((w) => (
                <label
                  key={w}
                  className={`${styles.optionPill} ${form.workStyle === w ? styles.optionPillSelected : ""}`}
                >
                  <input
                    type="radio"
                    name="gig-workStyle"
                    value={w}
                    className={styles.hiddenInput}
                    checked={form.workStyle === w}
                    onChange={() => setForm((p) => ({ ...p, workStyle: w }))}
                  />
                  {w}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 제목 + 본문 카드 ── */}
      <div className={styles.formCard} style={{ marginTop: "var(--space-4)" }}>
        <div className={styles.formCardHeader}>
          <span className={styles.formCardIcon} aria-hidden="true">
            <Icon name="edit-line" />
          </span>
          <span className={styles.formCardTitle}>제목 · 본문</span>
        </div>

        <div className={styles.formSection}>
          {/* 제목 (필수) */}
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="field-title">
              제목 <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              id="field-title"
              type="text"
              className={`${styles.titleInput} ${errors.title ? styles.inputError : ""}`}
              placeholder="글 제목을 입력하세요"
              value={form.title}
              maxLength={100}
              onChange={(e) => {
                setForm((p) => ({ ...p, title: e.target.value }));
                setErrors((er) => ({ ...er, title: undefined }));
              }}
              aria-describedby={errors.title ? "err-title" : undefined}
            />
            {errors.title && (
              <span id="err-title" className={styles.fieldError} role="alert">{errors.title}</span>
            )}
          </div>

          {/* 본문 (필수, 에디터) */}
          <div className={styles.formField}>
            <label className={styles.formLabel} id="label-body">
              본문 <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <div
              id="field-bodyText"
              className={errors.bodyText ? styles.editorError : undefined}
            >
              <LightEditor
                placeholder="의뢰 내용, 지원 자격, 포트폴리오 첨부 방법 등을 자세히 작성하세요."
                ariaLabel="본문 입력"
                minHeight={240}
                onChange={(s) => {
                  setForm((p) => ({ ...p, bodyHtml: s.html, bodyText: s.text }));
                  setErrors((er) => ({ ...er, bodyText: undefined }));
                }}
              />
            </div>
            {errors.bodyText && (
              <span id="err-body" className={styles.fieldError} role="alert">{errors.bodyText}</span>
            )}
          </div>

          {/* 파일 첨부 (선택) — 에디터 바로 아래 */}
          <div className={styles.formField}>
            <label className={styles.formLabel}>
              파일 첨부 <span className={styles.optional}>(선택 · 최대 {MAX_FILES}개)</span>
            </label>
            <button
              type="button"
              className={`${styles.attachDropzone} ${isDragging ? styles.attachDropzoneActive : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              aria-label="파일 첨부 영역. 클릭하거나 파일을 끌어오세요"
            >
              <Icon name="upload-cloud-2-line" className={styles.attachIcon} />
              <span className={styles.attachText}>파일을 끌어다 놓거나 클릭해서 선택하세요</span>
              <span className={styles.attachHint}>이미지·문서·압축파일 등</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className={styles.hiddenInput}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {files.length > 0 && (
              <ul className={styles.attachList}>
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className={styles.attachItem}>
                    <Icon name="file-line" className={styles.attachItemIcon} />
                    <span className={styles.attachName}>{f.name}</span>
                    <span className={styles.attachSize}>
                      {f.size < 1024 * 1024
                        ? `${Math.max(1, Math.round(f.size / 1024))}KB`
                        : `${(f.size / (1024 * 1024)).toFixed(1)}MB`}
                    </span>
                    <button
                      type="button"
                      className={styles.attachRemove}
                      onClick={() => removeFile(i)}
                      aria-label={`${f.name} 첨부 삭제`}
                    >
                      <Icon name="close-line" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 폼 액션 버튼 */}
        <div className={styles.formActions}>
          <Link href="/lounge/gigs">
            <Button variant="ghost" type="button">취소</Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            <Icon name="check-line" />
            {submitting ? "등록 중..." : "등록하기"}
          </Button>
        </div>
      </div>
    </form>
  );
}
