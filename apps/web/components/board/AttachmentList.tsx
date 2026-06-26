import { Icon } from "@/components/ui";
import styles from "./AttachmentList.module.css";

export type AttachmentFile = {
  /** 파일명 (확장자 포함) */
  name: string;
  /** 표시용 파일 크기 문자열 (예: "2.4 MB") */
  size: string;
  /** 다운로드 URL. 비어 있으면 "#" 로 대체된다. */
  url?: string;
};

/** 확장자에 따라 적절한 파일 아이콘 이름을 고른다. */
function iconFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image-line";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "file-zip-line";
  if (["pdf"].includes(ext)) return "file-pdf-line";
  if (["doc", "docx", "txt", "md", "hwp"].includes(ext)) return "file-text-line";
  return "file-line";
}

export interface AttachmentListProps {
  /** 첨부파일 목록. 비어 있으면 아무것도 렌더하지 않는다. */
  files?: AttachmentFile[];
}

/**
 * 게시글 상세 페이지의 첨부파일 다운로드 영역 (공용).
 * 모든 게시판 읽기 상세 페이지에서 본문 하단에 동일한 모양으로 사용한다.
 * 서버 컴포넌트에서도 그대로 쓸 수 있도록 상태/이벤트 없이 다운로드 링크만 렌더한다.
 */
export function AttachmentList({ files = [] }: AttachmentListProps) {
  if (files.length === 0) return null;

  return (
    <section className={styles.wrap} aria-label="첨부파일">
      <div className={styles.head}>
        <Icon name="attachment-2" className={styles.headIcon} />
        첨부파일
        <span className={styles.count}>{files.length}</span>
      </div>
      <ul className={styles.list}>
        {files.map((file) => (
          <li key={file.name} className={styles.item}>
            <Icon name={iconFor(file.name)} className={styles.fileIcon} />
            <span className={styles.name}>{file.name}</span>
            <span className={styles.size}>{file.size}</span>
            <a
              className={styles.download}
              href={
                file.url
                  ? `/api/v1/posts/attachments/download?url=${encodeURIComponent(file.url)}&name=${encodeURIComponent(file.name)}`
                  : "#"
              }
              download={!!file.url}
              aria-label={`${file.name} 다운로드`}
            >
              <Icon name="download-2-line" />
              다운로드
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
