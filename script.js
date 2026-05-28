const STORAGE_KEY = "teumsae-badminton-board-v3";

const titleInput = document.querySelector("#titleInput");
const courtCountInput = document.querySelector("#courtCountInput");
const matchList = document.querySelector("#matchList");
const resultBody = document.querySelector("#resultBody");
const addMatchBtn = document.querySelector("#addMatchBtn");
const removeMatchBtn = document.querySelector("#removeMatchBtn");
const clearScoresBtn = document.querySelector("#clearScoresBtn");
const printBtn = document.querySelector("#printBtn");
const resetBtn = document.querySelector("#resetBtn");
const matchTemplate = document.querySelector("#matchTemplate");
const fixtureTemplate = document.querySelector("#fixtureTemplate");
const setTemplate = document.querySelector("#setTemplate");

const pairCycle = [
  [
    ["", ""],
    ["", ""],
  ],
  [
    ["", ""],
    ["", ""],
  ],
  [
    ["", ""],
    ["", ""],
  ],
];

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.matches?.length) return sanitizeState(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    title: "",
    courtCount: 6,
    courts: ["1~3 코트", "4~6 코트"],
    matches: [createMatch(0)],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function sanitizeState(nextState) {
  nextState.courtCount = normalizeCourtCount(nextState.courtCount ?? 6);
  nextState.courts = getCourtLabels(nextState.courtCount);
  nextState.matches.forEach((match) => {
    match.fixtures.forEach((fixture) => {
      fixture.sets.forEach((set) => {
        set.scoreA = normalizeScore(set.scoreA);
        set.scoreB = normalizeScore(set.scoreB);
      });
    });
  });
  return nextState;
}

function createMatch(index, withSampleScores = false) {
  return {
    fixtures: pairCycle[index % pairCycle.length].map(([schoolA, schoolB]) => ({
      schoolA,
      schoolB,
      sets: [0, 1, 2].map((setIndex) => ({
        playersA: "",
        playersB: "",
        scoreA: withSampleScores ? [25, 21, 21][setIndex] : "",
        scoreB: withSampleScores ? [21, 25, 25][setIndex] : "",
      })),
    })),
  };
}

function renderBoard() {
  titleInput.value = state.title;
  courtCountInput.value = state.courtCount;
  document.querySelectorAll(".court-name").forEach((input, index) => {
    input.value = state.courts[index] ?? "";
  });

  matchList.replaceChildren();
  state.matches.forEach((match, matchIndex) => {
    const row = matchTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.match = matchIndex;
    row.querySelector(".match-title").textContent = `${matchIndex + 1}경기`;

    match.fixtures.forEach((fixture, fixtureIndex) => {
      const fixtureEl = renderFixture(fixture, matchIndex, fixtureIndex);
      row.querySelector(`[data-fixture="${fixtureIndex}"]`).replaceWith(fixtureEl);
    });

    matchList.appendChild(row);
  });

  updateAllResults();
  fitEditableText();
}

function renderFixture(fixture, matchIndex, fixtureIndex) {
  const fixtureEl = fixtureTemplate.content.firstElementChild.cloneNode(true);
  fixtureEl.className = `fixture fixture-${fixtureIndex + 1}`;
  fixtureEl.dataset.match = matchIndex;
  fixtureEl.dataset.fixture = fixtureIndex;

  fixtureEl.querySelectorAll("[data-field]").forEach((input) => {
    const field = input.dataset.field;
    if (field === "schoolA" || field === "schoolB") input.value = fixture[field];
  });

  const setList = fixtureEl.querySelector(".set-list");
  fixture.sets.forEach((set, setIndex) => {
    const setEl = setTemplate.content.firstElementChild.cloneNode(true);
    setEl.dataset.set = setIndex;
    setEl.querySelector(".set-number").textContent = setIndex + 1;
    setEl.querySelectorAll("[data-field]").forEach((input) => {
      input.value = set[input.dataset.field] ?? "";
    });
    setList.appendChild(setEl);
  });

  return fixtureEl;
}

function updateStateFromInput(input) {
  if (input.id === "titleInput") {
    state.title = input.value;
    return;
  }

  if (input.id === "courtCountInput") {
    state.courtCount = normalizeCourtCount(input.value);
    state.courts = getCourtLabels(state.courtCount);
    saveState();
    renderBoard();
    return;
  }

  if (input.classList.contains("court-name")) {
    state.courts[Number(input.dataset.court)] = input.value;
    return;
  }

  const fixtureEl = input.closest(".fixture");
  if (!fixtureEl) return;

  const matchIndex = Number(fixtureEl.dataset.match);
  const fixtureIndex = Number(fixtureEl.dataset.fixture);
  const field = input.dataset.field;
  const fixture = state.matches[matchIndex].fixtures[fixtureIndex];

  if (field === "schoolA" || field === "schoolB") {
    fixture[field] = input.value;
    return;
  }

  const setIndex = Number(input.closest(".set-row").dataset.set);
  fixture.sets[setIndex][field] = input.classList.contains("score") ? normalizeScore(input.value) : input.value;
  if (input.classList.contains("score")) input.value = fixture.sets[setIndex][field];
}

function updateAllResults() {
  const standings = new Map();

  document.querySelectorAll(".fixture").forEach((fixtureEl) => {
    const matchIndex = Number(fixtureEl.dataset.match);
    const fixtureIndex = Number(fixtureEl.dataset.fixture);
    const fixture = state.matches[matchIndex].fixtures[fixtureIndex];
    const result = getFixtureResult(fixture);

    fixtureEl.querySelector(".record-a").textContent = result.complete ? `(${result.winner === "draw" ? "무" : result.winner === "A" ? "승" : "패"})` : "( )";
    fixtureEl.querySelector(".record-b").textContent = result.complete ? `(${result.winner === "draw" ? "무" : result.winner === "B" ? "승" : "패"})` : "( )";

    if (!result.complete) return;
    addStanding(standings, fixture.schoolA, result.winner === "A" ? "win" : result.winner === "draw" ? "draw" : "loss");
    addStanding(standings, fixture.schoolB, result.winner === "B" ? "win" : result.winner === "draw" ? "draw" : "loss");
  });

  renderStandings(standings);
}

function getFixtureResult(fixture) {
  let setWinsA = 0;
  let setWinsB = 0;
  let playedSets = 0;

  fixture.sets.forEach((set) => {
    const scoreA = toScore(set.scoreA);
    const scoreB = toScore(set.scoreB);
    if (scoreA === null || scoreB === null) return;
    playedSets += 1;
    if (scoreA === scoreB) return;
    if (scoreA > scoreB) setWinsA += 1;
    if (scoreB > scoreA) setWinsB += 1;
  });

  const winner = setWinsA === setWinsB ? "draw" : setWinsA > setWinsB ? "A" : "B";
  return {
    complete: Boolean(cleanName(fixture.schoolA) && cleanName(fixture.schoolB) && playedSets > 0),
    winner,
  };
}

function toScore(value) {
  if (value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function normalizeScore(value) {
  if (value === "") return "";
  const score = Math.trunc(Number(value));
  if (!Number.isFinite(score)) return "";
  return String(Math.max(0, score));
}

function normalizeCourtCount(value) {
  const count = Math.trunc(Number(value));
  if (!Number.isFinite(count)) return 6;
  return Math.min(30, Math.max(2, count));
}

function getCourtLabels(totalCourts) {
  const firstEnd = Math.ceil(totalCourts / 2);
  return [formatCourtRange(1, firstEnd), formatCourtRange(firstEnd + 1, totalCourts)];
}

function formatCourtRange(start, end) {
  return start === end ? `${start} 코트` : `${start}~${end} 코트`;
}

function addStanding(map, school, result) {
  const name = cleanName(school);
  if (!name) return;
  const row = map.get(name) ?? { name, wins: 0, draws: 0, losses: 0 };
  if (result === "win") row.wins += 1;
  if (result === "draw") row.draws += 1;
  if (result === "loss") row.losses += 1;
  map.set(name, row);
}

function cleanName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function renderStandings(standings) {
  const rows = rankRows([...standings.values()].sort(compareStanding));
  resultBody.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement("tr");
    empty.innerHTML = '<td colspan="3" class="empty">학교명과 점수를 입력하면 결과가 자동으로 표시됩니다.</td>';
    resultBody.appendChild(empty);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const rankDisplay = row.rank <= 3
      ? `<img class="rank-medal" src="./assets/medal-${row.rank}-crop.png" alt="${row.rank}위">`
      : `<span class="rank-number">${row.rank}등</span>`;
    tr.innerHTML = `
      <td><span class="rank-result">${rankDisplay}</span></td>
      <td>${escapeHtml(row.name)}</td>
      <td>${row.wins}승 ${row.draws}무 ${row.losses}패</td>
    `;
    resultBody.appendChild(tr);
  });
}

function compareStanding(a, b) {
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.draws !== a.draws) return b.draws - a.draws;
  if (a.losses !== b.losses) return a.losses - b.losses;
  return a.name.localeCompare(b.name, "ko");
}

