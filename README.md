# tiny-validator

[![ci](https://github.com/p-vbordei/tiny-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/tiny-validator/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/%40p-vbordei%2Ftiny-validator.svg)](https://www.npmjs.com/package/@p-vbordei/tiny-validator)
[![downloads](https://img.shields.io/npm/dm/%40p-vbordei%2Ftiny-validator.svg)](https://www.npmjs.com/package/@p-vbordei/tiny-validator)
[![bundle](https://img.shields.io/bundlejs/size/%40p-vbordei%2Ftiny-validator)](https://bundlejs.com/?q=%40p-vbordei%2Ftiny-validator)

> A Zod-like schema validator in ~250 LoC. Chainable builders, full TypeScript inference, `refine` / `transform`, helpful error paths. Zero dependencies.

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

Works with Node 20+, browsers, Bun, Deno. ESM + CJS.

## Why

Zod is excellent — but for simple cases its ~12KB and complex type-level machinery is overkill. `tiny-validator` covers ~80% of typical use cases (primitives, objects, arrays, unions, refine, transform) in ~3KB.

When you want the deep features (discriminated unions with `discriminator`, async refinements, recursive lazy schemas, branded types), use Zod. When you just need to validate env vars, request bodies, or LLM tool calls, this is enough.

## Recipes

### Validate env vars

```ts
import { v } from "@p-vbordei/tiny-validator";

const Env = v.object({
  PORT: v.string().pattern(/^\d+$/).transform(Number),
  NODE_ENV: v.union(v.literal("development"), v.literal("production")),
  DATABASE_URL: v.string().min(1),
  DEBUG: v.string().optional(),
});

const env = Env.parse(process.env);
// env.PORT is `number`, env.NODE_ENV is "development" | "production"
```

### Validate request body (Express/Fastify)

```ts
import { v, ValidationError } from "@p-vbordei/tiny-validator";

const CreatePost = v.object({
  title: v.string().min(1).max(200),
  body: v.string().min(1),
  tags: v.array(v.string()).max(10).default([]),
});

app.post("/posts", async (req, res) => {
  try {
    const data = CreatePost.parse(req.body);
    const post = await db.createPost(data);
    res.json(post);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ errors: err.issues });
    } else {
      throw err;
    }
  }
});
```

### Validate LLM tool call args

```ts
import { v } from "@p-vbordei/tiny-validator";

const WeatherArgs = v.object({
  location: v.string().min(1),
  units: v.union(v.literal("c"), v.literal("f")).default("c"),
});

async function callTool(rawArgs: string) {
  const parsed = JSON.parse(rawArgs);
  const args = WeatherArgs.parse(parsed);
  return await fetchWeather(args.location, args.units);
}
```

### Discriminated union pattern

```ts
import { v } from "@p-vbordei/tiny-validator";

const Result = v.union(
  v.object({ kind: v.literal("ok"), value: v.number() }),
  v.object({ kind: v.literal("err"), message: v.string() }),
);

const r = Result.parse(input);
if (r.kind === "ok") use(r.value);
else                 logError(r.message);
```

### Custom refinement

```ts
import { v } from "@p-vbordei/tiny-validator";

const StrongPassword = v.string()
  .min(8)
  .refine((s) => /[A-Z]/.test(s), "must contain an uppercase letter")
  .refine((s) => /\d/.test(s), "must contain a digit")
  .refine((s) => /[^A-Za-z0-9]/.test(s), "must contain a symbol");
```

### Coerce and transform

```ts
import { v } from "@p-vbordei/tiny-validator";

const PortSchema = v.string()
  .pattern(/^\d+$/)
  .transform(Number)
  .refine((n) => n > 0 && n < 65536, "port out of range");

PortSchema.parse("3000");  // 3000 (number)
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

### Type inference

```ts
import { v, type Infer } from "@p-vbordei/tiny-validator";

const User = v.object({ name: v.string(), age: v.number() });
type User = Infer<typeof User>;  // { name: string; age: number }
```

## What's missing (vs Zod)

Deliberate omissions to stay small:

- ❌ Async refinements (use sync only)
- ❌ Recursive lazy schemas (no self-referencing types)
- ❌ Intersections (`A.and(B)`)
- ❌ Records, sets, maps, dates, branded types
- ❌ Discriminated union convenience helpers (`z.discriminatedUnion`)
- ❌ Error customization beyond `refine`/`transform` messages

For any of those, use Zod (~12KB minified). For the simple cases here, `tiny-validator` is ~3KB.

## License

Apache-2.0 © Vlad Bordei
