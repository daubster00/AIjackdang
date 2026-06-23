import { QnaForm } from "../../_components/QnaForm";

/**
 * 질문 수정 페이지(라우트 /qna/[id]/edit). 디자인 전용.
 * Next 16 규약상 params 는 Promise 이므로 await 로 푼다.
 * 더미 기본값(defaults: 수정 폼에 미리 채워질 값)을 공용 QnaForm 에 넘긴다.
 */
export default async function QnaEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <QnaForm
      mode="edit"
      id={id}
      defaults={{
        title: "n8n으로 Gmail 문의를 자동으로 분류·라벨링할 수 있나요?",
        category: "automation",
        status: "answered",
        body: "Gmail로 들어오는 외주 문의가 많아 라벨로 자동 분류하고 싶습니다. n8n 트리거 구성이 가능한지 궁금합니다.",
      }}
    />
  );
}
