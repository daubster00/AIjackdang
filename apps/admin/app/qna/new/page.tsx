import { QnaForm } from "../_components/QnaForm";

/**
 * 새 질문 작성 페이지(라우트 /qna/new). 디자인 전용 — 공용 QnaForm 을 new 모드로 렌더한다.
 */
export default function QnaNewPage() {
  return <QnaForm mode="new" />;
}
