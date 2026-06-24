import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];
const PROTECTED_PATHS = [
  "/dashboard",
  "/posts",
  "/qna",
  "/resources",
  "/comments",
  "/reports",
  "/inquiries",
  "/members",
  "/points",
  "/ranks",
  "/ads",
  "/settings",
  "/admin-members",
  "/analytics",
  "/stats",
  "/messages",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("aj_admin_session");
  const isAuthenticated = !!sessionCookie?.value;

  // 루트 접근 — 인증 여부에 따라 dashboard 또는 login으로 리다이렉트
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isAuthenticated ? "/dashboard" : "/login", request.url),
    );
  }

  // 보호된 경로: 인증 없으면 /login으로 리다이렉트
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isProtected && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 이미 로그인된 상태에서 /login, /signup 접근 → /dashboard
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/dashboard/:path*",
    "/posts/:path*",
    "/qna/:path*",
    "/resources/:path*",
    "/comments/:path*",
    "/reports/:path*",
    "/inquiries/:path*",
    "/members/:path*",
    "/points/:path*",
    "/ranks/:path*",
    "/ads/:path*",
    "/settings/:path*",
    "/admin-members/:path*",
    "/analytics/:path*",
    "/stats/:path*",
    "/messages/:path*",
  ],
};
