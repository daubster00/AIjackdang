import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("open 이 false 면 렌더링하지 않는다", () => {
    render(
      <Modal open={false} onClose={() => {}} title="제목">
        내용
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open 이 true 면 제목과 본문을 표시한다", () => {
    render(
      <Modal open onClose={() => {}} title="삭제할까요?">
        삭제한 글은 복구할 수 없습니다.
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("삭제할까요?")).toBeInTheDocument();
  });

  it("ESC 키로 onClose 를 호출한다", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="제목">
        내용
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("닫기 버튼으로 onClose 를 호출한다", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="제목">
        내용
      </Modal>,
    );
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalled();
  });
});
