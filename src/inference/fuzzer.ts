/**
 * Type-Driven Structural Mock Generator
 *
 * Parses TypeScript type expressions from component `interface Props` via
 * recursive-descent and generates structurally accurate mock data that
 * mirrors the exact type shape.
 *
 * KEY PRINCIPLE: The TYPE defines the structure, the PROP NAME only
 * influences cosmetic values (e.g. `title: string` → "Sample Title").
 * Zero hardcoded field lists. Works for any Astro component with typed props.
 *
 * Fallback: when no type information is available (untyped destructuring),
 * name-based heuristics are used as a last resort.
 */

const SVG_PLACEHOLDER =
  'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22800%22%20height%3D%22500%22%20viewBox%3D%220%200%20800%20500%22%3E%3Crect%20fill%3D%22%231e1e28%22%20width%3D%22800%22%20height%3D%22500%22%2F%3E%3Ctext%20fill%3D%22%23707085%22%20font-family%3D%22sans-serif%22%20font-size%3D%2220%22%20dy%3D%227%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3EIMAGE%3C%2Ftext%3E%3C%2Fsvg%3E';

// ── Type AST ─────────────────────────────────────────────────────────

type TypeNode =
  | { kind: 'primitive'; name: string }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'array'; element: TypeNode }
  | { kind: 'tuple'; elements: TypeNode[] }
  | { kind: 'object'; properties: { name: string; optional: boolean; type: TypeNode }[] }
  | { kind: 'union'; members: TypeNode[] }
  | { kind: 'intersection'; members: TypeNode[] }
  | { kind: 'reference'; name: string; typeArgs: TypeNode[] }
  | { kind: 'nil' };

// ── Recursive-Descent Type Parser ────────────────────────────────────

class TypeParser {
  private pos = 0;
  private src = '';

  parse(input: string): TypeNode {
    this.pos = 0;
    this.src = input.trim();
    if (!this.src) return { kind: 'primitive', name: 'any' };
    try {
      const result = this.union();
      return result;
    } catch {
      // If parsing fails, return 'any' so we fallback to name heuristics
      return { kind: 'primitive', name: 'any' };
    }
  }

  private ws() {
    while (this.pos < this.src.length) {
      // Skip whitespace
      if (/\s/.test(this.src[this.pos])) {
        this.pos++;
        continue;
      }
      // Skip line comments: // ...
      if (this.src[this.pos] === '/' && this.src[this.pos + 1] === '/') {
        while (this.pos < this.src.length && this.src[this.pos] !== '\n') this.pos++;
        continue;
      }
      // Skip block comments: /* ... */
      if (this.src[this.pos] === '/' && this.src[this.pos + 1] === '*') {
        this.pos += 2;
        while (this.pos < this.src.length - 1) {
          if (this.src[this.pos] === '*' && this.src[this.pos + 1] === '/') {
            this.pos += 2;
            break;
          }
          this.pos++;
        }
        continue;
      }
      break;
    }
  }

  private peek(): string {
    this.ws();
    return this.src[this.pos] || '';
  }

  private at(s: string): boolean {
    this.ws();
    return this.src.startsWith(s, this.pos);
  }

  private eat(s: string): boolean {
    this.ws();
    if (this.src.startsWith(s, this.pos)) {
      this.pos += s.length;
      return true;
    }
    return false;
  }

  private expect(s: string) {
    if (!this.eat(s)) throw new Error(`Expected '${s}' at ${this.pos}`);
  }

  private word(): string {
    this.ws();
    const m = this.src.slice(this.pos).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (!m) return '';
    this.pos += m[0].length;
    return m[0];
  }

  // union → intersection ('|' intersection)*
  private union(): TypeNode {
    const members: TypeNode[] = [this.intersection()];
    while (this.eat('|')) members.push(this.intersection());
    return members.length === 1 ? members[0] : { kind: 'union', members };
  }

  // intersection → postfix ('&' postfix)*
  private intersection(): TypeNode {
    const members: TypeNode[] = [this.postfix()];
    while (this.eat('&')) members.push(this.postfix());
    return members.length === 1 ? members[0] : { kind: 'intersection', members };
  }

