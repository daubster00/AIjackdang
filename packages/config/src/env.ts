import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

/**
 * env 단일 진입점 (project-context.md §패키지 경계).
 *
 * 모든 환경변수 접근은 이 파일이 export 하는 `env` 객체로만 한다.
 * 분산 `process.env` 접근 금지 — 누락/형식 오류를 부팅 시점에 한 번에 잡는다.
 *
 * 로딩: 리포 루트의 `.env`를 Node 22 네이티브 `process.loadEnvFile`로
 * best-effort 로드한다. 워크스페이스 하위에서 프로세스가 떠도(`apps/api` 등
 * cwd가 루트가 아니어도) 루트 `.env`를 찾도록 cwd에서 위로 올라가며 탐색한다.
 * 이미 환경에 주입된 값이 우선이며, `.env`가 없으면 무시한다.
 */

// --- .env 로드 (루트 탐색) -------------------------------------------------
/** cwd에서 상위로 올라가며 첫 `.env`(또는 워크스페이스 루트의 `.env`)를 찾는다. */
function findEnvFile(start: string): string | undefined {
  let dir = start;
  for (;;) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    // 워크스페이스 루트(pnpm-workspace.yaml)에 도달하면 더 올라가지 않는다.
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return undefined;
    const parent = dirname(dir);
    if (parent === dir) return undefined; // 파일시스템 루트 도달
    dir = parent;
  }
}

try {
  const envPath = findEnvFile(process.cwd());
  if (envPath) {
    (process as NodeJS.Process & { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(envPath);
  }
} catch {
  // .env 없음/로드 실패 — 환경에 이미 주입된 값으로 진행.
}

// --- 헬퍼 -----------------------------------------------------------------
/** "true"/"1"/"false"/"0" 문자열을 boolean으로 강제(미설정 시 false). */
const boolish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "true" || v === "1");

const portish = z.coerce.number().int().positive();

// --- 스키마 ---------------------------------------------------------------
const envSchema = z
  .object({
    // 공통
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // 필수 그룹
    DATABASE_URL: z.string().min(1, "필수"),
    REDIS_URL: z.string().min(1, "필수"),
    AUTH_SECRET: z.string().min(1, "필수"),

    // 인증 (선택/개발)
    BETTER_AUTH_URL: z.string().url().optional(),
    ADMIN_AUTH_SECRET: z.string().optional(),
    AUTH_DEV_BYPASS: boolish,
    /**
     * 세션 쿠키 도메인 (선택). 예: ".aijackdang.com"
     * 설정 시 유저·관리자 세션 쿠키에 Domain 을 붙여 서브도메인 간 공유(crossSubDomainCookies).
     * 운영에서 web(aijackdang.com)·admin(admin.*)·api(api.*)가 다른 서브도메인이라
     * host-only 쿠키면 SSR 세션 인식이 안 돼 로그인 루프가 생긴다. 미설정 시 host-only(dev).
     */
    COOKIE_DOMAIN: z.string().optional(),

    // 파일 보안 스캔 (ClamAV)
    CLAMD_HOST: z.string().default("localhost"),
    CLAMD_PORT: portish.default(3310),

    // S3 호환 스토리지 (MinIO/R2)
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: boolish,
    S3_BUCKET_PUBLIC: z.string().optional(),
    S3_BUCKET_PRIVATE: z.string().optional(),
    /** 공개 버킷 객체의 외부 접근 베이스 URL. 미설정 시 `${S3_ENDPOINT}/${S3_BUCKET_PUBLIC}` 로 구성.
     *  운영(R2/CDN)에서는 커스텀 도메인을 넣는다. */
    S3_PUBLIC_BASE_URL: z.string().optional(),

    // SMTP (이메일 발송 — worker)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: portish.default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    /** 보내는 사람 주소. 미설정 시 SMTP_USER 를 사용. */
    SMTP_FROM: z.string().optional(),

    // 소셜 OAuth (개발용 앱 credential — 선택)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    NAVER_CLIENT_ID: z.string().optional(),
    NAVER_CLIENT_SECRET: z.string().optional(),
    KAKAO_REST_API_KEY: z.string().optional(),
    KAKAO_CLIENT_SECRET: z.string().optional(),
    /**
     * 카카오 로그인 활성 여부 (ADR-0002 §카카오 정책).
     * 비즈앱(사업자) 검수 완료 후 true 로 전환.
     * 기본값 false — 미검수 상태에서 버튼 비활성 처리에 사용.
     */
    KAKAO_ENABLED: boolish,

    // 로깅 / 네트워크 (선택)
    LOG_LEVEL: z.string().default("info"),
    WEB_PUBLIC_URL: z.string().default("http://localhost:3003"),
    ADMIN_PUBLIC_URL: z.string().default("http://localhost:3004"),
    API_PORT: portish.default(4003),
    API_HOST: z.string().default("0.0.0.0"),

    // ── Epic 11: 시딩 봇 (AI 프로바이더 — 글·댓글·검열·이미지 생성) ──
    // 모든 키는 optional. 미설정 시 부팅은 되고, 해당 기능 사용 시점에 "키 미설정" 에러를 던진다(부분 가동 허용).
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),

    // 검색 (그라운딩)
    GOOGLE_SEARCH_API_KEY: z.string().optional(),
    GOOGLE_SEARCH_CX: z.string().optional(),
    NAVER_SEARCH_CLIENT_ID: z.string().optional(),
    NAVER_SEARCH_CLIENT_SECRET: z.string().optional(),

    // 이미지 스톡 (선택)
    UNSPLASH_ACCESS_KEY: z.string().optional(),
    PEXELS_API_KEY: z.string().optional(),

    // 푸시 알림 (텔레그램 — 키 미설정 시 푸시 비활성, Story 11.18은 키 들어오기 전까지 미가동)
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),

    // 봇 동작 부트스트랩 (런타임 설정은 bot_settings DB가 우선)
    SEEDING_BOT_ENABLED: boolish,
  })
  // production 환경에서 dev-bypass가 켜져 있으면 부팅 차단 (ADR-0001 §6 / 보안 주의).
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === "production" && val.AUTH_DEV_BYPASS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_DEV_BYPASS"],
        message: "production 환경에서는 AUTH_DEV_BYPASS=true 를 사용할 수 없습니다(개발 전용).",
      });
    }
  });

/** 타입 안전한 env 객체. 추론 타입을 외부에서 쓸 때 사용. */
export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join(", ");
    // 명확한 메시지로 부팅 실패 (AC #3)
    throw new Error(`환경변수 오류: [${issues}]`);
  }
  return parsed.data;
}

/**
 * 검증·정규화된 단일 env 객체. import 시점에 한 번 평가된다.
 * 누락/형식 오류 시 위 loadEnv가 throw -> 프로세스 부팅 실패.
 */
export const env: Env = loadEnv();
