/**
 * RFC 4180 CSV with a UTF-8 byte order mark so spreadsheet apps read Vietnamese text.
 * Cells starting with = + - @, tab or carriage return are prefixed with ' to stop formula injection
 * (OWASP CSV injection).
 */
/** A cell a spreadsheet will not run as a formula. */
export function safeCell(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function toCsv(
  columns: string[],
  rows: Record<string, unknown>[],
): string {
  const cell = (value: unknown) => {
    let text = value === null || value === undefined ? "" : String(value);
    text = safeCell(text);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    columns.map(cell).join(","),
    ...rows.map((row) => columns.map((c) => cell(row[c])).join(",")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/**
 * Attachment header with an ASCII fallback and the UTF-8 name (RFC 6266 / RFC 5987), so a
 * Vietnamese file name survives every browser.
 */
export function attachmentHeader(fileName: string): string {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** `name_20261126-2208` in the server's UTC clock, for export and template file names. */
export function stampedName(base: string, now = new Date()): string {
  const iso = now.toISOString();
  return `${base}_${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 16).replace(":", "")}`;
}
