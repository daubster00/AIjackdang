---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-06-17'
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-ai-jakdang-2026-06-17/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-ai-jakdang-2026-06-17/addendum.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md'
  - 'docs/adr/ADR-0001-local-dev-infrastructure.md'
  - 'docs/adr/ADR-0002-identity-and-auth-schema.md'
  - 'docs/adr/ADR-0003-admin-identity-and-approval.md'
project_name: 'AI작당 (AI Jakdang)'
---

# AI작당 (AI Jakdang) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for AI작당 (AI Jakdang), decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

> **프로젝트 성격(중요):** 그린필드가 아니라 **브라운필드** — `apps/web|admin|api|worker` + `packages/*` 모노레포가 이미 스캐폴딩되어 있고 스택이 확정·구현됨. 유저·어드민 **디자인 시스템도 이미 구축 완료**(codex 담당). 따라서 "프로젝트 초기화/스타터 셋업" 에픽은 없으며, 첫 구현은 **기존 기반 위 첫 도메인 수직 슬라이스**다.

## Requirements Inventory

### Functional Requirements

> FR ID는 PRD 본문 ID를 그대로 보존(전역 고유·고정). 그룹은 읽기 편의용 묶음.

**계정 & 인증 (FR-1.x)**
- **FR-1.1** 회원가입: 이메일+비밀번호 + 가입 시 이메일 인증. 닉네임은 사용자 입력이 아니라 시스템이 유니크하게 자동 배정(FR-1.10).
- **FR-1.2** 소셜 로그인: 구글 / 네이버 / 카카오. 최초 소셜 로그인 시에도 닉네임·기본 프로필 이미지를 자동 배정(FR-1.10), 이후 계정 설정에서 수정 가능.
- **FR-1.3** 로그인 / 로그아웃, 세션 유지.
- **FR-1.4** 비밀번호 해시(Argon2id) 저장, 비밀번호 재설정(분실 시 재설정 메일 발송).
- **FR-1.5** 공개 프로필 페이지(`/u/{nickname}`): 닉네임·소개·프로필 이미지·배너·작성 글/답변·등급·뱃지·팔로워/팔로잉 수·팔로우 버튼(JSON-LD ProfilePage). 팔로우 실동작은 FR-7.10.
- **FR-1.6** 마이페이지(`/me` 활동 허브): 요약(등급·포인트·뱃지), 내 활동(글/질문/답변/댓글/등록 자료), 북마크, 내 뱃지·등급, 알림, 쪽지, 1:1 문의 진입. 로그인 필요·noindex.
- **FR-1.7** 회원 탈퇴/계정 삭제 + 작성 콘텐츠 처리 정책(익명화 vs 삭제 — Open Q-12).
- **FR-1.8** 비회원/회원/운영자 권한 분기(역할표 기준).
- **FR-1.9** 계정 설정(`/settings`): 회원정보 수정(닉네임·소개·프로필 이미지·배너 이미지·외부 링크), 비밀번호 변경(로그인 상태), 알림 설정, 차단 목록, 회원 탈퇴. 마이페이지와 분리. 닉네임 변경 시 유니크 재검증, 커스텀 이미지 업로드 시 기본 이미지를 덮어씀.
- **FR-1.10** 자동 닉네임·기본 프로필 이미지: 가입(이메일/소셜) 즉시 시스템이 유니크 닉네임(형용사+명사+숫자 한국어 조합, 충돌 시 재시도)과 기본 프로필 이미지(준비된 N종 중 랜덤)를 자동 배정. 사용자는 이후 계정 설정에서 변경(FR-1.9). 기본 이미지는 인덱스로 보관해 "미변경=기본"을 구분(추후 이미지 교체 용이).

**공통 게시판 (FR-2.x)** — 적용: 바이브코딩 가이드/팁, 자동화 가이드/사례/팁, 외주·판매 팁, 수익화 사례, AI 창작마당, 내가 만든 AI 제품
- **FR-2.1** 게시판 목록(텍스트형 리스트): 게시판명·설명·검색창·정렬 탭(전체/인기/최신/댓글많은)·글쓰기 버튼·글 항목(제목·요약·태그·작성자·작성일·조회수·댓글수·좋아요수·첨부 아이콘)·페이지네이션. 목록 썸네일 미사용.
- **FR-2.2** 게시글 상세: 메타 + 본문·이미지/링크/코드블록/첨부 표시·좋아요·공유·신고·댓글·수정/삭제·목록으로.
- **FR-2.3** 본문 렌더링 안전성: 줄바꿈/들여쓰기 보존, 이미지 본문 표시(클릭 확대), 링크 자동 인식, 코드블록 보존, HTML/script 실행 차단(XSS).
- **FR-2.4** 게시글 글쓰기: 제목·본문 에디터·태그·이미지·외부 링크·파일 첨부·임시저장·등록/취소. 게시판 자동 지정. 회원에게 SEO 입력 비노출.
- **FR-2.5** 본문 에디터 필수: 굵게, H2/H3, 목록, 링크, 이미지, 코드블록, 인용, 제한 색상 팔레트, 형광펜/배경 강조. 제외: 표·복잡 레이아웃·자유 글자크기·자유 색상.
- **FR-2.6** 코드블록: 줄바꿈·들여쓰기·특수문자 보존, script 실행 방지, 복사 버튼, 가로 스크롤, (권장) 언어 선택·문법 강조.
- **FR-2.7** 글 수정/삭제(작성자 본인).

**묻고답하기 (FR-3.x)**
- **FR-3.1** 단일 통합 게시판, 하위 카테고리 없음, 태그로 구분. 질문=게시글형, 답변=확장 댓글형.
- **FR-3.2** 목록: 검색창·상태 필터(전체/답변대기/답변있음/해결됨/인기질문)·질문하기 버튼·항목(상태 배지·제목·요약·태그·메타·답변수·좋아요수)·페이지네이션.
- **FR-3.3** 상태값: 답변대기(답변 0)/답변있음(답변 1+)/해결됨(질문자 변경). 채택/마감 표현 미사용.
- **FR-3.4** 질문 상세: 메타·상태값·태그·본문·첨부·질문자 버튼(수정/삭제/해결됨 변경)·답변 영역.
- **FR-3.5** 질문 글쓰기: 제목·내용·태그·이미지·파일·코드블록·임시저장·등록/취소. 구조화 입력칸 없음.
- **FR-3.6** 답변(확장 댓글형): 여러 줄·줄바꿈·링크·이미지·코드블록·등록. (제목/태그/색/형광펜/H2·H3/파일첨부 제외.)
- **FR-3.7** 도움된 답변 표시: 질문 작성자만, 1개만, 언제든 변경, 보상/등급/포인트 미연결, 마감 안 함.
- **FR-3.8** 답변 단위 좋아요·신고. 답변자·작성일 표시.
- **FR-3.9** 각 대메뉴 [질문하기] → 묻고답하기 글쓰기 + 관련 태그 자동 부착.

**실전자료 (FR-4.x)** — 다운로드형 자료실
- **FR-4.1** 목록(카드형): 상단 설명·등록 버튼(회원만)·검색창·자료유형 탭(전체/프롬프트/Claude Code Skill/MCP/Rules·설정/템플릿·체크리스트)·정렬(최신/인기/평점/다운로드/후기). 카드: 유형·자료명·한줄설명·지원환경·난이도·업데이트일·태그·평점·다운로드수·후기수·[다운로드]·[상세보기].
- **FR-4.2** 필터: 필수 = 자료유형·지원환경·정렬, 선택 = 난이도.
- **FR-4.3** 상세: 메타 전체 + 다운로드 영역(대표 파일+첨부 목록)·"이 자료는 무엇인가요"·사용법·주의사항·참고 링크·버전·후기 댓글·좋아요·신고·목록으로.
- **FR-4.4** 등록(모든 유형 동일 폼): 유형 선택→공통 정보→첨부파일→사용법/주의사항→태그→미리보기→등록. 유형별 안내 문구만 다름.
- **FR-4.5** 첨부파일: 허용 `.zip .md .txt .json .pdf .docx .xlsx`, 최대 3개, 대표 다운로드 파일 1개.
- **FR-4.6** 다운로드(로그인 필요 — 회원 전환 레버) + 다운로드 수 자동 집계(대표 파일 기준).
- **FR-4.7** 평점(1~5) + 후기 댓글(일반 댓글형) + 좋아요. 별도 오류 제보 없음.
- **FR-4.8** 등록 권한: 회원 누구나 즉시 공개, 본인 수정/삭제, 운영자 숨김/삭제. 상태: 공개/임시저장/숨김/삭제됨. 검수 배지 미사용.

**작당 라운지 (FR-5.x)**
- **FR-5.1** 하위 메뉴: AI 창작마당, 내가 만든 AI 제품, 작당 수다방(구 "자유 게시판"), 작당 의뢰소(구인·외주, 신규). 공통 게시판 구조(FR-2.x) 재사용 + 창작마당은 FR-5.2, 의뢰소는 FR-5.3 확장.
- **FR-5.2** AI 창작물 스펙(AI 창작마당 전용, 선택 입력): 사용 AI 툴·모델(다중)·프롬프트/네거티브·주요 파라미터(시드·화면비/해상도·길이/fps·steps/CFG 등)·후처리/워크플로·비용·소요 시간·라이선스. 전 항목·스펙 블록 자체가 선택. 상세 페이지 우측 사이드 패널로 표시(모바일 본문 하단 접힘), 프롬프트는 코드블록형·복사 버튼.
- **FR-5.3** 작당 의뢰소(구인·외주 게시판): 글 유형(의뢰/구직, 필수)·분야(다중, 필수)·모집 상태(모집중/마감, 필수)·연락 방법(쪽지 기본+외부 선택, 필수)·예산/기간/진행 방식(선택)·본문. 목록 필터(유형·분야·상태), 상세 의뢰 카드+[쪽지 보내기]+상태 배지, 거래 보증 없음·사기 주의 고지 필수, 신고/차단 연계.

**메인 & 탐색 (FR-6.x)**
- **FR-6.1** 메인 6섹션: ①상단 소개(큰 비주얼 없음) ②실전 인기글(탭) ③묻고답하기 최신 ④AI 수익화 인기글 ⑤실전자료 ⑥작당 라운지.
- **FR-6.2** 검색: 글·질문·실전자료 대상. 통합 검색 + 영역별 결과 구분.
- **FR-6.3** 태그 페이지(`/tags/{tag}`): 해당 태그 글 모음, SEO 랜딩.
- **FR-6.4** 태그 입력: 자유 입력 + 추천 태그/자동완성. 툴별 독립 게시판 미생성(태그로 처리).

**참여 기능 (FR-7.x)**
- **FR-7.1** 좋아요(글/답변/자료/댓글).
- **FR-7.2** 조회수 집계.
- **FR-7.3** 댓글: 작성/수정/삭제/신고.
- **FR-7.4** 대댓글(1단계).
- **FR-7.5** 댓글 좋아요.
- **FR-7.6** 북마크(글/질문/자료 저장, 마이페이지 확인).
- **FR-7.7** 공유 버튼.
- **FR-7.8** 관련글 추천 + 작성자 다른 글(상세 하단, 태그 기반).
- **FR-7.9** 회원 차단(block): 쪽지/콘텐츠 노출 제한.
- **FR-7.10** 회원 팔로우(follow): 다른 회원 팔로우/언팔(회원만, 자기 자신 불가), 팔로워/팔로잉 목록·카운트, 마이페이지 팔로잉/팔로워 탭, 공개 프로필 팔로우 버튼. (팔로잉 피드 — 팔로우한 회원 글 모아보기 — 는 이번 범위 외, 후속.)

**신고 & 모더레이션 (FR-8.x)**
- **FR-8.1** 글/댓글/자료 신고(사유 선택).
- **FR-8.2** 운영자 신고 큐 확인·처리(숨김/삭제), 사유 확인.
- **FR-8.3** 신고 누적 자동 숨김: 임계치 초과 시 자동 숨김 후 운영자 검토 큐로(임계치 미정 Q-13).
- **FR-8.4** 회원 제재: 경고/일시 정지/영구 정지(작성·등록·쪽지 제한, 단계 Q-13).
- **FR-8.5** 금칙어/스팸 필터(욕설·광고 링크 자동 차단).

**게이미피케이션 (FR-9.x)** — "가벼운 명예 중심"
- **FR-9.1** 포인트(뒷단 점수): 활동 기반 적립 + 어뷰징 방지(자가 좋아요 불가·삭제 시 회수·일일 상한·반복 등록 차단). 마이페이지에서만 작게 노출.
- **FR-9.2** 등급: 누적 포인트 5단계, 이름 옆+프로필 뱃지. 기능 미잠금.
- **FR-9.3** 뱃지(성취 인정): 초기 목록 + 운영자 수여 특별 뱃지.
- **FR-9.4** 랭킹: 주간/월간 기여자 TOP(기간 내 포인트 증가량). 위젯 + 별도 랭킹 페이지.

**관리자 (FR-10.x)** — 별도 어드민 화면(`apps/admin`)
- **FR-10.1** 게시글 관리: 공지글 설정·상단 고정·추천글·메인 노출·숨김·삭제.
- **FR-10.2** 신고 글/댓글 관리, 댓글 관리.
- **FR-10.3** 실전자료 사후 관리: 목록·신고 자료·숨김·삭제·부적절 첨부 삭제·후기 관리.
- **FR-10.4** SEO 메타(제목/설명) 운영자 수정.
- **FR-10.5** 광고(애드센스) 관리 영역, 운영 통계 화면(검색 유입·다운로드 추이).
- **FR-10.6** 문의 관리(신규): 1:1 문의 목록·상태(접수/처리중/완료)·답변 작성.
- **FR-10.7** 공지 관리: 공지 게시판 글 작성·수정·상단 고정·메인/배너 노출. 작성 권한 운영자 한정.

**SEO & 구조화 데이터 (FR-11.x)** — 최우선
- **FR-11.1** 페이지마다 고유 title·meta description 자동 생성(운영자만 보정).
- **FR-11.2** canonical URL, H1 1개, 명확한 H2/H3, breadcrumb 구조.
- **FR-11.3** 게시글 요약문 자동 생성/저장, 이미지 alt, 첨부 설명.
- **FR-11.4** sitemap.xml 자동 생성, robots.txt, OG 태그(대표 OG 이미지).
- **FR-11.5** JSON-LD 구조화 데이터(유형별): Article/BlogPosting·DiscussionForumPosting·QAPage·SoftwareSourceCode/CreativeWork/DigitalDocument·ProfilePage·CollectionPage·WebSite/Organization·BreadcrumbList.
- **FR-11.6** 태그 페이지를 SEO 랜딩으로 최적화.
- **FR-11.7** 링크 OG 자동수집: 본문 외부 링크를 링크 카드로 표시.
- **FR-11.8** 분석 연동: Google Analytics 4 + Google Search Console.
- **FR-11.9** 저품질/빈 페이지 noindex 정책.

**알림 (FR-12.x)**
- **FR-12.1** 알림 시스템: 댓글·답변·대댓글·좋아요·도움된 답변·쪽지·제재 등 이벤트 알림.
- **FR-12.2** 알림 목록/읽음 처리, 헤더 알림 배지(인앱 우선, 이메일 선택 Q-14).
- **FR-12.3** 알림 설정(종류별 on/off).

**쪽지 / DM (FR-13.x)**
- **FR-13.1** 회원 간 1:1 쪽지: 작성/수신/대화 목록/읽음. 외주 문의 경로로도 활용.
- **FR-13.2** 쪽지 신고/차단 연계, 스팸 방지 발송 제한.

**약관 & 정책 (FR-14.x)**
- **FR-14.1** 이용약관/개인정보처리방침/운영정책 페이지(PIPA 대응). 가입 시 동의.
- **FR-14.2** 실전자료 등록 시 저작권/배포 권한 동의 체크.

**공지사항 (FR-15.x)** — 신규(공지글 플래그 → 독립 게시판 승격)
- **FR-15.1** 독립 공지 게시판(`/notice`): 운영자만 작성, 전체 읽기. 공통 게시판 구조 재사용(작성 권한 운영자 한정).
- **FR-15.2** 헤더·푸터 링크 + 메인 섹션 노출. 중요 공지 상단 고정/배너 옵션.
- **FR-15.3** 공개·SSR·색인 대상: 고유 메타 + Article JSON-LD.

