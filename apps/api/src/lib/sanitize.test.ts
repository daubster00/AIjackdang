/**
 * sanitize-html XSS 차단 단위 테스트 — Story 2.6 (AC #5).
 *
 * 5개 이상의 XSS 벡터를 커버하며, FULL_ALLOWED_NODES 가 단일 소스임을 증명한다.
 */

import { describe, expect, it } from "vitest";
import { buildSanitizeOptions, sanitizeHtml } from "./sanitize.js";
import { FULL_ALLOWED_NODES, LITE_ALLOWED_NODES } from "@ai-jakdang/contracts";
import type { AllowedNode } from "@ai-jakdang/contracts";

// ── XSS 벡터 테스트 ────────────────────────────────────────────────────────────

describe("XSS 벡터 차단 (AC #5)", () => {
  it("1. <script> 태그를 완전 제거한다", () => {
    const input = '<p>안녕</p><script>alert(1)</script><p>하세요</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("<p>안녕</p>");
  });

  it("2. img onerror 이벤트 핸들러를 제거하고 허용 속성(src, alt)은 유지한다", () => {
    const input = '<img onerror="alert(1)" src="x" alt="테스트">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert(1)");
    // img 태그는 FULL_ALLOWED_NODES 에 있으므로 src, alt 는 유지됨
    expect(result).toContain('src="x"');
    expect(result).toContain('alt="테스트"');
  });

  it("3. p 태그의 onclick 핸들러를 제거하고 텍스트 콘텐츠는 보존한다", () => {
    const input = '<p onclick="alert(1)">본문 텍스트</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("본문 텍스트");
    expect(result).toContain("<p>");
  });

  it("4. javascript: href 를 가진 <a> 태그를 제거한다", () => {
    const input = '<a href="javascript:alert(1)">클릭</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("alert(1)");
  });

  it("5. <iframe> 태그를 내용째 완전 제거한다", () => {
    const input = '<iframe src="https://evil.com">악성 콘텐츠</iframe>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<iframe");
    expect(result).not.toContain("evil.com");
  });

  it("6. <svg onload> 를 완전 제거한다", () => {
    const input = '<svg onload="alert(1)"><rect width="100" height="100"/></svg>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<svg");
    expect(result).not.toContain("onload");
    expect(result).not.toContain("alert(1)");
  });

  it("7. vbscript: href 를 차단한다", () => {
    const input = '<a href="vbscript:MsgBox(1)">클릭</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("vbscript:");
  });

  it("8. data: href 를 차단한다", () => {
    const input = '<a href="data:text/html,<script>alert(1)</script>">클릭</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("data:text/html");
  });

  it("9. <object> 태그를 제거한다", () => {
    const input = '<object data="https://evil.com/malware.swf"></object>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<object");
  });

  it("10. <form action> 태그를 제거한다", () => {
    const input = '<form action="https://evil.com/steal"><input type="hidden" name="token" value="abc"></form>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
  });
});

// ── 허용된 콘텐츠 보존 테스트 ──────────────────────────────────────────────────

describe("허용된 콘텐츠 보존 (AC #3)", () => {
  it("코드블록 내 특수문자 <, >, & 를 이스케이프 상태 그대로 보존한다", () => {
    // tiptap-renderer 에서 이미 이스케이프된 HTML 이 들어온다고 가정
    const input = '<pre><code class="language-js">const x = 1 &lt; 2 &amp;&amp; 3 &gt; 0;</code></pre>';
    const result = sanitizeHtml(input);
    expect(result).toContain("<pre>");
    expect(result).toContain('<code class="language-js">');
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).toContain("&amp;&amp;");
  });

  it("코드블록 language-* class 를 유지한다", () => {
    const input = '<pre><code class="language-typescript">type Foo = string;</code></pre>';
    const result = sanitizeHtml(input);
    expect(result).toContain('class="language-typescript"');
  });

  it("정상적인 링크(https:) 는 유지한다", () => {
    const input = '<a href="https://example.com" target="_blank" rel="noopener noreferrer">링크</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain("링크");
  });

  it("이미지(img)의 src, alt, title 을 유지한다", () => {
    const input = '<img src="https://example.com/img.png" alt="설명" title="제목">';
    const result = sanitizeHtml(input);
    expect(result).toContain('src="https://example.com/img.png"');
    expect(result).toContain('alt="설명"');
  });

  it("h2·h3·ul·ol·blockquote 태그를 유지한다", () => {
    const input = '<h2>제목</h2><h3>소제목</h3><ul><li>항목</li></ul><blockquote>인용</blockquote>';
    const result = sanitizeHtml(input);
    expect(result).toContain("<h2>");
    expect(result).toContain("<h3>");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>");
    expect(result).toContain("<blockquote>");
  });
});

