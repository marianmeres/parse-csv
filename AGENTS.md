# @marianmeres/parse-csv

## Package Identity

```yaml
name: "@marianmeres/parse-csv"
version: "1.2.0"
license: "MIT"
repository: "https://github.com/marianmeres/parse-csv"
registry_npm: "https://www.npmjs.com/package/@marianmeres/parse-csv"
registry_jsr: "https://jsr.io/@marianmeres/parse-csv"
```

## Purpose

Simple, reliable in-memory CSV parser (~200 lines). Returns a 2D string array.
Intentionally avoids Deno's `@std/csv` for full npm/Node.js portability.
Not designed for streaming or very large datasets.

## Architecture

### File Structure

```
src/
  mod.ts              # Entry point, re-exports parse-csv.ts
  parse-csv.ts        # Single parser function + header wrapper + options interface
tests/
  parse-csv.test.ts   # 85 tests (Deno.test + @std/assert)
scripts/
  build-npm.ts        # npm distribution builder (@marianmeres/npmbuild)
```

### Core Components

1. **`parseCsv(text, options?)`** — Character-by-character state machine parser
2. **`parseCsvWithHeader<K>(text, options?)`** — Thin wrapper: treats row 0 as headers, returns `Record<K, string>[]` with a null prototype
3. **`ParseCsvOptions`** — Configuration interface: `delimiter`, `strict`

### Parsing Algorithm

State machine with four boolean flags:

- `inQuotes` — currently inside a quoted field
- `fieldActive` — current field has started (even if empty, e.g. `""`); drives final flush for lone empty quoted fields
- `atFieldStart` — we're at the first character of a new field; only then does `"` open quoted mode (RFC 4180)
- `justClosedQuote` — a closing `"` was just seen; reset by the next delimiter/newline; drives the strict-mode "content after closing quote" check

Transitions:

- **Outside quotes, at field start**: `"` → enter quoted mode
- **Outside quotes (any position)**: delimiter → push field; `\n`/`\r\n`/`\r` → push row; other char → accumulate (strict-mode checks apply: stray `"`, content after closing quote)
- **Inside quotes**: `""` → escaped literal quote; `"` → exit quoted mode; else → accumulate (including newlines)
- **End of input**: flush remaining field/row if any content or `fieldActive` is set; if `inQuotes` and `strict`, throw

Key behaviors:

- Single trailing newline is consumed as row terminator (no extra empty row)
- Two trailing newlines produce one empty row
- Spaces are preserved (no trimming)
- Empty string input returns `[]`
- UTF-8 BOM is stripped from the start of input
- Lone `\r` (without `\n`) is treated as a line terminator
- Invalid delimiters throw `TypeError` eagerly

## Exports

```typescript
interface ParseCsvOptions {
	delimiter?: string; // default: ","; must be exactly one char and not `"`, `\n`, `\r`
	strict?: boolean;   // default: false; throws on RFC 4180 violations
}

function parseCsv(text: string, options?: ParseCsvOptions): string[][];

function parseCsvWithHeader<K extends string = string>(
	text: string,
	options?: ParseCsvOptions,
): Record<K, string>[];
```

### Strict mode semantics

`parseCsv` with `strict: true` throws `SyntaxError` on:

- Unterminated quoted field at EOF
- Content after a closing quote (not delimiter/newline/EOF)
- Unescaped `"` inside an unquoted field

`parseCsvWithHeader` with `strict: true` additionally throws on:

- Duplicate header names
- Data row whose field count differs from the header field count

### Delimiter validation

Always-on. `parseCsv` throws `TypeError` if `delimiter`:

- is not exactly one character (empty string or multi-char), or
- is one of `"`, `\n`, `\r`

## Commands

| Task                    | Command                |
| ----------------------- | ---------------------- |
| Test                    | `deno task test`       |
| Test (watch)            | `deno task test:watch` |
| Build npm               | `deno task npm:build`  |
| Publish (JSR + npm)     | `deno task publish`    |
| Release patch + publish | `deno task rp`         |
| Release minor + publish | `deno task rpm`        |

## Dependencies

- **Production**: none (zero dependencies)
- **Development**: `@std/assert`, `@std/fs`, `@std/path`, `@marianmeres/npmbuild`

## Test Coverage

85 tests across 12 categories:

- Basic parsing (single/multiple rows and columns)
- Empty/edge inputs (empty string, newlines, only commas)
- Trailing newlines (single, double, CRLF)
- Line endings (LF, CRLF, mixed, lone CR)
- Quoted fields (commas, newlines, escaped quotes, empty)
- Whitespace handling (preserved, not trimmed)
- Custom delimiters (semicolon, tab, pipe) + validation errors
- Real-world CSV (headers + data, European-style, TSV)
- Quote-at-field-start semantics (RFC 4180)
- Strict mode (unterminated, trailing content, stray quote)
- `parseCsvWithHeader` basics (empty, header-only, ragged, custom delimiter, quoted headers, generic type)
- `parseCsvWithHeader` robustness (null prototype, duplicate headers, strict mode)

## Design Decisions

- **No `@std/csv`**: deliberate choice for npm portability
- **In-memory only**: entire string parsed at once, no streaming
- **No type coercion**: all values returned as strings
- **Core parser has no header parsing**: returns raw 2D array; `parseCsvWithHeader` wraps it for convenience
- **Whitespace preserved**: no automatic trimming of fields
- **RFC 4180 quote semantics by default**: `"` only opens quoted mode at field start; stray quotes are literal
- **Lenient by default, strict on opt-in**: `strict: false` accepts common real-world messiness (unterminated quotes, content after close quote, stray quotes, ragged rows). `strict: true` throws `SyntaxError` on those.
- **`parseCsvWithHeader` returns null-prototype objects**: avoids surprises with header names like `toString`, `constructor`, `__proto__`

## Modification Guide

- **Add new option**: extend `ParseCsvOptions` interface, destructure at the top of `parseCsv`, thread through `parseCsvWithHeader` if relevant
- **Change parsing behavior**: modify state machine in the `while` loop in `parseCsv`. Note the four flags (`inQuotes`, `fieldActive`, `atFieldStart`, `justClosedQuote`) — all four are load-bearing
- **Add post-processing** (e.g. trim, header mode): add as optional transforms, do not change core parser return type
- **Add a new strict-mode check**: put the `throw new SyntaxError` behind an `if (strict)` guard in the relevant state-machine branch; add explicit lenient- and strict-mode tests

## Behavioral Notes (non-obvious)

These are encoded in the tests; change with care.

- `""` (input) → `[[""]]` — one row with one empty field; `fieldActive` catches the otherwise-empty flush
- `""""` (input) → `[['"']]` — escaped-quote mechanics at field boundaries
- ` "a"` (input) → `[[' "a"']]` — leading space disables quote-at-field-start; whole run is literal
- `a"b` (input) → `[['a"b']]` — stray mid-field quote is literal, not an opening quote
- `"x"y` (input, non-strict) → `[["xy"]]` — trailing content after close quote is concatenated
- Lone `\r` in unquoted content → row terminator; lone `\r` in quoted content → literal character
- `parseCsvWithHeader` records: `Object.getPrototypeOf(r) === null`; `r instanceof Object === false`; `JSON.stringify(r)` and `Object.keys(r)` work normally

## File Locations

| Concern               | File                      |
| --------------------- | ------------------------- |
| Parser implementation | `src/parse-csv.ts`        |
| Public API            | `src/mod.ts`              |
| Tests                 | `tests/parse-csv.test.ts` |
| npm build             | `scripts/build-npm.ts`    |
| Package config        | `deno.json`               |
