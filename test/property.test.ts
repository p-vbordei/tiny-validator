import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { v, ValidationError } from "../src/index.js";

describe("property: parse vs safeParse are consistent", () => {
  it("for strings", () => {
    const schema = v.string();
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const r = schema.safeParse(value);
        if (r.success) {
          expect(schema.parse(value)).toEqual(r.data);
        } else {
          expect(() => schema.parse(value)).toThrow(ValidationError);
        }
      }),
    );
  });

  it("for objects with int age", () => {
    const schema = v.object({ name: v.string(), age: v.number().int().min(0) });
    fc.assert(
      fc.property(
        fc.record({
          name: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
          age: fc.oneof(fc.integer(), fc.float(), fc.string()),
        }),
        (value) => {
          const r = schema.safeParse(value);
          if (r.success) {
            expect(typeof r.data.name).toBe("string");
            expect(Number.isInteger(r.data.age)).toBe(true);
            expect(r.data.age).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });
});

describe("property: refine narrows the type space", () => {
  it("a value that passes refine(p) also passes the base", () => {
    const schema = v.number().refine((n) => n > 0, "must be positive");
    fc.assert(
      fc.property(fc.float({ min: -1000, max: 1000, noNaN: true }), (n) => {
        const r = schema.safeParse(n);
        if (r.success) {
          expect(r.data > 0).toBe(true);
          expect(typeof r.data).toBe("number");
        }
      }),
    );
  });
});
