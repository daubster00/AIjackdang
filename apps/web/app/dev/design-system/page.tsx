"use client";

import { useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardActions,
  CardDesc,
  CardHead,
  CardMeta,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Divider,
  Drawer,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  EmptyState,
  Icon,
  IconButton,
  Inline,
  Input,
  Modal,
  Pagination,
  Popover,
  Radio,
  SearchInput,
  Select,
  Skeleton,
  Spinner,
  Switch,
  RankBadge,
  Tag,
  Textarea,
  Tooltip,
  useToast,
} from "@/components/ui";
import { RANK_LIST } from "@/lib/ranks";
import styles from "./design-system.module.css";

const COLOR_TOKENS = [
  { name: "--color-primary", value: "#3030c0" },
  { name: "--color-primary-soft", value: "#eef0ff" },
  { name: "--color-accent", value: "#18c7b8" },
  { name: "--color-bg", value: "#f7f8fc" },
  { name: "--color-text", value: "#171827" },
  { name: "--color-text-sub", value: "#5f6473" },
  { name: "--color-border", value: "#e4e7f0" },
  { name: "--color-success", value: "#148f73" },
  { name: "--color-warning", value: "#b7791f" },
  { name: "--color-danger", value: "#d9363e" },
  { name: "--color-info", value: "#2478d4" },
  { name: "--color-neutral", value: "#6b7280" },
];

const SPACING_TOKENS = ["1", "2", "3", "4", "5", "6", "8", "10", "12"];
const RADIUS_TOKENS = ["sm", "md", "lg", "xl", "pill"];

