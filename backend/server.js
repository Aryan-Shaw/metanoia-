require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// OpenRouter client
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const CHAT_MODEL = "inclusionai/ling-3.0-flash:free";
const CAREER_FILE_PATH = path.join(__dirname, "career.txt");

// Load career documentation once at startup
let careerInfo = "";
try {
  careerInfo = fs.readFileSync(CAREER_FILE_PATH, "utf-8");
} catch (err) {
  console.error("Failed to load career.txt:", err.message);
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Data files
const QUESTIONS_PATH = path.join(__dirname, "questions.json");
const CAREERS_PATH = path.join(__dirname, "careers.json");
const SESSIONS_PATH = path.join(__dirname, "sessions.json");

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

for (const [name, p] of [
  ["questions.json", QUESTIONS_PATH],
  ["careers.json", CAREERS_PATH],
]) {
  if (!fs.existsSync(p)) {
    console.error(`Missing required data file: ${name} (expected at ${p})`);
    process.exit(1);
  }
}

if (!fs.existsSync(SESSIONS_PATH)) {
  writeJSON(SESSIONS_PATH, {});
}

const TAGS = [
  "analytical",
  "creative",
  "social",
  "technical",
  "leadership",
  "handsOn",
  "research",
  "entrepreneurial",
  "caring",
  "communication",
];

app.get("/api/questions", (req, res) => {
  res.json(readJSON(QUESTIONS_PATH));
});

app.post("/api/quiz", (req, res) => {
  const { sessionId, answers } = req.body;
  if (!sessionId || !answers) {
    return res.status(400).json({ error: "sessionId and answers are required" });
  }

  const questions = readJSON(QUESTIONS_PATH);
  const vector = Object.fromEntries(TAGS.map((tag) => [tag, 0]));

  questions.forEach((question) => {
    const chosenOptionIndex = answers[question.id];
    if (chosenOptionIndex === undefined || chosenOptionIndex === null) return;
    const chosenOption = question.options[chosenOptionIndex];
    if (!chosenOption) return;

    Object.entries(chosenOption.weights).forEach(([tag, points]) => {
      vector[tag] += points;
    });
  });

  const sessions = readJSON(SESSIONS_PATH);
  sessions[sessionId] = { answers, vector };
  writeJSON(SESSIONS_PATH, sessions);

  res.json({ vector });
});

app.get("/api/recommendations", (req, res) => {
  const { sessionId } = req.query;
  const sessions = readJSON(SESSIONS_PATH);
  const session = sessions[sessionId];

  if (!session) {
    return res
      .status(404)
      .json({ error: "No quiz answers found for this session yet" });
  }

  const studentVector = session.vector;
  const careers = readJSON(CAREERS_PATH);

  const scored = careers.map((career) => ({
    ...career,
    matchPercent: Math.round(
      cosineSimilarity(studentVector, career.weights) * 100
    ),
  }));

  const results = scored
    .filter((career) => career.matchPercent >= 30)
    .sort((a, b) => b.matchPercent - a.matchPercent);

  res.json(results);
});

function cosineSimilarity(vectorA, vectorB) {
  let dotProduct = 0;
  let lengthA = 0;
  let lengthB = 0;

  TAGS.forEach((tag) => {
    const a = vectorA[tag] || 0;
    const b = vectorB[tag] || 0;
    dotProduct += a * b;
    lengthA += a * a;
    lengthB += b * b;
  });

  if (lengthA === 0 || lengthB === 0) return 0;
  return dotProduct / (Math.sqrt(lengthA) * Math.sqrt(lengthB));
}

// Chat endpoint (now properly loads careerInfo)
app.get("/api/chat", async (req, res) => {
  const question = req.query.question;

  if (!question || !question.trim().length) {
    return res.status(400).json({ error: "no question asked" });
  }

  try {
    const systemPrompt = [
      "You are the assistant and answer questions as asked. Only answer the relevant question up to the career documentation.",
      "Humorously and savagely decline if the question is not relevant.",
      careerInfo,
    ].join(" ");

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    });

    const responseai = completion.choices[0].message.content;
    res.json({ responseai });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// compare any two models
app.post("/api/compare", (req, res) => {
  const { sessionId, careerA, careerB } = req.body;

  if (!sessionId || !careerA || !careerB) {
    return res.status(400).json({ error: "sessionId, careerA and careerB are required" });
  }

  const sessions = readJSON(SESSIONS_PATH);
  const session = sessions[sessionId];
  if (!session) {
    return res.status(404).json({ error: "No quiz session found" });
  }

  const studentVector = session.vector;

  // Recalculate match % so we always have fresh numbers
  const pctA = Math.round(cosineSimilarity(studentVector, careerA.weights || {}) * 100);
  const pctB = Math.round(cosineSimilarity(studentVector, careerB.weights || {}) * 100);

  // Unique criteria
  const skillsA = new Set(careerA.skills || []);
  const skillsB = new Set(careerB.skills || []);
  const commonSkills = [...skillsA].filter(s => skillsB.has(s));
  const uniqueA = [...skillsA].filter(s => !skillsB.has(s));
  const uniqueB = [...skillsB].filter(s => !skillsA.has(s));

  // Dominant traits (top 2 tags for each)
  function topTraits(weights) {
    return Object.entries(weights || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([tag]) => tag);
  }
  const traitsA = topTraits(careerA.weights);
  const traitsB = topTraits(careerB.weights);

  // Simple verdict
  let verdict;
  if (pctA === pctB) {
    verdict = "Both careers fit you equally well. Look at the skills and traits to decide.Try out the skills their to understand better";
  } else if (pctA > pctB) {
    verdict = `${careerA.title} is the stronger match for you right now.`;
  } else {
    verdict = `${careerB.title} is the stronger match for you right now.`;
  }

  res.json({
    careerA: { title: careerA.title, matchPercent: pctA, traits: traitsA, uniqueSkills: uniqueA },
    careerB: { title: careerB.title, matchPercent: pctB, traits: traitsB, uniqueSkills: uniqueB },
    commonSkills,
    difference: Math.abs(pctA - pctB),
    verdict,
  });
});


app.listen(PORT, () => {
  console.log(`Career Finder running at http://localhost:${PORT}`);
});


