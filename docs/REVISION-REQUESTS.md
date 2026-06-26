# 수정 요청 목록 (REVISION REQUESTS)

> 이 파일은 **사용자가 직접** 수정 요청 항목을 적는 문서입니다.
> 매 프롬프트마다 이 파일 내용이 Claude 컨텍스트에 자동 주입됩니다 (UserPromptSubmit 훅).
> 따라서 여기에 적어두면, 다음 대화에서 수정 요청을 할 때 Claude가 반드시 이 내용을 먼저 확인합니다.

---

## 이 문서의 운영 방식 (중요 — Claude는 매번 이 규칙대로 처리한다)

같은 항목을 여러 번 고쳤는데도 증상이 남는 일을 막기 위한 규칙이다.

### 체크박스 2종 (분리)
각 항목은 **두 개의 체크박스**를 가진다.
- `Claude` — Claude가 수정 + 자체 검증을 마쳤다는 표시 (Claude가 체크)
- `검수` — **사용자가 직접** 브라우저/실사용으로 확인하고 통과시켰다는 표시 (**사용자만 체크**)

`검수`가 체크되어야 비로소 진짜 완료다. `Claude`만 체크된 항목은 "고쳤다고 주장"한 상태일 뿐이다.

### 처리 흐름
1. 사용자가 `## 대기 중 (TODO)` 에 항목을 적는다.
2. Claude는 그 항목을 `## 수정 중 (IN PROGRESS)` 로 내리고 작업한다.
3. 수정 완료 시 Claude가 **시도 이력**(아래 형식)을 적고 `Claude` 박스를 체크 → `## 검수 대기 (사용자 확인 필요)` 로 이동.
4. 사용자가 검수:
   - **통과** → 사용자가 `검수` 박스 체크 → Claude가 `## 검수 통과 (CLOSED)` 로 이동.
   - **여전히 문제** → 사용자가  박스안에 아무것도 안적으면 Claude가 다시 `수정 중` 으로 올린다.

### 재수정 규칙 (핵심)
같은 항목을 2번째·3번째 다시 고칠 때, Claude는 **반드시 시도 이력에 적힌 앞선 접근 방식을 먼저 읽고, 그와 다른 방식으로 접근**한다.
- 예: 1차에서 "credentials 누락"으로 봤다면, 2차에서는 그 가설을 버리고 다른 경로(렌더 경로/이벤트 바인딩/캐시 등)를 의심한다.
- 같은 원인을 또 짚는 것은 금지. "이미 시도해서 실패한 방식"은 이력에 남아 있으므로 반복하지 않는다.

### 시도 이력 형식
```
- N차 (YYYY-MM-DD): [의심한 원인] → [한 수정] → [검증 방식과 결과]
```
검증 방식은 구체적으로: 단순 "tsc 통과/200 응답/완료"는 검증이 아니다. **실제 클릭·렌더·요청까지 확인**한 것만 검증으로 적는다.

---

## 대기 중 (TODO)

<!-- 사용자가 여기에 한 줄씩 추가. Claude가 읽고 '수정 중'으로 내림.
- [ ] [대상 위치/파일] - 무엇을 어떻게
-->
_(없음 — 6건은 아래 검수 대기 119~124로 이동)_

## 수정 중 (IN PROGRESS)

<!-- Claude가 작업 중인 항목. 완료하면 '검수 대기'로 이동. -->


## 보류 (HOLD)

_(없음)_

---

## 검수 대기 (사용자 확인 필요)

> Claude가 수정 + 자체 검증을 마쳤으나 **사용자 검수 전**인 항목.
> 사용자가 확인 후 통과면 `검수` 박스를 v로 체크해 주세요. 여전히 문제면 그대로 비워두세요.

_(없음 — 122·107·108·113 검수 통과로 이동)_

---

## 검수 통과 (CLOSED)

> 사용자가 `검수` 박스를 체크해 통과시킨 항목을 Claude가 여기로 옮긴다.

> 재수정 4건(122·107·108·113) — 2026-06-26 2차 배치, 검수 통과. 근본 원인 = **댓글 컴포넌트가 게시판별 7벌 복제**라 1차가 lounge 한 벌만 고쳤던 것.

### 122. 대댓글에 또 답글 — 같은 층위 + @멘션 표기
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `lounge/[slug]` 한 벌만 수정 → 미통과.
- 2차 (2026-06-26): `CommentItem.tsx`/`CommentForm.tsx`가 게시판별 7벌 복제임을 확인 → 수정된 lounge 한 쌍을 나머지 6벌에 복제(css import만 보정). 106(즉시표시)·116(아바타)도 전 게시판 반영. → ✅ grep + web typecheck + 빌드.

### 107. 실전자료 후기 빈 별(테두리만 있는 별) 삭제
- [x] `Claude`   [x] `검수`
- 3차 (2026-06-26): 조언이 지목한 `ResourceDetailClient`의 `<div data-slot="rating-input">`(별점 직접입력 `RatingInput`, 후기폼 StarPicker와 중복) 삭제 + `myRating`/`handleRatingChange`/`requireAuth`·`useGatingContext` 연쇄 제거. → ✅ web typecheck + 빌드.

### 108. 실전자료 후기작성 제목과 별점 picker를 같은 줄에 배치
- [x] `Claude`   [x] `검수`
- 3차 (2026-06-26): `ReviewForm`에 `title` prop → `.reviewFormHeader`(flex space-between)로 "후기작성" h2(좌)+StarPicker(우) 한 줄. 외부 h2 제거, aria id는 폼 안 h2로 유지. → ✅ web typecheck + 빌드.

### 113. 대댓글 작성 시 [취소]·[답글 등록] 버튼이 간격 없이 붙음
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-26): CSS 모듈도 게시판별 분리임을 확인 → `automation`·`monetize`·`vibe-coding` `.module.css`의 `.commentFormActions`에 `gap` + `.mention` 추가. → ✅ web typecheck + 빌드.