export default function DesignSystemPage() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectValue, setSelectValue] = useState("prompt");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>AI작당 디자인 시스템</h1>
        <p>사용자 사이트 전용 디자인 시스템 확인 페이지 — 토큰과 공통 UI 컴포넌트를 한곳에서 검증합니다.</p>
        <nav className={styles.toc} aria-label="섹션 이동">
          <a href="#colors">색상</a>
          <a href="#typography">타이포</a>
          <a href="#spacing">간격·라운드·그림자</a>
          <a href="#buttons">버튼</a>
          <a href="#inputs">입력</a>
          <a href="#selection">선택</a>
          <a href="#badges">배지·태그</a>
          <a href="#feedback">피드백</a>
          <a href="#layers">레이어</a>
          <a href="#cards">카드</a>
        </nav>
      </header>

      {/* 색상 */}
      <section id="colors" className={styles.block}>
        <h2>색상 토큰</h2>
        <p className={styles.desc}>사용자 사이트 전용 색상. 관리자 앱은 별도 토큰을 사용합니다.</p>
        <div className={styles.swatches}>
          {COLOR_TOKENS.map((token) => (
            <div key={token.name} className={styles.swatch}>
              <div className={styles.chip} style={{ background: `var(${token.name})` }} />
              <div className={styles.meta}>
                <div className={styles.name}>{token.name}</div>
                <div className={styles.value}>{token.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 타이포그래피 */}
      <section id="typography" className={styles.block}>
        <h2>타이포그래피</h2>
        <p className={styles.desc}>Pretendard. 제목 600~700, 본문 400.</p>
        <div className={styles.typeSample}>
          <span style={{ fontSize: "var(--font-size-4xl)", fontWeight: 700 }}>제목 4XL 36px</span>
          <span style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>제목 2XL 24px</span>
          <span style={{ fontSize: "var(--font-size-lg)", fontWeight: 600 }}>소제목 LG 18px</span>
          <span style={{ fontSize: "var(--font-size-base)" }}>본문 Base 15px — 한글 가독성을 우선합니다.</span>
          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-sub)" }}>
            보조 텍스트 SM 13px
          </span>
        </div>
      </section>

      {/* 간격·라운드·그림자 */}
      <section id="spacing" className={styles.block}>
        <h2>간격 · 라운드 · 그림자</h2>
        <p className={styles.subhead}>Spacing</p>
        {SPACING_TOKENS.map((token) => (
          <div key={token} className={styles.spaceRow}>
            <span className={styles.value} style={{ width: 90 }}>
              --space-{token}
            </span>
            <span className={styles.spaceBar} style={{ width: `var(--space-${token})` }} />
          </div>
        ))}
        <p className={styles.subhead}>Radius</p>
        <div className={styles.radiusRow}>
          {RADIUS_TOKENS.map((token) => (
            <div
              key={token}
              className={styles.radiusBox}
              style={{ borderRadius: `var(--radius-${token})` }}
            >
              {token}
            </div>
          ))}
        </div>
        <p className={styles.subhead}>Shadow</p>
        <div className={styles.shadowRow}>
          <div className={styles.shadowBox} style={{ boxShadow: "var(--shadow-panel)" }}>
            panel
          </div>
          <div className={styles.shadowBox} style={{ boxShadow: "var(--shadow-dropdown)" }}>
            dropdown
          </div>
        </div>
      </section>

      {/* 버튼 */}
      <section id="buttons" className={styles.block}>
        <h2>버튼</h2>
        <div className={styles.stateGrid}>
          <span className={styles.label} />
          <span className={styles.label}>Default</span>
          <span className={styles.label}>Disabled</span>
          <span className={styles.label}>Loading</span>
          <span className={styles.label}>아이콘</span>

          {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
            <DemoButtonRow key={variant} variant={variant} />
          ))}
        </div>
        <p className={styles.subhead}>크기 / 아이콘 버튼</p>
        <div className={styles.row}>
          <Button size="lg">Large</Button>
          <Button size="md">Medium</Button>
          <Button size="sm">Small</Button>
          <IconButton aria-label="북마크">
            <Icon name="bookmark-line" />
          </IconButton>
          <IconButton aria-label="더보기" size="sm">
            <Icon name="more-2-line" />
          </IconButton>
        </div>
      </section>

      {/* 입력 */}
      <section id="inputs" className={styles.block}>
        <h2>입력 요소</h2>
        <div className={styles.row} style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Input label="제목" required placeholder="제목을 입력하세요" helpText="최대 100자" />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Input label="이메일" leftIcon={<Icon name="mail-line" />} placeholder="name@example.com" />
          </div>
        </div>
        <div className={styles.row} style={{ alignItems: "flex-start", marginTop: 14 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Input label="오류 예시" error="이미 사용 중인 닉네임입니다" defaultValue="작당회원" />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Input label="성공 예시" success="사용 가능한 닉네임입니다" defaultValue="새작당" />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Textarea label="설명" maxLengthHint={1000} currentLength={0} placeholder="자료 설명" />
        </div>
        <p className={styles.subhead}>검색창</p>
        <SearchInput onSearch={(value) => toast({ title: "검색", description: value || "(빈 검색어)" })} />
      </section>

      {/* 선택 */}
      <section id="selection" className={styles.block}>
        <h2>선택 컴포넌트</h2>
        <div style={{ maxWidth: 320 }}>
          <Select
            label="자료 유형"
            value={selectValue}
            onChange={setSelectValue}
            options={[
              { value: "prompt", label: "프롬프트" },
              { value: "skill", label: "Claude Code Skill" },
              { value: "mcp", label: "MCP" },
              { value: "rules", label: "Rules·설정" },
              { value: "template", label: "템플릿·체크리스트" },
            ]}
          />
        </div>
        <p className={styles.subhead}>체크박스 / 라디오 / 스위치</p>
        <div className={styles.row}>
          <Checkbox defaultChecked>이용약관 동의</Checkbox>
          <Checkbox>선택 항목</Checkbox>
          <Radio name="demo-radio" defaultChecked>
            옵션 A
          </Radio>
          <Radio name="demo-radio">옵션 B</Radio>
          <Switch defaultChecked>알림 받기</Switch>
        </div>
      </section>

      {/* 배지·태그 */}
      <section id="badges" className={styles.block}>
        <h2>배지 · 태그 · 아바타</h2>
        <div className={styles.row}>
          <Badge tone="warning">
            <Icon name="time-line" />
            답변대기
          </Badge>
          <Badge tone="info">답변있음</Badge>
          <Badge tone="success">해결됨</Badge>
          <Badge tone="primary" variant="solid">
            <Icon name="star-fill" />
            추천
          </Badge>
          <Badge tone="neutral" variant="outline">
            임시저장
          </Badge>
        </div>
        <p className={styles.subhead}>등급 뱃지 (RankBadge)</p>
        <div className={styles.row}>
          {RANK_LIST.map((r) => (
            <RankBadge key={r.tier} rank={r.tier} size={32} showLabel />
          ))}
        </div>
        <p className={styles.subhead}>태그</p>
        <div className={styles.row}>
          <Tag href="#">ClaudeCode</Tag>
          <Tag href="#" filled>
            AI자동화
          </Tag>
          <Tag onRemove={() => toast({ title: "태그 삭제됨" })} removeLabel="PHP 태그 삭제">
            PHP
          </Tag>
          <Tag disabled>비활성</Tag>
        </div>
        <p className={styles.subhead}>아바타 / 구분선</p>
        <div className={styles.row}>
          <Avatar name="작당회원" size="lg" />
          <Avatar name="자동화러" size="md" />
          <Avatar name="새작당" size="sm" />
          <Divider orientation="vertical" />
          <span className="u-text-sub">세로 구분선</span>
        </div>
      </section>

      {/* 피드백 */}
      <section id="feedback" className={styles.block}>
        <h2>피드백 · 로딩</h2>
        <Inline gap="sm">
          <Button variant="secondary" onClick={() => toast({ tone: "success", title: "저장되었습니다" })}>
            성공 토스트
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ tone: "danger", title: "업로드 실패", description: "용량 초과" })}
          >
            오류 토스트
          </Button>
        </Inline>
        <p className={styles.subhead}>인라인 알림</p>
        <Alert tone="info" title="안내">
          댓글 작성과 자료 다운로드는 로그인 후 이용할 수 있습니다.
        </Alert>
        <p className={styles.subhead}>스피너 / 스켈레톤</p>
        <div className={styles.row}>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
        <div style={{ marginTop: 12, maxWidth: 320 }}>
          <Skeleton variant="title" />
          <div style={{ height: 8 }} />
          <Skeleton variant="line" />
          <div style={{ height: 8 }} />
          <Skeleton variant="short" />
        </div>
        <p className={styles.subhead}>빈 상태</p>
        <EmptyState
          icon="search-line"
          title="검색 결과가 없습니다"
          description="다른 키워드나 태그로 다시 검색해 보세요."
          actions={<Button variant="secondary">검색 초기화</Button>}
        />
        <p className={styles.subhead}>페이지네이션</p>
        <Pagination page={page} totalPages={12} onPageChange={setPage} />
      </section>

      {/* 레이어 */}
      <section id="layers" className={styles.block}>
        <h2>레이어 (모달 · 드롭다운 · 툴팁 · 팝오버 · 드로어)</h2>
        <Inline gap="sm">
          <Button onClick={() => setModalOpen(true)}>모달 열기</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            삭제 확인 다이얼로그
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            드로어 열기
          </Button>

          <Dropdown
            trigger={
              <Button variant="secondary">
                정렬 <Icon name="arrow-down-s-line" />
              </Button>
            }
          >
            <DropdownItem>
              <Icon name="time-line" />
              최신순
            </DropdownItem>
            <DropdownItem>
              <Icon name="fire-line" />
              인기순
            </DropdownItem>
            <DropdownDivider />
            <DropdownItem danger>
              <Icon name="delete-bin-line" />
              삭제
            </DropdownItem>
          </Dropdown>

          <Tooltip label="나중에 볼 글로 저장">
            <IconButton aria-label="북마크">
              <Icon name="bookmark-line" />
            </IconButton>
          </Tooltip>

          <Popover title="실전자료 신뢰도" trigger={<Button variant="ghost">신뢰도 정보</Button>}>
            다운로드 수, 후기, 신고 여부를 함께 보고 자료 품질을 판단합니다.
          </Popover>
        </Inline>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="로그인이 필요합니다"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                나중에
              </Button>
              <Button onClick={() => setModalOpen(false)}>로그인</Button>
            </>
          }
        >
          댓글 작성과 자료 다운로드는 로그인 후 이용할 수 있습니다.
        </Modal>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            toast({ tone: "success", title: "삭제되었습니다" });
          }}
          title="임시저장 글을 삭제할까요?"
          tone="danger"
          confirmLabel="삭제"
        >
          삭제한 임시저장 글은 다시 복구할 수 없습니다.
        </ConfirmDialog>

        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="필터">
          <p>모바일 필터·메뉴 등에 사용하는 측면 패널입니다.</p>
        </Drawer>
      </section>

      {/* 카드 */}
      <section id="cards" className={styles.block}>
        <h2>카드</h2>
        <div className="grid grid--cols-3">
          <Card variant="highlight" interactive>
            <CardHead>
              <CardTitle>Claude Code 작업 흐름 정리</CardTitle>
              <Badge tone="primary">추천</Badge>
            </CardHead>
            <CardDesc>기존 프로젝트를 분석하고 수정 요청을 안정적으로 전달하는 실전 가이드입니다.</CardDesc>
            <CardMeta>
              <Tag>ClaudeCode</Tag>
              <Tag>바이브코딩</Tag>
            </CardMeta>
            <CardActions>
              <Button variant="secondary" size="sm">
                보기
              </Button>
            </CardActions>
          </Card>

          <Card variant="resource" interactive selected>
            <CardHead>
              <CardTitle>n8n 문의 자동 분류</CardTitle>
              <Badge tone="success">실전자료</Badge>
            </CardHead>
            <CardDesc>고객 문의를 AI로 분류하고 담당자에게 자동 배정하는 흐름입니다.</CardDesc>
            <CardMeta>
              <Tag>n8n</Tag>
              <Tag>자동화</Tag>
            </CardMeta>
          </Card>

          <Card variant="question" disabled>
            <CardHead>
              <CardTitle>비활성 카드</CardTitle>
              <Badge tone="neutral">비활성</Badge>
            </CardHead>
            <CardDesc>권한이 없거나 준비 중인 콘텐츠의 비활성 상태입니다.</CardDesc>
          </Card>
        </div>
      </section>
    </main>
  );
}

function DemoButtonRow({ variant }: { variant: "primary" | "secondary" | "ghost" | "danger" }) {
  const label = { primary: "Primary", secondary: "Secondary", ghost: "Ghost", danger: "Danger" }[
    variant
  ];
  return (
    <>
      <span className={styles.label}>{label}</span>
      <Button variant={variant}>버튼</Button>
      <Button variant={variant} disabled>
        버튼
      </Button>
      <Button variant={variant} loading>
        처리 중
      </Button>
      <Button variant={variant} leftIcon={<Icon name="add-line" />}>
        추가
      </Button>
    </>
  );
}
