import { describe, it, expect } from "vitest";
import { v, ValidationError, type Infer } from "../src/index.js";

describe("primitives", () => {
  it("string", () => {
    expect(v.string().parse("hi")).toBe("hi");
    expect(() => v.string().parse(42)).toThrow(ValidationError);
  });
  it("number", () => {
    expect(v.number().parse(3.14)).toBe(3.14);
    expect(() => v.number().parse("3")).toThrow();
    expect(() => v.number().parse(Infinity)).toThrow();
  });
  it("boolean", () => {
    expect(v.boolean().parse(true)).toBe(true);
    expect(() => v.boolean().parse(1)).toThrow();
  });
  it("literal", () => {
    expect(v.literal("ok").parse("ok")).toBe("ok");
    expect(() => v.literal("ok").parse("nope")).toThrow();
  });
});

describe("string constraints", () => {
  it("min/max", () => {
    expect(() => v.string().min(3).parse("ab")).toThrow();
    expect(() => v.string().max(2).parse("abc")).toThrow();
  });
  it("pattern", () => {
    expect(v.string().pattern(/^[a-z]+$/).parse("abc")).toBe("abc");
    expect(() => v.string().pattern(/^[a-z]+$/).parse("ABC")).toThrow();
  });
});

describe("number constraints", () => {
  it("int", () => {
    expect(v.number().int().parse(5)).toBe(5);
    expect(() => v.number().int().parse(5.5)).toThrow();
  });
  it("min/max", () => {
    expect(() => v.number().min(10).parse(5)).toThrow();
    expect(() => v.number().max(10).parse(15)).toThrow();
  });
});

describe("object", () => {
  const User = v.object({
    name: v.string().min(1),
    age: v.number().int().min(0),
    role: v.literal("admin").optional(),
  });

  it("accepts valid", () => {
    expect(User.parse({ name: "Vlad", age: 30 })).toEqual({ name: "Vlad", age: 30 });
  });

  it("includes optional when present", () => {
    expect(User.parse({ name: "Vlad", age: 30, role: "admin" })).toMatchObject({ role: "admin" });
  });

  it("reports nested error paths", () => {
    const r = User.safeParse({ name: "", age: -1 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues.find((i) => i.path[0] === "name")).toBeDefined();
      expect(r.issues.find((i) => i.path[0] === "age")).toBeDefined();
    }
  });

  it("strict mode rejects extras", () => {
    const strict = v.object({ name: v.string() }).strict();
    const r = strict.safeParse({ name: "x", extra: 1 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]!.path[0]).toBe("extra");
  });
});

describe("array", () => {
  it("validates each element", () => {
    const Nums = v.array(v.number().int());
    expect(Nums.parse([1, 2, 3])).toEqual([1, 2, 3]);
    expect(() => Nums.parse([1, "two"])).toThrow();
  });
  it("min/max length", () => {
    expect(() => v.array(v.number()).min(2).parse([1])).toThrow();
    expect(() => v.array(v.number()).max(2).parse([1, 2, 3])).toThrow();
  });
});

describe("union", () => {
  it("accepts any matching variant", () => {
    const StringOrNumber = v.union(v.string(), v.number());
    expect(StringOrNumber.parse("hi")).toBe("hi");
    expect(StringOrNumber.parse(42)).toBe(42);
    expect(() => StringOrNumber.parse(true)).toThrow();
  });
  it("discriminated union with literals", () => {
    const Result = v.union(
      v.object({ kind: v.literal("ok"), value: v.number() }),
      v.object({ kind: v.literal("err"), message: v.string() }),
    );
    expect(Result.parse({ kind: "ok", value: 1 })).toMatchObject({ kind: "ok", value: 1 });
    expect(Result.parse({ kind: "err", message: "x" })).toMatchObject({ kind: "err" });
  });
});

describe("optional, nullable, default", () => {
  it("optional allows undefined", () => {
    const s = v.string().optional();
    expect(s.parse(undefined)).toBeUndefined();
    expect(s.parse("x")).toBe("x");
  });
  it("nullable allows null", () => {
    const s = v.string().nullable();
    expect(s.parse(null)).toBeNull();
    expect(s.parse("x")).toBe("x");
  });
  it("default supplies value when undefined", () => {
    const s = v.string().default("fallback");
    expect(s.parse(undefined)).toBe("fallback");
    expect(s.parse("x")).toBe("x");
  });
});

describe("refine + transform", () => {
  it("refine adds custom validation", () => {
    const s = v.number().refine((n) => n % 2 === 0, "must be even");
    expect(() => s.parse(3)).toThrow(/even/);
    expect(s.parse(4)).toBe(4);
  });
  it("transform converts value", () => {
    const s = v.string().transform((s) => s.length);
    expect(s.parse("hello")).toBe(5);
  });
  it("transform errors are wrapped", () => {
    const s = v.string().transform(() => { throw new Error("boom"); });
    const r = s.safeParse("x");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]!.message).toBe("boom");
  });
});

describe("safeParse vs parse", () => {
  it("safeParse never throws", () => {
    const r = v.string().safeParse(42);
    expect(r.success).toBe(false);
  });
  it("parse throws ValidationError", () => {
    try { v.string().parse(42); }
    catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});

describe("type inference", () => {
  it("Infer<typeof schema> gives correct TS type", () => {
    const User = v.object({ name: v.string(), age: v.number().int() });
    type U = Infer<typeof User>;
    // Compile-time check via assignment; runtime check is just to keep the test active.
    const u: U = { name: "x", age: 1 };
    expect(u.name).toBe("x");
  });
});