  // postfix → primary ('[]')*
  private postfix(): TypeNode {
    let node = this.primary();
    while (this.at('[]')) {
      this.pos += 2;
      node = { kind: 'array', element: node };
    }
    return node;
  }

  // primary → string_lit | number_lit | object | paren | tuple | keyword | identifier<generics>
  private primary(): TypeNode {
    const ch = this.peek();

    // String literal type
    if (ch === "'" || ch === '"' || ch === '`') return this.stringLit();

    // Numeric literal
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(this.src[this.pos + 1] || '')))
      return this.numLit();

    // Object type
    if (ch === '{') return this.objectType();

    // Parenthesized expression OR function/arrow type
    if (ch === '(') {
      return this.parenOrFunction();
    }

    // Tuple
    if (ch === '[') return this.tupleType();

    // Keywords & identifiers
    const savedPos = this.pos;
    const w = this.word();
    if (!w) throw new Error(`Unexpected '${ch}' at ${this.pos}`);

    switch (w) {
      case 'string': case 'number': case 'boolean':
      case 'any': case 'unknown': case 'void': case 'never':
      case 'bigint': case 'symbol': case 'object':
        return { kind: 'primitive', name: w };

      case 'true':  return { kind: 'literal', value: true };
      case 'false': return { kind: 'literal', value: false };

      case 'null': case 'undefined': return { kind: 'nil' };

      case 'readonly': case 'typeof': case 'keyof':
        return this.postfix(); // transparent — just parse the inner type

      case 'Array': case 'ReadonlyArray': {
        if (this.eat('<')) {
          const el = this.union();
          this.expect('>');
          return { kind: 'array', element: el };
        }
        return { kind: 'reference', name: w, typeArgs: [] };
      }

      default: {
        // Generic reference:  Foo<A, B>
        const typeArgs: TypeNode[] = [];
        if (this.eat('<')) {
          typeArgs.push(this.union());
          while (this.eat(',')) typeArgs.push(this.union());
          this.expect('>');
        }
        return { kind: 'reference', name: w, typeArgs };
      }
    }
  }

  private stringLit(): TypeNode {
    const q = this.src[this.pos++];
    let val = '';
    while (this.pos < this.src.length && this.src[this.pos] !== q) {
      if (this.src[this.pos] === '\\') this.pos++;
      val += this.src[this.pos++] || '';
    }
    this.pos++; // closing quote
    return { kind: 'literal', value: val };
  }

  private numLit(): TypeNode {
    const start = this.pos;
    if (this.src[this.pos] === '-') this.pos++;
    while (this.pos < this.src.length && /[0-9.]/.test(this.src[this.pos])) this.pos++;
    return { kind: 'literal', value: Number(this.src.slice(start, this.pos)) };
  }

  private objectType(): TypeNode {
    this.expect('{');
    const properties: { name: string; optional: boolean; type: TypeNode }[] = [];

    while (!this.at('}') && this.pos < this.src.length) {
      this.ws();

      // Index signature  [key: string]: T  — skip it
      if (this.peek() === '[') {
        this.skipBalanced('[', ']');
        this.eat(':');
        this.union(); // consume the value type
        this.eat(';'); this.eat(',');
        continue;
      }

      const name = this.word();
      if (!name) break;

      const optional = this.eat('?');
      this.expect(':');
      const type = this.union();

      properties.push({ name, optional, type });
      this.eat(';'); this.eat(',');
    }

    this.expect('}');
    return { kind: 'object', properties };
  }

  private tupleType(): TypeNode {
    this.expect('[');
    const elements: TypeNode[] = [];
    while (!this.at(']') && this.pos < this.src.length) {
      elements.push(this.union());
      this.eat(',');
    }
    this.expect(']');
    return { kind: 'tuple', elements };
  }

  /**
   * Handle `( ... )` which could be:
   *  - Parenthesized type:  `(string | number)`
   *  - Arrow/function type: `(arg: string) => void`
   *  - Shorthand callback:  `() => void`
   */
  private parenOrFunction(): TypeNode {
    // Look ahead to detect arrow function: find matching `)` then `=>`
    const start = this.pos;
    this.expect('(');
    let depth = 1;
    const innerStart = this.pos;
    while (this.pos < this.src.length && depth > 0) {
      if (this.src[this.pos] === '(') depth++;
      else if (this.src[this.pos] === ')') depth--;
      if (depth > 0) this.pos++;
    }
    this.pos++; // skip closing ')'
    this.ws();

    // If `=>` follows, this is a function type — skip the return type and yield nil
    if (this.src.startsWith('=>', this.pos)) {
      this.pos += 2; // skip '=>'
      this.union(); // consume return type
      return { kind: 'nil' };
    }

    // Otherwise it was a parenthesized type — re-parse the inner content
    const innerEnd = this.pos - 1; // before the ')'
    this.pos = innerStart;
    const savedEnd = this.src.length;
    // Parse just the inner content
    const inner = this.union();
    // Restore position to after the ')'
    this.pos = innerEnd + 1;
    return inner;
  }

  private skipBalanced(open: string, close: string) {
    this.expect(open);
    let d = 1;
    while (this.pos < this.src.length && d > 0) {
      if (this.src[this.pos] === open) d++;
      else if (this.src[this.pos] === close) d--;
      if (d > 0) this.pos++;
    }
    this.pos++; // consume closing
  }
}

