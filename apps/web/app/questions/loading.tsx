/**
 * 묻고답하기 목록 로딩 스켈레톤 — Story 3.2
 *
 * Next.js App Router loading.tsx 패턴.
 * 필터 칩 교체 시(라우트 전환 중) 레이아웃 일치 스켈레톤으로 레이아웃 이동 방지.
 */

import { Skeleton } from "@/components/ui";
import styles from "./questions.module.css";

function QuestionItemSkeleton() {
  return (
    <article className={styles.questionItem} aria-hidden="true">
      <div className={styles.answerCount}>
        <Skeleton variant="title" width={32} height={32} />
        <Skeleton variant="short" width={24} />
      </div>
      <div className={styles.questionBody}>
        <div className={styles.questionTop}>
          <Skeleton variant="short" width={60} height={20} />
          <Skeleton variant="short" width={100} height={20} />
        </div>
        <Skeleton variant="title" width="80%" />
        <Skeleton variant="line" />
        <Skeleton variant="line" width="60%" />
      </div>
    </article>
  );
}

export default function QuestionsLoading() {
  return (
    <main id="main" className={styles.page} aria-busy="true" aria-label="질문 목록 불러오는 중">
      {/* 필터 칩 스켈레톤 */}
      <section className={styles.toolbar} aria-hidden="true">
        <div className={styles.filterGroup} role="group">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="short" width={72} height={32} />
          ))}
        </div>
      </section>

      {/* 목록 스켈레톤 */}
      <div className={styles.listLayout}>
        <div className={styles.mainCol}>
          <section className={styles.questionList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <QuestionItemSkeleton key={i} />
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
