"use client";

/**
 * 실전자료 수정 클라이언트 래퍼 — Story 4.8
 *
 * 4.4의 ResourceWriteForm을 편집 모드(resourceId + initialData)로 재사용한다.
 * 중복 폼 신규 작성 금지 원칙(Story 4.8 고유 제약)에 따른 구현.
 */

import type { JSONContent } from "@tiptap/react";
import {
  ResourceWriteForm,
  type ResourceWriteFormInitialData,
} from "../../new/ResourceWriteForm";

interface ResourceEditClientProps {
  resource: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    resourceType: string;
    environment: string[];
    difficulty: string;
    descriptionJson: Record<string, unknown>;
    usageJson: Record<string, unknown>;
    cautionJson: Record<string, unknown> | null;
    version: string | null;
    tagNames: string[];
  };
}

/** 유효한 resourceType 값인지 확인 */
type ValidResourceType =
  | "prompt"
  | "claude-code-skill"
  | "mcp"
  | "rules-config"
  | "template-checklist";

function toValidResourceType(rt: string): ValidResourceType {
  const valid: ValidResourceType[] = [
    "prompt",
    "claude-code-skill",
    "mcp",
    "rules-config",
    "template-checklist",
  ];
  return valid.includes(rt as ValidResourceType) ? (rt as ValidResourceType) : "prompt";
}

export function ResourceEditClient({ resource }: ResourceEditClientProps) {
  const initialData: ResourceWriteFormInitialData = {
    resourceType: toValidResourceType(resource.resourceType),
    title: resource.title,
    summary: resource.summary,
    environment: resource.environment,
    difficulty: (resource.difficulty as "beginner" | "intermediate" | "advanced") ?? "beginner",
    descriptionJson: resource.descriptionJson as JSONContent,
    usageJson: resource.usageJson as JSONContent,
    cautionJson: resource.cautionJson ? (resource.cautionJson as JSONContent) : null,
    tags: resource.tagNames,
  };

  return (
    <ResourceWriteForm
      resourceId={resource.id}
      initialData={initialData}
      returnSlug={resource.slug}
    />
  );
}