const typeParser = new TypeParser();

/** Parse a TypeScript type expression string into an AST. */
export function parseType(input: string): TypeNode {
  return typeParser.parse(input);
}

// ── Cosmetic Value Generators ────────────────────────────────────────
// These use the prop NAME purely to make generated strings look nicer.
// They never influence structure — only the human-readable value.

function cosmeticString(name: string, idx?: number): string {
  const k = name.toLowerCase();
  const sfx = idx != null ? ` ${idx}` : '';

  if (k.includes('image') || k.includes('photo') || k.includes('avatar') ||
      k.includes('banner') || k.includes('poster') || k === 'src' || k === 'img')
    return SVG_PLACEHOLDER;
  if (k.includes('title') || k.includes('heading') || k.includes('headline'))
    return `Sample Title${sfx}`;
  if (k.includes('subtitle'))
    return `Sample Subtitle${sfx}`;
  if (k.includes('question'))
    return `What is question${sfx}?`;
  if (k.includes('answer') || k.includes('reply'))
    return `This is the answer${sfx}.`;
  if (k.includes('description') || k.includes('desc'))
    return `A brief description${sfx}.`;
  if (k.includes('body') || k.includes('content') || k.includes('text') || k.includes('summary'))
    return `Lorem ipsum dolor sit amet${sfx}.`;
  if (k.includes('name') || k.includes('label'))
    return `${name}${sfx}`;
  if (k.includes('email'))
    return 'user@example.com';
  if (k.includes('phone') || k.includes('tel'))
    return '+351 912 345 678';
  if (k.includes('url') || k.includes('href') || k.includes('link'))
    return '#';
  if (k.includes('slug'))
    return `sample-slug${idx != null ? '-' + idx : ''}`;
  if (k === 'id' || k.endsWith('Id') || k.endsWith('id'))
    return `id${idx != null ? '-' + idx : '-1'}`;
  if (k.includes('alt'))
    return `Descriptive alt text${sfx}`;
  if (k.includes('date'))
    return '2026-01-15';
  if (k.includes('time'))
    return '10:00';
  if (k.includes('color') || k.includes('colour'))
    return '#6366f1';
  if (k.includes('icon'))
    return 'star';
  if (k.includes('tag') || k.includes('badge') || k.includes('category'))
    return `Tag${sfx}`;
  if (k.includes('lang') || k.includes('locale'))
    return 'en';
  if (k.includes('cta') || k.includes('button') || k.includes('btn'))
    return 'Click Here';
  if (k.includes('author') || k.includes('writer'))
    return `Author${sfx}`;
  if (k.includes('location') || k.includes('address') || k.includes('place'))
    return 'Lisbon, Portugal';

  // Generic fallback: capitalize the prop name
  return `${name.charAt(0).toUpperCase() + name.slice(1)}${sfx}`;
}

