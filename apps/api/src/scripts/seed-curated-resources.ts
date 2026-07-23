/**
 * 실전자료 큐레이션 고품질 원고 시드/업데이트 스크립트.
 *
 * 배경: 봇 자동 큐레이션이 검색 스니펫 2~3줄만 근거로 얕은 "이런 게 있다더라" 소개글을
 * 찍어내고 있어(사용법 비어있음·출처가 잡블로그·"직접 찾아보라"로 끝남), 실전자료 게시판이
 * "당장 써먹을 자료를 상세하고 쉽게 소개 + 다운로드"라는 목적을 못 채우고 있었다.
 *
 * 이 스크립트는 운영자(=AI작당지기 봇 명의)가 직접 손으로 쓴 고품질 원고를 반영한다.
 *  - Tiptap JSON을 직접 조립한다(마크다운 파서는 리스트·링크·굵게를 버리므로 사용하지 않음).
 *  - 신규(create): createResource 도메인 서비스 경유(slug·썸네일·포인트·태그 부수효과 동일).
 *  - 재작성(update): 기존 행의 본문·요약·제목·참고링크만 교체(slug/조회수/URL 보존).
 *    revive=true 면 status='published'로 되살린다(soft-deleted 개념글 부활).
 *  - 중복 정리(delete): 지정 slug를 status='deleted' 처리.
 *  - 파일 첨부: GitHub 저장소 zip(fetchCuratedResourceFile) 또는 직접 쓴 텍스트 파일(localFile).
 *    이미 활성 파일이 있으면 건너뛴다(재실행 안전).
 *  - 표지 썸네일: coverPrompt가 있으면 genImage로 1장 생성 → 공개버킷 업로드 → thumbnail_url.
 *    thumbnail_url이 이미 있으면 건너뛴다(FORCE_COVER=1로 강제 재생성).
 *
 * 실행(운영 — prod DB·MinIO에 실제 반영):
 *   docker cp apps/api/src/scripts/seed-curated-resources.ts deploy-api-1:/app/apps/api/src/scripts/
 *   docker exec -w /app/apps/api [-e DRY_RUN=1] [-e ONLY=github-mcp] [-e FORCE_COVER=1] \
 *     deploy-api-1 /app/node_modules/.bin/tsx src/scripts/seed-curated-resources.ts
 *
 * 환경변수:
 *   DRY_RUN=1     → DB/이미지 생성을 건드리지 않고 무엇을 할지만 출력.
 *   ONLY=a,b      → 지정한 key만 처리(쉼표 구분). 없으면 enabled=true 전부.
 *   FORCE_COVER=1 → thumbnail_url이 이미 있어도 표지를 새로 생성.
 *   SKIP_COVER=1  → 표지 생성 전면 생략(본문·파일만).
 */

import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { and, eq } from "drizzle-orm";
import { createResource } from "../routes/v1/resources/write.service.js";
import { uploadResourceFiles } from "../routes/v1/resources/upload.service.js";
import { fetchCuratedResourceFile } from "../services/bot/resource-file-fetch.js";
import { uploadImage } from "../services/storage/index.js";
import { genImage } from "@ai-jakdang/server-bot/image";
import type { CuratedFileSource } from "@ai-jakdang/server-bot/search";

// ── 운영 큐레이터 봇 (AI작당지기) ────────────────────────────────────────────────
const CURATOR_USER_ID = "a702a2f7-ad9d-4a3e-b1a1-505c859c5614";

// ── Tiptap JSON 빌더 ─────────────────────────────────────────────────────────────
// 마크다운 파서(_tiptap-parser)는 리스트·링크·굵게를 평문으로 버리므로, 렌더러가
// 살리는 노드(heading/bulletList/orderedList/link/bold/code/codeBlock)를 직접 만든다.

type Node = Record<string, unknown>;
type Inline = string | Node;

function inlines(parts: Inline[]): Node[] {
  return parts.map((p) => (typeof p === "string" ? { type: "text", text: p } : p));
}
function b(text: string): Node {
  return { type: "text", text, marks: [{ type: "bold" }] };
}
function code(text: string): Node {
  return { type: "text", text, marks: [{ type: "code" }] };
}
function a(text: string, href: string): Node {
  return {
    type: "text",
    text,
    marks: [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } }],
  };
}
function h2(text: string): Node {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}
function p(...parts: Inline[]): Node {
  return { type: "paragraph", content: inlines(parts) };
}
function gap(): Node {
  return { type: "paragraph" };
}
function li(parts: Inline[]): Node {
  return { type: "listItem", content: [{ type: "paragraph", content: inlines(parts) }] };
}
function ul(items: Inline[][]): Node {
  return { type: "bulletList", content: items.map(li) };
}
function codeBlock(language: string, text: string): Node {
  return {
    type: "codeBlock",
    attrs: language ? { language } : {},
    content: [{ type: "text", text }],
  };
}
function doc(blocks: Node[]): Record<string, unknown> {
  return { type: "doc", content: blocks };
}

// ── 자료 스펙 타입 ───────────────────────────────────────────────────────────────

type ResourceType =
  | "prompt"
  | "claude-code-skill"
  | "mcp"
  | "rules-config"
  | "template-checklist";

interface Spec {
  key: string;
  enabled: boolean;
  op: "create" | "update" | "delete";
  slug?: string;
  /** update 대상이 soft-deleted면 published로 되살린다. */
  revive?: boolean;
  title?: string;
  summary?: string;
  resourceType?: ResourceType;
  difficulty?: "beginner" | "intermediate" | "advanced";
  environment?: string[];
  tags?: string[];
  version?: string;
  referenceLinks?: { label: string; url: string }[];
  description?: Record<string, unknown>;
  /** GitHub 저장소 zip 첨부. */
  fileSource?: CuratedFileSource;
  /** 직접 쓴 텍스트 파일 첨부(SKILL.md 등). */
  localFile?: { name: string; content: string; mimetype: string };
  /** 표지 썸네일 생성 프롬프트(영문·상징·실사, no text/logos). */
  coverPrompt?: string;
}

function cover(concept: string): string {
  return `A clean, modern, symbolic header illustration representing ${concept}. Realistic yet conceptual, minimal, professional composition, soft studio lighting, tasteful color palette. Absolutely no text, no letters, no logos, no UI screenshots, no charts, no diagrams, no watermarks.`;
}

// ── 원고 ─────────────────────────────────────────────────────────────────────────

