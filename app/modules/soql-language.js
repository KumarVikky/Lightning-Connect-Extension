export const SOQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "WITH", "USING", "SCOPE", "GROUP", "BY", "ROLLUP", "CUBE", "HAVING", "ORDER", "ASC", "DESC", "NULLS", "FIRST", "LAST", "LIMIT", "OFFSET", "FOR", "VIEW", "REFERENCE", "UPDATE", "TRACKING", "TYPEOF", "WHEN", "THEN", "ELSE", "END", "AND", "OR", "NOT", "IN", "INCLUDES", "EXCLUDES", "LIKE", "NULL", "TRUE", "FALSE"
];

export const SOQL_FUNCTIONS = ["COUNT", "COUNT_DISTINCT", "FORMAT", "TOLABEL", "CALENDAR_MONTH", "CALENDAR_YEAR", "DAY_IN_MONTH", "DAY_IN_WEEK", "DAY_ONLY", "FISCAL_MONTH", "FISCAL_QUARTER", "FISCAL_YEAR", "HOUR_IN_DAY", "WEEK_IN_MONTH", "WEEK_IN_YEAR"];

const clauseKeywords = new Set(["SELECT", "FROM", "WHERE", "WITH", "GROUP", "ORDER", "HAVING", "LIMIT", "OFFSET", "FOR"]);
const wordPattern = /[A-Za-z_$]/;

export function tokenizeSoql(source) {
  const text = String(source ?? "");
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const start = index;
    const character = text[index];
    if (/\s/.test(character)) { index += 1; while (index < text.length && /\s/.test(text[index])) index += 1; tokens.push({ type: "whitespace", value: text.slice(start, index), start, end: index }); continue; }
    if (character === "'" || character === '"') { const quote = character; index += 1; let closed = false; while (index < text.length) { if (text[index] === "\\") { index += 2; continue; } if (text[index] === quote) { if (text[index + 1] === quote) { index += 2; continue; } index += 1; closed = true; break; } index += 1; } tokens.push({ type: "string", value: text.slice(start, index), start, end: index, closed }); continue; }
    if (character === "-" && text[index + 1] === "-") { index += 2; while (index < text.length && text[index] !== "\n") index += 1; tokens.push({ type: "comment", value: text.slice(start, index), start, end: index }); continue; }
    if (character === "/" && text[index + 1] === "*") { index += 2; while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1; index = Math.min(text.length, index + 2); tokens.push({ type: "comment", value: text.slice(start, index), start, end: index }); continue; }
    if (/[0-9]/.test(character)) { index += 1; while (index < text.length && /[0-9.]/.test(text[index])) index += 1; tokens.push({ type: "number", value: text.slice(start, index), start, end: index }); continue; }
    if (wordPattern.test(character)) { index += 1; while (index < text.length && /[A-Za-z0-9_$]/.test(text[index])) index += 1; const value = text.slice(start, index); tokens.push({ type: "word", value, start, end: index, upper: value.toUpperCase() }); continue; }
    tokens.push({ type: "punctuation", value: character, start, end: ++index });
  }
  return tokens;
}

export function significantTokens(source) { return tokenizeSoql(source).filter((token) => token.type !== "whitespace" && token.type !== "comment"); }

function previousWord(tokens, index) { for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (tokens[cursor].type === "word") return tokens[cursor]; return null; }

export function parseSoql(source) {
  const tokens = significantTokens(source);
  const scopes = [];
  const stack = [];
  let current = { depth: 0, selectFields: [], objectName: "", alias: "", fromIndex: -1, parent: null };
  scopes.push(current);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.value === "(") { stack.push(current); current = { depth: current.depth + 1, selectFields: [], objectName: "", alias: "", fromIndex: -1, parent: current }; scopes.push(current); continue; }
    if (token.value === ")") { current = stack.pop() || scopes[0]; continue; }
    if (token.type !== "word") continue;
    if (token.upper === "SELECT") { current.selectStart = index; continue; }
    if (token.upper === "FROM" && tokens[index + 1]?.type === "word") { current.fromIndex = index; current.objectName = tokens[index + 1].value; current.alias = tokens[index + 2]?.type === "word" && !clauseKeywords.has(tokens[index + 2].upper) ? tokens[index + 2].value : ""; continue; }
    if (current.selectStart !== undefined && current.fromIndex === -1 && token.upper !== "SELECT") current.selectFields.push(token.value);
  }
  return { tokens, scopes, root: scopes[0] };
}

