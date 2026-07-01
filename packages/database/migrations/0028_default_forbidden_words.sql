-- 수정요청(2026-06-30): 관리자 신고 설정의 금칙어를 기본 단어들로 채워서 설정 처리.
-- site_settings.forbidden_words(금칙어 목록, JSONB 배열)에 기본 한국어 비속어 목록을 시드한다.
-- 키가 없으면 INSERT, 키가 있더라도 값이 비어있을(NULL/[]) 때만 UPDATE 한다.
-- → 관리자가 이미 직접 채워둔 금칙어는 절대 덮어쓰지 않는다(멱등·비파괴).
INSERT INTO "site_settings" ("key", "value", "updated_at")
VALUES (
  'forbidden_words',
  '["씨발","시발","씨바","ㅅㅂ","개새끼","새끼","좆","좆같","병신","ㅂㅅ","지랄","ㅈㄹ","니미","엿먹어","꺼져","닥쳐","미친놈","미친년","걸레","창녀","호로","후레","개같","개년","개놈","쌍놈","쌍년","fuck","shit","bitch","asshole"]'::jsonb,
  NOW()
)
ON CONFLICT ("key") DO UPDATE
  SET "value" = EXCLUDED."value", "updated_at" = NOW()
  WHERE "site_settings"."value" IS NULL
     OR "site_settings"."value" = '[]'::jsonb
     OR jsonb_array_length("site_settings"."value") = 0;
