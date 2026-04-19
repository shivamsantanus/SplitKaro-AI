export function fireConfetti() {
  const canvas = document.createElement("canvas")
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999"
  document.body.appendChild(canvas)

  const ctx = canvas.getContext("2d")!
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const COLORS = ["#16a34a", "#22c55e", "#4ade80", "#bbf7d0", "#3b82f6", "#fbbf24", "#f0fdf4"]

  type Particle = {
    x: number; y: number
    vx: number; vy: number
    rot: number; rotV: number
    color: string; w: number; h: number
  }

  const particles: Particle[] = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 40,
    vx: (Math.random() - 0.5) * 5,
    vy: Math.random() * 3 + 2,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.25,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    w: Math.random() * 9 + 4,
    h: Math.random() * 5 + 2,
  }))

  let frame = 0
  const MAX = 130

  function tick() {
    if (frame >= MAX) { canvas.remove(); return }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const alpha = Math.max(0, 1 - frame / MAX)
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.06
      p.rot += p.rotV
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    frame++
    requestAnimationFrame(tick)
  }
  tick()
}
