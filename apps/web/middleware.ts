import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js 미들웨어 (AC #3.1, #6, #7).
 *
 * 보호 경로: 로그인 필요 → /login?redirectTo={경로} 리다이렉트
 * 로그인 경로: 이미 로그인된 경우 → / 리다이렉트
 *
 * 세션 확인: aj_session 쿠키 존재 여부만 체크(Edge에서 DB 조회 불가).
 * 실제 세션 유효성은 API 서버가 최종 판단한다 (project-context §보안).
 *
 * 보호 경로 목록:
 * - /mypage (AC #6.2)
 * - /settings/*
 * - /messages (쪽지)
 * - /notifications (알림)
 */

/** 로그인 필요 경로 패턴 */
const PROTECTED_PATHS = [
  "/mypage",
  "/settings",
  "/messages",
  "/notifications",
  // Story 2.7: 글쓰기 페이지 — 비회원 접근 시 로그인 유도 (AC #1)
  "/vibe-coding/write",
  "/lounge/write",
  "/lounge/talk/write",
  "/lounge/products/write",
  "/monetize/write",
  "/automation/write",
  "/questions/write",
  "/resources/templates/write",
  "/resources/rules/write",
  "/resources/prompts/write",
  "/resources/mcp-skills/write",
];

/** 로그인 상태에서 접근 불가한 경로 (이미 로그인된 경우 홈으로) */
const AUTH_ONLY_PATHS = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // aj_session 쿠키 존재 여부 확인 (Better Auth cookiePrefix=aj_session)
  // 실제 세션 쿠키명은 "aj_session.session_token" 등 Better Auth 내부 명명 규칙 따름
  const hasSession = request.cookies.has("aj_session.session_token") ||
    request.cookies.has("aj_session") ||
    // Better Auth가 사용하는 실제 쿠키명 패턴 확인
    Array.from(request.cookies.getAll()).some((c) => c.name.startsWith("aj_session"));

  // 보호 경로: 로그인 필요
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 로그인 전용 경로: 이미 로그인된 경우 홈으로
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p));
  if (isAuthOnly && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 다음 경로를 제외하고 모든 요청에 미들웨어 적용:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico, 공개 파일들
     * - api 라우트 (API 서버가 처리)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|api/).*)",
  ],
};
