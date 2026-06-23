# Epic 4 자동 개발 오케스트레이션 계획 (메인 에이전트 복구용)

> 작성: 2026-06-23 19:xx KST. 사용자 지시: **2026-06-24 00:00(자정) 이후** Epic 4 착수.
> bmad-dev-story 워크플로 + 백그라운드 서브에이전트(model: sonnet) 병렬 실행.
> 서브에이전트 완료 보고 → **메인(나)이 직접 검수 후 머지·완료 처리**. 사용자 부재 시에도 **절대 허락 대기 금지**(전권 위임).
> 이 파일은 컨텍스트 요약/세션 단절 후 복구용. 진행 시 STATUS 표를 갱신할 것.

## 사용자 확정 사항 (2026-06-23 사전 합의)
1. **Epic 2는 자정 시점 완료·커밋 가정.** 자정에 현재 main에서 분기. 마이그레이션은 그 시점 최신 번호 다음으로 순차 생성(충돌 처리 불필요). → 시작 시 `git status`/`git log` 재확인만.
2. **자료실 구조 = 기존 4-독립-페이지 스캐폴드 + 7-Step 등록폼 + 라우트 override 준수.** 스토리 문서의 단일 `/resources/new`·단일 `/resources` 목록 서술은 무시하고 기존 구조에 실데이터 와이어링.
   - 기존 스캐폴드: `apps/web/app/resources/{prompts,mcp-skills,rules,templates}/` (각 page.tsx · {slug}/page.tsx · write/ 폼 · *.module.css)
   - 메모리 근거: route-ux-decisions-override-epics ("자료실=4독립페이지(등록폼만 7-Step)")

## 의존성 그래프 (DAG)
```
4.1 (스키마+계약+마이그레이션) ──▶ 전(全) 스토리 차단 해제
4.3 (상세, ResourceDetailClient.tsx 생성) ──▶ 4.6, 4.7 (해당 파일 UPDATE)
4.5 (업로드 보안 파이프라인) ──▶ 4.4(파일 메타 insert), 4.6(다운로드)
4.4 (7-Step 등록폼) ──▶ 4.8 (수정/삭제)
4.2 (목록/카드) ──▶ 4.9 (마이페이지 자료 탭)
```

## 웨이브 계획 (웨이브 내 병렬, 웨이브 간 순차)
- **W0 (단독)**: 4.1 — 스키마+계약+마이그레이션. 메인 검수→main 커밋(모든 후속의 base). 마이그레이션 단일 소유권(AR-2).
- **W1 (3 병렬)**: 4.2, 4.3, 4.5
- **W2 (3 병렬)**: 4.4, 4.6, 4.7
- **W3 (2 병렬)**: 4.8, 4.9

## 공유(충돌) 파일 — 머지 시 메인이 직접 3-way 충돌 해소
- `apps/api/src/routes/v1/resources/resource.route.ts` · `resource.service.ts` — 거의 모든 스토리가 append. 웨이브 내 브랜치 **순차 머지**(A→main, B를 갱신된 main에 머지·해소, C…).
- `apps/web/app/resources/[slug]/ResourceDetailClient.tsx` — 4.3 생성, 4.6·4.7 UPDATE(W2 충돌).
- `packages/contracts/src/resource.ts` — 4.1 생성, 4.5·4.6·4.9 UPDATE.
- `apps/web/app/resources/{type}/page.tsx` — 4.2 와이어링, 4.9 UPDATE.
- `_bmad-output/.../sprint-status.yaml` — 각 워크트리가 자기 사본 수정. **머지 충돌 무시하고 메인이 main에서 직접 상태 갱신.**

