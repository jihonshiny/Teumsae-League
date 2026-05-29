const STORAGE_KEY = "teumsae-badminton-board-v3";

const titleInput = document.querySelector("#titleInput");
const courtCountInput = document.querySelector("#courtCountInput");
const matchList = document.querySelector("#matchList");
const resultBody = document.querySelector("#resultBody");
const nameColumnHead = document.querySelector("#nameColumnHead");
const sectionCaption = document.querySelector(".section-title small");
const modeButtons = document.querySelectorAll(".mode-btn");
const addMatchBtn = document.querySelector("#addMatchBtn");
const removeMatchBtn = document.querySelector("#removeMatchBtn");
const clearScoresBtn = document.querySelector("#clearScoresBtn");
const printBtn = document.querySelector("#printBtn");
const resetBtn = document.querySelector("#resetBtn");
const matchTemplate = document.querySelector("#matchTemplate");
const fixtureTemplate = document.querySelector("#fixtureTemplate");
const setTemplate = document.querySelector("#setTemplate");

const COURT_GROUP_COUNT = 2;

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
    mode: "team",
    courtCount: 6,
    courts: getCourtLabels(6),
    matches: [createMatch(0)],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function sanitizeState(nextState) {
  nextState.title = String(nextState.title ?? "");
  nextState.mode = nextState.mode === "individual" ? "individual" : "team";
  nextState.courtCount = normalizeCourtCount(nextState.courtCount ?? 6);
  nextState.courts = normalizeCourts(nextState.courts, nextState.courtCount);
  nextState.matches.forEach((match) => {
    ensureFixtureCount(match);
    match.fixtures.forEach((fixture) => {
      fixture.sets.forEach((set) => {
        set.playersA = normalizePlayerText(set.playersA);
        set.playersB = normalizePlayerText(set.playersB);
        set.scoreA = normalizeScore(set.scoreA);
        set.scoreB = normalizeScore(set.scoreB);
      });
    });
  });
  return nextState;
}

function createMatch(index, withSampleScores = false) {
  return {
    fixtures: Array.from({ length: COURT_GROUP_COUNT }, () => createFixture(withSampleScores)),
  };
}

function createFixture(withSampleScores = false) {
  return {
    schoolA: "",
    schoolB: "",
    sets: [0, 1, 2].map((setIndex) => createSet(withSampleScores, setIndex)),
  };
}

function createSet(withSampleScores = false, setIndex = 0) {
  return {
    playersA: "",
    playersB: "",
    scoreA: withSampleScores ? [25, 21, 21][setIndex] ?? "" : "",
    scoreB: withSampleScores ? [21, 25, 25][setIndex] ?? "" : "",
  };
}

function renderBoard() {
  ensureAllFixtureCounts();
  titleInput.value = state.title;
  courtCountInput.value = state.courtCount;
  renderMode();
  renderCourtHeader();

  matchList.replaceChildren();
  state.matches.forEach((match, matchIndex) => {
    const row = matchTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.match = matchIndex;
    row.querySelector(".match-title").textContent = `${matchIndex + 1}경기`;

    match.fixtures.forEach((fixture, fixtureIndex) => {
      const fixtureEl = renderFixture(fixture, matchIndex, fixtureIndex);
      row.appendChild(fixtureEl);
    });

    matchList.appendChild(row);
  });

  updateAllResults();
  fitEditableText();
  fitTitleText();
}

function renderCourtHeader() {
  const head = document.querySelector(".board-head");
  head.querySelectorAll(".court-name").forEach((input) => input.remove());

  state.courts.forEach((court, index) => {
    const input = document.createElement("input");
    input.className = `head-cell court-name ${index % 2 ? "alt-court" : ""}`;
    input.dataset.court = index;
    input.value = court;
    input.ariaLabel = `${index + 1}번 코트 이름`;
    head.appendChild(input);
  });
}

