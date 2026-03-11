import { assertEquals } from "@std/assert";
import { parseCsv, parseCsvWithHeader } from "../src/parse-csv.ts";

// ---------------------------------------------------------------------------
// Basic parsing
// ---------------------------------------------------------------------------

Deno.test("single row, single field", () => {
	assertEquals(parseCsv("hello"), [["hello"]]);
});

Deno.test("single row, multiple fields", () => {
	assertEquals(parseCsv("a,b,c"), [["a", "b", "c"]]);
});

Deno.test("single row, multiple fields, trailing new line", () => {
	assertEquals(parseCsv("a,b,c\n"), [["a", "b", "c"]]);
});

Deno.test("single row, multiple fields, trailing new lines", () => {
	// Two trailing newlines: the first terminates the data row,
	// the second produces an empty row (only a single trailing
	// newline is consumed as a row terminator).
	assertEquals(parseCsv("a,b,c\n\n"), [["a", "b", "c"], [""]]);
});

Deno.test("multiple rows", () => {
	assertEquals(parseCsv("a,b\nc,d"), [
		["a", "b"],
		["c", "d"],
	]);
});

Deno.test("three columns, three rows", () => {
	assertEquals(parseCsv("1,2,3\n4,5,6\n7,8,9"), [
		["1", "2", "3"],
		["4", "5", "6"],
		["7", "8", "9"],
	]);
});

// ---------------------------------------------------------------------------
// Empty / edge inputs
// ---------------------------------------------------------------------------

Deno.test("empty string returns empty array", () => {
	assertEquals(parseCsv(""), []);
});

Deno.test("single newline returns one empty row", () => {
	// A newline produces one row with an empty field; the trailing
	// newline does not produce a second row (same as trailing-LF behavior).
	assertEquals(parseCsv("\n"), [[""]]);
});

Deno.test("only commas", () => {
	assertEquals(parseCsv(",,,"), [["", "", "", ""]]);
});

Deno.test("only commas with newline", () => {
	assertEquals(parseCsv(",,\n,,"), [
		["", "", ""],
		["", "", ""],
	]);
});

Deno.test("single field with spaces", () => {
	assertEquals(parseCsv("  hello  "), [["  hello  "]]);
});

// ---------------------------------------------------------------------------
// Trailing newlines
// ---------------------------------------------------------------------------

Deno.test("trailing LF does not produce extra empty row", () => {
	assertEquals(parseCsv("a,b\n"), [["a", "b"]]);
});

Deno.test("trailing CRLF does not produce extra empty row", () => {
	assertEquals(parseCsv("a,b\r\n"), [["a", "b"]]);
});

Deno.test("two trailing newlines produce one extra empty row", () => {
	assertEquals(parseCsv("a,b\n\n"), [["a", "b"], [""]]);
});

// ---------------------------------------------------------------------------
// Line endings
// ---------------------------------------------------------------------------

Deno.test("LF line endings", () => {
	assertEquals(parseCsv("a\nb\nc"), [["a"], ["b"], ["c"]]);
});

Deno.test("CRLF line endings", () => {
	assertEquals(parseCsv("a\r\nb\r\nc"), [["a"], ["b"], ["c"]]);
});

Deno.test("mixed LF and CRLF", () => {
	assertEquals(parseCsv("a\nb\r\nc"), [["a"], ["b"], ["c"]]);
});

// ---------------------------------------------------------------------------
// Quoted fields
// ---------------------------------------------------------------------------

Deno.test("basic quoted field", () => {
	assertEquals(parseCsv('"hello"'), [["hello"]]);
});

Deno.test("quoted field with comma inside", () => {
	assertEquals(parseCsv('"a,b",c'), [["a,b", "c"]]);
});

Deno.test("quoted field with newline inside", () => {
	assertEquals(parseCsv('"line1\nline2",b'), [["line1\nline2", "b"]]);
});

Deno.test("quoted field with CRLF inside", () => {
	assertEquals(parseCsv('"line1\r\nline2",b'), [["line1\r\nline2", "b"]]);
});