## 실행 메커니즘
1. 자정 경과 확인 후 시작.
2. **새 의존성 선설치(main, 4.1 머지 직후·W1 착수 직전 1회)**: 점검 결과 apps/api는 @aws-sdk/client-s3·@fastify/multipart·bullmq·ioredis 보유. ClamAV는 raw `net` 소켓이라 추가 패키지 불필요. **실제 부족분 2개만 설치**:
   - `apps/worker`: `@aws-sdk/client-s3` (4.5 worker S3)
   - `apps/api`: `@aws-sdk/s3-request-presigner` (4.6 presigned URL)
   설치는 4.1 워크트리 install과 동시 실행 피하고 4.1 머지 후 main에서. 설치 후 lockfile 커밋 → W1/W2 워크트리가 상속(서브 HALT 예방).
3. 웨이브마다 스토리별:
   - `git worktree add .claude/worktrees/4-x epic4/4-x` (현재 main에서 분기). (.claude/worktrees/ 는 .gitignore됨)
   - 필요 시 워크트리에서 `pnpm install`(공유 store라 빠름).
   - **백그라운드 Agent**(general-purpose, model sonnet, run_in_background:true) 스폰. 프롬프트에 워크트리 경로 + 명시적 story_path + bmad-dev-story 워크플로 지시 + 본 계획의 제약(스캐폴드/override/경계) 포함.
4. 완료 알림 수신 → **메인 검수**(아래 체크리스트) → 통과 시 브랜치 main 머지·워크트리 제거·sprint-status main에서 done 갱신. 실패 시 SendMessage로 동일 서브에이전트에 수정 지시(컨텍스트 유지). HALT 보고 시 메인이 자율 판단·재지시.
5. 웨이브 완료 후 다음 웨이브.

## 서브에이전트 프롬프트 필수 포함 항목
- model: sonnet. 언어: 한국어.
- "**bmad-dev-story 워크플로로 개발**: Skill 툴로 `bmad-dev-story` 호출(args=story 경로). 불가 시 `.claude/skills/bmad-dev-story/SKILL.md`와 step 파일을 읽고 그 워크플로를 정확히 실행."
- 작업 디렉터리 = 지정 워크트리. 모든 git/pnpm/edit은 그 안에서.
- 명시적 story_path (자동 discovery 금지 — 병렬 충돌 방지).
- **자료실 구조 제약**(위 §확정사항 2): 기존 4-독립-페이지 스캐폴드 유지·실데이터 와이어링. 새 단일 라우트 만들지 말 것.
- **경계 엄수**: `comment/reaction/bookmark/report` 테이블 생성 금지(Epic 5 슬롯만, commentCount/후기수=0). resource/resource_file/rating만 이 에픽 소유.
- **DB 격리(AR-2)**: packages/database는 apps/api·apps/worker에서만 import, apps/web 금지.
- 게이트(경량): `pnpm typecheck`(워크스페이스) + 관련 패키지 lint + 해당 스토리 테스트. 전체 빌드는 에픽 끝 1회.
- **HALT 대신 보고**: 새 의존성 필요/모호/막힘이면 중단·기록 후 최종 메시지로 메인에 사유 보고(사용자에게 묻지 말 것). 단, 새 deps는 메인이 선설치하므로 대부분 불필요.
- 커밋: 워크트리 브랜치에 의미 단위 커밋. 끝에 변경 파일 목록·실행한 게이트 결과 보고.

## 메인 검수 체크리스트 (서브에이전트 완료 후)
1. `git -C <worktree> diff main --stat` + 핵심 diff 정독. 스토리 AC 1:1 대조.
2. 워크트리에서 `pnpm typecheck` 재실행(서브 보고 신뢰 안 함).
3. 경계 위반 확인: Epic 5 테이블 없는지, web에서 database import 없는지, 단일 라우트 신설 안 했는지.
4. 자료실 페이지 = 기존 스캐폴드 와이어링인지(신규 단일 페이지 만들었으면 반려).
5. UI 변경 스토리(4.2/4.3/4.4/4.6/4.7/4.9): dev 서버 띄워 **브라우저로 실제 페이지 확인**(메모리: verify-ui-by-opening-page, dev는 PowerShell Start-Process web 3003). 깨짐 시 반려.
6. 통과 → main 머지(충돌 해소) → sprint-status done → 워크트리 제거.

