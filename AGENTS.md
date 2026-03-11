# @marianmeres/parse-csv

## Package Identity

```yaml
name: "@marianmeres/parse-csv"
version: "1.0.0"
license: "MIT"
repository: "https://github.com/marianmeres/parse-csv"
registry_npm: "https://www.npmjs.com/package/@marianmeres/parse-csv"
registry_jsr: "https://jsr.io/@marianmeres/parse-csv"
```

## Purpose

Simple, reliable in-memory CSV parser (~100 lines). Returns a 2D string array.
Intentionally avoids Deno's `@std/csv` for full npm/Node.js portability.
Not designed for streaming or very large datasets.

## Architecture

### File Structure

```
src/
  mod.ts              # Entry point, re-exports parse-csv.ts
  parse-csv.ts        # Single parser function + options interface
tests/
  parse-csv.test.ts   # 51 tests (Deno.test + @std/assert)
scripts/
  build-npm.ts        # npm distribution builder (@marianmeres/npmbuild)
```

### Core Components

1. **`parseCsv(text, options?)`** — Character-by-character state machine parser
2. **`ParseCsvOptions`** — Configuration interface (currently: `delimiter`)

### Parsing Algorithm

State machine with single boolean flag `inQuotes`:

- **Outside quotes**: delimiter → push field; `\n`/`\r\n` → push row; `"` → enter quoted mode; else → accumulate
- **Inside quotes**: `""` → escaped literal quote; `"` → exit quoted mode; else → accumulate (including newlines)
- **End of input**: flush remaining field/row if any content or `fieldActive` flag set

Key behaviors:

- Single trailing newline is consumed as row terminator (no extra empty row)
- Two trailing newlines produce one empty row
- Spaces are preserved (no trimming)
- Empty string input returns `[]`

## Exports

```typescript
interface ParseCsvOptions {
	delimiter?: string; // default: ","
}

function parseCsv(text: string, options?: ParseCsvOptions): string[][];
```

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

51 tests across 8 categories:

- Basic parsing (single/multiple rows and columns)
- Empty/edge inputs (empty string, newlines, only commas)
- Trailing newlines (single, double, CRLF)
- Line endings (LF, CRLF, mixed)
- Quoted fields (commas, newlines, escaped quotes, empty)
- Whitespace handling (preserved, not trimmed)
- Custom delimiters (semicolon, tab, pipe)
- Real-world CSV (headers + data, European-style, TSV)

## Design Decisions

- **No `@std/csv`**: deliberate choice for npm portability
- **In-memory only**: entire string parsed at once, no streaming
- **No type coercion**: all values returned as strings
- **No header parsing**: returns raw 2D array, consumer handles semantics
- **Whitespace preserved**: no automatic trimming of fields

## Modification Guide

- **Add new option**: extend `ParseCsvOptions` interface, destructure in `parseCsv`
- **Change parsing behavior**: modify state machine in the `while` loop
- **Add post-processing** (e.g. trim, header mode): add as optional transforms, do not change core parser return type

## File Locations

| Concern               | File                      |
| --------------------- | ------------------------- |
| Parser implementation | `src/parse-csv.ts`        |
| Public API            | `src/mod.ts`              |
| Tests                 | `tests/parse-csv.test.ts` |
| npm build             | `scripts/build-npm.ts`    |
| Package config        | `deno.json`               |
