/**
 * 실전자료 수정 페이지 — Story 4.8
 *
 * 서버 컴포넌트:
 * - 인증 + 소유권 확인 (쿠키 포워딩, API 호출)
 * - 기존 자료 데이터 사전 로딩 → ResourceWriteForm initialData로 prefill
 * - 비소유자·비회원 → 404
 *
 * 클라이언트 파트: ResourceWriteForm (4.4 폼을 편집 모드로 재사용, Story 4.8 제약)
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BoardHero } from "@/components/board";
import { ResourceEditClient } from "./ResourceEditClient";
import styles from "../../new/resource-new.module.css";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** 수정 페이지에서 필요한 자료 정보 */
interface ResourceEditData {
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
  userIsOwner: boolean;
  status: string;
}

async function fetchResourceForEdit(
  slug: string,
  cookie?: string,
): Promise<ResourceEditData | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/resources/${encodeURIComponent(slug)}`,
      {
        headers: cookie ? { cookie } : {},
        cache: "no-store", // 수정 페이지는 항상 최신 데이터 필요
      },
    );
    if (!res.ok) return null;
    return res.json() as Promise<ResourceEditData>;
  } catch {
    return null;
  }
}

export async function generateMetadata(_props: PageProps): Promise<Metadata> {
  return {
    title: `자료 수정 — AI작당`,
    robots: { index: false, follow: false }, // 수정 페이지는 검색 제외
    alternates: { canonical: undefined },
  };
}

export default async function ResourceEditPage({ params }: PageProps) {
  const { slug } = await params;

  // 쿠키 포워딩으로 userIsOwner 판단
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const resource = await fetchResourceForEdit(slug, cookie);

  // 자료 없음 or 소유자가 아닌 경우 404
  if (!resource || !resource.userIsOwner) {
    notFound();
  }

  // draft/hidden 자료도 소유자는 수정 가능
  if (resource.status === "deleted") {
    notFound();
  }

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="resources" currentSub="자료 수정" />
      <div className={styles.layout}>
        <ResourceEditClient resource={resource} />
      </div>
    </main>
  );
}