const SPECS: Spec[] = [
  // ═══ MCP ═══════════════════════════════════════════════════════════════════════

  // Context7 MCP (재작성 — 표지 이미지 채우기 위해 재적용)
  {
    key: "context7-mcp",
    enabled: true,
    op: "update",
    slug: "최신-문서-연결용-context7-mcp-소개",
    title: "Context7 MCP — 최신 공식 문서를 AI에 실시간으로 물려주는 서버",
    summary:
      "AI가 옛날 버전 문법으로 코드를 짜서 에러날 때. Context7을 붙이면 라이브러리 공식 문서 최신판을 그때그때 프롬프트에 넣어줘서, 존재하지 않는 API를 지어내는 문제를 크게 줄인다. 설치 한 줄, 프롬프트에 'use context7' 한 마디면 끝.",
    resourceType: "mcp",
    difficulty: "beginner",
    environment: ["Claude Code", "Cursor", "Windsurf"],
    tags: ["MCP", "Context7", "문서", "최신문서", "Upstash"],
    version: "MCP 서버",
    referenceLinks: [
      { label: "Context7 공식 GitHub (upstash/context7)", url: "https://github.com/upstash/context7" },
      { label: "Context7 대시보드 — 무료 API 키 발급", url: "https://context7.com/dashboard" },
    ],
    fileSource: { kind: "github-repo", owner: "upstash", repo: "context7", label: "upstash/context7" },
    coverPrompt: cover(
      "up-to-date official documentation flowing in real time into an AI coding assistant, fresh knowledge streaming into code",
    ),
    description: doc([
      p(
        "AI로 코딩하다 보면 이런 일이 잦다. 분명 시키는 대로 짰다는데 실행하면 에러가 나고, 알고 보니 그 라이브러리가 1~2년 전에 바꾼 옛날 문법을 쓰고 있거나, 아예 존재하지도 않는 함수를 그럴듯하게 지어낸 경우다. 모델이 학습한 시점 이후에 나온 최신 버전을 모르기 때문이다.",
      ),
      gap(),
      p(
        "Context7은 바로 이 문제를 겨냥한 MCP 서버다. 라이브러리의 ",
        b("공식 문서와 코드 예제 최신판"),
        "을, 쓰는 그 순간에 AI의 프롬프트 안으로 직접 끌어와 준다. 그래서 AI가 '기억'에 의존해 옛날 코드를 뱉는 대신, 지금 그 버전의 실제 문서를 보고 답하게 된다.",
      ),
      h2("한마디로 정리하면"),
      ul([
        ["AI에게 '최신 공식 문서를 실시간으로 붙여주는' MCP 서버다."],
        ["Next.js·React·Supabase 같은 라이브러리의 현재 버전 문서와 예제를 그때그때 가져온다."],
        ["설치 후 프롬프트 끝에 ", code("use context7"), "만 붙이면 동작한다."],
        ["Upstash가 공개한 오픈소스이고, 개발자들이 가장 많이 추천하는 MCP 중 하나로 꼽힌다."],
      ]),
      h2("이런 상황에서 특히 좋다"),
      ul([
        ["새로 나온 프레임워크 버전으로 짜야 하는데 AI가 자꾸 옛 문법을 쓸 때"],
        ["AI가 만든 코드에서 '그런 함수 없다'는 에러가 반복될 때"],
        ["공식 문서를 매번 직접 열어 복붙해 넣어주기 번거로울 때"],
      ]),
      h2("설치와 연결"),
      p(
        "가장 쉬운 방법은 자동 설치 명령 한 줄이다. OAuth 로그인 → API 키 발급 → 사용 중인 도구(Claude Code·Cursor 등)에 맞는 설정까지 알아서 해준다.",
      ),
      codeBlock("bash", "npx ctx7 setup"),
      p(
        "직접 설정 파일에 넣고 싶다면, MCP 설정에 아래 원격 서버를 추가하면 된다. MCP를 지원하는 도구(Claude Code·Cursor·Windsurf 등) 공통 형식이다.",
      ),
      codeBlock(
        "json",
        `{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "여기에_발급받은_키"
      }
    }
  }
}`,
      ),
      p(
        "API 키는 없어도 동작하지만, ",
        a("context7.com/dashboard", "https://context7.com/dashboard"),
        "에서 무료로 발급받아 넣으면 요청 한도가 넉넉해진다. Node.js는 18 버전 이상이 필요하다.",
      ),
      h2("쓰는 법"),
      p(
        "설치했다면 사용법은 정말 간단하다. 평소처럼 요청을 쓰고, 문장 끝에 ",
        code("use context7"),
        " 한 마디만 덧붙이면 된다.",
      ),
      codeBlock("text", "Next.js 15 App Router로 로그인 미들웨어 만들어줘. use context7"),
      p("특정 라이브러리를 콕 집어 지정할 수도 있다."),
      codeBlock("text", "Supabase 인증 붙이는 코드 짜줘. use library /supabase/supabase for API and docs"),
      p(
        "그러면 Context7이 해당 라이브러리의 현재 문서를 긁어와 프롬프트에 넣고, AI는 그걸 근거로 최신 문법의 코드를 만들어 준다.",
      ),
      h2("주의할 점"),
      ul([
        ["만능은 아니다. 문서가 잘 정리된 유명 라이브러리일수록 효과가 크고, 문서가 부실한 도구는 가져올 내용도 적다."],
        [code("use context7"), "을 안 붙이면 평소처럼 동작한다. 최신 문서가 필요할 때만 붙이면 된다."],
        ["원격 서버(mcp.context7.com)를 쓰므로 인터넷 연결이 필요하다."],
      ]),
      h2("출처와 다운로드"),
      p(
        "아래 참고링크의 공식 GitHub에서 전체 소스와 최신 설치법을 확인할 수 있다. 이 글 하단 첨부파일로 저장소 전체를 zip으로 받아 볼 수도 있다.",
      ),
    ]),
  },

  // MCP 개념 (soft-deleted 개념글 부활 + 재작성)
  {
    key: "mcp-concept",
    enabled: true,
    op: "update",
    revive: true,
    slug: "mcp-서버란-무엇인가-초보자를-위한-개념과-원리-정리",
    title: "MCP가 뭔가요? — AI에 도구를 꽂는 'USB 단자' 쉽게 이해하기",
    summary:
      "요즘 MCP MCP 하는데 정확히 뭔지 모르겠는 분들을 위한 개념 정리. MCP는 AI에게 파일·깃허브·슬랙 같은 외부 도구를 꽂아주는 '공용 단자'다. 왜 필요한지, 어떻게 동작하는지, 무엇부터 깔면 되는지를 예시로 풀었다.",
    resourceType: "mcp",
    difficulty: "beginner",
    environment: ["Claude Code", "Cursor", "공통"],
    tags: ["MCP", "개념", "입문", "기초"],
    version: "개념 정리",
    referenceLinks: [
      { label: "Model Context Protocol 공식 사이트", url: "https://modelcontextprotocol.io" },
      { label: "공식 MCP 서버 모음 (modelcontextprotocol/servers)", url: "https://github.com/modelcontextprotocol/servers" },
    ],
    coverPrompt: cover(
      "the idea of connecting an AI assistant to many external tools and data sources through one universal port or adapter",
    ),
    description: doc([
      p(
        "AI에게 '내 컴퓨터 파일 좀 읽어봐', '이 깃허브 이슈 정리해줘', '슬랙에 올려줘' 같은 걸 시키려면, AI가 그 도구들과 '대화'할 수 있어야 한다. 문제는 도구마다 연결 방식이 제각각이라는 것이다. 예전에는 도구 하나 붙일 때마다 그 도구 전용 연동 코드를 따로 만들어야 했다.",
      ),
      gap(),
      p(
        b("MCP(Model Context Protocol)"),
        "는 이걸 표준화한 '공용 규격'이다. 쉽게 말하면 ",
        b("AI와 외부 도구 사이의 USB 단자"),
        "다. USB가 나오면서 마우스든 키보드든 같은 구멍에 꽂으면 되듯, MCP를 지원하면 어떤 도구든 같은 방식으로 AI에 꽂을 수 있다.",
      ),
      h2("한마디로 정리하면"),
      ul([
        ["AI가 외부 도구·데이터에 접근하는 방식을 통일한 '표준 규격'이다."],
        ["도구 쪽에서 'MCP 서버'를 하나 만들어 두면, MCP를 지원하는 어떤 AI 도구(Claude Code·Cursor 등)에서든 바로 쓸 수 있다."],
        ["Anthropic이 2024년 말 공개했고, 지금은 사실상 업계 표준처럼 퍼지는 중이다."],
      ]),
      h2("왜 필요할까"),
      p(
        "AI 모델 자체는 '똑똑한 두뇌'지만 손발이 없다. 내 파일도 못 보고, 인터넷도 못 뒤지고, 슬랙에 글도 못 올린다. MCP 서버는 그 두뇌에 붙이는 ",
        b("손발"),
        "이다. 예를 들어:",
      ),
      ul([
        ["파일시스템 MCP를 꽂으면 → AI가 내 프로젝트 폴더의 파일을 읽고 고친다."],
        ["GitHub MCP를 꽂으면 → AI가 이슈를 만들고 PR을 정리한다."],
        ["Slack MCP를 꽂으면 → AI가 채널 대화를 읽고 메시지를 보낸다."],
      ]),
      p("도구마다 따로 개발할 필요 없이, MCP라는 같은 규격으로 전부 연결된다는 게 핵심이다."),
      h2("어떻게 동작하나"),
      p(
        "구조는 단순하다. 내 AI 도구(예: Claude Code)가 ",
        b("MCP 클라이언트"),
        ", 각 도구가 ",
        b("MCP 서버"),
        "다. 둘은 정해진 규격으로 대화한다. 서버는 자기가 할 수 있는 일(예: '파일 읽기', '이슈 생성')의 목록을 알려주고, AI가 필요할 때 그 기능을 골라 호출한다.",
      ),
      p("MCP 서버는 보통 두 가지 형태다."),
      ul([
        [b("로컬 실행형"), " — 내 컴퓨터에서 프로그램으로 돌아간다. 보통 ", code("npx"), " 명령 한 줄로 실행한다."],
        [b("원격 호스팅형"), " — 제공사가 운영하는 서버에 URL로 접속한다. 설치 없이 주소만 넣으면 된다."],
      ]),
      h2("무엇부터 시작하면 좋을까"),
      p(
        "처음이라면 공식 레퍼런스 서버부터 써보는 걸 추천한다. Anthropic이 직접 만든 기본 서버 묶음(파일시스템·웹 가져오기·메모리 등)이 있어 안전하고 예제가 많다. 아래 참고링크의 공식 저장소에서 시작할 수 있다.",
      ),
      p(
        "이 게시판에도 Playwright(브라우저 자동화), GitHub, Slack, Context7(최신 문서) 같은 유명 MCP 서버를 각각 상세히 소개해 두었으니, 관심 가는 것부터 하나씩 꽂아 보면 된다.",
      ),
      h2("정리"),
      p(
        "MCP는 '새로운 AI'가 아니라 '연결 규격'이다. 어렵게 생각할 것 없이, AI에 기능을 꽂는 표준 단자라고 이해하면 충분하다. 어떤 MCP 서버를 꽂느냐에 따라 AI가 할 수 있는 일이 늘어난다.",
      ),
    ]),
  },

  // 공식 MCP 서버 레퍼런스 모음 (재작성) — servers-main.zip 기첨부
  {
    key: "official-servers",
    enabled: true,
    op: "update",
    slug: "공식-mcp-서버-레퍼런스-모음",
    title: "공식 MCP 레퍼런스 서버 모음 (modelcontextprotocol/servers)",
    summary:
      "MCP를 만든 Anthropic이 직접 관리하는 '기본 서버 세트'. 파일 다루기, 웹 가져오기, git, 메모리, 순차적 사고 등 어디서나 쓰는 뼈대 기능을 npx 한 줄로 붙일 수 있다. MCP를 처음 시작할 때 가장 먼저 볼 저장소.",
    resourceType: "mcp",
    difficulty: "beginner",
    environment: ["Claude Code", "Cursor", "공통"],
    tags: ["MCP", "공식", "레퍼런스", "파일시스템", "기초"],
    version: "공식 레퍼런스",
    referenceLinks: [
      { label: "modelcontextprotocol/servers 공식 GitHub", url: "https://github.com/modelcontextprotocol/servers" },
      { label: "Model Context Protocol 공식 사이트", url: "https://modelcontextprotocol.io" },
    ],
    fileSource: { kind: "github-repo", owner: "modelcontextprotocol", repo: "servers", label: "modelcontextprotocol/servers" },
    coverPrompt: cover(
      "a collection of official building-block connectors for an AI assistant — files, version control, memory, web access — arranged neatly like modular blocks",
    ),
    description: doc([
      p(
        "MCP 서버를 하나 골라 써보고 싶은데 뭐부터 시작할지 막막하다면, 여기가 정답이다. MCP를 만든 Anthropic이 직접 관리하는 ",
        b("공식 레퍼런스 서버 모음"),
        "이다. '이런 식으로 MCP 서버를 만들면 된다'를 보여주는 본보기이자, 실제로 바로 쓰는 기본 도구 세트다.",
      ),
      h2("지금 들어있는 공식 서버"),
      p("2026년 기준, 이 저장소가 직접 관리하는 현재 레퍼런스 서버는 다음과 같다."),
      ul([
        [code("Filesystem"), " — 지정한 폴더의 파일을 읽고 쓰고 검색"],
        [code("Fetch"), " — 웹 페이지를 가져와 AI가 읽기 좋은 형태로 변환"],
        [code("Git"), " — 로컬 git 저장소의 커밋·변경 내역 조회·조작"],
        [code("Memory"), " — 대화 사이에 정보를 기억해 두는 지식 그래프"],
        [code("Sequential Thinking"), " — 복잡한 문제를 단계로 쪼개 생각하도록 돕기"],
        [code("Time"), " — 시간·시간대 변환"],
        [code("Everything"), " — MCP의 모든 기능을 시험해 보는 데모/테스트용 서버"],
      ]),
      p(
        "참고로 예전에 여기 있던 GitHub·Slack·Google Drive·Puppeteer 등은 별도 저장소(servers-archived)나 각 제공사의 공식 서버로 옮겨졌다. 그 도구들은 이제 각자의 최신 서버를 쓰는 게 맞다.",
      ),
      h2("왜 여기서 시작해야 하나"),
      ul([
        ["공식이라 신뢰할 수 있고, 문서·예제가 가장 잘 정리돼 있다."],
        ["Filesystem·Fetch만 붙여도 'AI가 내 파일 읽고 웹 자료 가져오기'가 바로 된다."],
        ["직접 MCP 서버를 만들고 싶을 때, 이 코드가 그대로 교과서가 된다."],
      ]),
      h2("설치와 연결"),
      p("대부분 설치 없이 npx로 바로 실행한다. 예를 들어 Memory 서버는 이렇게 붙인다."),
      codeBlock(
        "json",
        `{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/내/작업/폴더/경로"]
    }
  }
}`,
      ),
      p(
        "Claude Code라면 명령 한 줄로도 추가할 수 있다. 서버 이름과 실행 명령만 넘기면 된다.",
      ),
      codeBlock(
        "bash",
        "claude mcp add memory npx -y @modelcontextprotocol/server-memory",
      ),
      p(
        "Filesystem은 접근을 허용할 폴더 경로를 반드시 지정해야 한다. 그 폴더 밖은 건드리지 못하게 막는 안전장치다.",
      ),
      h2("주의할 점"),
      ul([
        ["Filesystem에 넘긴 폴더 안은 AI가 수정·삭제할 수 있으니, 중요한 폴더는 신중히 지정한다."],
        ["파이썬 서버(예: git)는 npx 대신 ", code("uvx mcp-server-git"), " 형태로 실행한다."],
        ["archived로 옮겨간 옛 서버 이름은 더 이상 최신이 아닐 수 있다. 새 프로젝트는 현재 목록의 서버를 쓴다."],
      ]),
      h2("출처와 다운로드"),
      p(
        "아래 참고링크의 공식 GitHub에서 각 서버의 설정법을 볼 수 있고, 하단 첨부파일로 저장소 전체를 zip으로 받아 예제 코드를 열어볼 수 있다.",
      ),
    ]),
  },

  // Playwright MCP (재작성) — playwright-mcp-main.zip 기첨부
  {
    key: "playwright-mcp",
    enabled: true,
    op: "update",
    slug: "브라우저-자동화용-공식-playwright-mcp",
    title: "Playwright MCP — AI가 직접 웹 브라우저를 조작하게 (Microsoft 공식)",
    summary:
      "AI에게 '이 사이트 들어가서 로그인하고 이 버튼 눌러줘'를 시킬 수 있는 브라우저 자동화 MCP. 스크린샷 대신 페이지의 구조 정보를 읽어서 동작하므로 빠르고 정확하다. Microsoft가 만든 공식 서버이고 설치도 한 줄.",
    resourceType: "mcp",
    difficulty: "beginner",
    environment: ["Claude Code", "Cursor", "공통"],
    tags: ["MCP", "Playwright", "브라우저", "자동화", "Microsoft"],
    version: "Microsoft 공식",
    referenceLinks: [
      { label: "microsoft/playwright-mcp 공식 GitHub", url: "https://github.com/microsoft/playwright-mcp" },
    ],
    fileSource: { kind: "github-repo", owner: "microsoft", repo: "playwright-mcp", label: "microsoft/playwright-mcp" },
    coverPrompt: cover(
      "an AI assistant controlling a web browser through clean structured data rather than screenshots — precise, automated navigation",
    ),
    description: doc([
      p(
        "AI에게 웹 작업을 시키고 싶을 때가 있다. '이 사이트 들어가서 가격 긁어와', '폼에 이거 입력하고 제출해줘', '로그인 흐름이 잘 되는지 눌러봐' 같은 것들이다. ",
        b("Playwright MCP"),
        "는 바로 이걸 가능하게 해주는, ",
        b("Microsoft가 만든 공식 브라우저 자동화 서버"),
        "다.",
      ),
      h2("무엇이 다른가 — 스크린샷을 안 쓴다"),
      p(
        "보통 AI에게 브라우저를 조작시키면 화면을 스크린샷으로 찍어 '눈으로 보고' 클릭할 위치를 찾는다. 느리고, 토큰도 많이 먹고, 자주 틀린다. Playwright MCP는 다르다. 화면 대신 ",
        b("페이지의 구조 정보(접근성 트리)"),
        "를 읽는다. '여기 로그인 버튼이 있고, 여기 입력칸이 있다'는 걸 이미지가 아니라 데이터로 파악하므로 빠르고 정확하다. 별도의 이미지 인식 모델도 필요 없다.",
      ),
      h2("무엇을 할 수 있나"),
      ul([
        ["페이지 이동, 클릭, 입력, 폼 채우기, 마우스 오버, 키보드 입력"],
        ["페이지 구조 스냅샷 뜨기(현재 화면에 뭐가 있는지 파악)"],
        ["네트워크 요청 확인, 쿠키·저장소 관리, 동작 녹화"],
      ]),
      p("반복적인 웹 테스트, 데이터 수집, 로그인·결제 흐름 점검 같은 데 특히 잘 맞는다."),
      h2("설치와 연결"),
      p("Claude Code라면 명령 한 줄이면 끝난다."),
      codeBlock("bash", "claude mcp add playwright npx @playwright/mcp@latest"),
      p("설정 파일에 직접 넣는 경우(대부분의 MCP 도구 공통 형식):"),
      codeBlock(
        "json",
        `{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}`,
      ),
      h2("쓰는 법"),
      p(
        "붙였다면 평소처럼 말로 시키면 된다. 예: '네이버 들어가서 오늘 메인 뉴스 제목 5개 가져와줘.' 그러면 AI가 브라우저를 열고, 페이지 구조를 읽어 이동·클릭하며 결과를 정리해 준다.",
      ),
      h2("주의할 점"),
      ul([
        ["처음 실행 시 Playwright가 브라우저 엔진을 내려받을 수 있다(1회)."],
        ["로그인이 필요한 사이트는 세션·자격증명 처리에 주의한다. 민감한 계정 정보는 직접 다루지 않게 한다."],
        ["Node.js 환경이 필요하다."],
      ]),
      h2("출처와 다운로드"),
      p(
        "아래 참고링크의 공식 GitHub에서 전체 옵션을 확인할 수 있고, 하단 첨부파일로 저장소 전체를 zip으로 받아 볼 수 있다.",
      ),
    ]),
  },

  // Slack MCP (재작성) — slack-mcp-server-master.zip 기첨부
  {
    key: "slack-mcp",
    enabled: true,
    op: "update",
    slug: "슬랙-워크스페이스를-ai에-연결하는-mcp",
    title: "Slack MCP — AI를 우리 팀 슬랙에 연결하기 (관리자 승인 없이도)",
    summary:
      "AI가 슬랙 채널 대화를 읽고, 검색하고, 요약하고, 메시지를 올릴 수 있게 해주는 인기 MCP 서버(korotovsky). 봇 설치나 관리자 승인 없이 내 토큰만으로도 붙일 수 있는 게 강점. '어제 그 채널 논의 요약해줘' 같은 게 된다.",
    resourceType: "mcp",
    difficulty: "intermediate",
    environment: ["Claude Code", "Cursor", "공통"],
    tags: ["MCP", "Slack", "슬랙", "협업", "메시지"],
    version: "커뮤니티 인기",
    referenceLinks: [
      { label: "korotovsky/slack-mcp-server 공식 GitHub", url: "https://github.com/korotovsky/slack-mcp-server" },
    ],
    fileSource: { kind: "github-repo", owner: "korotovsky", repo: "slack-mcp-server", label: "korotovsky/slack-mcp-server" },
    coverPrompt: cover(
      "connecting an AI assistant to a team messaging and collaboration workspace, conversations flowing into an intelligent hub",
    ),
    description: doc([
      p(
        "슬랙에는 팀의 모든 대화·결정·자료가 쌓인다. 그런데 정작 '지난주 그 채널에서 뭐 정해졌지?'를 찾으려면 한참 스크롤해야 한다. ",
        b("Slack MCP 서버"),
        "를 붙이면 AI가 그 일을 대신한다. 채널 히스토리를 읽고, 검색하고, 요약하고, 필요하면 메시지도 올린다.",
      ),
      gap(),
      p(
        "여러 슬랙 MCP 중에서 ",
        b("korotovsky/slack-mcp-server"),
        "가 특히 많이 쓰인다. 이유는 아래에서 설명한다.",
      ),
      h2("이 서버가 인기 있는 이유"),
      ul([
        [b("관리자 승인 없이도 된다"), " — 보통 슬랙 연동은 워크스페이스 관리자가 봇 앱을 설치·승인해야 한다. 이 서버는 내 사용자 토큰만으로도 붙일 수 있어, 회사 슬랙에서 개인이 바로 써보기 좋다."],
        [b("두 가지 인증 지원"), " — 사용자 OAuth 토큰(xoxp) 또는 브라우저 세션 토큰(xoxc/xoxd)."],
        [b("안전 기본값"), " — 메시지 전송·이모지 반응은 기본 비활성이라, 실수로 팀 채널에 글이 나가는 사고를 막는다."],
      ]),
      h2("무엇을 할 수 있나"),
      ul([
        ["채널·스레드·DM 히스토리 읽기(날짜/개수 기준 페이지네이션)"],
        ["여러 필터로 메시지 검색"],
        ["채널·사용자 목록 조회, 안 읽은 메시지 정리"],
        ["(허용 시) 메시지 전송, 이모지 반응"],
      ]),
      h2("설치와 연결"),
      p(
        "먼저 슬랙 토큰이 필요하다. 사용자 OAuth 토큰이라면 환경변수 ",
        code("SLACK_MCP_XOXP_TOKEN"),
        "에 넣는다. 설정 형태는 대략 이렇다(토큰 자리에 실제 값).",
      ),
      codeBlock(
        "json",
        `{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "slack-mcp-server@latest", "--transport", "stdio"],
      "env": {
        "SLACK_MCP_XOXP_TOKEN": "xoxp-여기에-토큰"
      }
    }
  }
}`,
      ),
      p(
        "실행 방식(npx·Docker·바이너리)과 토큰 발급 절차는 버전에 따라 조금씩 다르니, 정확한 최신 명령은 아래 참고링크의 공식 README를 그대로 따르는 걸 권한다.",
      ),
      h2("주의할 점"),
      ul([
        [b("토큰은 비밀번호와 같다"), " — 슬랙 토큰이 유출되면 대화 내용이 노출될 수 있다. 설정 파일·저장소에 그대로 커밋하지 말 것."],
        ["회사 보안 정책에 따라 개인 토큰 사용이 제한될 수 있으니 규정을 확인한다."],
        ["메시지 전송은 기본 꺼져 있다. 켤 때는 어떤 채널에 나가는지 꼭 확인한다."],
      ]),
      h2("출처와 다운로드"),
      p(
        "아래 참고링크의 공식 GitHub에서 정확한 설치·토큰 발급법을 확인할 수 있고, 하단 첨부파일로 저장소 전체를 zip으로 받아 볼 수 있다.",
      ),
    ]),
  },

  // Pipedream MCP (재작성) — 파일 없음(호스팅 원격 서비스)
  {
    key: "pipedream-mcp",
    enabled: true,
    op: "update",
    slug: "2500개-api를-연결하는-pipedream-mcp",
    title: "Pipedream MCP — 서버 하나로 2,800개 앱(Gmail·Notion·Slack…)을 AI에 연결",
    summary:
      "Gmail, Notion, Google Sheets, Slack, GitHub 등 2,800개+ 앱을 MCP 서버 하나로 AI에 붙여주는 서비스. 앱마다 따로 연동할 필요 없이, 계정 인증만 Pipedream이 대신 관리해 준다. 호스팅 원격 서버라 설치도 가볍다.",
    resourceType: "mcp",
    difficulty: "intermediate",
    environment: ["Claude Code", "Cursor", "공통"],
    tags: ["MCP", "Pipedream", "자동화", "API", "연동"],
    version: "호스팅 서비스",
    referenceLinks: [
      { label: "Pipedream MCP 개발자 문서", url: "https://pipedream.com/docs/connect/mcp/developers" },
      { label: "Pipedream MCP 채팅 데모", url: "https://chat.pipedream.com" },
      { label: "PipedreamHQ/pipedream GitHub", url: "https://github.com/PipedreamHQ/pipedream/tree/master/modelcontextprotocol" },
    ],
    coverPrompt: cover(
      "one central hub connecting an AI to thousands of different apps and services, many lines converging into a single smart connector",
    ),
    description: doc([
      p(
        "MCP 서버를 앱마다 하나씩 깔다 보면 금세 지친다. Gmail 붙이고, Notion 붙이고, Slack 붙이고… 각각 인증하고 설정하는 게 일이다. ",
        b("Pipedream MCP"),
        "는 이걸 뒤집는다. ",
        b("서버 하나로 2,800개 넘는 앱과 10,000개 넘는 기능"),
        "을 한 번에 AI에 연결한다.",
      ),
      h2("한마디로 정리하면"),
      ul([
        ["Gmail·Notion·Google Sheets·Slack·GitHub 등 수천 개 앱을 MCP 서버 하나로 붙인다."],
        ["각 앱의 로그인·인증(OAuth)을 Pipedream이 대신 관리해 준다. 앱마다 토큰 발급하는 수고가 준다."],
        ["제공사가 운영하는 호스팅 원격 서버라, 무거운 설치 없이 연결만 하면 된다."],
      ]),
      h2("이런 걸 시킬 수 있다"),
      ul([
        ["'받은 Gmail 중 청구서만 찾아 Notion 표에 정리해줘'"],
        ["'이 내용을 Google Sheets에 새 행으로 추가하고 Slack에 알려줘'"],
        ["여러 앱을 오가는 작업을 AI에게 한 번에 맡기기"],
      ]),
      h2("어떻게 시작하나"),
      p(
        "가장 쉬운 건 Pipedream이 운영하는 ",
        b("호스팅 원격 MCP 서버"),
        "에 연결하는 방식이다. 계정을 만들고, 쓰고 싶은 앱을 연결한 뒤, 발급되는 MCP 엔드포인트를 내 AI 도구에 넣으면 된다. 정확한 URL·키는 계정마다 다르게 발급되므로 아래 개발자 문서를 따른다.",
      ),
      p(
        "직접 서버를 돌리고 싶다면 참조 구현을 셀프호스팅할 수도 있다. 이때는 클라이언트 ID·시크릿·프로젝트 값을 환경변수로 넣는다.",
      ),
      codeBlock(
        "bash",
        `# 셀프호스팅(참조 구현) 실행 예
PIPEDREAM_CLIENT_ID=...
PIPEDREAM_CLIENT_SECRET=...
PIPEDREAM_PROJECT_ID=...
npx @pipedream/mcp`,
      ),
      p(
        "먼저 감을 잡고 싶다면 아래 참고링크의 '채팅 데모'에서 설치 없이 바로 체험해 볼 수 있다.",
      ),
      h2("주의할 점"),
      ul([
        ["수천 개 앱 계정을 한곳에 연결하는 만큼, 어떤 앱에 어떤 권한을 주는지 신중히 관리한다."],
        ["호스팅 서비스라 요금제·사용량 한도가 있을 수 있다."],
        ["민감한 계정(금융·메일)은 필요한 권한만 최소로 연결한다."],
      ]),
      h2("출처"),
      p(
        "아래 참고링크의 개발자 문서에서 최신 연결 방법을, 채팅 데모에서 실제 동작을 확인할 수 있다. 이 자료는 호스팅 서비스라 별도 다운로드 파일 대신 공식 링크로 안내한다.",
      ),
    ]),
  },

  // Filestash MCP (재작성) — filestash-master.zip 기첨부
  {
    key: "filestash-mcp",
    enabled: true,
    op: "update",
    slug: "원격-파일-접근용-filestash-mcp-소개",
    title: "Filestash MCP — S3·FTP·SFTP 등 온갖 원격 저장소의 파일을 AI가 다루게",
    summary:
      "Filestash는 S3, FTP, SFTP, WebDAV 등 수십 가지 저장소를 웹에서 하나로 다루는 셀프호스팅 파일 관리자다. 여기 딸린 MCP 플러그인을 켜면 AI가 그 원격 파일들을 탐색·열람할 수 있다. 여러 스토리지에 흩어진 파일을 AI로 다뤄야 할 때 유용.",
    resourceType: "mcp",
    difficulty: "advanced",
    environment: ["셀프호스팅", "공통"],
    tags: ["MCP", "Filestash", "파일", "S3", "스토리지"],
    version: "셀프호스팅",
    referenceLinks: [
      { label: "mickael-kerjean/filestash 공식 GitHub", url: "https://github.com/mickael-kerjean/filestash" },
      { label: "Filestash MCP 플러그인 디렉터리", url: "https://github.com/mickael-kerjean/filestash/tree/master/server/plugin/plg_handler_mcp" },
    ],
    fileSource: { kind: "github-repo", owner: "mickael-kerjean", repo: "filestash", label: "mickael-kerjean/filestash" },
    coverPrompt: cover(
      "an AI assistant reaching into many different remote storage systems and file servers, retrieving files from scattered sources",
    ),
    description: doc([
      p(
        "파일이 한곳에만 있으면 좋겠지만 현실은 S3 버킷 하나, 회사 SFTP 하나, 어딘가의 FTP 하나… 이렇게 흩어져 있다. ",
        b("Filestash"),
        "는 이런 여러 저장소를 웹 화면 하나로 묶어 다루는 ",
        b("셀프호스팅 파일 관리자"),
        "다. 그리고 여기 포함된 MCP 플러그인을 켜면, 그 파일들을 ",
        b("AI가 직접 탐색·열람"),
        "할 수 있다.",
      ),
      h2("어떤 경우에 좋은가"),
      ul([
        ["파일이 S3·FTP·SFTP·WebDAV 등 여러 저장소에 흩어져 있을 때"],
        ["그 원격 파일들을 AI에게 '찾아서 읽고 정리해줘' 시키고 싶을 때"],
        ["회사 내부 스토리지를 직접 연동하기는 부담스럽고, 중간에 관리 계층을 두고 싶을 때"],
      ]),
      p(
        "특정 도구(깃허브·슬랙)를 붙이는 여느 MCP와 달리, 이건 ",
        b("여러 스토리지를 아우르는 '파일 게이트웨이'"),
        " 성격이라 조금 특수 목적이다.",
      ),
      h2("어떻게 쓰나 (큰 흐름)"),
      p(
        "Filestash 자체는 셀프호스팅이라 먼저 서버를 띄워야 한다(공식적으로 Docker 이미지를 제공한다). 그다음 관리 화면에서 쓰려는 저장소(예: S3 버킷)를 연결하고, MCP 핸들러 플러그인을 활성화한 뒤, 발급되는 MCP 엔드포인트를 AI 도구에 연결한다.",
      ),
      codeBlock(
        "bash",
        `# Filestash 서버 띄우기(예시 — 공식 문서의 최신 방법을 따르세요)
docker run -d -p 8334:8334 machines/filestash`,
      ),
      p(
        "세부 설정(플러그인 활성화·인증·엔드포인트)은 버전에 따라 다르므로, 아래 참고링크의 저장소와 플러그인 디렉터리 문서를 그대로 따르는 걸 권한다.",
      ),
      h2("주의할 점"),
      ul([
        ["셀프호스팅이라 서버 운영·보안(HTTPS·접근 제어)은 직접 챙겨야 한다. 앞의 MCP들보다 손이 더 간다."],
        ["여러 저장소 자격증명을 한곳에 모으는 구조이니, 접근 권한을 최소로 관리한다."],
        ["초보자용이라기보다, 원격 스토리지를 실제로 여러 개 다루는 사람에게 맞는 도구다."],
      ]),
      h2("출처와 다운로드"),
      p(
        "아래 참고링크의 공식 GitHub과 MCP 플러그인 디렉터리에서 설정법을 확인할 수 있고, 하단 첨부파일로 저장소 전체를 zip으로 받아 볼 수 있다.",
      ),
    ]),
  },

  // GitHub MCP (신규)
  {
    key: "github-mcp",
    enabled: true,
    op: "create",
    title: "GitHub MCP — AI가 이슈·PR·코드를 직접 다루게 (GitHub 공식)",
    summary:
      "AI에게 '이 저장소 이슈 정리해줘', 'PR 리뷰 요약해줘', '이 버그로 이슈 만들어줘'를 시킬 수 있는 GitHub 공식 MCP 서버. 설치 없이 원격 서버 URL만 연결하면 되고, 인증은 로그인 한 번이면 끝. 개발자라면 사실상 필수급.",
    resourceType: "mcp",
    difficulty: "beginner",
    environment: ["Claude Code", "VS Code", "공통"],
    tags: ["MCP", "GitHub", "깃허브", "이슈", "PR", "공식"],
    version: "GitHub 공식",
    referenceLinks: [
      { label: "github/github-mcp-server 공식 GitHub", url: "https://github.com/github/github-mcp-server" },
    ],
    fileSource: { kind: "github-repo", owner: "github", repo: "github-mcp-server", label: "github/github-mcp-server" },
    coverPrompt: cover(
      "an AI assistant working directly with software code repositories, issues and pull requests, collaborating on development",
    ),
    description: doc([
      p(
        "깃허브를 쓰다 보면 잡무가 많다. 이슈 목록 훑어서 정리하고, PR 설명 읽고, 리뷰 코멘트 따라가고, 액션(CI) 실패 원인 찾고… ",
        b("GitHub MCP 서버"),
        "를 붙이면 이런 걸 AI에게 그대로 맡길 수 있다. GitHub가 직접 만들고 유지하는 ",
        b("공식 서버"),
        "다.",
      ),
      h2("무엇을 할 수 있나"),
      ul([
        ["저장소·코드 파일 탐색하고 읽기"],
        ["이슈·PR 생성·수정·정리, 코멘트 달기"],
        ["GitHub Actions(CI) 워크플로 상태 확인·분석"],
        ["코드 보안 경고·의존성 살펴보기"],
      ]),
      p("'이 저장소 최근 열린 이슈 우선순위 매겨줘', '이 PR 뭐 바뀌었는지 요약해줘' 같은 게 바로 된다."),
      h2("설치와 연결"),
      p(
        "가장 쉬운 방법은 ",
        b("GitHub가 호스팅하는 원격 서버"),
        "에 연결하는 것이다. 설치할 게 없고 URL만 넣으면 된다.",
      ),
      codeBlock(
        "json",
        `{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}`,
      ),
      p("Claude Code라면 명령으로도 추가할 수 있다."),
      codeBlock(
        "bash",
        "claude mcp add --transport http github https://api.githubcopilot.com/mcp/",
      ),
      p(
        "처음 쓸 때 브라우저 로그인(OAuth)으로 인증하면 끝난다. 자동화·CI 환경이라면 개인 액세스 토큰(PAT)을 ",
        code("Authorization: Bearer <토큰>"),
        " 헤더나 ",
        code("GITHUB_PERSONAL_ACCESS_TOKEN"),
        " 환경변수로 넣는다.",
      ),
      p("인터넷 없이 로컬에서 돌리고 싶으면 공식 Docker 이미지를 쓸 수도 있다."),
      codeBlock(
        "bash",
        "docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN=<토큰> ghcr.io/github/github-mcp-server",
      ),
      h2("주의할 점"),
      ul([
        ["토큰·권한 범위를 필요한 만큼만 준다. 전체 저장소 쓰기 권한을 함부로 열지 않는다."],
        ["원격 서버는 인터넷 연결이 필요하다."],
        ["조직 저장소는 관리자 정책에 따라 접근이 제한될 수 있다."],
      ]),
      h2("출처와 다운로드"),
      p(
        "아래 참고링크의 공식 GitHub에서 원격·로컬 설정과 도구 목록을 볼 수 있고, 하단 첨부파일로 저장소 전체를 zip으로 받아 볼 수 있다.",
      ),
    ]),
  },

  // ═══ 중복 정리 (soft-delete) ════════════════════════════════════════════════════
  { key: "del-official-dup", enabled: true, op: "delete", slug: "공식-mcp-서버-구현-모음-살펴보기" },
  { key: "del-playwright-dup", enabled: true, op: "delete", slug: "브라우저-자동화용-playwright-mcp" },
  { key: "del-slack-dup", enabled: true, op: "delete", slug: "slack-워크스페이스용-mcp-서버-소개" },
  { key: "del-pipedream-dup", enabled: true, op: "delete", slug: "2500개-api-연결용-pipedream-mcp" },

  // ═══ SKILL ═════════════════════════════════════════════════════════════════════

  // 공식 문서 스킬 (이미 생성됨 — 표지만 채우려 spec 유지, 본문 동일 재적용은 무해)
  {
    key: "anthropic-skills-official",
    enabled: true,
    op: "update",
    slug: "claude-공식-스킬-모음-anthropics-skills",
    title: "Claude 공식 스킬 모음 (anthropics/skills) — PDF·Word·Excel·PPT를 AI가 직접",
    summary:
      "Claude에게 '문서 작업 전문 능력'을 통째로 붙여주는 공식 스킬 모음. PDF 읽고 채우기, Word·Excel·PowerPoint 생성처럼 특정 작업을 Claude가 체계적으로 해내도록 Anthropic이 직접 만든 SKILL.md 묶음이다. Claude Code에 플러그인으로 바로 설치할 수 있다.",
    resourceType: "claude-code-skill",
    difficulty: "beginner",
    environment: ["Claude Code", "claude.ai", "API"],
    tags: ["Skill", "스킬", "anthropics", "문서작업", "PDF", "Excel"],
    version: "공식 스킬 모음",
    referenceLinks: [
      { label: "anthropics/skills 공식 GitHub", url: "https://github.com/anthropics/skills" },
    ],
    fileSource: { kind: "github-repo", owner: "anthropics", repo: "skills", label: "anthropics/skills" },
    coverPrompt: cover(
      "giving an AI assistant specialized document-handling abilities — documents, spreadsheets and slides being created and edited by an intelligent tool",
    ),
    description: doc([
      p(
        "Skill(스킬)은 쉽게 말해 'Claude에게 붙이는 전문 능력 팩'이다. 특정 작업을 잘 해내는 데 필요한 설명서·스크립트·예제를 한 폴더에 담아두면, Claude가 그 작업을 할 때 그 폴더를 스스로 꺼내 읽고 순서대로 처리한다. 매번 긴 지시를 다시 쓰지 않아도, 한 번 붙여두면 계속 그 방식대로 일한다.",
      ),
      gap(),
      p(
        b("anthropics/skills"),
        "는 이 스킬을 Anthropic이 직접 만들어 공개한 공식 저장소다. 그중에서도 가장 실전에서 자주 쓰이는 게 '문서 작업 스킬' 묶음이다.",
      ),
      h2("무엇이 들어있나"),
      p("대표적인 문서 작업 스킬은 다음 네 가지다."),
      ul([
        [code("pdf"), " — PDF에서 텍스트·표를 읽어내고, 양식 PDF의 빈칸을 채우거나 페이지를 합치고 나누기"],
        [code("docx"), " — Word 문서를 서식(제목·표·스타일)까지 살려서 생성·편집"],
        [code("xlsx"), " — Excel 스프레드시트를 수식·서식과 함께 만들고 데이터 채우기"],
        [code("pptx"), " — PowerPoint 슬라이드를 레이아웃까지 갖춰 자동 생성"],
      ]),
      p(
        "이 밖에도 디자인·아트, 웹앱 테스트, MCP 서버 생성 같은 개발·크리에이티브 스킬과, 새 스킬을 만들 때 뼈대로 쓰는 ",
        code("template"),
        " 폴더가 함께 들어 있다.",
      ),
      h2("왜 좋은가"),
      ul([
        ["Anthropic이 직접 만들고 유지하는 '공식' 스킬이라 신뢰도가 높다."],
        ["문서 작업은 실무에서 수요가 가장 많은 반복 업무인데, 스킬을 붙이면 서식이 깨지지 않고 결과물이 곧바로 쓸 만하게 나온다."],
        ["오픈소스(Apache 2.0)라 내부 구조(SKILL.md)를 열어보며 '스킬을 어떻게 쓰는지' 배우기에도 좋다."],
      ]),
      h2("설치와 사용 (Claude Code)"),
      p("Claude Code에서는 이 저장소를 플러그인 마켓으로 등록한 뒤, 원하는 스킬을 설치한다."),
      codeBlock(
        "text",
        `/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills`,
      ),
      p(
        "설치하면 이후 대화에서 관련 작업이 나올 때 Claude가 해당 스킬을 알아서 불러 쓴다. 예를 들어 '이 엑셀에 이번 달 매출 정리해서 표로 만들어줘' 하면 ",
        code("xlsx"),
        " 스킬이 동작한다.",
      ),
      h2("claude.ai / API에서 쓰려면"),
      ul([
        ["claude.ai: 유료 플랜에서 스킬을 쓸 수 있고, 인터페이스에서 커스텀 스킬을 업로드할 수도 있다."],
        ["API: Skills 기능으로 이 공식 스킬이나 직접 만든 스킬을 붙여 호출한다."],
      ]),
      h2("SKILL.md는 어떻게 생겼나 (직접 만들고 싶다면)"),
      p(
        "스킬 하나는 ",
        code("SKILL.md"),
        " 파일이 들어있는 폴더다. 파일 맨 위에 이 스킬이 뭘 하고 언제 쓰는지를 적는 게 핵심이다.",
      ),
      codeBlock(
        "markdown",
        `---
name: my-skill
description: 무엇을 하는 스킬인지, 그리고 언제 사용해야 하는지 한두 문장으로.
---

# 사용 방법
- Claude가 따라야 할 지시를 순서대로 적는다
- 예시와 규칙을 함께 넣으면 더 정확해진다`,
      ),
      p(
        code("name"),
        "(스킬 식별자, 소문자·하이픈)과 ",
        code("description"),
        "(무슨 일을 언제 하는지)만 잘 적어도 Claude가 필요한 순간에 이 스킬을 꺼내 쓴다. 저장소의 ",
        code("template"),
        " 폴더를 복사해 시작하면 편하다.",
      ),
      h2("출처와 다운로드"),
      p(
        "아래 참고링크의 공식 GitHub에서 각 스킬의 SKILL.md 전문을 볼 수 있다. 이 글 하단 첨부파일로 저장소 전체를 zip으로 받아 바로 열어볼 수도 있다.",
      ),
    ]),
  },

  // SKILL 개념/제작 가이드 (신규) — 다운로드: 빈 SKILL.md 템플릿
  {
    key: "skill-howto",
    enabled: true,
    op: "create",
    title: "Claude 스킬 완전정복 — 스킬이 뭐고, 어떻게 만들고, 어디에 넣나",
    summary:
      "'스킬 스킬 하는데 정확히 뭔지, 어떻게 내 걸 만드는지' 궁금한 분을 위한 입문 가이드. 스킬의 원리, SKILL.md 구조, 폴더 위치, 잘 만드는 요령을 예시로 정리했다. 하단에 바로 채워 쓰는 SKILL.md 템플릿 파일도 첨부.",
    resourceType: "claude-code-skill",
    difficulty: "beginner",
    environment: ["Claude Code", "claude.ai", "API"],
    tags: ["Skill", "스킬", "입문", "SKILL.md", "제작"],
    version: "입문 가이드",
    localFile: {
      name: "SKILL-template.md",
      mimetype: "text/markdown",
      content: `---
name: my-skill
description: (여기에) 이 스킬이 무엇을 하는지 + 언제 사용해야 하는지 한두 문장으로 적으세요. Claude는 이 description을 보고 스킬을 꺼내 쓸지 판단하므로 가장 중요합니다.
---

# 목적
이 스킬이 해결하는 문제와, 어떤 결과물을 만들어야 하는지 적습니다.

# 작업 순서
1. 먼저 무엇을 확인/수집하는지
2. 그다음 어떻게 처리하는지
3. 마지막으로 어떤 형식으로 출력하는지

# 규칙
- 반드시 지켜야 할 제약(형식·금지사항)을 적습니다
- 예외 상황을 어떻게 처리할지 적습니다

# 예시
입력 예시와, 그에 대한 이상적인 출력 예시를 넣으면 정확도가 크게 올라갑니다.
`,
    },
    coverPrompt: cover(
      "attaching a folder of expertise to an AI assistant, teaching it a new specialized skill, a modular capability being plugged in",
    ),
    description: doc([
      p(
        "요즘 'Claude 스킬'이 자주 언급된다. 그런데 정확히 뭔지, MCP랑 뭐가 다른지, 내 걸 어떻게 만드는지는 잘 안 와닿는다. 이 글에서 한 번에 정리한다.",
      ),
      h2("스킬이 뭔가"),
      p(
        "스킬은 ",
        b("Claude에게 '이 작업은 이렇게 하라'를 담아둔 설명서 폴더"),
        "다. 폴더 안에 ",
        code("SKILL.md"),
        " 파일 하나(필요하면 참고 스크립트·예제도)를 넣어두면, 관련 작업이 나올 때 Claude가 그 폴더를 스스로 열어 읽고 그대로 따른다.",
      ),
      p(
        "핵심은 ",
        b("필요할 때만 불러온다"),
        "는 점이다. 항상 긴 지시를 프롬프트에 달고 다니는 게 아니라, Claude가 'PDF 작업이네? PDF 스킬 열어보자'처럼 그 순간에만 꺼내 쓴다. 그래서 지시를 매번 반복하지 않아도 되고, 여러 전문 능력을 가볍게 붙여둘 수 있다.",
      ),
      h2("MCP랑 뭐가 다른가"),
      ul([
        [b("MCP"), " = AI에 '외부 도구·데이터를 연결'하는 통로(슬랙·깃허브·파일 등 바깥과 연결)."],
        [b("스킬"), " = AI에게 '특정 작업을 하는 방법·노하우'를 가르치는 설명서(연결이 아니라 방법)."],
        ["둘은 경쟁이 아니라 보완 관계다. MCP로 도구를 붙이고, 스킬로 그 도구를 잘 쓰는 법을 가르치는 식으로 같이 쓴다."],
      ]),
      h2("SKILL.md 구조"),
      p("스킬의 심장은 SKILL.md 맨 위의 몇 줄이다."),
      codeBlock(
        "markdown",
        `---
name: pdf-filler
description: PDF 양식의 빈칸을 채운다. 사용자가 PDF 서식에 값을 입력해 달라고 할 때 사용한다.
---

# 작업 순서
1. 양식의 필드 목록을 파악한다
2. 사용자가 준 값을 해당 필드에 매핑한다
3. 채운 PDF를 저장한다`,
      ),
      ul([
        [code("name"), " — 스킬 식별자. 소문자·하이픈(예: ", code("pdf-filler"), ")."],
        [code("description"), " — ", b("무엇을 + 언제"), " 쓰는지. Claude가 이 문장만 보고 스킬을 꺼낼지 판단하므로 가장 중요하다. '언제 쓰는지'를 꼭 넣는다."],
        ["그 아래 본문 — 실제로 따라야 할 순서·규칙·예시."],
      ]),
      h2("어디에 넣나 (Claude Code 기준)"),
      p(
        "프로젝트 폴더 안 ",
        code(".claude/skills/<스킬이름>/SKILL.md"),
        " 경로에 두면 그 프로젝트에서 자동 인식된다. 모든 프로젝트에서 쓰고 싶으면 홈 디렉터리의 ",
        code("~/.claude/skills/"),
        " 아래에 둔다. claude.ai에서는 인터페이스로 업로드한다.",
      ),
      h2("잘 만드는 요령"),
      ul([
        [b("description에 '언제'를 넣어라"), " — '커밋 메시지를 쓸 때 사용' 처럼 발동 조건이 분명해야 제때 불려 나온다."],
        [b("짧고 구체적으로"), " — 장황한 설명보다 '순서 1·2·3 + 예시 하나'가 훨씬 잘 먹힌다."],
        [b("예시를 꼭 넣어라"), " — 이상적인 입력→출력 예시 하나가 규칙 열 줄보다 낫다."],
      ]),
      h2("출처와 다운로드"),
      p(
        "하단 첨부파일로 ",
        b("바로 채워 쓰는 SKILL.md 템플릿"),
        "을 받을 수 있다. 이걸 ",
        code(".claude/skills/my-skill/SKILL.md"),
        "로 저장하고 내용만 바꾸면 나만의 첫 스킬이 완성된다. 공식 스킬 예시는 이 게시판의 'Claude 공식 스킬 모음' 글과 참고링크를 참고하자.",
      ),
    ]),
    referenceLinks: [
      { label: "anthropics/skills 공식 예시 저장소", url: "https://github.com/anthropics/skills" },
    ],
  },

  // SKILL 실전 예시 (신규) — 다운로드: 바로 쓰는 커밋 메시지 스킬
  {
    key: "skill-commit",
    enabled: true,
    op: "create",
    title: "바로 쓰는 스킬 예시 — AI가 깃 커밋 메시지를 규칙대로 써주는 SKILL.md",
    summary:
      "복붙해서 바로 쓰는 완성형 스킬 하나. .claude/skills에 넣어두면 '커밋 메시지 써줘' 할 때 AI가 스테이징된 변경을 읽고 Conventional Commits 형식으로 깔끔하게 작성한다. 하단 SKILL.md 파일을 그대로 받아 쓰면 끝.",
    resourceType: "claude-code-skill",
    difficulty: "beginner",
    environment: ["Claude Code"],
    tags: ["Skill", "스킬", "git", "커밋", "실전예시"],
    version: "완성형 예시",
    localFile: {
      name: "commit-message.SKILL.md",
      mimetype: "text/markdown",
      content: `---
name: commit-message
description: git 커밋 메시지를 Conventional Commits 형식으로 작성한다. 사용자가 "커밋 메시지 써줘", "이 변경 커밋해줘"라고 하거나 스테이징된 변경을 커밋하려 할 때 사용한다.
---

# 목적
스테이징된 변경(diff)을 읽고, 팀이 읽기 좋은 커밋 메시지를 Conventional Commits 규칙으로 작성한다.

# 작업 순서
1. \`git diff --staged\`로 실제 스테이징된 변경을 확인한다. 스테이징된 게 없으면 사용자에게 알린다.
2. 변경의 성격을 판단해 type을 고른다: feat(기능), fix(버그), docs(문서), refactor(리팩터), test(테스트), chore(잡무), perf(성능), style(포맷).
3. 아래 형식으로 작성한다.

# 형식
<type>(<scope>): <제목 — 50자 이내, 명령형, 마침표 없음>

<본문 — 무엇을·왜 바꿨는지. '어떻게'는 코드가 말하므로 생략. 한 줄 72자에서 줄바꿈>

# 규칙
- 제목은 저장소의 기존 커밋 스타일(한국어/영어)을 따른다.
- 한 커밋에 성격이 여럿 섞였으면, 커밋을 나눌 것을 제안한다.
- 변경 의도가 불확실하면 단정하지 말고 사용자에게 확인한다.

# 예시
입력(diff 요약): 로그인 API에 IP당 요청 속도 제한 추가
출력:
feat(auth): 로그인 API에 요청 속도 제한 추가

무차별 대입 로그인 시도를 막기 위해 IP당 분당 10회로 제한한다.
초과 시 429를 반환한다.
`,
    },
    coverPrompt: cover(
      "an AI assistant writing clean, well-structured version-control commit messages, tidy organized code history",
    ),
    description: doc([
      p(
        "스킬이 뭔지 감은 왔는데 '그래서 실제로 하나 만들어 쓰면 어떤 느낌이냐'가 궁금하다면, 이 글이 그 예시다. 개발할 때 매번 귀찮은 ",
        b("커밋 메시지 작성"),
        "을 AI에게 규칙대로 맡기는 완성형 스킬 하나를 통째로 준다.",
      ),
      h2("이 스킬이 하는 일"),
      p(
        "설치해 두면, 커밋할 때 AI가 스테이징된 변경(",
        code("git diff --staged"),
        ")을 읽고 ",
        b("Conventional Commits"),
        " 형식으로 메시지를 써 준다. 'feat / fix / docs …' 같은 타입을 알아서 붙이고, 제목은 짧게, 본문은 '무엇을·왜'로 정리해 준다.",
      ),
      h2("SKILL.md 전문 (복붙용)"),
      p("아래 내용을 그대로 쓰면 된다. 하단 첨부파일로도 받을 수 있다."),
      codeBlock(
        "markdown",
        `---
name: commit-message
description: git 커밋 메시지를 Conventional Commits 형식으로 작성한다. 사용자가 "커밋 메시지 써줘", "이 변경 커밋해줘"라고 하거나 스테이징된 변경을 커밋하려 할 때 사용한다.
---

# 목적
스테이징된 변경(diff)을 읽고, 팀이 읽기 좋은 커밋 메시지를 Conventional Commits 규칙으로 작성한다.

# 작업 순서
1. git diff --staged 로 스테이징된 변경을 확인한다. 없으면 사용자에게 알린다.
2. 변경 성격으로 type을 고른다: feat / fix / docs / refactor / test / chore / perf / style.
3. 아래 형식으로 작성한다.

# 형식
<type>(<scope>): <제목 — 50자 이내, 명령형, 마침표 없음>

<본문 — 무엇을·왜 바꿨는지. 72자에서 줄바꿈>

# 규칙
- 저장소의 기존 커밋 스타일(한국어/영어)을 따른다.
- 성격이 여럿 섞였으면 커밋을 나눌 것을 제안한다.
- 의도가 불확실하면 단정하지 말고 확인한다.

# 예시
feat(auth): 로그인 API에 요청 속도 제한 추가

무차별 대입 로그인 시도를 막기 위해 IP당 분당 10회로 제한한다.
초과 시 429를 반환한다.`,
      ),
      h2("설치 방법"),
      p("Claude Code 기준, 프로젝트 폴더에 아래 경로로 파일을 저장하면 끝이다."),
      codeBlock("bash", ".claude/skills/commit-message/SKILL.md"),
      p(
        "모든 프로젝트에서 쓰고 싶으면 ",
        code("~/.claude/skills/commit-message/SKILL.md"),
        "에 둔다. 그다음부터 '커밋 메시지 써줘' 하면 이 규칙대로 나온다.",
      ),
      h2("응용"),
      p(
        "이 파일을 뼈대로 삼아 여러분 팀 규칙(예: 이슈 번호 붙이기, 한국어 고정)을 규칙 항목에 추가하면, 팀 전용 커밋 스킬이 된다. 스킬을 어떻게 만드는지 더 알고 싶으면 이 게시판의 'Claude 스킬 완전정복' 글을 참고하자.",
      ),
      h2("다운로드"),
      p("하단 첨부파일(SKILL.md)을 받아 위 경로에 그대로 저장하면 바로 동작한다."),
    ]),
    referenceLinks: [
      { label: "Conventional Commits 규격", url: "https://www.conventionalcommits.org" },
      { label: "anthropics/skills 공식 예시", url: "https://github.com/anthropics/skills" },
    ],
  },
];

