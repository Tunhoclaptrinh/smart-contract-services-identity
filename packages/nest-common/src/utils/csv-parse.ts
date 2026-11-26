/**
 * RFC 4180 reader for imports: quoted cells, doubled quotes, CRLF or LF, a leading UTF-8 byte order
 * mark; `;` is accepted as separator when the header has no comma (spreadsheets in vi-VN locale).
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const firstLine = input.slice(0, input.search(/\r?\n|$/));
  const sep = !firstLine.includes(",") && firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (quoted) throw new Error("INVALID_CSV");
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Blank lines (often at the end of a file) carry no record.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
