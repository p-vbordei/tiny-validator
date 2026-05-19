# tiny-validator

[![ci](https://github.com/p-vbordei/tiny-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/tiny-validator/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/%40p-vbordei%2Ftiny-validator.svg)](https://www.npmjs.com/package/@p-vbordei/tiny-validator)
[![downloads](https://img.shields.io/npm/dm/%40p-vbordei%2Ftiny-validator.svg)](https://www.npmjs.com/package/@p-vbordei/tiny-validator)
[![bundle](https://img.shields.io/bundlejs/size/%40p-vbordei%2Ftiny-validator)](https://bundlejs.com/?q=%40p-vbordei%2Ftiny-validator)

A Zod-like schema validator in ~250 LoC. Chainable builders, full TypeScript inference, `refine` / `transform`, helpful error paths. Zero dependencies.

```ts
import { v, type Infer } from "@p-vbordei/tiny-validator";

const User = v.object({
  name: v.string().min(1),
  age: v.number().int().min(0),
  email: v.string().pattern(/@/),
  role: v.union(v.literal("admin"), v.literal("user")).default("user"),
});

type User = Infer<typeof User>;
// { name: string; age: number; email: string; role: "admin" | "user" }

const u = User.parse(input);              // throws ValidationError on invalid

const r = User.safeParse(input);          // never throws
if (!r.success) {
  for (const issue of r.issues) {
    console.warn(`${issue.path.join(".")}: ${issue.message}`);
  }
}
```

## Install

```sh
npm install @p-vbordei/tiny-validator
```

## API

### Builders

```ts
v.string()                          // .min(n), .max(n), .pattern(regex)
v.number()                          // .int(), .min(n), .max(n)
v.boolean()
v.literal(value)
v.array(itemSchema)                 // .min(n), .max(n)
v.object({ key: schema, ... })      // .strict()
v.union(schemaA, schemaB, ...)
```

### Modifiers (chain after any builder)

```ts
schema.optional()                   // allows undefined
schema.nullable()                   // allows null
schema.default(value)               // supply value when input is undefined
schema.refine(predicate, message)
schema.transform(fn)                // converts the parsed value
```

### Methods

```ts
schema.parse(value): T              // throws ValidationError on failure
schema.safeParse(value): { success, data | issues }
```

### `ValidationError`

```ts
err.issues  // [{ path: ["age"], message: "expected integer" }, ...]
err.message // joined issue summary
```

## What's missing (vs Zod)

This is deliberately small. No: discriminated-union convenience helpers, async refinements, recursive lazy schemas, intersections, records, sets, maps, dates, branded types, error customization beyond `refine`/`transform`. For any of those, use Zod (~12KB minified) — for the simple cases here, `tiny-validator` is ~3KB.

## License

Apache-2.0 © Vlad Bordei
