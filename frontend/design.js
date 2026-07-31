
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const HAS_GSAP = typeof gsap !== "undefined";

(function constellation() {
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");
  let w, h, nodes;

  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  function makeNodes() {
    const count = REDUCED_MOTION ? 0 : Math.min(70, Math.floor((w * h) / 22000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    });
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 130) {
          ctx.strokeStyle = `rgba(108,123,255,${0.18 * (1 - dist / 130)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    nodes.forEach(n => {
      ctx.fillStyle = "rgba(79,227,193,0.7)";
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2); ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  window.addEventListener("resize", () => { resize(); makeNodes(); });
  resize(); makeNodes(); tick();
})();


(function cursorGlow() {
  if (REDUCED_MOTION || !HAS_GSAP || window.matchMedia("(hover: none)").matches) return;
  const glow = document.getElementById("cursor-glow");
  if (!glow) return;
  const moveX = gsap.quickTo(glow, "x", { duration: 0.6, ease: "power3" });
  const moveY = gsap.quickTo(glow, "y", { duration: 0.6, ease: "power3" });
  window.addEventListener("mousemove", (e) => { moveX(e.clientX); moveY(e.clientY); });
})();

if (!HAS_GSAP) {
  console.warn("GSAP failed to load — falling back to static (non-animated) UI.");
}

function attachMagnetic(el, strength = 16) {
  if (!HAS_GSAP || REDUCED_MOTION || window.matchMedia("(hover: none)").matches) return;
  el.addEventListener("mousemove", (e) => {
    const rect = el.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(el, { x: relX * strength, y: relY * strength, duration: 0.35, ease: "power2.out" });
  });
  el.addEventListener("mouseleave", () => {
    gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
  });
}
document.querySelectorAll(".btn-primary, .btn-secondary, .botbtn").forEach(el => attachMagnetic(el, el.classList.contains("botbtn") ? 10 : 14));

function playHeroEntrance() {
  if (!HAS_GSAP) return;
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.set(".hero-title .line > span", { yPercent: 110 })
    .set([".eyebrow", ".hero-sub", "#start-btn", ".hero-footnote"], { opacity: 0, y: 18 });

  if (REDUCED_MOTION) {
    gsap.set(".hero-title .line > span", { yPercent: 0 });
    gsap.set([".eyebrow", ".hero-sub", "#start-btn", ".hero-footnote"], { opacity: 1, y: 0 });
    return;
  }

  tl.to(".hero .eyebrow", { opacity: 1, y: 0, duration: 0.5 })
    .to(".hero-title .line > span", { yPercent: 0, duration: 0.85, stagger: 0.12 }, "-=0.25")
    .to(".hero-sub", { opacity: 1, y: 0, duration: 0.6 }, "-=0.35")
    .to("#start-btn", { opacity: 1, y: 0, duration: 0.5 }, "-=0.3")
    .to(".hero-footnote", { opacity: 1, y: 0, duration: 0.5 }, "-=0.25");
}
playHeroEntrance();

window.addEventListener("pathfind:floatingcards", () => {
  const cards = document.querySelectorAll(".float-card");
  if (!HAS_GSAP) return;
  gsap.set(cards, { opacity: 0, y: 20 });
  if (REDUCED_MOTION) {
    gsap.set(cards, { opacity: 1, y: 0 });
    return;
  }
  gsap.to(cards, {
    opacity: 1, y: 0, duration: 0.7, stagger: 0.12, delay: 0.9, ease: "power2.out",
    onComplete: () => {
      cards.forEach((card, i) => {
        gsap.to(card, {
          y: -8, duration: 2 + (i % 3) * 0.3, repeat: -1, yoyo: true,
          ease: "sine.inOut", delay: i * 0.15
        });
      });
    }
  });
});

window.addEventListener("pathfind:pagechange", (e) => {
  if (!HAS_GSAP) return;
  const page = document.getElementById(e.detail.id);
  if (REDUCED_MOTION) { gsap.set(page, { opacity: 1, y: 0 }); return; }
  gsap.fromTo(page, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" });
});

window.addEventListener("pathfind:question", () => {
  if (!HAS_GSAP) return;
  const wrap = document.getElementById("question-wrap");
  const options = document.querySelectorAll(".option-card");
  if (REDUCED_MOTION) {
    gsap.set(wrap, { opacity: 1, x: 0 });
    gsap.set(options, { opacity: 1, y: 0 });
    return;
  }
  gsap.fromTo(wrap, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" });
  gsap.fromTo(options, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, delay: 0.08, ease: "power2.out" });
});

window.addEventListener("pathfind:results", () => {
  if (!HAS_GSAP) return;
  const cards = document.querySelectorAll(".career-card");
  if (REDUCED_MOTION) { gsap.set(cards, { opacity: 1, y: 0 }); return; }
  gsap.fromTo(cards, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08, ease: "power2.out" });
});

window.addEventListener("pathfind:chattoggle", (e) => {
  const panel = document.getElementById("chat-panel");
  if (!HAS_GSAP) return;
  if (REDUCED_MOTION) { gsap.set(panel, { opacity: e.detail.open ? 1 : 0, scale: 1 }); return; }
  if (e.detail.open) {
    gsap.fromTo(panel, { opacity: 0, scale: 0.85, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.7)" });
  } else {
    gsap.to(panel, { opacity: 0, scale: 0.9, y: 10, duration: 0.22, ease: "power1.in" });
  }
});

window.addEventListener("pathfind:chatmessage", (e) => {
  if (!HAS_GSAP || REDUCED_MOTION) return;
  gsap.fromTo(e.detail.el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
});