

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


// ==================== COMPARE FEATURE ====================
let selectedCareers = [];

function updateCompareBar() {
  const bar = document.getElementById("compare-bar");
  const pillA = document.getElementById("compare-a");
  const pillB = document.getElementById("compare-b");
  const btn = document.getElementById("compare-btn");
  const resultBox = document.getElementById("compare-result");

  if (selectedCareers.length === 0) {
    bar.classList.add("hidden");
    resultBox.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  pillA.textContent = selectedCareers[0] ? selectedCareers[0].title : "—";
  pillB.textContent = selectedCareers[1] ? selectedCareers[1].title : "—";
  btn.disabled = selectedCareers.length !== 2;
}

// Make career cards selectable (max 2)
const originalRenderCareerGrid = renderCareerGrid;
renderCareerGrid = function () {
  originalRenderCareerGrid();

  document.querySelectorAll(".career-card").forEach((card, i) => {
    // Find the career object that matches this card
    const title = card.querySelector(".career-title").textContent;
    const career = allMatches.find(c => c.title === title);
    if (!career) return;

    // Restore selected state if already chosen
    if (selectedCareers.some(c => c.title === career.title)) {
      card.classList.add("selected-for-compare");
    }

    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const idx = selectedCareers.findIndex(c => c.title === career.title);

      if (idx > -1) {
        // deselect
        selectedCareers.splice(idx, 1);
        card.classList.remove("selected-for-compare");
      } else {
        if (selectedCareers.length >= 2) return; // already have two
        selectedCareers.push(career);
        card.classList.add("selected-for-compare");
      }
      updateCompareBar();
    });
  });
};

// Compare button
document.getElementById("compare-btn").addEventListener("click", async () => {
  if (selectedCareers.length !== 2) return;

  const resultBox = document.getElementById("compare-result");
  resultBox.classList.remove("hidden");
  resultBox.innerHTML = `<div class="analyzing-text">Comparing…</div>`;

  try {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        careerA: selectedCareers[0],
        careerB: selectedCareers[1],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Compare failed");

    resultBox.innerHTML = `
      <h3>Head-to-Head Comparison</h3>
      <div class="compare-grid">
        <div class="compare-side">
          <div class="title">${data.careerA.title}</div>
          <div class="pct">${data.careerA.matchPercent}% match</div>
          <div class="meta">
            <strong>Top traits:</strong> ${data.careerA.traits.join(", ") || "—"}<br>
            <strong>Unique skills:</strong> ${data.careerA.uniqueSkills.join(", ") || "None"}
          </div>
        </div>
        <div class="compare-side">
          <div class="title">${data.careerB.title}</div>
          <div class="pct">${data.careerB.matchPercent}% match</div>
          <div class="meta">
            <strong>Top traits:</strong> ${data.careerB.traits.join(", ") || "—"}<br>
            <strong>Unique skills:</strong> ${data.careerB.uniqueSkills.join(", ") || "None"}
          </div>
        </div>
      </div>
      <div class="meta" style="margin-bottom:10px">
      </div>
      <div class="compare-verdict">${data.verdict}</div>
    `;
  } catch (err) {
    resultBox.innerHTML = `<div class="msg error">Could not compare. Please try again.</div>`;
  }
});

// ==================== DOWNLOAD REPORT ====================
document.getElementById("download-report-btn").addEventListener("click", () => {
  if (!allMatches.length) {
    alert("No results to download yet.");
    return;
  }

  let report = "METANOIA — Career Discovery Report\n";
  report += "====================================\n\n";
  report += `Session ID: ${sessionId}\n`;
  report += `Date: ${new Date().toLocaleString()}\n\n`;

  // Recommendations
  report += "YOUR TOP CAREER MATCHES\n";
  report += "-----------------------\n";
  allMatches.forEach((c, i) => {
    report += `${i + 1}. ${c.title} — ${c.matchPercent}% match\n`;
    report += `   ${c.description}\n`;
    report += `   Skills: ${(c.skills || []).join(", ")}\n\n`;
  });

  // Comparison (if user did one)
  if (selectedCareers.length === 2) {
    report += "HEAD-TO-HEAD COMPARISON\n";
    report += "-----------------------\n";
    report += `A: ${selectedCareers[0].title}\n`;
    report += `B: ${selectedCareers[1].title}\n\n`;
  }

  // Create and download the file
  const blob = new Blob([report], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `metanoia-report-${sessionId}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});
