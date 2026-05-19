export interface Issue {
  path: ReadonlyArray<string | number>;
  message: string;
}

export type ParseResult<T> = { success: true; data: T } | { success: false; issues: Issue[] };

export class ValidationError extends Error {
  override readonly name = "ValidationError";
  constructor(public readonly issues: ReadonlyArray<Issue>) {
    super(issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "));
  }
}

export abstract class Schema<T> {
  abstract _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<T>;

  safeParse(value: unknown): ParseResult<T> {
    return this._parse(value, []);
  }

  parse(value: unknown): T {
    const r = this._parse(value, []);
    if (!r.success) throw new ValidationError(r.issues);
    return r.data;
  }

  refine(predicate: (value: T) => boolean, message: string): Schema<T> {
    const inner = this;
    return new (class extends Schema<T> {
      _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<T> {
        const r = inner._parse(value, path);
        if (!r.success) return r;
        if (!predicate(r.data)) return { success: false, issues: [{ path, message }] };
        return r;
      }
    })();
  }

  optional(): Schema<T | undefined> {
    const inner = this;
    return new (class extends Schema<T | undefined> {
      _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<T | undefined> {
        if (value === undefined) return { success: true, data: undefined };
        return inner._parse(value, path) as ParseResult<T | undefined>;
      }
    })();
  }

  nullable(): Schema<T | null> {
    const inner = this;
    return new (class extends Schema<T | null> {
      _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<T | null> {
        if (value === null) return { success: true, data: null };
        return inner._parse(value, path) as ParseResult<T | null>;
      }
    })();
  }

  default(value: T): Schema<T> {
    const inner = this;
    return new (class extends Schema<T> {
      _parse(v: unknown, path: ReadonlyArray<string | number>): ParseResult<T> {
        if (v === undefined) return { success: true, data: value };
        return inner._parse(v, path);
      }
    })();
  }

  transform<U>(fn: (value: T) => U): Schema<U> {
    const inner = this;
    return new (class extends Schema<U> {
      _parse(v: unknown, path: ReadonlyArray<string | number>): ParseResult<U> {
        const r = inner._parse(v, path);
        if (!r.success) return r;
        try {
          return { success: true, data: fn(r.data) };
        } catch (e) {
          return { success: false, issues: [{ path, message: (e as Error).message }] };
        }
      }
    })();
  }
}

class StringSchema extends Schema<string> {
  private minLen?: number;
  private maxLen?: number;
  private patternRe?: RegExp;

  _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<string> {
    if (typeof value !== "string") return { success: false, issues: [{ path, message: "expected string" }] };
    if (this.minLen !== undefined && value.length < this.minLen) {
      return { success: false, issues: [{ path, message: `string too short (min ${this.minLen})` }] };
    }
    if (this.maxLen !== undefined && value.length > this.maxLen) {
      return { success: false, issues: [{ path, message: `string too long (max ${this.maxLen})` }] };
    }
    if (this.patternRe && !this.patternRe.test(value)) {
      return { success: false, issues: [{ path, message: `pattern mismatch: ${this.patternRe}` }] };
    }
    return { success: true, data: value };
  }
  min(n: number): this { this.minLen = n; return this; }
  max(n: number): this { this.maxLen = n; return this; }
  pattern(re: RegExp): this { this.patternRe = re; return this; }
}

class NumberSchema extends Schema<number> {
  private intOnly = false;
  private minVal?: number;
  private maxVal?: number;

  _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<number> {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { success: false, issues: [{ path, message: "expected finite number" }] };
    }
    if (this.intOnly && !Number.isInteger(value)) {
      return { success: false, issues: [{ path, message: "expected integer" }] };
    }
    if (this.minVal !== undefined && value < this.minVal) {
      return { success: false, issues: [{ path, message: `below minimum ${this.minVal}` }] };
    }
    if (this.maxVal !== undefined && value > this.maxVal) {
      return { success: false, issues: [{ path, message: `above maximum ${this.maxVal}` }] };
    }
    return { success: true, data: value };
  }
  int(): this { this.intOnly = true; return this; }
  min(n: number): this { this.minVal = n; return this; }
  max(n: number): this { this.maxVal = n; return this; }
}