> 신규 10건(119·120·121·123·124 + 114~118) — 2026-06-26 검수 통과.

### 119. 메인 실전 인기글 — 라운지 외 탭 비노출 원인 + 탭당 3개
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 원인 = `posts.category`(글 대분류 컬럼) DB 전부 NULL → category 필터 0건. `popular.route.ts`에서 `BOARDS`(게시판 메타)로 category→board 슬러그 매핑해 board IN 필터로 변경, `page.tsx` 인기글 `.slice(0,3)`. → ✅ 캐시 flush 후 실측 vibe 2·자동화 3·수익화 3건.

### 120. 메인 작당 라운지 섹션 — 썸네일 + 게시판 표기 + 4개
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): popular 라우트·`contracts/home.ts`에 `thumbnailUrl` 추가, 라운지 카드에 썸네일 img(없으면 empty_thumbnail)+게시판 라벨 뱃지+`.slice(0,4)`. (기존 글은 thumbnail null이라 폴백, 신규 작성부터 본문 첫 이미지.)

### 121. 쪽지 상세 모달 닫기 버튼 → 테두리 있는 흰색 버튼
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `MessageDetailModal` 닫기 버튼 `variant="secondary"`(흰 배경 #fff + 테두리)로 교체.

### 123. 쪽지 상세 모달 삭제 버튼 → 휴지통 이동
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 삭제 버튼 → `POST /messages/:id/trash`(발신/수신 측 대칭 soft-delete, 영구삭제 아님), 낙관적 제거 + 중앙 토스트.

### 124. 쪽지함 휴지통 탭 + 선택 일괄 영구삭제 + 30일 자동삭제
- [x] `Claude`   [x] `검수`
- 스키마(메인): `messages` 4컬럼 추가(`trashed_by_*_at`·`purged_by_*`, 마이그 0021). 휴지통 탭·체크박스 일괄선택·`POST /messages/purge`·lazy 30일 자동 purge.

### 114. 쪽지함 프로필 이미지에 실제 사진이 안 나옴
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `getMessages`/`getConversations` SELECT에 `u.image`·`u.default_avatar_index` 추가, `avatar_url||image||기본아바타` 해석.

### 115. 작당 의뢰소에서 내가 쓴 글에는 [쪽지 보내기] 버튼이 안 떠야 함
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `GigDetailClient` 쪽지 버튼을 `{!isSelf && ...}`로 미렌더 + 누락된 `recipientId`/`recipientAvatarUrl` 주입.

### 116. 쪽지 보내기 모달에 프로필 이미지가 안 보임
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `MessageModal`에 `recipientAvatarUrl` prop·`AuthorName`에 `authorAvatarUrl` prop 추가, 아바타 아는 호출부 일괄 주입.

### 117. 푸터에 작당 라운지 하위 메뉴 추가
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `SiteFooter` "작당 라운지" 그룹 4개 링크로 확장(헤더와 동일).

### 118. 쪽지·알림 페이지 이동/새로고침 시 즉시 알림 모달
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `NotificationAlert`를 `layout.tsx`에 마운트, `usePathname` 변경 시 미읽음 count 비교해 증가 시 중앙 토스트.

> 신규 12건(100~112 + 게시글 첨부) — 2026-06-26 배치, 사용자 검수 통과.

### 100. 유저 계정 페이지 노출글 선택 박스 스크롤바 디자인(얇은 옅은 보라색)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `FeaturedPostsPanel.module.css`의 `.panelBody`(max-height 400·overflow-y auto)에 커스텀 스크롤바 추가 — WebKit(`::-webkit-scrollbar` 폭 6px·track 투명 둥금·thumb 옅은보라 `rgba(167,139,250,0.45)` 99px 라운드·hover 0.70) + Firefox(`scrollbar-width:thin; scrollbar-color: rgba(167,139,250,0.45) transparent`). primary가 인디고(#3030c0)라 보라가 아니므로 violet-400 계열로 "옅은 보라" 충족. → ✅ 코드 확인.

### 101. 유저 계정 페이지 노출글 저장 후 즉시 반영(새로고침 불필요)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `handleSave()`가 PATCH 성공 후 `setDirty(false)`만 하고 좌측 노출글 목록(서버 컴포넌트 렌더)은 미갱신이라 새로고침 필요였음. → `useRouter().router.refresh()`를 저장 성공 분기에 추가, page.tsx의 `fetchFeaturedPosts`는 이미 `cache:"no-store"`라 refresh만으로 최신 반영. → ✅ 코드 확인.

### 102. 헤더 계정 드롭다운에 "내 계정" 항목 추가
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `SiteHeader` UserMenu에 `내 계정`(아이콘 account-circle-line) → `/u/${encodeURIComponent(user.nickname)}`(본인 공개 프로필) 추가. 기존 마이페이지(user-line·/mypage)와 아이콘·경로 구분해 둘 다 유지. → ✅ 빌드 통과.

### 103. 메인 페이지 "AI 수익화 인기글" 섹션 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `app/page.tsx`의 `.popularBand`(monetization-title) 섹션 전체 + `fetchMonetizationPosts` import·`monetizationPosts` 변수·호출 제거(미사용 잔재 grep 0건). `lib/home.ts` 함수 본체·CSS는 유지. → ✅ web 빌드 성공.

### 104. 메인 페이지 "기여자 랭킹" 섹션 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `app/page.tsx`의 `#ranking` 섹션(내부 `RankingWidget`) 전체 + `RankingWidget` import 제거(파일 자체는 보존). → ✅ web 빌드 성공.

### 105. 쪽지함 메일박스형 전면 개편(받은/보낸 탭·단건 모달·답장·실사진·AuthorName)
- [x] `Claude`   [x] `검수`
- 증상(원인): 기존 `/messages`는 **채팅형**(대화 스레드 버블, `ThreadView`)으로 보낸/받은 구분 없음, 메시지마다 프로필·계정 메뉴 없음.
- 1차 (2026-06-26): **채팅 → 메일박스**로 재설계. **API**: `GET /api/v1/messages?box=received|sent` + `POST /api/v1/messages/:id/read`(기존 conversations 라우트 보존). **프론트**: `/messages` = 신규 `MessagesPage`(받은/보낸 탭) — 행 클릭 → `MessageDetailModal`(채팅 버블 없음), 받은 쪽지만 "답장하기" → `MessageModal` 연결, 모달 열 때 읽음 처리. → ✅ typecheck green + web 빌드.

### 106. 대댓글 작성 시 즉시 표시(새로고침 불필요)
- [x] `Claude`   [x] `검수`
- 증상(원인): reply 폼 `onSuccess`가 `router.refresh()`만 호출해 새 대댓글이 즉시 안 보임.
- 1차 (2026-06-26): 로컬 state 즉시 append 방식 — `CommentForm`이 POST 201 응답을 현재 유저 정보로 낙관적 `CreatedComment`로 구성→`onSuccess(created)`, `CommentItem`이 `localReplies`에 append+펼침, `router.refresh()` 제거. → ✅ typecheck green.

### 109. 푸터 메뉴 실제 페이지 링크 연결
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): footerGroups가 전부 `<a href="#">`(미동작)였음 → `{label, href}` + next/link `<Link>`로 통일. 실제 app/ 폴더 존재로 매핑 검증. → ✅ web 빌드. ⚠️ 이용약관(/terms)·개인정보처리방침(/privacy)은 페이지 미생성이라 해당 2개만 `href="#"` 유지(페이지 신설 시 연결).