Deno.test("escaped quotes (double-double quotes)", () => {
	assertEquals(parseCsv('"he said ""hi""",b'), [['he said "hi"', "b"]]);
});

Deno.test("empty quoted field", () => {
	assertEquals(parseCsv('"",a'), [["", "a"]]);
});

Deno.test("field that is only escaped quotes", () => {
	assertEquals(parseCsv('""""'), [['"']]);
});

Deno.test("multiple quoted fields in a row", () => {
	assertEquals(parseCsv('"a","b","c"'), [["a", "b", "c"]]);
});

Deno.test("quoted and unquoted fields mixed", () => {
	assertEquals(parseCsv('a,"b",c'), [["a", "b", "c"]]);
});

Deno.test("quoted field with only spaces", () => {
	assertEquals(parseCsv('"  "'), [["  "]]);
});

Deno.test("multiline quoted field spanning multiple lines", () => {
	const csv = '"first\nsecond\nthird",other';
	assertEquals(parseCsv(csv), [["first\nsecond\nthird", "other"]]);
});

// ---------------------------------------------------------------------------
// Whitespace handling
// ---------------------------------------------------------------------------

Deno.test("spaces around fields are preserved (not trimmed)", () => {
	assertEquals(parseCsv(" a , b , c "), [[" a ", " b ", " c "]]);
});

Deno.test("spaces before quote start quoted mode", () => {
	// Space before opening quote is consumed as regular char, then
	// the quote opens quoted mode — the result strips the outer quotes
	// but keeps the leading space and content.
	assertEquals(parseCsv(' "a" , "b" '), [[" a ", " b "]]);
});

// ---------------------------------------------------------------------------
// Custom delimiter
// ---------------------------------------------------------------------------

Deno.test("semicolon delimiter", () => {
	assertEquals(parseCsv("a;b;c", { delimiter: ";" }), [["a", "b", "c"]]);
});

Deno.test("tab delimiter", () => {
	assertEquals(parseCsv("a\tb\tc", { delimiter: "\t" }), [["a", "b", "c"]]);
});

Deno.test("pipe delimiter", () => {
	assertEquals(parseCsv("a|b|c", { delimiter: "|" }), [["a", "b", "c"]]);
});

Deno.test("semicolon delimiter with quoted fields", () => {
	assertEquals(parseCsv('"a;b";c', { delimiter: ";" }), [["a;b", "c"]]);
});

Deno.test("tab delimiter with multiple rows", () => {
	assertEquals(parseCsv("a\tb\nc\td", { delimiter: "\t" }), [
		["a", "b"],
		["c", "d"],
	]);
});

Deno.test("custom delimiter does not treat comma as separator", () => {
	assertEquals(parseCsv("a,b;c,d", { delimiter: ";" }), [["a,b", "c,d"]]);
});

// ---------------------------------------------------------------------------
// Real-world CSV
// ---------------------------------------------------------------------------

Deno.test("header + data rows", () => {
	const csv = "name,age,city\nAlice,30,Prague\nBob,25,Brno";
	assertEquals(parseCsv(csv), [
		["name", "age", "city"],
		["Alice", "30", "Prague"],
		["Bob", "25", "Brno"],
	]);
});

Deno.test("CSV with quoted fields containing commas and newlines", () => {
	const csv = [
		"id,name,address",
		'1,"Smith, John","123 Main St\nApt 4"',
		'2,"Doe, Jane","456 Oak Ave"',
	].join("\n");
	assertEquals(parseCsv(csv), [
		["id", "name", "address"],
		["1", "Smith, John", "123 Main St\nApt 4"],
		["2", "Doe, Jane", "456 Oak Ave"],
	]);
});

Deno.test("European-style CSV (semicolon, CRLF)", () => {
	const csv = 'name;amount;note\r\nAlice;1000;"ok"\r\nBob;2000;"a;b"';
	assertEquals(parseCsv(csv, { delimiter: ";" }), [
		["name", "amount", "note"],
		["Alice", "1000", "ok"],
		["Bob", "2000", "a;b"],
	]);
});

