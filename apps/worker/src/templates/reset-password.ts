/**
 * 비밀번호 재설정 이메일 템플릿 (Story 1.6).
 *
 * variables:
 *   - resetUrl: 재설정 링크 URL (예: https://ai-jakdang.com/reset-password?token=...)
 *   - email:    수신자 이메일 주소
 */

export interface ResetPasswordVariables {
  resetUrl: string;
  email: string;
}

/**
 * 비밀번호 재설정 이메일 HTML 을 생성한다.
 * 실 SMTP 연동 시 이 함수의 반환값을 html 본문으로 사용한다.
 */
export function renderResetPasswordEmail(variables: ResetPasswordVariables): string {
  const { resetUrl, email } = variables;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>비밀번호 재설정 안내</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="480" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#3030C0;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">AI작당</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111;">비밀번호 재설정 안내</h1>
              <p style="margin:0 0 24px;color:#555;line-height:1.6;">
                안녕하세요.<br />
                <strong>${email}</strong> 계정의 비밀번호 재설정 요청이 접수됐습니다.<br />
                아래 버튼을 눌러 새 비밀번호를 설정해 주세요.
              </p>
              <p style="text-align:center;margin:0 0 24px;">
                <a href="${resetUrl}"
                   style="display:inline-block;padding:14px 32px;background:#3030C0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                  비밀번호 재설정
                </a>
              </p>
              <p style="margin:0 0 8px;color:#888;font-size:13px;line-height:1.6;">
                이 링크는 <strong>1시간</strong> 후 만료됩니다.<br />
                본인이 요청하지 않았다면 이 메일을 무시해 주세요.
              </p>
              <p style="margin:0;color:#aaa;font-size:12px;word-break:break-all;">
                링크가 열리지 않으면 아래 URL 을 복사해 브라우저에 붙여넣어 주세요.<br />
                <a href="${resetUrl}" style="color:#3030C0;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
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
