"use client";

import { useEffect, useMemo, useState } from "react";

type TaskKey = "task1" | "task2";

type PracticeTask = {
  label: string;
  recommendation: string;
  prompt: string;
};

const INITIAL_SECONDS = 60 * 60;

const defaultTasks: Record<TaskKey, PracticeTask> = {
  task1: {
    label: "Writing Task 1",
    recommendation: "You should spend about 20 minutes on this task.",
    prompt: "",
  },
  task2: {
    label: "Writing Task 2",
    recommendation: "You should spend about 40 minutes on this task.",
    prompt: "",
  },
};

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function Home() {
  const [activeTask, setActiveTask] = useState<TaskKey>("task1");
  const [answers, setAnswers] = useState<Record<TaskKey, string>>({
    task1: "",
    task2: "",
  });
  const [tasks, setTasks] = useState(defaultTasks);
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);
  const [running, setRunning] = useState(false);
  const [showTime, setShowTime] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    try {
      const storedAnswers = localStorage.getItem("ielts-writing-answers");
      const storedTasks = localStorage.getItem("ielts-writing-tasks");
      if (storedAnswers) setAnswers(JSON.parse(storedAnswers));
      if (storedTasks) setTasks(JSON.parse(storedTasks));
    } catch {
      // A malformed old draft should never stop a new practice session.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("ielts-writing-answers", JSON.stringify(answers));
    localStorage.setItem("ielts-writing-tasks", JSON.stringify(tasks));
    setSavedAt(
      new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
    );
  }, [answers, tasks, ready]);

  useEffect(() => {
    if (!running || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0) setRunning(false);
  }, [secondsLeft]);

  const wordCounts = useMemo(
    () => ({
      task1: countWords(answers.task1),
      task2: countWords(answers.task2),
    }),
    [answers],
  );

  const currentTask = tasks[activeTask];

  function resetPractice() {
    setAnswers({ task1: "", task2: "" });
    setSecondsLeft(INITIAL_SECONDS);
    setRunning(false);
    setActiveTask("task1");
    setResetOpen(false);
  }

  function downloadAnswers() {
    const content = [
      "IELTS Writing Practice",
      `Saved: ${new Date().toLocaleString("zh-CN")}`,
      "",
      "=== WRITING TASK 1 ===",
      answers.task1 || "(No answer)",
      "",
      "=== WRITING TASK 2 ===",
      answers.task2 || "(No answer)",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ielts-writing-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="exam-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">I</span>
          <div>
            <p>IELTS Writing</p>
            <span>Practice test</span>
          </div>
        </div>

        <div className={`timer ${secondsLeft <= 300 ? "timer-warning" : ""}`}>
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowTime((current) => !current)}
            aria-label={showTime ? "Hide remaining time" : "Show remaining time"}
          >
            {showTime ? "◉" : "○"}
          </button>
          <div>
            <span>Time left</span>
            <strong>{showTime ? formatTime(secondsLeft) : "– – : – –"}</strong>
          </div>
          <button
            className="timer-control"
            type="button"
            onClick={() => setRunning((current) => !current)}
            disabled={secondsLeft === 0}
          >
            {running ? "Pause" : secondsLeft === INITIAL_SECONDS ? "Start" : "Resume"}
          </button>
        </div>

        <div className="header-actions">
          <span className="save-status">{savedAt ? `已保存 ${savedAt}` : "仅保存在本机"}</span>
          <button type="button" className="header-link" onClick={() => setEditorOpen(true)}>
            题目设置
          </button>
          <button type="button" className="finish-button" onClick={downloadAnswers}>
            导出答案
          </button>
        </div>
      </header>

      <section className="workspace" aria-label={`${currentTask.label} workspace`}>
        <aside className="question-panel">
          <div className="panel-title">
            <span className="task-number">{activeTask === "task1" ? "1" : "2"}</span>
            <div>
              <h1>{currentTask.label}</h1>
              <p>{currentTask.recommendation}</p>
            </div>
          </div>
          <div className="question-copy">
            {currentTask.prompt.split("\n").map((paragraph, index) =>
              paragraph ? <p key={`${paragraph}-${index}`}>{paragraph}</p> : <br key={index} />,
            )}
          </div>
          <div className="practice-note">
            <span aria-hidden="true">i</span>
            <p>这是纯写作练习。系统不会批改、纠错或给出写作建议。</p>
          </div>
        </aside>

        <section className="answer-panel">
          <div className="answer-heading">
            <div>
              <h2>Your answer</h2>
              <p>Type your answer in the box below.</p>
            </div>
            <span>{wordCounts[activeTask]} words</span>
          </div>
          <textarea
            value={answers[activeTask]}
            onChange={(event) =>
              setAnswers((current) => ({ ...current, [activeTask]: event.target.value }))
            }
            aria-label={`Answer for ${currentTask.label}`}
            placeholder=""
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-ms-editor="false"
          />
          <div className="correction-off">
            <span aria-hidden="true">✓</span>
            拼写检查、自动纠错、自动大写与语法建议均已关闭
          </div>
        </section>
      </section>

      <footer className="taskbar">
        <div className="task-tabs" role="tablist" aria-label="Writing tasks">
          {(["task1", "task2"] as TaskKey[]).map((taskKey) => (
            <button
              key={taskKey}
              type="button"
              role="tab"
              aria-selected={activeTask === taskKey}
              className={activeTask === taskKey ? "active" : ""}
              onClick={() => setActiveTask(taskKey)}
            >
              <span>{taskKey === "task1" ? "1" : "2"}</span>
              <div>
                <strong>Task {taskKey === "task1" ? "1" : "2"}</strong>
                <small>{wordCounts[taskKey]} words</small>
              </div>
            </button>
          ))}
        </div>
        <button type="button" className="reset-link" onClick={() => setResetOpen(true)}>
          重新开始
        </button>
      </footer>

      {editorOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditorOpen(false)}>
          <section className="modal question-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <span>练习设置</span>
                <h2 id="editor-title">替换本次练习题</h2>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-description">把自己的 Task 1 和 Task 2 题目粘贴进来。内容只保存在这台设备的浏览器中。</p>
            {(["task1", "task2"] as TaskKey[]).map((taskKey) => (
              <label className="prompt-field" key={taskKey}>
                <span>{tasks[taskKey].label}</span>
                <textarea
                  value={tasks[taskKey].prompt}
                  onChange={(event) =>
                    setTasks((current) => ({
                      ...current,
                      [taskKey]: { ...current[taskKey], prompt: event.target.value },
                    }))
                  }
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  autoComplete="off"
                />
              </label>
            ))}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setTasks(defaultTasks)}>恢复示例题</button>
              <button type="button" className="primary-button" onClick={() => setEditorOpen(false)}>完成</button>
            </div>
          </section>
        </div>
      )}

      {resetOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setResetOpen(false)}>
          <section className="modal reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="warning-icon" aria-hidden="true">!</div>
            <h2 id="reset-title">重新开始练习？</h2>
            <p>两道题的答案和当前计时将被清空。你设置的题目会保留。</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setResetOpen(false)}>取消</button>
              <button type="button" className="danger-button" onClick={resetPractice}>清空并重新开始</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
