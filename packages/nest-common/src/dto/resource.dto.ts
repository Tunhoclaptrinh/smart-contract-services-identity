import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/** Largest batch an import or a bulk delete accepts. */
export const MAX_BATCH = 500;

/**
 * Query of `GET /resources/:resource`. The pipe checks the shape (first layer); BaseService checks
 * the meaning against resources.json (which fields may be filtered or sorted).
 */
export class ListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "Words to find; accents and case ignored",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ default: "createdAt" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sortBy?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";

  @ApiPropertyOptional({
    description:
      'JSON: {"kind":"BUYER"}, {"kind":["A","B"]} or operators {"amount":{"gte":1,"lte":9}}',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  filters?: string;

  @ApiPropertyOptional({
    description: "Comma-separated field keys to return, in order",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  columns?: string;

  @ApiPropertyOptional({
    description: "Comma-separated select/boolean/ref fields to count values of",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  facets?: string;
}

export const IMPORT_MODES = [
  "all-or-nothing",
  "skip-invalid",
  "upsert",
] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

/**
 * An import: rows as JSON objects (`items`) or a CSV text (`csv`, first line = headers matched to a
 * field key or label, or through `mapping`). `mode` decides what happens to invalid rows.
 */
export class ImportBodyDto {
  @ApiPropertyOptional({
    type: "array",
    items: { type: "object" },
    maxItems: MAX_BATCH,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH)
  @IsObject({ each: true })
  items?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: "CSV text, UTF-8, header row first" })
  @IsOptional()
  @IsString()
  @MaxLength(3_000_000)
  csv?: string;

  @ApiPropertyOptional({
    description: 'Header → field key, e.g. {"Tên công ty":"name"}',
  })
  @IsOptional()
  @IsObject()
  mapping?: Record<string, string>;

  @ApiPropertyOptional({ enum: IMPORT_MODES, default: "all-or-nothing" })
  @IsOptional()
  @IsIn(IMPORT_MODES)
  mode?: ImportMode;

  @ApiPropertyOptional({
    description: "Unique field that finds the record to update (upsert)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  key?: string;
}

export class BulkDeleteDto {
  @ApiProperty({ type: [String], maxItems: MAX_BATCH })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH)
  @IsString({ each: true })
  ids!: string[];
}

export class ExportQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ["csv", "json", "xlsx"], default: "csv" })
  @IsOptional()
  @IsIn(["csv", "json", "xlsx"])
  format?: string;

  @ApiPropertyOptional({ enum: ["key", "label"], default: "key" })
  @IsOptional()
  @IsIn(["key", "label"])
  header?: "key" | "label";
}

export class TemplateQueryDto {
  @ApiPropertyOptional({ enum: ["key", "label"], default: "key" })
  @IsOptional()
  @IsIn(["key", "label"])
  header?: "key" | "label";
}
