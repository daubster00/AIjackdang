import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 자료 상세 페이지(라우트 /resources/[id]). 요구 3: 목록의 자료명/상세보기 클릭 시
 * 드로어가 아니라 이 별도 페이지로 이동한다. 기존 resourceDetail 드로어의 내용을 옮긴 더미 1건이다.
 * 운영자는 신고·숨김·삭제 같은 사후 조치만 한다(검수·보증성 기능 없음).
 * 데이터는 전부 더미이며 이후 단계에서 API 와 연동한다.
 */

// 첨부파일 목록(더미). flagged(신고/부적절 의심 여부)면 삭제 버튼을 노출한다.
const FILES = [
  { icon: "ri-folder-zip-line", name: "outsourcing-prompts.pdf", meta: "2.4 MB · PDF · 대표 파일", flagged: false },
  { icon: "ri-file-text-line", name: "견적서-샘플.docx", meta: "180 KB · DOCX", flagged: false },
  { icon: "ri-image-line", name: "광고배너-외부링크.png", meta: "1.1 MB · PNG · 신고됨", flagged: true },
] as const;

// 후기 댓글 목록(더미). flagged(신고 여부)면 신고됨 배지를 노출한다.
const REVIEWS = [
  { author: ["서", "서기획"], rating: "5.0", date: "2026.06.13", body: "상담 단계 프롬프트가 특히 좋네요. 바로 적용했습니다.", flagged: false },
  { author: ["노", "노프리"], rating: "4.0", date: "2026.06.12", body: "PDF가 깔끔합니다. 다만 계약서 템플릿이 한국 기준이 아니라 조금 수정했어요.", flagged: false },
  { author: ["무", "무명123"], rating: "1.0", date: "2026.06.12", body: "외부 결제 링크 홍보 댓글 — 신고함", flagged: true },
] as const;

// 신고 내역(더미). 이 자료에 접수된 신고 기록.
const REPORTS = [
  { reason: ["badge-red", "저작권 침해"], reporter: "회원 #20481", date: "2026.06.12", note: "첨부 이미지에 타사 로고가 포함되어 있습니다." },
] as const;

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next 16 규약: params 는 Promise 이므로 await 로 푼다(id: 자료 식별자).
  const { id } = await params;

  return (
    <AdminShell breadcrumb={["관리자", "실전자료 관리", "자료 상세"]} activeKey="resources">
      <div className="page-header">
        <div>
          <h1 className="page-title">외주 견적 작성 프롬프트팩 (40종)</h1>
          <p className="page-description">프롬프트팩 · ChatGPT · 작성자 최대표 (자료 #{id})</p>
        </div>
        {/* page-actions: 수정 / 삭제(danger) / 목록으로 */}
        <div className="page-actions">
          <a className="btn btn-outline" href="/resources">
            <i className="ri-arrow-left-line" />
            목록으로
          </a>
          <a className="btn btn-outline" href={`/resources/${id}/edit`}>
            <i className="ri-edit-line" />
            자료 수정
          </a>
          <button className="btn btn-danger" type="button">
            <i className="ri-delete-bin-line" />
            자료 삭제
          </button>
        </div>
      </div>

      <section className="section">
        {/* 기본 정보 + 가격/포인트 */}
        <article className="card">
          <div className="card-body">
            <div className="detail-list">
              <div className="detail-row">
                <div className="detail-label">상태</div>
                <div className="detail-value"><span className="badge badge-green">공개</span></div>
              </div>
              <div className="detail-row">
                <div className="detail-label">자료 설명</div>
                <div className="detail-value">AI 자동화 외주 상담·견적·계약 단계별 프롬프트 모음입니다.</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">난이도 · 지원환경</div>
                <div className="detail-value">입문 · ChatGPT</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">가격 · 포인트</div>
                <div className="detail-value">9,900원 · 다운로드 시 100P 차감</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">성과</div>
                <div className="detail-value">다운로드 3,512 · 평점 4.9 · 후기 88 · 신고 1</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">등록 / 업데이트</div>
                <div className="detail-value">2026.06.12 / 2026.06.13</div>
              </div>
            </div>
          </div>
        </article>

        {/* 첨부파일 */}
        <div className="section-heading" style={{ margin: "24px 0 12px" }}>
          <div>
            <h2 className="section-title">첨부파일 ({FILES.length})</h2>
            <p className="section-description">신고된 첨부파일은 내용 확인 후 개별 삭제할 수 있습니다.</p>
          </div>
        </div>
        <article className="card">
          <div className="card-body">
            <div className="detail-list">
              {FILES.map((f) => (
                <div className="detail-row" key={f.name}>
                  <div className="detail-label">
                    <i className={f.icon} aria-hidden="true" /> {f.name}
                  </div>
                  <div className="detail-value" style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "space-between" }}>
                    <span className="content-meta">{f.meta}</span>
                    <span style={{ display: "flex", gap: "6px" }}>
                      <button className="btn btn-outline btn-sm" type="button">
                        <i className="ri-download-2-line" />
                        다운로드
                      </button>
                      {f.flagged ? (
                        <button className="btn btn-danger btn-sm" type="button">
                          <i className="ri-delete-bin-line" />
                          삭제
                        </button>
                      ) : null}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* 후기 댓글 */}
        <div className="section-heading" style={{ margin: "24px 0 12px" }}>
          <div>
            <h2 className="section-title">후기 댓글</h2>
            <p className="section-description">부적절한 후기는 숨김·삭제로 처리합니다.</p>
          </div>
        </div>
        <div className="component-stack">
          {REVIEWS.map((rv, i) => (
            <div className="card" key={i}>
              <div className="card-body">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div className="author">
                    <span className="author-avatar">{rv.author[0]}</span>
                    <span>{rv.author[1]}</span>
                    <span className="content-meta" style={{ marginLeft: "8px" }}>
                      <i className="ri-star-fill" style={{ color: "var(--warning)" }} aria-hidden="true" /> {rv.rating} · {rv.date}
                    </span>
                  </div>
                  {rv.flagged ? <span className="badge badge-red">신고됨</span> : null}
                </div>
                <p className="type-body" style={{ margin: "8px 0 0" }}>{rv.body}</p>
                <div className="button-showcase" style={{ marginTop: "10px" }}>
                  <button className="btn btn-outline btn-sm" type="button">
                    <i className="ri-eye-off-line" />
                    숨김
                  </button>
                  <button className="btn btn-danger btn-sm" type="button">
                    <i className="ri-delete-bin-line" />
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 신고 내역 */}
        <div className="section-heading" style={{ margin: "24px 0 12px" }}>
          <div>
            <h2 className="section-title">신고 내역 ({REPORTS.length})</h2>
            <p className="section-description">이 자료에 접수된 신고 기록입니다.</p>
          </div>
        </div>
        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>사유</th>
                  <th>신고자</th>
                  <th>접수일</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {REPORTS.map((rp, i) => (
                  <tr key={i}>
                    <td><span className={`badge ${rp.reason[0]}`}>{rp.reason[1]}</span></td>
                    <td>{rp.reporter}</td>
                    <td className="num">{rp.date}</td>
                    <td>{rp.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