function cosmeticNumber(name: string): number {
  const k = name.toLowerCase();
  if (k.includes('price') || k.includes('cost') || k.includes('amount')) return 99;
  if (k.includes('rating') || k.includes('stars') || k.includes('score')) return 5;
  if (k.includes('count') || k.includes('total') || k.includes('quantity')) return 3;
  if (k.includes('duration') || k.includes('minutes')) return 60;
  if (k.includes('width') || k.includes('height') || k.includes('size')) return 100;
  if (k.includes('max')) return 100;
  if (k.includes('min')) return 0;
  if (k.includes('index') || k.includes('order') || k.includes('position')) return 0;
  return 1;
}

function cosmeticBoolean(name: string): boolean {
  const k = name.toLowerCase();
  return !(k === 'disabled' || k === 'hidden' || k === 'readonly' || k === 'loading');
}

// ── Type-Driven Mock Generator ───────────────────────────────────────

/**
 * Recursively generate a mock value from a parsed TypeNode.
 * `propName` is used only for cosmetic value selection.
 * `arrayIdx` distinguishes items within generated arrays.
 */
export function generateFromType(
  node: TypeNode,
  propName: string,
  depth = 0,
  arrayIdx?: number,
  sourceContext?: string,
): unknown {
  if (depth > 5) return null; // infinite recursion guard

  switch (node.kind) {
    case 'primitive':
      switch (node.name) {
        case 'string':  return cosmeticString(propName, arrayIdx);
        case 'number':  return cosmeticNumber(propName) + (arrayIdx ?? 0);
        case 'boolean': return cosmeticBoolean(propName);
        case 'any': case 'unknown': case 'object':
          return cosmeticString(propName, arrayIdx);
        default: return null;
      }

    case 'literal':
      return node.value;

    case 'nil':
      return undefined;

    case 'array': {
      const count = depth > 2 ? 2 : 3;
      return Array.from({ length: count }, (_, i) =>
        generateFromType(node.element, propName, depth + 1, i + 1, sourceContext),
      );
    }

    case 'tuple':
      return node.elements.map((el, i) =>
        generateFromType(el, `${propName}_${i}`, depth + 1),
      );

    case 'object': {
      const obj: Record<string, unknown> = {};
      for (const prop of node.properties) {
        const v = generateFromType(prop.type, prop.name, depth + 1, arrayIdx, sourceContext);
        if (v !== undefined) obj[prop.name] = v;
      }
      return obj;
    }

    case 'union': {
      // Pick first concrete (non-null/undefined) member
      const concrete = node.members.filter(m => m.kind !== 'nil');
      if (concrete.length === 0) return null;
      return generateFromType(concrete[0], propName, depth, arrayIdx, sourceContext);
    }

    case 'intersection': {
      // Merge all object members
      const merged: Record<string, unknown> = {};
      for (const m of node.members) {
        const v = generateFromType(m, propName, depth + 1, arrayIdx, sourceContext);
        if (v && typeof v === 'object' && !Array.isArray(v))
          Object.assign(merged, v);
      }
      return Object.keys(merged).length > 0 ? merged : cosmeticString(propName, arrayIdx);
    }

    case 'reference': {
      const { name: refName, typeArgs } = node;
      // Record<K, V> → small dictionary
      if (refName === 'Record' && typeArgs.length >= 2) {
        return {
          key1: generateFromType(typeArgs[1], 'value', depth + 1, 1, sourceContext),
          key2: generateFromType(typeArgs[1], 'value', depth + 1, 2, sourceContext),
        };
      }
      // Partial<T>, Required<T> → unwrap
      if ((refName === 'Partial' || refName === 'Required') && typeArgs.length >= 1) {
        return generateFromType(typeArgs[0], propName, depth, arrayIdx, sourceContext);
      }
      // Promise<T> → unwrap
      if (refName === 'Promise' && typeArgs.length >= 1) {
        return generateFromType(typeArgs[0], propName, depth, arrayIdx, sourceContext);
      }
      // Try to resolve locally-defined type/interface
      if (sourceContext) {
        const localBody = resolveLocalType(sourceContext, refName);
        if (localBody) {
          const localNode = parseType(`{ ${localBody} }`);
          return generateFromType(localNode, propName, depth + 1, arrayIdx, sourceContext);
        }
      }
      // Unresolvable reference (imported type, etc.) — fall back to name heuristic
      return generateStructuralFallback(propName);
    }

    default:
      return cosmeticString(propName, arrayIdx);
  }
}