function fuzzyScore(candidate, typed) {
  const value = String(candidate || "").toLowerCase(); const query = String(typed || "").toLowerCase();
  if (!query) return 0; if (value.startsWith(query)) return 0; if (value.includes(query)) return 10 + value.indexOf(query);
  let cursor = 0; let gaps = 0; for (const character of query) { const found = value.indexOf(character, cursor); if (found === -1) return Infinity; gaps += found - cursor; cursor = found + 1; } return 30 + gaps;
}

function currentPath(source, offset) {
  const before = String(source ?? "").slice(0, offset); if (/\s$/.test(before)) return { prefix: "", path: [] }; const trailingDot = /\.\s*$/.test(before); const pathSource = trailingDot ? before.replace(/\.\s*$/, "") : before; const match = pathSource.match(/([A-Za-z0-9_$]+(?:\s*\.\s*[A-Za-z0-9_$]*)*)\s*$/); if (!match) return { prefix: "", path: [] };
  const parts = match[1].split(".").map((part) => part.trim()).filter(Boolean); return { prefix: trailingDot ? "" : (parts.pop() || ""), path: parts };
}

export function getSoqlContext(source, offset = String(source ?? "").length) {
  const text = String(source ?? ""); const safeOffset = Math.max(0, Math.min(offset, text.length)); const parsed = parseSoql(text); const beforeParsed = parseSoql(text.slice(0, safeOffset)); const tokens = beforeParsed.tokens; const pathInfo = currentPath(text, safeOffset); let clause = "UNKNOWN"; let depth = 0;
  for (const token of tokens) { if (token.value === "(") depth += 1; if (token.value === ")") depth = Math.max(0, depth - 1); if (token.type === "word" && clauseKeywords.has(token.upper)) clause = token.upper; }
  if (clause === "GROUP" || clause === "ORDER") { const last = tokens[tokens.length - 1]?.upper; if (last === "GROUP" || last === "ORDER") clause = last; }
  const activeScope = [...parsed.scopes].reverse().find((scope) => scope.depth <= depth && scope.objectName) || parsed.root;
  const fromMatch = text.slice(0, safeOffset).match(/\bFROM\s+([A-Za-z0-9_$]+)/i); const objectName = activeScope.objectName || fromMatch?.[1] || "";
  return { clause, depth, objectName, alias: activeScope.alias || "", path: pathInfo.path, prefix: pathInfo.prefix, tokens, parsed };
}

export function fieldTypeBadge(field) {
  const type = String(field?.type || "").toLowerCase(); if (field?.calculated) return "Formula"; if (field?.referenceTo?.length || type === "reference") return "Reference"; if (type === "string" || type === "textarea" || type === "url" || type === "email" || type === "phone") return "String"; if (type === "date") return "Date"; if (type === "datetime") return "DateTime"; if (["double", "currency", "percent", "int", "long"].includes(type)) return "Number"; if (type === "boolean") return "Boolean"; if (type === "picklist" || type === "multipicklist") return "Picklist"; return type ? type[0].toUpperCase() + type.slice(1) : "Field";
}

function fieldCandidates(schema, objectName) { return schema?.objects?.[objectName]?.fields || []; }

