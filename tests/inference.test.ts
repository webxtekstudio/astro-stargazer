import { describe, it, expect } from 'vitest';
import {
  inferStructuralProps,
  generateStructuralFallback,
  parseType,
  generateFromType,
} from '../src/inference/fuzzer.js';

describe('Type Parser', () => {
  it('parses primitive types', () => {
    expect(parseType('string')).toEqual({ kind: 'primitive', name: 'string' });
    expect(parseType('number')).toEqual({ kind: 'primitive', name: 'number' });
    expect(parseType('boolean')).toEqual({ kind: 'primitive', name: 'boolean' });
  });

  it('parses string literals', () => {
    expect(parseType("'dark'")).toEqual({ kind: 'literal', value: 'dark' });
  });

  it('parses array types (postfix)', () => {
    const node = parseType('string[]');
    expect(node).toEqual({ kind: 'array', element: { kind: 'primitive', name: 'string' } });
  });

  it('parses Array<T> generic syntax', () => {
    const node = parseType('Array<number>');
    expect(node).toEqual({ kind: 'array', element: { kind: 'primitive', name: 'number' } });
  });

  it('parses object types', () => {
    const node = parseType('{ name: string; age: number }');
    expect(node.kind).toBe('object');
    if (node.kind === 'object') {
      expect(node.properties).toHaveLength(2);
      expect(node.properties[0].name).toBe('name');
      expect(node.properties[0].type).toEqual({ kind: 'primitive', name: 'string' });
      expect(node.properties[1].name).toBe('age');
    }
  });

  it('parses nested object types in arrays', () => {
    const node = parseType('{ question: string; answer: string }[]');
    expect(node.kind).toBe('array');
    if (node.kind === 'array') {
      expect(node.element.kind).toBe('object');
      if (node.element.kind === 'object') {
        expect(node.element.properties).toHaveLength(2);
        expect(node.element.properties[0].name).toBe('question');
        expect(node.element.properties[1].name).toBe('answer');
      }
    }
  });

  it('parses union types', () => {
    const node = parseType('string | number | null');
    expect(node.kind).toBe('union');
    if (node.kind === 'union') {
      expect(node.members).toHaveLength(3);
    }
  });

  it('parses complex nested types (like FaqAccordion)', () => {
    const node = parseType('{ heading: string; items: { question: string; answer: string }[] }[]');
    expect(node.kind).toBe('array');
    if (node.kind === 'array') {
      expect(node.element.kind).toBe('object');
      if (node.element.kind === 'object') {
        const heading = node.element.properties.find(p => p.name === 'heading');
        const items = node.element.properties.find(p => p.name === 'items');
        expect(heading?.type).toEqual({ kind: 'primitive', name: 'string' });
        expect(items?.type.kind).toBe('array');
      }
    }
  });

  it('parses optional properties', () => {
    const node = parseType('{ title?: string }');
    if (node.kind === 'object') {
      expect(node.properties[0].optional).toBe(true);
    }
  });
});

describe('Type-Driven Mock Generator', () => {
  it('generates strings from string type', () => {
    const node = parseType('string');
    expect(typeof generateFromType(node, 'title')).toBe('string');
  });

  it('generates numbers from number type', () => {
    const node = parseType('number');
    expect(typeof generateFromType(node, 'count')).toBe('number');
  });

  it('generates correct literal values', () => {
    expect(generateFromType(parseType("'dark'"), 'theme')).toBe('dark');
    expect(generateFromType(parseType('42'), 'magicNumber')).toBe(42);
    expect(generateFromType(parseType('true'), 'flag')).toBe(true);
  });

  it('generates arrays with correct element structure', () => {
    const node = parseType('{ question: string; answer: string }[]');
    const result = generateFromType(node, 'faq') as any[];
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Each item has EXACTLY the fields from the type, nothing more
    expect(Object.keys(result[0]).sort()).toEqual(['answer', 'question']);
    expect(typeof result[0].question).toBe('string');
    expect(typeof result[0].answer).toBe('string');
  });

  it('generates nested structures matching the type exactly', () => {
    const node = parseType('{ heading: string; items: { question: string; answer: string }[] }[]');
    const result = generateFromType(node, 'topics') as any[];
    expect(Array.isArray(result)).toBe(true);
    const first = result[0];
    expect(Object.keys(first).sort()).toEqual(['heading', 'items']);
    expect(typeof first.heading).toBe('string');
    expect(Array.isArray(first.items)).toBe(true);
    expect(Object.keys(first.items[0]).sort()).toEqual(['answer', 'question']);
  });

  it('picks first concrete member from union types', () => {
    const node = parseType('string | undefined');
    const result = generateFromType(node, 'name');
    expect(typeof result).toBe('string');
  });

  it('handles Record<string, T>', () => {
    const node = parseType('Record<string, number>');
    const result = generateFromType(node, 'scores') as any;
    expect(typeof result.key1).toBe('number');
    expect(typeof result.key2).toBe('number');
  });
});

