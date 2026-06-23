/**
 * 일회용 이메일 도메인 차단 (Story 1.3).
 *
 * 서버사이드 검증 전용. 클라이언트 우회 가능성 때문에 반드시 API에서 검증한다.
 */

const DISPOSABLE_DOMAINS: readonly string[] = [
  // 주요 일회용 이메일 서비스
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.info",
  "sharklasers.com",
  "spam4.me",
  "trashmail.com",
  "trashmail.at",
  "trashmail.io",
  "trashmail.me",
  "trashmail.net",
  "yopmail.com",
  "yopmail.fr",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minemail.com",
  "fakeinbox.com",
  "mailnull.com",
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "spambox.us",
  "spamfree24.org",
  "spamspot.com",
  "tempmail.com",
  "temp-mail.org",
  "tempmail.net",
  "throwam.com",
  "throwam.net",
  "throwam.org",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
  "mailnull.com",
  "mintemail.com",
  "mt2009.com",
  "mt2014.com",
  "nwldx.com",
  "sharklasers.com",
  "spam.la",
  "spamavert.com",
  "spambox.info",
  "spamfree24.de",
  "spamfree24.net",
  "tempinbox.com",
  "throwam.com",
  "trashmail.at",
  "uggsrock.com",
  "veryrealemail.com",
  "zippymail.info",
] as const;

/** 도메인 집합 (O(1) 검색) */
const DISPOSABLE_DOMAIN_SET = new Set<string>(DISPOSABLE_DOMAINS);

/**
 * 일회용 이메일 도메인 여부를 판별한다.
 * @param email 검사할 이메일 주소
 * @returns true면 차단 대상
 */
export function isDisposableEmail(email: string): boolean {
  const lower = email.toLowerCase().trim();
  const atIndex = lower.lastIndexOf("@");
  if (atIndex < 0) return false;

  const domain = lower.slice(atIndex + 1);
  return DISPOSABLE_DOMAIN_SET.has(domain);
}
