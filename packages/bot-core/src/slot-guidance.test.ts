/**
 * slot-guidance 단위 테스트 — Story 13.4 AC #3
 *
 * generateSlotGuidance source_kind 4종 포맷 검증 + null 필드 fallback 동작.
 */

import { describe, it, expect } from "vitest";
import { generateSlotGuidance } from "./slot-guidance.js";
import type { SlotInput } from "./slot-guidance.js";

// ── ai_diagram ─────────────────────────────────────────────────────────────────

describe("generateSlotGuidance — ai_diagram", () => {
  it("diagram_prompt가 있으면 안내문에 포함한다", () => {
    const slot: SlotInput = {
      source_kind: "ai_diagram",
      caption: "테스트 캡션",
      diagram_prompt: "left-to-right flow labeled '자연어 지시'",
    };
    const result = generateSlotGuidance(slot);
    expect(result).toContain("AI(Gemini)가 다음 프롬프트로 도식을 자동 생성합니다.");
    expect(result).toContain("프롬프트: left-to-right flow labeled '자연어 지시'");
    expect(result).toContain("지금 생성");
  });

  it("diagram_prompt null 시 (미입력) fallback을 표시한다", () => {
    const slot: SlotInput = {
      source_kind: "ai_diagram",
      caption: "캡션",
      diagram_prompt: null,
    };
    const result = generateSlotGuidance(slot);
    expect(result).toContain("프롬프트: (미입력)");
  });

  it("diagram_prompt undefined 시 (미입력) fallback을 표시한다", () => {
    const slot: SlotInput = {
      source_kind: "ai_diagram",
      caption: "캡션",
    };
    const result = generateSlotGuidance(slot);
    expect(result).toContain("프롬프트: (미입력)");
  });
});

// ── web_download ───────────────────────────────────────────────────────────────

describe("generateSlotGuidance — web_download", () => {
  it("source_url과 caption을 모두 포함한다", () => {
    const slot: SlotInput = {
      source_kind: "web_download",
      caption: "Make 공식 도움말",
      source_url: "https://archbee-image-uploads.s3.amazonaws.com/example.png",
    };
    const result = generateSlotGuidance(slot);
    expect(result).toContain("공식문서 URL에서 이미지를 자동 다운로드합니다.");
    expect(result).toContain("URL: https://archbee-image-uploads.s3.amazonaws.com/example.png");
    expect(result).toContain("캡션(출처): Make 공식 도움말");
  });

  it("source_url null 시 (미입력) fallback을 표시한다", () => {
    const slot: SlotInput = {
      source_kind: "web_download",
      caption: "캡션",
      source_url: null,
    };
    const result = generateSlotGuidance(slot);
    expect(result).toContain("URL: (미입력)");
  });
});

// ── capture ────────────────────────────────────────────────────────────────────

describe("generateSlotGuidance — capture", () => {
  it("source_url이 있으면 웹 URL을 캡처 대상으로 표기한다", () => {
    const slot: SlotInput = {
      source_kind: "capture",
      caption: "시나리오 편집기 화면",
      source_url: "https://make.com/scenario-editor",
      position_hint: "3번째 단계 옆",
    };
    const result = generateSlotGuidance(slot);
    expect(result).toContain("사람이 다음 환경을 준비한 뒤 캡처를 요청해 주세요.");
    expect(result).toContain("위치 안내: 3번째 단계 옆");
    expect(result).toContain("캡처 대상: 해당 웹 URL https://make.com/scenario-editor");
  });

  it("source_url 없으면 로컬 데스크톱 안내, position_hint null 시 (없음) fallback", () => {
    const slot: SlotInput = {
      source_kind: "capture",
      caption: "터미널 출력 화면",
      source_url: null,
      position_hint: null,
    };
    const result = generateSlotGuidance(slot);
    expect(result).toContain("위치 안내: (없음)");
    expect(result).toContain("로컬 데스크톱 (앱 설치·로그인·화면 정돈 필요)");
  });
});

// ── user_upload ────────────────────────────────────────────────────────────────

describe("generateSlotGuidance — user_upload", () => {
  it("caption과 position_hint를 포함한다", () => {
    const slot: SlotInput = {
      source_kind: "user_upload",
      caption: "직접 제작한 인포그래픽",
      position_hint: "본문 2번째 단락 뒤",
    };
    const result = generateSlotGuidance(slot);
    expect(result).toContain("이 이미지는 사람이 직접 만들어 업로드해야 합니다.");
    expect(result).toContain("설명: 직접 제작한 인포그래픽");
    expect(result).toContain("위치: 본문 2번째 단락 뒤");
  });

  it("position_hint null 시 (없음) fallback을 표시한다", () => {
    const slot: SlotInput = {
      source_kind: "user_upload",
      caption: "캡션",
      position_hint: null,
    };
    const result = generateSlotGuidance(slot);
    expect(result).toContain("위치: (없음)");
  });
});
