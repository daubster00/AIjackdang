/**
 * file-magic.ts 단위 테스트 — Story 4.5
 *
 * 각 허용 확장자에 대해 유효/무효 매직넘버 버퍼를 직접 주입하여 검증.
 * ClamAV/S3 의존성 없음. 순수 Buffer 조작만 사용.
 */

import { describe, it, expect } from "vitest";
import { validateFileSignature, isBinaryContent, ALLOWED_EXTENSIONS } from "./file-magic";

// ── 매직넘버 상수 ─────────────────────────────────────────────────────────────
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const WRONG_MAGIC = Buffer.from([0xff, 0xfe, 0x00, 0x00]);

/** 최소 크기 zip 버퍼(매직넘버 + 더미 데이터) */
function zipBuffer(extraBytes = 20): Buffer {
  return Buffer.concat([ZIP_MAGIC, Buffer.alloc(extraBytes)]);
}

/** 최소 크기 pdf 버퍼 */
function pdfBuffer(extraBytes = 20): Buffer {
  return Buffer.concat([PDF_MAGIC, Buffer.alloc(extraBytes)]);
}

/** 텍스트 내용 버퍼 */
function textBuffer(content: string): Buffer {
  return Buffer.from(content, "utf-8");
}

/** 이진 내용이 포함된 버퍼 (null byte 6% 이상) */
function binaryBuffer(size = 100): Buffer {
  const buf = Buffer.alloc(size, 0x41); // 'A'로 채움
  // null byte를 7% 이상 주입
  for (let i = 0; i < Math.floor(size * 0.08); i++) {
    buf[i * 2] = 0x00;
  }
  return buf;
}

// ── isBinaryContent 테스트 ────────────────────────────────────────────────────

describe("isBinaryContent", () => {
  it("빈 버퍼는 텍스트로 판별한다", () => {
    expect(isBinaryContent(Buffer.alloc(0))).toBe(false);
  });

  it("순수 ASCII 텍스트는 텍스트로 판별한다", () => {
    expect(isBinaryContent(textBuffer("Hello, World!\n"))).toBe(false);
  });

  it("마크다운 텍스트는 텍스트로 판별한다", () => {
    const md = "# 제목\n\n## 내용\n\n- 항목1\n- 항목2\n";
    expect(isBinaryContent(textBuffer(md))).toBe(false);
  });

  it("JSON 문자열은 텍스트로 판별한다", () => {
    const json = '{"key": "value", "number": 42, "array": [1, 2, 3]}';
    expect(isBinaryContent(textBuffer(json))).toBe(false);
  });

  it("탭·LF·CR 포함 텍스트는 텍스트로 판별한다", () => {
    const text = "line1\r\nline2\ttabbed\nline3";
    expect(isBinaryContent(textBuffer(text))).toBe(false);
  });

  it("null byte 비율 8%이상 버퍼는 이진으로 판별한다", () => {
    expect(isBinaryContent(binaryBuffer(200))).toBe(true);
  });

  it("ZIP 매직넘버 버퍼는 이진으로 판별한다", () => {
    expect(isBinaryContent(zipBuffer())).toBe(true);
  });

  it("PDF 매직넘버 버퍼는 이진으로 판별한다", () => {
    expect(isBinaryContent(pdfBuffer())).toBe(true);
  });
});

// ── validateFileSignature — zip ───────────────────────────────────────────────

describe("validateFileSignature: zip", () => {
  it("올바른 ZIP 매직넘버는 통과한다", () => {
    expect(validateFileSignature(zipBuffer(), "zip")).toBe(true);
  });

  it("점이 붙은 확장자 .zip도 통과한다", () => {
    expect(validateFileSignature(zipBuffer(), ".zip")).toBe(true);
  });

  it("대문자 확장자 ZIP도 통과한다", () => {
    expect(validateFileSignature(zipBuffer(), "ZIP")).toBe(true);
  });

  it("잘못된 매직넘버는 실패한다", () => {
    expect(validateFileSignature(Buffer.concat([WRONG_MAGIC, Buffer.alloc(20)]), "zip")).toBe(false);
  });

  it("빈 버퍼는 실패한다", () => {
    expect(validateFileSignature(Buffer.alloc(0), "zip")).toBe(false);
  });

  it("매직넘버보다 짧은 버퍼는 실패한다", () => {
    expect(validateFileSignature(Buffer.from([0x50, 0x4b]), "zip")).toBe(false);
  });
});

// ── validateFileSignature — docx ──────────────────────────────────────────────

describe("validateFileSignature: docx", () => {
  it("올바른 ZIP/docx 매직넘버는 통과한다", () => {
    expect(validateFileSignature(zipBuffer(), "docx")).toBe(true);
  });

  it("잘못된 매직넘버는 실패한다", () => {
    expect(validateFileSignature(Buffer.concat([WRONG_MAGIC, Buffer.alloc(20)]), "docx")).toBe(false);
  });
});