export function buildSoqlSuggestions(source, offset, schema = {}) {
  const context = getSoqlContext(source, offset); const prefix = context.prefix; const candidates = []; const objects = schema.objects || {};
  if (context.clause === "FROM" && !context.objectName) Object.values(objects).forEach((object) => candidates.push({ label: object.label || object.name, insertText: object.name, detail: object.name, kind: "object", score: fuzzyScore(`${object.name} ${object.label}`, prefix) }));
  else {
    let fields = fieldCandidates(schema, context.objectName); let pathLabel = ""; const relationshipPath = context.alias && context.path[0] === context.alias ? context.path.slice(1) : context.path;
    if (relationshipPath.length) { let object = objects[context.objectName]; for (const relationship of relationshipPath) { const relationField = object?.fields?.find((field) => field.relationshipName === relationship || field.name === relationship); object = relationField?.referenceTo?.map((name) => objects[name]).find(Boolean); } if (object) { fields = object.fields || []; pathLabel = `${context.path.join(".")}.`; } }
    if (["SELECT", "WHERE", "GROUP", "ORDER", "HAVING", "UNKNOWN"].includes(context.clause)) fields.forEach((field) => candidates.push({ label: `${pathLabel}${field.name}`, detail: `${field.label} · ${fieldTypeBadge(field)}`, documentation: fieldMetadataText(field), insertText: `${pathLabel}${field.name}`, kind: "field", score: fuzzyScore(`${field.name} ${field.label}`, prefix) }));
    if (!context.path.length && ["SELECT", "UNKNOWN"].includes(context.clause)) {
      (schema.objects[context.objectName]?.childRelationships || []).forEach((relationship) => {
        const child = objects[relationship.childSObject];
        const childFields = child?.fields?.filter((field) => ["Id", "Name", "FirstName", "LastName", "Email"].includes(field.name)).slice(0, 5) || [{ name: "Id" }];
        const select = childFields.map((field) => field.name).join(", ");
        const query = `(SELECT ${select} FROM ${relationship.relationshipName})`;
        candidates.push({ label: relationship.relationshipName, detail: `Child relationship · ${relationship.childSObject}`, documentation: `${relationship.childSObject}.${relationship.field}`, insertText: query, kind: "relationship", score: fuzzyScore(`${relationship.relationshipName} ${relationship.childSObject}`, prefix) });
      });
    }
    const keywords = SOQL_KEYWORDS.filter((keyword) => !["SELECT", "FROM"].includes(keyword)).map((keyword) => ({ label: keyword, detail: "SOQL keyword", insertText: keyword, kind: "keyword", score: fuzzyScore(keyword, prefix) }));
    const functions = SOQL_FUNCTIONS.map((name) => ({ label: `${name}()`, detail: "SOQL function", insertText: `${name}()`, kind: "function", score: fuzzyScore(name, prefix) })); candidates.push(...keywords, ...functions);
  }
  return candidates.filter((item) => item.score !== Infinity).sort((left, right) => left.score - right.score || left.label.localeCompare(right.label));
}

export function fieldMetadataText(field) { return [`API: ${field?.name || ""}`, `Label: ${field?.label || ""}`, `Type: ${fieldTypeBadge(field)}`, field?.relationshipName ? `Relationship: ${field.relationshipName}` : "", field?.referenceTo?.length ? `References: ${field.referenceTo.join(", ")}` : "", field?.custom ? "Custom field" : "", field?.calculated ? "Formula field" : ""].filter(Boolean).join("\n"); }

export function findDuplicateFields(source) { const parsed = parseSoql(source); const seen = new Set(); const duplicates = []; for (const field of parsed.root.selectFields || []) { const normalized = field.toLowerCase(); if (seen.has(normalized) && !duplicates.includes(field)) duplicates.push(field); seen.add(normalized); } return duplicates; }

