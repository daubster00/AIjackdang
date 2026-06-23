/**
 * useGating 훅 테스트 (Story 1.7, Task 7.2).
 * - 로그인 시 requireAuth() → true, 모달 미열림
 * - 비로그인 시 requireAuth() → false, 모달 열림
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GatingProvider } from "@/contexts/GatingContext";
import { useGating } from "./useGating";
import type { AuthUser } from "./useAuth";

// next/navigation usePathname mock
vi.mock("next/navigation", () => ({
  usePathname: () => "/vibe-coding/some-post",
}));

// next/link mock
vi.mock("next/link", () => ({
  default: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}));

// useAuth mock - 테스트별로 user 값을 제어
const mockUseAuth = vi.fn();
vi.mock("./useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

/** requireAuth를 호출하고 결과를 표시하는 테스트 컴포넌트 */
function TestComponent({ action }: { action?: string }) {
  const { requireAuth } = useGating();
  return (
    <button
      type="button"
      onClick={() => {
        const result = requireAuth(action);
        // 결과를 data-result 속성에 기록
        const btn = document.getElementById("result");
        if (btn) btn.setAttribute("data-result", String(result));
      }}
    >
      행동시도
      <span id="result" />
    </button>
  );
}

function renderWithGating(action?: string) {
  return render(
    <GatingProvider>
      <TestComponent action={action} />
    </GatingProvider>,
  );
}

describe("useGating", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("로그인 상태: requireAuth() → true, 모달 미열림", async () => {
    const mockUser = { id: "user-1", email: "test@example.com" } as AuthUser;
    mockUseAuth.mockReturnValue({ user: mockUser, ready: true, logout: vi.fn(), refresh: vi.fn() });

    renderWithGating("like");

    await userEvent.click(screen.getByRole("button", { name: /행동시도/ }));

    // 로그인 유도 모달이 열리지 않아야 함
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // result 속성이 "true"
    expect(screen.getByText(/행동시도/).closest("button")?.querySelector("#result")?.getAttribute("data-result")).toBe("true");
  });

  it("비로그인 상태: requireAuth() → false, 모달 열림", async () => {
    mockUseAuth.mockReturnValue({ user: null, ready: true, logout: vi.fn(), refresh: vi.fn() });

    renderWithGating("like");

    await userEvent.click(screen.getByRole("button", { name: /행동시도/ }));

    // 로그인 유도 모달이 열려야 함
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("AI작당 회원이 되면")).toBeInTheDocument();
  });

  it("모달에서 닫기 버튼 클릭 시 모달이 닫힌다", async () => {
    mockUseAuth.mockReturnValue({ user: null, ready: true, logout: vi.fn(), refresh: vi.fn() });

    renderWithGating();

    await userEvent.click(screen.getByRole("button", { name: /행동시도/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // 닫기 버튼이 2개(Modal 헤더 IconButton + 푸터 닫기 Button)이므로 첫 번째 사용
    const closeBtns = screen.getAllByRole("button", { name: "닫기" });
    await userEvent.click(closeBtns[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
