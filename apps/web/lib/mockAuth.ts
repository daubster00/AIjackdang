// 데모(목업)용 가짜 로그인 상태 저장소.
//
// 실제 인증 백엔드가 붙기 전까지, 로그인 페이지에서 "로그인"을 누르면
// 이 저장소에 가짜 사용자(MockUser)를 기록하고, 상단 헤더(SiteHeader)가
// 이 값을 읽어 로그인된 화면으로 전환된다.
// localStorage 에 보관하고, 같은 탭 안에서는 커스텀 이벤트로,
// 다른 탭에서는 storage 이벤트로 헤더가 즉시 갱신된다.

import type { RankTier } from "@/lib/ranks";

/** 목업 로그인 사용자 */
export type MockUser = {
  /** 화면에 노출되는 닉네임 */
  nickname: string;
  /** 로그인에 사용한 이메일 */
  email: string;
  /** 사용자 등급 키 (lib/ranks 의 RankTier) */
  rank: RankTier;
};

/** localStorage 보관 키 */
const STORAGE_KEY = "aijakdang.mockUser";

/** 같은 탭 안에서 로그인 상태 변경을 알리는 커스텀 이벤트 이름 */
export const MOCK_AUTH_EVENT = "aijakdang:mock-auth";

/** 현재 저장된 목업 사용자를 읽는다. 없거나 손상되면 null. */
export function readMockUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}

/** 목업 사용자로 로그인 처리(저장 + 헤더 갱신 알림). */
export function setMockUser(user: MockUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(MOCK_AUTH_EVENT));
}

/** 로그아웃 처리(저장 삭제 + 헤더 갱신 알림). */
export function clearMockUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(MOCK_AUTH_EVENT));
}

/**
 * 데모용: 입력한 이메일로 가짜 로그인 사용자를 만든다.
 * 닉네임은 이메일 아이디(@ 앞부분)에서 따오고, 등급은 데모상 "실전러"로 둔다.
 */
export function createMockUserFromEmail(email: string): MockUser {
  const localPart = email.split("@")[0]?.trim() || "작당원";
  const nickname = localPart.charAt(0).toUpperCase() + localPart.slice(1);
  return { nickname, email: email || "guest@aijakdang.com", rank: "practitioner" };
}
