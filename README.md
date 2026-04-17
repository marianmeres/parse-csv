# @marianmeres/parse-csv

[![JSR](https://jsr.io/badges/@marianmeres/parse-csv)](https://jsr.io/@marianmeres/parse-csv)
[![NPM](https://img.shields.io/npm/v/@marianmeres/parse-csv)](https://www.npmjs.com/package/@marianmeres/parse-csv)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Simple, reliable in-memory CSV parser. Returns a 2D array of strings.

## Features

- Handles quoted fields, escaped quotes (`""`), and newlines within quotes
- Supports CRLF, LF, and lone-CR line endings
- Custom delimiter support (comma, semicolon, tab, pipe, etc.)
- Optional strict mode that throws on RFC 4180 violations
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

You can narrow the record keys at compile time with a generic parameter:

```typescript
type Key = "name" | "age" | "city";
const records = parseCsvWithHeader<Key>(csv);
// records[0] is typed as Record<"name" | "age" | "city", string>
```

### Custom delimiter

```typescript
// European-style semicolon-separated
const rows = parseCsv("name;age;city\nAlice;30;Bratislava", { delimiter: ";" });

// Tab-separated (TSV)
const rows = parseCsv("col1\tcol2\nval1\tval2", { delimiter: "\t" });
```

### Strict mode

By default the parser is lenient — it accepts minor RFC 4180 violations rather
than throwing. Pass `strict: true` to get hard errors on malformed input:

```typescript
parseCsv('"unterminated', { strict: true });
// throws SyntaxError: unterminated quoted field at end of input

parseCsv('"hello"world,b', { strict: true });
// throws SyntaxError: unexpected content after closing quote at position 7

parseCsv('a"b,c', { strict: true });
// throws SyntaxError: unescaped '"' in unquoted field at position 1

parseCsvWithHeader("a,b,a\n1,2,3", { strict: true });
// throws SyntaxError: duplicate header name "a"

parseCsvWithHeader("a,b\n1,2,3,4", { strict: true });
// throws SyntaxError: row 2 has 4 fields but header has 2
```

## API

### `parseCsv(text, options?)`

```typescript
function parseCsv(text: string, options?: ParseCsvOptions): string[][];
```

**Parameters:**

| Name                | Type      | Description                                     |
| ------------------- | --------- | ----------------------------------------------- |
| `text`              | `string`  | Raw CSV string to parse                         |
| `options.delimiter` | `string`  | Single-char field delimiter (default: `","`)    |
| `options.strict`    | `boolean` | Throw on RFC 4180 violations (default: `false`) |

**Returns:** `string[][]` — array of rows, each row an array of field strings.

**Throws `TypeError`** if `delimiter` is not exactly one character or is one of
the CSV-reserved characters (`"`, `\n`, `\r`).

### `parseCsvWithHeader<K>(text, options?)`

```typescript
function parseCsvWithHeader<K extends string = string>(
  text: string,
  options?: ParseCsvOptions,
): Record<K, string>[];
```

Thin wrapper around `parseCsv`. Treats the first row as column headers and
returns an array of records keyed by those headers. Missing fields in shorter
rows default to `""`; extra fields in longer rows are dropped (use
`strict: true` to throw instead).

**Returned records have a `null` prototype** (`Object.create(null)`), which
avoids surprising interactions when header names collide with inherited property
names like `toString` or `hasOwnProperty`. They remain fully JSON-serializable
and support bracket access and `Object.keys`.

The optional type parameter `K` narrows the record keys at compile time; it has
no runtime effect.

**Parameters:** Same as `parseCsv`.

**Returns:** `Record<K, string>[]` — array of records keyed by header names.

## Behavior notes

A few corners of CSV are ambiguous in the wild. This parser picks the RFC 4180
interpretation by default, with a `strict` opt-in for inputs that should be
rejected outright.

- **Quote recognition:** A `"` only opens quoted mode at the very start of a
  field. A stray `"` mid-field is treated as a literal character. Example:
  `a"b,c"d` parses as `[["a\"b", "c\"d"]]`. In strict mode, an unescaped `"` in
  an unquoted field throws.
- **Content after a closing quote:** In lenient mode, characters between a
  closing `"` and the next delimiter/newline are concatenated onto the field
  value (`"x"y` → `"xy"`). In strict mode this throws.
- **Unterminated quoted field:** In lenient mode, the parser closes the field
  at EOF. In strict mode, it throws.
- **Lone CR (`\r`) without a following LF:** Treated as a line terminator. RFC
  4180 specifies CRLF only, but lone CR appears in some legacy exports.
- **Whitespace:** Preserved verbatim, never trimmed. `" a "` is a three-character
  field.
- **Trailing newline:** A single trailing newline terminates the last row
  without producing an extra empty row. Two trailing newlines produce one empty
  row.
- **UTF-8 BOM:** Stripped from the start of the input automatically.
- **Ragged rows in `parseCsvWithHeader`:** Missing fields default to `""`;
  extra fields are dropped. Duplicate header names collapse (last wins). Use
  `strict: true` to throw on either.

## Migration notes

The following behavioral changes were introduced in a recent release. Upgrading
should be safe for well-formed CSV input and for consumers that treat records
as plain string maps. Consider the list below if you relied on any of these
edge cases.

- **Stray quotes mid-field are now preserved.** Previously, any `"` outside
  quoted mode would enter quoted mode and silently consume surrounding
  structure; now a `"` is only an opening quote at the very start of a field.
- **Lone CR is now a line terminator.** Previously, a lone `\r` outside quoted
  content was kept as literal text. If your input contains embedded `\r` that
  should *not* split rows, wrap it in quotes (RFC 4180 compliant).
- **Invalid delimiters now throw.** Passing `""`, a multi-character string,
  `"`, `\n`, or `\r` as `delimiter` raises a `TypeError` instead of silently
  producing wrong output.
- **`parseCsvWithHeader` records have a null prototype.** `result[0] instanceof
  Object` is now `false` and `result[0].hasOwnProperty` is `undefined`. Bracket
  access, `Object.keys`, `for…in`, and `JSON.stringify` are unaffected.

## License

MIT
