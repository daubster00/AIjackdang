/**
 * 이미지 슬롯 안내문 자동 생성 (Story 13.4 AC #3).
 *
 * 슬롯 레코드 저장 시 source_kind(슬롯 출처 종류)별로
 * 관리자용 상세 준비 안내문(guidance)을 자동 생성한다.
 *
 * 순수 함수 — DB 접근 없음, 사이드 이펙트 없음.
 */

/** generateSlotGuidance 입력 타입. */
export interface SlotInput {
  /** 이미지 출처 종류. */
  source_kind: "ai_diagram" | "web_download" | "capture" | "user_upload";
  /** 본문 캡션(출처 표기 포함). */
  caption: string;
  /** ai_diagram용 이미지 생성 프롬프트. */
  diagram_prompt?: string | null;
  /** web_download/capture 원본 URL. */
  source_url?: string | null;
  /** 대략 어느 설명 옆에 배치되는지. */
  position_hint?: string | null;
}

/**
 * source_kind(슬롯 출처 종류)별 관리자용 상세 준비 안내문을 생성한다.
 *
 * - `ai_diagram`   → AI 자동 생성 안내 + 프롬프트
 * - `web_download` → 자동 다운로드 안내 + URL + 캡션
 * - `capture`      → 사람 수동 캡처 안내 + 위치 + 대상
 * - `user_upload`  → 사람 직접 업로드 안내 + 설명 + 위치
 */
export function generateSlotGuidance(slot: SlotInput): string {
  switch (slot.source_kind) {
    case "ai_diagram":
      return (
        `AI(Gemini)가 다음 프롬프트로 도식을 자동 생성합니다.\n` +
        `프롬프트: ${slot.diagram_prompt ?? "(미입력)"}\n` +
        `[관리자에서 '지금 생성' 버튼으로 즉시 실행 가능]`
      );

    case "web_download":
      return (
        `공식문서 URL에서 이미지를 자동 다운로드합니다.\n` +
        `URL: ${slot.source_url ?? "(미입력)"}\n` +
        `캡션(출처): ${slot.caption}`
      );

    case "capture": {
      const target = slot.source_url
        ? `해당 웹 URL ${slot.source_url}`
        : "로컬 데스크톱 (앱 설치·로그인·화면 정돈 필요)";
      return (
        `사람이 다음 환경을 준비한 뒤 캡처를 요청해 주세요.\n` +
        `위치 안내: ${slot.position_hint ?? "(없음)"}\n` +
        `캡처 대상: ${target}`
      );
    }

    case "user_upload":
      return (
        `이 이미지는 사람이 직접 만들어 업로드해야 합니다.\n` +
        `설명: ${slot.caption}\n` +
        `위치: ${slot.position_hint ?? "(없음)"}`
      );
  }
}
