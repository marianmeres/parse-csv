/** Options for the CSV parser. */
export interface ParseCsvOptions {
	/**
	 * Field delimiter. Must be exactly one character, and cannot be `"`,
	 * `\n`, or `\r` (those are reserved by the CSV grammar). Defaults to `","`.
	 */
	delimiter?: string;
	/**
	 * Strict mode. When `true`, the parser throws a `SyntaxError` on inputs
	 * that violate RFC 4180:
	 *
	 * - Unterminated quoted field at end of input.
	 * - Content after a closing quote (i.e. a closing `"` not followed by
	 *   delimiter, newline, or end-of-input).
	 * - An unescaped `"` inside an unquoted field.
	 *
	 * `parseCsvWithHeader` additionally throws on:
	 *
	 * - Duplicate header names.
	 * - Data rows whose field count differs from the header field count.
	 *
	 * Default: `false` (lenient — matches the loose behavior of most
	 * real-world CSV consumers).
	 */
	strict?: boolean;
}

/**
 * Simple, reliable in-memory CSV parser. Returns a 2D array of strings
 * (rows × fields). Handles quoted fields, escaped quotes, newlines within
 * quotes, and CRLF / LF / lone-CR line endings.
 *
 * Intentionally does **not** use Deno's `@std/csv` — this keeps the parser
 * fully portable to npm/Node without ecosystem-specific dependencies.
 *
 * @param text - Raw CSV string to parse.
 * @param options - Optional configuration (delimiter, strict mode).
 * @returns Parsed rows, each an array of field strings.
 */
export function parseCsv(
	text: string,
	options?: ParseCsvOptions,
): string[][] {
	// Strip UTF-8 BOM if present (common in Excel exports).
	text = text.replace(/^\uFEFF/, "");

	const delimiter = options?.delimiter ?? ",";
	const strict = options?.strict ?? false;

	// Delimiter sanity: single char, not one of the CSV-reserved characters.
	if (delimiter.length !== 1) {
		throw new TypeError(
			`parseCsv: delimiter must be exactly one character (got ${
				JSON.stringify(delimiter)
			})`,
		);
	}
	if (delimiter === '"' || delimiter === "\n" || delimiter === "\r") {
		throw new TypeError(
			`parseCsv: delimiter cannot be '"', '\\n', or '\\r' (got ${
				JSON.stringify(delimiter)
			})`,
		);
	}

	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";

	// State flag: are we currently inside a quoted field?
	let inQuotes = false;

	// Tracks whether we've started processing a field (entered quotes or
	// accumulated any content). Needed so that a lone empty quoted field
	// (`""`) is not lost by the final flush guard.
	let fieldActive = false;

	// Tracks whether we're at the very start of a new field. A `"` only
	// opens quoted mode at field start (RFC 4180); a `"` appearing after
	// any content is a literal character.
	let atFieldStart = true;

	// Set to `true` immediately after a closing quote, reset by the next
	// delimiter or newline. Used to detect "content after closing quote".
	let justClosedQuote = false;

	// Character-by-character state machine. We use an index rather than
	// for-of so we can peek ahead (for escaped quotes and CRLF).
	let i = 0;

	while (i < text.length) {
		const ch = text[i];

		if (inQuotes) {
			// --- Inside a quoted field ---
			fieldActive = true;
			if (ch === '"') {
				if (text[i + 1] === '"') {
					// Escaped quote: two consecutive `"` produce a single
					// literal `"` in the field value (RFC 4180 §2.7).
					field += '"';
					i += 2;
				} else {
					// Closing quote. The next character should be a
					// delimiter, newline, or end-of-input.
					inQuotes = false;
					justClosedQuote = true;
					i++;
				}
			} else {
				// Any other character (including newlines) is literal
				// content when inside quotes.
				field += ch;
				i++;
			}
		} else {
			// --- Outside a quoted field ---
			if (atFieldStart && ch === '"') {
				// Opening quote: recognised only at the start of a field.
				inQuotes = true;
				fieldActive = true;
				atFieldStart = false;
				i++;
			} else if (ch === delimiter) {
				// Field separator: push the current field and start a new one.
				row.push(field);
				field = "";
				fieldActive = false;
				atFieldStart = true;
				justClosedQuote = false;
				i++;
			} else if (ch === "\r" && text[i + 1] === "\n") {
				// CRLF line ending: finish the current field and row.
				row.push(field);
				field = "";
				fieldActive = false;
				rows.push(row);
				row = [];
				atFieldStart = true;
				justClosedQuote = false;
				i += 2;
			} else if (ch === "\n" || ch === "\r") {
				// LF or lone-CR line ending. RFC 4180 specifies CRLF only,
				// but lone LF and lone CR are common in legacy/alt exports.
				row.push(field);
				field = "";
				fieldActive = false;
				rows.push(row);
				row = [];
				atFieldStart = true;
				justClosedQuote = false;
				i++;
			} else {
				// Regular character in unquoted content.
				if (strict) {
					if (justClosedQuote) {
						throw new SyntaxError(
							`parseCsv: unexpected content after closing quote at position ${i}`,
						);
					}
					if (ch === '"') {
						throw new SyntaxError(
							`parseCsv: unescaped '"' in unquoted field at position ${i}`,
						);
					}
				}
				field += ch;
				atFieldStart = false;
				i++;
			}
		}
	}

	if (strict && inQuotes) {
		throw new SyntaxError(
			`parseCsv: unterminated quoted field at end of input`,
		);
	}

	// Flush the last field/row if there is any remaining content.
	// `row.length` catches trailing delimiters; `fieldActive` catches a
	// lone empty quoted field (`""`) where field is "" and row is empty.
	if (field || row.length || fieldActive) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

/**
 * Convenience wrapper around {@link parseCsv}. Treats the first row as
 * column headers and returns an array of records keyed by those headers.
 *
 * Missing fields in shorter rows default to `""`. Extra fields in longer
 * rows are dropped (use `strict: true` to throw instead). If the input is
 * empty or contains only a header row, an empty array is returned.
 *
 * Returned records have a `null` prototype (`Object.create(null)`) to
 * avoid surprising interactions when header names collide with inherited
 * property names like `toString` or `hasOwnProperty`. They remain fully
 * JSON-serializable and support bracket access and `Object.keys`.
 *
 * The optional type parameter `K` lets callers narrow the record keys at
 * compile time; it does not affect runtime behavior.
 *
 * @param text - Raw CSV string to parse.
 * @param options - Optional configuration (delimiter, strict mode).
 * @returns Array of records keyed by header names.
 */
export function parseCsvWithHeader<K extends string = string>(
	text: string,
	options?: ParseCsvOptions,
): Record<K, string>[] {
	const strict = options?.strict ?? false;
	const [header, ...data] = parseCsv(text, options);
	if (!header) return [];

	if (strict) {
		const seen = new Set<string>();
		for (const key of header) {
			if (seen.has(key)) {
				throw new SyntaxError(
					`parseCsvWithHeader: duplicate header name ${
						JSON.stringify(key)
					}`,
				);
			}
			seen.add(key);
		}
	}

	return data.map((row, idx) => {
		if (strict && row.length !== header.length) {
			throw new SyntaxError(
				`parseCsvWithHeader: row ${
					idx + 2
				} has ${row.length} fields but header has ${header.length}`,
			);
		}
		const rec = Object.create(null) as Record<K, string>;
		for (let i = 0; i < header.length; i++) {
			rec[header[i] as K] = row[i] ?? "";
		}
		return rec;
	});
}