// ── 단일 소스 원칙 증명 테스트 (AC #2, #6) ────────────────────────────────────

describe("단일 소스 원칙 — FULL_ALLOWED_NODES 동기화 (AC #2, #6)", () => {
  it("buildSanitizeOptions(FULL_ALLOWED_NODES) 의 allowedTags 에 img 가 포함된다", () => {
    const options = buildSanitizeOptions(FULL_ALLOWED_NODES);
    expect(options.allowedTags).toContain("img");
  });

  it("buildSanitizeOptions(FULL_ALLOWED_NODES) 의 allowedTags 에 pre·code 가 포함된다", () => {
    const options = buildSanitizeOptions(FULL_ALLOWED_NODES);
    expect(options.allowedTags).toContain("pre");
    expect(options.allowedTags).toContain("code");
  });

  it("buildSanitizeOptions(FULL_ALLOWED_NODES) 의 allowedTags 에 script·iframe·object 가 없다", () => {
    const options = buildSanitizeOptions(FULL_ALLOWED_NODES);
    expect(options.allowedTags).not.toContain("script");
    expect(options.allowedTags).not.toContain("iframe");
    expect(options.allowedTags).not.toContain("object");
  });

  it("FULL_ALLOWED_NODES 에 codeBlock 이 있으면 allowedTags 에 pre 가 포함된다", () => {
    const nodesWithCodeBlock: AllowedNode[] = [
      { type: "codeBlock", attrs: ["language"] },
    ];
    const options = buildSanitizeOptions(nodesWithCodeBlock);
    // pre 는 기본값으로 항상 포함됨
    expect(options.allowedTags).toContain("pre");
  });

  it("FULL_ALLOWED_NODES 에서 image 를 제거하면 allowedTags 에서 img 가 사라진다", () => {
    const nodesWithoutImage: AllowedNode[] = FULL_ALLOWED_NODES.filter(
      (n) => n.type !== "image",
    );
    const options = buildSanitizeOptions(nodesWithoutImage);
    expect(options.allowedTags).not.toContain("img");
  });

  it("FULL_ALLOWED_NODES 에 link 가 있으면 a 의 href·target·rel 이 allowedAttributes 에 포함된다", () => {
    const options = buildSanitizeOptions(FULL_ALLOWED_NODES);
    const aAttrs = (options.allowedAttributes as Record<string, string[]>)["a"] ?? [];
    expect(aAttrs).toContain("href");
    expect(aAttrs).toContain("target");
    expect(aAttrs).toContain("rel");
  });

  it("LITE_ALLOWED_NODES 로도 buildSanitizeOptions 를 호출할 수 있고 결과가 올바르다", () => {
    const options = buildSanitizeOptions(LITE_ALLOWED_NODES);
    // LITE 에도 codeBlock 이 있으므로 pre·code 는 포함
    expect(options.allowedTags).toContain("pre");
    expect(options.allowedTags).toContain("code");
    // LITE 에는 heading 이 없으므로 h2·h3 미포함
    expect(options.allowedTags).not.toContain("h2");
    expect(options.allowedTags).not.toContain("h3");
  });
});
