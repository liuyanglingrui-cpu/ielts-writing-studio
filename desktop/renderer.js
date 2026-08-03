const STORAGE_KEY = "ielts-writing-studio-v2";
const INITIAL_SECONDS = 60 * 60;

function freshProject() {
  return JSON.parse(JSON.stringify(window.EMPTY_WRITING_PROJECT));
}

const state = {
  project: freshProject(),
  activeTask: "task1",
  answers: { task1: "", task2: "" },
  secondsLeft: INITIAL_SECONDS,
  running: false,
  showTime: true,
};

let draftTable = null;
let saveTimer;
let timerId;
let toastTimer;

const el = {
  currentSession: document.querySelector("#current-session-label"),
  projectTitle: document.querySelector("#project-title"),
  taskNumber: document.querySelector("#task-number"),
  taskLabel: document.querySelector("#task-label"),
  recommendation: document.querySelector("#recommendation"),
  recommendedTime: document.querySelector("#recommended-time"),
  questionCopy: document.querySelector("#question-copy"),
  questionVisual: document.querySelector("#question-visual"),
  emptyQuestionBtn: document.querySelector("#empty-question-btn"),
  answerInput: document.querySelector("#answer-input"),
  wordCount: document.querySelector("#word-count"),
  task1Count: document.querySelector("#task1-count"),
  task2Count: document.querySelector("#task2-count"),
  task1Status: document.querySelector("#task1-status"),
  task2Status: document.querySelector("#task2-status"),
  minimumHint: document.querySelector("#minimum-hint"),
  saveState: document.querySelector("#save-state"),
  timerDisplay: document.querySelector("#timer-display"),
  timerWrap: document.querySelector("#timer-wrap"),
  timerToggle: document.querySelector("#timer-toggle"),
  timerVisibility: document.querySelector("#timer-visibility"),
  saveBtn: document.querySelector("#save-btn"),
  exportBtn: document.querySelector("#export-btn"),
  customizeBtn: document.querySelector("#customize-btn"),
  resetBtn: document.querySelector("#reset-btn"),
  questionModal: document.querySelector("#question-modal"),
  customTask1: document.querySelector("#custom-task1"),
  customTask2: document.querySelector("#custom-task2"),
  tableBuilder: document.querySelector("#table-builder"),
  tableGrid: document.querySelector("#table-grid"),
  tableTitle: document.querySelector("#table-title"),
  addTable: document.querySelector("#add-table"),
  confirmModal: document.querySelector("#confirm-modal"),
  toast: document.querySelector("#toast"),
};

function currentTask(taskKey = state.activeTask) {
  return state.project.tasks[taskKey];
}

