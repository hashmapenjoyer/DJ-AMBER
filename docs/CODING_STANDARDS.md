# DJ-AMBER Coding Standards

This document defines the coding standards for the DJ-AMBER project and how they are enforced.

## 1) Adopted Standard

We adopt the published TypeScript style guide:
- https://ts.dev/style/#goals

Where our repository adds additional constraints (lint rules, formatting options, or project conventions), those are documented below.

---

## 2) Formatting (Prettier)

**Tool:** Prettier  
**Purpose:** Consistent formatting across the codebase.

### Configuration (from `.prettierrc`)
- Semicolons: `true`
- Quotes: single quotes
- Trailing commas: `all`
- Print width: `100`
- Indentation: 2 spaces
- Arrow parens: always

### Local scripts
- Format files: `npm run format`
- Check formatting: `npm run format:check`

### Ignored paths (from `.prettierignore`)
- `node_modules/`
- `dist/`

> Note: Formatting checks are currently available as scripts, but are **not yet enforced in CI**.  
> [WILL IMPLEMENT LATER: Add `npm run format:check` to CI.]

---

## 3) Linting (ESLint + TypeScript ESLint + React)

**Tooling:** ESLint (flat config) with TypeScript ESLint + React plugins  
**Purpose:** Catch bugs, enforce best practices, and ensure consistent conventions across developers.

### Local scripts
- Lint: `npm run lint`
- Lint + auto-fix: `npm run lint:fix`

### Key enforced rules (from `eslint.config.js`)

#### Variables & correctness
- No `var` (`no-var`)
- Prefer `const` where possible (`prefer-const`)
- Strict equality required (`eqeqeq`)

#### TypeScript constraints
- Prefer `private` keyword over `#private` fields (`no-restricted-syntax`)
- Disallow wrapper types `String/Boolean/Number` (`@typescript-eslint/no-wrapper-object-types`)
- Disallow `Array()` constructor (`@typescript-eslint/no-array-constructor`)
- Must throw errors as `throw new Error(...)` (`@typescript-eslint/only-throw-error`)
- Disallow `@ts-ignore`; allow `@ts-expect-error` only with description (`@typescript-eslint/ban-ts-comment`)
- Type assertions must use `as` syntax (`@typescript-eslint/consistent-type-assertions`)
- Prefer `import type` for type-only imports (`@typescript-eslint/consistent-type-imports`)
- `any` is discouraged (warn) (`@typescript-eslint/no-explicit-any`)
- Disallow unary `+` coercion; allow `!!` for boolean coercion (`no-implicit-coercion`)

#### Naming conventions
Enforced via `@typescript-eslint/naming-convention`:
- Default identifiers: `camelCase`
- Functions (including React components): `camelCase` or `PascalCase`
- Types/interfaces/enums: `PascalCase`
- Interfaces must NOT start with `I` (e.g., `IUser` is disallowed)
- Some cases allow flexibility (destructuring, object literal properties)

#### JavaScript globals restrictions
- Disallow `parseInt` / `parseFloat` (use `Number(...)` instead) (`no-restricted-globals`)

#### React rules
- React Hooks rules enforced (`eslint-plugin-react-hooks`)
- `react/react-in-jsx-scope`: off (modern React/Vite)
- `react/prop-types`: off (TypeScript is source of truth)

---

## 4) Editor Standard (VS Code)

The repository includes workspace settings to reduce formatting drift across developers:
- Prettier as default formatter
- Format on save enabled
- ESLint fixes on save (explicit)

Recommended extensions:
- ESLint
- Prettier

---

## 5) Continuous Integration (Current Enforcement)

### What is enforced today '2/24/2026'
On every pull request to `main`, GitHub Actions runs:
- `npm ci`
- `npm run lint`

This ensures ESLint rules must pass before merging.

### Not enforced yet (planned)
The following checks are **available locally** but are **not yet required in CI**:
- Prettier formatting check: `npm run format:check`
- Build validation: `npm run build`

[WILL IMPLEMENT LATER: Add `npm run format:check` and `npm run build` to CI.]

---

## 6) Updating Standards

If the team changes a rule:
1. Update the config files (`eslint.config.js`, `.prettierrc`, etc.)
2. Update this document so standards and enforcement stay aligned
3. Apply lint/format fixes so the repository remains consistent