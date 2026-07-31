

const sessionId = "guest_" + Math.random().toString(36).slice(2, 10);

let questions = [];
const answers = {};
let currentIndex = 0;
let allMatches = [];
let activeFilter = "all";

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.dispatchEvent(new CustomEvent("pathfind:pagechange", { detail: { id } }));
}

const SAMPLE_CAREER_LABELS = ["Data Scientist", "UX Designer", "Robotics Engineer", "Psychologist", "Entrepreneur"];

function renderFloatingCards() {
  const wrap = document.getElementById("floating-cards");
  wrap.innerHTML = "";
  SAMPLE_CAREER_LABELS.forEach((label, i) => {
    const card = document.createElement("div");
    card.className = "float-card";
    card.dataset.index = i;
    card.textContent = label;
    wrap.appendChild(card);
  });
  window.dispatchEvent(new CustomEvent("pathfind:floatingcards"));
}
renderFloatingCards();

document.getElementById("start-btn").addEventListener("click", () => showPage("page-quiz"));

async function loadQuestions() {
  const res = await fetch("/api/questions");
  questions = await res.json();
}

document.getElementById("guest-btn").addEventListener("click", async () => {
  document.getElementById("entry-step").classList.add("hidden");
  document.getElementById("quiz-step").classList.remove("hidden");
  if (questions.length === 0) await loadQuestions();
  loadQuestion(0);
});

function loadQuestion(index) {
  currentIndex = index;
  const q = questions[index];

  document.getElementById("progress-fill").style.width = `${(index / questions.length) * 100}%`;
  document.getElementById("quiz-count").textContent = `Question ${index + 1} / ${questions.length}`;
  document.getElementById("question-text").textContent = q.text;

  const grid = document.getElementById("options-grid");
  grid.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-card";
    btn.innerHTML = `<span class="opt-icon">${opt.icon}</span>${opt.label}`;
    btn.addEventListener("click", () => selectOption(q.id, i, btn));
    grid.appendChild(btn);
  });

  window.dispatchEvent(new CustomEvent("pathfind:question", { detail: { index } }));
}

function selectOption(questionId, optionIndex, btnEl) {
  document.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
  btnEl.classList.add("selected");
  answers[questionId] = optionIndex;
  setTimeout(advance, 260);
}

document.getElementById("skip-btn").addEventListener("click", () => {
  answers[questions[currentIndex].id] = null;
  advance();
});

function advance() {
  if (currentIndex < questions.length - 1) {
    loadQuestion(currentIndex + 1);
  } else {
    finishQuiz();
  }
}

async function finishQuiz() {
  document.getElementById("progress-fill").style.width = "100%";
  document.getElementById("quiz-step").classList.add("hidden");
  document.getElementById("analyzing-step").classList.remove("hidden");

  await fetch("/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, answers }),
  });

  await renderResults();
  setTimeout(() => showPage("page-results"), 400);
}

async function renderResults() {
  const res = await fetch(`/api/recommendations?sessionId=${sessionId}`);
  allMatches = await res.json();
  renderCareerGrid();
}

document.querySelectorAll(".filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter;
    renderCareerGrid();
  });
});

function renderCareerGrid() {
  const grid = document.getElementById("career-grid");
  const emptyState = document.getElementById("empty-state");
  grid.innerHTML = "";

  let filtered = allMatches;
  if (activeFilter !== "all") {
    filtered = allMatches.filter(c => c.weights[activeFilter]);
  }

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach((career, i) => {
    const card = document.createElement("div");
    card.className = "career-card";
    card.dataset.index = i;
    card.innerHTML = `
      <div class="career-card-top">
        <div class="career-title">${career.title}</div>
        <div class="match-badge" data-target="${career.matchPercent}">0%</div>
      </div>
      <div class="career-desc">${career.description}</div>
      <div class="skill-row">
        ${career.skills.map(s => `<span class="skill-chip">${s}</span>`).join("")}
      </div>
    `;
    grid.appendChild(card);
    animateMatchCount(card.querySelector(".match-badge"));
  });

  window.dispatchEvent(new CustomEvent("pathfind:results", { detail: { count: filtered.length } }));
}

function animateMatchCount(el) {
  const target = parseInt(el.dataset.target, 10);
  let current = 0;
  const step = Math.max(1, Math.round(target / 24));
  const interval = setInterval(() => {
    current = Math.min(target, current + step);
    el.textContent = `${current}% match`;
    if (current >= target) clearInterval(interval);
  }, 16);
}

document.getElementById("restart-btn").addEventListener("click", () => {
  Object.keys(answers).forEach(k => delete answers[k]);
  document.getElementById("quiz-step").classList.remove("hidden");
  document.getElementById("analyzing-step").classList.add("hidden");
  document.getElementById("entry-step").classList.remove("hidden");
  showPage("page-quiz");
});