export function validateSoql(source) {
  const text = String(source ?? "");
  const tokens = tokenizeSoql(text);
  const significant = tokens.filter((token) => token.type !== "whitespace" && token.type !== "comment");
  const errors = [];
  const add = (message, token = significant[0], severity = "error") => errors.push({ message, index: token?.start ?? text.length, severity });
  if (!text.trim()) { add("Query is empty.", { start: 0 }); return { valid: false, errors }; }

  let parentheses = 0;
  let brackets = 0;
  significant.forEach((token) => {
    if (token.value === "(") parentheses += 1;
    if (token.value === ")") { parentheses -= 1; if (parentheses < 0) add("Unexpected closing parenthesis.", token); }
    if (token.value === "[") brackets += 1;
    if (token.value === "]") { brackets -= 1; if (brackets < 0) add("Unexpected closing bracket.", token); }
    if (token.type === "string" && !token.closed) add("Unterminated string literal.", token);
    if (token.type === "comment" && token.value.startsWith("/*") && !token.value.endsWith("*/")) add("Unterminated block comment.", token);
    if (token.type === "number" && (/\.$/.test(token.value) || /^\./.test(token.value))) add(`Invalid numeric literal: ${token.value}.`, token);
  });
  if (parentheses > 0) add("Unclosed parenthesis.", { start: text.length });
  if (brackets > 0) add("Unclosed bracket.", { start: text.length });

  const words = significant.filter((token) => token.type === "word");
  if (words[0]?.upper !== "SELECT") add("Query must start with SELECT.", words[0] || { start: 0 });
  const scopeDepths = [];
  let depth = 0;
  significant.forEach((token, index) => {
    if (token.value === "(") depth += 1;
    if (token.value === ")") depth = Math.max(0, depth - 1);
    if (token.type === "word" && token.upper === "SELECT") scopeDepths.push({ index, depth });
  });
  if (!scopeDepths.length) add("Query must contain SELECT.", { start: 0 });

  const clauseOrder = { FROM: 10, USING: 15, WHERE: 20, WITH: 25, GROUP: 30, HAVING: 40, ORDER: 50, LIMIT: 60, OFFSET: 70, FOR: 80 };
  scopeDepths.forEach(({ index: selectIndex, depth: selectDepth }) => {
    let fromIndex = -1;
    let localDepth = selectDepth;
    for (let index = selectIndex + 1; index < significant.length; index += 1) {
      const token = significant[index];
      if (token.value === "(") localDepth += 1;
      if (token.value === ")") localDepth -= 1;
      if (localDepth < selectDepth) break;
      if (localDepth === selectDepth && token.type === "word" && token.upper === "FROM") { fromIndex = index; break; }
    }
    if (fromIndex < 0) { add("SELECT must be followed by FROM.", significant[selectIndex]); return; }
    const selectItems = significant.slice(selectIndex + 1, fromIndex);
    if (!selectItems.length || (selectItems.length === 1 && selectItems[0].value === ",")) add("SELECT must contain at least one field.", significant[selectIndex]);
    if (selectItems.at(-1)?.value === ",") add("SELECT field list cannot end with a comma.", selectItems.at(-1));
    for (let itemIndex = 0; itemIndex < selectItems.length - 1; itemIndex += 1) if (selectItems[itemIndex].value === "," && selectItems[itemIndex + 1].value === ",") add("SELECT field list contains an empty field.", selectItems[itemIndex]);
    const fromObject = significant[fromIndex + 1];
    if (!fromObject || fromObject.type !== "word") add("FROM must be followed by an object.", significant[fromIndex]);
  });

  const clauseSeen = new Map();
  let currentDepth = 0;
  significant.forEach((token, index) => {
    if (token.value === "(") { currentDepth += 1; return; }
    if (token.value === ")") { currentDepth = Math.max(0, currentDepth - 1); return; }
    if (token.type !== "word") return;
    const clause = token.upper;
    if (clauseOrder[clause] !== undefined) {
      const key = currentDepth;
      const previous = clauseSeen.get(key);
      if (previous !== undefined && clauseOrder[clause] < previous.order) add(`Clause ${clause} is out of order.`, token);
      clauseSeen.set(key, { order: clauseOrder[clause], clause });
    }
    if (["LIMIT", "OFFSET"].includes(clause) && significant[index + 1]?.type !== "number") add(`${clause} must be followed by a numeric value.`, token);
    if (["GROUP", "ORDER"].includes(clause) && significant[index + 1]?.upper !== "BY") add(`${clause} must be followed by BY.`, token);
  });

  significant.forEach((token, index) => {
    if (!["AND", "OR"].includes(token.upper)) return;
    const previous = significant[index - 1]; const next = significant[index + 1];
    if (!previous || !next || ["AND", "OR", "ORDER", "GROUP", "LIMIT", "OFFSET", ")"].includes(next.upper || next.value)) add(`${token.upper} must join two conditions.`, token);
  });
  findDuplicateFields(text).forEach((field) => add(`Duplicate selected field: ${field}.`, significant[0], "warning"));
  return { valid: errors.every((error) => error.severity === "warning"), errors };
}

export function formatSoql(source) {
  const tokens = significantTokens(source); const lines = []; let line = ""; let indent = 0; const push = () => { if (line.trim()) lines.push(`${"  ".repeat(indent)}${line.trim()}`); line = ""; };
  tokens.forEach((token, index) => { const value = token.type === "word" && SOQL_KEYWORDS.includes(token.upper) ? token.upper : token.value; if (value === "(") { line = `${line.trim()} (`.trim(); push(); indent += 1; } else if (value === ")") { push(); indent = Math.max(0, indent - 1); line = ")"; } else if (value === ",") { line = `${line.trim()},`; push(); } else if (["FROM", "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "OFFSET", "FOR"].includes(value) && line.trim()) { push(); line = value; } else { line = `${line}${line && !/[.(]$/.test(line) ? " " : ""}${value}`; } if (index === tokens.length - 1) push(); }); return lines.join("\n");
}

export function insertAtCursor(source, offset, insertText, selectionStart = offset, selectionEnd = offset) { const text = String(source ?? ""); const start = Math.max(0, Math.min(selectionStart, text.length)); const end = Math.max(start, Math.min(selectionEnd, text.length)); return `${text.slice(0, start)}${insertText}${text.slice(end)}`; }
