import {
  BadRequestException,
  HttpStatus,
  ValidationPipe,
  type ValidationError,
} from "@nestjs/common";

/**
 * Error bodies follow RFC 9457 (application/problem+json). `code` is the stable machine code the
 * web and the tests read; `errors` lists every field problem so a form can mark all of them at once.
 */
export interface FieldIssue {
  /** Field key, or "" when the problem is about the whole body. */
  field: string;
  /** UPPER_SNAKE_CASE code without the field suffix, e.g. REQUIRED, INVALID_OPTION. */
  code: string;
  /** Row number (1-based) for import problems. */
  row?: number;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  errors?: FieldIssue[];
  traceId?: string;
  /** Kept for clients written against the previous `{ statusCode, code, message, requestId }` body. */
  statusCode: number;
  message: string;
  requestId?: string;
}

/** "REQUIRED:email" → { field: "email", code: "REQUIRED" }; "INVALID_EMAIL" → { field: "", … }. */
export function toFieldIssue(raw: string, row?: number): FieldIssue {
  const at = raw.indexOf(":");
  const issue =
    at < 0
      ? { field: raw === "INVALID_EMAIL" ? "email" : "", code: raw }
      : { field: raw.slice(at + 1), code: raw.slice(0, at) };
  return row === undefined ? issue : { ...issue, row };
}

/**
 * 400 carrying every problem. The message stays the first code (as before), so code that matches on
 * the message keeps working while new clients read `errors`.
 */
export class ValidationProblem extends BadRequestException {
  constructor(codes: string[] | FieldIssue[], message?: string) {
    const errors = codes.map((c) =>
      typeof c === "string" ? toFieldIssue(c) : c,
    );
    const first = codes[0];
    super({
      message:
        message ??
        (typeof first === "string"
          ? first
          : first
            ? first.field && first.code !== "INVALID_EMAIL"
              ? `${first.code}:${first.field}`
              : first.code
            : "VALIDATION_FAILED"),
      errors,
    });
  }
}

const CONSTRAINT_CODES: Record<string, string> = {
  isDefined: "REQUIRED",
  isNotEmpty: "REQUIRED",
  isInt: "INVALID_NUMBER",
  isNumber: "INVALID_NUMBER",
  min: "INVALID_NUMBER",
  max: "INVALID_NUMBER",
  isBoolean: "INVALID_BOOLEAN",
  isString: "INVALID_STRING",
  maxLength: "INVALID_STRING",
  isEmail: "INVALID_EMAIL",
  isIn: "INVALID_OPTION",
  isEnum: "INVALID_OPTION",
  isArray: "INVALID_ARRAY",
  arrayMinSize: "INVALID_ARRAY",
  arrayMaxSize: "INVALID_ARRAY",
  whitelistValidation: "UNKNOWN_FIELD",
};

/** class-validator errors (nested too) as field issues with our codes. */
export function flattenValidationErrors(
  errors: ValidationError[],
  prefix = "",
): FieldIssue[] {
  return errors.flatMap((e) => {
    const field = prefix ? `${prefix}.${e.property}` : e.property;
    const own = Object.keys(e.constraints ?? {}).map((name) => ({
      field,
      code:
        CONSTRAINT_CODES[name] ??
        `INVALID_${name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`,
    }));
    return [...own, ...flattenValidationErrors(e.children ?? [], field)];
  });
}

/**
 * The global pipe (LT-07): DTO classes are validated, unknown properties refused, query strings
 * converted to the declared types. Handlers typed `unknown`/`Record` are left to BaseService.
 */
export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
    exceptionFactory: (errors) =>
      new ValidationProblem(flattenValidationErrors(errors)),
  });
}

const TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export function problemBody(input: {
  status: number;
  code: string;
  errors?: FieldIssue[];
  instance?: string;
  requestId?: string;
}): ProblemDetails {
  return {
    type: `urn:problem:${input.code.split(":")[0].toLowerCase().replace(/_/g, "-")}`,
    title: TITLES[input.status] ?? "Error",
    status: input.status,
    detail: input.code,
    ...(input.instance ? { instance: input.instance } : {}),
    code: input.code,
    ...(input.errors?.length ? { errors: input.errors } : {}),
    traceId: input.requestId,
    statusCode: input.status,
    message: input.code,
    requestId: input.requestId,
  };
}
