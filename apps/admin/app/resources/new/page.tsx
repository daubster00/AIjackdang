import { ResourceForm } from "../_components/ResourceForm";

/**
 * 새 자료 등록 페이지(라우트 /resources/new). 디자인 전용 — 공용 ResourceForm 을 new 모드로 렌더한다.
 */
export default function ResourceNewPage() {
  return <ResourceForm mode="new" />;
}