class BooleanSchema extends Schema<boolean> {
  _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<boolean> {
    if (typeof value !== "boolean") return { success: false, issues: [{ path, message: "expected boolean" }] };
    return { success: true, data: value };
  }
}

class LiteralSchema<T extends string | number | boolean | null> extends Schema<T> {
  constructor(private readonly value: T) { super(); }
  _parse(v: unknown, path: ReadonlyArray<string | number>): ParseResult<T> {
    if (v !== this.value) {
      return { success: false, issues: [{ path, message: `expected literal ${JSON.stringify(this.value)}` }] };
    }
    return { success: true, data: this.value };
  }
}

class ArraySchema<T> extends Schema<T[]> {
  private minLen?: number;
  private maxLen?: number;
  constructor(private readonly item: Schema<T>) { super(); }
  _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<T[]> {
    if (!Array.isArray(value)) return { success: false, issues: [{ path, message: "expected array" }] };
    if (this.minLen !== undefined && value.length < this.minLen) {
      return { success: false, issues: [{ path, message: `array too short (min ${this.minLen})` }] };
    }
    if (this.maxLen !== undefined && value.length > this.maxLen) {
      return { success: false, issues: [{ path, message: `array too long (max ${this.maxLen})` }] };
    }
    const out: T[] = [];
    const issues: Issue[] = [];
    for (let i = 0; i < value.length; i++) {
      const r = this.item._parse(value[i], [...path, i]);
      if (r.success) out.push(r.data);
      else issues.push(...r.issues);
    }
    if (issues.length) return { success: false, issues };
    return { success: true, data: out };
  }
  min(n: number): this { this.minLen = n; return this; }
  max(n: number): this { this.maxLen = n; return this; }
}

type Shape = Record<string, Schema<unknown>>;
type InferShape<S extends Shape> = { [K in keyof S]: S[K] extends Schema<infer T> ? T : never };

class ObjectSchema<S extends Shape> extends Schema<InferShape<S>> {
  private strictMode = false;
  constructor(private readonly shape: S) { super(); }
  _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<InferShape<S>> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { success: false, issues: [{ path, message: "expected object" }] };
    }
    const out = {} as Record<string, unknown>;
    const issues: Issue[] = [];
    for (const [key, schema] of Object.entries(this.shape)) {
      const r = schema._parse((value as Record<string, unknown>)[key], [...path, key]);
      if (r.success) {
        if (r.data !== undefined) out[key] = r.data;
      } else {
        issues.push(...r.issues);
      }
    }
    if (this.strictMode) {
      for (const key of Object.keys(value as object)) {
        if (!(key in this.shape)) {
          issues.push({ path: [...path, key], message: "unknown property" });
        }
      }
    }
    if (issues.length) return { success: false, issues };
    return { success: true, data: out as InferShape<S> };
  }
  strict(): this { this.strictMode = true; return this; }
}

class UnionSchema<T> extends Schema<T> {
  constructor(private readonly options: ReadonlyArray<Schema<unknown>>) { super(); }
  _parse(value: unknown, path: ReadonlyArray<string | number>): ParseResult<T> {
    const all: Issue[] = [];
    for (const opt of this.options) {
      const r = opt._parse(value, path);
      if (r.success) return { success: true, data: r.data as T };
      all.push(...r.issues);
    }
    return { success: false, issues: [{ path, message: "no union variant matched" }, ...all] };
  }
}

export const v = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  literal: <T extends string | number | boolean | null>(value: T) => new LiteralSchema(value),
  array: <T>(item: Schema<T>) => new ArraySchema(item),
  object: <S extends Shape>(shape: S) => new ObjectSchema(shape),
  union: <T extends ReadonlyArray<Schema<unknown>>>(...options: T) => new UnionSchema<T[number] extends Schema<infer U> ? U : never>(options),
};

export type Infer<S> = S extends Schema<infer T> ? T : never;
