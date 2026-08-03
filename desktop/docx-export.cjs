const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");

const TEAL = "007D84";
const DARK_TEAL = "005E63";
const INK = "20272B";
const MUTED = "66747A";
const PALE_TEAL = "EDF6F5";
const PALE_GRAY = "F2F4F5";
const BORDER = "D7DEDF";
const CONTENT_WIDTH = 9360;

function wordCount(value = "") {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function textParagraph(text, options = {}) {
  return new Paragraph({
    spacing: { before: 0, after: options.after ?? 120, line: options.line ?? 300, lineRule: "auto" },
    alignment: options.alignment ?? AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: options.size ?? 22,
        color: options.color ?? INK,
        bold: options.bold ?? false,
        italics: options.italics ?? false,
      }),
    ],
  });
}

function questionCallout(task) {
  const paragraphs = task.prompt
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => textParagraph(line, { size: 21, after: 100, line: 290 }));

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    indent: { size: 120, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      left: { style: BorderStyle.SINGLE, size: 10, color: TEAL },
      right: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: BORDER },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: BORDER },
    },
    margins: { top: 160, bottom: 140, left: 220, right: 220 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: PALE_TEAL, color: "auto" },
            children: paragraphs,
          }),
        ],
      }),
    ],
  });
}

function taskDataTable(visual) {
  if (visual?.type !== "table" || !visual.headers?.length) return null;
  const columnCount = Math.max(1, visual.headers.length);
  const baseWidth = Math.floor(CONTENT_WIDTH / columnCount);
  const widths = Array.from({ length: columnCount }, (_, index) =>
    index === columnCount - 1 ? CONTENT_WIDTH - baseWidth * (columnCount - 1) : baseWidth,
  );

  const makeCell = (value, index, header = false) =>
    new TableCell({
      width: { size: widths[index], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: header ? TEAL : "FFFFFF", color: "auto" },
      children: [
        new Paragraph({
          alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
          spacing: { before: 0, after: 0, line: 280, lineRule: "auto" },
          children: [
            new TextRun({
              text: String(value ?? ""),
              font: "Arial",
              size: 19,
              color: header ? "FFFFFF" : INK,
              bold: header || index === 0,
            }),
          ],
        }),
      ],
    });

  return [
    textParagraph(visual.title || "Task data", { size: 20, color: DARK_TEAL, bold: true, after: 90 }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      indent: { size: 120, type: WidthType.DXA },
      layout: "fixed",
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        left: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        right: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      },
      margins: { top: 110, bottom: 110, left: 130, right: 130 },
      rows: [
        new TableRow({
          tableHeader: true,
          children: visual.headers.map((value, index) => makeCell(value, index, true)),
        }),
        ...(visual.rows || []).map((row) =>
          new TableRow({
            children: widths.map((_, index) => makeCell(row[index] ?? "", index, false)),
          }),
        ),
      ],
    }),
  ];
}

function answerParagraphs(answer) {
  const blocks = answer.split(/\n+/).map((value) => value.trim()).filter(Boolean);
  if (!blocks.length) {
    return [textParagraph("No answer entered.", { color: MUTED, italics: true, after: 120 })];
  }
  return blocks.map((block) => textParagraph(block, { size: 22, after: 160, line: 300 }));
}

function taskSection(task, answer, number, includeBreak) {
  const children = [];
  if (includeBreak) children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 200 },
      children: [new TextRun({ text: `Writing Task ${number}`, font: "Arial", size: 32, bold: true, color: TEAL })],
    }),
    textParagraph(task.recommendation, { size: 20, color: MUTED, italics: true, after: 160 }),
    questionCallout(task),
    ...(taskDataTable(task.visual) || []),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 120 },
      children: [new TextRun({ text: `Your answer  ·  ${wordCount(answer)} words`, font: "Arial", size: 26, bold: true, color: DARK_TEAL })],
    }),
    ...answerParagraphs(answer),
  );
  return children;
}

async function buildWritingDocx(payload) {
  const exportedAt = new Date(payload.exportedAt || Date.now());
  const includedTasks = [
    { key: "task1", number: 1, task: payload.tasks.task1, answer: payload.answers.task1 || "" },
    { key: "task2", number: 2, task: payload.tasks.task2, answer: payload.answers.task2 || "" },
  ].filter((item) => item.task?.prompt?.trim());
  if (!includedTasks.length) throw new Error("请先为 Task 1 或 Task 2 添加题目。");

  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        children: [new TextRun({ text: "IELTS WRITING STUDIO  |  PRACTICE EXPORT", font: "Arial", size: 16, bold: true, color: MUTED })],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: "Page ", font: "Arial", size: 17, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 17, color: MUTED }),
        ],
      }),
    ],
  });

  const children = [
    textParagraph("WRITING PRACTICE", { size: 18, color: TEAL, bold: true, after: 40 }),
    textParagraph(payload.sessionTitle || "IELTS Writing Practice", { size: 46, color: INK, bold: true, after: 70, line: 280 }),
    textParagraph("Computer-delivered practice · No grading · No autocorrection", { size: 22, color: MUTED, after: 220 }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      indent: { size: 120, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        left: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        right: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4680, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: PALE_GRAY, color: "auto" },
              children: [textParagraph("PRACTICE", { size: 16, color: MUTED, bold: true, after: 30 }), textParagraph(payload.sessionTitle || "My writing practice", { size: 20, bold: true, after: 0 })],
            }),
            new TableCell({
              width: { size: 4680, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: PALE_GRAY, color: "auto" },
              children: [textParagraph("EXPORTED", { size: 16, color: MUTED, bold: true, after: 30 }), textParagraph(exportedAt.toLocaleString("zh-CN"), { size: 20, bold: true, after: 0 })],
            }),
          ],
        }),
      ],
    }),
    ...includedTasks.flatMap((item, index) => taskSection(item.task, item.answer, item.number, index > 0)),
  ];

  const doc = new Document({
    creator: "IELTS Writing Studio",
    title: payload.sessionTitle || "IELTS Writing Practice",
    description: "IELTS writing practice export without grading or autocorrection.",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: INK },
          paragraph: { spacing: { after: 120, line: 300, lineRule: "auto" } },
        },
        heading1: { run: { font: "Arial", size: 32, bold: true, color: TEAL }, paragraph: { spacing: { before: 360, after: 200 } } },
        heading2: { run: { font: "Arial", size: 26, bold: true, color: DARK_TEAL }, paragraph: { spacing: { before: 280, after: 140 } } },
        heading3: { run: { font: "Arial", size: 24, bold: true, color: DARK_TEAL }, paragraph: { spacing: { before: 200, after: 100 } } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildWritingDocx };
