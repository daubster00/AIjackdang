import styles from "./search.module.css";

export default function SearchLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={`${styles.skeletonTitle}`} style={{ height: 32, width: 260 }} />
      </div>

      <div className={styles.skeletonTabList}>
        {["전체", "게시글", "묻고답하기", "실전자료"].map((label) => (
          <div key={label} className={styles.skeletonTab} />
        ))}
      </div>

      <div className={styles.resultPanel}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeletonItem}>
            <div className={styles.skeletonBadge} />
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLine} style={{ width: "80%" }} />
          </div>
        ))}
      </div>
    </main>
  );
}
