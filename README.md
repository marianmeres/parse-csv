# @marianmeres/parse-csv

[![JSR](https://jsr.io/badges/@marianmeres/parse-csv)](https://jsr.io/@marianmeres/parse-csv)
[![NPM](https://img.shields.io/npm/v/@marianmeres/parse-csv)](https://www.npmjs.com/package/@marianmeres/parse-csv)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Simple, reliable in-memory CSV parser. Returns a 2D array of strings.

## Features

- Handles quoted fields, escaped quotes (`""`), and newlines within quotes
- Supports both CRLF and LF line endings
- Custom delimiter support (comma, semicolon, tab, pipe, etc.)
- Automatically strips UTF-8 BOM (common in Excel exports)
- Zero dependencies — fully portable to npm/Node.js
- TypeScript, with full type definitions

> **Note on portability:** This parser intentionally does **not** use Deno's
> `@std/csv`. This is a deliberate choice to keep the package fully portable
> to npm/Node.js without ecosystem-specific dependencies.

> **In-memory limitation:** The parser loads the entire CSV string into memory
> and processes it at once. It is **not** designed for streaming or very large
> datasets. For typical application data (configs, exports, reports) this is
> perfectly fine. If you need to process huge files (hundreds of MB+),
> consider a streaming parser instead.

### Design philosophy

This parser intentionally does **one thing**: it turns a CSV string into a
`string[][]`. That's it. There is no header parsing, no column count validation,
and no type coercion. Whether row 0 is a header is a semantic decision — it
belongs to the consumer, not the parser. The same goes for ragged rows (real-world
CSVs are often messy) and value types (numbers, dates, booleans).

That said, mapping headers to record keys is such a common need that the package
ships a thin convenience wrapper — `parseCsvWithHeader` — so you don't have to
write it yourself.

## Installation

```bash
# Deno
deno add jsr:@marianmeres/parse-csv

# npm
npm install @marianmeres/parse-csv
```

## Quick Start

```typescript
import { parseCsv } from "@marianmeres/parse-csv";

const csv = `name,age,city
Alice,30,Bratislava
Bob,25,"London"`;

const rows = parseCsv(csv);
// [
//   ["name", "age", "city"],
//   ["Alice", "30", "Bratislava"],
//   ["Bob", "25", "London"],
// ]
```

### Header mode

```typescript
import { parseCsvWithHeader } from "@marianmeres/parse-csv";

const csv = `name,age,city
Alice,30,Bratislava
Bob,25,"London"`;

const records = parseCsvWithHeader(csv);
// [
//   { name: "Alice", age: "30", city: "Bratislava" },
//   { name: "Bob", age: "25", city: "London" },
// ]
```

### Custom delimiter

```typescript
// European-style semicolon-separated
const rows = parseCsv("name;age;city\nAlice;30;Bratislava", { delimiter: ";" });

// Tab-separated (TSV)
const rows = parseCsv("col1\tcol2\nval1\tval2", { delimiter: "\t" });
```

## API

### `parseCsv(text, options?)`

```typescript
function parseCsv(text: string, options?: ParseCsvOptions): string[][];
```

**Parameters:**

| Name                | Type     | Description                      |
| ------------------- | -------- | -------------------------------- |
| `text`              | `string` | Raw CSV string to parse          |
| `options.delimiter` | `string` | Field delimiter (default: `","`) |

**Returns:** `string[][]` — array of rows, each row an array of field strings.

### `parseCsvWithHeader(text, options?)`

```typescript
function parseCsvWithHeader(text: string, options?: ParseCsvOptions): Record<string, string>[];
```

Thin wrapper around `parseCsv`. Treats the first row as column headers and
returns an array of objects keyed by those headers. Missing fields in shorter
rows default to `""`.

**Parameters:** Same as `parseCsv`.

**Returns:** `Record<string, string>[]` — array of records keyed by header names.

## License

MIT