### 110. 첨부파일 게시글 수정 시 첨부 편집 기능 추가
- [x] `Claude`   [x] `검수`
- 증상(원인): `PostEditForm`이 title/contentJson/tags만 PATCH — 기존 첨부 편집 불가.
- 1차 (2026-06-26): 수정 폼에 `existingAttachments`(삭제 버튼)+`newFiles`(드롭존, 10MB·5개) 추가. 새 파일은 `POST /posts/attachments` 업로드, 기존 첨부는 변환해 **유지목록 전체**를 PATCH `attachments`로 전송(전량 교체로 유실 방지). 계약 스키마 일치 확인. → ✅ typecheck green + web 빌드.

### 111. 게시판 상세 페이지 "관련 글" 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 4개 상세(vibe-coding·automation·monetize·lounge)에서 `<RelatedPosts>` JSX + import + 전용 `relatedData` fetch 제거. 컴포넌트 파일은 보존. → ✅ grep 잔재 0 + web 빌드.

### 112. txt 등 첨부 강제 다운로드(브라우저 인라인 열림 방지)
- [x] `Claude`   [x] `검수`
- 증상(원인): `<a href download>`는 .txt 인라인 렌더·크로스오리진 시 download 무시.
- 1차 (2026-06-26): API 다운로드 프록시 `GET /api/v1/posts/attachments/download?url=&name=` 신설 — `Content-Disposition: attachment` + `application/octet-stream`으로 스트리밍. SSRF 방지(허용 base·path traversal 차단), `/posts/:slug`보다 먼저 등록. `AttachmentList` href를 프록시로 교체. → ✅ typecheck green + 메인 직접 검수.

### 게시글 첨부파일 — 작성 시 첨부 → 상세 페이지에서 확인·다운로드
- [x] `Claude`   [x] `검수`
- 증상(원인): 게시글 첨부가 미구현(서버 업로드 없음·`post_attachments` 테이블 없음·`hasAttachment` 하드코딩 false).
- 1차 (2026-06-26): 풀스택 신규 구현(마이그 0020). **DB** `post_attachments` 테이블. **API** 공개버킷 업로드(`storage.uploadAttachment`)+`POST /api/v1/posts/attachments`(인증·10MB·5개), 허용 확장자는 관리자 설정 `file_allowed_extensions`로 검증, getPostBySlug `attachments[]`/`hasAttachment` 동적화. **프론트** `PostWriteForm` 실업로드, `AttachmentList` 실데이터, 상세 9곳 주입. → ✅ 전 패키지 typecheck green + 읽기경로 실측(테스트 첨부 GET 확인 후 정리).

> 신규 16건(84~99) — 2026-06-26 병렬 배치. 스키마/마이그(0019: posts.thumbnail_url·resources.thumbnail_url·users.featured_post_ids·comments.rating)은 메인 단일 소유 선처리, 기능은 파일 비충돌 7개 서브에이전트 병렬 + 메인 검수. 전 패키지 typecheck green + web 프로덕션 빌드 63페이지 성공(RSC 위반 0).

### 84. 최근 본 글 최대 5개
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `RecentViewedPanel`이 localStorage 항목 전체를 렌더 → `setItems(parsed.slice(0, 5))`로 5개 상한. → ✅ 코드 확인. (실제 누적 5개 초과 표시는 로그인·열람 이력 필요 → 사용자 검수)

### 85. 게시글 썸네일 자동 생성(본문 첫 이미지 크롭, 없으면 empty_thumbnail)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): posts·resources에 `thumbnail_url` 컬럼(0019). 신규 `extractFirstImageUrl(contentJson)`(Tiptap JSON 재귀→첫 image attrs.src)을 글/자료 생성·수정 시 계산해 저장. 카드에 썸네일 `<img src={thumbnailUrl ?? "/empty_thumbnail.png"}>` + CSS `object-fit:cover`로 크롭(네이티브 sharp 미설치 — CSS 크롭). `자료/empty_thumbnail.png`→`apps/web/public/`. → ✅ Playwright: /automation 카드 썸네일 3개 렌더, 기존 글(이미지 없음) empty_thumbnail 폴백. (기존 글은 thumbnail_url=null이라 폴백, 신규 작성부터 본문 첫 이미지 적용 — 사용자 검수)

