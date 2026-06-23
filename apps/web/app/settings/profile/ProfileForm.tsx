"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { Avatar, Button, Icon, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { resolveAvatarUrl, getDefaultAvatarUrl, DEFAULT_AVATAR_COUNT } from "@/lib/avatar";
import { updateProfile, checkNickname, uploadAvatar, uploadBanner } from "@/lib/users-api";
import shell from "../settings.module.css";
import styles from "./profile.module.css";

/** 한 줄 소개(bio) 최대 글자 수 */
const BIO_MAX = 120;

/** 외부 링크 한 행의 데이터 형태 */
interface LinkItem {
  id: string;
  url: string;
}

/** 새 링크 행에 쓸 고유 ID 생성 (단조 증가 카운터, SSR 안전) */
let _linkIdCounter = 0;
function newLinkId() {
  _linkIdCounter += 1;
  return `link-${_linkIdCounter}`;
}

export function ProfileForm() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();

  // 제어 입력 상태
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");

  // 닉네임 중복 체크 상태
  const [nicknameError, setNicknameError] = useState<string | undefined>(undefined);
  const [nicknameOk, setNicknameOk] = useState<boolean>(false);

  // 아바타 선택 상태:
  // - avatarFile: 업로드 대기 파일(커스텀)
  // - selectedDefault: 선택한 기본 아바타 인덱스
  // - avatarPreview: 미리보기 src(업로드 dataURL 또는 기본 아바타 경로). null 이면 현재 아바타 표시.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedDefault, setSelectedDefault] = useState<number | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // 배너 상태
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  // 외부 링크 행
  const [links, setLinks] = useState<LinkItem[]>([{ id: newLinkId(), url: "" }]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 실제 사용자 정보 로드: 닉네임은 세션, bio·links 는 GET /users/me 로 보강.
  useEffect(() => {
    if (!user) return;
    setNickname(user.nickname);
    fetch("/api/v1/users/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          bio?: string | null;
          bannerUrl?: string | null;
          links?: { url: string }[] | null;
        } | null) => {
          if (data?.bio) setBio(data.bio);
          if (data?.bannerUrl) setBannerPreview(data.bannerUrl);
          if (Array.isArray(data?.links) && data.links.length > 0) {
            setLinks(data.links.map((l) => ({ id: newLinkId(), url: l.url })));
          }
        },
      )
      .catch(() => {
        /* bio·banner·links 로드 실패 시 무시 */
      });
  }, [user]);

  // 현재 화면에 표시할 아바타 src (미리보기 > 현재 프로필 사진)
  const currentAvatarSrc = user ? resolveAvatarUrl(user) : undefined;
  const displayAvatarSrc = avatarPreview ?? currentAvatarSrc;

  // ── 아바타 핸들러 ──

  // 커스텀 이미지 업로드 선택
  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setSelectedDefault(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") setAvatarPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  // 기본 이미지 선택
  function handlePickDefault(index: number) {
    setSelectedDefault(index);
    setAvatarFile(null);
    setAvatarPreview(getDefaultAvatarUrl(index));
  }

  // 변경 취소(현재 저장된 아바타로 복귀)
  function handleAvatarReset() {
    setAvatarFile(null);
    setSelectedDefault(null);
    setAvatarPreview(null);
  }

  // ── 배너 핸들러 ──

  function handleBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") setBannerPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleBannerReset() {
    setBannerPreview(null);
    setBannerFile(null);
  }

  // ── 외부 링크 핸들러 ──

  function handleLinkChange(id: string, value: string) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, url: value } : l)));
  }

  function handleLinkAdd() {
    setLinks((prev) => [...prev, { id: newLinkId(), url: "" }]);
  }

  function handleLinkRemove(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  // ── 닉네임 blur 중복 확인 ──

  async function handleNicknameBlur() {
    if (!user || nickname === user.nickname) {
      setNicknameError(undefined);
      setNicknameOk(false);
      return;
    }
    if (nickname.length < 2 || nickname.length > 20) return;

    const result = await checkNickname(nickname);
    if (result === null) return;

    if (!result.available) {
      setNicknameError("이미 사용 중인 닉네임입니다.");
      setNicknameOk(false);
    } else {
      setNicknameError(undefined);
      setNicknameOk(true);
    }
  }

  // ── 폼 저장 ──

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nicknameError) return;
    setIsSubmitting(true);

    try {
      // 아바타: 업로드 > 기본선택 > 변경없음
      let avatarPatch: { avatarUrl?: string | null; defaultAvatarIndex?: number } = {};
      if (avatarFile) {
        const res = await uploadAvatar(avatarFile);
        if ("ok" in res) {
          toast({ tone: "danger", title: "이미지 업로드 실패", description: res.message });
          setIsSubmitting(false);
          return;
        }
        avatarPatch = { avatarUrl: res.url };
      } else if (selectedDefault !== null) {
        // 기본 이미지 선택 → 커스텀 해제 + 인덱스 저장
        avatarPatch = { avatarUrl: null, defaultAvatarIndex: selectedDefault };
      }

      // 배너 업로드
      let bannerPatch: { bannerUrl?: string } = {};
      if (bannerFile) {
        const res = await uploadBanner(bannerFile);
        if ("ok" in res) {
          toast({ tone: "danger", title: "배너 업로드 실패", description: res.message });
          setIsSubmitting(false);
          return;
        }
        bannerPatch = { bannerUrl: res.url };
      }

      const validLinks = links
        .filter((l) => l.url.trim() !== "")
        .map((l) => ({ label: l.url, url: l.url }));

      const result = await updateProfile({
        nickname,
        bio,
        links: validLinks,
        ...avatarPatch,
        ...bannerPatch,
      });

      if (result.ok) {
        toast({ tone: "success", title: "프로필이 저장됐어요" });
        setAvatarFile(null);
        setBannerFile(null);
        setSelectedDefault(null);
        setAvatarPreview(null);
        setBannerPreview(null);
        setNicknameOk(false);
        await refresh(); // 세션 갱신 → 헤더 아바타 즉시 반영
      } else if (result.code === "NICKNAME_TAKEN") {
        setNicknameError("이미 사용 중인 닉네임입니다.");
      } else {
        toast({ tone: "danger", title: "저장 실패", description: result.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayName = nickname || user?.nickname || "";

  return (
    <form className={shell.form} onSubmit={handleSubmit}>
      {/* ── 배너 이미지 ── */}
      <div className={styles.bannerSection}>
        <span className={styles.fieldLabel} id="banner-label">배너 이미지</span>
        <div className={styles.bannerPreview} aria-labelledby="banner-label" aria-description="배너 미리보기">
          {bannerPreview ? (
            <img src={bannerPreview} alt="배너 미리보기" className={styles.bannerImage} />
          ) : (
            <div className={styles.bannerPlaceholder} aria-hidden="true">
              <Icon name="image-line" />
              <span>배너 이미지 없음</span>
            </div>
          )}
        </div>
        <div className={styles.bannerActions}>
          <Button type="button" variant="secondary" size="sm" leftIcon={<Icon name="image-add-line" />} onClick={() => bannerFileRef.current?.click()}>
            배너 변경
          </Button>
          {bannerPreview && (
            <Button type="button" variant="ghost" size="sm" leftIcon={<Icon name="delete-bin-line" />} onClick={handleBannerReset}>
              기본으로
            </Button>
          )}
          <span className={styles.bannerHint}>
            {bannerPreview ? "업로드한 이미지로 배너가 표시됩니다." : "이미지 미업로드 시 기본 그라데이션 배너가 적용됩니다."}
          </span>
        </div>
        <input ref={bannerFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className={styles.fileInput} onChange={handleBannerChange} aria-label="배너 이미지 파일 선택" />
      </div>

      {/* ── 프로필 이미지: 현재/미리보기 + 업로드 + 기본 이미지 선택 ── */}
      <div className={styles.avatarRow}>
        <Avatar name={displayName} src={displayAvatarSrc} size="lg" className={styles.avatar} />
        <div className={styles.avatarText}>
          <span className={styles.avatarName}>{displayName}</span>
          <span className={styles.avatarHint}>
            기본 이미지를 고르거나 직접 업로드할 수 있어요. (jpg·png·webp·gif, 최대 5MB)
          </span>
          <div className={styles.avatarActions}>
            <Button type="button" variant="secondary" size="sm" leftIcon={<Icon name="image-add-line" />} onClick={() => avatarFileRef.current?.click()}>
              내 이미지 업로드
            </Button>
            {(avatarPreview || avatarFile || selectedDefault !== null) && (
              <Button type="button" variant="ghost" size="sm" leftIcon={<Icon name="arrow-go-back-line" />} onClick={handleAvatarReset}>
                변경 취소
              </Button>
            )}
          </div>
          <input ref={avatarFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className={styles.fileInput} onChange={handleAvatarChange} aria-label="프로필 이미지 파일 선택" />
        </div>
      </div>

      {/* 기본 이미지 갤러리 */}
      <div style={{ marginTop: "calc(-1 * var(--space-2))" }}>
        <span className={styles.fieldLabel}>기본 이미지 선택</span>
        <div role="radiogroup" aria-label="기본 프로필 이미지" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          {Array.from({ length: DEFAULT_AVATAR_COUNT }, (_, i) => {
            const selected = selectedDefault === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`기본 이미지 ${i + 1}`}
                onClick={() => handlePickDefault(i)}
                style={{
                  padding: 0,
                  border: selected ? "2px solid var(--color-primary)" : "2px solid transparent",
                  borderRadius: "50%",
                  background: "none",
                  cursor: "pointer",
                  outline: selected ? "2px solid var(--color-primary)" : "none",
                  outlineOffset: 2,
                }}
              >
                <img
                  src={getDefaultAvatarUrl(i)}
                  alt=""
                  width={44}
                  height={44}
                  style={{ display: "block", width: 44, height: 44, borderRadius: "50%" }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 닉네임 ── */}
      <div className={styles.nicknameField}>
        <Input
          label="닉네임"
          name="nickname"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setNicknameError(undefined);
            setNicknameOk(false);
          }}
          onBlur={handleNicknameBlur}
          placeholder="닉네임을 입력하세요"
          autoComplete="nickname"
          required
          maxLength={20}
          leftIcon={<Icon name="user-line" />}
          error={nicknameError}
          success={nicknameOk ? "사용 가능한 닉네임입니다." : undefined}
        />
        {!nicknameError && !nicknameOk && (
          <p className={styles.nicknameHint}>
            <Icon name="information-line" />
            한글·영문·숫자 2~20자, 특수문자 제외. 닉네임은 중복 사용이 불가합니다.
          </p>
        )}
      </div>

      <Textarea
        label="한 줄 소개"
        name="bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="나를 한 줄로 소개해 보세요."
        rows={3}
        currentLength={bio.length}
        maxLengthHint={BIO_MAX}
      />

      {/* ── 외부 링크 ── */}
      <div className={styles.linksSection}>
        <span className={styles.fieldLabel}>외부 링크</span>
        <p className={styles.fieldDesc}>GitHub, 블로그, 사이트 등 공개할 링크를 추가하세요.</p>
        <div className={styles.linkRows}>
          {links.map((link, idx) => (
            <div key={link.id} className={styles.linkRow}>
              <Icon name="link" className={styles.linkIcon} />
              <input
                type="url"
                className={styles.linkInput}
                value={link.url}
                onChange={(e) => handleLinkChange(link.id, e.target.value)}
                placeholder="https://..."
                aria-label={`외부 링크 ${idx + 1}`}
              />
              {links.length > 1 && (
                <button type="button" className={styles.linkRemoveBtn} aria-label={`링크 ${idx + 1} 삭제`} onClick={() => handleLinkRemove(link.id)}>
                  <Icon name="close-line" />
                </button>
              )}
            </div>
          ))}
        </div>
        {links.length < 5 && (
          <Button type="button" variant="ghost" size="sm" leftIcon={<Icon name="add-line" />} onClick={handleLinkAdd} className={styles.linkAddBtn}>
            링크 추가
          </Button>
        )}
      </div>

      {/* 이메일(읽기전용) */}
      <div className={styles.readonlyField}>
        <span className={styles.readonlyLabel} id="email-readonly-label">이메일</span>
        <div className={styles.readonlyValue} aria-labelledby="email-readonly-label" aria-readonly="true">
          <Icon name="mail-line" />
          {user?.email ?? ""}
        </div>
      </div>

      <div className={shell.actions}>
        <Link href="/mypage">
          <Button type="button" variant="secondary">취소</Button>
        </Link>
        <Button type="submit" leftIcon={<Icon name="save-line" />} disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
