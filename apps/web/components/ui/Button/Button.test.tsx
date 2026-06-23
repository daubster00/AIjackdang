import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("자식 텍스트를 렌더링한다", () => {
    render(<Button>새 글 작성</Button>);
    expect(screen.getByRole("button", { name: "새 글 작성" })).toBeInTheDocument();
  });

  it("클릭하면 onClick 이 호출된다", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>저장</Button>);
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("loading 상태에서는 클릭이 막히고 aria-busy 가 켜진다", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        등록 중
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    // disabled(pointer-events:none) 버튼이라도 클릭 시도 시 핸들러가 호출되지 않아야 한다.
    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled 상태를 반영한다", () => {
    render(<Button disabled>삭제</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
