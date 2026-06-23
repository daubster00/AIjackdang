/**
 * LoginGatingModal 테스트 (Story 1.7, Task 7.1).
 * - 열기·닫기(Esc·닫기버튼) 동작
 * - 가치 목록·로그인·가입하기 렌더링
 * - Modal이 포커스 트랩·Esc·배경 스크롤 잠금을 처리함 (Modal.test.tsx에서 검증됨)
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginGatingModal } from "./LoginGatingModal";

// next/navigation usePathname mock
vi.mock("next/navigation", () => ({
  usePathname: () => "/vibe-coding/some-post",
}));

// next/link는 단순 <a>로 처리
vi.mock("next/link", () => ({
  default: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}));

describe("LoginGatingModal", () => {
  it("open=false 이면 렌더링하지 않는다", () => {
    render(<LoginGatingModal open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true 이면 모달을 표시한다", () => {
    render(<LoginGatingModal open onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("AI작당 회원이 되면")).toBeInTheDocument();
  });

  it("가치 목록 3개를 표시한다", () => {
    render(<LoginGatingModal open onClose={() => {}} />);
    expect(screen.getByText("실전자료를 바로 다운로드")).toBeInTheDocument();
    expect(screen.getByText("질문 올리고 답변받기")).toBeInTheDocument();
    expect(screen.getByText("좋아요·댓글로 의견 나누기")).toBeInTheDocument();
  });

  it("[로그인] 버튼이 /login?redirectTo= 링크를 갖는다", () => {
    render(<LoginGatingModal open onClose={() => {}} />);
    const loginLink = screen.getByRole("link", { name: "로그인" }).closest("a");
    expect(loginLink).toHaveAttribute("href", expect.stringContaining("/login?redirectTo="));
  });

  it("[가입하기] 링크가 /signup?redirectTo= 를 갖는다", () => {
    render(<LoginGatingModal open onClose={() => {}} />);
    const signupLink = screen.getByRole("link", { name: "가입하기" });
    expect(signupLink).toHaveAttribute("href", expect.stringContaining("/signup?redirectTo="));
  });

  it("intendedAction이 있으면 redirectTo에 action 힌트가 포함(URL인코딩)된다", () => {
    render(<LoginGatingModal open onClose={() => {}} intendedAction="like" />);
    const loginLink = screen.getByRole("link", { name: "로그인" }).closest("a");
    const href = loginLink?.getAttribute("href") ?? "";
    // redirectTo는 URL-encoded이므로 action%3Dlike 또는 action=like 형태로 포함됨
    expect(href).toMatch(/action/);
    expect(href).toMatch(/like/);
  });

  it("Esc 키로 onClose를 호출한다", async () => {
    const onClose = vi.fn();
    render(<LoginGatingModal open onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("닫기 버튼(Modal 헤더)으로 onClose를 호출한다", async () => {
    const onClose = vi.fn();
    render(<LoginGatingModal open onClose={onClose} />);
    // Modal 헤더의 아이콘 닫기 버튼 (aria-label="닫기")
    const closeBtns = screen.getAllByRole("button", { name: "닫기" });
    // Modal 헤더의 IconButton이 첫 번째
    await userEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("푸터 닫기 버튼으로 onClose를 호출한다", async () => {
    const onClose = vi.fn();
    render(<LoginGatingModal open onClose={onClose} />);
    // 푸터의 "닫기" 텍스트 버튼
    const closeBtns = screen.getAllByRole("button", { name: "닫기" });
    await userEvent.click(closeBtns[closeBtns.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});
