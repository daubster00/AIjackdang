/**
 * @ai-jakdang/admin-design-system 의 바닐라 JS 모듈 타입 선언.
 * 패키지는 순수 JS(타입 없음)라서, 관리자 앱에서 import 할 때 필요한 최소 타입만 둔다.
 */
declare module "@ai-jakdang/admin-design-system/js" {
  /** 사이드바·셀렉트·오버레이·토스트·탭·테이블 등 공통 인터랙션을 한 번에 연결한다. */
  export function initAdminUI(root?: Document | HTMLElement): {
    overlay: { open(id: string): void; closeAll(): void };
    toast: (title: string, desc?: string, type?: "success" | "error") => void;
  };
}

declare module "@ai-jakdang/admin-design-system/js/chart.js" {
  /** 차트에 들어가는 한 개의 선(시리즈) 정의. */
  export interface ChartSeries {
    values: number[];
    color: string;
    fill?: string;
  }
  export interface ChartData {
    labels: string[];
    series: ChartSeries[];
  }
  /** canvas 에 선/면적 차트를 그린다. setData 로 데이터 교체 가능. */
  export function createLineChart(
    canvas: HTMLCanvasElement | null,
    initial?: ChartData,
  ): { setData(data: ChartData): void; redraw(): void; destroy(): void };
}