## 진행 로그 (자정 실행)
- 00:01 자정 확인. 워킹트리에 미커밋 Epic2/3 WIP(+마이그 0003/0004) 발견 → 전체 typecheck 통과 확인 후 **54fdea3** 체크포인트 커밋(Epic4 base 고정, 번호 충돌 방지).
- 4.1: 529로 2회 작업0 실패 → 3번째 성공. 검수(typecheck·마이그SQL·경계·테스트35) 통과 → main FF 머지 **95c4388**. sprint-status 4-1 done.
- deps: worker `@aws-sdk/client-s3`, api `@aws-sdk/s3-request-presigner` 설치 → **ef0ed2b**.
- 라우트 충돌 방지: `apps/api/src/routes/v1/resources/routes.ts` 빈 집계자 선생성 + v1 등록 → **0d308ef**. 각 스토리는 concern별 모듈(`list/detail/upload/...route.ts`+service)만 추가하고 집계자에 import 1줄+register 1줄. (단일 resource.route.ts 명세를 모듈 분리로 대체)
- **유형↔페이지 매핑**(4.2/4.3/4.9 공통): prompts→`prompt` / mcp-skills→`claude-code-skill`+`mcp` / rules→`rules-config` / templates→`template-checklist`. DB enum(5종)이 정본, 스캐폴드 세부탭은 enum 기준 정리.
- W1 병렬 스폰: 4.2=a7340690 / 4.3=a678ce05 / 4.5=ad863b4f (base 0d308ef).
- 머지 시 `resources/routes.ts`에 3개 브랜치가 각각 import/register 추가 → 단순 다중라인 충돌, 순차 머지로 해소.
- **W1 완료**: 4.2 검수 중 mcp-skills가 claude-code-skill 누락 결함 발견 → 메인이 직접 수정(types 다중유형 파라미터, ec86c38). 4.2/4.3/4.5 순차 머지(routes.ts 충돌 해소) → main **1259d49**. worker→contracts 워크스페이스 링크 위해 main에서 `pnpm install` 필요했음. 전체 -r typecheck 통과. sprint-status 4-1~4-3,4-5 done.
- **W2 병렬 스폰**(base 1259d49): 4.4=a66a6c60 / 4.6=adb33bc7 / 4.7=a2e0d3e4. 4.6·4.7은 ResourceDetailClient의 서로 다른 슬롯(다운로드 vs 평점) 편집 → 머지 시 충돌 주의.
- **검수 교훈**: 머지 후 main에서 `pnpm install` 1회(워크스페이스 새 의존성 링크) + 전체 `-r typecheck` 필수. 서브 보고의 typecheck는 격리 환경이라 통합 이슈 못 잡음(예: write.service.test 미사용 import는 통합 typecheck에서만 검출).
- **W2 완료**(main **4076aa9**): 4.4(/resources/new 7-Step, per-type write→redirect)·4.6(다운로드 presigned)·4.7(평점) 순차 머지. routes.ts + ResourceDetailClient(다운로드+평점 슬롯) 충돌 직접 해소. 통합 typecheck 통과. **시드 데이터 1건(sample-skill-verify, claude-code-skill)** 넣고 상세 페이지 렌더 검증(제목·다운로드·평점·별점 표시, 에러 없음). sprint-status 4-4/4-6/4-7 done.
- 인증 훅 불일치 메모: RDC(4.3/4.6/4.7)는 `@/hooks/useAuth` + 4.7은 `@/contexts/GatingContext`, 4.4 폼은 `useMockAuth`(lounge와 동일). 둘 다 컴파일·기존 패턴이나 추후 통일 검토.
- **W3 병렬 스폰**(base 4076aa9): 4.8=ae2c7399 / 4.9=ad7119f1. 4.8=mutate(수정/삭제,소유권,soft-delete,RDC handleDelete 슬롯,필요시 마이그0006) / 4.9=mypage 자료탭+me/resources.route.ts(별도)+목록4페이지 CollectionPage JSON-LD. 충돌 적음(서로 다른 영역).
- 시드 잔재: resources 'sample-skill-verify' + resource_files 1건 — 에픽 종료 후 정리 가능(또는 데모용 유지).