**고객지원 / 1:1 문의 (FR-16.x)** — 신규(Phase 1 필수, #1 수익 경로)
- **FR-16.1** 운영진 대상 1:1 문의: 회원이 운영진에게 문의 작성·전송(쪽지와 별개 채널). 외주 문의 유입 경로.
- **FR-16.2** 내 문의 내역(`/me/inquiries`): 작성 목록 + 상태 + 운영진 답변 확인(스레드형).
- **FR-16.3** 문의 상태값: 접수/처리중/완료. 운영자 답변 작성(FR-10.6 연계).
- **FR-16.4** 1차 로그인 회원 한정(행동 게이팅 일관), 스팸 방지 발송 제한.

### NonFunctional Requirements

- **NFR-1 (SEO 렌더링)**: 공개 페이지는 서버 렌더링(SSR)으로 검색엔진/AI 검색이 본문을 즉시 파싱 가능해야 한다. 시맨틱 HTML 준수. *(본 제품 #1 과제)*
- **NFR-2 (보안)**: 본문 HTML/script 실행 차단(XSS), 업로드 허용 확장자만 + 자동 보안 검사(ClamAV), 비밀번호 해시(Argon2id), CSRF·rate limiting·어뷰징 방지.
- **NFR-3 (반응형/모바일)**: 전 화면 모바일 대응. 자료 목록 필터 접힘 + 카드 2버튼, 상세 다운로드 하단 고정. 표 기능 미제공.
- **NFR-4 (성능)**: 목록/상세/검색 응답이 충분히 빠를 것(구체 수치 미정 Q-11).
- **NFR-5 (접근성)**: 이미지 alt, 명확한 헤딩 구조.
- **NFR-6 (가용성/백그라운드)**: 이메일·이미지 변환 등 무거운 작업은 백그라운드(BullMQ worker) 처리.
- **NFR-7 (확장성)**: 인증/타입/검증/도메인 로직을 향후 React Native 앱과 공유 가능하게 설계(비시각 `packages/*`).
- **NFR-8 (URL 안정성)**: URL은 초기부터 고정 지향(검색 유입 보호).

### Additional Requirements

> Architecture + ADR에서 도출된 기술·인프라·구조 요구사항. 구현 시퀀스·경계·패턴에 직접 영향.

**기반·인프라 (브라운필드 — 첫 Story 군)**
- **AR-1** 스타터 미도입: 기존 모노레포(`apps/web|admin|api|worker` + `packages/*`)가 검증된 기반. 신규 프로젝트 초기화 Story 불필요.
- **AR-2** ADR 고정 + `turbo.json` 조기 도입: ① API/worker만 DB 접근(web/admin은 API 경유, Drizzle 직접 import 금지) ② 트랜잭션은 `apps/api`/`apps/worker` service 레이어에서만 ③ 배럴/순환참조 컨벤션(`export *` 무거운 배럴 금지) ④ 마이그레이션 파일 단일 소유권·머지 전 커밋 금지.
- **AR-3** 로컬 dev 인프라(ADR-0001): `docker-compose.dev.yml`(PG17+pg_bigm 커스텀 Dockerfile, Redis, ClamAV, MinIO=로컬 S3) + `.env.example` 키 + 소셜 OAuth 콜백 규약 + `AUTH_DEV_BYPASS` dev-login. 실제 파일은 첫 구현 Story에서 생성.
- **AR-4** 환경변수는 `packages/config` Zod 단일 진입점(분산 `process.env` 접근 금지).

**데이터·검색**
- **AR-5** 한국어 전문 검색 = PostgreSQL `pg_bigm`(2-gram GIN 인덱스)를 `post`/`question`/`resource` 검색 컬럼에. 통합 검색은 API 유형별 질의 후 병합. 랭킹 정규화는 검색 Story 전 확정(`bigm_similarity` UNION ALL 스코어).
- **AR-6** 콘텐츠 다형성 모델: 유형별 분리 테이블(`post`/`question`/`answer`/`resource`/`resource_file`) + 횡단 참여 다형 참조(`(target_type, target_id)`: `comment`·`reaction`·`bookmark`·`report`·`rating`, `tag`↔`taggable`). 공지는 작성권한=운영자인 시스템 보드로 `post`에 통합.
- **AR-7** soft-delete + 보존기간 + 자동 hard-delete: 콘텐츠/자료/댓글 `status`(draft/published/hidden/deleted) + `deleted_at`, 보존기간(예 30일) 후 worker가 자동 hard-delete. 운영자=숨김 상한, 영구삭제=최고관리자/시스템.
- **AR-8** 본문 저장 형식 = Tiptap JSON(`content_json`), 렌더 시 서버에서 안전 HTML 변환 + `sanitize-html` 화이트리스트(에디터 preset `full`/`lite`, 노드 화이트리스트는 `packages/contracts/editor.ts`). HTML 원본 저장 금지.

**인증·신원 (ADR-0002 / ADR-0003)**
- **AR-9** 유저 인증(ADR-0002): Better Auth 유저 인스턴스(basePath `/api/v1/auth`), 이메일+비밀번호(이메일 인증·Argon2id)+소셜(구글/네이버/카카오 네이티브), `accounts` 테이블 계정 연결, `users.email` 필수·유니크(카카오 비즈앱 검수 전제), 닉네임 유니크. 유저는 역할 없음(전원 일반 회원, status·게이팅으로 분기). placeholder `users.ts`를 ADR 스키마로 대체(그린필드).
- **AR-10** 관리자 신원 완전 분리(ADR-0003): 별도 테이블(`admin_users`/`admin_sessions`/`admin_accounts`/`admin_verifications`), 별도 세션 쿠키(`aj_admin_session`, admin 서브도메인), 별도 Better Auth 인스턴스(basePath `/api/v1/admin/auth`), 이메일+비밀번호만(소셜 없음) + 이름·연락처. 가입 후 최고관리자 승인(pending→active)해야 로그인. 최초 super_admin은 시드 부트스트랩.
- **AR-11** `packages/auth` 리팩터링: 현행 `Role(member|admin)`을 유저(역할 없음) / 관리자(`AdminRole staff|super_admin` + 권한맵)로 분리. `canAccessAdmin`은 관리자 세션·`status=active` 기준. `/api/v1/admin/*`는 관리자 세션만 통과.
- **AR-12** 다계정/어뷰징 방어(저비용 가드): 이메일 인증 + 일회용 이메일 차단 + 가입 rate limit + 닉네임 유니크 + 행동 레이어 방어(`packages/core`). 휴대폰 본인인증 비도입(발동 조건 시 별도 ADR).

**통신·런타임**
- **AR-13** API = REST `/api/v1/*`(Fastify 5.5), 계약은 `packages/contracts`(Zod) 공유 + `fastify-type-provider-zod`. 응답: 단건=직접 반환, 목록=`{items, meta}` 오프셋 페이지네이션(커서 금지). 오류=`{error:{code,message,details?}}`(code UPPER_SNAKE). OpenAPI=`@fastify/swagger`.
- **AR-14** 알림 전달 = SSE + Redis Pub/Sub 팬아웃(ECS 다중 인스턴스 대응). 미수신분은 알림 목록에서 보강.
- **AR-15** 업로드 보안 플로우: 확장자+매직넘버 검증 → S3(R2/MinIO) 저장(상태=검사중) → worker ClamAV 비동기 스캔 → 통과 시 공개/감염 시 격리. 다운로드 로그인 필요.
- **AR-16** 백그라운드 큐(BullMQ, kebab 큐명): `email`·`image`·`stats`·`file-scan`·`view-flush`·`cleanup`·`ranking`·`search-index`. job명=`domain.action`, worker 멱등.
- **AR-17** 캐싱: Next SSR route 캐시(공개 목록·상세·태그) + Redis(인기글·랭킹·조회수 버퍼, worker 주기 flush). 무한 스크롤 금지·페이지네이션.

**배포**
- **AR-18** 호스팅 = AWS(ECS Fargate web/admin/api/worker + RDS PostgreSQL 17 + ElastiCache Redis) + Cloudflare R2(객체 스토리지) + CloudFront. 시크릿 SSM/Secrets Manager. 서브도메인 분리(www/admin/api). CI/CD = GitHub Actions(typecheck/lint/test → ECR → ECS).

### UX Design Requirements

> EXPERIENCE.md(유저/어드민)에서 추출한 행동·상태·인터랙션 요구. 디자인 시스템(토큰·컴포넌트)은 이미 구축 완료이므로 **토큰 생성이 아니라 "행동 규칙·상태·접근성 준수"가 스토리 범위**다. 충돌 시 EXPERIENCE/DESIGN spine이 이긴다.

**유저 사이트 (UX-DR-U*)**
- **UX-DR-U1** 행동 게이팅 + 로그인 유도 모달: 비회원에게도 행동 진입점(버튼) 노출, 클릭 순간 가치 강조 모달 → 로그인 후 `redirectTo`로 **원래 하려던 행동 자동 복귀**(예: 다운로드 시도→로그인→자동 다운로드). 차단 화면 금지.
- **UX-DR-U2** SSR 공개 렌더링 + 딥링크 URL 상태: 목록·상세·태그·프로필은 SSR로 본문 즉시 노출. 필터·정렬·탭은 URL 쿼리에 반영(딥링크·뒤로가기·SEO). 클라이언트 전용으로 본문 교체 금지.
- **UX-DR-U3** 페이지네이션(무한 스크롤 금지) — `aria-current=page`, 모바일 축약형(현재/전체+이전·다음).
- **UX-DR-U4** 게시글 리스트 아이템 행동: 제목 클릭=상세, 상태 배지는 제목 위 별도 줄, 모바일은 우측 통계를 제목 아래로.
- **UX-DR-U5** 자료 카드 행동: 제목/[상세보기]=상세, [다운로드]=게이팅 후 다운로드. 카드 전체 링크와 내부 버튼 클릭 충돌 방지.
- **UX-DR-U6** 칩(필터)·탭: 칩 클릭 즉시 필터/정렬(활성 1개 강조, URL 반영). 탭 `role=tablist`+`aria-selected`, 4개↑ 모바일 가로스크롤.
- **UX-DR-U7** 커스텀 Select: 네이티브 숨김+값 동기화, 클릭 열기·방향키·Enter/Space·Esc·바깥클릭. `aria-haspopup`/`aria-expanded`/`role=listbox`/`role=option`.
- **UX-DR-U8** 답변(확장 댓글형) + 도움된 답변 토글: 여러 줄·코드블록·이미지, 답변 단위 좋아요·신고. 도움된 답변은 질문 작성자 전용·1개만·언제든 변경·포인트 미연결·정답 느낌 배제.
- **UX-DR-U9** 파일 업로드: 클릭+드래그앤드롭, 확장자/용량 노출(.zip .md .txt .json .pdf .docx .xlsx, 최대 3개, 대표 1개), 진행/성공/실패 상태, 삭제 `aria-label`.
- **UX-DR-U10** 검색 자동완성: 최근검색어·추천태그·인기검색어 구분, 방향키·Enter·Esc.
- **UX-DR-U11** 상태 패턴: 콜드 로드=스켈레톤(레이아웃 일치), 빈 목록=EmptyState(원인+다음 행동 1개), 검색 결과 없음 안내+추천, 제출 실패=danger 토스트+입력 유지+중복 클릭 차단, 신고 자동 숨김·제재 회원 안내.
- **UX-DR-U12** 토스트: 짧은 피드백(3~5초), 오류는 길게/수동, 액션은 즉시행동만.
- **UX-DR-U13** 접근성 floor: 버튼=`<button>`/링크=`<a>`, icon-only `aria-label`, 포커스 링 유지, Tab=읽기 순서, Esc=최상위 오버레이 닫기, 색상 단독 상태 전달 금지(아이콘·텍스트 동반), 모달·드로어 포커스 트랩+스크롤 잠금, `prefers-reduced-motion` 존중.
- **UX-DR-U14** 반응형: ≥1024 데스크톱 가로 메뉴 전체, 768~1023 그리드 축소·필터 접힘, <768 메뉴/필터 접힘·자료 카드 2버튼·자료 상세 다운로드 하단 고정·모달 하단 시트 전환. 표 기능 미제공.
- **UX-DR-U15** 마이크로카피/보이스: 정중한 존댓말·"차분한 실전 동료" 톤, 게이팅은 가치 강조+부드러운 권유(압박·과장 금지), EXPERIENCE Voice 표 Do/Don't 준수.
- **UX-DR-U16** SEO 떠받치는 UX: H1 1개·breadcrumb(JSON-LD), 작성 화면 SEO 입력 비노출, 외부 링크 OG 카드, 이미지 alt 필수, 빈약 페이지 noindex, 코드블록 보존+XSS 차단.

**어드민 콘솔 (UX-DR-A*)**
- **UX-DR-A1** AdminShell 레이아웃: 사이드바(nav 그룹) + 상단바, admin 서브도메인·포트 3004 독립 실행. 진입=로그인→`/dashboard`, 루트는 대시보드 리다이렉트. nav active 강조 + 미처리 신고 nav 배지.
- **UX-DR-A2** 14개 1차 메뉴 IA(대시보드·통계·게시글·Q&A·자료·댓글·신고·문의(신규)·회원·포인트·등급·뱃지·광고·설정 + 운영자 계정 관리). 개발 깊이: 핵심(깊게)/기본형(얕게)/제외 구분.
- **UX-DR-A3** 데이터 테이블: 표준 컬럼군(제목·작성자·작성일+활동지표+상태+플래그), 행 클릭=상세 드로어/화면, 수치 셀 tabular-nums. 전용 필터 패널(URL 반영) + 활성 필터칩.
- **UX-DR-A4** 위험도별 파괴적 확인(risk-tiered): 되돌릴 수 있음(숨김·플래그 토글·신고 상태 변경)=즉시 실행+토스트(undo); 위험(삭제 hard·이용 제한·포인트 차감·뱃지 회수·권한 변경)=확인 모달+사유 메모 필수.
- **UX-DR-A5** soft-delete + 복구: 삭제는 soft 기본(상태 삭제, 목록 제외), 보존기간(예 30일) 내 휴지통 복구, 경과 시 자동 hard-delete. 운영자=숨김 상한.
- **UX-DR-A6** 역할 매트릭스(3단계) + 권한 거부 UX: 최고관리자(전체·영구삭제·설정·광고·권한변경·운영자 승인)/운영자(숨김 상한까지)/일반회원(전면 차단). 권한 없는 메뉴 숨김 + 직접 URL 접근 시 거부 화면.
- **UX-DR-A7** 관리자 가입 승인 워크플로우(ADR-0003): `/signup`(pending) → `/login`은 active만 통과(대기/정지/비활성 사유 안내) → 운영자 계정 관리(최고관리자)에서 승인/반려/역할 지정.
- **UX-DR-A8** 도메인 어휘 일관: 콘텐츠 `공개/숨김/삭제`, 회원 `정상/이용 제한/탈퇴`, 신고 `접수/확인중/처리완료/반려`, Q&A `답변대기/답변있음/해결됨`, 등급명 `새내기/작당원/실전러/고수/마스터/운영자`. 화면마다 다른 표현 금지.
- **UX-DR-A9** 운영자 가드레일: Q&A 도움된 답변 대신 지정 금지, 회원 댓글 내용 직접 수정 금지(숨김/삭제 중심), 실전자료 검수/안전성 보증 미제공(사후관리자).
- **UX-DR-A10** 대시보드 위젯: KPI 요약 카드 + 운영 알림(미처리 신고·답변대기·저품질 자료 우선) + 랭킹 리스트 + 차트(표/수치 대체 제공). 벌크(일괄) 액션 + 기간 선택(오늘/어제/7일/30일/이번달/지난달/사용자지정).
- **UX-DR-A11** 어드민 접근성 floor: 키보드 내비(테이블/필터/모달), 모달·드로어 포커스 트랩, 7색 시맨틱 배지에 텍스트 라벨 병기, 차트 표/수치 대체, 커스텀 셀렉트 ARIA, `prefers-reduced-motion` 존중.
- **UX-DR-A12** 자동 숨김 보수적 기본: 신고 누적 자동 숨김은 초기 기본 OFF/보수적 토글(오탐 리스크 인지), 임계치·보존기간은 사이트 설정 후보.

### FR Coverage Map

> 모든 FR이 정확히 하나의 에픽에 1차 귀속됨(SEO FR-11은 #1 과제라 횡단 — 기반은 E2, 사이트 전역 완성은 E8). 누락 없음.

- **FR-1.1~1.10** → Epic 1 — 사용자 인증·자동 닉네임/프로필·마이페이지·계정 설정
- **FR-2.1~2.7** → Epic 2 — 공통 게시판 목록·상세·작성·에디터·코드블록·XSS
- **FR-5.1~5.3** → Epic 2 — 작당 라운지(AI 창작마당·내 AI 제품·작당 수다방·작당 의뢰소) + 창작물 스펙·의뢰소 구조화 폼
- **FR-15.1~15.3** → Epic 2 — 독립 공지 게시판(운영자 작성·전체 읽기·SSR 색인)
- **FR-11.1~11.3, 11.5(기반)** → Epic 2 — SSR 메타·canonical·H1·breadcrumb·요약·alt·JSON-LD 기반 패턴(이후 에픽이 유형별 JSON-LD 확장)
- **FR-3.1~3.9** → Epic 3 — 묻고답하기(질문/답변/상태값/도움된 답변) + QAPage JSON-LD
- **FR-4.1~4.8** → Epic 4 — 실전자료 목록·상세·등록·다운로드·평점·후기 + 업로드 보안(ClamAV) + SoftwareSourceCode 류 JSON-LD
- **FR-14.2** → Epic 4 — 실전자료 등록 시 저작권/배포 권한 동의(등록 폼 결합)
- **FR-7.1~7.10** → Epic 5 — 좋아요·조회수·댓글·대댓글·댓글 좋아요·북마크·공유·관련글·차단·팔로우
- **FR-9.1~9.4** → Epic 6 — 포인트(뒷단)·등급·뱃지·랭킹
- **FR-12.1~12.3** → Epic 7 — 알림 시스템(SSE)·목록/읽음·설정
- **FR-13.1~13.2** → Epic 7 — 회원 간 1:1 쪽지(DM) + 신고/차단 연계
- **FR-16.1~16.4** → Epic 7 — 1:1 문의(유저 측 작성·내역·답변 확인)
- **FR-6.1~6.4** → Epic 8 — 메인 6섹션·통합 검색·태그 페이지·추천 태그/자동완성
- **FR-11.4, 11.6~11.9** → Epic 8 — sitemap·robots·OG·태그 SEO 랜딩·링크 OG 카드·GA4/Search Console·noindex 정책
- **FR-8.1~8.5** → Epic 9 — 신고·신고 큐·자동 숨김·회원 제재·금칙어/스팸 필터
- **FR-10.1~10.7** → Epic 9 — 어드민 게시글/Q&A/자료/댓글 관리·SEO 메타 보정·광고·통계·문의 관리·공지 관리
- **FR-14.1** → Epic 10 — 이용약관·개인정보처리방침·운영정책 페이지 + 가입 동의

**NFR 귀속(횡단):** NFR-1 SSR/SEO=E2 기반·E8 완성·전 공개 페이지 / NFR-2 보안=E1(인증·rate limit)·E4(업로드 스캔)·E9(모더레이션) / NFR-3 반응형·NFR-5 접근성=전 에픽(디자인 시스템·UX-DR) / NFR-4 성능=E8(캐싱·인덱스) / NFR-6 백그라운드=E4·E6·E7·E9(worker) / NFR-7 확장성=E1(packages 경계) / NFR-8 URL 안정=E2~E8.

**AR 귀속:** AR-1~4(기반)·AR-9~12(인증)=E1 / AR-6(다형성 모델)=E1 착수·각 에픽 확장 / AR-5(pg_bigm)=E8 / AR-7(soft-delete)=E9 정착·각 콘텐츠 에픽 적용 / AR-8(Tiptap+sanitize)=E2 / AR-13(REST 계약)=E1 정착 / AR-14(SSE)=E7 / AR-15(업로드)=E4 / AR-16(큐)=E1 골격·각 에픽 / AR-17(캐싱)=E8 / AR-18(배포 AWS/CI)=E1 골격·운영 단계.

## Epic List

### Epic 1: 개발 기반 + 사용자 인증·계정
기존 브라운필드 모노레포 위에 구현 착수 기반(ADR 고정·turbo.json·로컬 dev 인프라·기초 DB 스키마·REST/큐 골격)을 세우고, 그 위에서 사용자가 **가입(이메일+소셜)·로그인·프로필·마이페이지·계정 설정**을 할 수 있게 한다. 모든 행동 게이팅의 토대.
**FRs covered:** FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5, FR-1.6, FR-1.7, FR-1.8, FR-1.9, FR-1.10
**AR/NFR:** AR-1~4(기반·ADR·dev 인프라·env), AR-6(users 스키마 착수), AR-9·AR-11·AR-12(유저 인증·packages/auth 분리·다계정 가드), AR-13·AR-16(REST/큐 골격), NFR-1·NFR-2·NFR-7
**선행/독립성:** 모든 에픽의 토대. 이 에픽만으로 "가입·로그인·계정 관리"가 완결됨.

### Epic 2: 콘텐츠 게시판 + SSR/SEO 기반
공통 게시판(바이브코딩·자동화·수익화)·작당 라운지(AI 창작마당·내 AI 제품·작당 수다방·작당 의뢰소)·공지 게시판을 단일 board 도메인으로 구현한다. 창작마당은 선택 입력 창작물 스펙(FR-5.2), 의뢰소는 구인·외주 구조화 폼(FR-5.3)을 추가로 갖춘다. 텍스트형 목록·상세·에디터(Tiptap)·코드블록·XSS 차단 + **SSR/SEO 기반 패턴(메타·canonical·H1·breadcrumb·JSON-LD)** 을 이 에픽에서 확립해 이후 콘텐츠 에픽이 재사용한다.
**FRs covered:** FR-2.1~2.7, FR-5.1~5.3, FR-15.1~15.3, FR-11.1, FR-11.2, FR-11.3, FR-11.5(기반)
**AR/NFR:** AR-6(post 다형성)·AR-8(Tiptap JSON+sanitize), NFR-1(SSR #1 과제)·NFR-8
**선행/독립성:** Epic 1 필요. 콘텐츠 읽기·작성 + SEO 기반을 완결, 이후 Q&A·자료 에픽이 패턴 재사용(요구는 안 함).

### Epic 3: 묻고답하기 (Q&A)
단일 통합 묻고답하기를 구현한다. 질문=게시글형, 답변=확장 댓글형, 상태값(답변대기/답변있음/해결됨), 도움된 답변(보상 미연결) + QAPage JSON-LD.
**FRs covered:** FR-3.1~3.9
**AR/NFR:** AR-6(question/answer)·core `qna.ts`(상태 도출), FR-11.5 QAPage 확장
**선행/독립성:** Epic 1·2 위. Q&A 도메인 완결.

### Epic 4: 실전자료 (다운로드형 자료실 + 업로드 보안)
카드형 목록·상세·단일 등록 폼·다운로드(로그인 게이팅)·평점·후기를 구현하고, 업로드 보안 파이프라인(확장자/매직넘버 → S3 → worker ClamAV 스캔)을 정착시킨다. 등록 시 저작권/배포 동의.
**FRs covered:** FR-4.1~4.8, FR-14.2
**AR/NFR:** AR-15(업로드 보안)·AR-16(file-scan 큐), NFR-2·NFR-6, FR-11.5 SoftwareSourceCode/CreativeWork/DigitalDocument 확장
**선행/독립성:** Epic 1 필요(+2의 SEO 패턴 재사용). 자료실 도메인 완결.

### Epic 5: 참여 & 소셜 상호작용
콘텐츠 횡단 참여 기능을 다형 모델로 구현한다: 좋아요·조회수·댓글·1단계 대댓글·댓글 좋아요·북마크·공유·관련글 추천·작성자 다른 글·회원 차단·회원 팔로우.
**FRs covered:** FR-7.1~7.10
**AR/NFR:** AR-6(comment/reaction/bookmark/block 다형 + follow user→user 그래프), 낙관적 업데이트(UX)
**선행/독립성:** Epic 2·3·4의 콘텐츠 대상이 있어야 의미. 참여 레이어 완결.

### Epic 6: 게이미피케이션
"가벼운 명예 중심" 설계로 포인트(뒷단 원장)·등급(5단계)·뱃지·랭킹(주간/월간 TOP)을 구현한다. 도메인 규칙은 `packages/core`, 어뷰징 방지 포함.
**FRs covered:** FR-9.1~9.4
**AR/NFR:** AR-16(ranking 큐), core `points/grades/badges/ranking.ts`, 어뷰징 방지(AR-12 연계)
**선행/독립성:** Epic 1·2~5의 활동(글·답변·자료·좋아요·다운로드)이 포인트 소스. 게이미피케이션 완결.

### Epic 7: 알림·쪽지·1:1 문의
SSE+Redis Pub/Sub 기반 실시간 인앱 알림, 회원 간 1:1 쪽지(DM), 운영진 대상 1:1 문의(고객지원·외주 유입 경로, 유저 측)를 구현한다.
**FRs covered:** FR-12.1~12.3, FR-13.1~13.2, FR-16.1~16.4
**AR/NFR:** AR-14(SSE 팬아웃), AR-6(notification/message/inquiry), NFR-6
**선행/독립성:** Epic 1 필요(+이벤트 소스로 2~6). 알림·DM·문의 채널 완결. (어드민 문의 관리 FR-10.6은 E9.)

### Epic 8: 메인·탐색·검색 & SEO 완성
메인 6섹션, 글·질문·자료 통합 검색(pg_bigm), 태그 페이지(SEO 랜딩), 추천 태그/자동완성 + 사이트 전역 SEO 완성(sitemap·robots·OG·링크 OG 카드·GA4·Search Console·noindex 정책)·성능 캐싱.
**FRs covered:** FR-6.1~6.4, FR-11.4, FR-11.6, FR-11.7, FR-11.8, FR-11.9
**AR/NFR:** AR-5(pg_bigm 검색·랭킹 정규화)·AR-17(캐싱), NFR-1·NFR-4
**선행/독립성:** 검색·메인은 Epic 2~4 콘텐츠 존재 전제. 사이트 탐색·SEO 완성.

### Epic 9: 신고·모더레이션 & 어드민 콘솔
관리자 신원(유저와 완전 분리)·가입 승인 워크플로우를 세우고, 신고 큐·자동 숨김·회원 제재·금칙어 필터 + 전체 어드민 메뉴(게시글/Q&A/자료/댓글/회원/포인트/등급/뱃지/광고/통계/문의 관리/공지 관리/운영자 계정 관리)를 구현한다. soft-delete+자동 hard-delete 정착.
**FRs covered:** FR-8.1~8.5, FR-10.1~10.7
**AR/NFR:** AR-10·AR-11(관리자 분리 신원·권한맵)·AR-7(soft-delete 수명주기)·AR-16(cleanup 큐), NFR-2, UX-DR-A*(위험도별 확인·역할 매트릭스·도메인 어휘)
**선행/독립성:** Epic 1~7의 콘텐츠·신고·회원·문의가 관리 대상. 운영 콘솔 완결.

### Epic 10: 약관 & 정책
이용약관·개인정보처리방침·운영정책 페이지(PIPA 대응)와 가입 시 동의 흐름을 구현한다.
**FRs covered:** FR-14.1
**AR/NFR:** NFR-1(공개 SSR 페이지), 가입 동의(Epic 1 연계)
**선행/독립성:** 거의 독립(법무 텍스트 확정 시 어느 시점이든 가능). 약관·동의 완결.

---

## Epic 1: 개발 기반 + 사용자 인증·계정

기존 브라운필드 모노레포 위에 구현 착수 기반(ADR 고정·turbo.json·로컬 dev 인프라·env 단일 진입점)을 세우고, 그 위에서 사용자가 가입(이메일+소셜)·로그인·프로필·마이페이지·계정 설정을 할 수 있게 한다. 모든 행동 게이팅의 토대.

> **스토리 순서 규칙:** 1.1(인프라)→1.2(인증 토대)가 선행 스토리로 enabling 역할. 이후 1.3~1.10은 1.2 위에서 각각 독립 완결. 어떤 스토리도 자기보다 뒤 스토리를 요구하지 않는다. 마이페이지/프로필(1.8·1.10)은 *현 시점 데이터*(인증·프로필)만 렌더하고 글/답변/뱃지 등 후속 에픽 산출물은 빈 상태로 두었다가 해당 에픽에서 집계 추가(미래 의존 아님).

### Story 1.1: 개발 착수 기반 · 컨벤션 고정

As a 개발팀(다중 AI 에이전트),
I want 로컬 개발 인프라와 빌드·컨벤션 규칙이 한 번에 부팅·집행되기를,
So that day-1에 검색(pg_bigm)·스캔(ClamAV)·스토리지(S3)·큐(Redis)가 막힘없이 뜨고 모든 에이전트가 같은 규칙으로 코드를 쓴다.

**Acceptance Criteria:**

**Given** 리포 루트에서 ADR-0001의 `docker-compose.dev.yml`·`infra/postgres/Dockerfile`·`infra/postgres/init/01-pg_bigm.sql`이 생성된 상태
**When** `docker compose -f docker-compose.dev.yml up -d`를 실행
**Then** postgres(PG17)·redis·clamav·minio·minio-setup가 healthy로 기동하고
**And** postgres에 `CREATE EXTENSION pg_bigm`이 이미 적용되어 `SELECT * FROM pg_extension WHERE extname='pg_bigm'`이 1행을 반환한다

**Given** `.env.example`이 ADR-0001 키(DATABASE_URL·CLAMD_*·S3_*·소셜 OAuth·AUTH_DEV_BYPASS)로 갱신되고 PostgreSQL 주석이 18→17로 정정된 상태
**When** `packages/config`의 Zod env 스키마(`env.ts`)로 환경변수를 로드
**Then** 누락·형식 오류 시 부팅이 명확한 메시지로 실패하고, 유효하면 타입 안전한 env 객체가 단일 진입점으로 노출된다(분산 `process.env` 접근 없음)

**Given** 루트에 `turbo.json`이 추가된 상태
**When** `pnpm turbo run typecheck lint test build`(또는 affected) 실행
**Then** 4개 앱+패키지에서 캐시 기반 affected 태스크가 통과한다

**Given** ADR 집행 규칙(API/worker만 DB 접근·트랜잭션 service 레이어·무거운 배럴/순환 import 금지·마이그레이션 단일 소유권)을 `project-context.md` 또는 ADR 문서에 명시
**When** `pnpm dev:web|admin|api|worker`로 4개 앱을 기동(web 3003/admin 3004/api 4003)
**Then** 각 앱이 정상 기동하고 api는 `/health`에 200을 반환한다

### Story 1.2: 인증 토대 — 스키마 · packages/auth 분리 · Better Auth 유저 인스턴스

As a 개발팀,
I want 유저 인증 스키마와 권한 패키지·Better Auth 유저 인스턴스가 ADR-0002/0003 설계대로 정착되기를,
So that 회원가입·로그인·소셜 등 모든 인증 흐름이 일관된 토대 위에서 구현된다.

**Acceptance Criteria:**

**Given** ADR-0002 설계(placeholder `users.ts` 대체)
**When** `packages/database`에 `users`·`sessions`·`accounts`·`verifications`·`user_sanctions` 스키마와 마이그레이션을 생성
**Then** `drizzle-kit` 마이그레이션이 적용되어 `users.email`(notNull·unique)·`users.nickname`(notNull·unique)·`user_status` enum(active/suspended/withdrawn)·프로필 컬럼(`users.bio` nullable·`users.avatar_url` nullable·`users.banner_url` nullable·`users.default_avatar_index` int notNull·`users.links` jsonb nullable)이 존재하고 `users.password_hash` 컬럼은 없다(비밀번호는 `accounts.password` Argon2id)
**And** `nickname`은 URL 세그먼트(`/u/{nickname}`)로 쓰이므로 허용 문자(한글·영문·숫자·`_`)·길이 제약을 contracts 레벨에서 정의한다

**Given** ADR-0003의 packages/auth 리팩터링 요구
**When** `packages/auth`의 현행 `Role(member|admin)`을 유저(역할 없음) / `AdminRole(staff|super_admin)` + 권한맵으로 분리
**Then** `hasPermission`·`canAccessAdmin`이 새 타입으로 컴파일되고, web/admin/api가 동일 타입을 import해 typecheck를 통과한다

**Given** Better Auth 유저 인스턴스(basePath `/api/v1/auth`)와 Argon2id 커스텀 해셔 구성
**When** `AUTH_DEV_BYPASS=true`·`NODE_ENV!=production`에서 `/api/v1/auth/dev-login` 호출
**Then** 시드 유저로 즉시 세션이 발급되고, production 빌드에서는 해당 라우트가 비활성(404)임을 테스트로 확인한다

**Given** 인증 응답·입력 계약
**When** `packages/contracts`에 auth Zod 스키마를 정의
**Then** api 라우트가 `fastify-type-provider-zod`로 요청/응답을 검증하고 클라이언트가 동일 스키마를 재사용한다

### Story 1.3: 이메일 회원가입 + 이메일 인증

As a 비회원,
I want 이메일·비밀번호로 가입하고 이메일 인증을 완료하기를,
So that AI작당의 회원이 되어 행동(작성·다운로드·반응)을 할 수 있다.

**Acceptance Criteria:**

**Given** 회원가입 화면(`/signup`)에서 이메일·비밀번호·약관 동의를 입력(닉네임 입력칸 없음)
**When** 유효한 값으로 가입을 제출
**Then** `accounts`(providerId='credential', Argon2id 해시)와 `users`(emailVerified=false, 시스템 자동배정 닉네임 + 랜덤 `default_avatar_index`)가 생성되고, 인증 메일이 `email` 큐(worker)로 발송되며, "인증 메일을 보냈어요" 안내가 표시된다(FR-1.10)

**Given** 자동 닉네임 생성기(형용사+명사 한국어 단어 풀 + 숫자 접미)
**When** 가입 트랜잭션에서 닉네임을 생성·삽입
**Then** `users.nickname` UNIQUE 위반 시 숫자 접미를 바꿔 최대 N회 재시도하고, 모두 충돌하면 더 긴 숫자 fallback으로 반드시 유니크 값을 확정한다(동시가입 레이스에 안전)
**And** `default_avatar_index`는 준비된 기본 이미지 N종 중 균등 분배(카운터 기반 또는 crypto 랜덤, `Math.random` 지양)로 배정된다

**Given** 발송된 인증 링크(`verifications` 토큰)
**When** 사용자가 링크를 클릭(유효·미만료)
**Then** `users.emailVerified=true`로 갱신되고 로그인 가능 상태가 된다. 만료/위조 토큰은 명확한 오류 + 재발송 안내를 보인다

**Given** 이메일 중복·일회용 이메일 도메인·동일 IP 가입 폭주
**When** 가입을 시도
**Then** 이메일 유니크 위반은 409 + 인라인 오류, 일회용 이메일 도메인은 차단 안내, 가입 rate limit 초과는 429로 거부된다(AR-12). (닉네임은 시스템 생성이므로 사용자향 중복 오류 없음 — 생성기 재시도로 내부 해소)

**Given** XSS·약관 미동의
**When** 입력에 스크립트가 포함되거나 약관 동의 없이 제출
**Then** 입력은 새니타이즈/거부되고, 약관 동의 체크 없이는 제출 버튼이 비활성이다(FR-14.1 연계)

**Given** 기본 프로필 이미지 자산
**When** 빌드/배포 준비
**Then** 원본 PNG(`자료/프로필/` N종)는 256×256(또는 512) WebP로 리사이즈·최적화되어 `apps/web/public`(또는 오브젝트 스토리지)에 배치되고, 코드는 `default_avatar_index`로 해당 경로를 해석한다(원본 2MB 직접 서빙 금지)

### Story 1.4: 로그인 / 로그아웃 / 세션 유지

As a 회원,
I want 이메일·비밀번호로 로그인하고 로그아웃하며 세션이 유지되기를,
So that 재방문 시 다시 인증하지 않고 내 활동을 이어갈 수 있다.

**Acceptance Criteria:**

**Given** 인증 완료된 계정으로 로그인 화면에서 자격증명 입력
**When** 올바른 이메일·비밀번호로 로그인
**Then** API 서버가 인증 권위로서 httpOnly 세션 쿠키(`aj_session`)를 발급하고, `sessions` 레코드가 생성되며, Next 서버 컴포넌트가 쿠키를 포워딩해 로그인 상태를 SSR로 반영한다

**Given** 틀린 비밀번호·미인증 이메일·정지(suspended) 계정
**When** 로그인 시도
**Then** 각각 401(자격증명 불일치)·인증 안내·제재 사유/기간 안내로 구분되어 처리되고, 로그인 시도에 rate limit이 적용된다

**Given** 로그인 상태
**When** 로그아웃
**Then** 세션이 무효화되고 쿠키가 제거되며 비회원 상태로 전환된다

### Story 1.5: 소셜 로그인(구글/네이버/카카오) + 계정 연결

As a 비회원/회원,
I want 구글·네이버·카카오로 로그인하고 같은 이메일이면 한 계정으로 연결되기를,
So that 가입 마찰 없이 빠르게 진입하고 중복 계정이 생기지 않는다.

**Acceptance Criteria:**

**Given** Better Auth `socialProviders`에 구글·네이버·카카오가 네이티브 구성되고 콜백(`/api/v1/auth/callback/{provider}`)이 등록된 상태
**When** 소셜 로그인 버튼으로 OAuth 플로우를 완료
**Then** `accounts`(providerId=해당 소셜)와 필요한 `users`가 생성/연결되고 세션이 발급된다

**Given** 최초 소셜 로그인이고 닉네임 등 최소 프로필이 없는 경우
**When** 콜백 직후
**Then** 닉네임 최소 프로필 설정 단계로 유도되고, 설정 완료 전에는 행동이 게이팅된다(FR-1.2)

**Given** 이미 동일 (검증된) 이메일의 credential/다른 소셜 계정이 존재
**When** 소셜 로그인
**Then** account linking으로 **한 `users`에 계정이 병합**되고 별도 중복 유저가 생기지 않는다(AR-12)

**Given** 카카오 비즈앱 미검수로 이메일 미수신 가능성
**When** 카카오 로그인
**Then** ADR-0002 §카카오 정책에 따른 처리(로그인 비활성 또는 이메일 추가입력)가 일관되게 적용된다

### Story 1.6: 비밀번호 재설정 (분실)

As a 비밀번호를 잊은 회원,
I want 이메일로 재설정 링크를 받아 새 비밀번호를 설정하기를,
So that 계정 접근을 다시 확보한다.

**Acceptance Criteria:**

**Given** 재설정 요청 화면에 가입 이메일 입력
**When** 요청을 제출
**Then** 계정 존재 여부를 노출하지 않는 동일 응답을 주고, 존재 시 `verifications` 토큰으로 재설정 메일을 `email` 큐로 발송한다

**Given** 유효·미만료 재설정 링크
**When** 새 비밀번호를 입력·제출
**Then** `accounts.password`가 새 Argon2id 해시로 갱신되고 기존 세션은 무효화되며 로그인 화면으로 안내된다. 만료/재사용 토큰은 거부된다

### Story 1.7: 행동 게이팅 토대 + 로그인 유도 모달

As a 비회원,
I want 읽기는 막히지 않되 행동 시도 시 가치를 곁들인 로그인 유도를 받고, 로그인 후 원래 행동으로 복귀하기를,
So that 벽이 아니라 부드러운 전환점을 통해 회원이 된다.

**Acceptance Criteria:**

**Given** 비회원으로 공개 페이지를 열람
**When** 목록·상세·검색을 본다
**Then** 게이팅 없이 SSR 본문이 노출된다(UX-DR-U2)

**Given** 비회원이 행동(다운로드·작성·반응·쪽지·신고 등) 진입점을 클릭
**When** 클릭 순간
**Then** 차단 화면이 아니라 가치 강조 로그인 유도 모달이 뜨고(가입 30초 톤), Esc·바깥클릭·닫기로 닫을 수 있다(UX-DR-U1·U15)

**Given** 모달에서 로그인/가입을 완료
**When** 인증 성공
**Then** `redirectTo` 파라미터로 **원래 하려던 행동·위치로 자동 복귀**한다(메모리 콜백 금지)

**Given** API 최종 통제
**When** 클라이언트 분기를 우회해 비인증 요청이 행동 API에 도달
**Then** API가 401로 거부한다(클라이언트 분기는 UX 편의일 뿐, FR-1.8)

### Story 1.8: 마이페이지 활동 허브(`/me`) 셸 + 요약

As a 회원,
I want 내 활동 허브에서 요약(등급·포인트·뱃지)과 활동·북마크·알림·쪽지·문의 진입을 한곳에서 보기를,
So that 내 활동을 빠르게 파악하고 이동한다.

**Acceptance Criteria:**

**Given** 로그인 상태로 `/me` 진입
**When** 페이지 로드
**Then** noindex·로그인 필요로 처리되고, 요약 영역(현재 등급·포인트·뱃지 — 현 시점 값/0 기준)과 하위 진입(`/me/activity`·`/me/bookmarks`·`/me/badges`·`/me/notifications`·`/me/messages`·`/me/inquiries`) 내비가 렌더된다

**Given** 비회원이 `/me` 접근
**When** 진입
**Then** 로그인 유도로 처리된다

**Given** 아직 콘텐츠 에픽(글/질문/답변/댓글/자료)이 구현되지 않은 시점
**When** `/me/activity` 탭을 연다
**Then** 각 탭은 EmptyState(원인+다음 행동)로 렌더되고, 해당 에픽 구현 시 집계가 채워진다(미래 의존 아님 — 셸만 완결)

### Story 1.9: 계정 설정 — 회원정보 수정 · 비밀번호 변경 · 회원 탈퇴

As a 회원,
I want 민감 영역인 계정 설정에서 프로필을 수정하고 비밀번호를 바꾸고 탈퇴하기를,
So that 내 정보와 계정 수명을 직접 관리한다.

**Acceptance Criteria:**

**Given** `/settings/profile`
**When** 닉네임·소개·프로필 이미지·배너 이미지·외부 링크를 수정·저장
**Then** 닉네임 유니크·허용 문자 검증 통과 시 `users`가 갱신되고, 이미지 업로드는 허용 형식·용량 검증 후 저장되며, 성공 토스트가 표시된다(FR-1.9). 커스텀 아바타/배너 업로드 시 `avatar_url`/`banner_url`이 설정되어 기본 이미지(`default_avatar_index`)를 덮어쓴다

**Given** `/settings/password`(로그인 상태)
**When** 현재 비밀번호 확인 후 새 비밀번호를 변경
**Then** `accounts.password`가 Argon2id로 갱신된다(분실 재설정 FR-1.4와 별개). 현재 비밀번호 불일치는 거부된다

**Given** `/settings/account`
**When** 회원 탈퇴를 확정(확인 단계 거침)
**Then** ADR/Open Q-12 정책에 따라 탈퇴 처리(`users.status=withdrawn` + `deleted_at`, 콘텐츠 익명화/삭제 정책 적용)되고 세션이 종료된다

> 참고: `/settings/notifications`·`/settings/blocks`는 각각 알림(Epic 7)·차단(Epic 5/7) 기능과 함께 구현(미래 의존 회피).

### Story 1.10: 공개 프로필 페이지(`/u/{nickname}`) + ProfilePage JSON-LD

As a 방문자(비회원 포함),
I want 작성자의 공개 프로필에서 닉네임·소개·등급·뱃지·작성물을 보기를,
So that 작성자의 신뢰도를 가늠하고 더 탐색한다.

**Acceptance Criteria:**

**Given** 유효한 닉네임으로 `/u/{nickname}` 진입
**When** SSR 렌더
**Then** 닉네임·소개·프로필 이미지·배너·등급·뱃지(현 시점 값)와 ProfilePage JSON-LD·고유 메타가 출력되고, 비회원도 열람 가능하다(FR-1.5, FR-11.5)

**Given** 팔로워/팔로잉 카운트·팔로우 버튼 영역
**When** 프로필 헤더를 렌더
**Then** 카운트 표시 슬롯과 팔로우 버튼 슬롯만 두고, 실제 데이터·동작은 Epic 5 Story 5.12에서 활성화한다(미래 의존 회피 — 차단 버튼과 동일 패턴)

**Given** 작성 글/답변 등 활동이 아직 없는(또는 콘텐츠 에픽 미구현) 시점
**When** 프로필을 본다
**Then** 작성물 영역은 EmptyState로 렌더되고 이후 콘텐츠 에픽에서 집계가 채워진다

**Given** 존재하지 않는 닉네임·탈퇴 회원
**When** 접근
**Then** 404 또는 안내 페이지로 처리되고 noindex된다(FR-11.9 연계)

---

## Epic 2: 콘텐츠 게시판 + SSR/SEO 기반

Epic 1이 세운 인증·게이팅 토대 위에서, 단일 `post` 도메인을 `category`/`board` 조합으로 인스턴스화해 **공통 게시판(바이브 코딩·AI 자동화·AI 수익화 계열)·작당 라운지(AI 창작마당·내가 만든 AI 제품·작당 수다방·작당 의뢰소)·독립 공지 게시판**을 구현한다. AI 창작마당은 선택 입력 창작물 스펙(2.11), 작당 의뢰소는 구인·외주 구조화 폼(2.12)을 추가한다. 텍스트형 목록·상세·Tiptap 에디터(`full` preset)·코드블록·XSS 차단을 갖추고, 이 에픽에서 **SSR/SEO 기반 패턴(`lib/seo` 헬퍼·`generateMetadata`·canonical·H1·breadcrumb·요약 자동생성·alt·JSON-LD)을 처음 확립**해 Epic 3~4가 재사용한다. 좋아요·댓글·신고 등 참여 기능은 Epic 5 소유이므로 상세 페이지에 슬롯/플레이스홀더만 두고 "Epic 5에서 활성화"로 명시한다.

> **스토리 순서 규칙:** 2.1(post 스키마 + board 도메인 데이터) → 2.2(lib/seo 헬퍼 + sitemap 골격) → 2.3(목록 SSR) → 2.4(상세 SSR) → 2.5(Tiptap 에디터 + contracts/editor.ts) → 2.6(코드블록 + XSS 새니타이즈) → 2.7(글쓰기 폼 + API) → 2.8(글 수정·삭제) → 2.9(공지 게시판) → 2.10(라우팅 완결·통합 검증) → 2.11(AI 창작마당 창작물 스펙) → 2.12(작당 의뢰소 구인·외주). 2.11·2.12는 2.7~2.8(글쓰기·수정) 위에서 독립 추가되는 게시판 기능 확장으로 각자 자기 스토리에서 검증한다(쪽지 실연계는 Epic 7 슬롯). 각 스토리는 자기 앞 스토리까지만 의존. 좋아요·댓글·신고(Epic 5)·태그 SEO 랜딩·sitemap 완성·통합검색(Epic 8)은 미래 에픽에서 활성화. **조회수 인프라(Redis 버퍼 + view-flush 큐·worker)는 본 에픽(2.4)에서 최초 도입하고 Epic 5가 재사용**(검수 조정). **관리자 신원(admin_users/admin_sessions/admin Better Auth)은 Epic 9 Story 9.1 소유** — 공지 작성 권한 게이트는 본 에픽이 API 차단만, 작성 UI는 Epic 9 Story 9.17(검수 조정).

### Story 2.1: post 스키마 + board 도메인 데이터 시드

As a 개발팀,
I want `post` 테이블과 `board`/`category` 메타 데이터가 AR-6 다형성 모델 설계대로 `packages/database`에 정착되기를,
So that 이후 모든 게시판·공지 스토리가 동일 DB 기반 위에서 독립 구현된다.

**Acceptance Criteria:**

**Given** `packages/database/src/schema/`에 `posts` 스키마 파일이 아직 없는 상태
**When** `posts.ts` 스키마를 생성하고 `drizzle-kit generate` + `drizzle-kit migrate`를 실행
**Then** 다음 컬럼을 가진 `posts` 테이블이 존재한다: `id` uuid PK, `user_id` uuid FK(`users.id`, nullable), `board` varchar(50) NOT NULL, `category` varchar(50), `title` varchar(300) NOT NULL, `slug` varchar(350) UNIQUE NOT NULL, `content_json` jsonb NOT NULL, `summary` varchar(500), `status` `post_status` enum(`draft`/`published`/`hidden`/`deleted`) DEFAULT `draft`, `is_pinned` boolean DEFAULT false, `view_count` integer DEFAULT 0, `created_at`/`updated_at`/`deleted_at` timestamptz
**And** `taggable`(`target_type`,`target_id`,`tag_id`)와 `tags`(`id`,`name`,`slug`) 테이블이 함께 생성된다(AR-6 다형 tag 연결)

**Given** `packages/contracts/src/post.ts`가 없는 상태
**When** Zod 스키마(`postCardSchema`, `postDetailSchema`, `createPostSchema`, `updatePostSchema`, `paginatedPostsSchema`)를 정의
**Then** `index.ts`에서 재노출되고 `pnpm typecheck`가 전 워크스페이스에서 통과한다

**Given** board/category 메타가 코드 상수로 관리되어야 함
**When** `packages/contracts/src/board.ts`에 `BOARDS` 상수(board slug → `{label, description, categorySlug, urlPath}`)를 정의
**Then** 바이브 코딩 가이드/팁·자동화 가이드/사례/팁·외주판매 팁·수익화 사례·AI 창작마당·내가 만든 AI 제품·작당 수다방(`talk`, 구 자유 게시판)·작당 의뢰소(`gigs`)·공지(system) 10개 board가 매핑에 존재하고, 공지는 `isSystemBoard: true`, AI 창작마당은 `hasCreativeSpec: true`(FR-5.2), 작당 의뢰소는 `boardKind: 'recruit'`(FR-5.3) 플래그를 가진다(스펙/구조화 폼은 Story 2.11·2.12가 테이블·UI 소유)

**Given** 마이그레이션 단일 소유권 규칙(AR-2)
**When** 마이그레이션 파일이 생성됨
**Then** 단일 파일로 존재하고 `taggable`·`tags`가 같은 파일에 포함되며 Epic 3/4 확장 시 잠금 주석이 명시된다

### Story 2.2: lib/seo 헬퍼 + sitemap/robots 골격

As a 개발팀,
I want SSR/SEO 기반 패턴(`generateMetadata` 헬퍼·canonical·JSON-LD 빌더·sitemap 골격·robots.txt)이 `apps/web/lib/seo/`에 한 번 확립되기를,
So that Epic 3·4·8 등 모든 후속 공개 페이지가 중복 없이 재사용해 SEO 일관성이 보장된다(FR-11.1~11.3·11.5 기반).

**Acceptance Criteria:**

**Given** `apps/web/lib/seo/` 폴더가 없는 상태
**When** `metadata.ts`·`jsonld.ts`·`breadcrumb.ts`를 작성
**Then** `buildPageMeta`·`buildPostMeta`·`buildNoticeMeta`·`buildBreadcrumbJsonLd`·`buildArticleJsonLd`(Article/BlogPosting/DiscussionForumPosting 분기)·`buildCollectionPageJsonLd`·`generateSummary(contentJson, maxLen)`(Tiptap JSON에서 텍스트 추출·태그 제거·최대 200자)가 named export된다

**Given** `apps/web/app/sitemap.ts`·`robots.ts`가 없는 상태
**When** 두 파일을 생성
**Then** `sitemap.ts`는 현 시점 published 게시글·공지 URL을 동적 포함(`lastModified`=`updated_at`), `robots.ts`는 `Allow: /` + `/me/*`·`/settings/*` noindex Disallow + Sitemap 선언을 반환한다(FR-11.4 골격, 완성 Epic 8)

**Given** 헬퍼가 서버 컴포넌트에서 사용됨
**When** 목록 페이지에서 `buildCollectionPageJsonLd`를 호출(2.3 연결)
**Then** `pnpm typecheck`가 통과하고 `generateSummary` 단위 테스트(일반 단락·200자 truncate·빈 JSON·이미지/코드블록만 → 빈 문자열)가 통과한다

### Story 2.3: 게시판 목록 SSR 페이지

As a 방문자(비회원 포함),
I want 게시판 목록이 서버 렌더링으로 즉시 노출되고 정렬·필터가 URL에 반영되기를,
So that 검색엔진이 본문을 즉시 파싱하고 나는 뒤로가기·딥링크로 탐색을 이어갈 수 있다(FR-2.1·NFR-1·UX-DR-U2).

**Acceptance Criteria:**

**Given** `app/(content)/[category]/[board]/page.tsx` 서버 컴포넌트
**When** `/vibe-coding/vibe-coding-guide`·`/lounge/talk` 등 모든 board URL에 접근(비회원 포함)
**Then** 게시판명·설명·검색창·정렬 탭(전체/인기/최신/댓글많은)·글 목록·페이지네이션이 SSR HTML에 포함되어 `curl`로 게시글 제목이 확인된다

**Given** 목록 페이지 SEO 메타
**When** 렌더
**Then** `<title>{board.label} | AI작당`, meta description, canonical `/[category]/[board]`, H1 1개, CollectionPage + BreadcrumbList JSON-LD(홈>카테고리>게시판)가 DOM에 존재한다(FR-11.1·11.2·11.5)

**Given** API `GET /api/v1/posts?board=&sort=&page=&pageSize=20`
**When** 서버 컴포넌트에서 쿠키 포워딩 호출
**Then** `{ items: PostCard[], meta }` 응답. `PostCard`는 `id·slug·title·summary·authorNickname·createdAt·viewCount·commentCount·likeCount·hasAttachment·tags[]`. `commentCount`·`likeCount`는 이 시점 0(Epic 5 활성화), 응답 필드로만 존재

**Given** 정렬 탭 클릭
**When** 탭 변경
**Then** URL 쿼리 `?sort=popular|latest|most-comments` 변경 후 서버 재렌더. `role=tablist`·`aria-selected`, 모바일 가로스크롤(UX-DR-U6)

**Given** 글 목록 아이템
**When** 렌더
**Then** 썸네일 없이 제목·summary·태그·작성자·작성일·조회수·댓글수·좋아요수·첨부 아이콘 텍스트형. 제목 클릭=상세, 모바일은 우측 통계가 제목 아래로(UX-DR-U4)

**Given** 빈 게시판
**When** 목록 로드
**Then** EmptyState(원인+다음 행동, [글쓰기] primary 1개), 비회원 클릭 시 로그인 유도 모달(UX-DR-U11)

**Given** 페이지네이션
**When** totalPages>1
**Then** `aria-current=page`·이전/다음, 모바일 축약형(UX-DR-U3)

### Story 2.4: 게시글 상세 SSR 페이지 (참여 슬롯 + 조회수 인프라)

As a 방문자(비회원 포함),
I want 게시글 상세가 서버 렌더링으로 본문·메타·breadcrumb과 함께 즉시 노출되기를,
So that 검색엔진이 전체 콘텐츠를 파싱하고 나는 딥링크로 특정 글을 바로 열람할 수 있다(FR-2.2·FR-2.3·NFR-1).

**Acceptance Criteria:**

**Given** `app/(content)/[category]/[board]/[slug]/page.tsx` 서버 컴포넌트
**When** 유효한 slug로 접근(비회원 포함)
**Then** 제목·작성자·작성일·조회수·본문 HTML·태그·breadcrumb(홈>카테고리>게시판>글)이 SSR HTML에 포함되어 `curl`로 확인된다

**Given** 상세 SEO 메타
**When** 렌더
**Then** `generateMetadata`가 `buildPostMeta` 호출 → 고유 title·description(summary)·canonical·H1 1개·JSON-LD(회원글=DiscussionForumPosting, 운영자글=Article/BlogPosting)·BreadcrumbList(FR-11.1·11.2·11.3·11.5)

**Given** API `GET /api/v1/posts/{slug}`
**When** 서버 컴포넌트 호출
**Then** `PostDetail`(`...contentHtml·contentJson·authorNickname·authorGrade·isOwner...`) 반환. `contentHtml`은 service 레이어 `sanitize-html` 통과(2.6 완성)

**Given** 조회수 인프라(본 에픽 최초 도입, 검수 조정 — Epic 5 재사용)
**When** 상세 진입
**Then** Redis `view:post:{id}` INCR(동일 세션/IP 30분 dedup TTL) + `view-flush` BullMQ 큐·`apps/worker` `view.flush` processor가 주기적으로 DB `view_count`에 flush한다(AR-16·AR-17)

**Given** 존재하지 않는/삭제된 slug
**When** 접근
**Then** 404 + noindex(FR-11.9)

**Given** 참여 기능(좋아요·댓글·신고)이 Epic 5 소유
**When** 상세 렌더
**Then** 본문 하단에 좋아요·댓글·신고 슬롯(`data-slot`)이 레이아웃 공간을 확보한 placeholder로 존재하고 "Epic 5에서 활성화" 안내(disabled)를 보인다

**Given** 글 작성자 본인 로그인
**When** 상세 렌더
**Then** [수정]·[삭제] 버튼 노출(비회원·타인 미노출, 기능은 2.8). [공유]는 URL 클립보드 복사 + 토스트(단순 기능)

### Story 2.5: Tiptap 에디터 full preset + packages/contracts/editor.ts

As a 개발팀,
I want Tiptap `full` preset 에디터와 허용 노드 화이트리스트가 `apps/web/features/editor/`·`packages/contracts/editor.ts`에 정착되기를,
So that 글쓰기·공지·Epic 3·4 에디터가 같은 preset을 재사용하고 서버 새니타이즈와 클라이언트 에디터가 동일 화이트리스트를 공유한다(AR-8·FR-2.5).

**Acceptance Criteria:**

**Given** `packages/contracts/editor.ts`가 없는 상태
**When** 파일 생성
**Then** `FULL_ALLOWED_NODES`(굵게·H2·H3·목록·링크·이미지·코드블록·인용·제한색·형광펜) + `LITE_ALLOWED_NODES`(줄바꿈·링크·이미지·코드블록)가 각 노드 허용 속성까지 명시되어 export. **표·복잡 레이아웃·자유 글자크기·자유 색상 미포함**(FR-2.5)

**Given** `apps/web/features/editor/`가 없는 상태
**When** `Editor.tsx`·`EditorToolbar.tsx`·`Editor.module.css`·`index.ts` 생성
**Then** `<Editor preset="full|lite" .../>`로 사용 가능, preset별 해당 노드만 로드. `'use client'`·web/admin 비공유(AR-8)

**Given** 에디터 로드
**When** 툴바 버튼(굵게·H2/H3·목록·링크·이미지·코드블록·인용·색상·형광펜) 클릭
**Then** `contentJson`이 해당 노드를 포함하고, 제외 기능 버튼은 툴바에 부재(FR-2.5)

**Given** 접근성(UX-DR-U13)
**When** 툴바 버튼 포커스
**Then** 각 버튼 `aria-label`·포커스 링(`{shadow.focus-ring}`)

**Given** 이미지 삽입
**When** 시도
**Then** `alt` 입력 강제(없으면 삽입 비활성). 실 파일 업로드 S3 연동은 범위 외

### Story 2.6: 코드블록 렌더링 + sanitize-html XSS 차단

As a 방문자,
I want 게시글 본문이 코드블록 줄바꿈·들여쓰기·특수문자를 보존하면서 HTML/script 실행 없이 안전하게 렌더되기를,
So that 실전 코드 예제를 그대로 읽고 복사하며 악성 스크립트 실행 걱정이 없다(FR-2.3·FR-2.6·NFR-2).

**Acceptance Criteria:**

**Given** `apps/api`의 posts 상세 service
**When** `content_json`을 HTML로 변환
**Then** Tiptap JSON→HTML 후 `sanitize-html` 화이트리스트(`FULL_ALLOWED_NODES` 파생) 적용. `<script>`·`<iframe>`·`<object>`·`on*` 제거(AR-8)

**Given** 코드블록 포함 글 조회
**When** `contentHtml` 렌더
**Then** 줄바꿈·들여쓰기·특수문자 보존, `<pre><code class="language-{lang}">` 유지, JS 미실행

**Given** 코드블록(하이드레이션 후)
**When** hover/터치
**Then** [복사] 버튼 표시·클립보드 복사·토스트, 가로 스크롤(FR-2.6)

**Given** XSS 페이로드(`<script>`·`<img onerror>`)가 저장된 경우
**When** 상세 렌더
**Then** 스크립트 미실행, 허용 태그만 출력. 단위 테스트 최소 5개 XSS 벡터 커버

**Given** 화이트리스트 공유
**When** `FULL_ALLOWED_NODES` 변경
**Then** `buildSanitizeOptions(allowedNodes)`가 contracts에서 파생되어 서버 새니타이즈·에디터 preset이 단일 소스 공유(테스트로 증명)

### Story 2.7: 게시글 작성 폼 + API (임시저장)

As a 회원,
I want 에디터로 게시글을 작성하고 임시저장·등록하기를,
So that 내 인사이트를 공유하고 필요 시 작업을 이어갈 수 있다(FR-2.4·FR-2.5·UX-DR-U16).

**Acceptance Criteria:**

**Given** 비회원이 [글쓰기] 클릭
**When** 클릭
**Then** 로그인 유도 모달 → 로그인 후 `redirectTo`로 `write` 복귀(UX-DR-U1)

**Given** 회원이 `write` 진입
**When** 로드
**Then** 제목·`full` 에디터·태그(자유+자동완성)·[임시저장]·[등록]·[취소]. board는 진입 경로로 자동 지정(선택 UI 미노출), SEO 입력 비노출(FR-2.4·UX-DR-U16)

**Given** [등록] 클릭
**When** `POST /api/v1/posts`
**Then** service `db.transaction()`으로 posts INSERT + taggable INSERT 원자 처리. `slug`=`slugify(title)`+중복 시 `-{shortid}`. `summary`=`generateSummary()` 자동 저장(FR-11.3). 201 후 상세로 리다이렉트

**Given** [임시저장]
**When** 호출
**Then** `status='draft'` 저장·토스트, 재편집은 `?draftId=`로 복원, 목록 미노출

**Given** 제목/본문 미입력
**When** [등록]
**Then** 인라인 오류, API 미호출. blur 개별 + submit 전체 검증

**Given** 클라이언트 게이팅 우회
**When** 비인증 `POST /api/v1/posts` 직접 호출
**Then** API 401(FR-1.8)

**Given** 태그 입력
**When** 입력
**Then** 기존 태그 `bigm_similarity` 추천 최대 5개 드롭다운, 최대 10개

### Story 2.8: 게시글 수정 + 삭제 (soft-delete)

As a 회원(글 작성자),
I want 내 글을 수정·삭제하기를,
So that 오류를 고치거나 불필요한 글을 직접 관리한다(FR-2.7·AR-7).

**Acceptance Criteria:**

**Given** 작성자가 [수정] 클릭
**When** 클릭
**Then** `[slug]/edit`로 이동, 기존 title·contentJson·tags 채움. board 읽기전용, SEO 비노출

**Given** [저장]
**When** `PATCH /api/v1/posts/{id}`
**Then** service 트랜잭션 posts UPDATE + taggable 재계산. `summary` 재생성, `slug` 불변(NFR-8). 상세로 리다이렉트+토스트

**Given** 작성자 아닌 사용자의 수정/삭제 API 직접 호출
**When** 호출
**Then** 403(user_id 비교)

**Given** [삭제]
**When** 확인 모달 승인
**Then** `status='deleted'`·`deleted_at` soft-delete, 목록·상세 제외, 게시판 목록으로(AR-7)

**Given** 삭제 확인 모달
**When** 열림
**Then** 포커스 트랩·Esc·danger 버튼·배경 스크롤 잠금(UX-DR-U13)

### Story 2.9: 독립 공지 게시판 (운영자 작성 전용 + SSR/SEO)

As a 방문자(비회원 포함),
I want 운영자가 작성한 공지를 `/notice`에서 서버 렌더링으로 열람하기를,
So that 중요한 서비스 공지를 검색엔진을 통해서도 찾고 색인 결과에서 바로 볼 수 있다(FR-15.1~15.3·AR-6).

**Acceptance Criteria:**

**Given** `/notice` 게시판이 `board='notice'`·`category='system'`·`isSystemBoard:true`(2.1 확립)
**When** `notice/page.tsx`·`notice/[slug]/page.tsx` 구현
**Then** 목록은 2.3 컴포넌트, 상세는 2.4 흐름 재사용. **[글쓰기] 버튼 미노출**(운영자만, FR-15.1)

**Given** `/notice/[slug]` SSR
**When** 비회원 접근
**Then** `buildNoticeMeta` → 고유 title·canonical·**Article JSON-LD**·BreadcrumbList. noindex 미적용(공개·색인, FR-15.3)

**Given** 공지 API
**When** `GET /api/v1/posts?board=notice` 호출
**Then** published 공지만 반환. `POST /api/v1/posts`에서 `board='notice'` 요청은 **관리자 세션(Epic 9 Story 9.1에서 확립되는 `admin_sessions`) 없으면 403**. 본 스토리는 **API 게이트만 구현**, 공지 작성 UI는 Epic 9 Story 9.17(검수 조정)

**Given** 상단 고정(`is_pinned`)
**When** 목록 조회
**Then** 핀 글이 최상단 정렬·핀 아이콘(`aria-label`). 핀 설정은 운영자 API, UI는 Epic 9

**Given** 헤더·푸터 링크
**When** 어느 페이지든
**Then** "공지사항" 링크(`/notice`) `<a>` 노출(FR-15.2)

**Given** 공지 sitemap 포함
**When** `/sitemap.xml` 생성(2.2)
**Then** published 공지 URL 포함

### Story 2.10: 게시판 URL 라우팅 완결 + 에픽 통합 검증

As a 개발팀,
I want Epic 2 모든 게시판·공지 경로가 URL 안정성 규칙대로 연결되고 SEO 헬퍼가 전 페이지에 일관 적용됨을 검증하기를,
So that 검색 유입이 보호되고 이후 에픽이 안심하고 `lib/seo` 패턴을 재사용할 수 있다(NFR-8·FR-11.1~11.3·11.5 기반 완결).

**Acceptance Criteria:**

**Given** 모든 board 경로(vibe-coding/automation/monetization 계열 + `/lounge/ai-creation|ai-products|talk|gigs` + `/notice`)
**When** 각 경로 GET(비회원 curl 포함)
**Then** 모두 200, SSR HTML에 `<h1>` 정확히 1개·`<title>`·canonical 일치. 미존재 board는 404

**Given** slug가 제목 변경 없이 수정됨(2.8)
**When** 기존 URL 접근
**Then** 동일 slug 200 유지(NFR-8)

**Given** JSON-LD 빌더
**When** 목록=CollectionPage+BreadcrumbList, 상세=Article/DiscussionForumPosting+BreadcrumbList, 공지=Article+BreadcrumbList 출력
**Then** 각 JSON이 유효 Schema.org 구조(`@context`·`@type`·`name`/`headline`), Vitest 스냅샷 검증

**Given** `generateSummary`가 2.7·2.9에서 호출
**When** 새 글·공지 등록
**Then** `posts.summary`가 null 아닌 ≤200자, 상세 meta description에 반영(FR-11.3)

**Given** 비회원이 `/lounge/talk`·`/lounge/ai-creation` 접근
**When** SSR 렌더
**Then** FR-5.1대로 공통 게시판 구조 정상 렌더, [글쓰기] 클릭 시 로그인 유도(FR-5.1 완결). (`/lounge/ai-creation` 창작 스펙은 2.11, `/lounge/gigs` 의뢰소 구조화는 2.12에서 검증)

**Given** `pnpm turbo run typecheck lint test`
**When** Epic 2 완료 후 실행
**Then** 타입 오류 0·린트 경고 0, `seo.test.ts`·`sanitize.test.ts`·`jsonld.test.ts` 포함 전 테스트 통과, contracts(editor/post/board) 순환 의존 없음

### Story 2.11: AI 창작마당 창작물 스펙 — 선택 입력 + 상세 우측 패널

As a AI 창작마당에 창작물을 올리는 회원,
I want 사용한 AI 툴·프롬프트·파라미터 등 제작 스펙을 선택적으로 첨부하기를,
So that 다른 사람이 내 창작물을 어떻게 만들었는지 이해하고 재현·학습할 수 있다(FR-5.2).

**Acceptance Criteria:**

**Given** `packages/database`에 창작 스펙 테이블이 없는 상태
**When** `post_creative_spec` 스키마 생성 + `drizzle-kit generate && migrate`
**Then** `post_id` uuid PK·FK(`posts.id`, 1:1·`on delete cascade`)·`media_type` enum(image/video/audio/3d/etc nullable)·`tools` jsonb(배열: `{name, model, role}` — 다중·파이프라인)·`prompt` text nullable·`negative_prompt` text nullable·`params` jsonb(시드·화면비/해상도·길이/fps·steps/CFG/sampler 등 자유 key-value)·`postprocess` jsonb nullable(업스케일·편집툴·ControlNet/LoRA·img2img 참조)·`cost_type` enum(free/paid nullable)·`time_spent` text nullable·`license_note` text nullable·타임스탬프 컬럼이 생성된다(전 필드 nullable=선택)

**Given** `packages/contracts`에 `creativeSpecSchema`(Zod, 전 필드 optional)
**When** api·web import
**Then** typecheck 통과, 작성/수정 계약이 글쓰기(2.7)·수정(2.8) 폼과 결합

**Given** AI 창작마당(`/lounge/ai-creation`) 글쓰기 폼
**When** 회원이 [창작 스펙 추가] 접이식 섹션을 펼쳐 일부/전체 항목 입력 또는 미입력
**Then** 스펙 블록은 선택이므로 미입력 시 spec 레코드 없이 글이 등록되고, 입력 시 `post_creative_spec`이 1:1로 저장된다(다른 board에서는 이 섹션 비노출 — `hasCreativeSpec` 플래그 기준)

**Given** 창작 스펙이 있는 글 상세(`/lounge/ai-creation/{slug}`)
**When** SSR 렌더(데스크톱)
**Then** 본문 우측 사이드 패널에 "창작 스펙"이 표시되고(툴·프롬프트·파라미터·후처리·라이선스), 프롬프트/네거티브는 코드블록형 + 복사 버튼이며, 모바일에서는 본문 하단으로 접혀 노출된다

**Given** 스펙 없는 창작마당 글
**When** 상세 렌더
**Then** 우측 패널 자리는 비거나 생략되고 레이아웃이 깨지지 않는다(EmptyState/조건부 렌더)

**Given** 프롬프트 등 사용자 입력
**When** 저장·렌더
**Then** XSS 새니타이즈(FR-2.3 패턴 재사용)·길이 제한이 적용되고, 이미지/영상 본문은 ImageObject/VideoObject JSON-LD에 가능 시 `creator`/툴 정보를 보강한다(FR-11.5 연계, 과도 금지)

### Story 2.12: 작당 의뢰소(구인·외주) — 구조화 폼 + 모집 상태 + 상세 표시

As a AI 외주를 맡기거나 받으려는 회원,
I want 의뢰/구직 글을 구조화된 형식으로 올리고 쪽지로 소통하기를,
So that 외주·협업 상대를 분야·예산·상태 기준으로 빠르게 찾고 연결된다(FR-5.3).

**Acceptance Criteria:**

**Given** `packages/database`에 의뢰소 스펙 테이블이 없는 상태
**When** `recruit_post` 스키마 생성 + `drizzle-kit generate && migrate`
**Then** `post_id` uuid PK·FK(`posts.id`, 1:1·cascade)·`post_kind` enum(`request`(의뢰)/`offer`(구직), NOT NULL)·`fields` jsonb(분야 다중, NOT NULL)·`recruit_status` enum(`open`(모집중)/`closed`(마감) default `open`)·`budget` text nullable·`duration` text nullable·`work_mode` enum(remote/onsite/hybrid nullable)·`contact_method` jsonb(NOT NULL — 쪽지 기본 + 외부 연락 optional)·타임스탬프가 생성되고, `(post_kind, recruit_status)`·`fields` 조회 인덱스가 만들어진다

**Given** `packages/contracts`에 `recruitPostSchema`(필수/선택 구분)
**When** 의뢰소(`/lounge/gigs`) 글쓰기 폼 렌더
**Then** 글 유형(의뢰/구직)·분야(다중)·모집 상태·연락 방법은 필수, 예산·기간·진행 방식은 선택으로 검증되고, 필수 누락 시 인라인 오류로 등록이 막힌다

**Given** 회원이 의뢰/구직 글을 등록
**When** 제출
**Then** `posts`(board=`gigs`) + `recruit_post`가 함께 생성되고, 거래 보증 없음·직거래 사기 주의 고지가 폼·상세에 필수 노출된다

**Given** 의뢰소 목록(`/lounge/gigs`)
**When** SSR 렌더
**Then** 글 유형·분야·모집 상태 필터가 동작하고, 각 항목에 유형 배지(의뢰/구직)·분야·모집중/마감 배지가 표시된다(마감 글은 시각적 구분)

**Given** 의뢰/구직 글 상세
**When** 렌더
**Then** 의뢰 정보 카드(유형·분야·예산·기간·진행 방식·연락 방법)와 모집중/마감 배지가 표시되고, [쪽지 보내기] 버튼은 슬롯으로 두어 실제 쪽지(Epic 7 FR-13)·차단(Epic 5 5.11)과 연계된다

**Given** 작성자 본인
**When** 모집 상태를 모집중↔마감 토글
**Then** `recruit_status`가 갱신되고 목록·상세 배지에 즉시 반영된다(본인만 가능, 권한 검증)

**Given** 비회원이 의뢰소 접근·작성 시도
**When** [글쓰기]/[쪽지 보내기] 클릭
**Then** 열람은 가능(SSR·색인), 작성·연락은 로그인 유도(행동 게이팅)된다

---

## Epic 3: 묻고답하기 (Q&A)

단일 통합 묻고답하기를 구현한다. 질문은 게시글형으로 작성되고 답변은 확장 댓글형으로 달린다. 상태값(답변대기·답변있음·해결됨)은 `packages/core/qna.ts`의 순수 함수 `deriveQuestionStatus`로 도출하며 DB에 직접 저장하지 않는다. 질문 작성자는 1개의 답변을 "도움된 답변"으로 표시할 수 있고(보상·마감 미연결), 질문자 본인이 "해결됨"으로 직접 전환한다. 목록·상세는 SSR로 렌더하고 상태 필터·정렬은 URL 쿼리에 반영한다. 답변 단위 좋아요·신고는 슬롯만 두고 Epic 5에서 활성화한다. QAPage JSON-LD는 이 에픽에서 완결한다.

> **경계 엄수:** `reaction`·`report` 테이블은 Epic 5 소유 — 답변 좋아요·신고는 슬롯만. `deriveQuestionStatus`는 `packages/core/qna.ts` 순수 함수(라우트·컴포넌트 인라인 도출 금지). `question`·`answer` 테이블은 3.1에서 완결. Epic 2의 SEO·에디터·SSR 패턴 재사용.

### Story 3.1: Q&A 스키마 · `deriveQuestionStatus` · contracts

As a 개발팀,
I want `question`·`answer` 테이블, `core/qna.ts` 상태 도출 순수 함수, `contracts/qna.ts` Zod 계약이 한 번에 정착되기를,
So that 이후 모든 Q&A 스토리가 동일 도메인 모델·타입을 재사용하고 상태 도출 로직이 한 곳에 집중된다.

**Acceptance Criteria:**

**Given** AR-6 다형성 모델(question·answer 분리, 태그=taggable 다형)
**When** `questions`·`answers` 스키마 작성 후 `drizzle-kit generate`+`migrate`
**Then** `questions`(`id`·`user_id`FK·`title`·`content_json`·`is_resolved` default false·`helpful_answer_id` nullable FK→answers·`view_count`·`status` enum·`deleted_at`·타임스탬프)와 `answers`(`id`·`question_id`FK·`user_id`FK·`content_json`·`status` enum·`deleted_at`·타임스탬프)가 생성되고, 질문↔태그가 taggable(`target_type='question'`)로 연결 가능하다(AR-6)

**Given** `core/qna.ts`에 `deriveQuestionStatus` 구현
**When** 공개 답변 배열·`isResolved`를 인자로 호출
**Then** 답변 0+미해결='답변대기', 답변 1+미해결='답변있음', 해결=답변 수 무관 '해결됨'을 반환하고 Vitest 세 분기 통과(FR-3.3)

**Given** `contracts/qna.ts` 미존재
**When** `createQuestionSchema`·`createAnswerSchema`·`updateQuestionStatusSchema`·`setHelpfulAnswerSchema`·`questionListQuerySchema`·`questionDetailResponseSchema`·`answerResponseSchema`를 정의·재노출
**Then** api·web가 동일 contracts를 import해 전 워크스페이스 typecheck 통과(AR-13)

**Given** `status='deleted'` 답변(soft-delete, AR-7)
**When** `deriveQuestionStatus` 호출
**Then** 삭제된 답변은 공개 배열에서 제외되어 상태 도출에 미반영(유일 답변 삭제 시 '답변대기' 복귀, Vitest 검증)

### Story 3.2: Q&A 목록 페이지 (SSR · 상태 필터 칩 · URL 상태)

As a 방문자(비회원 포함),
I want `/qna`에서 질문 목록을 상태 필터·정렬로 탐색하고 URL로 공유하기를,
So that 답변 대기 질문이나 해결된 사례를 빠르게 발견한다.

**Acceptance Criteria:**

**Given** 비회원이 `/qna` 진입
**When** SSR 렌더
**Then** 질문 목록(상태 배지·제목·요약·태그·작성자·작성일·답변수)이 서버 컴포넌트로 노출, `<h1>묻고답하기` 1개·breadcrumb JSON-LD·고유 title/description/canonical 포함(FR-3.2·11.1·11.2·UX-DR-U2)

**Given** 상태 필터 칩(전체/답변대기/답변있음/해결됨/인기질문)
**When** 칩 클릭
**Then** URL 쿼리(`?status=`) 반영·필터링, 뒤로가기 후 복원(UX-DR-U2·U6)

**Given** API `GET /api/v1/qna/questions?page=&pageSize=20&status=&sort=`
**When** `questionListQuerySchema` 검증된 호출
**Then** `{ items, meta }` 오프셋 페이지네이션. `status` 필터는 answers 건수·`is_resolved`로 서버 필터링(`deriveQuestionStatus`와 동일 논리)

**Given** 빈 목록
**When** 결과 0건
**Then** EmptyState("조건에 맞는 질문이 없어요...")+[질문하기] primary(UX-DR-U11)

**Given** 페이지네이션
**When** 총 결과>pageSize
**Then** `aria-current=page`·이전/다음, 모바일 축약형(UX-DR-U3)

**Given** 목록 아이템 상태 배지
**When** 표시
**Then** `deriveQuestionStatus` 결과가 색상+텍스트 동반 배지로 렌더(UX-DR-U13)

### Story 3.3: 질문 작성 (`/qna/ask`) · 태그 · 임시저장

As a 회원,
I want 질문 제목·본문(코드블록·이미지 포함)·태그를 입력하고 임시저장·등록하기를,
So that 내 문제를 명확히 전달하고 나중에 이어 작성한다.

**Acceptance Criteria:**

**Given** 비회원이 `/qna/ask` 진입/[질문하기] 클릭
**When** 시도
**Then** 로그인 유도 모달, 로그인 후 `?redirectTo=` 복귀(UX-DR-U1·FR-1.8)

**Given** 회원이 `/qna/ask` 진입
**When** 로드
**Then** 제목·Tiptap `lite` preset 에디터(줄바꿈·링크·이미지·코드블록)·태그(자유+자동완성)·[임시저장]·[등록]·[취소], SEO 입력 비노출(FR-3.5·3.6·AR-8·FR-11.1)

**Given** 유효 입력 후 [등록]
**When** `POST /api/v1/qna/questions`(`createQuestionSchema`)
**Then** `status='published'`·`is_resolved=false` 저장, `/qna/{slug}` 리다이렉트+토스트. `content_json` Tiptap JSON 저장(HTML 원본 미저장, AR-8)

**Given** 태그 입력
**When** 입력
**Then** 자동완성 제공, 선택/자유입력 후 taggable(`target_type='question'`) 생성(FR-6.4·AR-6)

**Given** [임시저장]
**When** `status='draft'` 저장
**Then** 드래프트 저장, 재진입 시 복원(FR-3.5)

**Given** 필수(제목/본문) 미입력 후 [등록]
**When** 제출
**Then** 인라인 오류, API 미호출, 입력 유지(UX-DR-U11)

### Story 3.4: 각 대메뉴 [질문하기] → Q&A 작성 + 관련 태그 자동 부착

As a 회원,
I want 각 대메뉴에서 [질문하기] 시 Q&A 작성 화면으로 이동되고 관련 태그가 자동 부착되기를,
So that 컨텍스트를 잃지 않고 바로 질문한다.

**Acceptance Criteria:**

**Given** `/vibe-coding`에서 [질문하기] 클릭(회원)
**When** 클릭
**Then** `/qna/ask?tags=vibe-coding`으로 이동, `vibe-coding` 태그 부착 상태로 에디터 오픈(FR-3.9)

**Given** `/automation`·`/monetization`·`/lounge/*` 등
**When** 각 진입점 클릭
**Then** 대응 태그(automation·monetization·ai-creation 등) 자동 부착되어 `createQuestionSchema.tags`에 포함

**Given** 자동 부착 태그
**When** 확인
**Then** 삭제·추가 자유(강제 고정 아님)

**Given** 비회원이 [질문하기] 클릭
**When** 시도
**Then** 로그인 유도 모달, 로그인 후 태그 붙은 작성 화면 복귀(`redirectTo`)

### Story 3.5: 질문 상세 페이지 (SSR · 상태 배지 · 질문자 액션)

As a 방문자(비회원 포함),
I want 질문 상세에서 제목·상태·태그·본문·첨부를 읽고, 질문자는 수정·삭제·해결됨 변경을 하기를,
So that 맥락·상태를 즉시 파악하고 질문자는 수명 주기를 직접 관리한다.

**Acceptance Criteria:**

**Given** 비회원이 `/qna/{slug}` 진입
**When** SSR 렌더
**Then** 제목(H1)·상태 배지·태그·메타·본문 HTML(Tiptap→`sanitize-html` lite 화이트리스트)·첨부·답변 영역 노출, breadcrumb JSON-LD·고유 메타 포함(FR-3.4·NFR-1·AR-8)

**Given** 상태 배지
**When** 답변 0+미해결 / 1+ / 해결
**Then** '답변대기'(warning)/'답변있음'(success/info)/'해결됨'(success) 배지가 색+텍스트(UX-DR-U8·U13)

**Given** 질문 작성자 로그인
**When** 렌더
**Then** [수정]·[삭제]·[해결됨으로 표시] 노출(비작성자·비회원 미노출)

**Given** [해결됨으로 표시]
**When** `PATCH /api/v1/qna/questions/{id}/resolve`
**Then** `is_resolved=true` 갱신·낙관적 배지 교체. 요청자≠질문자면 403

**Given** [삭제]
**When** 확인 모달 후 `DELETE`
**Then** `status='deleted'`·`deleted_at` soft-delete, `/qna`로 리다이렉트(AR-7)

**Given** 조회수
**When** 상세 진입
**Then** Redis 버퍼 기록 + `view-flush` 큐 worker가 DB flush(Epic 2 도입 인프라 재사용, AR-16·17)

### Story 3.6: 답변 작성 · 수정 · 삭제 (확장 댓글형)

As a 회원,
I want 질문 상세에서 여러 줄·코드블록·이미지를 포함한 답변을 작성·수정·삭제하기를,
So that 내 지식을 명확히 전달하고 필요 시 고친다.

**Acceptance Criteria:**

**Given** 비회원이 답변 입력 시도
**When** 클릭
**Then** 로그인 유도 모달, 복귀(UX-DR-U1)

**Given** 회원이 답변 작성 후 [답변 등록]
**When** `POST /api/v1/qna/questions/{questionId}/answers`(`createAnswerSchema`)
**Then** `status='published'` 저장·즉시 노출, `content_json` 저장(AR-8), 등록 직후 `deriveQuestionStatus` 재평가로 '답변있음' 갱신(FR-3.6·3.3)

**Given** `lite` preset(AR-8·FR-3.6)
**When** 에디터 렌더
**Then** 줄바꿈·링크·이미지·코드블록만 허용, contracts/editor.ts lite 화이트리스트와 서버 sanitize 일치

**Given** 작성자 본인 [수정]/[삭제]
**When** `PATCH`/`DELETE /api/v1/qna/answers/{id}`
**Then** 수정 시 content_json·updated_at 갱신, 삭제 시 soft-delete. 비작성자 403. 유일 공개 답변 삭제 시 '답변대기' 복귀(AR-7)

**Given** 답변 좋아요·신고 슬롯(Epic 5 예약)
**When** 답변 렌더
**Then** 좋아요 수(0)·신고 슬롯 마크업 존재하되 `aria-disabled`, "Epic 5에서 활성화" 주석(FR-3.8)

### Story 3.7: 도움된 답변 지정 · 변경 (질문자 전용)

As a 질문 작성자,
I want 도움이 된 답변 1개에 "도움된 답변"을 표시하고 언제든 바꾸기를,
So that 답변자 기여를 가볍게 인정하되 정답·마감·보상 없이 운영된다.

**Acceptance Criteria:**

**Given** 질문 작성자 로그인(답변 1+)
**When** 답변 목록 렌더
**Then** [도움된 답변으로 표시] 토글이 질문 작성자에게만 표시(비작성자·비회원 미노출, FR-3.7·UX-DR-U8)

**Given** [도움된 답변으로 표시] 클릭
**When** `PATCH /api/v1/qna/questions/{questionId}/helpful-answer`(`setHelpfulAnswerSchema`)
**Then** `helpful_answer_id` 갱신·낙관적 배지·토스트(FR-3.7)

**Given** 이미 지정된 상태에서 다른 답변 지정
**When** API 호출
**Then** `helpful_answer_id` 교체(1개만), 기존 표시 제거

**Given** 배지 표시
**When** 렌더
**Then** "도움된 답변" 텍스트+아이콘 배지, "채택/정답/내공" 표현 미사용, 포인트/등급/마감 연산 미발생(FR-3.7)

**Given** 비작성자/비회원의 직접 API 호출
**When** 호출
**Then** 403/401(FR-1.8)

**Given** 지정 취소(동일 답변 재클릭)
**When** 클릭
**Then** `helpful_answer_id=null`·배지 제거, 언제든 재지정(FR-3.7)

### Story 3.8: 질문 수정 + 태그 수정

As a 질문 작성자,
I want 내 질문의 제목·본문·태그를 수정하기를,
So that 추가 정보 제공·오류 수정을 한다.

**Acceptance Criteria:**

**Given** 작성자가 [수정] 클릭
**When** `/qna/{slug}/edit` 진입
**Then** 기존 제목·content_json·태그 복원, 비작성자 직접 접근 시 403(FR-3.5)

**Given** 수정 후 [저장]
**When** `PATCH /api/v1/qna/questions/{id}`
**Then** 갱신·updated_at·수정된 상세로 리다이렉트

**Given** 태그 수정
**When** 제거/추가
**Then** taggable 삭제·삽입(AR-6), 변경 태그 반영

**Given** 필수 항목 삭제 후 [저장]
**When** 제출
**Then** 인라인 오류·저장 차단·입력 유지

### Story 3.9: QAPage JSON-LD + Q&A SEO 메타 완결

As a 검색 엔진/AI 검색,
I want 질문 상세에서 QAPage JSON-LD와 정확한 SEO 메타를 즉시 파싱하기를,
So that Q&A 콘텐츠가 검색 결과에 풍부하게 노출된다(FR-11.5).

**Acceptance Criteria:**

**Given** 질문 상세(공개 답변 1+)
**When** SSR HTML 확인
**Then** QAPage JSON-LD(`mainEntity:Question` + `name`·`text`·`answerCount`·`dateCreated`·`author`, `helpful_answer_id` 있으면 `acceptedAnswer`, 나머지는 `suggestedAnswer`)가 포함(FR-11.5)

**Given** 답변 0개 질문
**When** 확인
**Then** `answerCount:0`, `acceptedAnswer`·`suggestedAnswer` 키 생략

**Given** `/qna` 목록
**When** 확인
**Then** CollectionPage JSON-LD + 고유 title·description·canonical, `generateMetadata`로 구현(FR-11.1·UX-DR-U16)

**Given** JSON-LD 헬퍼
**When** `lib/seo`에 `buildQAPageJsonLD` 구현
**Then** Epic 2 헬퍼 패턴 재사용·중복 없음, 출력이 유효 스키마임을 유닛 테스트로 검증

---

## Epic 4: 실전자료 (다운로드형 자료실 + 업로드 보안)

카드형 자료 목록(유형 탭·정렬·필터)·자료 상세(다운로드 영역·사용법·주의사항·버전·참고링크·평점)·단일 등록 폼·다운로드(로그인 게이팅 + 다운로드 수 집계)·업로드 보안 파이프라인(확장자/매직넘버 → S3(R2/MinIO) → worker ClamAV 스캔 → 통과 공개/감염 격리)·평점(1~5)을 구현한다. 등록 시 저작권/배포 동의(FR-14.2), SoftwareSourceCode/CreativeWork/DigitalDocument JSON-LD 확장(FR-11.5). Epic 5(댓글·좋아요·신고·북마크) 기능은 슬롯만 둔다.

> **경계 엄수:** `resource`·`resource_file`·`rating` 테이블은 이 에픽 소유. `comment`·`reaction`·`bookmark`·`report` 테이블은 만들지 않음(후기 댓글·좋아요·신고·북마크는 슬롯+"Epic 5 활성화"). 평점(1~5)·다운로드 집계는 자료 고유로 이 에픽 완결. Epic 2 SSR/SEO 패턴·Epic 1 게이팅 재사용. **어드민 자료 사후 관리(FR-10.3)는 관리자 인증이 Epic 9에서 생성되므로 Epic 9 Story 9.8 소유**(검수 조정 — 본 에픽에 어드민 스토리 미포함).

### Story 4.1: `resource`·`resource_file`·`rating` 스키마 + API 계약

As a 개발팀,
I want 실전자료 도메인의 DB 스키마와 API Zod 계약이 한 번에 확정되기를,
So that 이후 4.2~4.9가 스키마 충돌 없이 동일 계약 위에서 구현된다.

**Acceptance Criteria:**

**Given** 자료 스키마 추가 작업
**When** `resources`·`resource_files`·`ratings` Drizzle 스키마·마이그레이션 생성·`migrate`
**Then** 다음이 적용된다:
- `resources`: `id`PK·`user_id`FK·`slug`unique·`title`·`summary`·`resource_type` enum(`prompt|claude-code-skill|mcp|rules-config|template-checklist`)·`environment` text[]·`difficulty` enum·`description_json`·`usage_json`·`caution_json`(Tiptap JSON)·`version`·`reference_links` jsonb·`status` enum(draft|published|hidden|deleted)·`copyright_agreed` boolean notNull·`download_count`·`avg_rating` numeric(3,2)·`rating_count`·타임스탬프·`deleted_at`
- `resource_files`: `id`PK·`resource_id`FK·`original_name`·`storage_key`·`file_size`·`mime_type`·`allowed_extension` enum·`is_primary` boolean·`scan_status` enum(`pending|clean|infected|error`)·`scan_completed_at`·`display_order`
- `ratings`: `id`PK·`resource_id`FK·`user_id`FK·`score` smallint 1~5 CHECK·타임스탬프·unique(`resource_id`,`user_id`)
**And** `is_primary=true`가 resource당 정확히 1개임을 보장하는 설계 결정이 주석으로 명시

**Given** `contracts/resource.ts`
**When** Zod 스키마 정의
**Then** `resourceTypeSchema`·`difficultySchema`·`scanStatusSchema`·`createResourceSchema`·`resourceCardSchema`·`resourceDetailSchema`·`listResourcesQuerySchema`·`ratingSchema`·`ratingResponseSchema` export·재노출

**Given** `commentCount`가 `resourceCardSchema`에 포함
**When** Epic 5 이전 시점 응답
**Then** 항상 0 반환, `// TODO: Epic 5 활성화` 주석

### Story 4.2: 실전자료 목록 페이지 (카드형 + 유형 탭 + 필터 + SSR)

As a 방문자(비회원 포함),
I want 실전자료를 카드형으로 탐색하고 유형 탭·필터·정렬로 좁혀보기를,
So that 원하는 자료를 빠르게 발견한다.

**Acceptance Criteria:**

**Given** `/resources` 또는 `/resources/{type}` 진입(비회원 포함)
**When** SSR 렌더
**Then** published 자료 카드 목록이 파싱 가능 HTML로 제공, `generateMetadata` 고유 메타·canonical(FR-11.1·NFR-1)

**Given** 유형 탭(전체/프롬프트/Claude Code Skill/MCP/Rules·설정/템플릿·체크리스트)
**When** 클릭
**Then** URL `?type=` 반영·`aria-selected`·해당 유형만 렌더(UX-DR-U2·U6·FR-4.1)

**Given** 필터 영역
**When** 지원환경 칩(다중)·난이도 Select·정렬 Select(최신/인기/평점/다운로드/후기) 변경
**Then** URL 쿼리 반영·갱신·활성 필터칩 강조(UX-DR-U6·FR-4.2)

**Given** 모바일(<768px)
**When** 필터 표시
**Then** 필터 아코디언 접힘, 카드 [다운로드]·[상세보기] 2버튼, 클릭 충돌 없음(UX-DR-U14·U5)

**Given** 카드
**When** 렌더
**Then** 유형·자료명·한줄설명·지원환경·난이도·업데이트일·태그·평점(별+숫자)·다운로드수·후기수(Epic 5 전 0)·[다운로드]·[상세보기](UX-DR-U13·FR-4.1)

**Given** published 자료 없음
**When** 렌더
**Then** EmptyState+[등록하기](UX-DR-U11)

**Given** 페이지네이션
**When** 렌더
**Then** `aria-current=page`·모바일 축약·무한스크롤 미사용(UX-DR-U3·AR-13)

### Story 4.3: 자료 상세 페이지 (SSR + JSON-LD + 다운로드 슬롯)

As a 방문자(비회원 포함),
I want 자료 상세에서 설명·사용법·주의사항·버전·참고링크를 확인하고 다운로드 영역을 보기를,
So that 자료가 내 상황에 맞는지 판단 후 다운로드를 결정한다.

**Acceptance Criteria:**

**Given** `/resources/{slug}` 진입(비회원 포함)
**When** SSR 렌더
**Then** `generateMetadata`(자료명·summary·canonical) + JSON-LD(`resourceType`별 SoftwareSourceCode/CreativeWork/DigitalDocument, `name`·`description`·`author`·`dateModified`·`fileFormat`·`url`) + BreadcrumbList(홈>실전자료>자료명) + H1 1개(FR-11.5·11.2·UX-DR-U16)

**Given** 자료 상세
**When** 렌더
**Then** ①메타 ②다운로드 영역(대표 파일+첨부, [다운로드] 슬롯) ③"이 자료는 무엇인가요"(description_json) ④사용법(usage_json) ⑤주의사항(nullable) ⑥참고링크(nullable) ⑦평점 영역(avg_rating·count+입력 슬롯) ⑧후기 댓글 슬롯(Epic 5) ⑨좋아요·신고·북마크 슬롯(Epic 5) ⑩[목록으로](FR-4.3)

**Given** 모바일(<768px)
**When** 스크롤
**Then** 다운로드 버튼 하단 고정 바(UX-DR-U14)

**Given** 미존재/삭제 slug
**When** 접근
**Then** 404+noindex(FR-11.9)

**Given** `status=hidden` 자료
**When** 비회원·일반 회원 접근
**Then** 404(운영자만 접근, FR-4.8)

### Story 4.4: 자료 등록 폼 (단일 폼 + 저작권 동의 + 임시저장)

As a 회원,
I want 단일 폼 흐름(유형→공통정보→첨부→사용법/주의사항→태그→미리보기→등록)으로 자료를 등록하기를,
So that 어떤 유형이든 같은 경험으로 빠르게 기여한다.

**Acceptance Criteria:**

**Given** 비회원 [등록] 클릭
**When** 클릭
**Then** 게이팅 모달, 로그인 후 `/resources/new` `redirectTo` 복귀(UX-DR-U1·FR-4.8)

**Given** Step 1(유형 선택)
**When** 렌더
**Then** 6개 유형 카드 표시·선택 시 Step 2, 선택 유형 상단 고정

**Given** Step 2(공통 정보)
**When** 제목·한줄설명·지원환경(체크박스)·난이도 입력
**Then** 유형별 안내 문구만 다르고 구조 동일(FR-4.4), "이 자료는 무엇인가요" Tiptap `full`(AR-8)

**Given** Step 3(첨부)
**When** 드래그앤드롭/클릭
**Then** 허용 확장자(.zip .md .txt .json .pdf .docx .xlsx)·최대 3개·대표 1개·위반 인라인 오류(UX-DR-U9·FR-4.5), 50MB/개 초과 오류

**Given** Step 4(사용법/주의사항)
**When** 입력
**Then** 사용법 필수(lite)·주의사항 선택

**Given** Step 5(태그)
**When** 입력
**Then** 자유+자동완성(FR-6.4)

**Given** Step 6(미리보기)
**When** 렌더
**Then** 상세와 동일 레이아웃 미리보기, [수정하기]로 복귀

**Given** Step 7(등록) — 저작권 동의 미체크
**When** 등록 버튼 상태
**Then** 비활성. 레이블 "이 자료의 저작권을 보유하거나 배포 권한이 있음을 확인합니다"(FR-14.2)

**Given** 동의 체크 후 [등록]
**When** `POST /api/v1/resources`
**Then** `copyright_agreed=true`·`status=published`(즉시 공개) 생성, 첨부 S3 업로드·`scan_status=pending`, 상세로 이동+토스트(FR-4.8)

**Given** 이탈/[임시저장]
**When** 임시저장
**Then** `status=draft` 저장, `/me/activity` 자료 탭에서 재편집, 본인만 열람

**Given** 등록 API 오류
**When** 실패
**Then** danger 토스트·입력 유지·제출 중 버튼 비활성(UX-DR-U11)

### Story 4.5: 파일 업로드 보안 파이프라인 (확장자/매직넘버 → S3 → ClamAV worker)

As a 시스템,
I want 첨부 파일이 확장자·매직넘버 검증 → S3 저장(검사중) → worker ClamAV 스캔 → 통과 공개/감염 격리 순으로 처리되기를,
So that 악성 파일이 공개 다운로드 경로에 노출되지 않는다(NFR-2·AR-15).

**Acceptance Criteria:**

**Given** `POST`/`PATCH /api/v1/resources`에 파일 첨부
**When** api resource service 처리
**Then** ①확장자 검증(미허용 400 INVALID_FILE_TYPE) ②매직넘버 검증(불일치 400 INVALID_FILE_SIGNATURE) ③S3 업로드(`{resource_id}/{uuid}.{ext}`)·`resource_files` `scan_status=pending` 생성 ④`file-scan` 큐에 `resource.scan` 발행(AR-16). DB insert는 service 트랜잭션, S3·큐는 트랜잭션 외(AR-2)

**Given** `apps/worker` `resource.scan` processor
**When** job 처리
**Then** ①S3 스트림 다운로드 ②ClamAV clamd 스캔 ③CLEAN=`scan_status=clean`·완료 시 published 전환 ④FOUND=`infected`·private `quarantine/` 이동·public 삭제·운영자 알림 이벤트(`// TODO: Epic 7`) ⑤에러=`error`·재시도(max 3, backoff)

**Given** 멱등 설계
**When** 동일 job 재시도
**Then** 이미 clean/infected면 재처리 없이 성공(AR-16)

**Given** `scan_status=pending` 자료
**When** 조회
**Then** published로 표시되되 다운로드 버튼 "검사 중" 비활성

**Given** `scan_status=infected` 파일
**When** 조회
**Then** 다운로드 버튼 숨김·"보안 검사 문제 발견" 안내

### Story 4.6: 다운로드 (로그인 게이팅 + 다운로드 수 집계)

As a 회원,
I want [다운로드]로 파일을 받고 비회원이면 로그인 후 자동 다운로드가 시작되기를,
So that 마찰 없이 자료를 활용한다(FR-4.6).

**Acceptance Criteria:**

**Given** 비회원 [다운로드] 클릭
**When** 클릭
**Then** 로그인 유도 모달, 로그인 후 `redirectTo`로 자료 상세 복귀·**다운로드 자동 시작**(UX-DR-U1·U5·FR-4.6)

**Given** 회원 [다운로드](clean 대표 파일)
**When** `POST /api/v1/resources/{id}/download`
**Then** ①인증(401 if 미인증) ②`is_primary=true`·`clean` 파일 storage_key 조회 ③presigned URL(60초) 반환 ④`download_count` +1(대표 파일 기준) ⑤클라이언트 다운로드 시작

**Given** 동시 다수 요청
**When** 카운트 업데이트
**Then** 원자적 increment 또는 `stats` 큐 비동기 집계(NFR-6·AR-16)

**Given** `scan_status=pending`/`infected` 대표 파일
**When** 다운로드 호출
**Then** 409 RESOURCE_SCAN_PENDING / 403 RESOURCE_INFECTED

**Given** 비대표 파일 [다운로드]
**When** 회원 클릭
**Then** presigned URL 반환하되 다운로드 카운트 미집계(대표 파일만, FR-4.6)

### Story 4.7: 평점 (1~5 등록·수정·집계)

As a 회원,
I want 자료에 1~5점 평점을 남기고 수정하기를,
So that 내 경험을 공유하고 다음 사용자의 신뢰 판단을 돕는다(FR-4.7).

**Acceptance Criteria:**

**Given** 비회원이 평점 영역
**When** 렌더
**Then** avg_rating·rating_count 표시, 입력 UI는 "로그인 후 평점" 비활성·클릭 시 게이팅 모달(UX-DR-U1)

**Given** 회원이 별점(1~5) 클릭
**When** `POST`/`PATCH /api/v1/resources/{id}/ratings`(unique upsert)
**Then** `ratings` upsert, `avg_rating`·`rating_count` 재계산·갱신(service 트랜잭션, AR-2)

**Given** 본인 평점 확인
**When** 상세 렌더(로그인)
**Then** `GET .../ratings/me`로 기존 값 채움

**Given** 동일 회원 재평점
**When** 두 번째 제출
**Then** upsert로 갱신(409 없음)

**Given** 자기 자신 자료에 평점
**When** 호출
**Then** 403 SELF_RATING_NOT_ALLOWED(어뷰징 방지, AR-12)

### Story 4.8: 본인 자료 수정·삭제 + 상태 관리

As a 자료 등록자(회원),
I want 내 자료를 수정·삭제하고 상태를 관리하기를,
So that 정확성을 유지하고 불필요한 자료를 제거한다(FR-4.8).

**Acceptance Criteria:**

**Given** 등록자가 본인 자료 상세
**When** 렌더
**Then** [수정하기]·[삭제하기] 노출(타인 미노출)

**Given** [수정하기] 후 저장
**When** `PATCH /api/v1/resources/{id}`
**Then** 변경 반영, 새 파일 첨부 시 4.5 보안 파이프라인 재실행(scan_status=pending)

**Given** 기존 파일 교체
**When** 수정 제출
**Then** 기존 S3 즉시 삭제 않고 `resource_files.status=deleted` soft-mark, `cleanup` 큐 위임(`// TODO: Epic 9 cleanup`)

**Given** [삭제하기]
**When** 확인 다이얼로그 승인
**Then** `status=deleted`·`deleted_at` soft-delete, 목록 제외·`/resources` 이동(AR-7)

**Given** 임시저장(draft) 자료
**When** `/me/activity` 자료 탭
**Then** 임시저장 배지·[이어 작성하기]

**Given** 타인/비회원의 수정·삭제 API 직접 호출
**When** 요청
**Then** 403(FR-1.8)

### Story 4.9: 마이페이지 자료 탭 + 자료 CollectionPage JSON-LD

As a 방문자·회원,
I want 실전자료 목록이 검색엔진에 색인되고 마이페이지에서 내 자료를 관리하기를,
So that SEO 노출이 강화되고 내 기여 이력을 파악한다.

**Acceptance Criteria:**

**Given** `/resources` 목록
**When** SSR 렌더
**Then** CollectionPage JSON-LD(`name`·`description`·`url`·`hasPart` 상위 10개)(FR-11.5)

**Given** 회원이 `/me/activity` 자료 탭
**When** 렌더
**Then** 본인 등록 자료(상태 배지·제목·다운로드수·평점·등록일)+[수정/삭제] 인라인

**Given** 등록 자료 없음
**When** 렌더
**Then** EmptyState+[첫 자료 등록하기](UX-DR-U11)

**Given** 운영자가 `status=hidden` 처리
**When** 등록자 자료 탭 렌더
**Then** "숨김 처리됨" 배지·사유 안내(FR-4.8)

**Given** `/resources?type=mcp` 등 필터 메타
**When** `generateMetadata`
**Then** 유형명 포함 고유 title, canonical은 필터 없는 기본 URL(중복 색인 방지, FR-11.1·NFR-8)

---

## Epic 5: 참여 & 소셜 상호작용

콘텐츠 횡단 참여 기능을 다형 모델 `(target_type, target_id)`로 구현한다. `comment`·`reaction`·`bookmark`·`report`·`block`·`follow` 테이블을 이 에픽이 소유하고, Epic 2~4가 상세 페이지에 남겨 둔 참여 슬롯(좋아요·댓글·신고·북마크)과 Epic 1이 프로필/마이페이지에 남겨 둔 팔로우 슬롯을 실제 동작으로 활성화한다. Epic 9(신고 처리·자동 숨김)·Epic 6(포인트 적립)에 넘길 이벤트 발생 지점만 담당한다.

> **경계:** 신고 제출·`report` 테이블 소유는 이 에픽. 신고 큐·자동 숨김·제재는 Epic 9. reaction 이벤트 발생은 이 에픽, 포인트 적립은 Epic 6. **조회수 인프라(Redis 버퍼+view-flush worker)는 Epic 2(2.4)에서 도입됨 — 이 에픽은 재사용**(검수 조정). 북마크 목록은 `/me/bookmarks`(Epic 1 셸)를, 차단 설정은 `/settings/blocks`를 채운다. 팔로우(`follow` user→user 그래프)는 다형 모델이 아닌 별도 테이블이며, 공개 프로필(Story 1.10) 팔로우 버튼·카운트 슬롯과 마이페이지(Story 1.8 셸) 팔로잉/팔로워 탭을 채운다. 팔로잉 피드(팔로우한 회원 글 모아보기)는 범위 외(후속).

### Story 5.1: 다형 참여 스키마 마이그레이션

As a 개발팀,
I want `comment`·`reaction`·`bookmark`·`report`·`block` 테이블이 한 번에 정착되기를,
So that Epic 5 전체 스토리가 일관된 다형 모델 위에서 독립 진행된다.

**Acceptance Criteria:**

**Given** 다형 참여 테이블 스키마 작성
**When** `drizzle-kit generate && migrate`
**Then** 아래 테이블 생성: `comments`(`id`·`author_id`FK·`target_type`(post|question|answer|resource|comment)·`target_id`·`parent_id` nullable FK(1단계 대댓글)·`content`·`status` enum·`deleted_at`·타임스탬프), `reactions`(`id`·`user_id`FK·`target_type`·`target_id`·`reaction_type`(like)·`created_at`·UNIQUE(`user_id`,`target_type`,`target_id`,`reaction_type`)), `bookmarks`(`id`·`user_id`FK·`target_type`(post|question|resource)·`target_id`·UNIQUE), `reports`(`id`·`reporter_id`FK·`target_type`·`target_id`·`reason_code`·`detail`·`status` enum(pending|reviewing|resolved|dismissed) default pending·`created_at`), `blocks`(`id`·`blocker_id`FK·`blocked_id`FK·UNIQUE), `follows`(`follower_id`FK·`following_id`FK·`created_at`·복합 PK(`follower_id`,`following_id`)·CHECK `follower_id <> following_id`)
**And** `(target_type, target_id)` 복합 인덱스가 comments·reactions·bookmarks·reports에 생성되고, `follows`에는 양방향 조회용 인덱스(`follower_id`·`following_id`)가 생성된다

**Given** posts·questions·answers·resources 존재(Epic 2~4 완료)
**When** 각 콘텐츠 ID를 target_id로 삽입
**Then** `(target_type, target_id)`로 연결되고 typecheck·lint 통과

**Given** `contracts`에 comment·reaction·bookmark·report·block Zod 스키마 정의
**When** api·web import
**Then** `fastify-type-provider-zod`로 타입 추론·typecheck 통과

### Story 5.2: 좋아요(reaction) — 낙관적 토글 · 자가추천 차단

As a 로그인 회원,
I want 글·질문·답변·자료·댓글에 좋아요를 즉시 토글하기를,
So that 유용한 콘텐츠에 반응하고 즉시 화면에 반영된다.

**Acceptance Criteria:**

**Given** 로그인 회원이 콘텐츠 상세
**When** 좋아요 버튼 클릭
**Then** UI 낙관적 +1, `POST /api/v1/reactions` 백그라운드 INSERT, 성공 시 확정

**Given** API 실패
**When** 에러 반환
**Then** 낙관적 변경 롤백+danger 토스트(UX-DR-U12)

**Given** 이미 좋아요 상태에서 재클릭
**When** 클릭
**Then** 낙관적 -1, `DELETE /api/v1/reactions/{id}`

**Given** 본인 작성 콘텐츠
**When** 좋아요 클릭
**Then** 409 SELF_REACTION_FORBIDDEN, 버튼 비활성(AR-12·FR-9.1)

**Given** reaction 생성 성공
**When** INSERT 성공
**Then** `stats` 큐에 `reaction.created` 발행(포인트 적립은 Epic 6)

**Given** 비회원 좋아요 클릭
**When** 클릭
**Then** 로그인 유도 모달, 로그인 후 원행동 자동 실행(UX-DR-U1)

**Given** 좋아요 버튼 접근성
**When** 스크린리더
**Then** `aria-label="좋아요 N개"`·`aria-pressed`(UX-DR-U13)

### Story 5.3: 조회수 집계 — Redis 버퍼 재사용 + worker flush

As a 시스템,
I want 콘텐츠 상세 진입 시 조회수가 Epic 2에서 도입한 Redis 버퍼·view-flush worker로 집계되기를,
So that 고빈도 쓰기 없이 정확한 조회수가 집계된다.

**Acceptance Criteria:**

**Given** 사용자(비회원 포함) 콘텐츠 상세 SSR 요청
**When** 렌더
**Then** Epic 2(2.4)에서 도입된 Redis `view:{target_type}:{target_id}` INCR 패턴을 question·resource·comment 대상까지 확장 적용

**Given** Redis 버퍼
**When** `view-flush` processor가 `view.flush` 처리(5분 간격 repeatable)
**Then** 조회수>0 키를 SCAN 수집·`view_count` batch UPDATE·키 삭제(멱등)

**Given** 동일 IP·세션 반복 조회
**When** 30분 이내 재방문
**Then** `view:dedup:{...}` TTL 키로 중복 INCR 스킵

**Given** 조회수 노출
**When** SSR 렌더
**Then** DB `view_count` 표시(최대 5분 지연 허용)

### Story 5.4: 댓글 CRUD — 작성·수정·삭제

As a 로그인 회원,
I want 글·질문·자료 상세에서 댓글을 작성·수정·삭제하기를,
So that 콘텐츠에 의견을 남기고 관리한다.

**Acceptance Criteria:**

**Given** 로그인 회원이 상세 페이지
**When** 댓글 작성 후 [등록]
**Then** `POST /api/v1/comments`로 `{target_type,target_id,author_id,content,parent_id=null}` 생성·목록 갱신, `comment.created` 알림 이벤트(전송은 Epic 7)

**Given** 본인 댓글
**When** [수정]/저장
**Then** `PATCH /api/v1/comments/{id}` content·updated_at 갱신. 타인 수정 403

**Given** 본인 댓글
**When** [삭제] 확인
**Then** `DELETE` → `status=deleted`·`deleted_at`, "삭제된 댓글입니다" 표시(AR-7)

**Given** 비회원 댓글 입력
**When** 포커스/등록
**Then** 로그인 유도 모달(UX-DR-U1)

**Given** 빈/공백 본문
**When** 등록
**Then** 400 VALIDATION_ERROR·인라인 오류

**Given** 댓글 목록
**When** SSR 렌더
**Then** 최상위 최신순, 대댓글은 부모 아래 1단계 들여쓰기

**Given** [삭제] 버튼 접근성
**When** 검사
**Then** `<button>`·`aria-label="댓글 삭제"`·포커스 링(UX-DR-U13)

### Story 5.5: 대댓글 (1단계)

As a 로그인 회원,
I want 댓글에 대댓글을 달기를,
So that 댓글 맥락에서 대화를 이어간다.

**Acceptance Criteria:**

**Given** [답글] 클릭
**When** 대댓글 입력 후 [등록]
**Then** `POST /api/v1/comments`에 `parent_id={댓글id}`·부모와 동일 target으로 생성·부모 아래 표시

**Given** 대댓글에 [답글](2단계 시도)
**When** 클릭
**Then** API 400 NESTING_NOT_ALLOWED·UI 2단계 입력창 미노출

**Given** 부모 댓글 soft-delete
**When** 대댓글 존재
**Then** 부모는 "삭제된 댓글입니다", 대댓글은 노출

**Given** 대댓글 등록
**When** 완료
**Then** `comment.created` 이벤트(부모 작성자 대상, 전송 Epic 7)

### Story 5.6: 댓글 좋아요

As a 로그인 회원,
I want 댓글에도 좋아요를 하기를,
So that 유용한 댓글을 인정한다.

**Acceptance Criteria:**

**Given** 로그인 회원
**When** 댓글 좋아요 버튼 클릭
**Then** `POST /api/v1/reactions`에 `target_type='comment'`, 5.2와 동일한 낙관적·롤백·자가추천 차단·게이팅 규칙

**Given** 댓글 좋아요 수
**When** 렌더
**Then** 수 표시·본인 좋아요 시각 구분(색+아이콘)

### Story 5.7: 북마크 — 저장·해제·마이페이지 목록

As a 로그인 회원,
I want 글·질문·자료를 북마크하고 마이페이지에서 모아보기를,
So that 나중에 다시 찾을 콘텐츠를 저장·접근한다.

**Acceptance Criteria:**

**Given** 로그인 회원 상세
**When** 북마크 클릭
**Then** `POST /api/v1/bookmarks` 낙관적 활성, 실패 시 롤백+토스트(UX-DR-U12)

**Given** 이미 북마크 상태에서 재클릭
**When** 클릭
**Then** `DELETE`로 해제

**Given** 비회원 북마크 클릭
**When** 클릭
**Then** 로그인 유도 모달·로그인 후 자동 저장(UX-DR-U1)

**Given** 회원 `/me/bookmarks` 진입
**When** 로드
**Then** `GET /api/v1/users/me/bookmarks`로 target_type별 탭(글/질문/자료) SSR, 각 항목 원본 제목·날짜·링크

**Given** 북마크 비어있음
**When** 탭 렌더
**Then** EmptyState+탐색 버튼

**Given** 북마크 버튼 접근성
**When** 검사
**Then** `aria-label`·`aria-pressed`(UX-DR-U13)

### Story 5.8: 신고 제출

As a 로그인 회원,
I want 부적절한 글·질문·답변·자료·댓글을 신고하기를,
So that 운영자가 검토하고 커뮤니티 환경이 유지된다.

**Acceptance Criteria:**

**Given** 로그인 회원이 [신고] 클릭
**When** 모달 오픈
**Then** 사유 목록(스팸·음란물·욕설·광고·저작권·기타) 표시, 기타 선택 시 상세 textarea

**Given** 사유 선택 후 [신고]
**When** `POST /api/v1/reports`에 `{target_type,target_id,reason_code,detail}`
**Then** `status=pending` INSERT·토스트. 처리·자동숨김은 Epic 9

**Given** 동일 콘텐츠 재신고
**When** 시도
**Then** 409 ALREADY_REPORTED·"신고됨" 표시

**Given** 비회원 신고 클릭
**When** 클릭
**Then** 로그인 유도 모달(UX-DR-U1)

**Given** 신고 모달 접근성
**When** 검사
**Then** 포커스 트랩·Esc·`aria-labelledby`(UX-DR-U13)

### Story 5.9: 공유 버튼

As a 사용자(비회원 포함),
I want 상세에서 공유 버튼으로 URL을 복사하기를,
So that 콘텐츠를 쉽게 전달한다.

**Acceptance Criteria:**

**Given** 상세 페이지
**When** [공유] 클릭
**Then** `navigator.clipboard.writeText(URL)`·"링크를 복사했어요" 토스트(3초)

**Given** clipboard 미지원
**When** 클릭
**Then** URL 선택·복사 안내 팝오버(fallback)

**Given** 모바일에서 `navigator.share` 지원
**When** 클릭
**Then** 네이티브 공유 시트

**Given** [공유] 버튼
**When** 렌더
**Then** `<button>`·`aria-label="공유"`(UX-DR-U13)

### Story 5.10: 관련글 추천 + 작성자 다른 글

As a 방문자,
I want 상세 하단에서 관련 콘텐츠·작성자 다른 글을 보기를,
So that 탐색을 이어가고 체류 시간이 늘어난다.

**Acceptance Criteria:**

**Given** 상세 하단
**When** SSR 렌더
**Then** "관련 글"에 태그 1개 이상 겹치는 동일 target_type 최대 5건(최신순)

**Given** 상세 하단
**When** SSR 렌더
**Then** "작성자의 다른 글" 동일 작성자 최근 3건(현재 글 제외)

**Given** 관련/작성자 글 없음
**When** 렌더
**Then** 해당 섹션 미표시(EmptyState 불필요)

**Given** 항목
**When** 렌더
**Then** 제목·작성일·조회수·`<a>` 링크(SEO 크롤 가능)

**Given** 관련글 쿼리
**When** 실행
**Then** N+1 없이 단일/최대 2회 쿼리(AR-2)

### Story 5.11: 회원 차단 — 등록·해제·설정 화면

As a 로그인 회원,
I want 특정 회원을 차단하고 `/settings/blocks`에서 관리하기를,
So that 원치 않는 쪽지를 받지 않고 차단 회원 콘텐츠가 걸러진다.

**Acceptance Criteria:**

**Given** 로그인 회원이 프로필/작성자 정보에서 [차단] 선택·확인
**When** 승인
**Then** `POST /api/v1/blocks` UNIQUE 레코드 생성·토스트

**Given** 이미 차단한 회원 재차단
**When** 요청
**Then** 409 ALREADY_BLOCKED

**Given** 차단 등록 완료
**When** 목록 조회 API
**Then** 서버가 blocks 조인해 차단 회원 작성 콘텐츠를 응답에서 제외

**Given** 회원이 `/settings/blocks` 진입
**When** 로드
**Then** `GET /api/v1/users/me/blocks` SSR·각 항목 [차단 해제], 비면 EmptyState

**Given** [차단 해제]
**When** 승인
**Then** `DELETE /api/v1/blocks/{id}`·즉시 제거

**Given** 본인 차단
**When** 호출
**Then** 400 SELF_BLOCK_FORBIDDEN

**Given** 차단 회원 쪽지 발송(Epic 7)
**When** Epic 7 쪽지 API 발송
**Then** 차단 확인 슬롯 남김(실제 연계는 Epic 7)

**Given** [차단] 모달 접근성
**When** 검사
**Then** 포커스 트랩·Esc·`aria-labelledby`·`aria-label`(UX-DR-U13)

### Story 5.12: 회원 팔로우 — 팔로우/언팔 · 팔로워·팔로잉 목록·카운트

As a 로그인 회원,
I want 다른 회원을 팔로우/언팔하고 내 팔로잉·팔로워를 관리하기를,
So that 관심 있는 작성자를 모아 두고 그들의 활동을 가까이 둔다.

**Acceptance Criteria:**

**Given** 로그인 회원이 공개 프로필(`/u/{nickname}`)·작성자 정보의 [팔로우] 버튼 선택
**When** 승인
**Then** `POST /api/v1/follows`가 `follows`(`follower_id`,`following_id`) 레코드를 생성하고, 버튼이 [팔로잉] 상태로 낙관적 토글되며 팔로워 카운트가 즉시 반영된다

**Given** 이미 팔로우한 회원 재팔로우
**When** 요청
**Then** 멱등 처리(복합 PK 충돌) — 중복 생성 없이 현재 상태를 유지한다

**Given** 본인 팔로우
**When** 호출
**Then** 400 SELF_FOLLOW_FORBIDDEN (CHECK 제약과 일치)

**Given** [팔로잉] 상태에서 언팔
**When** 승인
**Then** `DELETE /api/v1/follows/{nickname|id}`로 레코드 제거·버튼 [팔로우] 복귀·카운트 감소

**Given** 공개 프로필 진입(비회원 포함)
**When** SSR 렌더(Story 1.10 슬롯 활성화)
**Then** 팔로워/팔로잉 카운트가 실제 집계로 표시되고, 로그인 회원에게는 현재 팔로우 여부에 따른 버튼 상태가, 비회원에게는 로그인 유도(행동 게이팅)가 노출된다

**Given** 마이페이지 셸(Story 1.8)의 팔로잉/팔로워 탭
**When** 진입
**Then** `GET /api/v1/users/{nickname}/following`·`/followers`(페이지네이션)로 목록 SSR, 각 항목에 프로필 링크·등급 뱃지·팔로우/언팔 버튼, 비면 EmptyState

**Given** 차단 관계(Story 5.11)와 팔로우의 상호작용
**When** A가 B를 차단
**Then** 차단 시 기존 팔로우 관계 처리 정책(자동 해제 또는 노출 제외) 슬롯을 두고, 차단 회원은 팔로우 버튼이 비활성/숨김된다(실연계는 차단 로직과 함께)

**Given** 팔로우 발생
**When** 이벤트 발행
**Then** 알림(Epic 7)·포인트(Epic 6)에 넘길 `follow.created` 이벤트 발생 지점만 남기고 실제 전달/적립은 각 에픽 소유

**Given** [팔로우]/[언팔] 버튼·목록 접근성
**When** 검사
**Then** 버튼 `aria-pressed`(팔로잉 상태)·키보드 조작·토스트가 UX-DR 기준을 충족한다

---

## Epic 6: 게이미피케이션

"가벼운 명예 중심" — 포인트는 뒷단 원장(마이페이지에서만 소형 노출), 사용자에게 보이는 건 등급·뱃지·랭킹뿐. 핵심 활동에 포인트·등급 제한 없음. 포인트는 활동의 결과지 통제 수단이 아니다.

> **경계:** 이 에픽 소유 = `points_ledger`·`grades`·`badges`·`user_badges` + `core`의 `points/grades/badges/ranking.ts` 순수 함수 + 적립·회수 훅 + 등급·뱃지 도출 + 랭킹 + `/me/badges` 채움 + 공개 프로필 등급·뱃지 렌더. 등급 상승·뱃지 획득 **알림 전달**은 Epic 7(이벤트만 발행). 어드민 수동 포인트·뱃지 지급/회수 **관리 화면**은 Epic 9(도메인 규칙·서비스는 이 에픽). 순서: 6.1→6.2→6.3→6.4→6.5→6.6.

### Story 6.1: 게이미피케이션 DB 스키마 + core 순수 함수 토대

As a 개발팀,
I want `points_ledger`·`grades`·`badges`·`user_badges` 테이블과 `core` 순수 함수가 정착되기를,
So that 이후 모든 게이미피케이션 스토리가 일관된 스키마·규칙 위에서 구현된다.

**Acceptance Criteria:**

**Given** 게이미피케이션 테이블 정의
**When** Drizzle 스키마·`drizzle-kit generate`
**Then** 생성: `points_ledger`(`id`·`user_id`FK·`delta`(±)·`reason`(domain.action)·`source_type`·`source_id`·`created_at`), `grades`(`id`·`level`(1~5 unique)·`name`·`min_points`·`max_points` nullable), `badges`(`id`·`slug` unique·`name`·`description`·`icon_url`·`is_auto`), `user_badges`(`id`·`user_id`FK·`badge_id`FK·`granted_at`·`granted_by` nullable·UNIQUE(`user_id`,`badge_id`))
**And** `grades` 시드(Lv1 새내기 0~ / Lv2 작당원 100~ / Lv3 실전러 500~ / Lv4 고수 1500~ / Lv5 마스터 3000~)와 `badges` 시드(7개·`is_auto` 포함) 삽입

**Given** `core/` 게이미피케이션 함수 부재
**When** `points.ts`·`grades.ts`·`badges.ts`·`ranking.ts` 순수 함수 작성
**Then** export+Vitest 동반:
- `points.ts`: `POINT_RULES`(post+10/answer+5/comment+1/resource+20/reaction.received+2/download.given+1)·`DAILY_CAPS`·`pointsForAction(reason)`·`canEarnPoint({reason,userId,todayCount})`
- `grades.ts`: `gradeForPoints(total, grades)`·`nextGrade`·`pointsToNextGrade`
- `badges.ts`: `BadgeSlug` union·`shouldAwardBadge(opts)`(DB 미참조, 집계값 주입)·`BADGE_CONDITIONS`
- `ranking.ts`: `PeriodType`·`rankingWindowDates(period, now)`·`computeRanking(ledgerRows, limit)`

**Given** `contracts/gamification.ts` 부재
**When** Zod 스키마 정의
**Then** `gradeSchema`·`badgeSchema`·`userBadgeSchema`·`pointsLedgerEntrySchema`·`rankEntrySchema`·`rankingResponseSchema`·`userBadgesResponseSchema` export·web/api 재사용

**Given** 작성 완료
**When** `pnpm typecheck && test --filter=core --filter=contracts`
**Then** 타입 오류 0·테스트 통과, core 배럴에 등록·무거운 `export *` 미사용

### Story 6.2: 포인트 적립 · 회수 훅

As a 회원,
I want 글·답변·댓글·자료 등록, 받은 좋아요, 다운로드 시 포인트가 자동 적립되고 삭제·회수 시 정확히 회수되기를,
So that 포인트 원장이 항상 정합 상태를 유지한다.

**Acceptance Criteria:**

**Given** Epic 2~5 service에서 콘텐츠 생성 직후(6.1 선행)
**When** 각 이벤트 발생
**Then** 해당 service 트랜잭션 내 `points_ledger` insert: 글 +10(`post.created`)/답변 +5/댓글 +1/자료 +20/좋아요 수신 +2(`reaction.received`)/다운로드 수신 +1(`download.given`), 각 `(source_type, source_id)` 기록
**And** `canEarnPoint`로 일일 상한 초과 시 미삽입(콘텐츠 생성은 정상)

**Given** `source_type`·`source_id` 기록 상태
**When** 소스 soft-delete
**Then** 동일 트랜잭션에 역방향 delta 회수 insert(`{reason}.revoked`, 음수), 누적 포인트 정확히 감소

**Given** 자기 글 자기 좋아요
**When** reaction 요청
**Then** 400 SELF_REACTION_NOT_ALLOWED·포인트 미삽입(Epic 5 가드)

**Given** 동일 `(user_id, reason, source_id)` 중복 이벤트
**When** 적립 호출
**Then** 기존 비회수 행 있으면 스킵(멱등·재시도 안전)

**Given** 포인트 서비스
**When** `pnpm test --filter=api`
**Then** 적립·회수·어뷰징·일일 상한 시나리오 테스트 통과(fixture 사용)

### Story 6.3: 등급 시스템 — 도출 · 표시 · 변동 알림 이벤트

As a 회원,
I want 누적 포인트에 따라 등급이 자동 도출되어 이름 옆·프로필에 표시되고 등급 변동 시 알림 이벤트가 발행되기를,
So that 활동이 늘수록 가벼운 명예가 쌓인다.

**Acceptance Criteria:**

**Given** 등급 규칙(6.1 시드)
**When** 누적 SUM을 `gradeForPoints()`에 전달
**Then** 정확한 GradeRow 반환, 경계값(정확히 100·500 등) 상위 전환 단위 테스트

**Given** 공개 프로필 SSR
**When** 로드
**Then** 닉네임 옆 등급명·레벨 배지 렌더(비회원 열람)

**Given** 마이페이지 `/me` 요약
**When** 로그인 진입
**Then** 등급명·레벨·포인트 합산·다음 등급까지 잔여 표시(포인트 비강조)

**Given** 등급 경계 초과
**When** 적립 후 `gradeForPoints(이전)≠gradeForPoints(신)` 감지
**Then** `ranking` 큐에 `gamification.grade-up` enqueue → worker가 Epic 7 알림 큐에 `grade.level-up` 발행(멱등)

**Given** 등급 미잠금 원칙(FR-9.2)
**When** Lv1이 모든 핵심 행동 시도
**Then** 등급 사유로 차단 없음(라우트에 grade guard 부재)

**Given** 포인트 원장 직접 조작 시도
**When** 임의 insert 시도
**Then** 직접 insert 엔드포인트 미노출, 관리자 수동 지급은 Epic 9 전용 API만

### Story 6.4: 뱃지 시스템 — 자동 수여 · 보유 뷰

As a 회원,
I want 활동 조건 달성 시 뱃지가 자동 수여되고 `/me/badges`·공개 프로필에서 확인되기를,
So that 특정 기여를 인정받는 성취감을 느낀다.

**Acceptance Criteria:**

**Given** 자동 뱃지 7종(첫 글·자료 기여자·인기 자료(다운로드≥50)·인기글(좋아요≥20)·답변러(답변≥5)·꾸준러(4주 연속)·운영자 수여(is_auto=false))
**When** `shouldAwardBadge(opts)`에 집계값 주입
**Then** 달성 BadgeSlug[] 반환, 경계값(49 미달/50 달성) 단위 테스트

**Given** 포인트·콘텐츠 이벤트 후(worker)
**When** `ranking` 큐 `gamification.badge-check` 소비
**Then** 최신 집계 조회→`shouldAwardBadge`→미보유 달성분만 `user_badges` insert(멱등), 신규 수여마다 Epic 7 알림 큐 `badge.awarded` 발행

**Given** 운영자 수여 뱃지(is_auto=false)
**When** check job
**Then** 자동 평가 제외, 수여는 Epic 9 어드민(`granted_by`=운영자 id)

**Given** 회원 `/me/badges`(1.8 셸)
**When** 로드
**Then** `GET /api/v1/gamification/my-badges`로 보유 뱃지(이름·아이콘·수여일), 미보유·조건 미노출

**Given** 공개 프로필 SSR
**When** 로드
**Then** 보유 뱃지 노출(비회원 열람)

**Given** 첫 글 삭제 후 `first-post`
**When** soft-delete
**Then** 수여 뱃지 미회수(단방향). `admin-special`만 Epic 9에서 회수 가능

### Story 6.5: 랭킹 — 주간/월간 기여자 TOP · 페이지 + 위젯

As a 회원·방문자,
I want 주간·월간 기여자 TOP를 위젯·랭킹 페이지에서 보기를,
So that 활발한 기여자가 자연스럽게 드러난다.

**Acceptance Criteria:**

**Given** `ranking` 큐·`ranking.compute` processor 부재(6.1 선행)
**When** `ranking.compute` enqueue·소비
**Then** ①`rankingWindowDates` 기간 경계 ②기간 사용자별 `SUM(delta)` ③`computeRanking(rows,10)` TOP 10 ④Redis `ranking:weekly`·`ranking:monthly`(TTL 1h) 캐시. 멱등

**Given** 스케줄
**When** 운영 중
**Then** 매일 자정 cron enqueue, 초기 seed 1회

**Given** `GET /api/v1/gamification/ranking?period=weekly|monthly`
**When** 요청
**Then** Redis 캐시(`rankingResponseSchema`) 반환, miss 시 DB 즉석 계산·재캐시. `RankEntry`={rank·userId·nickname·gradeLevel·gradeName·totalDelta}

**Given** 메인 위젯
**When** `?period=weekly&limit=5`
**Then** TOP 5 subset(limit 지원, 기본 10)

**Given** `/ranking` 페이지
**When** SSR
**Then** 주간·월간 탭 TOP 10 테이블(비회원 열람), 고유 메타(noindex 미적용)

**Given** 어뷰징(일일 상한 초과·상호 좋아요 폭탄)
**When** `canEarnPoint` 초과·`DAILY_CAPS` 초과분
**Then** 미적립→랭킹 미반영(업스트림 처리), 심각 패턴은 Epic 9 수동

**Given** 랭킹 테이블 접근성
**When** 렌더
**Then** `<table>`·tabular-nums·순위 숫자+텍스트·`aria-label`(UX-DR-U13)

### Story 6.6: 게이미피케이션 UI 통합

As a 회원·방문자,
I want 등급·뱃지가 이름 옆·프로필·목록 작성자 메타에 일관 노출되고 마이페이지에서 현황을 보기를,
So that 게이미피케이션이 서비스 전반에 자연스럽게 녹아든다.

**Acceptance Criteria:**

**Given** `GET /api/v1/gamification/me`
**When** 로그인 요청
**Then** `{totalPoints, grade, nextGrade, pointsToNext, badges}` 반환(Zod 검증)

**Given** `/me` 요약(1.8 셸)
**When** 진입
**Then** 등급명·레벨 아이콘·누적 포인트(소형)·잔여 포인트 표시(포인트 비강조)

**Given** `/me/badges`(6.4 구현)
**When** 접근
**Then** 보유 뱃지 카드, 0개면 EmptyState

**Given** 공개 프로필(1.10 셸)
**When** SSR
**Then** 닉네임 옆 등급명·레벨 배지·보유 뱃지(비회원 열람)

**Given** 게시글 목록·상세 작성자 메타(Epic 2~4)
**When** 닉네임 렌더
**Then** 등급 레벨 배지 동반, Lv1도 빈 공간 없이 처리

**Given** 게이미피케이션 전면화 거부 원칙
**When** 어느 페이지든
**Then** 포인트 리더보드·"N포인트 획득!" 팝업 등 미존재, 포인트는 `/me` 내부에서만

**Given** 모바일(<768px) 작성자 메타
**When** 렌더
**Then** 등급 배지가 닉네임과 자연스럽게 배치(UX-DR-U14)

**Given** 등급·뱃지 icon-only 접근성
**When** 렌더
**Then** `aria-label`(예 "등급: 실전러")·색 단독 전달 금지(UX-DR-U13)

**Given** `pnpm typecheck && lint`
**When** 완료 후
**Then** web·api·worker·core·contracts 타입·lint 0

---

## Epic 7: 알림 · 쪽지 · 1:1 문의

SSE+Redis Pub/Sub 기반 실시간 인앱 알림(목록/읽음/헤더 배지/종류별 on·off), 회원 간 1:1 쪽지(작성/수신/대화 목록/읽음, 신고·차단 연계, 스팸 방지), 운영진 대상 1:1 문의(작성·내역·답변 확인, 상태 접수/처리중/완료 — 외주 유입 #1 경로, 로그인 회원 한정)를 구현한다.

> **경계:** `notification`·`message`·`inquiry`·`inquiry_reply`·`notification_settings` 테이블·SSE 전달 = 이 에픽. 알림 이벤트 발생원(댓글·답변·좋아요 등)은 Epic 2~6이 발행, 이 에픽 SSE가 수신·전달(이전 에픽 의존 OK). 어드민 문의 답변(FR-10.6)은 Epic 9. `block` 테이블은 Epic 5 소유(읽기 참조). `/me/notifications`·`/me/messages`·`/me/inquiries`·`/settings/notifications` 셸(Epic 1)을 채운다. 순서: 7.1(스키마·SSE)→7.2→7.3→7.4→7.5.

### Story 7.1: 알림·쪽지·문의 DB 스키마 + SSE Pub/Sub 파이프라인

As a 개발팀,
I want `notification`·`message`·`inquiry`·`inquiry_reply` 스키마와 SSE+Redis Pub/Sub 팬아웃이 정착되기를,
So that 이후 모든 알림·쪽지·문의 스토리가 이 기반 위에서 안전하게 구현된다.

**Acceptance Criteria:**

**Given** 스키마 작성(AR-6·AR-14)
**When** `drizzle-kit generate && migrate`
**Then** 생성: `notifications`(`id`·`user_id`FK·`type`(comment.created·answer.created·comment.replied·reaction.received·helpful_answer.marked·message.received·sanction.applied)·`target_type` nullable·`target_id` nullable·`title`·`body`·`is_read`·`created_at`), `messages`(`id`·`sender_id`·`receiver_id`·`body`·`is_read`·`deleted_by_sender`·`deleted_by_receiver`·`created_at`), `inquiries`(`id`·`user_id`·`title`·`body`(Tiptap JSON)·`status`(pending/in_progress/resolved)·타임스탬프), `inquiry_replies`(`id`·`inquiry_id`·`author_type`(user|admin)·`author_id`·`body`·`created_at`), `notification_settings`(`id`·`user_id` unique·`settings` jsonb 기본 true)

**Given** `contracts` Zod 정의(AR-13)
**When** notification·message·inquiry 작성
**Then** `NotificationEventPayload`·`notificationSchema`·`messageSchema`·`conversationSchema`·`inquirySchema`·`inquiryReplySchema`·페이지네이션 래퍼 정의·api/web typecheck 통과

**Given** `apps/api/src/lib/sse.ts`·`routes/v1/notifications/sse.ts`(AR-14)
**When** 인증 회원이 `GET /api/v1/notifications/sse` 연결
**Then** `text/event-stream` 유지·user_id 커넥션 맵 등록·keepalive ping·비인증 401

**Given** Redis Pub/Sub 팬아웃(AR-14, ECS 다중 인스턴스)
**When** `SUBSCRIBE notification:{userId}` 구독·발행자가 `PUBLISH`
**Then** 해당 user 커넥션 보유 인스턴스만 push, 미보유 인스턴스 무시(미수신분은 목록 보강, FR-12.2)

**Given** `publishNotification(userId, payload)` 헬퍼
**When** Epic 2~6 이벤트가 호출
**Then** `notifications` insert + Redis PUBLISH SSE 팬아웃. `notification_settings`에서 해당 type off면 insert만·SSE 생략

### Story 7.2: 알림 목록 · 읽음 · 헤더 배지 (`/me/notifications`)

As a 회원,
I want 헤더 종 배지로 새 알림 수를 보고 `/me/notifications`에서 전체 알림을 읽음 처리하기를,
So that 내 활동 반응 이벤트를 놓치지 않는다.

**Acceptance Criteria:**

**Given** 로그인 상태 어느 페이지든(FR-12.2)
**When** 헤더 렌더
**Then** 종 아이콘(`aria-label="알림"`)·미읽음 배지(`GET /api/v1/notifications/unread-count`), SSE 수신 시 실시간 갱신

**Given** SSE 끊김/첫 로드(AR-14 보강)
**When** 로드/재연결
**Then** unread-count 재조회로 배지 최신화

**Given** `/me/notifications` 진입(FR-12.2)
**When** 로드
**Then** `GET /api/v1/notifications?page=&pageSize=20` 목록(type 아이콘·제목·본문·상대시간·읽음 구분), target 있으면 클릭 시 해당 URL 이동·오프셋 페이지네이션

**Given** 개별/전체 읽음
**When** 클릭
**Then** `PATCH .../{id}/read` / `.../read-all` → `is_read=true`·배지 감소/0·토스트

**Given** 알림 0건
**When** 열람
**Then** EmptyState

**Given** 비회원 접근/우회
**When** 시도
**Then** 로그인 유도·API 401

### Story 7.3: 알림 설정 (`/settings/notifications`)

As a 회원,
I want 알림 종류별 수신 여부를 설정하기를,
So that 관심 없는 알림은 끄고 중요한 것만 받는다.

**Acceptance Criteria:**

**Given** `/settings/notifications` 진입(FR-12.3, Epic 1 셸)
**When** 로드
**Then** `GET .../settings` 현재값·종류별 토글 7종(댓글·답변·대댓글·좋아요·도움된 답변·쪽지·제재). 제재 알림은 비활성(항상 on)·사유 안내

**Given** 토글 변경
**When** 클릭
**Then** `PATCH .../settings` 즉시 전송·jsonb 갱신·토글만 반영, 실패 시 롤백+danger 토스트

**Given** 해당 type off 상태 이벤트(7.1 연계)
**When** publishNotification 호출
**Then** `settings[type]===false`면 SSE 생략·insert는 수행(목록 보강 가능)

**Given** 비회원 우회
**When** 비인증 PATCH
**Then** 401

### Story 7.4: 회원 간 1:1 쪽지 (DM)

As a 회원,
I want 다른 회원에게 쪽지를 보내고 `/me/messages`에서 대화를 주고받기를,
So that 외주·협업·소통을 서비스 안에서 한다.

**Acceptance Criteria:**

**Given** 공개 프로필 [쪽지 보내기](FR-13.1)
**When** 클릭
**Then** 작성 모달(수신자 자동 입력·본문 500자)

**Given** [보내기]
**When** 유효 본문 제출
**Then** `POST /api/v1/messages` insert·수신자 `message.received` 알림(설정 on이면 SSE)·발신자 토스트

**Given** rate limit 초과(FR-13.2·AR-12)
**When** 1시간 10건 이상
**Then** 429·"발송 한도 초과" 토스트

**Given** 수신자가 발신자 차단(Epic 5 block 읽기 참조)
**When** 발송
**Then** 403 BLOCKED_BY_RECEIVER·"보낼 수 없는 상대"(사유 미노출)

**Given** 제재(suspended) 회원
**When** 발송
**Then** 403 ACCOUNT_SUSPENDED·사유·기간 안내

**Given** `/me/messages` 진입(FR-13.1)
**When** 로드
**Then** `GET .../conversations` 대화 목록(상대·마지막 메시지·시간·미읽음 배지)

**Given** 대화 스레드 진입
**When** `GET .../conversations/{userId}`
**Then** 시간순 표시·미읽음 자동 `read-all`·하단 입력창 답장(500자)

**Given** 쪽지 신고(FR-13.2)
**When** 클릭
**Then** 사유 모달→`POST /api/v1/reports`(target_type="message")·토스트

**Given** 비회원 접근/우회
**When** 시도
**Then** 로그인 유도·API 401

### Story 7.5: 1:1 문의 작성·내역·답변 확인 (`/me/inquiries`)

As a 로그인 회원,
I want 운영진에게 1:1 문의를 작성하고 내역·답변을 스레드형으로 확인하기를,
So that 외주 상담·기술 지원 등을 운영진에게 직접 전달하고 결과를 추적한다.

**Acceptance Criteria:**

**Given** `/me/inquiries` 진입(FR-16.1·16.2)
**When** 로드
**Then** `GET /api/v1/inquiries?page=&pageSize=20` 목록(제목·상태 배지(접수 warning/처리중 info/완료 success)·작성일·업데이트일)·[새 문의 작성]

**Given** [새 문의 작성]
**When** 클릭
**Then** 폼(제목 100자·본문 lite 에디터 500자·[제출])(FR-16.1·AR-8)

**Given** [제출](FR-16.4 스팸 방지)
**When** 유효 제출
**Then** `POST /api/v1/inquiries`(`status=pending`)·목록 이동·토스트. Epic 9 어드민 문의 관리에 표시(답변 FR-10.6 Epic 9)

**Given** rate limit(FR-16.4·AR-12)
**When** 24시간 5건 이상
**Then** 429 INQUIRY_RATE_LIMIT_EXCEEDED·"하루 최대 5건" 토스트

**Given** 문의 항목 클릭
**When** `GET /api/v1/inquiries/{id}`
**Then** 스레드(회원 원문 + `author_type=admin` 답변 시간순)·현재 상태 표시(FR-16.2·16.3)
**And** 운영자 답변 추가(Epic 9) 시 `inquiry.replied` 알림 발행

**Given** 문의 0건
**When** 열람
**Then** EmptyState+[새 문의 작성]

**Given** 비회원 접근/우회(FR-16.4)
**When** 시도
**Then** 로그인 유도·API 401

**Given** 타인 문의 ID 직접 접근
**When** 작성자 아님
**Then** 403/404

---

## Epic 8: 메인 · 탐색 · 검색 & SEO 완성

메인 홈 6섹션, 글·질문·자료 통합 검색(pg_bigm, 통합+영역별), 태그 페이지(`/tags/{tag}`) SEO 랜딩, 자유 입력 태그+추천/자동완성, 사이트 전역 SEO 완성(sitemap·robots·OG·링크 OG 카드·GA4·Search Console·noindex)·성능 캐싱을 구현한다.

> **의존 전제:** Epic 2~4 콘텐츠가 DB에 존재(이전 에픽 의존 OK). 메인 인기글·랭킹 위젯은 Epic 5(조회수·좋아요)·Epic 6(랭킹) 컬럼 읽기만. Epic 2 `lib/seo` 헬퍼·`tag`/`taggable`·breadcrumb·JSON-LD 기반 재사용·확장. 링크 OG 수집은 worker `og-fetch` 잡 신규. **AR-5: 검색은 `bigm_similarity` 스코어를 유형별 UNION ALL 후 정규화 병합·재정렬.** 순서: 8.1→8.2→8.3→8.4→8.5→8.6→8.7→8.8→8.9(8.6~8.9 병렬 가능).

### Story 8.1: pg_bigm 검색 인덱스 & 통합 검색 API

As a 회원/비회원,
I want 검색어로 글·질문·자료에서 빠르게 관련 결과를 찾기를,
So that 게시판을 일일이 탐색하지 않고 한 번에 찾는다.

**Acceptance Criteria:**

**Given** post·question·resource 존재
**When** 마이그레이션 실행
**Then** 각 테이블에 `search_vector`(제목+본문 파생, GENERATED STORED) 추가·`GIN (search_vector gin_bigm_ops)` 인덱스 적용, `pg_indexes`에 3행

**Given** `contracts` `searchQuerySchema`(`q` 1~200·`type`·page·pageSize)·`searchResultSchema`
**When** `GET /api/v1/search?q=&type=all&page=&pageSize=20`
**Then** post·question·resource 각각 `bigm_similarity` 정렬 질의 후 UNION ALL·유형별 max로 [0,1] 정규화·병합 재정렬, `{items, meta, byType:{post,question,resource}}`(AR-5)

**Given** `type=post|question|resource`
**When** 영역별 검색
**Then** 해당 유형만 질의·items·byType 반환

**Given** 매칭 없는 검색어
**When** `type=all`
**Then** `{items:[], ..., byType:0, suggestedTags[]}`(인기 태그 최대 5)

**Given** 1자 미만/200자 초과
**When** 요청
**Then** 422 VALIDATION_ERROR

**Given** `SearchResultItem`(`type` 판별 유니온)
**When** 응답
**Then** 각 항목 `type` 포함으로 클라이언트 타입 안전 렌더

### Story 8.2: 검색 결과 페이지 (`/search`) — SSR · URL 상태 · 통합+영역별 탭

As a 사용자(비회원 포함),
I want 검색어·필터를 URL에 반영한 결과 페이지를 보기를,
So that 뒤로가기·공유로 재현하고 검색엔진이 색인한다.

**Acceptance Criteria:**

**Given** 헤더 검색창 제출
**When** Enter/버튼
**Then** `/search?q=&type=all&page=1` 내비·서버 컴포넌트 SSR 렌더(클라 전용 교체 금지, NFR-1·UX-DR-U2)

**Given** `/search?q=cursor` SSR
**When** 로드
**Then** H1 `"cursor" 검색 결과`·`generateMetadata`(고유 title·**noindex:true** 동적 쿼리, FR-11.9)

**Given** 결과 페이지
**When** 렌더
**Then** "전체/게시글/묻고답하기/실전자료" 탭(`role=tablist`·`byType` 카운트 배지), 클릭 시 URL `type` 변경·SSR 재렌더(UX-DR-U2·U6)

**Given** 통합 탭(type=all)
**When** 항목 표시
**Then** type 배지·제목(링크)·요약 2줄·태그·작성자·날짜, 검색어 `<mark>` 강조

**Given** 결과 없음
**When** 렌더
**Then** EmptyState+`suggestedTags` 칩, H1·noindex 유지(UX-DR-U11)

**Given** 총 결과>pageSize
**When** 렌더
**Then** 오프셋 페이지네이션·URL `page`·`aria-current=page`(UX-DR-U3)

**Given** 콜드 로드
**When** 대기
**Then** 리스트 스켈레톤(UX-DR-U11)

### Story 8.3: 태그 API & 태그 페이지(`/tags/{tag}`) — SEO 랜딩

As a 사용자(비회원 포함),
I want 태그 클릭 시 해당 태그의 글·질문·자료를 한 페이지에서 탐색하기를,
So that 키워드로 직접 진입하고 검색엔진이 태그별 콘텐츠를 색인한다.

**Acceptance Criteria:**

**Given** `contracts` `tagPageSchema`(`tag`·`type`·`sort`·page·pageSize)
**When** `GET /api/v1/tags/{tag}/content`
**Then** taggable 조인으로 post·question·resource를 `{items, meta, tag:{name,postCount,questionCount,resourceCount,totalCount}}`. `sort=popular`=조회수+좋아요, `latest`=created_at

**Given** `/tags/cursor` SSR
**When** 로드
**Then** H1 `#cursor 관련 콘텐츠`·고유 title/description/canonical·CollectionPage JSON-LD(hasPart 상위 10)·BreadcrumbList(홈>태그>#cursor)·OG 태그(FR-11.5·11.6)

**Given** 유형 필터 탭
**When** 전체/게시글/질문/자료 클릭
**Then** URL `type`·SSR 재렌더·카운트 배지(UX-DR-U2·U6·FR-11.6)

**Given** 정렬 선택
**When** 최신/인기
**Then** URL `sort`·SSR 재렌더·커스텀 Select ARIA(UX-DR-U7)

**Given** 태그 존재하나 콘텐츠 0건
**When** 렌더
**Then** hasPart 빈 배열·EmptyState·noindex(FR-11.9)

**Given** 미존재 태그
**When** 진입
**Then** 404·noindex

**Given** 결과>pageSize
**When** 렌더
**Then** 오프셋 페이지네이션(UX-DR-U3)

### Story 8.4: 태그 자동완성 API & 태그 입력 컴포넌트

As a 작성 회원,
I want 태그를 자유 입력하거나 추천 태그를 선택하기를,
So that 내 콘텐츠가 올바른 태그와 연결되어 탐색·검색에 노출된다.

**Acceptance Criteria:**

**Given** `GET /api/v1/tags/autocomplete?q=&limit=10`
**When** 2자 이상 입력
**Then** `name ILIKE $q%` 또는 `bigm_similarity>0.1` 매칭을 사용 수 내림차순 최대 10개

**Given** `GET /api/v1/tags/popular?limit=20`
**When** 요청
**Then** Redis 캐시(TTL 1h) 인기 태그(최근 30일 빈도), miss 시 DB 집계·저장(AR-17)

**Given** 작성 폼 태그 입력
**When** 텍스트 입력
**Then** 2자 이상 시 자동완성 드롭다운("추천 태그" 섹션+매칭), 방향키·Enter/Space·Esc(UX-DR-U10)

**Given** 드롭다운
**When** 렌더
**Then** `role=listbox`·`role=option`·`aria-haspopup`·`aria-expanded`·`aria-activedescendant`(UX-DR-U7)

**Given** DB에 없는 태그 자유 입력
**When** Enter/쉼표 확정
**Then** 신규 tag 레코드 생성(entity-when-needed)·칩 표시·최대 10개

**Given** 태그 칩 삭제
**When** X/Backspace
**Then** 제거·삭제 버튼 `aria-label="태그 {name} 삭제"`(UX-DR-U9)

**Given** 헤더 검색창 포커스
**When** 포커스
**Then** 입력 전 "최근 검색어"·"추천 태그", 입력 시 매칭 결과로 교체(UX-DR-U10·FR-6.4)

### Story 8.5: 메인 홈 페이지(`/`) — 6섹션 SSR

As a 방문자(비회원 포함),
I want 메인에서 핵심 콘텐츠를 한눈에 보기를,
So that 커뮤니티를 파악하고 관심 글·질문·자료로 진입한다.

**Acceptance Criteria:**

**Given** `/` SSR
**When** 로드
**Then** 6섹션 순서대로: ①소개(H1·설명·CTA) ②실전 인기글 탭 ③묻고답하기 최신 ④AI 수익화 인기글 ⑤실전자료 ⑥작당 라운지(FR-6.1)

**Given** `generateMetadata`
**When** 메타 생성
**Then** 고유 title·description·WebSite JSON-LD(`potentialAction:SearchAction`)+Organization

**Given** ②실전 인기글 탭
**When** 렌더
**Then** 바이브코딩/자동화/수익화/라운지 4탭(`role=tablist`), 활성 탭 인기글 5개(조회수+좋아요 7일, Redis 캐시), `#popular-tab=` 앵커(UX-DR-U2·U6)

**Given** ②데이터 소스
**When** 캐시 존재
**Then** Redis 즉시 반환(TTL 1h), miss 시 post 집계·저장. 조회수·좋아요는 Epic 5·6 값 읽기만

**Given** ③묻고답하기 최신
**When** 렌더
**Then** question 최신 5건(deleted 제외) 상태 배지·제목·답변수·작성일, "더 보기"→`/qna`

**Given** ④AI 수익화 인기글
**When** 렌더
**Then** `category='monetization'` 30일 인기글 5건(캐시), "더 보기"→`/monetization/`

**Given** ⑤실전자료
**When** 렌더
**Then** 인기 자료 4건(다운로드 기준, 캐시) 카드, "더 보기"→`/resources`

**Given** ⑥작당 라운지
**When** 렌더
**Then** `board IN (ai-creation,ai-products,free)` 최신 5건, "더 보기"→`/lounge/`

**Given** 6섹션 데이터 패치
**When** 병렬
**Then** `Promise.all`, 특정 섹션 실패해도 나머지 정상·실패 섹션 EmptyState

**Given** 상단 고정 공지 존재(Epic 2 notice)
**When** 있으면
**Then** ①소개 하단에 공지 배너 최대 1건(FR-15.2, notice 읽기만)

### Story 8.6: 링크 OG 자동수집 Worker & 카드 렌더

As a 글·질문을 읽는 사용자,
I want 본문 외부 링크가 제목·설명·이미지 카드로 보이기를,
So that 클릭 전 내용을 가늠하고 신뢰도를 판단한다.

**Acceptance Criteria:**

**Given** 본문(content_json)에 외부 URL 포함 저장
**When** `POST/PATCH /api/v1/posts`·`/api/v1/qna`
**Then** service가 외부 URL(자사 도메인 제외) 추출·`og-fetch` 잡(`og.fetch`,`{targetType,targetId,urls}`) 발행(AR-16)

**Given** worker `og-fetch` processor
**When** 처리
**Then** `og:title/description/image/url`·사이트명 수집·`link_previews`(`url PK,title,description,image_url,site_name,fetched_at,error_at`) upsert. 실패는 `error_at`·잡 완료(재시도 2, 본문 영향 없음)

**Given** `link_previews`에 결과 존재
**When** 상세 API 응답
**Then** `linkPreviews:{[url]:{title,description,imageUrl,siteName}}` 포함(contracts 추가)

**Given** linkPreviews 데이터 있는 상세
**When** 렌더
**Then** 외부 링크 아래 OG 카드(제목·도메인·설명 2줄·이미지/파비콘/플레이스홀더)(FR-11.7·UX-DR-U16)

**Given** OG 미완료 링크
**When** 렌더
**Then** 일반 텍스트 링크, 레이아웃 깨짐 없음

**Given** OG 이미지
**When** 표시
**Then** `<img alt="{title} 링크 미리보기">`·로드 실패 시 플레이스홀더(NFR-5)

### Story 8.7: sitemap.xml·robots.txt 완성

As a 검색엔진 크롤러,
I want 모든 색인 가능 URL을 sitemap에서 발견하고 크롤 정책을 robots.txt에서 확인하기를,
So that 모든 공개 콘텐츠가 색인된다.

**Acceptance Criteria:**

**Given** `app/sitemap.ts`
**When** `/sitemap.xml` 요청
**Then** 정적(`/`·`/qna`·`/resources`·`/notice`·`/lounge/*`·게시판 목록)+동적(post·question·resource·notice slug·태그(콘텐츠≥3))·각 `lastmod`(updated_at)·changefreq·priority(FR-11.4)

**Given** 총 건수>50,000
**When** 생성
**Then** sitemap-index 분할(posts/questions/resources/tags), 미만 시 단일

**Given** `app/robots.ts`
**When** `/robots.txt` 요청
**Then** `Allow: /`·`Disallow: /me/`·`/settings/`·`/search`·`Sitemap:` 선언(FR-11.4·11.9)

**Given** Epic 2 sitemap 헬퍼 존재
**When** 본 스토리 구현
**Then** 헬퍼 재사용·새 유형(notice·resource·tag) 쿼리만 추가(중복 금지)

**Given** Route Segment Cache
**When** `/sitemap.xml` 응답
**Then** `revalidate=3600`로 매 요청 전체 스캔 방지(NFR-4)

### Story 8.8: OG 태그 완성 · GA4 · Search Console · noindex 정책

As a 사이트 운영자,
I want 모든 공개 페이지에 완전한 OG 태그·GA4·Search Console 연동·저품질 noindex가 적용되기를,
So that SNS 공유 노출·검색 분석·검색 평판이 확보된다.

**Acceptance Criteria:**

**Given** 공개 SSR 페이지 `generateMetadata`
**When** 렌더
**Then** `og:title/description(≤160)/url/type/image/site_name`+Twitter Card(`summary_large_image`)(FR-11.4)

**Given** 대표 이미지 없는 페이지
**When** 렌더
**Then** `/public/og-default.png`(1200×630) 사용

**Given** 루트 레이아웃
**When** 빌드
**Then** `NEXT_PUBLIC_GA4_ID` 참조 GA4 스크립트(afterInteractive), 미설정 시 미삽입(FR-11.8)

**Given** GSC 인증
**When** 루트 메타
**Then** `verification.google=NEXT_PUBLIC_GSC_VERIFICATION_TOKEN`, 미설정 시 생략(FR-11.8)

**Given** noindex 대상(FR-11.9)
**When** `generateMetadata`
**Then** `/me/**`·`/settings/**`(항상)·`/search?q=*`(항상)·`/tags/{tag}`(콘텐츠≤2)·`/u/{nickname}`(콘텐츠 0)·hidden/deleted 상세에 `robots:{index:false, follow:true}`

**Given** noindex 조건 중앙화
**When** 판정
**Then** `lib/seo/noindex.ts` 단일 함수로, 각 페이지가 호출(조건 분산 금지)

### Story 8.9: 공개 페이지 성능 캐싱

As a 사이트 방문자,
I want 목록·상세·태그·검색 페이지가 빠르게 로드되기를,
So that 이탈 없이 탐색하고 Core Web Vitals 불이익을 받지 않는다.

**Acceptance Criteria:**

**Given** 공개 목록 페이지
**When** Route Segment Cache 설정
**Then** `revalidate=60`, 작성·수정 API 성공 후 `revalidatePath`/`revalidateTag` 무효화(AR-17)

**Given** 공개 상세 페이지
**When** 설정
**Then** `revalidate=300`, 수정 후 무효화

**Given** 메인 인기글·랭킹·추천 섹션
**When** 패치
**Then** Redis `main:*` 키 TTL 1h, miss 시 DB 집계, Redis 장애 시 DB 폴백(오류 미노출, AR-17)

**Given** 인기 태그 API
**When** 요청
**Then** Redis `tags:popular`(TTL 1h)·`ranking.compute` 잡 1h 주기 갱신(AR-16)

**Given** 조회수(Epic 2/5 view-flush)
**When** 인기글 정렬
**Then** flush된 DB `view_count` 사용(이전 에픽 의존 OK)

**Given** 캐시 키 상수
**When** Redis 키 추가
**Then** `cache.ts`에 중앙화·api/worker 공유(하드코딩 금지)

**Given** Redis 장애
**When** 요청
**Then** try/catch DB 폴백·에러 미전파·`pino` 로그만

---

## Epic 9: 신고 · 모더레이션 & 어드민 콘솔

관리자 신원을 유저와 완전 분리(별도 테이블·세션·Better Auth 인스턴스)하고 가입 승인 워크플로우(pending→active, 최고관리자 승인, 시드 부트스트랩)를 세운다. 그 위에서 신고 큐·자동 숨김(기본 OFF, 보수적)·회원 제재(user_sanctions 활용)·금칙어/스팸 필터 + 전체 어드민 콘솔 메뉴를 구현하고, soft-delete 수명주기(30일 후 cleanup worker 자동 hard-delete)를 정착시킨다.

> **순서:** 9.1(관리자 신원·인증·시드)→9.2(로그인/가입)→9.3(AdminShell·권한 게이트)→9.4(운영자 계정 관리)가 enabling 선행. 이후 9.5~9.17은 메뉴/기능 단위 완결(단일 스토리에 다중 메뉴 금지). **경계:** `report`(Epic 5)·`inquiry`(Epic 7) 테이블 재사용·처리만 추가. 공지 작성권한(FR-10.7)은 Epic 2 공지 게시판 위 어드민 작성 화면. **packages/auth 역할 타입 분리(AdminRole)는 Epic 1 Story 1.2 소유 — 9.1은 admin 테이블·Better Auth admin 인스턴스 생성 + admin 세션 기준 `canAccessAdmin` 집행 구현만**(검수 조정·중복 리팩터링 방지). **UX-DR-A1~A12 전부**(위험도별 확인·역할 매트릭스·도메인 어휘·자동숨김 보수 기본·AdminShell·데이터 테이블·접근성)는 모든 스토리 공통 적용.

### Story 9.1: 관리자 신원 DB 스키마 · Better Auth 인스턴스 · super_admin 시드

As a 개발팀,
I want 관리자 전용 DB 테이블과 별도 Better Auth 인스턴스·super_admin 시드가 ADR-0003대로 정착되기를,
So that 모든 어드민 기능이 유저 신원과 격리된 토대 위에서 구현된다.

**Acceptance Criteria:**

**Given** ADR-0003 스키마 설계
**When** `schema/admin.ts` 생성·`drizzle-kit generate`+migrate
**Then** `admin_role`(staff/super_admin)·`admin_status`(pending/active/suspended/disabled)·`admin_users`(email unique·name·phone·role default staff·status default pending·approved_by·approved_at·note)·`admin_sessions`·`admin_accounts`(credential 전용)·`admin_verifications` 생성, `users`와 FK·공유 컬럼 없음

**Given** 관리자 Better Auth 인스턴스(AR-10)
**When** `plugins/adminAuth.ts`에 basePath `/api/v1/admin/auth`(이메일+비밀번호·소셜 없음·Argon2id·admin 테이블 바인딩) 생성
**Then** 유저 인스턴스와 독립·`sign-in`/`sign-out` 존재·세션 쿠키 `aj_admin_session`(admin 서브도메인) 통합 테스트 확인

**Given** Epic 1 Story 1.2에서 정의된 `AdminRole`·권한맵 타입(검수 조정 — 타입은 Epic 1 소유)
**When** 9.1에서 `canAccessAdmin(session)`을 admin 세션·`status=active` 기준으로 **집행 구현**
**Then** `hasAdminPermission(role, action)`이 운영자(숨김 상한)/최고관리자(영구삭제·설정·광고·권한변경·운영자승인) 경계를 집행하고 web/admin/api typecheck 통과(중복 타입 재정의 없음)

**Given** 최초 super_admin 부트스트랩
**When** `seeds/super-admin.ts`(env `SUPER_ADMIN_*`) 실행
**Then** `admin_users`(status=active·role=super_admin)+`admin_accounts`(Argon2id) 생성, 재실행 멱등

**Given** `/api/v1/admin/*` 접근
**When** 유저 세션(`aj_session`)만 가진 요청
**Then** 401, `aj_admin_session` active 계정만 통과

### Story 9.2: 관리자 로그인 · 로그아웃 · 가입(승인 대기) UX

As a 관리자,
I want 관리자 전용 로그인/로그아웃·가입(승인 대기 안내)이 동작하기를,
So that 독립된 어드민 진입점으로 안전하게 로그인하고 신규 운영자 신청이 가능하다.

**Acceptance Criteria:**

**Given** `/login`에 이메일·비밀번호 입력
**When** active 자격증명 로그인
**Then** `aj_admin_session` 쿠키 발급·`admin_sessions` 생성·`/dashboard` 리다이렉트

**Given** pending/suspended/disabled 계정
**When** 올바른 자격증명이라도
**Then** 차단·상태별 사유 안내("승인 대기..."/"정지"/"비활성"), 유저 세션과 무관

**Given** 틀린 자격증명·연속 실패
**When** 시도
**Then** 어느 쪽인지 미노출·rate limit·과도 시 429

**Given** `/signup`에 이름·이메일·비밀번호·연락처
**When** 유효 제출
**Then** `admin_users`(pending·staff)+`admin_accounts`(Argon2id) 생성·"최고관리자 승인 후 로그인" 안내·로그인 불가

**Given** 중복 이메일
**When** 가입
**Then** 409·인라인 오류

**Given** 로그아웃
**When** 실행
**Then** `admin_sessions` 무효화·쿠키 제거·`/login`

### Story 9.3: AdminShell 레이아웃 · 인증 게이트 · 권한 분기 · 네비게이션

As a 로그인 관리자,
I want AdminShell(사이드바 14메뉴+상단바)이 역할에 따라 표시되고 비인증·권한 없음 접근이 거부되기를,
So that 운영자·최고관리자가 각자 허가 범위 내에서만 탐색한다.

**Acceptance Criteria:**

**Given** 미인증으로 `/dashboard` 이하 접근
**When** 요청
**Then** `/login` 리다이렉트·콘텐츠 미노출

**Given** active 관리자가 `/` 진입
**When** 로드
**Then** `/dashboard` 자동 리다이렉트

**Given** AdminShell
**When** 사이드바 렌더
**Then** 14개 1차 메뉴+운영자계정관리가 nav 그룹, `staff`에게 광고·사이트설정·운영자계정관리 **숨김**(UX-DR-A6), 미처리 신고>0이면 danger pill(UX-DR-A1)

**Given** `staff`가 `/ads`·`/settings`·`/admin-accounts` 직접 접근
**When** 로드
**Then** 권한 거부 화면·API 403

**Given** <980px
**When** 렌더
**Then** 사이드바 off-canvas·햄버거·포커스 트랩·Esc(UX-DR-A11)

**Given** nav 이동
**When** 메뉴 이동
**Then** active 강조(primary-50 배경·primary-700 글자)·키보드 내비

### Story 9.4: 운영자 계정 관리 (최고관리자 전용)

As a 최고관리자,
I want 가입 대기 운영자를 승인·반려하고 역할·상태를 관리하기를,
So that 승인된 운영자만 접근하고 역할별 권한 경계가 집행된다.

**Acceptance Criteria:**

**Given** 최고관리자 `/admin-accounts`
**When** 로드
**Then** `admin_users` 목록 테이블(이름·이메일·연락처·역할·상태·가입일·승인일·승인자)·상태 필터·검색·페이지네이션(URL 반영)

**Given** pending 행 승인
**When** 모달에 역할(staff|super_admin)·사유 메모 입력 후 확정
**Then** `status=active`·`approved_by`·`approved_at`·`note` 갱신·토스트, 사유 없이 확정 비활성(UX-DR-A4)

**Given** pending 행 반려
**When** 사유 메모 입력·확정
**Then** `status=disabled`·`note` 갱신·로그인 불가

**Given** active 운영자 정지
**When** 사유 입력·확정
**Then** `status=suspended`·기존 세션 즉시 무효화, 재활성 가능(모달+사유 유지)

**Given** 역할 변경(staff↔super_admin)
**When** 사유 입력·확정
**Then** `role` 갱신·세션 즉시 반영, 최고관리자 자기 역할 변경 403(자기 권한 박탈 방지)

**Given** `staff`의 `/admin-accounts` 접근
**When** 시도
**Then** 화면 숨김+API 403

### Story 9.5: 대시보드 + 접속 통계

As a 관리자,
I want 대시보드에서 핵심 지표·요주의 알림을 보고 접속 통계에서 기간별 유입·성과를 조회하기를,
So that 무엇을 먼저 처리할지 파악하고 데이터로 판단한다.

**Acceptance Criteria:**

**Given** `/dashboard` 진입
**When** 로드
**Then** KPI 카드(총 회원·오늘 신규·총 게시글·오늘 신규 글·총 다운로드·미처리 신고 danger)+운영 알림 리스트(미처리 신고·답변대기 우선)·클릭 시 해당 화면 이동(UX-DR-A10)

**Given** 로드 중
**When** 지연
**Then** 카드·리스트 스켈레톤

**Given** `/analytics` 진입
**When** 기간 선택(오늘/어제/7일/30일/이번달/지난달/사용자지정)
**Then** URL 반영·일별 가입·게시글·다운로드 차트(Recharts)+표/수치 대체(UX-DR-A11)

**Given** 데이터 없는 기간
**When** 빈 결과
**Then** EmptyState

**Given** `/api/v1/admin/analytics/*`
**When** `staff` 접근
**Then** 접근 가능(최고관리자 전용 아님), API는 관리자 세션만

### Story 9.6: 게시글 관리

As a 관리자,
I want 게시글을 목록/필터로 조회하고 공지·고정·추천·메인노출·숨김·삭제·복구·SEO 메타 보정을 처리하기를,
So that 콘텐츠 품질·구조를 사후 운영한다.

**Acceptance Criteria:**

**Given** `/posts` 진입
**When** 로드
**Then** posts 테이블(제목·게시판·작성자·작성일·조회수·댓글수·좋아요수·신고수·상태·플래그)·필터(게시판·상태·공지·추천·메인노출·기간·신고여부) URL 반영

**Given** 공지·고정·추천·메인노출 토글
**When** 클릭
**Then** **즉시 실행+토스트(undo)**·모달 없음(UX-DR-A4)

**Given** 숨김
**When** 실행
**Then** `status=hidden` soft·즉시+토스트(undo)·유저 사이트 비노출

**Given** 삭제(최고관리자/soft 단계)
**When** 모달+사유 확정
**Then** `status=deleted`·`deleted_at` soft-delete·목록 제외, 사유 없이 불가(UX-DR-A4). `staff`는 숨김까지·삭제 UI 숨김+API 403

**Given** deleted 게시글(30일 이내)
**When** 삭제됨 필터에서 복구
**Then** `status=published`·`deleted_at=null`·즉시+토스트

**Given** SEO 메타 수정(FR-10.4)
**When** 상세 드로어에서 제목·설명 보정·저장
**Then** `seo_title`·`seo_description` 갱신·페이지 메타 반영

**Given** 다중 선택 후 벌크 숨김/삭제
**When** 툴바 일괄
**Then** 위험도별 확인(숨김 즉시+토스트, 삭제 모달+사유)

### Story 9.7: Q&A 관리

As a 관리자,
I want Q&A 질문·답변을 목록/필터로 조회하고 상태 강제 변경·숨김·삭제하기를,
So that 묻고답하기 질을 사후 유지한다.

**Acceptance Criteria:**

**Given** `/qna` 진입
**When** 로드
**Then** 질문 목록 테이블(제목·작성자·Q&A 상태·작성일·답변수·신고수·콘텐츠 상태)·질문/답변 탭·필터(Q&A 상태·콘텐츠 상태·기간·신고여부) URL 반영

**Given** 질문 상세 드로어 상태 강제 변경
**When** 드롭다운 선택·저장
**Then** `status` 갱신·즉시+토스트(도메인 어휘 답변대기/답변있음/해결됨). 도움된 답변 대신 지정 금지(UX-DR-A9)

**Given** 질문/답변 숨김/삭제
**When** 처리
**Then** 9.6 규칙 동일, `staff` 숨김까지·삭제 최고관리자

**Given** 회원 댓글 내용 직접 수정 시도
**When** 어떤 경로든
**Then** 직접 수정 기능 부재(숨김/삭제 중심, UX-DR-A9)

### Story 9.8: 실전자료 관리

As a 관리자,
I want 실전자료를 목록/필터로 조회하고 부적절 첨부 삭제·자료 숨김/삭제·후기 관리하기를,
So that 자료실 품질·안전성을 사후 관리한다.

**Acceptance Criteria:**

**Given** `/resources` 진입
**When** 로드
**Then** 자료 테이블(자료명·유형·작성자·작성일·다운로드수·평점·신고수·상태)·필터(유형·상태·신고여부·기간) URL 반영

**Given** 자료 상세 드로어 첨부 삭제
**When** 모달+사유 확정
**Then** `resource_files` soft-delete(또는 R2 비활성화)·토스트(위험 액션). 안전성 보증·검수 표시 미부착(UX-DR-A9)

**Given** 자료 숨김/삭제
**When** 처리
**Then** 9.6 위험도별 확인 동일

**Given** 후기 탭 후기 숨김/삭제
**When** 처리
**Then** `comments`(target_type=resource) 숨김/soft-delete·위험도별 확인

### Story 9.9: 댓글 · 후기 통합 관리

As a 관리자,
I want 전체 댓글·후기를 통합 목록으로 조회하고 숨김/삭제·관련 글 이동하기를,
So that 댓글 환경을 사후 관리한다.

**Acceptance Criteria:**

**Given** `/comments` 진입
**When** 로드
**Then** 전체 comments 목록(내용 일부·작성자·대상 콘텐츠·유형·작성일·신고수·상태)·필터(유형=일반/대댓글/후기/답변·상태·신고여부·기간) URL 반영

**Given** "관련 글로 이동"
**When** 클릭
**Then** `target_type`·`target_id` 기반 관련 콘텐츠 관리 화면 이동(크로스 링크)

**Given** 숨김/삭제
**When** 처리
**Then** 9.6 위험도별 확인, 내용 직접 수정 안 함(UX-DR-A9)

**Given** 다중 선택 벌크
**When** 일괄
**Then** 벌크 숨김(즉시)·삭제(모달+사유)

### Story 9.10: 신고 관리 — 통합 큐 · 처리 · 반려 · cleanup worker

As a 관리자,
I want 신고 통합 큐에서 확인 후 숨김·반려·이용제한 처리하고 상태를 갱신하기를,
So that 신고 콘텐츠를 판단 기반으로 처리하고 이력을 남긴다.

**Acceptance Criteria:**

**Given** `/reports` 진입
**When** 로드
**Then** reports 통합 목록(대상 미리보기·유형·신고자·사유·신고일·상태·처리자)·필터(상태 접수/확인중/처리완료/반려·대상 유형·기간) URL 반영(UX-DR-A8)

**Given** 신고 상세 드로어 "신고 대상 보기"
**When** 클릭
**Then** 대상 콘텐츠 관리 화면 크로스 링크 이동·위반 판단

**Given** 상태 접수→확인중
**When** 변경
**Then** 즉시+토스트(되돌릴 수 있음, UX-DR-A4)

**Given** 위반 확정 후 숨김
**When** 드로어 숨김
**Then** `reports.status=처리완료`·대상 `status=hidden`·즉시+토스트(undo)

**Given** 부당 신고 반려
**When** 사유 메모 입력·확정
**Then** `reports.status=반려`(사유 없이 불가)·대상 변경 없음

**Given** `core/moderation.ts`
**When** `deriveReportAction(reportCount, threshold)` 정의
**Then** 임계치(9.15 설정) 기반 자동 숨김 여부 반환·단위 테스트

**Given** `cleanup` 큐 worker(AR-16)
**When** `content.cleanup` 주기 실행
**Then** `status=deleted` AND `deleted_at < now()-30d` 레코드(글/Q&A/댓글/자료) hard-delete·연관 R2 삭제·멱등(AR-7·16)

### Story 9.11: 자동 숨김 · 금칙어/스팸 필터

As a 관리자,
I want 신고 누적 자동 숨김(기본 OFF·보수적)·금칙어/스팸 필터가 동작하고 사이트 설정으로 제어되기를,
So that 오탐 리스크를 인지하며 필요 시 자동화 보조를 켠다.

**Acceptance Criteria:**

**Given** 자동 숨김(FR-8.3·UX-DR-A12)
**When** 신고 누적·`deriveReportAction` 평가
**Then** `auto_hide_enabled=false`(기본)·임계치 미설정이면 자동 숨김 미실행·큐에만 추가, `true`+임계치 초과 시 `status=hidden`·"자동 숨김" 플래그로 큐 추가(검토 가능)

**Given** 오탐(정상 글 숨김)
**When** 큐에서 복구
**Then** `status=published` 복구·즉시+토스트

**Given** 금칙어/스팸(FR-8.5)
**When** 콘텐츠 작성 API에 금칙어·광고 링크 포함 제출
**Then** 422 FORBIDDEN_CONTENT·미저장. 금칙어 목록은 `site_settings`/DB 기반(코드 재배포 없이 갱신)

**Given** 스팸 링크 패턴
**When** 광고 링크 포함
**Then** 422·`core/moderation.ts` `detectSpam(content)` 순수 함수 캡슐화·단위 테스트

### Story 9.12: 회원 관리 — 제재·포인트·등급·뱃지 수동 조작

As a 관리자,
I want 회원을 목록 조회하고 상태 변경(이용제한)·포인트 지급/차감·등급 변경·뱃지 지급/회수하기를,
So that 참여를 촉진하고 위반 회원을 절차적으로 제재한다.

**Acceptance Criteria:**

**Given** `/members` 진입
**When** 로드
**Then** users 목록(닉네임·이메일·가입일·등급·포인트·게시글수·신고수·상태)·필터(상태 정상/이용제한/탈퇴·등급·기간)·검색 URL 반영(UX-DR-A8)

**Given** 회원 상세 드로어에서 이용제한/영구정지
**When** 사유 메모+유형(경고/일시정지/영구정지)+종료일(일시정지) 입력·확정
**Then** `user_sanctions` 생성+`users.status`·`suspended_until` 트랜잭션 갱신(ADR-0002·UX-DR-A4), 사유 없이 불가

**Given** 제재 회원이 작성·다운로드·쪽지 시도
**When** API 요청
**Then** 403·"이용이 제한된 계정입니다"

**Given** 포인트 수동 지급
**When** 금액·사유 입력·저장
**Then** `points_ledger`(`type=admin_grant`)·토스트

**Given** 포인트 차감
**When** 모달+금액·사유 확정
**Then** `points_ledger`(`type=admin_deduct`)(위험 액션)

**Given** 등급 수동 변경
**When** 모달+사유 확정
**Then** `users.grade`(또는 캐시) 갱신(위험 액션)

**Given** 뱃지 수동 지급
**When** 선택·저장
**Then** `user_badges` 생성·즉시+토스트

**Given** 뱃지 회수
**When** 모달+사유 확정
**Then** `user_badges` 삭제(위험 액션)

**Given** `staff`가 권한 변경·영구 삭제 시도
**When** 시도
**Then** UI 숨김·API 403(최고관리자 전용)

### Story 9.13: 포인트 · 등급 · 뱃지 관리 화면 (기본형)

As a 최고관리자,
I want 포인트 규칙·등급 기준·뱃지 목록을 관리하기를,
So that 게이미피케이션 기준을 코드 재배포 없이 조정한다.

**Acceptance Criteria:**

**Given** `/points`(기본형)
**When** 로드
**Then** 활동별 포인트 규칙 목록·인라인 편집·저장·토스트

**Given** `/grades`(기본형)
**When** 로드
**Then** 등급 목록(새내기~마스터·운영자)·필요 포인트 편집·저장(UX-DR-A8)

**Given** `/badges`(기본형)
**When** 로드
**Then** 뱃지 목록(이름·설명·조건·활성)·신규 추가·비활성화(위험 액션 모달+사유)

**Given** 세 화면 `staff` 접근
**When** 접근
**Then** 가능(기본형), 위험 액션(비활성/삭제)은 최고관리자만·`staff` 숨김

### Story 9.14: 문의 관리 (FR-10.6)

As a 관리자,
I want 회원 1:1 문의를 조회하고 상태 변경·운영자 답변하기를,
So that 외주 포함 고객지원을 빠르게 처리한다.

**Acceptance Criteria:**

**Given** `/inquiries` 진입
**When** 로드
**Then** inquiries 목록(제목·문의자·접수일·처리일·상태)·필터(상태·기간)·검색 URL 반영

**Given** 상세 드로어 상태 접수→처리중
**When** 변경
**Then** `status=in_progress`·즉시+토스트

**Given** 운영자 답변 작성
**When** 답변 입력·저장
**Then** `inquiry_replies`(`author_type=admin`·`author_id`) 생성·`status=resolved`·유저 `/me/inquiries`에서 확인 + `inquiry.replied` 알림(Epic 7 채널)

**Given** 완료 문의에 추가 답변
**When** 완료→처리중 되돌리고 답변
**Then** 새 `inquiry_replies` 추가·상태 갱신·스레드 시간순

**Given** `staff`의 `/inquiries`
**When** 접근·답변
**Then** 가능(최고관리자 전용 아님)

### Story 9.15: 사이트 설정 (최고관리자 전용)

As a 최고관리자,
I want 신고 설정·보존기간·금칙어·SEO·파일 정책을 코드 재배포 없이 변경하기를,
So that 운영 환경에 맞게 조율한다.

**Acceptance Criteria:**

**Given** 최고관리자 `/settings`
**When** 로드
**Then** `site_settings`에서 섹션별(신고/콘텐츠/파일/SEO) 폼, `staff` 메뉴 숨김·직접 접근 403

**Given** 신고 설정 `auto_hide_enabled` 토글·`auto_hide_threshold` 입력·저장
**When** 저장
**Then** `site_settings` 갱신·9.10/9.11 로직 즉시 반영

**Given** 콘텐츠 보존기간 수정
**When** 저장
**Then** `content_retention_days` 갱신·cleanup worker 다음 실행 시 반영

**Given** 금칙어 목록 관리
**When** 추가·삭제·저장
**Then** DB 기반 갱신·재배포 없이 즉시 반영(9.11 `detectSpam` DB 조회)

**Given** SEO 기본 메타(사이트명·기본 설명·OG 이미지)
**When** 수정·저장
**Then** `site_settings` 갱신·`layout.tsx` 기본값 반영

### Story 9.16: 광고 관리 (최고관리자 전용)

As a 최고관리자,
I want 광고 슬롯을 등록·관리하고 노출 기간·기기·코드 설정·성과 확인하기를,
So that 신뢰를 해치지 않는 선에서 광고 수익을 운영한다.

**Acceptance Criteria:**

**Given** 최고관리자 `/ads`
**When** 로드
**Then** `ad_slots` 목록(광고명·위치·기기·노출기간·활성·클릭수·노출수), `staff` 메뉴 숨김·접근 403

**Given** 신규 등록(광고명·위치·기기·기간·코드)
**When** 저장
**Then** `ad_slots` 생성·토스트·코드 저장·해당 위치 렌더

**Given** 비활성화 토글
**When** 클릭
**Then** 즉시+토스트(undo)·사이트 즉시 비노출

**Given** 삭제
**When** 모달+사유 확정
**Then** `ad_slots.deleted_at` soft-delete(위험 액션)

**Given** 성과 조회
**When** 슬롯 상세 드로어
**Then** 기간별 노출·클릭·CTR(차트+수치 대체, UX-DR-A11)

### Story 9.17: 공지 관리 (FR-10.7)

As a 관리자,
I want 어드민에서 공지를 작성·수정·상단 고정·메인 노출 설정하기를,
So that 코드 배포 없이 공지를 발행하고 중요 공지를 강조한다.

**Acceptance Criteria:**

**Given** 게시글 관리에서 공지 필터 또는 `/posts/notices` 전용 뷰
**When** 로드
**Then** `board=notice` 게시글만·상단 고정·메인/배너 노출 플래그 컬럼

**Given** 신규 공지 작성(제목·Tiptap full·태그·이미지)
**When** 등록
**Then** `posts`(`board='notice'`·작성자=관리자 연계) 생성·`/notice` 즉시 공개, 작성 권한 운영자 한정·일반 회원 공지 작성 불가(FR-10.7·15.1)

**Given** 상단 고정·메인/배너 토글
**When** 클릭
**Then** 즉시+토스트(undo)

**Given** 공지 수정
**When** 저장
**Then** `posts` 갱신·토스트

**Given** 공지 숨김/삭제
**When** 처리
**Then** 9.6 위험도별 확인 동일

---

## Epic 10: 약관 & 정책

이용약관·개인정보처리방침·운영정책 세 페이지(PIPA 대응)를 공개 SSR로 구현하고, 회원가입 시 동의 흐름·동의 버전/시점 기록을 Epic 1 연계로 완결한다. 푸터 링크 배치.

> **경계:** 약관 콘텐츠 페이지(`/legal/*`)+동의 처리 API+동의 기록 스키마 = 이 에픽. 가입 폼 UI(`/signup` 화면)는 Epic 1 소유(약관 동의 체크박스 연계만 제공). 실전자료 등록 저작권 동의(FR-14.2)는 Epic 4. 동의 기록은 `users.terms_agreed_at`+`terms_version` 컬럼(버전별 이력은 향후 `consents` 테이블로 확장). 법무 텍스트는 플레이스홀더+운영자 수정 가능 구조. 순서: 10.1→10.2→10.3→10.4.

### Story 10.1: 약관 페이지 SSR 셸 — `/legal/*` + 푸터 링크

As a 방문자(비회원 포함),
I want 이용약관·개인정보처리방침·운영정책 세 페이지를 즉시 열람하기를,
So that 가입 전 권리·의무를 확인하고 검색엔진이 색인한다.

**Acceptance Criteria:**

**Given** `app/legal/terms|privacy|policy/page.tsx` 생성
**When** 비회원이 각 URL 접근
**Then** 로그인 없이 SSR 본문 즉시 렌더·HTML에 법무 텍스트 포함(NFR-1)

**Given** 각 법무 페이지
**When** `generateMetadata`
**Then** 고유 title·description·canonical(FR-11.1·11.2)·H1 1개·breadcrumb JSON-LD

**Given** 전역 푸터
**When** 어느 페이지든 렌더
**Then** "이용약관"·"개인정보처리방침"·"운영정책" 링크가 `/legal/*`를 가리킴

**Given** 법무 텍스트 미확정
**When** 렌더
**Then** 플레이스홀더 텍스트+버전 표기(`버전 0.1·시행일 미정`), 실제 텍스트 교체 시 해당 파일/레코드만 수정

**Given** 모바일(<768px)
**When** 열람
**Then** 가로 스크롤 없음·푸터 링크 탭 접근·터치 영역 ≥36px(NFR-3·UX-DR-U13)

### Story 10.2: 동의 기록 스키마 — `users` 컬럼 + 계약 타입

As a 개발팀,
I want 가입 시 동의한 약관 버전·시점을 `users`에 기록하는 스키마가 준비되기를,
So that PIPA 요건상 "언제·어떤 버전 동의"를 증명할 수 있다.

**Acceptance Criteria:**

**Given** `schema/users.ts`
**When** 마이그레이션 생성·적용
**Then** `terms_agreed_at` timestamptz·`terms_version` varchar(32) 추가(둘 다 nullable·기존 레코드 영향 없음), 단일 소유권 규칙(AR-2)

**Given** `contracts/auth.ts`
**When** 가입 Zod 스키마 정의
**Then** `signUpSchema`에 `termsAgreed: z.literal(true)`(false/누락 시 422)·`UserRow`에 `termsAgreedAt`·`termsVersion`

**Given** 약관 현재 버전 상수
**When** `core/legal.ts`에 `CURRENT_TERMS_VERSION='2026-06-17'` 정의
**Then** 가입 처리·약관 페이지가 동일 상수 import(단일 소스)

**Given** 소셜 로그인 최초 가입(1.5 연계)
**When** 신규 users 생성
**Then** 소셜 가입 완료 단계에서도 동의 수집→`terms_agreed_at`·`terms_version` 기록

### Story 10.3: 가입 시 약관 동의 흐름 + 동의 기록 API

As a 가입 시도 비회원,
I want 가입 폼에서 이용약관·개인정보처리방침에 동의하고 가입을 완료하기를,
So that 동의 사실이 기록되고 동의 없이는 가입이 진행되지 않아 법적 근거가 확보된다.

**Acceptance Criteria:**

**Given** `/signup`(Epic 1 폼)에 동의 UI 삽입
**When** 가입 폼 표시
**Then** "(필수) 이용약관·개인정보처리방침 동의" 체크박스(각 링크 `target="_blank" rel="noopener noreferrer"`로 `/legal/*`)+"(선택) 운영정책" 체크박스

**Given** 필수 약관 미체크
**When** 가입 클릭
**Then** 버튼 비활성 또는 인라인 오류(UX-DR-U11, 1.3 연계), API가 `termsAgreed:false`/누락 시 422 TERMS_NOT_AGREED

**Given** 동의 체크 후 유효 정보 제출
**When** `POST /api/v1/auth/sign-up`
**Then** 가입 service가 `users.terms_agreed_at=NOW()`·`terms_version=CURRENT_TERMS_VERSION` 트랜잭션 기록, DB 조회 시 null 아님

**Given** terms 컬럼 null 레코드(마이그레이션 전/비정상)
**When** 행동 시도
**Then** API 정상 처리·재동의 강제는 초기 범위 밖(향후 개정 스토리)

**Given** 접근성
**When** 키보드 탐색
**Then** 체크박스 `<input type="checkbox">` Space 토글·`<label>` `for`/`id` 연결·링크 텍스트 식별 가능(UX-DR-U13)

### Story 10.4: 약관 버전 변경 대응

As a 운영자,
I want 약관 개정 시 버전 상수를 올리고 기존 회원에게 재동의를 안내할 기반이 있기를,
So that 중요 변경 시 정보주체에게 통보·재동의를 받는 경로가 확보된다.

**Acceptance Criteria:**

**Given** `CURRENT_TERMS_VERSION` 변경·배포
**When** 새 버전
**Then** `/legal/*` 시행일·버전 표기 자동 반영(버전 컴포넌트가 상수 참조)·이전 텍스트는 소스 교체

**Given** `users.terms_version != CURRENT_TERMS_VERSION` 회원 로그인
**When** 세션 응답
**Then** `termsUpdateRequired:true` 포함(클라이언트 재동의 안내 가능), 행동 전면 차단은 범위 밖(이 스토리는 신호 제공까지)

**Given** 재동의 신호 받은 클라이언트
**When** `POST /api/v1/users/me/terms-consent`
**Then** `terms_agreed_at`=현재·`terms_version`=`CURRENT_TERMS_VERSION` 갱신·이후 `termsUpdateRequired:false`

**Given** 버전 변경 없는 운영
**When** 신규 가입
**Then** `termsUpdateRequired:false`·재동의 미발생(회귀 방지)

**Given** 소셜 최초 가입(1.5)
**When** 프로필 설정 단계 동의 완료
**Then** `terms_agreed_at`·`terms_version` 기록·재동의 판단에 동등 적용

---

## 검수 노트 (메인 에이전트 — 에픽 간 정합성 조정)

> 9개 에픽을 병렬 서브에이전트로 생성한 뒤 메인 에이전트가 BMAD 준수·FR 커버리지·에픽 간 소유권/미래 의존을 검수하며 적용한 조정 사항. 다운스트림(`bmad-create-story`)은 아래를 반영한다.

1. **Epic 4 Story 4.10 제거** — 어드민 자료 관리는 관리자 인증(Epic 9 Story 9.1)이 선행돼야 하므로 미래 의존 위반. FR-10.3은 Epic 9 Story 9.8이 커버.
2. **공지 작성 권한(FR-15.1/10.7)** — 관리자 신원은 Epic 9 Story 9.1 소유. Epic 2 Story 2.9는 공지 *읽기/구조* + 작성 API 게이트만, 작성 UI는 Epic 9 Story 9.17.
3. **packages/auth 역할 분리** — 타입(`AdminRole`·권한맵)은 Epic 1 Story 1.2 소유. Epic 9 Story 9.1은 admin 테이블·Better Auth admin 인스턴스 생성 + admin 세션 기준 `canAccessAdmin` 집행 구현만(중복 리팩터링 금지).
4. **조회수 인프라(Redis 버퍼+view-flush worker)** — Epic 2 Story 2.4에서 최초 도입, Epic 3·5·8이 재사용(Epic 5 Story 5.3은 question·resource·comment 대상 확장).
5. **참여(좋아요·댓글·신고·북마크) 소유권** — Epic 5가 다형 테이블(reaction·comment·bookmark·report·block) 소유. Epic 2·3·4는 상세 페이지 슬롯만, Epic 5가 활성화. 신고 *제출/기록*=Epic 5, 신고 *처리/자동숨김*=Epic 9.
6. **포인트·등급·뱃지** — 도메인 규칙·적립 훅·유저 표시=Epic 6. 알림 전달=Epic 7. 어드민 수동 지급/회수 화면=Epic 9.
7. **자동 닉네임·기본 프로필(FR-1.10) & 팔로우(FR-7.10) 추가(2026-06-22 기획 반영)** — (a) 닉네임은 가입 시 사용자 입력이 아니라 시스템 자동 배정으로 변경(Story 1.3 재작성), 프로필 컬럼(bio·avatar_url·banner_url·default_avatar_index·links)은 Story 1.2 users 스키마가 소유. 기본 이미지 자산 최적화(WebP)는 Story 1.3. (b) 팔로우는 user→user 그래프로 다형 모델과 분리, `follows` 테이블은 Story 5.1 마이그레이션이 소유, 동작은 신규 Story 5.12. 프로필 팔로우 버튼·카운트(Story 1.10)와 마이페이지 팔로잉/팔로워 탭(Story 1.8 셸)은 슬롯으로 두고 Story 5.12가 활성화(미래 의존 회피, 차단과 동일 패턴). 팔로잉 피드는 범위 외(후속).
8. **AI 창작물 스펙(FR-5.2) & 작당 의뢰소(FR-5.3) 추가 + 자유게시판 리네이밍(2026-06-22 기획 반영)** — (a) "자유 게시판"→**작당 수다방**(`/lounge/free`→`/lounge/talk`) 리네이밍, board 시드(Story 2.1) 9→10개. (b) AI 창작마당 창작물 스펙은 선택 입력, `post_creative_spec`(1:1) 테이블·우측 패널 UI를 신규 Story 2.11이 소유. (c) 작당 의뢰소(`/lounge/gigs`)는 구인·외주 구조화 폼, `recruit_post`(1:1) 테이블·모집 상태·필터를 신규 Story 2.12가 소유. 쪽지 [쪽지 보내기]는 슬롯 → Epic 7 FR-13, 차단은 Epic 5 5.11 연계. 두 스펙/폼 모두 가드레일("글쓰기 양식 과다"·"게시판 과도 분할") 대비 선택·접이식/목적형 단일 게시판으로 한정.

### 최종 커버리지 확인
- **FR 90개 전부** 최소 1개 스토리에 매핑(FR Coverage Map 참조 — FR-1.10·FR-7.10·FR-5.2·FR-5.3 추가). NFR-1~8·AR-1~18·UX-DR(U1~16·A1~12) 귀속 완료.
- **총 에픽 10개 / 스토리 약 93개**(E1:10·E2:12·E3:9·E4:9·E5:12·E6:6·E7:5·E8:9·E9:17·E10:4).
- 각 스토리는 단일 dev-agent 크기·Given/When/Then AC·미래 의존 회피·entity-when-needed 원칙 준수.
