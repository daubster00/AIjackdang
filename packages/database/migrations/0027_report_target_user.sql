-- Story 12.1: report_target_type enum 에 'user' 값 추가 (회원 신고 대상)
-- ALTER TYPE ... ADD VALUE 는 트랜잭션 안에서 실행 불가하므로 단독 statement.
-- 멱등 처리: IF NOT EXISTS 로 이미 존재하면 스킵.
ALTER TYPE "report_target_type" ADD VALUE IF NOT EXISTS 'user';
