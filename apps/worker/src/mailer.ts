/**
 * SMTP 메일 발송기 (nodemailer).
 *
 * env(SMTP_HOST/PORT/USER/PASSWORD/FROM)가 설정되면 실제 발송하고,
 * 미설정이면 콘솔 폴백으로 동작한다(개발 편의).
 *
 * Gmail 사용 시 SMTP_PASSWORD 는 일반 비밀번호가 아니라 Google "앱 비밀번호"(16자리)다.
 */

import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@ai-jakdang/config";

let transporter: Transporter | null = null;
let initialized = false;

/** SMTP 설정이 갖춰졌는지 여부 */
export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null;
  if (!initialized) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 465=SSL, 587/STARTTLS=false
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
    initialized = true;
  }
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * 메일을 발송한다. SMTP 미설정 시 false 를 반환(호출부가 콘솔 폴백 처리).
 * 발송 성공 시 true.
 */
export async function sendMail({ to, subject, html }: SendMailInput): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  const from = env.SMTP_FROM || env.SMTP_USER;
  await t.sendMail({ from, to, subject, html });
  console.info("[mailer] 메일 발송 완료 →", to);
  return true;
}
