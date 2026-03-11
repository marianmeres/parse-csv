/** Options for the CSV parser. */
export interface ParseCsvOptions {
	/** Field delimiter character. Defaults to `","`. */
	delimiter?: string;
}

/**
 * Simple, reliable in-memory CSV parser. Returns a 2D array of strings
 * (rows × fields). Handles quoted fields, escaped quotes, newlines within
 * quotes, and both CRLF and LF line endings.
 *
 * Intentionally does **not** use Deno's `@std/csv` — this keeps the parser
 * fully portable to npm/Node without ecosystem-specific dependencies.
 *
 * @param text - Raw CSV string to parse.
 * @param options - Optional configuration (e.g. custom delimiter).
 * @returns Parsed rows, each an array of field strings.
 */
export function parseCsv(
	text: string,
	options?: ParseCsvOptions,
): string[][] {
	// Strip UTF-8 BOM if present (common in Excel exports).
	text = text.replace(/^\uFEFF/, "");

	const delimiter = options?.delimiter ?? ",";

	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";

	// State flag: are we currently inside a quoted field?
	let inQuotes = false;

	// Tracks whether we've started processing a field (e.g. entered
	// quotes or accumulated characters). Needed so that a lone empty
	// quoted field (`""`) is not lost by the final flush guard.
	let fieldActive = false;

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
					// Closing quote: exit quoted mode. The next character
					// should be a delimiter, newline, or end-of-input.
					inQuotes = false;
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
			if (ch === '"') {
				// Opening quote: enter quoted mode. Quotes are only
				// recognised at the start of a field (or after a delimiter).
				inQuotes = true;
				i++;
			} else if (ch === delimiter) {
				// Field separator: push the current field and start a new one.
				row.push(field);
				field = "";
				fieldActive = false;
				i++;
			} else if (ch === "\r" && text[i + 1] === "\n") {
				// CRLF line ending: finish the current field and row.
				row.push(field);
				field = "";
				fieldActive = false;
				rows.push(row);
				row = [];
				i += 2;
			} else if (ch === "\n") {
				// LF line ending: finish the current field and row.
				row.push(field);
				field = "";
				fieldActive = false;
				rows.push(row);
				row = [];
				i++;
			} else {
				// Regular character: accumulate into the current field.
				field += ch;
				i++;
			}
		}
	}

	// Flush the last field/row if there is any remaining content.
	// The `row.length` check handles trailing delimiters; `fieldActive`
	// catches a lone empty quoted field (`""`) where field is "" and
	// row is still empty.
	if (field || row.length || fieldActive) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

/**
 * Convenience wrapper around {@link parseCsv}. Treats the first row as
 * column headers and returns an array of objects keyed by those headers.
 *
 * Missing fields in shorter rows default to `""`. If the input is empty
 * or contains only a header row, an empty array is returned.
 *
 * @param text - Raw CSV string to parse.
 * @param options - Optional configuration (e.g. custom delimiter).
 * @returns Array of records keyed by header names.
 */
export function parseCsvWithHeader(
	text: string,
	options?: ParseCsvOptions,
): Record<string, string>[] {
	const [header, ...data] = parseCsv(text, options);
	if (!header) return [];
	return data.map((row) =>
		Object.fromEntries(header.map((key, i) => [key, row[i] ?? ""]))
	);
}