function renderMode() {
  document.body.classList.toggle("mode-individual", state.mode === "individual");
  document.body.classList.toggle("mode-team", state.mode !== "individual");

  modeButtons.forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const label = getCompetitorLabel();
  nameColumnHead.textContent = label;
  sectionCaption.textContent = state.mode === "individual" ? "개인전 세트 경기 기록" : "단체전 복식 경기 기록";
}

function renderFixture(fixture, matchIndex, fixtureIndex) {
  const fixtureEl = fixtureTemplate.content.firstElementChild.cloneNode(true);
  fixtureEl.className = `fixture fixture-${fixtureIndex + 1}`;
  fixtureEl.dataset.match = matchIndex;
  fixtureEl.dataset.fixture = fixtureIndex;

  fixtureEl.querySelectorAll("[data-field]").forEach((input) => {
    const field = input.dataset.field;
    if (field === "schoolA" || field === "schoolB") {
      input.value = fixture[field];
      input.placeholder = getCompetitorLabel();
    }
  });

  const setList = fixtureEl.querySelector(".set-list");
  fixture.sets.forEach((set, setIndex) => {
    const setEl = setTemplate.content.firstElementChild.cloneNode(true);
    setEl.dataset.set = setIndex;
    setEl.querySelector(".set-number").textContent = setIndex + 1;
    setEl.querySelectorAll("[data-field]").forEach((input) => {
      input.value = set[input.dataset.field] ?? "";
    });
    renderPlayerCell(setEl.querySelector('[data-side="A"]'), set.playersA, "playersA", matchIndex, fixtureIndex, setIndex);
    renderPlayerCell(setEl.querySelector('[data-side="B"]'), set.playersB, "playersB", matchIndex, fixtureIndex, setIndex);
    setList.appendChild(setEl);
  });

  const controls = document.createElement("div");
  controls.className = "set-controls";
  controls.innerHTML = `
    <button class="set-btn" type="button" data-action="add-set" data-match="${matchIndex}" data-fixture="${fixtureIndex}">${getAddSetLabel()}</button>
    <button class="set-btn" type="button" data-action="remove-set" data-match="${matchIndex}" data-fixture="${fixtureIndex}">${getRemoveSetLabel()}</button>
  `;
  fixtureEl.appendChild(controls);

  return fixtureEl;
}

function renderPlayerCell(cell, players, field, matchIndex, fixtureIndex, setIndex) {
  const list = document.createElement("div");
  list.className = "player-list";

  const input = document.createElement("input");
  input.className = "players";
  input.dataset.field = field;
  input.placeholder = "선수명, 선수명";
  input.value = normalizePlayerText(players);
  list.appendChild(input);

  cell.replaceChildren(list);
}

function getCompetitorLabel() {
  return state.mode === "individual" ? "선수명" : "학교명";
}

function getAddSetLabel() {
  return state.mode === "individual" ? "+ 세트" : "+ 출전 줄";
}

function getRemoveSetLabel() {
  return state.mode === "individual" ? "- 마지막 세트" : "- 마지막 줄";
}

