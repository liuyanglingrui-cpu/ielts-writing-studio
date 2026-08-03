import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the IELTS writing practice interface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>IELTS Writing Practice/);
  assert.match(html, /Writing Task 1/);
  assert.match(html, /Task <!-- -->2/);
  assert.match(html, /spellCheck="false"/);
  assert.match(html, /data-gramm_editor="false"/);
  assert.match(html, /仅保存在本机/);
  assert.doesNotMatch(html, /percentage of households with access to the Internet/i);
  assert.doesNotMatch(html, /university students should study whatever they like/i);
});

test("keeps both web and desktop defaults free of built-in questions", async () => {
  const [webPage, desktopQuestions, desktopExport] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../desktop/questions.js", import.meta.url), "utf8"),
    readFile(new URL("../desktop/docx-export.cjs", import.meta.url), "utf8"),
  ]);

  assert.equal((webPage.match(/prompt:\s*""/g) ?? []).length, 2);
  assert.equal((desktopQuestions.match(/prompt:\s*""/g) ?? []).length, 2);
  assert.match(webPage, /spellCheck=\{false\}/);
  assert.match(webPage, /autoCorrect="off"/);
  assert.match(desktopExport, /filter\(\(item\) => item\.task\?\.prompt\?\.trim\(\)\)/);
});
