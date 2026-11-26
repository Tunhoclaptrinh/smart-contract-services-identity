import ExcelJS from "exceljs";
import { safeCell } from "./csv";

/**
 * One-sheet workbook: bold frozen header, auto filter, column widths from the content. Text cells go
 * through the same formula guard as CSV; numbers and booleans keep their type.
 */
export async function toXlsx(
  sheetName: string,
  titles: string[],
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.created = new Date();
  const sheet = book.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow(titles).font = { bold: true };
  for (const row of rows)
    sheet.addRow(
      columns.map((c) => {
        const value = row[c];
        if (typeof value === "number" || typeof value === "boolean")
          return value;
        return value === null || value === undefined
          ? ""
          : safeCell(String(value));
      }),
    );
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, titles.length) },
  };
  sheet.columns.forEach((column, i) => {
    const longest = Math.max(
      titles[i]?.length ?? 0,
      ...rows.slice(0, 200).map((r) => String(r[columns[i]] ?? "").length),
    );
    column.width = Math.min(60, Math.max(8, longest + 2));
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}
