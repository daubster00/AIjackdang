import Link from "next/link";
import type { SearchResultItem } from "@ai-jakdang/contracts";
import styles from "../search.module.css";

function highlight(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i}>{part}</mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function getItemHref(item: SearchResultItem): string {
  if (item.type === "post") {
    return `/${item.board}/${item.slug}`;
  }
  if (item.type === "question") {
    return `/questions/${item.slug}`;
  }
  return `/resources/${item.slug}`;
}

const TYPE_LABEL: Record<SearchResultItem["type"], string> = {
  post: "게시글",
  question: "묻고답하기",
  resource: "실전자료",
};

interface Props {
  item: SearchResultItem;
  query: string;
}

export function SearchResultItemCard({ item, query }: Props) {
  const href = getItemHref(item);
  const typeLabel = TYPE_LABEL[item.type];

  return (
    <article className={styles.resultItem}>
      <div className={styles.resultMeta}>
        <span className={styles.typeBadge} data-type={item.type}>
          {typeLabel}
        </span>
        {item.type === "question" && item.isResolved && (
          <span className={styles.resolvedBadge}>해결됨</span>
        )}
      </div>

      <h2 className={styles.resultTitle}>
        <Link href={href} className={styles.resultLink}>
          {highlight(item.title, query)}
        </Link>
      </h2>

      {item.summary && (
        <p className={styles.resultSummary}>
          {highlight(item.summary, query)}
        </p>
      )}

      {item.tags.length > 0 && (
        <div className={styles.tagList}>
          {item.tags.map((tag) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className={styles.tagChip}
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      <div className={styles.resultFooter}>
        {item.authorNickname && (
          <span className={styles.author}>{item.authorNickname}</span>
        )}
        <time className={styles.date} dateTime={item.createdAt}>
          {new Date(item.createdAt).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
      </div>
    </article>
  );
}