## ✅ 최종 결과 (Epic 4 완료)
- **9개 스토리 전부 done·머지** (main b437c1c). sprint-status epic-4: done.
- W3: 4.8(수정/삭제, 마이그 0006 file_status, RDC handleDelete) + 4.9(mypage 자료탭, me/resources.route, 4페이지 CollectionPage JSON-LD). 
- **검수서 잡은 통합 결함 3건(메인 직접 수정)**: ①4.2 mcp-skills claude-code-skill 누락(types 파라미터) ②4.4 미사용 import ③**4.8+4.9 GET /me/resources 중복 라우트**(4.8 핸들러 제거, 4.9 단독) — Fastify 부팅 크래시 막음(typecheck로 안 잡힘).
- 게이트: 전체 `-r typecheck` 통과 / API 테스트 126 통과 / utilities·worker 테스트 통과 / 마이그 0005·0006 DB 적용.
- 런타임 검증: dev(web3003/api4003) + 시드 sample-skill-verify → 목록4페이지·상세(다운로드+평점)·mypage 200 렌더, edit는 소유자 게이팅 404(정상), API me/resources 401(정상).
- **⚠️ 사전 존재 이슈(Epic4 무관, 미해결)**: ①`packages/contracts/src/auth.test.ts` sessionSchema 3건 실패(Story 1.4) ②`pnpm --filter web build`가 `/signup` 프리렌더에서 실패(Epic1/10 영역, 내 세션서 미수정·Epic4 import 안 함). 자료 페이지는 dynamic이라 SSG 단계와 무관·정상 컴파일. → 메인 에이전트가 별도 처리 권장.
- 잔재: DB에 시드 sample-skill-verify(+file 1) 유지(데모용). 워크트리 전부 제거.

## 진행 STATUS (갱신 필수)
| 스토리 | 웨이브 | 상태 | 브랜치/워크트리 | 비고 |
|---|---|---|---|---|
| 4-1-resource-schema-api-contracts | W0 | **진행중**(서브 a6162688, 1차 529로 재시작) | epic4/4-1 | base=54fdea3, 마이그 0005 예정 |
| 4-2-resource-list-page | W1 | 대기 | epic4/4-2 | 4 type page 와이어링 |
| 4-3-resource-detail-page | W1 | 대기 | epic4/4-3 | ResourceDetailClient 생성 |
| 4-5-file-upload-security-pipeline | W1 | 대기 | epic4/4-5 | 새 deps·worker·S3 |
| 4-4-resource-write-form | W2 | 대기 | epic4/4-4 | 7-Step, 파일메타 insert |
| 4-6-resource-download | W2 | 대기 | epic4/4-6 | presigned 60s |
| 4-7-resource-rating | W2 | 대기 | epic4/4-7 | RatingInput 컴포넌트 |
| 4-8-resource-edit-delete | W3 | 대기 | epic4/4-8 | 마이그레이션 추가 가능(resource_files.status) |
| 4-9-mypage-resource-tab-collection-jsonld | W3 | 대기 | epic4/4-9 | me/resources.route.ts(별도) |

## 환경 메모
- pnpm: `C:/Users/daubs/AppData/Local/pnpm/pnpm` (v10.16.1), node v22.19.0
- dev 서버: PowerShell `Start-Process`로 분리 실행(web 3003 / admin 3004). Bash run_in_background는 자식 reap돼 죽음.
- 서브에이전트 model: sonnet (사용자 규칙)
- 마이그레이션 파일은 머지 전 커밋 금지 규칙(AR-2) — 4.1/4.8 단독 소유 확인