function countWords(value = "") {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function savedPayload() {
  return {
    version: 2,
    project: state.project,
    answers: state.answers,
    secondsLeft: state.secondsLeft,
    savedAt: new Date().toISOString(),
  };
}

function applySavedPayload(payload) {
  if (!payload || payload.version !== 2 || !payload.project?.tasks) return false;
  state.project = payload.project;
  state.answers = { task1: payload.answers?.task1 || "", task2: payload.answers?.task2 || "" };
  state.secondsLeft = Number.isFinite(payload.secondsLeft) ? Math.max(0, payload.secondsLeft) : INITIAL_SECONDS;
  state.running = false;
  return true;
}

async function loadSavedPractice() {
  if (window.writingStudio?.loadPractice) {
    const result = await window.writingStudio.loadPractice();
    if (result.status === "loaded" && applySavedPayload(result.data)) return;
  }
  try {
    applySavedPayload(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    // Invalid local data should not block a clean practice session.
  }
}

async function persistState({ manual = false } = {}) {
  const payload = savedPayload();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  let result = { status: "saved" };
  if (window.writingStudio?.savePractice) result = await window.writingStudio.savePractice(payload);

  const savedTime = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  if (result.status === "saved") {
    el.saveState.innerHTML = `<i></i> 已保存 ${savedTime}`;
    if (manual) showToast("练习已经保存到这台电脑。关闭应用后再次打开，内容仍会保留。", 4300);
  } else {
    el.saveState.innerHTML = "<i class=\"save-error\"></i> 保存失败";
    if (manual) showToast(`保存失败：${result.message || "未知错误"}`, 5000);
  }
}

function queueSave() {
  el.saveState.innerHTML = "<i></i> 正在保存…";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => persistState(), 500);
}

function renderQuestionCopy(task) {
  el.questionCopy.innerHTML = "";
  task.prompt.split(/\n+/).filter(Boolean).forEach((paragraph) => {
    const p = document.createElement("p");
    p.textContent = paragraph;
    el.questionCopy.appendChild(p);
  });
}

function renderTaskTable(visual) {
  el.questionVisual.innerHTML = "";
  if (visual?.type !== "table" || !visual.headers?.length) return;

  const title = document.createElement("p");
  title.className = "visual-title";
  title.textContent = visual.title || "Task data";
  el.questionVisual.appendChild(title);

  const table = document.createElement("table");
  table.className = "data-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  visual.headers.forEach((value) => {
    const th = document.createElement("th");
    th.textContent = value;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  (visual.rows || []).forEach((row) => {
    const tr = document.createElement("tr");
    visual.headers.forEach((_, index) => {
      const td = document.createElement("td");
      td.textContent = row[index] || "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  el.questionVisual.appendChild(table);
}

function renderTabs() {
  document.querySelectorAll(".task-tab").forEach((button) => {
    const active = button.dataset.task === state.activeTask;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  el.task1Count.textContent = currentTask("task1").prompt.trim() ? `${countWords(state.answers.task1)} words` : "未设置题目";
  el.task2Count.textContent = currentTask("task2").prompt.trim() ? `${countWords(state.answers.task2)} words` : "未设置题目";
}

function renderSidebar() {
  const task1Ready = Boolean(currentTask("task1").prompt.trim());
  const task2Ready = Boolean(currentTask("task2").prompt.trim());
  el.task1Status.textContent = task1Ready ? (currentTask("task1").visual ? "已添加题目和表格" : "已添加题目") : "尚未添加题目";
  el.task2Status.textContent = task2Ready ? "已添加题目" : "尚未添加题目";
  el.task1Status.classList.toggle("ready", task1Ready);
  el.task2Status.classList.toggle("ready", task2Ready);
  document.querySelectorAll(".task-setup-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.editTask === state.activeTask);
  });
}

function renderTask() {
  const task = currentTask();
  const number = state.activeTask === "task1" ? 1 : 2;
  const words = countWords(state.answers[state.activeTask]);
  const hasQuestion = Boolean(task.prompt.trim());

  el.currentSession.textContent = state.project.title || "我的 IELTS 写作练习";
  el.projectTitle.value = state.project.title || "";
  el.taskNumber.textContent = String(number);
  el.taskLabel.textContent = task.label;
  el.recommendation.textContent = task.recommendation;
  el.recommendedTime.textContent = number === 1 ? "20 min" : "40 min";
  el.answerInput.value = state.answers[state.activeTask] || "";
  el.answerInput.disabled = !hasQuestion;
  el.wordCount.innerHTML = `${words} <small>words</small>`;
  el.minimumHint.textContent = hasQuestion ? `Minimum ${task.minimum} words` : "请先添加题目";
  el.minimumHint.classList.toggle("met", hasQuestion && words >= task.minimum);
  el.emptyQuestionBtn.classList.toggle("hidden", hasQuestion);
  el.emptyQuestionBtn.querySelector("strong").textContent = `添加 Task ${number} 题目`;
  el.questionCopy.classList.toggle("hidden", !hasQuestion);
  el.questionVisual.classList.toggle("hidden", !hasQuestion || !task.visual);
  renderQuestionCopy(task);
  renderTaskTable(task.visual);
  renderTabs();
  renderSidebar();
}

function renderTimer() {
  el.timerDisplay.textContent = state.showTime ? formatTime(state.secondsLeft) : "––:––";
  el.timerWrap.classList.toggle("warning", state.secondsLeft <= 300);
  el.timerToggle.textContent = state.running ? "Pause" : state.secondsLeft === INITIAL_SECONDS ? "Start" : "Resume";
  el.timerToggle.disabled = state.secondsLeft === 0;
  el.timerVisibility.textContent = state.showTime ? "◉" : "○";
}

function renderAll() {
  renderTask();
  renderTimer();
}

function syncTimer() {
  window.clearInterval(timerId);
  if (!state.running || state.secondsLeft <= 0) return;
  timerId = window.setInterval(() => {
    state.secondsLeft = Math.max(0, state.secondsLeft - 1);
    if (state.secondsLeft === 0) {
      state.running = false;
      window.clearInterval(timerId);
      showToast("时间到。答案仍已保存在本机，你可以继续编辑或导出。", 5000);
    }
    renderTimer();
    if (state.secondsLeft % 15 === 0) queueSave();
  }, 1000);
}

function showToast(message, duration = 3500) {
  window.clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => el.toast.classList.add("hidden"), duration);
}

function openQuestionEditor(focusTask = state.activeTask) {
  state.activeTask = focusTask;
  el.customTask1.value = currentTask("task1").prompt;
  el.customTask2.value = currentTask("task2").prompt;
  draftTable = currentTask("task1").visual?.type === "table"
    ? JSON.parse(JSON.stringify(currentTask("task1").visual))
    : null;
  renderTableBuilder();
  el.questionModal.classList.remove("hidden");
  window.setTimeout(() => (focusTask === "task2" ? el.customTask2 : el.customTask1).focus(), 50);
}

function newDraftTable() {
  return {
    type: "table",
    title: "",
    headers: ["Category", "Value 1", "Value 2"],
    rows: [["Row 1", "", ""], ["Row 2", "", ""]],
  };
}

function renderTableBuilder() {
  const hasTable = Boolean(draftTable);
  el.tableBuilder.classList.toggle("hidden", !hasTable);
  el.addTable.classList.toggle("hidden", hasTable);
  el.tableGrid.innerHTML = "";
  if (!draftTable) return;
  el.tableTitle.value = draftTable.title || "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  draftTable.headers.forEach((value, columnIndex) => {
    const th = document.createElement("th");
    const input = document.createElement("input");
    input.value = value;
    input.placeholder = `Column ${columnIndex + 1}`;
    input.addEventListener("input", () => { draftTable.headers[columnIndex] = input.value; });
    th.appendChild(input);
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  draftTable.rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    draftTable.headers.forEach((_, columnIndex) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.value = row[columnIndex] || "";
      input.placeholder = rowIndex === 0 && columnIndex === 0 ? "输入数据" : "";
      input.addEventListener("input", () => { draftTable.rows[rowIndex][columnIndex] = input.value; });
      td.appendChild(input);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  el.tableGrid.appendChild(table);
}

function closeQuestionModal() {
  el.questionModal.classList.add("hidden");
}

document.querySelectorAll(".task-tab").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeTask = button.dataset.task;
    renderTask();
    if (!currentTask().prompt.trim()) return;
    el.answerInput.focus();
  });
});

document.querySelectorAll(".task-setup-card").forEach((button) => {
  button.addEventListener("click", () => openQuestionEditor(button.dataset.editTask));
});

el.emptyQuestionBtn.addEventListener("click", () => openQuestionEditor(state.activeTask));
el.customizeBtn.addEventListener("click", () => openQuestionEditor(state.activeTask));

el.answerInput.addEventListener("input", () => {
  state.answers[state.activeTask] = el.answerInput.value;
  const words = countWords(el.answerInput.value);
  el.wordCount.innerHTML = `${words} <small>words</small>`;
  el.minimumHint.classList.toggle("met", words >= currentTask().minimum);
  renderTabs();
  queueSave();
});

el.projectTitle.addEventListener("input", () => {
  state.project.title = el.projectTitle.value;
  el.currentSession.textContent = state.project.title || "我的 IELTS 写作练习";
  queueSave();
});

el.timerToggle.addEventListener("click", () => {
  if (state.secondsLeft === 0) return;
  state.running = !state.running;
  renderTimer();
  syncTimer();
});

el.timerVisibility.addEventListener("click", () => {
  state.showTime = !state.showTime;
  renderTimer();
});

el.saveBtn.addEventListener("click", async () => {
  el.saveBtn.disabled = true;
  await persistState({ manual: true });
  el.saveBtn.disabled = false;
});

document.querySelector("#modal-close").addEventListener("click", closeQuestionModal);
el.questionModal.addEventListener("mousedown", (event) => {
  if (event.target === el.questionModal) closeQuestionModal();
});

el.addTable.addEventListener("click", () => {
  draftTable = newDraftTable();
  renderTableBuilder();
});

el.tableTitle.addEventListener("input", () => {
  if (draftTable) draftTable.title = el.tableTitle.value;
});

document.querySelector("#add-row").addEventListener("click", () => {
  if (!draftTable || draftTable.rows.length >= 20) return;
  draftTable.rows.push(Array(draftTable.headers.length).fill(""));
  renderTableBuilder();
});

document.querySelector("#add-column").addEventListener("click", () => {
  if (!draftTable || draftTable.headers.length >= 8) return;
  draftTable.headers.push(`Value ${draftTable.headers.length}`);
  draftTable.rows.forEach((row) => row.push(""));
  renderTableBuilder();
});

document.querySelector("#remove-row").addEventListener("click", () => {
  if (!draftTable || draftTable.rows.length <= 1) return;
  draftTable.rows.pop();
  renderTableBuilder();
});

document.querySelector("#remove-column").addEventListener("click", () => {
  if (!draftTable || draftTable.headers.length <= 2) return;
  draftTable.headers.pop();
  draftTable.rows.forEach((row) => row.pop());
  renderTableBuilder();
});

document.querySelector("#remove-table").addEventListener("click", () => {
  draftTable = null;
  renderTableBuilder();
});

document.querySelector("#clear-prompts").addEventListener("click", () => {
  el.customTask1.value = "";
  el.customTask2.value = "";
  draftTable = null;
  renderTableBuilder();
});

document.querySelector("#save-prompts").addEventListener("click", () => {
  const task1Prompt = el.customTask1.value.trim();
  const task2Prompt = el.customTask2.value.trim();
  state.project.tasks.task1.prompt = task1Prompt;
  state.project.tasks.task1.visual = task1Prompt && draftTable
    ? { ...draftTable, title: el.tableTitle.value.trim(), headers: draftTable.headers.map((value, index) => value.trim() || `Column ${index + 1}`) }
    : null;
  state.project.tasks.task2.prompt = task2Prompt;
  state.project.tasks.task2.visual = null;
  closeQuestionModal();
  renderTask();
  persistState({ manual: true });
});

el.resetBtn.addEventListener("click", () => el.confirmModal.classList.remove("hidden"));
document.querySelector("#cancel-reset").addEventListener("click", () => el.confirmModal.classList.add("hidden"));
document.querySelector("#confirm-reset").addEventListener("click", () => {
  state.project = freshProject();
  state.answers = { task1: "", task2: "" };
  state.secondsLeft = INITIAL_SECONDS;
  state.running = false;
  state.activeTask = "task1";
  syncTimer();
  renderAll();
  persistState();
  el.confirmModal.classList.add("hidden");
  showToast("全部题目、表格、答案和计时已经清空。", 3500);
});

el.confirmModal.addEventListener("mousedown", (event) => {
  if (event.target === el.confirmModal) el.confirmModal.classList.add("hidden");
});

el.exportBtn.addEventListener("click", async () => {
  const hasQuestion = ["task1", "task2"].some((key) => currentTask(key).prompt.trim());
  if (!hasQuestion) {
    showToast("请先为 Task 1 或 Task 2 添加题目。没有题目时不会生成空白 Word。", 4800);
    return;
  }
  if (!window.writingStudio) {
    showToast("请在桌面应用中使用 Word 导出功能。", 4000);
    return;
  }
  await persistState();
  el.exportBtn.disabled = true;
  el.exportBtn.innerHTML = '<span class="export-icon">…</span> 正在生成';
  const result = await window.writingStudio.exportDocx({
    sessionTitle: state.project.title || "IELTS Writing Practice",
    exportedAt: new Date().toISOString(),
    tasks: state.project.tasks,
    answers: state.answers,
  });
  el.exportBtn.disabled = false;
  el.exportBtn.innerHTML = '<span class="export-icon">⇩</span> 导出 Word';
  if (result.status === "saved") showToast(`Word 文档已保存：${result.filePath}`, 6000);
  if (result.status === "error") showToast(`导出失败：${result.message}`, 6000);
});

document.querySelector("#minimize-btn").addEventListener("click", () => window.writingStudio?.minimize());
document.querySelector("#maximize-btn").addEventListener("click", () => window.writingStudio?.maximize());
document.querySelector("#close-btn").addEventListener("click", () => window.writingStudio?.close());

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "1") {
    event.preventDefault();
    state.activeTask = "task1";
    renderTask();
  }
  if (event.ctrlKey && event.key === "2") {
    event.preventDefault();
    state.activeTask = "task2";
    renderTask();
  }
  if (event.ctrlKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    persistState({ manual: true });
  }
  if (event.key === "Escape") {
    closeQuestionModal();
    el.confirmModal.classList.add("hidden");
  }
});

(async () => {
  await loadSavedPractice();
  renderAll();
})();