### 86. 실전자료 정렬(최신순) 드롭다운 가로 폭 확대
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `.sortGroup`이 `width:fit-content`라 "다운로드" 라벨이 좁게 잘림 → `min-width:140px`(ResourceFilterClient.module.css·prompts.module.css). 디자인 시스템 Select 유지(네이티브 금지). → ✅ 코드 확인 (시각 폭은 사용자 검수)

### 87. 회원정보에서 약관동의 제거
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `/settings/membership`(AccountInfoForm)에서 "약관 동의(표시 전용)" 블록·termsAgreedAt 상태·`.termsAgreed` CSS 제거. 나머지 회원정보 필드 유지. → ✅ 빌드(membership 페이지 생성) 통과.

### 88. 유저 계정 페이지 회색선 아래 뱃지 항목 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `/u/[nickname]` 상단 구분선 아래 뱃지 행 JSX + `fetchUserBadges`·`UserBadgeItem`·`.badgeRow/.badgeList/...` CSS 제거. 등급 진행도 등 나머지 유지. → ✅ 빌드(/u/[nickname] 생성) 통과.

### 89. 유저 계정 페이지 노출글 선택 기능(우측 280px, 본인만)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `users.featured_post_ids`(jsonb, 0019). API `PATCH /users/me/featured-posts`(최대 5, 본인 글만 검증)·`GET /users/profile/:nickname/featured-posts`(공개). 프로필 우측 280px `FeaturedPostsPanel`(체크박스로 본인 글 선택→저장). **본인 조회 시에만 렌더**(서버에서 `/users/me` 쿠키 조회로 isOwner 산출, 타인은 패널 미전달·결과 글만 노출). → ✅ 빌드 통과. (본인/타인 가시성·저장 동작은 로그인 필요 → 사용자 검수)

### 90. 자기 자신 차단 클릭 시 안내
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `AuthorName` 차단 메뉴 onClick 최상단에 isSelf(닉네임 비교) 가드 추가 → 본인일 때 "자기 자신은 차단할 수 없습니다." 토스트 후 return(차단 API 미호출). 팔로우 자기차단(#51)과 동일 패턴. → ✅ 코드 확인. (클릭 토스트는 로그인 후 사용자 검수)

### 91. 에디터 글자 크기 48px까지
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `EditorToolbar` FONT_SIZES에 26·30·36·42·48px 추가(기존 12~22px 뒤에). 동일 렌더 map 사용. → ✅ 코드 확인(총 10옵션). (드롭다운 표시는 글쓰기 진입=로그인 필요 → 사용자 검수)

### 92. 쪽지 보내기 버튼 비활성화(글 작성해도 활성 안 됨)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 진짜 원인 = **테스트 유저 문제가 아니라 `authorId`(쪽지 수신자 id)가 AuthorName까지 안 흘러옴**. MessageModal `canSend = text>0 && !!recipientId`인데 카드·상세·댓글의 `<AuthorName>`가 authorId 없이 렌더 → recipientId="" → 버튼 항상 비활성. → ① `postCardSchema`에 `userId` 추가 + posts/service select, ② 목록 카드 전부 `authorId={post.userId}`, ③ **상세 본문/댓글/대댓글/후기/Q&A의 AuthorName ~36곳에 authorId 일괄 주입**(post.authorId·comment.authorId·reply.authorId·review.authorId·question.author.id·answer.author.id). → ✅ API `/api/v1/posts` 응답에 userId 채워짐 확인, typecheck green. (실제 쪽지 전송은 로그인 후 사용자 검수)

### 93. 다른 유저 팔로우 안 됨
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 진짜 원인 = 팔로우 버튼이 로컬 state만 토글(`setFollowing`)하고 **API를 호출하지 않음**. → `POST /api/v1/follows {followingId:authorId}`(팔로우)·`DELETE /api/v1/follows/:nickname`(언팔)로 실연동(credentials include, 성공/실패 토스트). authorId 부재 시 안내 토스트. #92의 authorId 주입으로 대상 id 확보. → ✅ follows 라우트 메서드/경로 확인 + typecheck green. (실제 팔로우는 로그인 후 사용자 검수)

### 94. 메인페이지 작당 라운지 글 클릭 404
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 원인 = 홈 카드가 `/lounge/${board}/${id}`(UUID)로 링크하나 실제 라우트는 `/{category}/{board}/{slug}`이고 popular API가 slug를 안 내려줌. → popular.route.ts select에 `slug` 추가, home contract에 slug 추가, page.tsx에 `getPostDetailHref(board,slug,category)`(BOARDS.urlPath 매핑) 도입해 전 홈 카드 href 교정. → ✅ Playwright: 홈 카드 href에 UUID 0건.

### 95. 메인페이지 실전 인기글 클릭 404
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): #94와 동일 작업으로 인기글/수익화 인기글 카드 href를 slug 기반으로 교정. 실전자료 인기글은 `/resources/{slug}` 사용(이미 정상). → ✅ Playwright: 홈 UUID href 0건.

### 96. --font-mono 삭제 → --font-sans 통일
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): typography.css의 `--font-mono` 정의 삭제, 사용처(Editor.module.css `pre code`/`code`, page.module.css `.questionItem span`) 전부 `var(--font-sans)`로 교체. → ✅ grep: font-mono 잔존 0, 빌드 통과.

### 97. 게시글 사이드바 작당랭킹 실데이터 + 클릭 프로필 메뉴
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 원인 = BoardSidebar가 하드코딩 rankings prop("워크플로마스터" 등)을 렌더. → 신규 `RankingPanel`(client)이 `GET /gamification/ranking?period=weekly&limit=10` 실데이터 fetch, 각 항목을 `<AuthorName name authorId gradeLevel>`로 렌더(팔로우/쪽지/계정바로가기 메뉴 + 등급뱃지). BoardSidebar가 prop 무시하고 RankingPanel 사용(게시판 페이지 미수정으로 충돌 회피). → ✅ Playwright: /automation 사이드바에 실유저(이성적인전사2968888·은빛달236) 렌더, 하드코딩명 0건.

