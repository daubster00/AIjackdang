/**
 * 봇 워커 프로세서 로컬 타입 정의 — Story 11.10
 *
 * 임시 정의: packages/contracts/src/bot.ts (Story 11.2 완료 시) 로 이전 예정.
 * 이 스토리 범위에서는 11.2가 완료된 상태이므로 로컬 타입으로 유지.
 *
 * TODO: 11.2 contracts 통합 후 이 파일 제거 + @ai-jakdang/contracts에서 import
 */

/**
 * `bot.comment` BullMQ 잡 페이로드.
 *
 * - `jobId`는 포함하지 않는다 — 프로세서 진입 시 bot_generation_jobs INSERT 후 확보.
 * - 캐릭터(persona) 선택은 프로세서 내부에서 랜덤으로 결정한다.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §2.7 bot_generation_jobs 스키마]
 */
export interface BotCommentJobPayload {
  /** 댓글을 달 게시글 ID */
  targetPostId: string;
  /** 게시판 슬러그 (검열 강도 결정용) */
  targetBoard: string;
  /** 대댓글인 경우 부모 댓글 ID (없으면 최상위 댓글) */
  parentCommentId?: string;
}
