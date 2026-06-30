# Story 11.5: `ensureBotUser` + 페르소나·리듬·주제풀 시드 + 랭킹 제외 토글

Status: ready-for-dev

## Story

As a 시스템 운영자,
I want 7인+관리자 봇 페르소나를 DB에 멱등으로 적재하고 봇 계정의 통계·랭킹 제외 여부를 설정으로 제어하기,
so that 시딩 봇 실행 토대(페르소나·리듬·주제풀)가 완비되고 일반 사용자 통계에 봇이 섞이지 않는다.

---

## Acceptance Criteria

1. `scripts/seed-bots.ts`를 실행하면 설계 문서의 **7인+관리자** 페르소나·담당 게시판·활동 리듬·고정 주제풀(topic-pools 전량) 및 `bot_settings`(봇 전역 설정) 기본값이 DB에 적재된다. **멱등**: 재실행해도 중복 삽입 없음. 트랜잭션 단위 = 페르소나 1인씩.

2. `ensureBotUser(persona)` 함수가 다음을 보장한다:
   - `users` 테이블에 `is_bot = true`인 계정을 `nickname` 기준으로 upsert(없으면 생성, 있으면 유지).
   - `email_verified = true`, `status = 'active'`, `name = nickname` 설정.
   - 기본 프로필 필드(`defaultAvatarIndex` 등) 초기화. 이미 있으면 덮어쓰지 않음.
   - 닉네임 정확히 8개: `dubu_2`, `rainy03`, `semo_k`, `감자세개`, `wolse99`, `latte2x`, `냉장고털이`, `AI작당지기`.

