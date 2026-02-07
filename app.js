"use strict";

/**
 * Forest Memory – Valea Doftanei
 * - 3 difficulties
 * - timer + moves
 * - best time per difficulty (localStorage)
 * - medals per difficulty based on time thresholds (simple + transparent)
 */

const $ = (s) => document.querySelector(s);

const boardEl = $("#board");
const timeEl = $("#time");
const movesEl = $("#moves");
const bestEl = $("#best");
const foundEl = $("#found");
const totalEl = $("#total");
const difficultyLabelEl = $("#difficultyLabel");

const btnNew = $("#btnNew");
const btnHow = $("#btnHow");
const btnShare = $("#btnShare");
const btnResetBest = $("#btnResetBest");

const modal = $("#modal");
const btnCloseModal = $("#btnCloseModal");

const medalEasy = $("#medal-easy");
const medalMedium = $("#medal-medium");
const medalHard = $("#medal-hard");

const levelBtns = Array.from(document.querySelectorAll(".levelBtn"));

const ICONS = [
  { key: "brad", emoji: "🌲", name: "Brad" },
  { key: "planta", emoji: "🌿", name: "Plantă" },
  { key: "ciuperca", emoji: "🍄", name: "Ciupercă" },
  { key: "floare", emoji: "🌼", name: "Floare" },
  { key: "frunza", emoji: "🍃", name: "Frunză" },
  { key: "castan", emoji: "🌰", name: "Castan" },
  { key: "munte", emoji: "⛰️", name: "Munte" },
  { key: "picatura", emoji: "💧", name: "Apă" },
  { key: "pasare", emoji: "🐦", name: "Pasăre" },
  { key: "stea", emoji: "✨", name: "Sclipici" },
  { key: "soare", emoji: "☀️", name: "Soare" },
  { key: "luna", emoji: "🌙", name: "Lună" },
];

const DIFFICULTIES = {
  easy:   { pairs: 6, label: "Ușor",  colsDesktop: 4, colsMobile: 3, medal: { gold: 45, silver: 70, bronze: 95 } },
  medium: { pairs: 8, label: "Mediu", colsDesktop: 4, colsMobile: 3, medal: { gold: 75, silver: 110, bronze: 150 } },
  hard:   { pairs:10, label: "Greu",  colsDesktop: 5, colsMobile: 3, medal: { gold: 110, silver: 165, bronze: 220 } },
};

let state = {
  difficulty: "easy",
  tiles: [],
  flipped: [],
  matchedCount: 0,
  moves: 0,
  startedAt: null,
  timerId: null,
  locked: false,
};

