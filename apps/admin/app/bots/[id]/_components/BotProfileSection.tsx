"use client";

/**
 * 프로필 연출 탭 — 관리자가 봇을 진짜 유저처럼 꾸민다.
 *
 * 봇은 로그인 자격증명이 없어 /settings/profile(본인 세션 전용)에 접근할 수 없으므로,
 * 관리자가 봇 대신 users 행(배너·아바타·소개·링크·노출글)을 편집한다.
 *
 * - 배너 이미지 업로드/제거      → POST /admin/bots/:id/uploads/banner, PATCH clearBanner
 * - 커스텀 아바타 업로드/제거     → POST /admin/bots/:id/uploads/avatar, PATCH clearAvatar
 * - 기본 아바타(0~9) 선택         → PATCH defaultAvatarIndex
 * - 한 줄 소개(bio) · 외부 링크    → PATCH bio / links
 * - 프로필에 노출할 글(최대 5개)  → GET /admin/bots/:id/posts, PATCH /admin/bots/:id/featured-posts
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";

const DEFAULT_AVATAR_COUNT = 10;
// 공개 프로필(/u/:nickname)은 사용자 웹앱에 있다. 로컬 개발 시 NEXT_PUBLIC_WEB_URL 로 오버라이드.
const WEB_BASE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "https://aijackdang.com";

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface ProfileLink {
  label: string;
  url: string;
}

interface BotProfile {
  userId: string;
  nickname: string;
  bio: string | null;
  image: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  defaultAvatarIndex: number;
  links: ProfileLink[];
  featuredPostIds: string[];
  publicProfilePath: string;
}

interface BotPost {
  id: string;
  board: string;
  boardLabel: string;
  slug: string;
  title: string;
  excerpt: string | null;
  createdAt: string;
  viewCount: number;
}

export interface BotProfileSectionProps {
  botId: string;
  showToast: (message: string, type: "success" | "error") => void;
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function BotProfileSection({ botId, showToast }: BotProfileSectionProps) {
  const [loading, setLoading] = useState(true);
  const [noUser, setNoUser] = useState(false);
  const [profile, setProfile] = useState<BotProfile | null>(null);

  // 편집 상태
  const [bio, setBio] = useState("");
  const [defaultAvatarIndex, setDefaultAvatarIndex] = useState(0);
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // 이미지 (표시용 현재 URL)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // 노출글
  const [posts, setPosts] = useState<BotPost[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [savingFeatured, setSavingFeatured] = useState(false);

  // ── 로드 ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/profile`, {
        credentials: "include",
      });
      if (res.status === 400) {
        // 봇에 연결된 유저 계정 없음
        setNoUser(true);
        return;
      }
      if (!res.ok) throw new Error("조회 실패");
      const data: BotProfile = await res.json();
      setProfile(data);
      setBio(data.bio ?? "");
      setDefaultAvatarIndex(data.defaultAvatarIndex ?? 0);
      setLinks(data.links ?? []);
      setAvatarUrl(data.avatarUrl);
      setBannerUrl(data.bannerUrl);
      setImageUrl(data.image);
      setSelectedPostIds(data.featuredPostIds ?? []);

      // 노출글 후보 목록도 함께 로드
      const postsRes = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/posts`, {
        credentials: "include",
      });
      if (postsRes.ok) {
        const postsData: { items: BotPost[] } = await postsRes.json();
        setPosts(postsData.items);
      }
    } catch {
      showToast("프로필 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [botId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // ── 이미지 업로드 ──────────────────────────────────────────────────────────
  async function uploadImageFile(kind: "avatar" | "banner", file: File) {
    const setUploading = kind === "avatar" ? setUploadingAvatar : setUploadingBanner;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/uploads/${kind}`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "업로드 실패");
      }
      const { url } = (await res.json()) as { url: string };
      if (kind === "avatar") setAvatarUrl(url);
      else setBannerUrl(url);
      showToast(kind === "avatar" ? "프로필 사진이 변경되었습니다." : "배너가 변경되었습니다.", "success");
    } catch (e) {
      showToast(`업로드 실패: ${(e as Error).message}`, "error");
    } finally {
      setUploading(false);
    }
  }

  async function clearImage(kind: "avatar" | "banner") {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "avatar" ? { clearAvatar: true } : { clearBanner: true }),
      });
      if (!res.ok) throw new Error("제거 실패");
      if (kind === "avatar") setAvatarUrl(null);
      else setBannerUrl(null);
      showToast(kind === "avatar" ? "커스텀 프로필 사진을 제거했습니다." : "배너를 제거했습니다.", "success");
    } catch (e) {
      showToast(`제거 실패: ${(e as Error).message}`, "error");
    }
  }

  // ── 프로필(소개·기본아바타·링크) 저장 ───────────────────────────────────────
  async function saveProfile() {
    setSavingProfile(true);
    try {
      const cleanLinks = links
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.url.length > 0);
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: bio.trim() ? bio.trim() : null,
          defaultAvatarIndex,
          links: cleanLinks,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "저장 실패");
      }
      showToast("프로필이 저장되었습니다.", "success");
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`, "error");
    } finally {
      setSavingProfile(false);
    }
  }

  // ── 노출글 저장 ─────────────────────────────────────────────────────────────
  function toggleFeatured(id: string) {
    setSelectedPostIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 5) {
        showToast("노출 글은 최대 5개까지 선택할 수 있습니다.", "error");
        return prev;
      }
      return [...prev, id];
    });
  }

  async function saveFeatured() {
    setSavingFeatured(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/featured-posts`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: selectedPostIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "저장 실패");
      }
      showToast("노출할 글이 저장되었습니다.", "success");
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`, "error");
    } finally {
      setSavingFeatured(false);
    }
  }

  // 현재 아바타 미리보기 URL: 커스텀 > 소셜 image > (기본 아바타는 admin에 자산 없음 → 라벨 표기)
  const previewAvatar = avatarUrl || imageUrl || null;

  // ── 렌더 ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="section">
        <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>불러오는 중...</div>
      </section>
    );
  }

  if (noUser) {
    return (
      <section className="section">
        <article className="card">
          <div className="card-body" style={{ textAlign: "center", padding: 40, color: "var(--gray-500)" }}>
            <i className="ri-user-unfollow-line" style={{ fontSize: 28, opacity: 0.5 }} />
            <p style={{ marginTop: 12 }}>
              이 봇에는 연결된 유저 계정이 없어 프로필을 꾸밀 수 없습니다.
              <br />
              (시딩된 봇만 공개 프로필을 가집니다.)
            </p>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2 className="section-title">프로필 연출</h2>
          <p className="section-description">
            이 봇의 공개 프로필(<code>/u/{profile?.nickname}</code>)에 노출되는 배너·프로필 사진·소개·링크·노출 글을
            관리자가 대신 설정합니다. 봇을 진짜 유저처럼 보이게 하는 용도입니다.
          </p>
        </div>
        <div>
          {profile && (
            <a
              className="btn btn-outline"
              href={`${WEB_BASE_URL}${profile.publicProfilePath}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="ri-external-link-line" />
              공개 프로필 보기
            </a>
          )}
        </div>
      </div>

      {/* ── 배너 ──────────────────────────────────────────────────────────── */}
      <article className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="field">
            <label className="field-label">배너 이미지</label>
            <div
              style={{
                width: "100%",
                height: 140,
                borderRadius: 8,
                background: bannerUrl
                  ? `center / cover no-repeat url(${bannerUrl})`
                  : "var(--gray-100, #f1f3f5)",
                border: "1px solid var(--gray-200, #e9ecef)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--gray-400)",
                fontSize: 13,
              }}
            >
              {!bannerUrl && "배너 없음"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImageFile("banner", f);
                e.target.value = "";
              }}
            />
            <button
              className="btn btn-outline"
              type="button"
              disabled={uploadingBanner}
              onClick={() => bannerInputRef.current?.click()}
            >
              <i className="ri-upload-2-line" />
              {uploadingBanner ? "업로드 중..." : "배너 업로드"}
            </button>
            {bannerUrl && (
              <button className="btn btn-outline" type="button" onClick={() => clearImage("banner")}>
                <i className="ri-delete-bin-line" />
                제거
              </button>
            )}
          </div>
        </div>
      </article>

      {/* ── 프로필 사진 ───────────────────────────────────────────────────── */}
      <article className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="field">
            <label className="field-label">프로필 사진</label>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: previewAvatar
                    ? `center / cover no-repeat url(${previewAvatar})`
                    : "var(--gray-100, #f1f3f5)",
                  border: "1px solid var(--gray-200, #e9ecef)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--gray-400)",
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {!previewAvatar && `기본 #${defaultAvatarIndex}`}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImageFile("avatar", f);
                    e.target.value = "";
                  }}
                />
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <i className="ri-upload-2-line" />
                  {uploadingAvatar ? "업로드 중..." : "사진 업로드"}
                </button>
                {avatarUrl && (
                  <button className="btn btn-outline" type="button" onClick={() => clearImage("avatar")}>
                    <i className="ri-delete-bin-line" />
                    기본으로
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 기본 아바타 선택 (커스텀 사진이 없을 때 사용됨) */}
          <div className="field" style={{ marginTop: 16 }}>
            <label className="field-label">
              기본 아바타
              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--gray-500)" }}>
                (커스텀 사진이 없을 때 프로필에 표시 — 저장 눌러야 반영)
              </span>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: DEFAULT_AVATAR_COUNT }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDefaultAvatarIndex(i)}
                  aria-pressed={defaultAvatarIndex === i}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border:
                      defaultAvatarIndex === i
                        ? "2px solid var(--primary, #4c6ef5)"
                        : "1px solid var(--gray-300, #dee2e6)",
                    background: defaultAvatarIndex === i ? "var(--primary-50, #edf2ff)" : "var(--gray-50, #f8f9fa)",
                    color: defaultAvatarIndex === i ? "var(--primary, #4c6ef5)" : "var(--gray-600)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* ── 소개·링크 ─────────────────────────────────────────────────────── */}
      <article className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="field">
            <label className="field-label" htmlFor="bot-bio">
              한 줄 소개
              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--gray-500)" }}>(최대 200자)</span>
            </label>
            <textarea
              id="bot-bio"
              className="control"
              rows={2}
              maxLength={200}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="예: 바이브 코딩으로 사이드 프로젝트 만드는 걸 좋아합니다."
            />
          </div>

          <div className="field">
            <label className="field-label">
              외부 링크
              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--gray-500)" }}>(최대 5개)</span>
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {links.map((link, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="control"
                    style={{ maxWidth: 160 }}
                    placeholder="라벨 (예: 블로그)"
                    value={link.label}
                    onChange={(e) =>
                      setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l)))
                    }
                  />
                  <input
                    type="url"
                    className="control"
                    style={{ flex: 1 }}
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) =>
                      setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, url: e.target.value } : l)))
                    }
                  />
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="링크 삭제"
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>
              ))}
              {links.length < 5 && (
                <button
                  className="btn btn-outline"
                  type="button"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => setLinks((prev) => [...prev, { label: "", url: "" }])}
                >
                  <i className="ri-add-line" />
                  링크 추가
                </button>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" type="button" disabled={savingProfile} onClick={saveProfile}>
              {savingProfile ? (
                <>
                  <i className="ri-loader-4-line" />
                  저장 중...
                </>
              ) : (
                <>
                  <i className="ri-save-line" />
                  소개·링크·기본아바타 저장
                </>
              )}
            </button>
          </div>
        </div>
      </article>

      {/* ── 노출할 글 ─────────────────────────────────────────────────────── */}
      <article className="card">
        <div className="card-body">
          <div className="section-heading" style={{ marginBottom: 12 }}>
            <div>
              <h3 className="section-title" style={{ fontSize: 16 }}>
                프로필에 노출할 글
              </h3>
              <p className="section-description">
                이 봇이 작성한 발행 글 중 프로필 상단에 노출할 글을 최대 5개 선택합니다. (현재 {selectedPostIds.length}/5)
              </p>
            </div>
            <div>
              <button className="btn btn-primary" type="button" disabled={savingFeatured} onClick={saveFeatured}>
                {savingFeatured ? (
                  <>
                    <i className="ri-loader-4-line" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line" />
                    노출 글 저장
                  </>
                )}
              </button>
            </div>
          </div>

          {posts.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--gray-400)", fontSize: 13 }}>
              이 봇이 작성한 발행 글이 없습니다.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {posts.map((post) => {
                const checked = selectedPostIds.includes(post.id);
                return (
                  <label
                    key={post.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: checked
                        ? "1px solid var(--primary, #4c6ef5)"
                        : "1px solid var(--gray-200, #e9ecef)",
                      background: checked ? "var(--primary-50, #edf2ff)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFeatured(post.id)}
                      style={{ marginTop: 3 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{post.title}</div>
                      <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 2 }}>
                        {post.boardLabel} · 조회 {post.viewCount.toLocaleString()} · {post.createdAt.slice(0, 10)}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
