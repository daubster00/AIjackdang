import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("label 과 input 을 id 로 연결한다", () => {
    render(<Input label="제목" placeholder="제목을 입력하세요" />);
    const input = screen.getByLabelText("제목");
    expect(input).toBeInTheDocument();
  });

  it("error 가 있으면 aria-invalid 와 메시지를 표시한다", () => {
    render(<Input label="이메일" error="이메일 형식이 올바르지 않습니다" />);
    const input = screen.getByLabelText("이메일");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("이메일 형식이 올바르지 않습니다")).toBeInTheDocument();
  });
});
