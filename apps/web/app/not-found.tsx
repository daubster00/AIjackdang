import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다 | AI작당",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main
      id="main"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "var(--space-6)",
        padding: "var(--space-8)",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: "6rem",
          fontWeight: "var(--font-weight-bold)",
          color: "var(--color-primary)",
          lineHeight: 1,
          margin: 0,
        }}
      >
        404
      </p>
      <h1
        style={{
          fontSize: "var(--font-size-2xl)",
          fontWeight: "var(--font-weight-bold)",
          color: "var(--color-text)",
          margin: 0,
        }}
      >
        페이지를 찾을 수 없습니다
      </h1>
      <p style={{ color: "var(--color-text-sub)", margin: 0 }}>
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "44px",
          border: "1px solid var(--color-primary)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-primary)",
          padding: "0 var(--space-6)",
          color: "#ffffff",
          fontWeight: "var(--font-weight-semibold)",
          textDecoration: "none",
        }}
      >
        홈으로 돌아가기
      </Link>
    </main>
  );
}
