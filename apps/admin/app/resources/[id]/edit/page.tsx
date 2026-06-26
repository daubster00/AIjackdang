import { ResourceForm } from "../../_components/ResourceForm";

export default async function ResourceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ResourceForm mode="edit" id={id} />;
}
