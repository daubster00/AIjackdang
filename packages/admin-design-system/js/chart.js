/* ===========================================================================
 * 간단한 선/면적 차트 (외부 라이브러리 없이 canvas 로 직접 그림)
 *
 * createLineChart(canvas, { labels, series }) 사용:
 *   const chart = createLineChart(document.getElementById("trafficChart"), {
 *     labels: ["6/11", "6/12", ...],
 *     series: [
 *       { values: [620, 710, ...], color: "#2563eb", fill: "rgba(37,99,235,.18)" },
 *       { values: [260, 320, ...], color: "#06b6d4", fill: "rgba(6,182,212,.13)" },
 *     ],
 *   });
 *   chart.setData({ labels, series });  // 데이터 교체 후 자동 다시 그림
 *
 * 컨테이너 크기 변화에 맞춰 ResizeObserver 로 자동 재렌더하며, 고해상도(DPR) 대응.
 * 반환: { setData, redraw, destroy }
 * =========================================================================== */

export function createLineChart(canvas, initial = { labels: [], series: [] }) {
  if (!canvas) return { setData() {}, redraw() {}, destroy() {} };

  let data = initial;
  const ctx = canvas.getContext("2d");

  function redraw() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { left: 44, right: 16, top: 16, bottom: 34 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const allValues = data.series.flatMap((s) => s.values);
    const maxVal = Math.max(200, Math.ceil(Math.max(...allValues, 0) / 200) * 200);
    const gridCount = 5;

    ctx.clearRect(0, 0, width, height);
    ctx.font = '11px "Pretendard Variable", sans-serif';
    ctx.textBaseline = "middle";

    // 가로 그리드 + Y축 눈금
    for (let i = 0; i <= gridCount; i++) {
      const y = padding.top + (plotH / gridCount) * i;
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const value = Math.round(maxVal - (maxVal / gridCount) * i);
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "right";
      ctx.fillText(value.toLocaleString(), padding.left - 9, y);
    }

    // X축 라벨
    const labels = data.labels;
    labels.forEach((label, index) => {
      const x = labels.length === 1
        ? padding.left + plotW / 2
        : padding.left + (plotW / (labels.length - 1)) * index;
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(label, x, height - 12);
    });

    function points(values) {
      return values.map((value, index) => ({
        x: values.length === 1
          ? padding.left + plotW / 2
          : padding.left + (plotW / (values.length - 1)) * index,
        y: padding.top + plotH - (value / maxVal) * plotH,
      }));
    }

    function curve(pts) {
      pts.forEach((p, i) => {
        if (i === 0) {
          ctx.lineTo(p.x, p.y);
        } else {
          const prev = pts[i - 1];
          const cp = (prev.x + p.x) / 2;
          ctx.bezierCurveTo(cp, prev.y, cp, p.y, p.x, p.y);
        }
      });
    }

    data.series.forEach((s) => {
      const pts = points(s.values);
      if (pts.length === 0) return;

      // 면적 채우기
      if (s.fill) {
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, s.fill);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.moveTo(pts[0].x, height - padding.bottom);
        curve(pts);
        ctx.lineTo(pts[pts.length - 1].x, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // 선
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : null));
      curve(pts);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // 점
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });
  }

  function setData(next) {
    data = next;
    redraw();
  }

  const target = canvas.parentElement || canvas;
  const observer = new ResizeObserver(redraw);
  observer.observe(target);
  // 폰트 로드/초기 레이아웃 이후 한 번 더
  if (document.readyState === "complete") redraw();
  else window.addEventListener("load", redraw, { once: true });
  redraw();

  return {
    setData,
    redraw,
    destroy() {
      observer.disconnect();
    },
  };
}
