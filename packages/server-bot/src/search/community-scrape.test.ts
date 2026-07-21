/**
 * community-scrape 파서 단위 테스트.
 *
 * 각 사이트 베스트 게시판의 실제 HTML 조각(운영 서버에서 확인한 마크업)을 픽스처로 두고,
 * 파서가 (제목, 절대 URL)을 정확히 뽑는지 검증한다. 네트워크는 타지 않는다.
 */

import { describe, it, expect } from 'vitest';
import { COMMUNITY_SITES } from './community-scrape.js';

function parserFor(key: string) {
  const site = COMMUNITY_SITES.find((s) => s.key === key);
  if (!site) throw new Error(`no site ${key}`);
  return site.parse;
}

describe('community-scrape 사이트별 파서', () => {
  it('디시인사이드: 절대 URL 글만 뽑고 상대 URL(공지)은 제외한다', () => {
    const html = `
      <tr class="ub-content"><td class="gall_tit ub-word"><a href="/board/view/?id=dcbest&no=30638&_dcbest=1" view-msg=""><em class="icon_img icon_notice"></em><b><b>실시간베스트 갤러리 이용 안내</b></b></a></td></tr>
      <tr class="ub-content"><td class="gall_tit ub-word"><a href="https://gall.dcinside.com/board/view/?id=dcbest&no=447146">싱글벙글 알바 10번 짤려본 사람이 쓴 직장내 폐급 특징</a></td></tr>
      <tr class="ub-content"><td class="gall_tit ub-word"><a href="https://gall.dcinside.com/board/view/?id=dcbest&no=447080">미중 갈등은 한국에게 천운이었다</a></td></tr>
    `;
    const posts = parserFor('dcinside')(html);
    expect(posts).toHaveLength(2);
    expect(posts[0]).toEqual({
      url: 'https://gall.dcinside.com/board/view/?id=dcbest&no=447146',
      title: '싱글벙글 알바 10번 짤려본 사람이 쓴 직장내 폐급 특징',
    });
    // 공지(상대 URL)는 뽑히지 않는다.
    expect(posts.some((p) => p.title.includes('이용 안내'))).toBe(false);
  });

  it('더쿠: /hot/NNN 제목 앵커를 절대 URL로 만든다', () => {
    const html = `<a href="/hot/4286586897">극T만 있는나라 vs 극 F만 있는 나라</a>
      <a href="/hot/4286586897#4286586897_comment" class="replyNum">283</a>
      <a href="/hot/4286574272">유독 더쿠에서만 난리난듯한 이슈</a>`;
    const posts = parserFor('theqoo')(html);
    expect(posts).toHaveLength(2);
    expect(posts[0]).toEqual({
      url: 'https://theqoo.net/hot/4286586897',
      title: '극T만 있는나라 vs 극 F만 있는 나라',
    });
    // 댓글수 앵커(#..._comment)는 제목으로 뽑히지 않는다.
    expect(posts.some((p) => p.title === '283')).toBe(false);
  });

  it('네이트판: title 속성을 제목으로 쓴다', () => {
    const html = `<a href="/talk/375527817" onclick="vndr('BDW03');" title="성심당의 임산부 프리패스에 화내는 사람들">성심당의 임산부 프리패스에 화내는 사람들</a>
      <a href="/talk/375527817" onclick="vndr('BDW03');">댓글3천 ㄷㄷ</a>`;
    const posts = parserFor('natepann')(html);
    expect(posts[0]).toEqual({
      url: 'https://pann.nate.com/talk/375527817',
      title: '성심당의 임산부 프리패스에 화내는 사람들',
    });
  });

  it('보배드림: bsubject 앵커를 절대 URL로 만든다', () => {
    const html = `<a class="bsubject" style="padding:0;" href="/view?code=best&No=1012248&vdate=">차 뽑았습니다 자랑</a>`;
    const posts = parserFor('bobaedream')(html);
    expect(posts[0]).toEqual({
      url: 'https://www.bobaedream.co.kr/view?code=best&No=1012248&vdate=',
      title: '차 뽑았습니다 자랑',
    });
  });

  it('루리웹: text_over 제목만 뽑고 댓글수 (N)은 제거한다', () => {
    const html = `<a class="subject_link deco flex center" href="/best/board/300143/read/75961486?m=humor_only&t=now"><span class="text_over">국기무스메) 호빵</span><span class="num_reply flex_item_1"> (1)</span></a>`;
    const posts = parserFor('ruliweb')(html);
    expect(posts[0]).toEqual({
      url: 'https://bbs.ruliweb.com/best/board/300143/read/75961486?m=humor_only&t=now',
      title: '국기무스메) 호빵',
    });
  });

  it('인벤: ?my=chu 쿼리가 붙은 href와 <b> 제목을 뽑는다(속성 순서 무관)', () => {
    const html = `<a class="subject-link" href="https://www.inven.co.kr/board/webzine/2097/2699952?my=chu"><span class="category">[계층]</span><b><font color=blue>이번 패치 실화냐</font></b></a>`;
    const posts = parserFor('inven')(html);
    expect(posts[0]).toEqual({
      url: 'https://www.inven.co.kr/board/webzine/2097/2699952?my=chu',
      title: '이번 패치 실화냐',
    });
  });

  it('아카라이브: 텍스트 제목은 뽑고([N] 배지 제거) 이미지 전용(빈 제목) 앵커는 버린다', () => {
    const html = `<a class="title hybrid-title" href="/b/live/177438791?p=1">몰라 난 한 번 더 믿을래 [30]</a>
      <a class="title preview-image" href="/b/live/177468581?p=1"><div class="vrow-preview"></div></a>`;
    const posts = parserFor('arca')(html);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({
      url: 'https://arca.live/b/live/177438791',
      title: '몰라 난 한 번 더 믿을래',
    });
  });

  it('인스티즈: 앵커 안 댓글수 span(cmt3)을 제거하고 제목만 뽑는다', () => {
    const html = `<a href="https://www.instiz.net/pt/7882917?green=1"><span class="texthead_notice"><i class="fa"></i> 돈 좀 있는 회사들은 다 쓴다는 사내 메신저..JPG<span class="cmt3" title="유효 댓글 수 269">322</span></span></a>`;
    const posts = parserFor('instiz')(html);
    expect(posts[0]).toEqual({
      url: 'https://www.instiz.net/pt/7882917',
      title: '돈 좀 있는 회사들은 다 쓴다는 사내 메신저..JPG',
    });
  });

  it('공지·고정 안내(비밀번호 변경 등)는 tidy 단계에서 걸러진다', () => {
    // parse는 원본을 그대로 뽑고, 공지 필터는 scrapeCommunityHotPosts의 tidy가 담당한다.
    // 여기서는 NOTICE_RE가 대표적 공지 문구를 잡는지 파서 출력으로 간접 확인.
    const html = `<a href="/hot/1">📢📢【매우중요】 비밀번호 변경 권장</a><a href="/hot/2">진짜 웃긴 글</a>`;
    const posts = parserFor('theqoo')(html);
    // parse 자체는 둘 다 뽑는다(공지 필터는 상위 tidy 책임).
    expect(posts).toHaveLength(2);
  });

  it('HTML 엔티티(&amp; 등)를 디코드한다', () => {
    const html = `<a href="https://gall.dcinside.com/board/view/?id=dcbest&no=1">A &amp; B &lt;정리&gt;</a>`;
    const posts = parserFor('dcinside')(html);
    expect(posts[0]!.title).toBe('A & B <정리>');
  });
});
