import { ResourceForm } from "../../_components/ResourceForm";

/**
 * 자료 수정 페이지(라우트 /resources/[id]/edit). 디자인 전용.
 * Next 16 규약상 params 는 Promise 이므로 await 로 푼다.
 * 더미 기본값(defaults: 수정 폼에 미리 채워질 값)을 공용 ResourceForm 에 넘긴다.
 */
export default async function ResourceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ResourceForm
      mode="edit"
      id={id}
      defaults={{
        title: "외주 견적 작성 프롬프트팩 (40종)",
        type: "promptpack",
        env: "chatgpt",
        level: "beginner",
        status: "public",
        desc: "AI 자동화 외주 상담·견적·계약 단계별 프롬프트 모음입니다.",
        price: "9900",
        points: "100",
      }}
    />
  );
}
