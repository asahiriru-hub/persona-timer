const STORAGE_KEY = "personalTimer.v1";

const defaultState = () => ({
  startedAt: null,
  resets: []
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
      resets: Array.isArray(parsed.resets) ? parsed.resets.filter(x => typeof x === "string") : []
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let viewedMonth = new Date();
viewedMonth.setDate(1);
viewedMonth.setHours(0, 0, 0, 0);

const $ = (id) => document.getElementById(id);
const elapsedTime = $("elapsedTime");
const startedAt = $("startedAt");
const startButton = $("startButton");
const resetButton = $("resetButton");
const recordsButton = $("recordsButton");
const monthSummaryButton = $("monthSummaryButton");
const timerView = $("timerView");
const recordsView = $("recordsView");
const backButton = $("backButton");
const currentMonthLabel = $("currentMonthLabel");
const currentMonthCount = $("currentMonthCount");
const recordsMonthLabel = $("recordsMonthLabel");
const recordsMonthCount = $("recordsMonthCount");
const recordsList = $("recordsList");
const emptyRecords = $("emptyRecords");
const prevMonth = $("prevMonth");
const nextMonth = $("nextMonth");
const resetDialog = $("resetDialog");
const confirmReset = $("confirmReset");
const exportButton = $("exportButton");
const importInput = $("importInput");

function formatElapsed(ms) {
  ms = Math.max(0, ms);
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}日 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(iso) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(new Date(iso));
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(date);
}

function resetsForMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return state.resets
    .map(iso => new Date(iso))
    .filter(d => d.getFullYear() === year && d.getMonth() === month)
    .sort((a, b) => b - a);
}

function updateTimer() {
  if (!state.startedAt) {
    elapsedTime.textContent = "未開始";
    startedAt.textContent = "「オナ禁開始」を押すと計測を始めます。";
    startButton.classList.remove("hidden");
    resetButton.classList.add("hidden");
    return;
  }

  const start = new Date(state.startedAt);
  elapsedTime.textContent = formatElapsed(Date.now() - start.getTime());
  startedAt.textContent = `${formatDateTime(state.startedAt)} から継続中`;
  startButton.classList.add("hidden");
  resetButton.classList.remove("hidden");
}

function updateCurrentMonthSummary() {
  const now = new Date();
  currentMonthLabel.textContent = monthLabel(now);
  currentMonthCount.textContent = `${resetsForMonth(now).length}回`;
}

function renderRecords() {
  const resets = resetsForMonth(viewedMonth);
  recordsMonthLabel.textContent = monthLabel(viewedMonth);
  recordsMonthCount.textContent = `${resets.length}回`;
  recordsList.innerHTML = "";

  resets.forEach((date, index) => {
    const li = document.createElement("li");
    const number = document.createElement("span");
    number.className = "record-index";
    number.textContent = `${resets.length - index}.`;

    const time = document.createElement("time");
    time.dateTime = date.toISOString();
    time.textContent = new Intl.DateTimeFormat("ja-JP", {
      month: "numeric", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(date);

    li.append(number, time);
    recordsList.appendChild(li);
  });

  emptyRecords.hidden = resets.length > 0;
}

function openRecords(useCurrentMonth = false) {
  if (useCurrentMonth) {
    viewedMonth = new Date();
    viewedMonth.setDate(1);
    viewedMonth.setHours(0, 0, 0, 0);
  }
  timerView.classList.remove("active");
  recordsView.classList.add("active");
  renderRecords();
}

function openTimer() {
  recordsView.classList.remove("active");
  timerView.classList.add("active");
  updateTimer();
  updateCurrentMonthSummary();
}

startButton.addEventListener("click", () => {
  state.startedAt = new Date().toISOString();
  saveState();
  updateTimer();
});

resetButton.addEventListener("click", () => {
  if (typeof resetDialog.showModal === "function") {
    resetDialog.showModal();
  } else if (confirm("現在時刻を記録してタイマーをリセットしますか？")) {
    performReset();
  }
});

confirmReset.addEventListener("click", (event) => {
  event.preventDefault();
  performReset();
  resetDialog.close();
});

function performReset() {
  const now = new Date().toISOString();
  state.resets.push(now);
  state.startedAt = now;
  saveState();
  updateTimer();
  updateCurrentMonthSummary();
}

recordsButton.addEventListener("click", () => openRecords(false));
monthSummaryButton.addEventListener("click", () => openRecords(true));
backButton.addEventListener("click", openTimer);

prevMonth.addEventListener("click", () => {
  viewedMonth.setMonth(viewedMonth.getMonth() - 1);
  renderRecords();
});

nextMonth.addEventListener("click", () => {
  viewedMonth.setMonth(viewedMonth.getMonth() + 1);
  renderRecords();
});

exportButton.addEventListener("click", () => {
  const payload = {
    app: "personal-timer",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `timer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const incoming = parsed?.data ?? parsed;
    if (!incoming || !Array.isArray(incoming.resets)) throw new Error("invalid backup");

    const ok = confirm("現在の記録を読み込んだバックアップで置き換えます。よろしいですか？");
    if (!ok) return;

    state = {
      startedAt: typeof incoming.startedAt === "string" ? incoming.startedAt : null,
      resets: incoming.resets.filter(x => typeof x === "string")
    };
    saveState();
    updateTimer();
    updateCurrentMonthSummary();
    renderRecords();
    alert("バックアップを読み込みました。");
  } catch {
    alert("このファイルは読み込めませんでした。");
  } finally {
    importInput.value = "";
  }
});

updateTimer();
updateCurrentMonthSummary();
setInterval(updateTimer, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