// ── Interface Extraction (Brace-Aware) ───────────────────────────────

function extractInterfaceBody(source: string): string | null {
  // Match interface with optional extends clause:  interface Props extends Base {
  const match = source.match(
    /(?:interface\s+Props(?:\s+extends\s+[^{]+)?|type\s+Props(?:\s*=\s*)?)\s*\{/
  );
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return null;
}

/**
 * Split an interface body into top-level property chunks,
 * respecting nested braces/brackets/parens.
 */
function stripComments(body: string): string {
  let result = '';
  let i = 0;
  while (i < body.length) {
    // Line comment
    if (body[i] === '/' && body[i + 1] === '/') {
      while (i < body.length && body[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (body[i] === '/' && body[i + 1] === '*') {
      i += 2;
      while (i < body.length - 1) {
        if (body[i] === '*' && body[i + 1] === '/') { i += 2; break; }
        i++;
      }
      continue;
    }
    // String literal (don't strip inside strings)
    if (body[i] === "'" || body[i] === '"' || body[i] === '`') {
      const q = body[i];
      result += body[i++];
      while (i < body.length && body[i] !== q) {
        if (body[i] === '\\') result += body[i++];
        result += body[i++];
      }
      if (i < body.length) result += body[i++]; // closing quote
      continue;
    }
    result += body[i++];
  }
  return result;
}

function splitInterfaceProps(body: string): { name: string; typeStr: string }[] {
  const clean = stripComments(body);
  const results: { name: string; typeStr: string }[] = [];
  let current = '';
  let braces = 0, parens = 0, brackets = 0, angle = 0;
  let inString: string | null = null;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    // Track string literals so we don't count braces inside them
    if (!inString && (ch === "'" || ch === '"' || ch === '`')) {
      inString = ch;
      current += ch;
      continue;
    }
    if (inString) {
      if (ch === '\\') { current += ch + (clean[++i] || ''); continue; }
      if (ch === inString) inString = null;
      current += ch;
      continue;
    }

    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '(') parens++;
    else if (ch === ')') parens--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
    else if (ch === '<') angle++;
    else if (ch === '>') angle = Math.max(0, angle - 1);

    const atTopLevel = braces === 0 && parens === 0 && brackets === 0 && angle === 0;

    if ((ch === ';' || ch === '\n') && atTopLevel) {
      const trimmed = current.trim();
      if (trimmed) pushProp(trimmed, results);
      current = '';
    } else {
      current += ch;
    }
  }

  // Handle last chunk (no trailing semicolon/newline)
  const trimmed = current.trim();
  if (trimmed) pushProp(trimmed, results);

  return results;
}

function pushProp(
  chunk: string,
  results: { name: string; typeStr: string }[],
) {
  const colonIdx = chunk.indexOf(':');
  if (colonIdx <= 0) return;
  const rawName = chunk.slice(0, colonIdx).trim().replace(/\?$/, '').trim();
  const rawType = chunk.slice(colonIdx + 1).trim();
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(rawName)) {
    results.push({ name: rawName, typeStr: rawType });
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Name-based heuristic fallback for props that have no type information.
 * Used only when: (a) no interface/type exists, or (b) for unresolvable references.
 */
export function generateStructuralFallback(key: string): unknown {
  const k = key.toLowerCase();

  // Framework attributes — skip
  if (['class', 'classname', 'style', 'id', 'key', 'as', 'slot'].includes(k) || k.endsWith('prop'))
    return undefined;

  if (k === 'type') return 'button';
  if (k === 'lang') return 'en';

  // Images
  if (k.includes('image') || k.includes('photo') || k.includes('avatar') ||
      k.includes('banner') || k.includes('poster') || k === 'src' || k === 'img')
    return SVG_PLACEHOLDER;

  // Booleans
  if (k.startsWith('is') || k.startsWith('has') || k.startsWith('show') ||
      k === 'active' || k === 'open' || k === 'enabled')
    return true;
  if (k === 'disabled' || k === 'hidden') return false;

  // Numbers
  if (k.includes('count') || k.includes('quantity') || k.includes('price') ||
      k.includes('amount') || k.includes('rating') || k.includes('stars'))
    return 5;

  // Strings
  if (k.includes('title') || k.includes('heading') || k.includes('headline'))
    return 'Sample Title';
  if (k.includes('desc') || k.includes('body') || k.includes('summary') || k.includes('text'))
    return 'Lorem ipsum dolor sit amet.';
  if (k.includes('href') || k.includes('url') || k.includes('link')) return '#';
  if (k.includes('label') || k.includes('cta') || k.includes('btn')) return 'Click Here';
  if (k.includes('question')) return 'Sample question?';
  if (k.includes('answer')) return 'Sample answer text.';

  return 'Sample Value';
}

/**
 * Main entry point: infer structural props from an Astro component source.
 *
 * Strategy:
 *  1. Parse `interface Props` / `type Props = { ... }` → type-driven mocks
 *  1.5. Parse `Astro.props as { ... }` inline type assertion → type-driven mocks
 *  2. Fallback: `const { a, b } = Astro.props` → name-based heuristics
 */
export function inferStructuralProps(source: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const skip = new Set(['children', 'class', 'classname', 'style', 'id', 'key', 'as', 'slot']);

  function addTypedProps(body: string) {
    const propDefs = splitInterfaceProps(body);
    for (const { name, typeStr } of propDefs) {
      if (skip.has(name.toLowerCase())) continue;
      const typeNode = parseType(typeStr);
      const value = generateFromType(typeNode, name, 0, undefined, source);
      if (value !== undefined) props[name] = value;
    }
  }

  // ── Layer 1: interface Props { ... } or type Props = { ... } ──
  const body = extractInterfaceBody(source);
  if (body) addTypedProps(body);

  // ── Layer 1.5: Astro.props as { ... } (inline type assertion) ──
  if (Object.keys(props).length === 0) {
    const inlineBody = extractInlineAssertion(source);
    if (inlineBody) addTypedProps(inlineBody);
  }

  // ── Layer 2: Destructured props fallback (no type info) ──
  if (Object.keys(props).length === 0) {
    const destructureMatch = source.match(/const\s+\{([^}]+)\}\s*=\s*Astro\.props/s);
    if (destructureMatch && destructureMatch[1]) {
      for (const item of destructureMatch[1].split(',')) {
        const clean = item.trim().split(/[=:]/)[0].trim();
        if (clean && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(clean) && !skip.has(clean.toLowerCase())) {
          if (props[clean] === undefined) {
            const val = generateStructuralFallback(clean);
            if (val !== undefined) props[clean] = val;
          }
        }
      }
    }
  }

  return props;
}

/**
 * Extract the inline type body from `Astro.props as { ... }`.
 * Also resolves named references: `Astro.props as FooProps` where
 * `type FooProps = { ... }` is defined locally.
 */
function extractInlineAssertion(source: string): string | null {
  // Pattern: Astro.props as { ... }
  const inlineMatch = source.match(/Astro\.props\s+as\s*\{/);
  if (inlineMatch && inlineMatch.index !== undefined) {
    const start = inlineMatch.index + inlineMatch[0].length;
    let depth = 1;
    for (let i = start; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(start, i);
      }
    }
  }

  // Pattern: Astro.props as TypeName — resolve locally defined type
  const namedMatch = source.match(/Astro\.props\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (namedMatch) {
    const typeName = namedMatch[1];
    // Skip if it's just "Props" (already handled by Layer 1)
    if (typeName === 'Props') return null;
    // Look for local type/interface definition
    return resolveLocalType(source, typeName);
  }

  return null;
}

/**
 * Resolve a locally-defined type or interface body by name.
 * Handles: `type Foo = { ... }` and `interface Foo { ... }`
 */
function resolveLocalType(source: string, name: string): string | null {
  const pattern = new RegExp(
    `(?:type\\s+${name}\\s*=\\s*\\{|interface\\s+${name}(?:\\s+extends\\s+[^{]+)?\\s*\\{)`
  );
  const match = source.match(pattern);
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return null;
}

