import Link from "next/link";
import { Icon } from "@/components/ui";
import styles from "./RelatedPosts.module.css";

interface RelatedItem {
  id: string;
  title: string;
  slug: string;
  href: string;
  createdAt: string;
  viewCount: number;
}

interface RelatedPostsProps {
  relatedPosts: RelatedItem[];
  authorPosts: RelatedItem[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function PostList({ items }: { items: RelatedItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.item}>
          <Link href={item.href} className={styles.itemLink}>
            <span className={styles.itemTitle}>{item.title}</span>
            <span className={styles.itemMeta}>
              <span>{formatDate(item.createdAt)}</span>
              <span>
                <Icon name="eye-line" />
                {item.viewCount.toLocaleString()}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RelatedPosts({ relatedPosts, authorPosts }: RelatedPostsProps) {
  if (relatedPosts.length === 0 && authorPosts.length === 0) return null;

  return (
    <aside className={styles.root}>
      {relatedPosts.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.heading}>
            <Icon name="links-line" />
            관련 글
          </h2>
          <PostList items={relatedPosts} />
        </section>
      )}
      {authorPosts.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.heading}>
            <Icon name="quill-pen-line" />
            작성자의 다른 글
          </h2>
          <PostList items={authorPosts} />
        </section>
      )}
    </aside>
  );
}