### 98. 실전자료 상세 액션바(북마크/공유/신고 작동 + 좋아요 + 타 게시판 통일)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 기존 aria-disabled 플레이스홀더 → automation ReactionBar를 미러한 작동 ReactionBar(좋아요·북마크·공유 드롭다운·신고, 동일 아이콘/좌우정렬). reactions/bookmarks/reports 테이블이 이미 `targetType:"resource"` 지원 → 그대로 연동. → ✅ Playwright: 상세 액션바 버튼 4종 [좋아요 0·북마크 0·공유·신고] 확인.

### 99. 실전자료 후기 = 댓글 기능 + 별점(대댓글 별점 없음)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 새 테이블 불필요 — `comments`가 `targetType:"resource"` 지원, `comments.rating`(smallint) 컬럼만 추가(0019). API `GET/POST/DELETE /resources/:id/reviews`(최상위는 rating 1~5 필수·대댓글 null, 생성·삭제 시 같은 tx로 resources.avgRating/ratingCount 재계산). 프론트 ReviewForm(최상위만 별점 picker)+ReviewList(스레드, AuthorName 재사용). → ✅ Playwright: 상세에 별점 picker+후기 폼+목록 렌더 확인.

### 47. 실전자료 지원환경 드롭다운 스크롤 제거
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `Select`는 이미 디자인 시스템 커스텀 드롭다운이 맞고, `.menu`가 `max-height:280px`라 옵션 7개(292px)가 넘쳐 메뉴 내부 스크롤바가 생긴 게 원인 → `Select.module.css .menu` max-height 280→480px. → ✅ Playwright: 지원환경 클릭 시 메뉴 scrollable=false 확인.

### 48. 실전자료 검색 기능 실제 동작
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): API 서비스 레이어(list.service.ts)에 q 필터 누락 → `ilike(title)/ilike(summary)` 추가. → ✅ Playwright: `?q=테스트` 필터 확인.

### 49. 프로필 수정 / 회원정보 분리
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `/settings/profile`=프로필, 신규 `/settings/membership`=회원정보로 분리, settings 좌측 탭 nav 신설. → ✅ Playwright 확인.

### 50. 1:1문의 상세 목록 버튼 디자인 통일
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): InquiryThread 하단 목록 버튼을 automation `.listButton` 동일 토큰으로 교체.

### 51. 자기 자신 팔로우 차단 안내
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `AuthorName` 팔로우 버튼 isSelf(닉네임 비교) 가드 → 본인 클릭 시 토스트. → ✅ Playwright 확인.

### 52. 유저 프로필 "계정 바로가기" 크래시
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): Next 15 `cookies()` await 누락 → `const cookieStore = await cookies()`. → ✅ Playwright: `/u/…` 200.

### 77. 에디터 이미지 아이콘 → 바로 파일 선택·삽입
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 모달 제거, 바로 `<input type=file>` 열고 업로드 후 setImage 삽입. → ✅ Playwright 확인.

### 78. 에디터 글자 크기 select에서 제목/목차 제거
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): FONT_SIZES에서 제목 H2/소제목 H3 항목·heading 분기 제거 → 순수 크기만. → ✅ Playwright 확인.

### 79. 에디터 목차 삽입 아이콘 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): "목차 삽입" 버튼·handleInsertToc·중복 divider 제거. → ✅ Playwright 확인.

### 80. 상단 헤더 검색 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): SiteHeader SearchAutocomplete import·JSX 제거. → ✅ Playwright: 헤더 검색 input 0.

### 81. 실전자료 삭제 후 404
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 삭제 후 `/resources`(없음)→`typeToListUrl(resourceType)`로 push. → ✅ Playwright 확인.

### 82. 실전자료 삭제 후 즉시 반영 / 83. 등록 후 즉시 반영
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 4개 유형 목록 `force-dynamic`+fetch `no-store`. → ✅ Playwright: 등록·삭제 즉시 반영.

### A. 로그아웃 글 등록 안내 → "로그인 후 이용"
- [x] `Claude`   [x] `검수`
- 증상: 로그아웃 상태에서 글 등록 클릭 시 "관리자 승인" 류 안내가 떴다(주장).
- 시도 이력:
  - 1차 (2026-06-26): "관리자 승인" 문구를 web 전역 grep → **사용자向 웹에는 존재하지 않음**(admin 가입 화면에만 존재). 실제 글쓰기 진입 경로 추적 결과 ①섹션 페이지 글쓰기는 `<Link href=".../write">`로 이동 ②write 페이지가 인증 게이트 없이 공용 폼을 바로 렌더해 비로그인도 폼에 진입 후 제출 시점 401을 받는 구조였음. → 공용 글쓰기 폼들(PostWriteForm·ResourceWriteForm·RecruitForm·Q&A·gigs/resource Gate)에 `useAuth` 기반 렌더 게이트 추가(ready&&!user → "로그인 후 이용해 주세요" EmptyState + 로그인 버튼), 401 토스트 문구도 "로그인 후 이용해 주세요"로 통일, ResourceWriteGate의 `useMockAuth`(목업)→`useAuth`(실세션) 교체. → ✅ 검증: Playwright 로그아웃 상태로 `/automation/write` 진입 시 미들웨어가 `/login?redirectTo=...`로 즉시 리다이렉트되어 "관리자 승인" 문구 노출 0건 확인.