function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pad2(n){ return String(n).padStart(2, "0"); }
function formatTime(totalSeconds){
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function nowMs(){ return Date.now(); }

function getBestKey(d){ return `forest_memory_best_${d}`; }
function getMedalKey(d){ return `forest_memory_medal_${d}`; }

function loadBest(difficulty){
  const raw = localStorage.getItem(getBestKey(difficulty));
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function saveBest(difficulty, seconds){
  localStorage.setItem(getBestKey(difficulty), String(seconds));
}

function loadMedal(difficulty){
  return localStorage.getItem(getMedalKey(difficulty)) || "—";
}

function saveMedal(difficulty, medal){
  localStorage.setItem(getMedalKey(difficulty), medal);
}

function medalForTime(difficulty, seconds){
  const t = DIFFICULTIES[difficulty].medal;
  if (seconds <= t.gold) return "🥇 Aur";
  if (seconds <= t.silver) return "🥈 Argint";
  if (seconds <= t.bronze) return "🥉 Bronz";
  return "🌿 Practică";
}

function renderMeta(){
  const d = state.difficulty;
  difficultyLabelEl.textContent = DIFFICULTIES[d].label;

  const best = loadBest(d);
  bestEl.textContent = best ? formatTime(best) : "—";

  medalEasy.textContent = loadMedal("easy");
  medalMedium.textContent = loadMedal("medium");
  medalHard.textContent = loadMedal("hard");
}

function setBoardColumns(){
  // CSS grid columns responsive; prefer keeping it "clean" without overlap
  const isMobile = window.matchMedia("(max-width: 520px)").matches;
  const d = DIFFICULTIES[state.difficulty];
  const cols = isMobile ? d.colsMobile : d.colsDesktop;
  boardEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
}

function resetTimer(){
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
  state.startedAt = null;
  timeEl.textContent = "00:00";
}

function startTimerIfNeeded(){
  if (state.startedAt) return;
  state.startedAt = nowMs();
  state.timerId = setInterval(() => {
    const sec = Math.floor((nowMs() - state.startedAt) / 1000);
    timeEl.textContent = formatTime(sec);
  }, 250);
}

function stopTimer(){
  if (!state.startedAt) return 0;
  const sec = Math.floor((nowMs() - state.startedAt) / 1000);
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
  return sec;
}

function buildTiles(){
  const pairs = DIFFICULTIES[state.difficulty].pairs;
  const pick = shuffle(ICONS).slice(0, pairs);

  // duplicate for pairs
  const doubled = shuffle([...pick, ...pick].map((x, idx) => ({
    id: `${x.key}_${idx}`,
    key: x.key,
    emoji: x.emoji,
    name: x.name
  })));

  state.tiles = doubled;
  state.flipped = [];
  state.matchedCount = 0;
  state.moves = 0;
  state.locked = false;

  movesEl.textContent = "0";
  foundEl.textContent = "0";
  totalEl.textContent = String(pairs);
}

function tileTemplate(tile){
  // back shows a subtle symbol to entice tapping
  return `
    <button class="tile" data-id="${tile.id}" data-key="${tile.key}" aria-label="Carte">
      <div class="tileInner">
        <div class="face back">🍀</div>
        <div class="face front" aria-hidden="true">${tile.emoji}</div>
      </div>
    </button>
  `;
}

function renderBoard(){
  boardEl.innerHTML = state.tiles.map(tileTemplate).join("");
}

function getTileElById(id){
  return boardEl.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);
}

function flipUp(tileEl){
  tileEl.classList.add("flipped");
  tileEl.setAttribute("aria-label", "Carte întoarsă");
}

function flipDown(tileEl){
  tileEl.classList.remove("flipped");
  tileEl.setAttribute("aria-label", "Carte");
}

function markMatched(tileEl){
  tileEl.classList.add("matched");
  tileEl.setAttribute("aria-label", "Pereche găsită");
}

function bumpWin(){
  // tiny celebratory effect without canvas/confetti dependencies
  document.documentElement.animate(
    [{ filter: "brightness(1)" }, { filter: "brightness(1.08)" }, { filter: "brightness(1)" }],
    { duration: 420, easing: "ease-out" }
  );
}

function onTileClick(e){
  const btn = e.target.closest(".tile");
  if (!btn) return;
  if (state.locked) return;

  const id = btn.getAttribute("data-id");
  const key = btn.getAttribute("data-key");

  // ignore already flipped / matched
  if (btn.classList.contains("flipped") || btn.classList.contains("matched")) return;

  startTimerIfNeeded();
  flipUp(btn);
  state.flipped.push({ id, key });

  if (state.flipped.length < 2) return;

  state.moves += 1;
  movesEl.textContent = String(state.moves);

  const [a,b] = state.flipped;
  state.locked = true;

  const aEl = getTileElById(a.id);
  const bEl = getTileElById(b.id);

  if (a.key === b.key){
    // matched
    setTimeout(() => {
      markMatched(aEl);
      markMatched(bEl);
      state.matchedCount += 1;
      foundEl.textContent = String(state.matchedCount);
      state.flipped = [];
      state.locked = false;

      const pairs = DIFFICULTIES[state.difficulty].pairs;
      if (state.matchedCount >= pairs){
        const seconds = stopTimer();
        bumpWin();
        onWin(seconds);
      }
    }, 220);
  } else {
    // not matched
    setTimeout(() => {
      flipDown(aEl);
      flipDown(bEl);
      state.flipped = [];
      state.locked = false;
    }, 520);
  }
}

function onWin(seconds){
  const d = state.difficulty;
  const prevBest = loadBest(d);
  const isNewBest = !prevBest || seconds < prevBest;

  const medal = medalForTime(d, seconds);
  saveMedal(d, medal);

  if (isNewBest) saveBest(d, seconds);

  renderMeta();

  // Friendly alert (simple, reliable)
  const msg = [
    `Bravo! Ai terminat nivelul "${DIFFICULTIES[d].label}" în ${formatTime(seconds)}.`,
    isNewBest ? `New Best! 🏆` : `Best-ul rămâne ${formatTime(prevBest)}.`,
    `Medalie: ${medal}`
  ].join("\n");

  setTimeout(() => alert(msg), 60);
}

function newGame(){
  resetTimer();
  buildTiles();
  renderBoard();
  renderMeta();
  setBoardColumns();
}

function setDifficulty(d){
  if (!DIFFICULTIES[d]) return;
  state.difficulty = d;

  levelBtns.forEach(b => b.classList.toggle("active", b.dataset.difficulty === d));
  newGame();
}

function openModal(){
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(){
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function resetBest(){
  const d = state.difficulty;
  localStorage.removeItem(getBestKey(d));
  localStorage.removeItem(getMedalKey(d));
  renderMeta();
  alert(`Resetat best + medalie pentru "${DIFFICULTIES[d].label}".`);
}

async function share(){
  const d = state.difficulty;
  const best = loadBest(d);
  const medal = loadMedal(d);
  const text = `Forest Memory (Valea Doftanei) • Nivel: ${DIFFICULTIES[d].label}\nBest: ${best ? formatTime(best) : "—"} • Medalie: ${medal}\n🌲🌿🍄`;

  try{
    if (navigator.share){
      await navigator.share({
        title: "Forest Memory – Valea Doftanei",
        text
      });
    } else {
      await navigator.clipboard.writeText(text);
      alert("Am copiat un mesaj în clipboard ✅");
    }
  } catch (err){
    // user canceled share or clipboard denied
    console.log(err);
  }
}

function wire(){
  boardEl.addEventListener("click", onTileClick);
  btnNew.addEventListener("click", newGame);
  btnHow.addEventListener("click", openModal);
  btnCloseModal.addEventListener("click", closeModal);
  btnShare.addEventListener("click", share);
  btnResetBest.addEventListener("click", resetBest);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  levelBtns.forEach(b => b.addEventListener("click", () => setDifficulty(b.dataset.difficulty)));

  window.addEventListener("resize", setBoardColumns);
}

(function init(){
  wire();
  newGame();
})();