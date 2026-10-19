/* Lightweight canvas confetti burst */

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vr: number;
  w: number; h: number;
  color: string;
  life: number; ttl: number;
  shape: "rect" | "circle";
}

const COLORS = ["#B8FF3C", "#5CD2FF", "#FFB84D", "#FF5C8A", "#F4F4F0", "#8B7CFF"];

export function fireConfetti(canvas: HTMLCanvasElement, count = 160, originY = 0.6) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  const parts: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
    const speed = 6 + Math.random() * 11;
    parts.push({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 4 + Math.random() * 6,
      h: 6 + Math.random() * 8,
      color: COLORS[i % COLORS.length],
      life: 0,
      ttl: 140 + Math.random() * 80,
      shape: Math.random() > 0.3 ? "rect" : "circle",
    });
  }

  let raf = 0;
  const step = () => {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.life++;
      if (p.life > p.ttl) continue;
      alive = true;
      p.vy += 0.16;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const alpha = Math.min(1, (p.ttl - p.life) / 40);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (alive) raf = requestAnimationFrame(step);
    else ctx.clearRect(0, 0, W, H);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