### B. 시스템 알림(토스트) 디자인 통일
- [x] `Claude`   [x] `검수`
- 증상: tone별 색/한줄형/제목+내용+버튼형 등 토스트 디자인이 제각각.
- 시도 이력:
  - 1차 (2026-06-26): Toast.tsx/Toast.module.css에서 tone별(success/warning/danger/info) 배경·테두리·아이콘색 분기 제거 → **모서리 둥근 흰 박스 1종**으로 통일. 레이아웃: 제목(좌측 정렬) + 내용(가운데 정렬, 선택) + "확인" 버튼(항상) + 우상단 X. toast() 시그니처(tone/title/description/duration) 하위호환 유지, 정중앙 오버레이 유지. → ✅ 검증: Playwright로 휴대폰 미입력 저장 시 뜬 토스트 스크린샷 확인 — 반투명 배경막 위 흰 박스, "휴대폰 번호를 입력해 주세요"(좌측), 파란 "확인" 버튼, 우상단 X.

### C. 실전자료 지원환경 필터 → 선택박스 + 검색창 + 난이도 삭제
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): ResourceFilterClient를 재작성 — 지원환경 칩/모바일 아코디언 → 디자인 시스템 `Select`(지원환경 전체+6옵션), 난이도 `Select`/difficultyOptions 및 4개 목록 페이지의 difficulty 파라미터 완전 제거, 좌측에 디자인 시스템 `SearchInput`(?q= 갱신) 추가. → ✅ 검증: Playwright로 `/resources/prompts` 렌더 — DOM에 select 2개(지원환경·정렬)+검색 input 2종 존재, "난이도" 텍스트 0건. 스크린샷으로 디자인 시스템 스타일(브라우저 기본 아님) 확인.

### D. 마이페이지 뱃지 탭 삭제
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): mypage/page.tsx의 TabKey/tabs에서 "badges" 제거, 뱃지 전용 상태(badgeList/badgeLoaded)·useEffect·렌더 블록 삭제. 등급 진행도용 gradeData fetch는 유지. → ✅ 검증: Playwright 로그인 세션으로 `/mypage` 렌더 — 본문에 "뱃지" 0건 확인.

### E. 계정 드롭다운 메뉴 재구성
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): SiteHeader UserMenu에서 "내가 쓴 글"·"북마크"(둘 다 /mypage) 제거, 회원정보(/settings/profile)·1:1문의(/inquiries)·포인트(/points) 추가. → ✅ 검증: Playwright로 헤더 계정 메뉴 DOM 추출 — [마이페이지→/mypage, 회원정보→/settings/profile, 1:1문의→/inquiries, 포인트→/points] 확인(북마크·내가쓴글 없음).

### F. 회원정보 페이지
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): users 테이블에 phone·gender(enum)·birth_date·marketing_agreed_at 컬럼 + 마이그레이션 0018 추가, contracts(publicUser/updateProfile)·API GET·PATCH /users/me 확장(메인 직접). /settings/profile(ProfileForm)에 회원정보 섹션 신설 — 이메일(읽기전용)·이름·휴대폰(필수)·성별(select)·생년월일(date)·마케팅 수신 동의(토글)·약관 동의(상태표시)·비밀번호 변경 버튼(→/settings/security, 현재 비밀번호 재확인). 기존 닉네임/아바타/소개/링크는 하단 유지. → ✅ 검증: Playwright 로그인 세션으로 `/settings/profile` 렌더 — 8개 필드 전부 표기, 휴대폰 빈 값 저장 시 검증 토스트 확인. contracts/api/database/web 타입체크 그린, DB 컬럼 4종 적용 확인.

### G. 포인트 페이지 (현재 포인트 + 적립 상세 + 등급 안내 탭)
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): API에 GET /gamification/me/points-history(페이지네이션, reasonLabel 한국어 변환)·GET /gamification/grades 추가(메인 직접). /points 신규 페이지 — 탭1 "내 포인트"(누적 포인트+RankBadge+다음등급 진행바+적립/회수 내역), 탭2 "등급 안내"(5등급 RankBadge+포인트 구간, 현재 등급 하이라이트). middleware PROTECTED_PATHS에 /points 추가. → ✅ 검증: Playwright 로그인 세션+ledger 4건 주입으로 `/points` 렌더 — 26P, 내역(게시글 작성+10/댓글 작성+1/실전자료 등록+20/답변 작성(회수)-5), 등급 안내 탭 5등급(새내기~마스터) 현재등급 하이라이트 스크린샷 확인.

### H. 1:1문의 게시판 + 관리자 CS 관리
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): 조사 결과 1:1문의는 web(/inquiries 목록·작성·상세 스레드)·API(사용자 GET/POST/상세 + 관리자 목록/상세/상태변경/답변)·admin(문의 관리 페이지+드로어, Operation 네비에 "문의 관리" ri-customer-service-2-line 노출)·DB(inquiries·inquiry_replies)·contracts까지 **이미 완전 구현**됨. 누락은 사용자 진입 동선뿐 → E에서 계정 메뉴에 "1:1문의→/inquiries" 추가로 연결. → ✅ 검증: 코드/네비 확인 + 계정 메뉴 링크 동작 확인.

### 0. 로그인이 또 안 됨 (API 전역 관리자 가드 회귀)
- [x] `Claude`   [x] `검수`
- 증상: 로그인이 반복적으로 안 됨. 서버 재시작으로도 안 고쳐짐.
- 시도 이력:
  - 1차 (2026-06-26): 서버 꼬임 의심해 전부 종료·재기동 → API는 떠 있으나 `/health`가 200이 아니라 **401 `ADMIN_UNAUTHORIZED`** 반환 발견. 원인: `adminGuardHook`(관리자 세션 검증 훅)이 `app.ts`에서 **루트 앱 전역 preHandler로 등록**돼 모든 경로(health·공개 API·유저 로그인 `/api/v1/auth/*`)를 401로 막음. 훅 docstring은 `/api/v1/admin/*` 한정 적용을 전제(9.1 커밋 3b25fd8에서 범위 제한 누락된 회귀). → `adminGuard.ts`에 "`/api/v1/admin/` 로 시작하지 않으면 가드 통과" 경로 가드 추가. → ✅ 검증: `/health` 200 복구, 유저 로그인 POST가 더 이상 ADMIN_UNAUTHORIZED 아닌 Better Auth `INVALID_EMAIL_OR_PASSWORD` 도달(=로그인 흐름 정상), 관리자 보호 경로(`/api/v1/admin/members`)는 여전히 401 가드 유지.

