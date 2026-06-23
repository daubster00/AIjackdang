# PRD Quality Review — AI작당 PRD

제품 형태: 소비자형 커뮤니티(consumer/multi-stakeholder), **chain-top**(UX→아키텍처→스토리로 이어짐), **brownfield**(기존 코드는 구조 스캐폴딩만).

## Overall verdict
전략적 일관성과 범위 정직성이 강하다 — "검색 유입으로 성장하는 실전형 AI 커뮤니티"라는 명확한 thesis가 있고, Phase 1/2 경계와 [ASSUMPTION] 태그로 미확정을 정직하게 드러낸다. 가장 큰 리스크는 **done-ness(완료 기준)** — FR이 capability 레벨이라 수용 기준(AC)이 없어, 스토리 생성 단계에서 FR별 테스트 가능한 조건을 반드시 보강해야 한다. Glossary 부재가 downstream 추출을 약간 어렵게 한다.

## 1. Decision-readiness — adequate
주요 결정(게이미피케이션 철학, 전환 게이팅, Phase 경계)이 "고려사항"이 아니라 결정으로 명시됨. 트레이드오프도 솔직(다운로드 게이팅의 전환↑ vs 개방성↓, 게이미피케이션↔도움된 답변 충돌을 명시·해소). Open Question 16개는 실제로 열린 항목.
### Findings
- **medium** 성공 지표에 기준선/목표 수치 없음 (§2-2) — "검색 유입 세션 수"는 측정 항목일 뿐 목표가 없음. *Fix:* 런칭 3·6개월 목표치를 운영 시작 후라도 채울 것.

## 2. Substance over theater — strong
페르소나는 UJ에 인라인(지훈·수민·민지·현우·운영자)으로 녹아 의사결정을 끌어냄 — 페르소나 극장 없음. 차별점(실전형·다운로드형 자료실·태그 SEO 랜딩)은 Discovery에서 실제로 나온 것. NFR은 대부분 제품 특수적(SEO SSR, XSS, 파일 스캔).
### Findings
- 없음(furniture 수준 섹션 없음).

## 3. Strategic coherence — strong
thesis가 분명하고 기능이 그 arc(검색 유입 → 회원 전환 → 활동/기여 → 신뢰도)를 따른다. MVP 종류 = problem-solving + experience 혼합으로 일관. 카운터 지표도 명시됨.
### Findings
- **low** 게이미피케이션이 thesis(검색 유입)와 약하게 연결 — 유입의 대다수인 익명 검색자에겐 무효. PRD가 이를 "활동 자극(소수 기여자)"으로 정직하게 한정한 점은 양호.

## 4. Done-ness clarity — thin
**가장 약한 차원.** FR이 "무엇을"은 명확하나 "done"의 검증 조건이 없다. 예: FR-11.1 "고유 title 자동 생성" → 어떤 입력에서 어떤 title 규칙인지(AC) 미정. NFR-4 성능은 "충분히 빠를 것"(형용사) — Open Q-11로 정직하게 표시했으나 미해결.
### Findings
- **high** FR별 수용 기준(AC) 부재 — *Fix:* `bmad-create-epics-and-stories` 단계에서 FR마다 테스트 가능한 AC 작성. PRD 단계에선 허용되나 명시적 핸드오프 필요.
- **medium** SEO 자동 생성 "규칙"이 미정(FR-11.1~11.3, Open Q-4) — SEO가 #1 목표이므로 아키텍처 착수 전 규칙 정의 권장.

## 5. Scope honesty — strong
Phase 1/2 경계 명시, §5-3 가드레일(절대 피할 것), [ASSUMPTION] 태그 다수 + §10 가정 요약. 후순위 승격(대댓글·알림 등)도 사용자 결정으로 기록.
### Findings
- **low** open-items 밀도가 다소 높으나(Open Q 16개), 대부분 아키텍처/운영 레벨이라 PRD→아키텍처 핸드오프를 막지 않음. Phase-blocker 아님.

## 6. Downstream usability — adequate
FR/UJ ID 연속·고유. UJ마다 named protagonist 있음. 단 **Glossary 부재** — 도메인 명사(실전자료, 도움된 답변, 작당러, 공통 게시판 등)가 일관되게 쓰이나 정의 모음이 없어 추출 시 약간 불리.
### Findings
- **medium** Glossary 추가 권장 — *Fix:* 핵심 용어 정의 섹션 추가(폴리싱에서 반영).

## 7. Shape fit — strong
소비자형 커뮤니티에 맞게 UJ가 load-bearing. brownfield 참조(기존 코드=스캐폴딩, codex/Claude Code 분담)가 addendum에 정확. 과형식화/과소형식화 없음.

## Mechanical notes
- ID 연속성: FR-1~14 그룹, 결번 없음. UJ-1~5 OK.
- Assumptions 인덱스: §10이 요약하나 인라인 [ASSUMPTION] 전수 1:1 매핑은 느슨 — downstream 영향 적음.
- Glossary drift: 없음(용어 일관).
- 폴리싱 반영 예정: Glossary 추가, done-ness 핸드오프 노트.