function rankRows(rows) {
  let lastScore = "";
  let rank = 0;
  return rows.map((row, index) => {
    const score = `${row.wins}/${row.draws}/${row.losses}`;
    if (score !== lastScore) rank = index + 1;
    lastScore = score;
    return { ...row, rank };
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("input", (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  updateStateFromInput(event.target);
  saveState();
  updateAllResults();
  fitEditableText(event.target);
});

function fitEditableText(target = document) {
  const inputs = target instanceof HTMLInputElement ? [target] : [...target.querySelectorAll(".school, .players")];
  inputs.forEach((input) => {
    const length = cleanName(input.value || input.placeholder).length;
    const base = input.classList.contains("school") ? 22 : 17;
    const min = input.classList.contains("school") ? 14 : 12;
    const size = Math.max(min, base - Math.max(0, length - 8) * 0.95);
    input.style.fontSize = `${size}px`;
    input.title = input.value;
  });
}

addMatchBtn.addEventListener("click", () => {
  state.matches.push(createMatch(state.matches.length));
  saveState();
  renderBoard();
});

removeMatchBtn.addEventListener("click", () => {
  if (state.matches.length <= 1) return;
  state.matches.pop();
  saveState();
  renderBoard();
});

clearScoresBtn.addEventListener("click", () => {
  state.matches.forEach((match) => {
    match.fixtures.forEach((fixture) => {
      fixture.sets.forEach((set) => {
        set.scoreA = "";
        set.scoreB = "";
      });
    });
  });
  saveState();
  renderBoard();
});

printBtn.addEventListener("click", () => {
  window.print();
});

resetBtn.addEventListener("click", () => {
  if (!confirm("전체 내용을 처음 상태로 되돌릴까요?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  renderBoard();
});

renderBoard();
