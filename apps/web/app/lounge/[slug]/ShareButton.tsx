'use client';

import { useState } from "react";
import { Icon } from "@/components/ui";

interface ShareButtonProps {
  url: string;
}

export function ShareButton({ url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 접근 실패 시 무시
    }
  }

  return (
    <button type="button" onClick={handleShare} aria-label="URL 복사">
      <Icon name={copied ? "check-line" : "share-line"} />
      {copied ? "복사됨" : "공유"}
    </button>
  );
}