function updateStateFromInput(input) {
  if (input.id === "titleInput") {
    state.title = input.value;
    fitTitleText();
    return;
  }

  if (input.id === "courtCountInput") {
    state.courtCount = normalizeCourtCount(input.value);
    state.courts = getCourtLabels(state.courtCount);
    ensureAllFixtureCounts();
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
  if (field === "playersA" || field === "playersB") {
    fixture.sets[setIndex][field] = input.value;
    return;
  }

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

    fixtureEl.querySelector(".record-a").textContent = result.complete ? `(${result.winner === "A" ? "승" : "패"})` : "( )";
    fixtureEl.querySelector(".record-b").textContent = result.complete ? `(${result.winner === "B" ? "승" : "패"})` : "( )";

    if (!result.complete) return;
    addStanding(standings, fixture.schoolA, result.winner === "A" ? "win" : "loss", result.setsA, result.setsB);
    addStanding(standings, fixture.schoolB, result.winner === "B" ? "win" : "loss", result.setsB, result.setsA);
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

  const winner = setWinsA > setWinsB ? "A" : "B";
  return {
    complete: Boolean(cleanName(fixture.schoolA) && cleanName(fixture.schoolB) && playedSets > 0 && setWinsA !== setWinsB),
    winner,
    setsA: setWinsA,
    setsB: setWinsB,
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

function normalizePlayerText(value) {
  if (Array.isArray(value)) {
    return value
      .map((player) => String(player ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }

  return String(value ?? "");
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

function normalizeCourts(courts, courtCount) {
  const labels = getCourtLabels(courtCount);
  const previous = Array.isArray(courts) ? courts : [];
  if (previous.length !== COURT_GROUP_COUNT) return labels;
  return labels.map((label, index) => cleanName(previous[index]) || label);
}

function ensureAllFixtureCounts() {
  state.matches.forEach((match) => ensureFixtureCount(match));
}

function ensureFixtureCount(match) {
  if (!Array.isArray(match.fixtures)) match.fixtures = [];
  while (match.fixtures.length < COURT_GROUP_COUNT) match.fixtures.push(createFixture());
  if (match.fixtures.length > COURT_GROUP_COUNT) match.fixtures = match.fixtures.slice(0, COURT_GROUP_COUNT);
}

function addStanding(map, school, result, setsFor, setsAgainst) {
  const name = cleanName(school);
  if (!name) return;
  const row = map.get(name) ?? { name, wins: 0, losses: 0, setsWon: 0, setsLost: 0 };
  if (result === "win") row.wins += 1;
  if (result === "loss") row.losses += 1;
  row.setsWon += setsFor;
  row.setsLost += setsAgainst;
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
    empty.innerHTML = `<td colspan="4" class="empty">${getCompetitorLabel()}과 점수를 입력하면 결과가 자동으로 표시됩니다.</td>`;
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
      <td>${row.wins}승 ${row.losses}패</td>
      <td>${row.setsWon}:${row.setsLost}</td>
    `;
    resultBody.appendChild(tr);
  });
}

function compareStanding(a, b) {
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (a.losses !== b.losses) return a.losses - b.losses;
  const setDiffA = a.setsWon - a.setsLost;
  const setDiffB = b.setsWon - b.setsLost;
  if (setDiffB !== setDiffA) return setDiffB - setDiffA;
  if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
  return a.name.localeCompare(b.name, "ko");
}

function rankRows(rows) {
  let lastScore = "";
  let rank = 0;
  return rows.map((row, index) => {
    const score = `${row.wins}/${row.losses}/${row.setsWon - row.setsLost}/${row.setsWon}`;
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
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
  updateStateFromInput(event.target);
  saveState();
  updateAllResults();
  fitEditableText(event.target);
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode === "individual" ? "individual" : "team";
    saveState();
    renderBoard();
  });
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".set-btn");
  if (!button) return;

  const { match, fixture, action } = button.dataset;
  const fixtureState = state.matches[Number(match)].fixtures[Number(fixture)];

  if (action === "add-set") {
    fixtureState.sets.push(createSet());
  }

  if (action === "remove-set") {
    if (fixtureState.sets.length > 1) {
      fixtureState.sets.pop();
    } else {
      fixtureState.sets[0] = createSet();
    }
  }

  saveState();
  renderBoard();
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

function fitTitleText() {
  const length = cleanName(titleInput.value || titleInput.placeholder).length;
  const size = Math.max(30, Math.min(72, 72 - Math.max(0, length - 14) * 1.45));
  titleInput.style.fontSize = `${size}px`;
  titleInput.style.height = "auto";
  titleInput.style.height = `${Math.min(156, titleInput.scrollHeight)}px`;
  titleInput.title = titleInput.value;
}

addMatchBtn.addEventListener("click", () => {
  state.matches.push(createMatch(state.matches.length));
  saveState();
  renderBoard();
  matchList.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
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
