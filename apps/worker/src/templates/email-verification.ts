/**
 * 이메일 인증 템플릿 (Story 1.3).
 *
 * variables:
 *   - verificationUrl: 인증 링크 URL
 *   - userEmail:       수신자 이메일
 */

export interface EmailVerificationVariables {
  verificationUrl: string;
  userEmail: string;
}

/** 이메일 인증 HTML 본문을 생성한다. */
export function renderEmailVerification(variables: EmailVerificationVariables): string {
  const { verificationUrl, userEmail } = variables;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>이메일 인증</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="480" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#3030C0;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">AI작당</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111;">이메일 인증을 완료해 주세요</h1>
              <p style="margin:0 0 24px;color:#555;line-height:1.6;">
                안녕하세요.<br />
                <strong>${userEmail}</strong> 으로 AI작당 가입을 신청해 주셔서 감사합니다.<br />
                아래 버튼을 눌러 이메일 인증을 완료하면 모든 기능을 사용할 수 있어요.
              </p>
              <p style="text-align:center;margin:0 0 24px;">
                <a href="${verificationUrl}"
                   style="display:inline-block;padding:14px 32px;background:#3030C0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                  이메일 인증하기
                </a>
              </p>
              <p style="margin:0 0 8px;color:#888;font-size:13px;line-height:1.6;">
                이 링크는 <strong>24시간</strong> 후 만료됩니다.<br />
                본인이 가입하지 않았다면 이 메일을 무시해 주세요.
              </p>
              <p style="margin:0;color:#aaa;font-size:12px;word-break:break-all;">
                링크가 열리지 않으면 아래 URL 을 복사해 브라우저에 붙여넣어 주세요.<br />
                <a href="${verificationUrl}" style="color:#3030C0;">${verificationUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #eee;">
              <p style="margin:0;color:#aaa;font-size:12px;">
                © 2026 AI작당. 이 메일은 자동 발송됩니다. 회신하지 마세요.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