Deno.test("TSV (tab-separated values)", () => {
	const csv = "col1\tcol2\tcol3\nval1\tval2\tval3";
	assertEquals(parseCsv(csv, { delimiter: "\t" }), [
		["col1", "col2", "col3"],
		["val1", "val2", "val3"],
	]);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

Deno.test("single empty quoted field", () => {
	// `""` is an empty quoted field — but after closing the quotes,
	// field is empty and row.length is 0, so the flush guard catches it.
	assertEquals(parseCsv('""'), [[""]]);
});

Deno.test("row with trailing comma (empty last field)", () => {
	assertEquals(parseCsv("a,b,"), [["a", "b", ""]]);
});

Deno.test("row with leading comma (empty first field)", () => {
	assertEquals(parseCsv(",a,b"), [["", "a", "b"]]);
});

Deno.test("multiple empty fields", () => {
	assertEquals(parseCsv(",,"), [["", "", ""]]);
});

Deno.test("quoted field at end of row", () => {
	assertEquals(parseCsv('a,"b"'), [["a", "b"]]);
});

Deno.test("quoted field at start of row", () => {
	assertEquals(parseCsv('"a",b'), [["a", "b"]]);
});

Deno.test("many columns", () => {
	const fields = Array.from({ length: 100 }, (_, i) => `f${i}`);
	const csv = fields.join(",");
	assertEquals(parseCsv(csv), [fields]);
});

Deno.test("many rows", () => {
	const rows = Array.from({ length: 100 }, (_, i) => `r${i}`);
	const csv = rows.join("\n");
	assertEquals(
		parseCsv(csv),
		rows.map((r) => [r]),
	);
});

Deno.test("field with escaped quote at boundaries", () => {
	// Field value is: "hello"
	assertEquals(parseCsv('"""hello"""'), [['"hello"']]);
});

Deno.test("consecutive quoted fields with newlines", () => {
	const csv = '"a\nb","c\nd"';
	assertEquals(parseCsv(csv), [["a\nb", "c\nd"]]);
});

Deno.test("CRLF inside quoted field followed by LF row separator", () => {
	const csv = '"a\r\nb"\nc';
	assertEquals(parseCsv(csv), [["a\r\nb"], ["c"]]);
});

// ---------------------------------------------------------------------------
// parseCsvWithHeader
// ---------------------------------------------------------------------------

Deno.test("parseCsvWithHeader: basic header + data rows", () => {
	const csv = "name,age,city\nAlice,30,Prague\nBob,25,Brno";
	assertEquals(parseCsvWithHeader(csv), [
		{ name: "Alice", age: "30", city: "Prague" },
		{ name: "Bob", age: "25", city: "Brno" },
	]);
});

Deno.test("parseCsvWithHeader: empty input", () => {
	assertEquals(parseCsvWithHeader(""), []);
});

Deno.test("parseCsvWithHeader: header only, no data rows", () => {
	assertEquals(parseCsvWithHeader("name,age,city\n"), []);
});

Deno.test("parseCsvWithHeader: ragged rows (fewer fields than headers)", () => {
	const csv = "a,b,c\n1,2\n4";
	assertEquals(parseCsvWithHeader(csv), [
		{ a: "1", b: "2", c: "" },
		{ a: "4", b: "", c: "" },
	]);
});

Deno.test("parseCsvWithHeader: custom delimiter", () => {
	const csv = "name;age\nAlice;30";
	assertEquals(parseCsvWithHeader(csv, { delimiter: ";" }), [
		{ name: "Alice", age: "30" },
	]);
});

Deno.test("parseCsvWithHeader: quoted header names", () => {
	const csv = '"First Name","Last Name"\nJohn,Doe';
	assertEquals(parseCsvWithHeader(csv), [
		{ "First Name": "John", "Last Name": "Doe" },
	]);
});