// ── 실행 로직 ────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === "1";
const FORCE_COVER = process.env.FORCE_COVER === "1";
const SKIP_COVER = process.env.SKIP_COVER === "1";
const ONLY = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);

async function hasActiveFile(resourceId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.resourceFiles.id })
    .from(schema.resourceFiles)
    .where(
      and(
        eq(schema.resourceFiles.resourceId, resourceId),
        eq(schema.resourceFiles.fileStatus, "active"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** 첨부 파일 처리(GitHub zip 또는 직접 쓴 텍스트 파일). 이미 활성 파일이 있으면 생략. */
async function attachFile(resourceId: string, spec: Spec): Promise<void> {
  if (!spec.fileSource && !spec.localFile) return;
  if (await hasActiveFile(resourceId)) {
    console.info("   · 파일 이미 첨부됨 — 생략");
    return;
  }
  if (DRY_RUN) {
    console.info(`   · [DRY_RUN] 파일 첨부 예정: ${spec.fileSource?.label ?? spec.localFile?.name}`);
    return;
  }
  if (spec.localFile) {
    const buffer = Buffer.from(spec.localFile.content, "utf8");
    await uploadResourceFiles(resourceId, [
      {
        originalName: spec.localFile.name,
        mimetype: spec.localFile.mimetype,
        buffer,
        size: buffer.length,
      },
    ]);
    console.info(`   · 파일 첨부(직접): ${spec.localFile.name} (${buffer.length} bytes)`);
    return;
  }
  if (spec.fileSource) {
    const file = await fetchCuratedResourceFile(spec.fileSource);
    if (!file) {
      console.warn(`   · ⚠ 파일 다운로드 실패(${spec.fileSource.label}) — 글은 유지, 첨부만 생략`);
      return;
    }
    await uploadResourceFiles(resourceId, [file]);
    console.info(`   · 파일 첨부(zip): ${file.originalName} (${file.size} bytes) — 스캔 대기`);
  }
}

/** 표지 썸네일 생성 → 공개버킷 업로드 → thumbnail_url. 이미 있으면 생략(FORCE_COVER로 강제). */
async function generateCover(resourceId: string, spec: Spec): Promise<void> {
  if (SKIP_COVER || !spec.coverPrompt) return;
  const db = getDb();
  const [row] = await db
    .select({ thumb: schema.resources.thumbnailUrl })
    .from(schema.resources)
    .where(eq(schema.resources.id, resourceId))
    .limit(1);
  if (row?.thumb && !FORCE_COVER) {
    console.info("   · 표지 이미 있음 — 생략(FORCE_COVER=1로 강제 재생성)");
    return;
  }
  if (DRY_RUN) {
    console.info("   · [DRY_RUN] 표지 이미지 생성 예정");
    return;
  }
  const gen = await genImage({ prompt: spec.coverPrompt });
  if (!gen) {
    console.warn("   · ⚠ 표지 이미지 생성 실패 — 썸네일 없이 진행");
    return;
  }
  const ext = gen.mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const uploaded = await uploadImage(
    { filename: `resource-cover-${spec.key}.${ext}`, mimetype: gen.mimetype, data: gen.data },
    "editor-images",
  );
  await db
    .update(schema.resources)
    .set({ thumbnailUrl: uploaded.url, updatedAt: new Date() })
    .where(eq(schema.resources.id, resourceId));
  console.info(`   · 표지 생성: ${uploaded.url} ($${gen.costUsd.toFixed(3)})`);
}

async function runCreate(spec: Spec): Promise<void> {
  const db = getDb();
  const dup = await db
    .select({ id: schema.resources.id, slug: schema.resources.slug })
    .from(schema.resources)
    .where(eq(schema.resources.title, spec.title!))
    .limit(1);
  if (dup.length > 0) {
    console.info(`   · 동일 제목 이미 존재(slug=${dup[0]!.slug}) — 생성 생략, 부가처리만`);
    await attachFile(dup[0]!.id, spec);
    await generateCover(dup[0]!.id, spec);
    return;
  }
  if (DRY_RUN) {
    console.info(`   · [DRY_RUN] create "${spec.title}" (${spec.resourceType})`);
    return;
  }
  const res = await createResource({
    input: {
      title: spec.title!,
      summary: spec.summary!,
      resourceType: spec.resourceType!,
      environment: spec.environment ?? [],
      difficulty: spec.difficulty!,
      descriptionJson: spec.description!,
      usageJson: { type: "doc", content: [] },
      version: spec.version,
      referenceLinks: spec.referenceLinks,
      copyrightAgreed: true,
      tags: spec.tags ?? [],
    },
    userId: CURATOR_USER_ID,
  });
  console.info(`   · 생성됨: slug=${res.slug} id=${res.id}`);
  await attachFile(res.id, spec);
  await generateCover(res.id, spec);
}

async function runUpdate(spec: Spec): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: schema.resources.id, slug: schema.resources.slug })
    .from(schema.resources)
    .where(eq(schema.resources.slug, spec.slug!))
    .limit(1);
  if (!row) {
    console.warn(`   · ⚠ slug='${spec.slug}' 없음 — 건너뜀`);
    return;
  }
  if (DRY_RUN) {
    console.info(`   · [DRY_RUN] update slug=${row.slug}${spec.revive ? " (+revive)" : ""}`);
    await attachFile(row.id, spec);
    await generateCover(row.id, spec);
    return;
  }
  await db
    .update(schema.resources)
    .set({
      title: spec.title!,
      summary: spec.summary!,
      difficulty: spec.difficulty!,
      environment: spec.environment ?? [],
      descriptionJson: spec.description!,
      version: spec.version ?? null,
      referenceLinks: spec.referenceLinks ?? null,
      ...(spec.revive ? { status: "published" as const, deletedAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.resources.id, row.id));
  console.info(`   · 재작성됨: slug=${row.slug}${spec.revive ? " (부활)" : ""}`);
  await attachFile(row.id, spec);
  await generateCover(row.id, spec);
}

async function runDelete(spec: Spec): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: schema.resources.id })
    .from(schema.resources)
    .where(eq(schema.resources.slug, spec.slug!))
    .limit(1);
  if (!row) {
    console.warn(`   · ⚠ slug='${spec.slug}' 없음 — 건너뜀`);
    return;
  }
  if (DRY_RUN) {
    console.info(`   · [DRY_RUN] delete(soft) slug=${spec.slug}`);
    return;
  }
  await db
    .update(schema.resources)
    .set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.resources.id, row.id));
  console.info(`   · 소프트 삭제됨: slug=${spec.slug}`);
}

async function main(): Promise<void> {
  const targets = SPECS.filter((s) => s.enabled && (ONLY.length === 0 || ONLY.includes(s.key)));
  console.info(
    `[seed-curated-resources] ${DRY_RUN ? "[DRY_RUN] " : ""}대상 ${targets.length}건` +
      (ONLY.length ? ` (ONLY=${ONLY.join(",")})` : ""),
  );
  for (const spec of targets) {
    console.info(`\n▶ [${spec.op}] ${spec.key} — ${spec.title ?? spec.slug}`);
    try {
      if (spec.op === "create") await runCreate(spec);
      else if (spec.op === "update") await runUpdate(spec);
      else if (spec.op === "delete") await runDelete(spec);
    } catch (err) {
      console.error(`   · ✗ 실패: ${(err as Error).message}`);
    }
  }
  console.info("\n[seed-curated-resources] 완료.");
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[seed-curated-resources] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
