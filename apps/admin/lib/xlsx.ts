/**
 * Excel (.xlsx) 내보내기 유틸리티.
 *
 * 반드시 클라이언트 컴포넌트("use client")에서 호출해야 한다.
 * (Blob + anchor 다운로드 트리거는 브라우저 전용)
 *
 * @example
 * await downloadXlsx("회원목록", [
 *   { header: "이름", key: "name", width: 20 },
 *   { header: "이메일", key: "email" },
 * ], rows);
 */

import ExcelJS from "exceljs";

export interface XlsxColumn {
  /** 헤더 행에 표시될 컬럼 이름 */
  header: string;
  /** rows 객체에서 값을 읽을 키 */
  key: string;
  /**
   * 컬럼 너비 (엑셀 문자 단위).
   * 미지정 시 최대 콘텐츠 길이 기준 자동 계산 (최소 18, 최대 50).
   */
  width?: number;
}

/**
 * 실제 .xlsx 파일을 생성하고 브라우저 다운로드를 트리거한다.
 *
 * - 헤더 행: 굵은 폰트 + 연한 회색 배경
 * - 컬럼 너비: 명시적 width 또는 최대 콘텐츠 길이 자동 계산 (18~50)
 * - 한국어 텍스트 정상 렌더링 (UTF-8 기반 exceljs)
 *
 * @param filename  다운로드 파일명 (.xlsx 확장자 자동 추가)
 * @param columns   컬럼 정의 배열
 * @param rows      데이터 행 배열 (Record<string, unknown>)
 */
export async function downloadXlsx(
  filename: string,
  columns: XlsxColumn[],
  rows: Record<string, unknown>[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");

  // 컬럼 너비 자동 계산: 헤더 길이와 모든 행의 최대 콘텐츠 길이 중 큰 값
  // (최소 18, 최대 50, +2 여백)
  worksheet.columns = columns.map((col) => {
    let width = col.width;
    if (width === undefined) {
      const maxContentLen = rows.reduce((max, row) => {
        const val = String(row[col.key] ?? "");
        return Math.max(max, val.length);
      }, col.header.length);
      width = Math.min(Math.max(maxContentLen + 2, 18), 50);
    }
    return { header: col.header, key: col.key, width };
  });

  // 헤더 행 스타일: 굵은 폰트 + 연한 회색 배경 (#E2E8F0 = --gray-200)
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  } as ExcelJS.FillPattern;
  headerRow.commit();

  // 데이터 행 추가
  rows.forEach((row) => {
    worksheet.addRow(row);
  });

  // 버퍼 생성 → Blob → 브라우저 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
