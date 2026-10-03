import type { ReactNode } from "react";

export type AnswerSource = { url: string; title?: string };

function inline(text: string, sources: AnswerSource[], animateWords = false): ReactNode[] {
    const pattern = /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[1-9]\d*\]|\*[^*\n]+\*)/g;
    const nodes: ReactNode[] = [];
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
        const value = match[0];
        const start = match.index ?? 0;
        if (start > cursor) nodes.push(...plainText(text.slice(cursor, start), cursor, animateWords));
        const markdownLink = value.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
        if (markdownLink) {
            nodes.push(<a key={start} href={markdownLink[2]} target="_blank" rel="noreferrer" className="text-zinc-100 underline decoration-white/25 underline-offset-4 transition hover:decoration-white/70">{markdownLink[1]}</a>);
        } else if (value.startsWith("**")) {
            nodes.push(<strong key={start} className="font-semibold text-zinc-100">{value.slice(2, -2)}</strong>);
        } else if (value.startsWith("~~")) {
            nodes.push(<del key={start} className="text-zinc-500">{value.slice(2, -2)}</del>);
        } else if (value.startsWith("`")) {
            nodes.push(<code key={start} className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-200">{value.slice(1, -1)}</code>);
        } else if (value.startsWith("*") && value.endsWith("*")) {
            nodes.push(<em key={start} className="text-zinc-200">{value.slice(1, -1)}</em>);
        } else {
            const index = Number(value.slice(1, -1)) - 1;
            const source = sources[index];
            nodes.push(source
                ? <a key={start} href={source.url} target="_blank" rel="noreferrer" title={source.title ?? source.url} className="mx-0.5 inline-flex min-w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-1.5 text-[10px] leading-5 text-zinc-300 no-underline transition hover:border-white/20 hover:bg-white/10">{index + 1}</a>
                : <sup key={start} className="text-zinc-500">{value}</sup>);
        }
        cursor = start + value.length;
    }
    if (cursor < text.length) nodes.push(...plainText(text.slice(cursor), cursor, animateWords));
    return nodes;
}

function plainText(text: string, offset: number, animateWords: boolean): ReactNode[] {
    if (!animateWords) return [text];

    return [...text.matchAll(/\S+|\s+/g)].map((match, index) => {
        const value = match[0];
        if (!value || /^\s+$/.test(value)) return value;
        const wordOffset = offset + (match.index ?? index);
        return (
            <span
                key={`word-${wordOffset}`}
                className="answer-word-in"
                style={{ animationDelay: `${(index % 4) * 18}ms` }}
            >
                {value}
            </span>
        );
    });
}

export function MarkdownAnswer({ content, sources = [], animateWords = false }: { content: string; sources?: AnswerSource[]; animateWords?: boolean }) {
    const lines = content.replace(/\r/g, "").split("\n");
    const blocks: ReactNode[] = [];
    let paragraph: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;
    let code: string[] | null = null;

    const flushParagraph = () => {
        if (!paragraph.length) return;
        blocks.push(<p key={`p-${blocks.length}`} className="mb-4 last:mb-0">{inline(paragraph.join(" "), sources, animateWords)}</p>);
        paragraph = [];
    };
    const flushList = () => {
        if (!list) return;
        const Tag = list.ordered ? "ol" : "ul";
        blocks.push(<Tag key={`l-${blocks.length}`} className={`mb-4 space-y-1.5 pl-6 marker:text-zinc-500 ${list.ordered ? "list-decimal" : "list-disc"}`}>{list.items.map((item, i) => <li key={i} className="pl-1">{inline(item, sources, animateWords)}</li>)}</Tag>);
        list = null;
    };

    const tableCells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    const isTableDivider = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex] ?? "";
        if (line.trim().startsWith("```")) {
            flushParagraph(); flushList();
            if (code) {
                blocks.push(<pre key={`c-${blocks.length}`} className="mb-4 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/30 p-4 text-sm leading-6"><code>{code.join("\n")}</code></pre>);
                code = null;
            } else code = [];
            continue;
        }
        if (code) { code.push(line); continue; }
        if (!line.trim()) { flushParagraph(); flushList(); continue; }

        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
            flushParagraph(); flushList();
            const level = (heading[1] ?? "##").length;
            const Tag = level <= 2 ? "h2" : "h3";
            const size = level === 1 ? "text-xl" : level <= 3 ? "text-base" : "text-sm";
            blocks.push(<Tag key={`h-${blocks.length}`} className={`mb-2 mt-6 ${size} font-semibold tracking-tight text-zinc-100 first:mt-0`}>{inline(heading[2] ?? "", sources, animateWords)}</Tag>);
            continue;
        }
        if (line.includes("|") && lines[lineIndex + 1] && isTableDivider(lines[lineIndex + 1] ?? "")) {
            flushParagraph(); flushList();
            const header = tableCells(line);
            lineIndex += 2;
            const rows: string[][] = [];
            while (lineIndex < lines.length && (lines[lineIndex] ?? "").includes("|")) {
                rows.push(tableCells(lines[lineIndex] ?? ""));
                lineIndex++;
            }
            lineIndex--;
            blocks.push(
                <div key={`t-${blocks.length}`} className="mb-5 overflow-x-auto rounded-xl border border-white/[0.08]">
                    <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                        <thead className="bg-white/[0.04] text-zinc-200"><tr>{header.map((cell, i) => <th key={i} className="border-b border-white/[0.08] px-3 py-2.5 font-medium">{inline(cell, sources, animateWords)}</th>)}</tr></thead>
                        <tbody>{rows.map((row, r) => <tr key={r} className="border-b border-white/[0.05] last:border-0">{header.map((_, c) => <td key={c} className="px-3 py-2.5 align-top text-zinc-400">{inline(row[c] ?? "", sources, animateWords)}</td>)}</tr>)}</tbody>
                    </table>
                </div>,
            );
            continue;
        }
        if (/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
            flushParagraph(); flushList();
            blocks.push(<hr key={`hr-${blocks.length}`} className="my-5 border-white/[0.08]" />);
            continue;
        }
        const item = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
        if (item) {
            flushParagraph();
            const ordered = Boolean(item[2]);
            if (list && list.ordered !== ordered) flushList();
            list ??= { ordered, items: [] };
            list.items.push(item[3] ?? "");
            continue;
        }
        const quote = line.match(/^>\s?(.*)$/);
        if (quote) {
            flushParagraph(); flushList();
            blocks.push(<blockquote key={`q-${blocks.length}`} className="mb-4 border-l-2 border-white/15 pl-4 text-zinc-400">{inline(quote[1] ?? "", sources, animateWords)}</blockquote>);
            continue;
        }
        flushList();
        paragraph.push(line.trim());
    }
    flushParagraph(); flushList();
    if (code) blocks.push(<pre key={`c-${blocks.length}`} className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/30 p-4 text-sm"><code>{code.join("\n")}</code></pre>);

    return <div className="answer-copy text-[15px] leading-7 text-zinc-300">{blocks}</div>;
}

export function parseAssistantSections(content: string) {
    const followUpStart = content.search(/<FOLLOW_UPS>/i);
    const answerPart = followUpStart === -1 ? content : content.slice(0, followUpStart);
    const answer = answerPart.replace(/<\/?ANSWER>/gi, "").trim();
    const followUpPart = followUpStart === -1 ? "" : content.slice(followUpStart);
    const followUps = [...followUpPart.matchAll(/<question>\s*([\s\S]*?)\s*<\/question>/gi)]
        .map((match) => (match[1] ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 4);
    return { answer, followUps };
}