### 1. 댓글 등록 버튼 눌러도 반응 없음 (2회 수정)
- [x] `Claude`   [x] `검수`
- 증상: 댓글 입력 후 등록 버튼을 눌러도 아무 일도 안 일어남.
- 시도 이력:
  - 1차 (2026-06-24, 3차 배치): credentials 누락 의심 → CommentForm/CommentItem 7개 mutation fetch에 `credentials:"include"` 추가 + 등록 후 `router.refresh()` → **여전히 무반응**.
  - 2차 (2026-06-24, 4차 배치): 앞선 가설 폐기, 렌더/이벤트 경로 추적 → 진짜 원인은 **Button 컴포넌트 기본 `type="button"`** 이라 `<form>` onSubmit이 호출조차 안 됨. 등록 버튼 7개 전부 `type="submit"` 추가 + `GatingContext.requireAuth`가 세션 로드 전(ready=false) 막던 것 보정 → ✅ 로그인 후 입력→등록 클릭→즉시 노출(0→1) 브라우저 확인.

### 2. 빈 상태 "첫 글을 작성해 보세요" 글씨↔글쓰기 버튼 간격 40px (3회 수정)
- [x] `Claude`   [x] `검수`
- 증상: 빈 게시판 안내문구와 글쓰기 버튼 사이 여백이 좁음(40px 요청).
- 시도 이력:
  - 1차 (2026-06-24, 2차 배치): `EmptyState.module.css` `.desc` `margin-bottom` 16→40px → **반영 안 보임**.
  - 2차 (2026-06-24, 3차 배치): 코드상 이미 40px임 확인, dev 서버 재시작 권장 → **여전히 안 보임**.
  - 3차 (2026-06-24, 4차 배치): 덮어쓰기 의심 → `!important`로 강제 적용 → ✅ 계산값 `margin-bottom=40px` 브라우저 확인.

### 4. 글 작성·수정 후 화면에 즉시 반영 안 됨 (캐시) (2회 수정)
- [x] `Claude`   [x] `검수`
- 증상: 글 작성·수정 후 목록/상세에 새 내용이 안 보이고 새로고침해야 반영됨.
- 시도 이력:
  - 1차 (2026-06-24, 3차 배치): 게시판 목록 6개 + 공지 데이터 fetch `next:{revalidate:30/60}` → `cache:"no-store"` → 목록은 반영되나 **상세는 옛 글**.
  - 2차 (2026-06-24, 4차 배치): 상세 page.tsx 본문 fetch도 `revalidate` 캐시였음. 전 게시판 상세 8곳(lounge/automation/monetize/vibe-coding/notice/gigs/(content)/resources) + generateMetadata fetch를 `cache:"no-store"`로 변경 → 수정 즉시 반영.

### 6. 에디터 포커스 테두리 (2회 수정)
- [x] `Claude`   [x] `검수`
- 증상: 글쓰기 에디터 포커스 시 테두리가 어색함.
- 시도 이력:
  - 1차 (2026-06-24, 1차 배치): `Editor.module.css` `.editorContainer:focus-within` 포커스 링 제거.
  - 2차 (2026-06-24, 2차 배치): 답변 LightEditor와 동일하게 — 바깥 컨테이너에만 포커스 링(primary+ring), 안쪽 ProseMirror는 outline·box-shadow 제거.

### 8. AI 창작마당 창작 스펙 (4회 손댐)
- [x] `Claude`   [x] `검수`
- 증상: 창작 스펙 표시/위치/필드 과다.
- 시도 이력:
  - 1차 (2026-06-24, 3차 배치): 상세 우측 280px 배치, ≤1024px 1단·모바일은 댓글 위 (lounge/[slug] 2단 레이아웃).
  - 2차 (3차 배치): 글쓰기 위치 — PostWriteForm `afterAttachment` 슬롯, CreativeSpecFields를 파일첨부 밑 흰 박스로 이동.
  - 3차 (3차 배치): 필드 축소 — params·postProcess·costType 입력·표시 삭제(스키마는 optional 유지).
  - 4차 (4차 배치): "안 보임" 진짜 원인은 #4와 같은 revalidate 캐시. no-store로 해결 → ✅ 우측 280px 흰박스 표기 확인.

### 11. 글 작성/리스트 클릭 후 404 (slug)
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): 한글 slug 이중 인코딩 버그 → `encodeURIComponent(decodeURIComponent(slug))`로 정규화(전 게시판 17곳). 리스트 클릭 404도 동일 원인.

### 12. EmptyState "첫 글을 작성해 보세요" 가운데 정렬
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): EmptyState.module.css flex 중앙 정렬 추가.

### 13. Q&A 답변 즉시 표시
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): AnswerForm onSuccess로 생성된 답변을 AnswerSection state에 즉시 추가.

### 14. 시스템 알림(토스트) 반투명 배경막
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): Toast에 overlay(rgba 0.45) 추가, 배경 클릭 시 닫힘.

### 15. 필수 입력 누락 안내
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): 검증 실패 시 정확한 토스트 노출 + 서버 에러 메시지 우선 표시.

### 16. 대메뉴 클릭 시 첫 하위메뉴로 이동
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): `children[0]?.href` 사용(데스크톱·모바일·브레드크럼).

### 17. 게시글 상세 "작성자의 다른 글" 삭제
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 2차 배치): RelatedPosts.tsx에서 authorPosts 섹션 제거(관련 글만 노출).

### 18. 상세 footer 공유 버튼(목록↔수정 사이) 삭제
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 2차 배치): lounge/automation/monetize/vibe-coding/notice/(content) 6개 상세에서 ShareButton 제거(본문 반응바 공유는 유지).

