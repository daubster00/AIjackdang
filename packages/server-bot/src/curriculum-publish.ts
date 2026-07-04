/**
 * 커리큘럼 게시 공유 경계 — Story 13.3
 *
 * PublishChapterResult 인터페이스만 정의한다.
 * 실행 구현은 apps/api/src/services/bot/curriculum-staging.ts 에 있다(경계 제약).
 * 13.6 예약 스케줄러(apps/worker)가 이 타입을 import해 사용한다.
 *
 * 이유: createPostAsBot은 apps/api 도메인 서비스(createPost 등)에 깊이 묶여
 * packages/server-bot으로 이전 불가하므로, 실행 경계(publishChapter 함수)는
 * apps/api에 두고 이 파일은 worker/api 공유 타입 계약만 담는다.
 */

export interface PublishChapterResult {
  status: "published" | "blocked" | "error";
  chapterId: string;
  postId?: string;
  reason?: string;
  continuitySummary?: string | null;
}