// ── validateFileSignature — xlsx ──────────────────────────────────────────────

describe("validateFileSignature: xlsx", () => {
  it("올바른 ZIP/xlsx 매직넘버는 통과한다", () => {
    expect(validateFileSignature(zipBuffer(), "xlsx")).toBe(true);
  });

  it("잘못된 매직넘버는 실패한다", () => {
    expect(validateFileSignature(Buffer.concat([WRONG_MAGIC, Buffer.alloc(20)]), "xlsx")).toBe(false);
  });
});

// ── validateFileSignature — pdf ───────────────────────────────────────────────

describe("validateFileSignature: pdf", () => {
  it("올바른 PDF 매직넘버는 통과한다", () => {
    expect(validateFileSignature(pdfBuffer(), "pdf")).toBe(true);
  });

  it("점이 붙은 확장자 .pdf도 통과한다", () => {
    expect(validateFileSignature(pdfBuffer(), ".pdf")).toBe(true);
  });

  it("잘못된 매직넘버는 실패한다", () => {
    expect(validateFileSignature(Buffer.concat([WRONG_MAGIC, Buffer.alloc(20)]), "pdf")).toBe(false);
  });

  it("ZIP 매직넘버를 pdf로 검증하면 실패한다", () => {
    expect(validateFileSignature(zipBuffer(), "pdf")).toBe(false);
  });

  it("빈 버퍼는 실패한다", () => {
    expect(validateFileSignature(Buffer.alloc(0), "pdf")).toBe(false);
  });
});

// ── validateFileSignature — md/txt/json (텍스트) ──────────────────────────────

describe("validateFileSignature: md (텍스트)", () => {
  it("마크다운 텍스트는 통과한다", () => {
    const md = "# 제목\n\n내용입니다.\n";
    expect(validateFileSignature(textBuffer(md), "md")).toBe(true);
  });

  it("이진 내용의 .md는 실패한다", () => {
    expect(validateFileSignature(binaryBuffer(200), "md")).toBe(false);
  });

  it("ZIP 버퍼를 md로 검증하면 실패한다 (이진 감지)", () => {
    expect(validateFileSignature(zipBuffer(), "md")).toBe(false);
  });
});

describe("validateFileSignature: txt (텍스트)", () => {
  it("일반 텍스트는 통과한다", () => {
    expect(validateFileSignature(textBuffer("Hello, World!\n"), "txt")).toBe(true);
  });

  it("이진 내용의 .txt는 실패한다", () => {
    expect(validateFileSignature(binaryBuffer(200), "txt")).toBe(false);
  });
});

describe("validateFileSignature: json (텍스트)", () => {
  it("JSON 문자열은 통과한다", () => {
    const json = '{"key": "value"}';
    expect(validateFileSignature(textBuffer(json), "json")).toBe(true);
  });

  it("이진 내용의 .json은 실패한다", () => {
    expect(validateFileSignature(binaryBuffer(200), "json")).toBe(false);
  });
});

// ── 허용되지 않는 확장자 ──────────────────────────────────────────────────────

describe("validateFileSignature: 허용되지 않는 확장자", () => {
  it("exe 확장자는 실패한다", () => {
    expect(validateFileSignature(Buffer.alloc(100), "exe")).toBe(false);
  });

  it("sh 확장자는 실패한다", () => {
    expect(validateFileSignature(textBuffer("#!/bin/bash\n"), "sh")).toBe(false);
  });

  it("php 확장자는 실패한다", () => {
    expect(validateFileSignature(textBuffer("<?php echo 'hello'; ?>"), "php")).toBe(false);
  });

  it("빈 확장자는 실패한다", () => {
    expect(validateFileSignature(Buffer.alloc(10), "")).toBe(false);
  });
});

// ── ALLOWED_EXTENSIONS 내보내기 확인 ─────────────────────────────────────────

describe("ALLOWED_EXTENSIONS", () => {
  it("7개 확장자를 포함한다", () => {
    expect(ALLOWED_EXTENSIONS).toHaveLength(7);
  });

  it("zip, docx, xlsx, pdf, md, txt, json을 포함한다", () => {
    expect(ALLOWED_EXTENSIONS).toContain("zip");
    expect(ALLOWED_EXTENSIONS).toContain("docx");
    expect(ALLOWED_EXTENSIONS).toContain("xlsx");
    expect(ALLOWED_EXTENSIONS).toContain("pdf");
    expect(ALLOWED_EXTENSIONS).toContain("md");
    expect(ALLOWED_EXTENSIONS).toContain("txt");
    expect(ALLOWED_EXTENSIONS).toContain("json");
  });
});
