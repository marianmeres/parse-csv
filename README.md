# @marianmeres/parse-csv

[![JSR](https://jsr.io/badges/@marianmeres/parse-csv)](https://jsr.io/@marianmeres/parse-csv)
[![NPM](https://img.shields.io/npm/v/@marianmeres/parse-csv)](https://www.npmjs.com/package/@marianmeres/parse-csv)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Simple, reliable in-memory CSV parser. Returns a 2D array of strings.

## Features

- Handles quoted fields, escaped quotes (`""`), and newlines within quotes
- Supports both CRLF and LF line endings
- Custom delimiter support (comma, semicolon, tab, pipe, etc.)
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
Alice,30,Prague
Bob,25,"Brno"`;

const rows = parseCsv(csv);
// [
//   ["name", "age", "city"],
//   ["Alice", "30", "Prague"],
//   ["Bob", "25", "Brno"],
// ]
```

### Custom delimiter

```typescript
// European-style semicolon-separated
const rows = parseCsv("name;age;city\nAlice;30;Prague", { delimiter: ";" });

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

## License

MIT
