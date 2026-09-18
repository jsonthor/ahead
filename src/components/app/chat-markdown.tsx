import type { ReactNode } from "react";

const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function tidyCitations(text: string) {
  return text
    .replace(new RegExp(`\\s*\\(activity\\s+\`?${UUID.source}\`?\\)`, "gi"), "")
    .replace(new RegExp(`\\s*\`?${UUID.source}\`?`, "gi"), "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function renderInline(text: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-medium text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      const inner = token.slice(1, -1);
      if (!UUID.test(inner)) {
        nodes.push(
          <span key={key} className="font-medium text-ink">
            {inner}
          </span>,
        );
      }
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    key += 1;
    last = match.index + token.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

function toBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    const joined = paragraph.join(" ").trim();
    if (joined) {
      blocks.push({ type: "p", text: joined });
    }
    paragraph = [];
  }

  function flushList() {
    if (list.length > 0) {
      blocks.push({ type: "ul", items: list });
    }
    list = [];
  }

  for (const line of lines) {
    const item = line.match(/^\s*[-*]\s+(.+)$/) ?? line.match(/^\s*\d+\.\s+(.+)$/);
    if (item) {
      flushParagraph();
      list.push(item[1]);
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = toBlocks(tidyCitations(text));
  return (
    <div className="mt-1 grid gap-2 text-sm leading-6 text-ink">
      {blocks.map((block, index) =>
        block.type === "ul" ? (
          <ul key={index} className="grid list-disc gap-1 pl-4 marker:text-muted">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{renderInline(block.text)}</p>
        ),
      )}
    </div>
  );
}