3. `bot_persona_boards`(담당 게시판) 시드 시 아래 **게시판 한글명 → BOARDS 키 매핑표**를 사용한다. 기존 `packages/contracts/src/board.ts`의 BOARDS 상수 키와 반드시 일치해야 한다. **Q&A·실전자료**는 BOARDS 키가 없으므로 별도 처리(아래 표 참고).

   | 설계 문서 한글명 | `bot_persona_boards.board` 값 | 비고 |
   |---|---|---|
   | 자동화 사례 | `automation-cases` | BOARDS 확인: "자동화 사례" |
   | 자동화 팁 | `automation-tips` | BOARDS 확인: "자동화 팁" |
   | 자동화 가이드 | `automation-guide` | BOARDS 확인: "자동화 가이드" |
   | 바이브코딩 팁 | `vibe-coding-tips` | BOARDS 확인: "바이브 코딩 팁" |
   | 바이브코딩 가이드 | `vibe-coding-guide` | BOARDS 확인: "바이브 코딩 가이드" |
   | AI 창작마당 | `ai-creation` | BOARDS 확인: "AI 창작물" |
   | 내가 만든 AI 제품 | `ai-products` | BOARDS 확인: "AI 제품·서비스" |
   | 작당 수다방 | `talk` | BOARDS 확인: "작당 라운지". 설계 문서 "수다방"≠BOARDS 레이블 "라운지"이나 키 `talk`가 정확한 값 |
   | 작당 의뢰소 | `gigs` | BOARDS 확인: "구인구직" |
   | 수익화 사례 | `monetization-cases` | BOARDS 확인: "수익화 사례" |
   | 외주·판매 팁 | `monetization-tips` | BOARDS에 "외주·판매 팁" 전용 키 없음 → "수익화 팁"(`monetization-tips`)이 가장 가까운 키. ⚠️ 향후 BOARDS에 키 추가 시 마이그레이션 필요 |
   | 묻고답하기 | `qna` | BOARDS 키 없음. `bot_persona_boards.board` 컬럼은 BOARDS 키 외 `qna` 허용 필요(Story 11.1 스키마 정의 시 varchar 제약). 봇 작성 파이프라인(11.9)이 `board==='qna'` 감지 시 `job_kind='question'` + **`createQuestionAsBot`**(11.4 #6) 경로로 라우팅. |
   | 실전자료 (4종) | `resource:<type>` 형식 | BOARDS 키 없음. `resource:prompt`, `resource:mcp`, `resource:rules-config`, `resource:template-checklist` 형식으로 `bot_topics.board` 컬럼에 저장. `bot_persona_boards`엔 `resource` 한 항목만 등록 가능(또는 4항목). 생성 파이프라인(11.9)이 `resource:` 접두사 감지 시 `job_kind='resource'` + **`createResourceAsBot`**(11.4 #6) 경로로 라우팅(`<type>`는 자료 유형으로 매핑). |

4. `bot_settings.bot_exclude_from_ranking`(봇 랭킹 제외 토글, 기본값 `true`) 값에 따라 아래 **기존 쿼리 파일 4곳**에서 `is_bot = true`인 `users`를 통계·랭킹에서 제외/포함한다. 일반 사용자 통계 회귀(regression) 없음.
   - 제외 대상 파일 목록 — Tasks §4 참고.
   - 구현 방법: 각 쿼리 앞에서 `getBotExcludeFlag(db)` 헬퍼로 `bot_settings` 테이블에서 값을 읽어 조건 분기. 해당 헬퍼는 Redis 캐시 불가 환경을 고려해 `try/catch`로 안전하게 조회하고 실패 시 기본값 `true`(제외) 사용.

---

## Tasks / Subtasks

### Task 1: `ensureBotUser` 함수 구현 (AC: #2)
- [ ] 1.1 `scripts/seed-bots.ts` 파일 생성. `@ai-jakdang/database`에서 `getDb`, `closeDb`를 import. `@ai-jakdang/config`에서 `env`를 import.
- [ ] 1.2 `ensureBotUser(persona: PersonaSeed, db: Database): Promise<string>` 함수 구현 (반환값: `users.id`).
  - `nickname` 기준 `users` 테이블 조회(SELECT).
  - 없으면 INSERT — `is_bot=true`, `email_verified=true`, `status='active'`, `name=persona.nickname`, `email=`<닉네임기반 내부 이메일>`(예: `dubu_2@bot.ai-jakdang.internal`), `termsAgreedAt=NOW()`.
  - 있으면 userId만 반환(덮어쓰지 않음).
  - ⚠️ Story 11.1에서 `users.is_bot` 컬럼이 추가되어야 함 — 선행 의존.

### Task 2: `bot_settings` 시드 (AC: #1, #4)
- [ ] 2.1 `seedBotSettings(db)` 함수 구현 — `bot_settings` 테이블에 기본값 8개 upsert.
  ```
  bot_master_enabled         = false   (킬 스위치, 부팅 직후 OFF)
  bot_daily_post_limit       = 10      (하루 최대 글 수)
  bot_daily_comment_limit    = 40      (하루 최대 댓글 수)
  bot_daily_cost_limit_usd   = 2.0     (일일 AI 비용 상한 달러)
  bot_exclude_from_ranking   = true    (랭킹 제외 기본 ON)
  bot_auto_refill_topics     = true    (주제 자동 보충 ON)
  bot_observation_mode       = true    (초기 관찰 모드 ON)
  bot_push_channel           = "telegram" (푸시 채널)
  ```
  멱등: `INSERT … ON CONFLICT (key) DO NOTHING`.

### Task 3: 페르소나·리듬·주제풀 시드 전체 구현 (AC: #1, #2, #3)
- [ ] 3.1 `PersonaSeed` 타입 정의 (스크립트 내부). 아래 8인 데이터를 상수로 선언.
- [ ] 3.2 각 페르소나에 대해 아래 순서로 DB 삽입 (1인 = 1 트랜잭션):
  - `ensureBotUser` → `userId` 확보
  - `bot_personas` upsert (`user_id + nickname` 유니크 — `ON CONFLICT DO NOTHING`)
  - `bot_persona_boards` upsert (담당 게시판, `weight=1` 기본)
  - `bot_activity_rhythm` upsert
  - `bot_topics` upsert (전체 주제풀 — `title_seed + persona_id` 유니크, `ON CONFLICT DO NOTHING`)
- [ ] 3.3 `seedBotPersonas(db)` 함수로 위 로직을 묶어 8인 순회 실행.
- [ ] 3.4 `main()` 함수에서 `seedBotSettings(db)` → `seedBotPersonas(db)` 순서로 호출 후 `closeDb()`.

#### 3.3.1 페르소나 데이터 상수 (코드에 그대로 반영)

| 닉네임 | `hidden_identity` (숨은 정체성) | `age_job` | `info_ratio` | `is_admin_persona` |
|---|---|---|---|---|
| `dubu_2` | "30대 직장인, 퇴근 후 n8n·Make 자동화" | "30대, 직장인" | 60 | false |
| `rainy03` | "20대 후반, AI 그림·디자인" | "20대 후반, 디자이너" | 20 | false |
| `semo_k` | "30대 개발자, 바이브코딩에 회의적" | "30대, 개발자" | 75 | false |
| `감자세개` | "20대, 막 입문한 새내기" | "20대, 입문자" | 10 | false |
| `wolse99` | "40대, AI 부수입에 진심" | "40대, 부업러" | 80 | false |
| `latte2x` | "30대 마케터, 콘텐츠 자동화" | "30대, 마케터" | 70 | false |
| `냉장고털이` | "20대, 커뮤니티 활동파" | "20대, 활동파" | 5 | false |
| `AI작당지기` | "운영팀 공식 계정" | "운영팀" | 100 | true |

#### 3.3.2 담당 게시판 (`bot_persona_boards`) — AC #3 매핑표 적용

| 닉네임 | 담당 게시판 (`board` 값) |
|---|---|
| `dubu_2` | `automation-cases`, `automation-tips`, `talk` |
| `rainy03` | `ai-creation`, `ai-products`, `talk` |
| `semo_k` | `qna`, `vibe-coding-tips`, `automation-tips` |
| `감자세개` | `qna`, `talk`, `automation-cases` |
| `wolse99` | `monetization-cases`, `monetization-tips`, `gigs` |
| `latte2x` | `monetization-cases`, `automation-cases`, `vibe-coding-tips` |
| `냉장고털이` | `talk`, `ai-creation` |
| `AI작당지기` | `vibe-coding-guide`, `automation-guide`, `resource` |

#### 3.3.3 활동 리듬 (`bot_activity_rhythm`)

| 닉네임 | `posts_per_week` | `comments_per_week` | `active_hours` | `active_days` |
|---|---|---|---|---|
| `dubu_2` | 4 | 10 | `[{"from":21,"to":24},{"from":12,"to":13}]` | `{"weekday":0.8,"weekend":0.2}` |
| `rainy03` | 3 | 8 | `[{"from":15,"to":22}]` | `{"weekday":0.4,"weekend":0.6}` |
| `semo_k` | 4 | 15 | `[{"from":23,"to":2,"crossesMidnight":true}]` | `{"weekday":0.6,"weekend":0.4}` |
| `감자세개` | 3 | 12 | `[{"from":19,"to":23}]` | `{"weekday":0.4,"weekend":0.6}` |
| `wolse99` | 3 | 8 | `[{"from":7,"to":9},{"from":12,"to":13}]` | `{"weekday":0.85,"weekend":0.15}` |
| `latte2x` | 4 | 10 | `[{"from":9,"to":12}]` | `{"weekday":1.0,"weekend":0.0}` |
| `냉장고털이` | 7 | 25 | `[{"from":0,"to":24}]` | `{"weekday":0.5,"weekend":0.5}` |
| `AI작당지기` | 5 | 0 | `[{"from":10,"to":11}]` | `{"weekday":1.0,"weekend":0.0}` |

> 자정을 넘는 활동 구간은 `crossesMidnight:true`로 명시한다. `to > 24` 값이나 `% 24` 보정은 사용하지 않는다.

#### 3.3.4 주제풀 (`bot_topics`) 전체 — `topic_kind='fixed'`, `status='unused'`

`bot_topics.board` = BOARDS 키 또는 `qna` / `resource:<type>`. `series_group`은 관리자 대주제에만 설정.

**`dubu_2` (18개)**
```
1.  "카드 결제 문자를 구글시트 가계부로 자동 입력하기"         board=automation-cases
2.  "매일 아침 날씨·일정·뉴스 요약을 카톡으로 받기"           board=automation-cases
3.  "노션 메모를 주간보고 초안으로 자동 변환"                  board=automation-cases
4.  "받은 메일 중요도 자동 분류·라벨링"                        board=automation-cases
5.  "관심 상품 최저가 추적해서 알림 받기"                      board=automation-cases
6.  "구독 유튜브 새 영상 자동 요약해서 받아보기"               board=automation-cases
7.  "1년간 만든 자동화 정리 — 제일 쓸모 있었던 것 베스트"     board=automation-cases
8.  "새로 나온 OO 자동화 툴 며칠 써본 솔직 후기"              board=automation-cases
9.  "n8n 처음 깔 때 헤매기 쉬운 3가지"                        board=automation-tips
10. "Make vs n8n, 뭐부터 시작할지 고르는 기준"                board=automation-tips
11. "웹훅(webhook) 1분 정리"                                   board=automation-tips
12. "무료 한도 안에서 자동화 굴리는 현실적 방법"              board=automation-tips
13. "무한루프 돌아서 크레딧 날린 썰 + 예방법"                 board=automation-tips
14. "API 키 안전하게 관리하는 습관"                            board=automation-tips
15. "입문자에게 추천하는 첫 자동화 프로젝트"                   board=automation-tips
16. "자동화 만들어 보니 차라리 손으로 하는 게 빠른 일도 있더라" board=talk
17. "퇴근하고 자동화 만지는 게 어느새 취미가 됨"              board=talk
18. "회사에 자동화 슬쩍 도입했다가 팀장이 신기해한 썰"        board=talk
```

**`semo_k` (18개)**
```
1.  "AI가 짜준 코드 그대로 쓰면 안 되는 이유"                 board=vibe-coding-tips
2.  "바이브코딩으로 만든 거 배포 전에 꼭 보는 체크 3개"       board=vibe-coding-tips
3.  "프롬프트로 디버깅 시킬 때 효율 올리는 법"                board=vibe-coding-tips
4.  "AI한테 컨텍스트 제대로 주는 법"                          board=vibe-coding-tips
5.  "코드 리뷰를 AI한테 시킬 때 한계와 쓸모"                  board=vibe-coding-tips
6.  "git 모르고 바이브코딩 하면 생기는 사고"                  board=vibe-coding-tips
7.  "이거 왜 안 되냐는 질문에 자주 나오는 진짜 원인들"        board=qna
8.  "환경변수 설정 안 해서 터지는 케이스 정리"                board=qna
9.  "CORS 에러 만났을 때 차분하게 푸는 순서"                  board=qna
10. "로컬은 되는데 배포하면 안 될 때 의심할 것"               board=qna
11. "AI가 만든 코드 에러를 AI한테 다시 물을 때 요령"          board=qna
12. "패키지 버전 충돌 푸는 현실적인 방법"                     board=qna
13. "자동화 시나리오 짤 때 에러 핸들링 빼먹지 말 것"          board=automation-tips
14. "자동화 디버깅: 어디서 멈췄는지 추적하는 법"              board=automation-tips
15. "토큰·크레딧 아끼는 자동화 설계"                          board=automation-tips
16. "재시도(retry) 로직 없이 자동화 돌리면 생기는 일"         board=automation-tips
17. "새 AI 코딩툴 OO 써본 시큰둥한 평가"                      board=vibe-coding-tips
18. "노코드면 개발 안 배워도 되나요에 대한 현실적인 답"       board=qna
```

**`wolse99` (18개)**
```
1.  "AI로 부수입 만든 첫 3개월 정산 솔직 공개"               board=monetization-cases
2.  "GPT로 블로그 글 써서 애드센스 돌린 결과"                board=monetization-cases
3.  "AI 썸네일 제작 외주로 첫 입금 받은 썰"                  board=monetization-cases
4.  "스마트스토어 상세페이지를 AI로 만든 후기"               board=monetization-cases
5.  "전자책 한 권 AI로 만들어 판 결과"                       board=monetization-cases
6.  "실패한 수익화 시도 3개 — 왜 안 됐나"                    board=monetization-cases
7.  "AI 자동화 대행 첫 클라이언트 받은 과정"                 board=monetization-cases
8.  "외주 견적 어떻게 잡는지"                                board=monetization-tips
9.  "클라이언트한테 AI 썼다고 말해야 하나"                   board=monetization-tips
10. "포트폴리오 없을 때 첫 일감 따는 법"                     board=monetization-tips
11. "수정 요청 무한루프 막는 계약 문구"                      board=monetization-tips
12. "단가 후려치는 의뢰 거르는 기준"                         board=monetization-tips
13. "결과물 납품할 때 빠뜨리면 안 되는 것"                   board=monetization-tips
14. "리뷰·평점 쌓는 현실적인 초반 전략"                     board=monetization-tips
15. "AI 자동화 세팅 해드립니다 (의뢰 모집 글)"               board=gigs
16. "블로그 자동화 봇 만들어 드립니다"                       board=gigs
17. "같이 부업 스터디 하실 분 모집"                          board=gigs
18. "외주 받아보실 분, 간단한 작업부터 매칭해요"             board=gigs
```

**`latte2x` (18개)**
```
1.  "AI로 인스타 콘텐츠 한 달치 미리 만든 워크플로"           board=automation-cases
2.  "블로그 글 주제 발굴부터 초안까지 자동화"                 board=automation-cases
3.  "경쟁사 콘텐츠 모니터링 자동화"                           board=automation-cases
4.  "뉴스레터 자동 작성·발송 세팅"                            board=automation-cases
5.  "광고 카피 A/B안 대량 생성하는 법"                        board=automation-cases
6.  "콘텐츠 마케팅 AI로 돌려서 나온 실제 전환율"             board=monetization-cases
7.  "1인 마케터가 AI로 대행사 일 받은 썰"                    board=monetization-cases
8.  "AI 콘텐츠로 SEO 트래픽 올린 결과"                       board=monetization-cases
9.  "브랜드 톤앤매너를 AI에 학습시키는 프롬프트 설계"         board=vibe-coding-tips
10. "마케터가 노코드로 랜딩페이지 만든 과정"                  board=vibe-coding-tips
11. "AI한테 우리 브랜드 보이스 유지시키는 법"                 board=vibe-coding-tips
12. "콘텐츠 캘린더를 AI로 자동 관리"                          board=vibe-coding-tips
13. "요즘 마케터들이 쓰는 AI 툴 스택 정리"                   board=automation-cases
14. "새로 나온 OO 툴, 마케팅에 써보니"                       board=automation-cases
15. "카피라이팅 잘 뽑는 프롬프트 모음"                       board=resource:prompt
16. "SNS 콘텐츠 기획용 프롬프트 템플릿"                      board=resource:prompt
17. "콘텐츠 마케팅 주간 운영 체크리스트"                     board=resource:template-checklist
18. "광고 성과 리포트 자동화 템플릿"                         board=resource:template-checklist
```

**`rainy03` (12개)**
```
1.  "오늘 미드저니로 뽑은 그림 자랑"                         board=ai-creation
2.  "같은 프롬프트인데 모델마다 이렇게 다르네요"              board=ai-creation
3.  "감성 일러스트 뽑을 때 쓰는 키워드 공유"                 board=ai-creation
4.  "AI로 만든 캐릭터에 이름 붙여봤어요"                     board=ai-creation
5.  "실패작 모음 — 이상하게 나온 것들"                        board=ai-creation
6.  "손그림이랑 AI 그림 섞어서 작업한 결과"                  board=ai-creation
7.  "AI 그림으로 굿즈 시안 만들어봤어요"                     board=ai-products
8.  "직접 만든 이모티콘 세트 공개"                           board=ai-products
9.  "AI 그림 기반 미니 포스터 제작기"                        board=ai-products
10. "그림 뽑다 보면 시간 순삭이에요"                         board=talk
11. "AI 그림 저작권 어떻게들 생각하세요"                     board=talk
12. "오늘 만든 거 보고 가세요"                               board=talk
```

**`감자세개` (12개)**
```
1.  "진짜 처음인데 뭐부터 해야 할까요"                       board=qna
2.  "인기글 따라 했는데 여기서 막혔어요"                     board=qna
3.  "이 에러 메시지 무슨 뜻인가요 (초보 질문)"               board=qna
4.  "무료로 연습할 수 있는 방법 있나요"                      board=qna
5.  "다들 어떤 툴로 시작하셨어요"                            board=qna
6.  "이거 제가 한 게 맞게 한 건지 봐주세요"                  board=qna
7.  "처음으로 자동화 하나 만들어봤어요 (서툴지만)"           board=automation-cases
8.  "가르쳐주신 대로 했더니 됐어요 후기"                     board=automation-cases
9.  "따라 만든 첫 결과물 공유합니다"                         board=automation-cases
10. "입문자인데 이 커뮤니티 분위기 좋네요"                   board=talk
11. "다들 하루에 얼마나 시간 쓰세요"                         board=talk
12. "작은 거 성공해서 너무 기뻐서 글 남겨요"                 board=talk
```

**`냉장고털이` (10개)**
```
1.  "이거 봤어요? 요즘 화제인 거 퍼옴"                       board=talk
2.  "오늘 축구/경기 어땠어요"                                board=talk
3.  "짤 하나 투척하고 갑니다"                                board=talk
4.  "다들 주말에 뭐 하세요"                                  board=talk
5.  "이번 주 제일 웃겼던 거"                                 board=talk
6.  "AI 관련 웃긴 짤 모음"                                   board=talk
7.  "점심 뭐 먹을지 추천 좀"                                 board=talk
8.  "남들 만든 AI 그림 구경하는 재미"                        board=ai-creation
9.  "이 그림 분위기 미쳤다 (남 글에 반응형 글)"              board=ai-creation
10. "그냥 출석 겸 인사 남기고 가요"                          board=talk
```

**`AI작당지기` (11개 대주제 — `series_group` 설정)**
```
1.  "바이브코딩 입문 시리즈 (개념→첫 프로젝트→디버깅→배포)"  board=vibe-coding-guide  series_group=vibe-intro
2.  "Claude Code 제대로 쓰기 시리즈"                         board=vibe-coding-guide  series_group=claude-code-guide
3.  "프롬프트 잘 쓰는 법 가이드"                             board=vibe-coding-guide  series_group=prompt-guide
4.  "n8n 자동화 완전정복 시리즈"                             board=automation-guide   series_group=n8n-mastery
5.  "Make로 시작하는 노코드 자동화"                          board=automation-guide   series_group=make-nocode
6.  "업무 시간 줄이는 AI 자동화 실무 시리즈"                 board=automation-guide   series_group=ai-workflow-biz
7.  "자동화 트러블슈팅 모음 가이드"                          board=automation-guide   series_group=auto-troubleshoot
8.  "엄선 프롬프트 모음 큐레이션"                            board=resource:prompt    series_group=prompt-curation
9.  "MCP 개념과 활용 가이드"                                 board=resource:mcp       series_group=mcp-guide
10. "Rules·설정 베스트 프랙티스"                             board=resource:rules-config series_group=rules-best-practice
11. "바로 쓰는 템플릿·체크리스트 모음"                      board=resource:template-checklist series_group=template-collection
```

### Task 4: 기존 통계·랭킹 쿼리에 봇 제외 필터 추가 (AC: #4)

⚠️ Story 11.1에서 `users.isBot` 컬럼과 `bot_settings` 테이블이 추가되어야 이 Task를 진행할 수 있음.

- [ ] 4.1 **공통 헬퍼 생성**: `apps/api/src/services/bot/settings.ts`
  ```typescript
  // getBotExcludeFromRanking(db): bot_settings 테이블에서 'bot_exclude_from_ranking' 값 조회.
  // 실패 시 기본값 true(제외) 반환. bot_settings 테이블 미존재(11.1 미완) 시 false 반환(graceful).
  export async function getBotExcludeFromRanking(db: DbLike): Promise<boolean>
  ```

- [ ] 4.2 **`apps/api/src/routes/v1/gamification/gamification.service.ts`의 `getRanking()` 수정**
  - `ledgerRows` 쿼리: `bot_exclude_from_ranking=true`면 `points_ledger.userId`를 `users`와 INNER JOIN 후 `users.isBot = false` 조건 추가.
  - 구체적으로: 기존 `.from(schema.pointsLedger).where(...)` 에 `.leftJoin(schema.users, eq(schema.pointsLedger.userId, schema.users.id))` 추가 후 WHERE 절에 `AND (users.is_bot = false OR users.is_bot IS NULL)` 추가.
  - 함수 시작부에서 `const excludeBots = await getBotExcludeFromRanking(db)` 호출.
  - Redis 캐시 키에 봇 제외 여부 반영 불필요(설정 변경 시 기존 캐시 무효화 로직 미구현 → 단순하게 항상 제외가 기본이면 캐시 키 변경 없이 가능, 하지만 설정 변경 즉시 반영은 다음 캐시 TTL 만료 후 적용됨).

- [ ] 4.3 **`apps/api/src/routes/admin/dashboard/kpi.ts` 수정**
  - `usersTotal`, `usersTodayNew` 쿼리에 `bot_exclude_from_ranking=true` 시 `where(eq(schema.users.isBot, false))` 조건 추가.
  - 함수 시작부에서 `excludeBots` 플래그 조회.

- [ ] 4.4 **`apps/api/src/routes/admin/analytics/overview.ts` 수정**
  - `usersRows` 쿼리(날짜별 신규 가입자)에 `excludeBots=true` 시 `isBot=false` 조건 추가.

- [ ] 4.5 **`apps/api/src/routes/admin/members/service.ts` 수정**
  - `listUserMembers()` 쿼리에 `excludeBots` 파라미터 추가(기본 `false` — 관리자 목록에선 봇도 표시).
  - 단, 관리자 회원 목록에서 기본적으로 봇 계정이 같이 노출되면 혼란스러우므로 `listUserMembers`에 `excludeBots=true` 기본값 적용 여부는 PM 판단 사항으로 Dev Notes에 기록. **일단 기본값은 `false`(봇 표시 포함)로 구현하되** `isBot` 필드를 응답에 추가해 UI에서 식별 가능하게 한다.

### Task 5: `packages/database/src/schema/index.ts` 확인 및 배럴 export (AC: #1)
- [ ] 5.1 Story 11.1이 `schema/bot.ts`를 생성하고 `schema/index.ts`에 `export * from './bot'`를 추가했는지 확인. 미완이면 seed 스크립트에서 직접 schema import 불가.
- [ ] 5.2 `scripts/seed-bots.ts` 스크립트 실행 명령 `package.json` 또는 루트 `package.json`에 추가.
  ```
  "db:seed-bots": "tsx scripts/seed-bots.ts"
  ```

### Task 6: 검증
- [ ] 6.1 `pnpm db:seed-bots` 실행 — 에러 없이 완료되는지 확인.
- [ ] 6.2 재실행 시 중복 삽입 없음 확인 (멱등 검증).
- [ ] 6.3 DB 직접 쿼리로 8인 users(is_bot=true) 확인, bot_personas 8행, bot_topics 117행 이상 확인.
- [ ] 6.4 `bot_settings` 8개 키 확인.
- [ ] 6.5 랭킹 API (`GET /api/v1/gamification/ranking?period=weekly`) 호출 시 봇 닉네임(`dubu_2` 등)이 응답에 포함되지 않음 확인 (봇은 포인트가 없으므로 자연스럽게 미포함이지만, 나중에 봇이 포인트를 적립하더라도 랭킹에서 제외되어야 함).
- [ ] 6.6 TypeScript 컴파일 에러 없음 (`pnpm -F @ai-jakdang/api typecheck`).

---

## Dev Notes

### 선행 의존성 (반드시 Story 11.1 완료 후 착수)

Story 11.5는 Story 11.1이 생성하는 아래 항목에 의존한다:
- `users.is_bot` 컬럼 — `packages/database/src/schema/auth.ts` ALTER (Story 11.1 AC #2)
- `bot_personas`, `bot_persona_boards`, `bot_activity_rhythm`, `bot_topics`, `bot_settings` 테이블 — `packages/database/src/schema/bot.ts` (Story 11.1 AC #1)
- 마이그레이션 실행 완료 (`db:migrate` 성공)

Story 11.1이 완료되지 않은 상태에서 이 스크립트를 실행하면 테이블 미존재 에러 발생.

### `ensureBotUser` 범위 구분

이 스토리의 `ensureBotUser`는 **시드 전용** 구현이다. `scripts/seed-bots.ts` 안에 인라인으로 구현하며, `users` 테이블에 직접 INSERT한다(시드 = 통제된 직접 생성 허용, ARCHITECTURE §3 예외). 

**런타임용** `ensureBotUser` (Story 11.4 이후 생성 파이프라인이 사용하는 것)는 `apps/api/src/services/bot/user.ts`에 별도 구현한다. 이 스토리에서는 해당 파일의 함수 시그니처만 정의하면 됨(선택).

### 시드 스크립트 실행 환경

기존 시드 패턴(`packages/database/src/seeds/super-admin.ts`)은 `@ai-jakdang/database` 패키지 내부에 위치하지만, `scripts/seed-bots.ts`는 프로젝트 루트 `scripts/` 폴더에 위치한다. `tsx`로 실행 시 `@ai-jakdang/database`, `@ai-jakdang/config` 워크스페이스 패키지를 import할 수 있어야 한다. `DATABASE_URL` env가 주입되어야 하며 루트 `.env` 기준으로 실행.

대안: 일관성을 위해 `packages/database/src/seeds/bots.ts`에 시드 로직을 두고 `scripts/seed-bots.ts`를 얇은 래퍼로 구성할 수도 있음.

### BOARDS 키 정합성 경고

`bot_persona_boards.board` 및 `bot_topics.board`에 넣는 값은 `packages/contracts/src/board.ts`의 BOARDS 상수 키와 반드시 일치해야 한다. 현재 총 11개 키: `vibe-coding-guide`, `vibe-coding-tips`, `automation-guide`, `automation-cases`, `automation-tips`, `monetization-tips`, `monetization-cases`, `ai-creation`, `ai-products`, `talk`, `gigs`, `notice`.

⚠️ 특수 값:
- `qna`: BOARDS에 없음. Story 11.1 스키마 설계 시 `bot_persona_boards.board` 컬럼을 varchar(무제약) 또는 BOARDS 키 + `qna` + `resource` 허용 체크로 정의해야 함.
- `resource:<type>`: `resource:prompt`, `resource:mcp`, `resource:rules-config`, `resource:template-checklist`. `bot_topics.board`에 이 형식으로 저장하고 생성 파이프라인이 파싱.
- `notice`: `isSystemBoard=true` — 봇 작성 불가. 시드에 포함하지 않음.

### "외주·판매 팁" 불일치 처리

설계 문서의 "외주·판매 팁"은 BOARDS에 키가 없다. 현재 `monetization-tips`("수익화 팁")를 사용하되, 향후 BOARDS에 `freelance-tips` 같은 키가 추가되면 마이그레이션 필요. 시드에 코드 주석으로 명시.

### `bot_exclude_from_ranking` 구현 세부

- `bot_settings` 테이블(Story 11.1 정의): `site_settings`와 동일한 key-value JSONB 구조. `key='bot_exclude_from_ranking'`, `value=true/false`.
- 헬퍼 함수:
  ```typescript
  // apps/api/src/services/bot/settings.ts
  import { eq } from "drizzle-orm";
  import { schema } from "@ai-jakdang/database";
  
  export async function getBotExcludeFromRanking(db: DbLike): Promise<boolean> {
    try {
      const [row] = await db
        .select({ value: schema.botSettings.value })
        .from(schema.botSettings)
        .where(eq(schema.botSettings.key, 'bot_exclude_from_ranking'))
        .limit(1);
      return row?.value === true || row?.value === "true" || row === undefined;
    } catch {
      return true; // 테이블 미존재 시 기본 제외
    }
  }
  ```
- **성능**: 랭킹 API는 Redis 캐시(TTL 3600s)를 사용하므로 `getBotExcludeFromRanking` 호출은 캐시 miss 시에만 발생. KPI·통계 API는 매 요청마다 호출 → 필요 시 Redis에 설정값을 짧은 TTL(예: 60s)로 캐싱 권장(이 스토리 범위 외).

### 랭킹 쿼리 수정 포인트 (`gamification.service.ts`)

기존 `ledgerRows` 쿼리는 `points_ledger` 단독 집계다. 봇 제외 시 JOIN이 필요하다:

```typescript
// 기존 (수정 전)
const ledgerRows = await db
  .select({ userId: schema.pointsLedger.userId, delta: ... })
  .from(schema.pointsLedger)
  .where(sql`... AND delta > 0`)
  .groupBy(schema.pointsLedger.userId);

// 수정 후 (excludeBots=true 시)
const ledgerRows = await db
  .select({ userId: schema.pointsLedger.userId, delta: ... })
  .from(schema.pointsLedger)
  .innerJoin(schema.users, eq(schema.pointsLedger.userId, schema.users.id))
  .where(
    sql`... AND delta > 0 AND ${schema.users.isBot} = false`
  )
  .groupBy(schema.pointsLedger.userId);
```

excludeBots=false 시에는 기존 쿼리 유지(회귀 없음).

### 관리자 회원 목록 (`members/service.ts`)

`listUserMembers`에서 봇 계정을 기본 포함한다(admin 대시보드에서 봇을 관리하기 위해). 단, 응답에 `isBot: boolean` 필드를 추가해 프런트엔드가 시각적으로 구별할 수 있게 한다.

### 관리자 달성 페르소나 특이사항

`AI작당지기`:
- `is_admin_persona = true` → 글 생성 파이프라인(11.9)에서 장문 모드 활성화.
- `posts_per_week = 5`, `comments_per_week = 0` (설계 문서: "댓글 안 닮").
- 담당: `vibe-coding-guide`, `automation-guide`, `resource` (실전자료 4종).
- 공지사항(`notice`) 작성 금지 — 시드에 미포함.
- 실전자료 주제의 `board` 값은 `resource:<type>` 형식. `bot_persona_boards`엔 `resource`를 단일 항목으로 등록.

### 주제풀 총 수량

| 닉네임 | 주제 수 |
|---|---|
| `dubu_2` | 18 |
| `semo_k` | 18 |
| `wolse99` | 18 |
| `latte2x` | 18 |
| `rainy03` | 12 |
| `감자세개` | 12 |
| `냉장고털이` | 10 |
| `AI작당지기` | 11 |
| **합계** | **117** |

### Project Structure Notes

**수정 대상 파일 (기존 파일 수정)**:
```
apps/api/src/routes/v1/gamification/gamification.service.ts   (getRanking 봇 제외)
apps/api/src/routes/admin/dashboard/kpi.ts                   (totalUsers/todayNewUsers 봇 제외)
apps/api/src/routes/admin/analytics/overview.ts              (newUsers 봇 제외)
apps/api/src/routes/admin/members/service.ts                 (isBot 필드 추가)
packages/database/src/schema/index.ts                        (bot.ts export 확인 — 11.1 담당)
```

**신규 파일 (이 스토리 생성)**:
```
scripts/seed-bots.ts                              (메인 시드 스크립트)
apps/api/src/services/bot/settings.ts             (getBotExcludeFromRanking 헬퍼)
```

**이 스토리가 건드리지 않는 파일**:
- `packages/database/src/schema/bot.ts` — Story 11.1 담당
- server-only bot write boundary — Story 11.4 담당 (API 원형은 `apps/api/src/services/bot/write.ts`, worker 직접 import 금지)
- `apps/api/src/services/bot/user.ts` — Story 11.4 또는 이후 스토리 담당

---

### References

- 페르소나 전체 (닉네임·숨은 정체성·말투·활동 리듬): [Source: docs/seeding-bot-design.md#3-캐릭터-라인업-확정], [Source: docs/seeding-bot-design.md#11-활동-리듬-확정]
- 주제풀 전체: [Source: docs/seeding-bot-topic-pools.md]
- `bot_settings` 키 목록 및 의미: [Source: docs/seeding-bot/ARCHITECTURE.md#2.10-bot_settings]
- `ensureBotUser` 함수 위치 및 역할: [Source: docs/seeding-bot/ARCHITECTURE.md#3-공용-도메인-서비스-봇-작성-경로]
- BOARDS 상수 키 전체 목록 (11개): [Source: packages/contracts/src/board.ts]
- 실전자료 type enum (`prompt`, `mcp`, `rules-config`, `template-checklist`): [Source: packages/database/src/schema/resources.ts#resourceType]
- 기존 시드 패턴 (멱등, `onConflictDoNothing`): [Source: packages/database/src/seeds/gamification.ts], [Source: packages/database/src/seeds/super-admin.ts]
- `getRanking()` 기존 구현 (수정 전): [Source: apps/api/src/routes/v1/gamification/gamification.service.ts#getRanking]
- KPI 쿼리 (수정 전): [Source: apps/api/src/routes/admin/dashboard/kpi.ts]
- 통계 개요 쿼리 (수정 전): [Source: apps/api/src/routes/admin/analytics/overview.ts]
- 회원 목록 쿼리 (수정 전): [Source: apps/api/src/routes/admin/members/service.ts#listUserMembers]
- `bot_persona_boards.board` 컬럼 설명: [Source: docs/seeding-bot/ARCHITECTURE.md#2.3-bot_persona_boards]
- Story 11.1 선행 의존: [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.1]
- Story 11.5 AC 전체: [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.5]

---

## Dev Agent Record

### Agent Model Used

_미입력 (dev 착수 시 기입)_

### Debug Log References

_착수 후 기입_

### Completion Notes List

_착수 후 기입_

### File List

```
scripts/seed-bots.ts                                              (신규)
apps/api/src/services/bot/settings.ts                            (신규)
apps/api/src/routes/v1/gamification/gamification.service.ts      (수정)
apps/api/src/routes/admin/dashboard/kpi.ts                       (수정)
apps/api/src/routes/admin/analytics/overview.ts                  (수정)
apps/api/src/routes/admin/members/service.ts                     (수정)
```
