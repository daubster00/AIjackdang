import { describe, expect, it } from "vitest";
import { randomDelayMs, randomReactionType, shouldSkipComment } from "./reaction-randomizer";

/** 5분(밀리초) — randomDelayMs 기본 하한 */
const MIN_DELAY_MS = 5 * 60 * 1000; // 300_000
/** 4시간(밀리초) — randomDelayMs 기본 상한 */
const MAX_DELAY_MS = 4 * 60 * 60 * 1000; // 14_400_000

describe("randomReactionType", () => {
  it("반환값이 유효한 ReactionType 중 하나다", () => {
    const valid = new Set(["agreement", "question", "rebuttal", "humor", "reaction"]);
    const result = randomReactionType();
    expect(valid.has(result)).toBe(true);
  });

  it("100회 호출 → 5종 모두 최소 1회 등장 (균등 분포 검증)", () => {
    const counts = new Map<string, number>([
      ["agreement", 0],
      ["question", 0],
      ["rebuttal", 0],
      ["humor", 0],
      ["reaction", 0],
    ]);

    for (let i = 0; i < 100; i++) {
      const type = randomReactionType();
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    for (const [type, count] of counts.entries()) {
      expect(count, `${type} 가 0회 — 균등 분포 실패`).toBeGreaterThan(0);
    }
  });
});

describe("randomDelayMs (기본 모드)", () => {
  it("반환값이 5분(300,000ms) 이상이다", () => {
    for (let i = 0; i < 50; i++) {
      expect(randomDelayMs()).toBeGreaterThanOrEqual(MIN_DELAY_MS);
    }
  });

  it("반환값이 4시간(14,400,000ms) 이하이다", () => {
    for (let i = 0; i < 50; i++) {
      expect(randomDelayMs()).toBeLessThanOrEqual(MAX_DELAY_MS);
    }
  });

  it("1분(60,000ms) 미만의 즉답이 없다", () => {
    const ONE_MINUTE_MS = 60 * 1000;
    for (let i = 0; i < 50; i++) {
      expect(randomDelayMs()).toBeGreaterThanOrEqual(ONE_MINUTE_MS);
    }
  });

  it("정수 밀리초 값을 반환한다", () => {
    const result = randomDelayMs();
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("randomDelayMs (allowDayUnit=true)", () => {
  it("1000회 호출 → 일부는 4시간(14,400,000ms) 초과 (일 단위 드물게 검증)", () => {
    const DAY_THRESHOLD_MS = MAX_DELAY_MS; // 4시간 초과 = 일 단위로 간주
    let dayUnitCount = 0;

    for (let i = 0; i < 1000; i++) {
      const delay = randomDelayMs({ allowDayUnit: true });
      if (delay > DAY_THRESHOLD_MS) {
        dayUnitCount++;
      }
    }

    // 10% 확률이므로 1000회 중 50~200회 범위 (±15% 허용)
    expect(dayUnitCount, `일 단위 발생 횟수(${dayUnitCount})가 기대 범위(50~200) 밖`).toBeGreaterThan(
      20,
    );
    expect(dayUnitCount).toBeLessThan(200);
  });

  it("일 단위 지연은 12시간(43,200,000ms) ~ 36시간(129,600,000ms) 범위다", () => {
    const DAY_MIN = 12 * 60 * 60 * 1000;
    const DAY_MAX = 36 * 60 * 60 * 1000;
    const dayUnitDelays: number[] = [];

    // 충분히 많이 호출해서 일 단위 샘플 수집
    for (let i = 0; i < 2000; i++) {
      const delay = randomDelayMs({ allowDayUnit: true });
      if (delay > MAX_DELAY_MS) {
        dayUnitDelays.push(delay);
      }
    }

    // 최소 10개 이상 수집됐을 때 범위 검증
    if (dayUnitDelays.length > 10) {
      for (const delay of dayUnitDelays) {
        expect(delay).toBeGreaterThanOrEqual(DAY_MIN);
        expect(delay).toBeLessThanOrEqual(DAY_MAX);
      }
    }
  });

  it("allowDayUnit=false(기본)일 때 4시간 초과 없음 (50회 샘플)", () => {
    for (let i = 0; i < 50; i++) {
      expect(randomDelayMs({ allowDayUnit: false })).toBeLessThanOrEqual(MAX_DELAY_MS);
    }
  });
});

describe("shouldSkipComment", () => {
  it("1000회 호출 → true가 200~400회 범위 (기본 30% 확률, ±10% 허용)", () => {
    let trueCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldSkipComment()) {
        trueCount++;
      }
    }

    // 기대: 300 ± 100 (±10% = 200~400)
    expect(trueCount, `skip 발생 횟수(${trueCount})가 기대 범위(200~400) 밖`).toBeGreaterThanOrEqual(200);
    expect(trueCount).toBeLessThanOrEqual(400);
  });

  it("probability=0 이면 항상 false", () => {
    for (let i = 0; i < 20; i++) {
      expect(shouldSkipComment(0)).toBe(false);
    }
  });

  it("probability=1 이면 항상 true", () => {
    for (let i = 0; i < 20; i++) {
      expect(shouldSkipComment(1)).toBe(true);
    }
  });

  it("probability=0.5 이면 1000회 중 약 500회 (±15% 허용)", () => {
    let trueCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldSkipComment(0.5)) {
        trueCount++;
      }
    }
    expect(trueCount).toBeGreaterThanOrEqual(350);
    expect(trueCount).toBeLessThanOrEqual(650);
  });
});
