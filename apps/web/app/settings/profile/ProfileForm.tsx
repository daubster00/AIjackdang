"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { Avatar, Button, Icon, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useMockAuth } from "@/hooks/useMockAuth";
import type { MockUser } from "@/lib/mockAuth";
import { updateProfile, checkNickname, uploadAvatar, uploadBanner } from "@/lib/users-api";
import shell from "../settings.module.css";
import styles from "./profile.module.css";

/** 로그인 사용자가 없을 때 화면을 채우는 데모 프로필 (mypage 와 동일 톤) */
const DEMO_USER: MockUser = {
  nickname: "작당탐험가",
  email: "explorer@aijakdang.com",
  rank: "practitioner",
};

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
  const { user } = useMockAuth();
  const { toast } = useToast();
  // 로그인 사용자가 있으면 사용, 없으면 데모 프로필로 폴백한다.
  const profile = user ?? DEMO_USER;

  // 제어 입력 상태 (nickname: 닉네임, bio: 한 줄 소개)
  const [nickname, setNickname] = useState(profile.nickname);
  const [bio, setBio] = useState(
    "n8n·Claude Code로 사이드 프로젝트 만드는 중. 자동화 외주도 조금씩 받고 있어요.",
  );

  // 닉네임 중복 체크 상태
  const [nicknameError, setNicknameError] = useState<string | undefined>(undefined);
  const [nicknameOk, setNicknameOk] = useState<boolean>(false);

  // avatarPreview: 선택한 프로필 이미지의 미리보기 URL(dataURL).
  // null 이면 기본 아바타(닉네임 첫 글자 자동 생성)로 표시한다.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  // avatarFile: 업로드 대기 중인 파일
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // avatarFileRef: 숨김 파일 input 을 버튼으로 대신 여는 ref
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // bannerPreview: 배너 이미지 미리보기 URL(dataURL).
  // null 이면 그라데이션 플레이스홀더 표시.
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  // bannerFile: 업로드 대기 중인 파일
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  // bannerFileRef: 배너 이미지 숨김 input ref
  const bannerFileRef = useRef<HTMLInputElement>(null);

  // links: 외부 링크 행 목록 (GitHub·블로그·사이트 등 여러 개 추가 가능)
  const [links, setLinks] = useState<LinkItem[]>([{ id: newLinkId(), url: "" }]);

  // 폼 제출 중 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── 아바타 이미지 핸들러 ──

  // "이미지 변경": 파일 선택 시 FileReader 로 dataURL 미리보기 생성
  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        setAvatarPreview(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
    // 같은 파일을 다시 선택해도 onChange 가 발생하도록 값 초기화
    event.target.value = "";
  }

  // "기본 이미지로": 선택한 아바타를 지워 닉네임 첫 글자 아바타로 복귀
  function handleAvatarReset() {
    setAvatarPreview(null);
    setAvatarFile(null);
  }

  // ── 배너 이미지 핸들러 ──

  // 배너 이미지 선택: 아바타와 동일한 FileReader 패턴
  function handleBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        setBannerPreview(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  // "배너 기본으로": 업로드한 배너를 지워 그라데이션 플레이스홀더로 복귀
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
    if (nickname === profile.nickname) {
      // 자기 자신 닉네임 → 중복 아님
      setNicknameError(undefined);
      setNicknameOk(false);
      return;
    }
    if (nickname.length < 2 || nickname.length > 20) return;

    const result = await checkNickname(nickname);
    if (result === null) return; // 네트워크 오류 시 무시

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

    if (nicknameError) return; // 닉네임 중복 오류가 있으면 제출 불가
    setIsSubmitting(true);

    try {
      let uploadedAvatarUrl: string | undefined = undefined;
      let uploadedBannerUrl: string | undefined = undefined;

      // 아바타 파일 업로드
      if (avatarFile) {
        const res = await uploadAvatar(avatarFile);
        if ("ok" in res) {
          toast({ tone: "danger", title: "이미지 업로드 실패", description: res.message });
          setIsSubmitting(false);
          return;
        }
        uploadedAvatarUrl = res.url;
      }

      // 배너 파일 업로드
      if (bannerFile) {
        const res = await uploadBanner(bannerFile);
        if ("ok" in res) {
          toast({ tone: "danger", title: "배너 업로드 실패", description: res.message });
          setIsSubmitting(false);
          return;
        }
        uploadedBannerUrl = res.url;
      }

      // 프로필 수정 API 호출
      const validLinks = links
        .filter((l) => l.url.trim() !== "")
        .map((l) => ({ label: l.url, url: l.url }));

      const result = await updateProfile({
        nickname,
        bio,
        links: validLinks,
        ...(uploadedAvatarUrl !== undefined ? { avatarUrl: uploadedAvatarUrl } : {}),
        ...(uploadedBannerUrl !== undefined ? { bannerUrl: uploadedBannerUrl } : {}),
      });

      if (result.ok) {
        toast({ tone: "success", title: "프로필이 저장됐어요" });
        setAvatarFile(null);
        setBannerFile(null);
        setNicknameOk(false);
      } else if (result.code === "NICKNAME_TAKEN") {
        setNicknameError("이미 사용 중인 닉네임입니다.");
      } else {
        toast({ tone: "danger", title: "저장 실패", description: result.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={shell.form} onSubmit={handleSubmit}>

      {/* ── 배너 이미지 미리보기 + 업로드 ── */}
      <div className={styles.bannerSection}>
        <span className={styles.fieldLabel} id="banner-label">배너 이미지</span>
        {/* 배너 미리보기 영역: 업로드 이미지 or 그라데이션 플레이스홀더 */}
        <div
          className={styles.bannerPreview}
          aria-labelledby="banner-label"
          aria-description="배너 미리보기"
        >
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="image-add-line" />}
            onClick={() => bannerFileRef.current?.click()}
          >
            배너 변경
          </Button>
          {bannerPreview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Icon name="delete-bin-line" />}
              onClick={handleBannerReset}
            >
              기본으로
            </Button>
          )}
          <span className={styles.bannerHint}>
            {bannerPreview
              ? "업로드한 이미지로 배너가 표시됩니다."
              : "이미지 미업로드 시 기본 그라데이션 배너가 적용됩니다."}
          </span>
        </div>
        {/* 숨김 파일 input: 버튼으로 대신 열고, 접근성 라벨로 용도 명시 */}
        <input
          ref={bannerFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className={styles.fileInput}
          onChange={handleBannerChange}
          aria-label="배너 이미지 파일 선택"
        />
      </div>

      {/* ── 아바타 미리보기 + 이미지 변경/제거 ── */}
      <div className={styles.avatarRow}>
        <Avatar
          name={nickname || profile.nickname}
          src={avatarPreview ?? undefined}
          size="lg"
          className={styles.avatar}
        />
        <div className={styles.avatarText}>
          <span className={styles.avatarName}>{nickname || profile.nickname}</span>
          <span className={styles.avatarHint}>
            {avatarPreview
              ? "선택한 이미지로 미리보기 중입니다. 업로드 시 기본 이미지를 대신합니다."
              : "기본 이미지(닉네임 첫 글자 자동 생성). 업로드 시 기본 이미지를 대신합니다."}
          </span>

          <div className={styles.avatarActions}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Icon name="image-add-line" />}
              onClick={() => avatarFileRef.current?.click()}
            >
              이미지 변경
            </Button>
            {avatarPreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<Icon name="delete-bin-line" />}
                onClick={handleAvatarReset}
              >
                기본 이미지로
              </Button>
            )}
          </div>

          {/* 실제 파일 선택은 숨김 input 으로 처리하고 버튼으로 연다.
              접근성: 라벨/aria 로 용도를 명시 */}
          <input
            ref={avatarFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.fileInput}
            onChange={handleAvatarChange}
            aria-label="프로필 이미지 파일 선택"
          />
        </div>
      </div>

      {/* ── 닉네임 필드 + 유니크/허용문자 안내 문구 ── */}
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
        {/* 닉네임 허용 문자 및 유니크 안내 (인라인 힌트) */}
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

      {/* ── 외부 링크 (행 추가형 다중 입력) ── */}
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
              {/* 첫 번째 행은 최소 1개 유지를 위해 삭제 버튼을 links 가 1개일 때만 숨김 */}
              {links.length > 1 && (
                <button
                  type="button"
                  className={styles.linkRemoveBtn}
                  aria-label={`링크 ${idx + 1} 삭제`}
                  onClick={() => handleLinkRemove(link.id)}
                >
                  <Icon name="close-line" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 링크 추가 버튼: 최대 5개까지 허용 */}
        {links.length < 5 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Icon name="add-line" />}
            onClick={handleLinkAdd}
            className={styles.linkAddBtn}
          >
            링크 추가
          </Button>
        )}
      </div>

      {/* 이메일은 읽기전용 (로그인 식별자라 이 화면에서 변경 불가) */}
      <div className={styles.readonlyField}>
        <span className={styles.readonlyLabel} id="email-readonly-label">
          이메일
        </span>
        <div
          className={styles.readonlyValue}
          aria-labelledby="email-readonly-label"
          aria-readonly="true"
        >
          <Icon name="mail-line" />
          {profile.email}
        </div>
      </div>

      <div className={shell.actions}>
        <Link href="/mypage">
          <Button type="button" variant="secondary">
            취소
          </Button>
        </Link>
        <Button type="submit" leftIcon={<Icon name="save-line" />} disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
