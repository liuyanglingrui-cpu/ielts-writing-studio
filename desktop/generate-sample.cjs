const fs = require("node:fs/promises");
const path = require("node:path");
const { buildWritingDocx } = require("./docx-export.cjs");

const samplePayload = {
  sessionTitle: "Task 1 Table Practice",
  exportedAt: "2026-08-02T09:30:00+08:00",
  tasks: {
    task1: {
      label: "Writing Task 1",
      recommendation: "You should spend about 20 minutes on this task.",
      minimum: 150,
      prompt: "The table below shows the average number of hours per week that university students in four countries spent studying, working part-time and taking part in leisure activities in 2024.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
      visual: {
        type: "table",
        title: "Average weekly hours, 2024",
        headers: ["Country", "Study", "Part-time work", "Leisure"],
        rows: [
          ["Canada", "31", "12", "18"],
          ["Germany", "34", "9", "20"],
          ["Japan", "38", "7", "14"],
          ["Australia", "29", "15", "21"],
        ],
      },
    },
    task2: {
      label: "Writing Task 2",
      recommendation: "You should spend about 40 minutes on this task.",
      minimum: 250,
      prompt: "",
      visual: null,
    },
  },
  answers: {
    task1: "The table compares how students in four countries divided their weekly time among study, part-time employment and leisure in 2024. Overall, Japanese students spent the most time studying, while Australian students recorded the highest figures for both paid work and leisure.\n\nStudents in Japan studied for 38 hours per week, compared with 34 hours in Germany and 31 in Canada. Australia had the lowest study figure, at 29 hours. By contrast, Australian students worked part-time for 15 hours, which was more than double the Japanese figure of seven hours.\n\nLeisure time was highest in Australia and Germany, at 21 and 20 hours respectively. Canadian students spent 18 hours on leisure activities, whereas the corresponding figure for Japan was only 14 hours.",
    task2: "This answer must not appear because Task 2 has no question.",
  },
};

(async () => {
  const outDir = path.join(__dirname, "..", "work", "docx-qa-v2");
  await fs.mkdir(outDir, { recursive: true });
  const output = path.join(outDir, "Task1-Table-Only-Sample.docx");
  await fs.writeFile(output, await buildWritingDocx(samplePayload));
  console.log(output);
})();
