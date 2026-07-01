import Link from "next/link";
import styles from "./SiteFooter.module.css";

/**
 * 사업자 정보 — 관리자 사이트 설정(사업자 정보 탭)에서 등록/수정한 값을
 * GET /api/v1/settings/public 로 서버사이드 fetch 해 푸터에 노출한다.
 * 값이 비어 있으면 해당 항목은 렌더하지 않는다(전부 비면 블록 자체 숨김).
 */
interface BusinessInfo {
  company_name?: string;
  representative_name?: string;
  business_registration_number?: string;
  mail_order_sales_number?: string;
  business_address?: string;
  business_phone?: string;
  business_email?: string;
}

async function getBusinessInfo(): Promise<BusinessInfo> {
  const apiBase = process.env.API_INTERNAL_URL ?? "http://localhost:4003";
  try {
    const res = await fetch(`${apiBase}/api/v1/settings/public`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    return (await res.json()) as BusinessInfo;
  } catch {
    return {};
  }
}

const footerGroups = [
  {
    title: "커뮤니티",
    links: [
      { label: "바이브 코딩", href: "/vibe-coding" },
      { label: "AI 자동화", href: "/automation" },
      { label: "AI 수익화", href: "/monetize" },
      { label: "묻고답하기", href: "/questions" },
    ],
  },
  {
    title: "자료실",
    links: [
      { label: "프롬프트", href: "/resources/prompts" },
      { label: "MCP·Skills", href: "/resources/mcp-skills" },
      { label: "Rules·설정", href: "/resources/rules" },
      { label: "템플릿·체크리스트", href: "/resources/templates" },
    ],
  },
  {
    title: "작당 라운지",
    links: [
      { label: "AI 창작마당", href: "/lounge" },
      { label: "내가 만든 AI 제품", href: "/lounge/products" },
      { label: "작당 수다방", href: "/lounge/talk" },
      { label: "작당 의뢰소", href: "/lounge/gigs" },
    ],
  },
];

export async function SiteFooter() {
  const biz = await getBusinessInfo();

  // 값이 있는 사업자 정보 항목만 라벨과 함께 수집
  const bizRows: { label: string; value: string }[] = [];
  if (biz.company_name) bizRows.push({ label: "상호", value: biz.company_name });
  if (biz.representative_name)
    bizRows.push({ label: "대표자", value: biz.representative_name });
  if (biz.business_registration_number)
    bizRows.push({ label: "사업자등록번호", value: biz.business_registration_number });
  if (biz.mail_order_sales_number)
    bizRows.push({ label: "통신판매업신고번호", value: biz.mail_order_sales_number });
  if (biz.business_address)
    bizRows.push({ label: "주소", value: biz.business_address });
  if (biz.business_phone)
    bizRows.push({ label: "전화", value: biz.business_phone });
  if (biz.business_email)
    bizRows.push({ label: "이메일", value: biz.business_email });

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <Link href="/" className={styles.brand}>
            <img src="/logo.svg" alt="" />
          </Link>
          <p>AI로 만들고, 자동화하고, 돈으로 연결하는 실전 커뮤니티</p>
        </div>

        <div className={styles.linkGroups}>
          {footerGroups.map((group) => (
            <div key={group.title} className={styles.group}>
              <strong>{group.title}</strong>
              {group.links.map((link) => (
                <Link key={link.label} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      {bizRows.length > 0 && (
        <div className={styles.business}>
          <dl className={styles.businessList}>
            {bizRows.map((row) => (
              <div key={row.label} className={styles.businessItem}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className={styles.bottom}>
        <span>© 2026 AI작당. All rights reserved.</span>
        <div>
          <Link href="/notice">공지사항</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/operation-policy">운영정책</Link>
        </div>
      </div>
    </footer>
  );
}
