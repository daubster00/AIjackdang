import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 각 테스트 후 렌더링한 DOM 을 정리한다.
afterEach(() => {
  cleanup();
});