### 19. 묻고답하기 수정·삭제 위치 통일
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 2차 배치): QuestionFooterOwnerActions 신설로 하단 footer 목록 옆으로 이동, 해결됨 배지는 상단 유지.

### 20. 헤더 쪽지 아이콘 빨간 배지 (실제 미읽음 연동)
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 3차 배치): 하드코딩 count={1} 제거, useUnreadMessages 훅 신설(대화목록 unreadCount 합산), 0이면 배지 없음.

### 21. 자기 게시물 좋아요 → 차단 알림
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 3차 배치): ReactionBar 7개 disabled 제거, 클릭 시 "내 글에는 좋아요를 누를 수 없습니다" 토스트.

### 22. 수정하기 BoardHero 크래시
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 3차 배치): BOARDS.category와 boardHeroes 키 불일치로 config.media undefined → heroConfig에 resolveHeroKey(카테고리→히어로키 매핑+lounge 폴백) 추가, BoardHero·수정/목록/상세에 적용.

### 23. 프로필 이미지 전역 표기
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 3차 배치): postCard/postDetail/댓글 contract에 authorAvatarUrl 추가, API가 avatarUrl||image||기본아바타 resolve. 게시글 목록/상세/댓글/Q&A/자료 카드 Avatar에 src 연결(목업 자료상세 4종·DM·tags는 추후).

### 24. 마이페이지 (3건)
- [x] `Claude`   [x] `검수`
- 시도 이력 (모두 2026-06-24, 3차 배치):
  - 내가 쓴 글: 빈 배열 하드코딩 제거, GET /api/v1/users/me/posts 신설(게시글+실전자료 합산 최신순) 실연동.
  - 내 자료 탭 삭제: 실전자료 글을 '내가 쓴 글'에 kind=resource로 통합 표기.
  - 북마크 항목 디자인: '내가 쓴 글'과 동일한 activityItem 마크업으로 통일.

### 3. 삭제 확인 모달 — 취소/삭제 색 구분 + hover 글자
- [x] `Claude`   [x] `검수`
- 사용자 조언 : 해당 요소에 영향을 미치는 다른 CSS가 없는지 찾아봐.
- 시도 이력:
  - 1~3차 (2026-06-24): DeleteConfirmModal 추출·색상 CSS·window.confirm 교체 → **여전히 증상**(사용자 재지적).
  - 4차 (2026-06-26): 메인이 실제 삭제 모달을 브라우저로 띄워 computed style 측정 — 취소·삭제 둘 다 분홍배경+빨강글씨 동일, 삭제 hover 시 흰배경+흰글씨(투명). 진짜 원인 = 게시판 상세 `.ownerActions button` CSS(배경 danger-soft·hover 흰배경)가 **portal 없이 그 안에 렌더되던 모달 버튼까지** 덮음(사용자 조언 적중). → `DeleteConfirmModal`을 `createPortal(document.body)`로 변경(한 곳 수정→전 게시판 일괄). → ✅ 재측정: 취소=흰배경/검은글씨, 삭제=빨강(217,54,62)/흰글씨, hover 진한빨강/흰글씨 유지 + 스크린샷 확인.

### 5. 자기 자신에게 쪽지 보내기 → 차단 알림
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1~2차 (2026-06-24): AuthorName isSelf(authorId 기준) + GigDetail 가드 → authorId 미전달 호출부에서 여전히 본인에게 모달.
  - 3차 (2026-06-26): 진짜 원인 = isSelf를 authorId로만 판정(대다수 호출부 미전달). → `AuthorName` isSelf를 **닉네임 비교**(user.nickname===name)로 보강(호출부 수정 없이 전역 적용) + "계정 바로가기" 고정 샘플(/u/작당탐험가)→실제 `/u/[name]` 수정. → ✅ Playwright: 본인 글 작성자명→쪽지 클릭 시 차단 토스트.

### 7. 에디터 기능 개선
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1~2차 (2026-06-24): 확장/버튼 정리 → ①활성 상태 즉시 미반영 ②리스트 마커 안 보임 잔존.
  - 3차 (2026-06-26): ①`useEditorState`로 툴바 isActive/폰트크기 구독→선택 즉시 활성 반영 ②전역 reset `ul,ol{list-style:none}`이 마커를 죽인 게 원인 → `.ProseMirror ul{list-style:disc} ol{decimal}` 명시. → ✅ Playwright: 불릿 클릭 시 ul list-style:disc·padding 24px·마커 표시, 굵게/불릿 버튼 즉시 active.

### 9. 실전자료 등록/상세 (구조 변경)
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1~3차 (2026-06-24): 단일폼·상세 경로·버튼 배치 → 자료유형 선택 제거(③) 미완·목록 404 잔존.
  - 4차 (2026-06-26): ①상세 북마크/공유/신고 세미볼드 제거+자료설명 밑 흰 박스(page.tsx로 이동) ②목록 버튼 href를 typeToListUrl로 교정 ③**유형 선택 카드 제거**→각 `/resources/{type}/write`가 고정 유형 주입(fixedResourceType), 목록 "자료 등록"이 유형별 write로. → ✅ Playwright: /resources/prompts/write에 유형카드 없음, 등록→상세 정상.

### 10. 최근 본 글 (실제 열람 이력)
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1~4차 (2026-06-24): 공용 사이드바·빈 상태 안내 → 여전히 안 나옴.
  - 5차 (2026-06-26): 진짜 원인 = "최근 본 글"이 실제 열람 이력이 아니라 각 게시판이 자기 목록 일부를 prop으로 넣던 가짜. → `RecentViewedTracker`(상세 진입 시 localStorage 기록)+`RecentViewedPanel`(읽어 렌더) 신설, BoardSidebar가 Panel 사용(전 게시판 동일), 15개 상세 페이지에 Tracker 추가. → ✅ Playwright: automation·vibe 글 열람 후 /monetize 사이드바에 두 글 모두 표시.
