import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("내용을 렌더링한다", () => {
    render(<Badge tone="warning">답변대기</Badge>);
    expect(screen.getByText("답변대기")).toBeInTheDocument();
  });
});