describe('inferStructuralProps (integration)', () => {
  it('generates type-driven props from a simple interface', () => {
    const src = `
      ---
      interface Props {
        title: string;
        count: number;
        isOpen?: boolean;
      }
      const { title, count, isOpen } = Astro.props;
      ---
      <div>{title}</div>
    `;
    const props = inferStructuralProps(src);
    expect(typeof props.title).toBe('string');
    expect(typeof props.count).toBe('number');
    expect(typeof props.isOpen).toBe('boolean');
  });

  it('generates accurate nested structure for FaqAccordion-like component', () => {
    const src = `
      ---
      interface Props {
        title: string;
        subtitle: string;
        faq?: { question: string; answer: string }[];
        topics?: { heading: string; items: { question: string; answer: string }[] }[];
      }
      const { faq, topics } = Astro.props as Props;
      ---
    `;
    const props = inferStructuralProps(src);
    expect(typeof props.title).toBe('string');
    expect(typeof props.subtitle).toBe('string');

    // faq: array of { question, answer }
    const faq = props.faq as any[];
    expect(Array.isArray(faq)).toBe(true);
    expect(Object.keys(faq[0]).sort()).toEqual(['answer', 'question']);

    // topics: array of { heading, items: [{ question, answer }] }
    const topics = props.topics as any[];
    expect(Array.isArray(topics)).toBe(true);
    expect(Object.keys(topics[0]).sort()).toEqual(['heading', 'items']);
    expect(Array.isArray(topics[0].items)).toBe(true);
    expect(Object.keys(topics[0].items[0]).sort()).toEqual(['answer', 'question']);
  });

  it('falls back to name heuristics for untyped destructuring', () => {
    const src = `
      ---
      const { title, description } = Astro.props;
      ---
      <div>{title}</div>
    `;
    const props = inferStructuralProps(src);
    expect(typeof props.title).toBe('string');
    expect(typeof props.description).toBe('string');
  });

  it('parses Astro.props as { ... } inline assertion', () => {
    const src = `
      ---
      const props = Astro.props as {
        title: string;
        description: string;
        videoSrc: string;
        autoplay?: boolean;
      };
      ---
    `;
    const props = inferStructuralProps(src);
    expect(typeof props.title).toBe('string');
    expect(typeof props.description).toBe('string');
    expect(typeof props.videoSrc).toBe('string');
    expect(typeof props.autoplay).toBe('boolean');
  });

  it('resolves Astro.props as NamedType with local type definition', () => {
    const src = `
      ---
      type TeamMember = {
        name: string;
        popup: {
          eyebrow: string;
          title: string;
        };
      };

      const props = Astro.props as {
        title: string;
        members: TeamMember[];
      };
      ---
    `;
    const props = inferStructuralProps(src);
    expect(typeof props.title).toBe('string');
    // members is TeamMember[] — unresolvable ref, falls back to name heuristic
    expect(props.members).toBeDefined();
  });
});

describe('Robustness: comments in interface', () => {
  it('ignores line comments inside interface', () => {
    const src = `
      ---
      interface Props {
        // The main heading
        title: string;
        // Number of items to show
        count: number;
      }
      ---
    `;
    const props = inferStructuralProps(src);
    expect(typeof props.title).toBe('string');
    expect(typeof props.count).toBe('number');
    expect(Object.keys(props)).not.toContain('The');
  });

  it('ignores block comments inside interface', () => {
    const src = `
      ---
      interface Props {
        /** The primary title */
        title: string;
        /* count is deprecated */
        count: number;
      }
      ---
    `;
    const props = inferStructuralProps(src);
    expect(typeof props.title).toBe('string');
    expect(typeof props.count).toBe('number');
  });
});

describe('Robustness: function/arrow types', () => {
  it('skips arrow function props', () => {
    const node = parseType('() => void');
    expect(node.kind).toBe('nil');
  });

  it('skips arrow functions with args', () => {
    const node = parseType('(e: Event) => void');
    expect(node.kind).toBe('nil');
  });

  it('does not include function props in inferred output', () => {
    const src = `
      ---
      interface Props {
        title: string;
        onClick?: () => void;
        onSubmit?: (data: FormData) => Promise<void>;
      }
      ---
    `;
    const props = inferStructuralProps(src);
    expect(typeof props.title).toBe('string');
    // Function props should be undefined (skipped)
    expect(props.onClick).toBeUndefined();
    expect(props.onSubmit).toBeUndefined();
  });
});

describe('Robustness: interface extends', () => {
  it('extracts own props from interface with extends clause', () => {
    const src = `
      ---
      interface Props extends HTMLAttributes<'div'> {
        title: string;
        variant: 'primary' | 'secondary';
      }
      ---
    `;
    const props = inferStructuralProps(src);
    expect(typeof props.title).toBe('string');
    expect(props.variant).toBe('primary');
  });
});

describe('Robustness: typeof and keyof', () => {
  it('parses typeof as transparent (falls back gracefully)', () => {
    const node = parseType('typeof someVar');
    // typeof someVar -> parses 'someVar' as a reference
    expect(node.kind).toBe('reference');
  });

  it('parses keyof as transparent', () => {
    const node = parseType('keyof SomeType');
    expect(node.kind).toBe('reference');
  });
});

describe('Robustness: string literal unions', () => {
  it('picks the first literal from a union', () => {
    const node = parseType("'sm' | 'md' | 'lg' | 'xl'");
    const val = generateFromType(node, 'size');
    expect(val).toBe('sm');
  });

  it('works in full interface context', () => {
    const src = `
      ---
      interface Props {
        size: 'sm' | 'md' | 'lg';
        variant?: 'primary' | 'secondary' | 'ghost';
        disabled?: boolean;
      }
      ---
    `;
    const props = inferStructuralProps(src);
    expect(props.size).toBe('sm');
    expect(props.variant).toBe('primary');
    expect(props.disabled).toBe(false);
  });
});

describe('Structural Fallback (name-based legacy)', () => {
  it('generates text for title-like props', () => {
    expect(typeof generateStructuralFallback('title')).toBe('string');
  });

  it('returns undefined for framework attributes', () => {
    expect(generateStructuralFallback('class')).toBeUndefined();
    expect(generateStructuralFallback('style')).toBeUndefined();
  });
});
