const STORAGE_KEY = "personalTimer.v1";

const defaultState = () => ({
  startedAt: null,
  firstStartedAt: null,
  resets: []
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const resets = Array.isArray(parsed.resets) ? parsed.resets.filter(x => typeof x === "string") : [];
    const startedAt = typeof parsed.startedAt === "string" ? parsed.startedAt : null;
    return {
      startedAt,
      // v1からの移行対応。まだ一度もリセットしていない場合は、現在の開始日時を初回開始日時として引き継げる。
      // すでにリセット履歴がある旧データでは、最初の開始日時は保存されていなかったため復元できない。
      firstStartedAt: typeof parsed.firstStartedAt === "string"
        ? parsed.firstStartedAt
        : (resets.length === 0 ? startedAt : null),
      resets
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

// 生活上の「1日」は午前4時に切り替わる。
// 例: 9/28 02:30 のリセットは、記録上は 9/27 の出来事として扱う。
function eventDate(dateLike) {
  const date = new Date(dateLike);
  const adjusted = new Date(date);
  if (adjusted.getHours() < 4) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  return adjusted;
}

function formatEventDate(dateLike) {
  const date = eventDate(dateLike);
  const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(date);
  return `${date.getMonth() + 1}月${date.getDate()}日(${weekday})`;
}

function formatInterval(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "記録なし";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}日 ${hours}時間 ${minutes}分`;
  if (hours > 0) return `${hours}時間 ${minutes}分`;
  return `${minutes}分`;
}

function intervalBeforeReset(resetIso) {
  const ordered = state.resets
    .filter(x => typeof x === "string")
    .slice()
    .sort((a, b) => new Date(a) - new Date(b));

  const index = ordered.indexOf(resetIso);
  if (index < 0) return null;

  const previousIso = index > 0 ? ordered[index - 1] : state.firstStartedAt;
  if (!previousIso) return null;

  return new Date(resetIso).getTime() - new Date(previousIso).getTime();
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(date);
}

function resetsForMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return state.resets
    .map(iso => new Date(iso))
    .filter(d => {
      const event = eventDate(d);
      return event.getFullYear() === year && event.getMonth() === month;
    })
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

    const event = document.createElement("span");
    event.className = "record-date";
    event.textContent = formatEventDate(date);

    const interval = document.createElement("span");
    interval.className = "record-interval";
    interval.textContent = formatInterval(intervalBeforeReset(date.toISOString()));

    li.append(number, event, interval);
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
  const now = new Date().toISOString();
  state.startedAt = now;
  state.firstStartedAt = now;
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

    const resets = incoming.resets.filter(x => typeof x === "string");
    const startedAt = typeof incoming.startedAt === "string" ? incoming.startedAt : null;
    state = {
      startedAt,
      firstStartedAt: typeof incoming.firstStartedAt === "string"
        ? incoming.firstStartedAt
        : (resets.length === 0 ? startedAt : null),
      resets
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
