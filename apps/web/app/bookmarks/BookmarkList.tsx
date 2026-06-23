"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AuthorName, Avatar, Button, EmptyState, Icon, Pagination, Select, Tag } from "@/components/ui";
import styles from "./bookmarks.module.css";

export interface BookmarkItem {
  id: string;
  href: string;
  /** 게시판 식별 키 (필터용) */
  boardKey: string;
  /** 게시판 표시 라벨 */
  board: string;
  category: string;
  title: string;
  excerpt: string;
  author: string;
  /** 북마크 저장 날짜 */
  savedAt: string;
  views: string;
  likes: number;
  comments: number;
  tags: string[];
}

interface Props {
  items: BookmarkItem[];
}

const sortOptions = [
  { value: "saved", label: "저장순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
  { value: "comments", label: "댓글순" },
];

const PAGE_SIZE = 8;

/** 북마크 목록: 게시판 필터 + 정렬 + 해제(삭제)까지 처리하는 클라이언트 화면. */
export function BookmarkList({ items }: Props) {
  const [bookmarks, setBookmarks] = useState(items);
  const [boardFilter, setBoardFilter] = useState("all");
  const [sort, setSort] = useState("saved");
  const [page, setPage] = useState(1);

  /** 게시판별 개수를 세어 필터 칩에 표시한다. */
  const boardCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const item of bookmarks) {
      const prev = counts.get(item.boardKey);
      counts.set(item.boardKey, {
        label: item.board,
        count: (prev?.count ?? 0) + 1,
      });
    }
    return counts;
  }, [bookmarks]);

  const filtered = useMemo(() => {
    const base =
      boardFilter === "all"
        ? bookmarks
        : bookmarks.filter((item) => item.boardKey === boardFilter);

    const sorted = [...base];
    if (sort === "popular") sorted.sort((a, b) => b.likes - a.likes);
    else if (sort === "comments") sorted.sort((a, b) => b.comments - a.comments);
    else if (sort === "views")
      sorted.sort(
        (a, b) => Number(b.views.replace(/,/g, "")) - Number(a.views.replace(/,/g, "")),
      );
    return sorted;
  }, [bookmarks, boardFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function removeBookmark(id: string) {
    setBookmarks((prev) => prev.filter((item) => item.id !== id));
  }

  function selectBoard(key: string) {
    setBoardFilter(key);
    setPage(1);
  }

  return (
    <main id="main" className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>My Page</p>
          <h1 className={styles.title}>
            <Icon name="bookmark-fill" />
            북마크
          </h1>
          <p className={styles.subtitle}>
            나중에 다시 볼 글을 저장해 두었습니다. 게시판별로 모아보고 정렬할 수 있어요.
          </p>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.toolbar}>
          <div className={styles.filterChips} role="tablist" aria-label="게시판 필터">
            <button
              type="button"
              role="tab"
              aria-selected={boardFilter === "all"}
              className={boardFilter === "all" ? styles.chipActive : styles.chip}
              onClick={() => selectBoard("all")}
            >
              전체 <span className={styles.chipCount}>{bookmarks.length}</span>
            </button>
            {[...boardCounts.entries()].map(([key, { label, count }]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={boardFilter === key}
                className={boardFilter === key ? styles.chipActive : styles.chip}
                onClick={() => selectBoard(key)}
              >
                {label} <span className={styles.chipCount}>{count}</span>
              </button>
            ))}
          </div>

          <div className={styles.sortGroup}>
            <Select
              options={sortOptions}
              value={sort}
              onChange={setSort}
              label="북마크 정렬"
            />
          </div>
        </div>

        {pageItems.length === 0 ? (
          <EmptyState
            icon="bookmark-line"
            title="저장한 북마크가 없습니다"
            description="마음에 드는 글에서 북마크 버튼을 누르면 이곳에 모여요."
            actions={
              <Link href="/vibe-coding">
                <Button>글 둘러보기</Button>
              </Link>
            }
          />
        ) : (
          <section className={styles.postList} aria-label="북마크한 글 목록">
            {pageItems.map((item) => (
              <article key={item.id} className={styles.postItem}>
                <Link href={item.href} className={styles.postThumb}>
                  <Image
                    src="/default-thumbnail.png"
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 120px"
                    className={styles.thumbImage}
                  />
                </Link>

                <div className={styles.postBody}>
                  <div className={styles.postTop}>
                    <span className={styles.boardBadge}>{item.board}</span>
                    <span className={styles.categoryText}>{item.category}</span>
                  </div>

                  <h2 className={styles.postHeading}>
                    <Link href={item.href} className={styles.postTitle}>
                      {item.title}
                    </Link>
                  </h2>

                  <p className={styles.postExcerpt}>{item.excerpt}</p>

                  <div className={styles.tagRow}>
                    {item.tags.map((tag) => (
                      <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                        #{tag}
                      </Tag>
                    ))}
                  </div>

                  <div className={styles.postFooter}>
                    <div className={styles.postAuthor}>
                      <Avatar name={item.author} size="sm" />
                      <AuthorName name={item.author} className={styles.authorName} />
                      <span className={styles.footerDivider} aria-hidden="true">
                        |
                      </span>
                      <span className={styles.savedAt}>{item.savedAt} 저장</span>
                    </div>
                    <div className={styles.postStats} aria-label="게시글 정보">
                      <span>
                        <Icon name="eye-line" />
                        {item.views}
                      </span>
                      <span>
                        <Icon name="chat-3-line" />
                        {item.comments}
                      </span>
                      <span>
                        <Icon name="heart-3-line" />
                        {item.likes}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeBookmark(item.id)}
                  aria-label={`${item.title} 북마크 해제`}
                  title="북마크 해제"
                >
                  <Icon name="bookmark-fill" />
                </button>
              </article>
            ))}
          </section>
        )}

        {totalPages > 1 ? (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            className={styles.pagination}
          />
        ) : null}
      </div>
    </main>
  );
}
