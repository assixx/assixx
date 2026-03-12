# The Power of Ten -- Rules for Safety-Critical Code

> **Source:** Gerard J. Holzmann, NASA/JPL Laboratory for Reliable Software
> **Original Paper:** "The Power of 10: Rules for Developing Safety-Critical Code" (IEEE Computer, June 2006)
> **Adapted for:** TypeScript/JavaScript (Assixx Project)
> **Version:** 2.1.0
> **Updated:** 2026-02-17

---

## Why These Rules?

Most coding guidelines contain 100+ rules -- and get ignored. Holzmann argues: **10 strict, verifiable rules** are more effective than 100 vague recommendations.

These rules were developed at NASA/JPL for **mission-critical software** -- code that controls spacecraft, aircraft, and nuclear power plants. A bug can kill.

> _"The rules act like the seat-belt in your car: initially they are perhaps a little uncomfortable, but after a while their use becomes second-nature and not using them becomes unimaginable."_
> -- Gerard J. Holzmann

---

## The 10 Rules

### Rule 1: Simple Control Flow

**Original (C):**

> Restrict all code to very simple control flow constructs -- do not use `goto` statements, `setjmp` or `longjmp` constructs, and direct or indirect recursion.

**TypeScript Adaptation:**

```typescript
// FORBIDDEN -- unbounded recursion
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1); // no depth limit, stack overflow risk
}

// CORRECT -- iterative
function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

// FORBIDDEN -- indirect recursion (cycle)
function processA(data: Data): void {
  processB(data); // calls processA
}
function processB(data: Data): void {
  processA(data); // cycle!
}

// CORRECT -- linear processing
function processData(data: Data): void {
  const stepA = transformA(data);
  const stepB = transformB(stepA);
  return stepB;
}
```

**Rationale:**

- Simple control flow = better verifiability
- Without recursion: acyclic call graph, provably terminating
- Static analysis can compute stack usage

**Exception -- Bounded Tree Traversal:**

Tree structures (menus, file systems, org charts) are naturally recursive. Recursion is allowed when **both** conditions are met:

1. A `MAX_DEPTH` constant limits recursion depth
2. The data structure has a known, finite depth

```typescript
// ALLOWED -- bounded recursion for tree traversal
const MAX_DEPTH = 10;

function filterMenuItems(items: MenuItem[], depth = 0): MenuItem[] {
  if (depth >= MAX_DEPTH) {
    return items; // safety limit reached
  }

  return items
    .filter((item) => item.isVisible)
    .map((item) => ({
      ...item,
      children: item.children !== undefined ? filterMenuItems(item.children, depth + 1) : undefined,
    }));
}
```

Unbounded recursion and indirect recursion remain forbidden. Tail-call optimization is not guaranteed in JS/TS.

---

### Rule 2: Fixed Upper Bounds on All Loops

**Original (C):**

> All loops must have a fixed upper-bound. It must be trivially possible for a checking tool to prove statically that a preset upper-bound on the number of iterations of a loop cannot be exceeded.

**TypeScript Adaptation:**

```typescript
// FORBIDDEN -- unknown upper bound
while (condition) {
  // can run forever
}

// FORBIDDEN -- external dependency without limit
while (await fetchNextPage()) {
  processPage();
}

// CORRECT -- explicit upper bound
const MAX_ITERATIONS = 10000;
let iterations = 0;

while (condition && iterations < MAX_ITERATIONS) {
  iterations++;
  // logic
}

if (iterations >= MAX_ITERATIONS) {
  throw new Error(`Loop exceeded maximum iterations: ${MAX_ITERATIONS}`);
}

// CORRECT -- for...of with known array
for (const item of items) {
  process(item); // items.length is known
}

// CORRECT -- for with explicit limit
const MAX_PAGES = 100;
for (let page = 0; page < MAX_PAGES; page++) {
  const data = await fetchPage(page);
  if (data.length === 0) break;
  processPage(data);
}
```

**Rationale:**

- Prevents runaway code and infinite loops
- Statically provable that code terminates
- On exceeding limit: explicit error instead of silent hang

---

### Rule 3: No Dynamic Memory Allocation After Initialization

**Original (C):**

> Do not use dynamic memory allocation after initialization.

**TypeScript Adaptation:**

JavaScript/TypeScript uses garbage collection, so the original C rule does not apply directly. In a Node.js web backend, the real danger is **memory leaks**, not allocation itself.

**Adapted rule: Prevent memory leaks. Clean up all resources.**

```typescript
// WRONG -- event listener never removed (memory leak)
class ChatService {
  constructor(private readonly emitter: EventEmitter) {
    emitter.on('message', this.handleMessage.bind(this));
    // never cleaned up -- accumulates listeners on each instantiation
  }
}

// CORRECT -- cleanup on destroy
class ChatService implements OnModuleDestroy {
  private readonly handler = this.handleMessage.bind(this);

  constructor(private readonly emitter: EventEmitter) {
    emitter.on('message', this.handler);
  }

  onModuleDestroy(): void {
    this.emitter.off('message', this.handler);
  }
}

// WRONG -- interval never cleared
function startPolling(): void {
  setInterval(async () => {
    await checkForUpdates();
  }, 5000);
  // no way to stop this
}

// CORRECT -- clearable interval
function startPolling(): { stop: () => void } {
  const id = setInterval(async () => {
    await checkForUpdates();
  }, 5000);

  return { stop: () => clearInterval(id) };
}

// WRONG -- subscription leak in Svelte
let unsubscribe: (() => void) | undefined;
$effect(() => {
  unsubscribe = store.subscribe(handler);
  // never unsubscribed on cleanup
});

// CORRECT -- cleanup in effect return
$effect(() => {
  const unsubscribe = store.subscribe(handler);
  return () => unsubscribe();
});
```

**Rationale:**

- Leaked event listeners, intervals, and subscriptions accumulate over time
- Node.js processes run for weeks/months -- even small leaks compound
- GC cannot collect objects still referenced by forgotten listeners

**Checklist:**

- Every `addEventListener` / `.on()` has a matching `removeEventListener` / `.off()`
- Every `setInterval` / `setTimeout` has a matching `clearInterval` / `clearTimeout`
- Every subscription (SSE, WebSocket, Observable) is unsubscribed on destroy
- Svelte `$effect` returns cleanup functions when needed

---

### Rule 4: Maximum Function Length ~60 Lines

**Original (C):**

> No function should be longer than what can be printed on a single sheet of paper in a standard reference format with one line per statement and one line per declaration. Typically, this means no more than about 60 lines of code per function.

**TypeScript Adaptation:**

```typescript
// FORBIDDEN -- function over 60 lines
async function handleUserRegistration(data: RegistrationData): Promise<User> {
  // 150 lines of code...
  // Validation, DB queries, email, logging, error handling...
}

// CORRECT -- split into logical units
async function handleUserRegistration(data: RegistrationData): Promise<User> {
  const validated = validateRegistrationData(data); // ~15 lines
  const user = await createUserInDatabase(validated); // ~20 lines
  await sendWelcomeEmail(user); // ~10 lines
  logRegistration(user); // ~5 lines
  return user;
}
```

**Rationale:**

- Each function = one understandable, testable unit
- Fits on one screen/page
- Long functions = sign of bad structure

**Enforcement:** ESLint rule `max-lines-per-function` set to 60.

---

### Rule 5: Minimum 2 Assertions Per Function

**Original (C):**

> The assertion density of the code should average to a minimum of two assertions per function. Assertions are used to check for anomalous conditions that should never happen in real-life executions.

**TypeScript Adaptation:**

```typescript
// INSUFFICIENT -- no validation
function divideNumbers(a: number, b: number): number {
  return a / b; // what if b === 0?
}

// CORRECT -- with assertions/validations
function divideNumbers(a: number, b: number): number {
  // Assertion 1: parameter validation
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`Invalid input: a=${a}, b=${b} must be finite numbers`);
  }

  // Assertion 2: business logic validation
  if (b === 0) {
    throw new Error('Division by zero is not allowed');
  }

  return a / b;
}

// CORRECT -- with Zod validation
const UserInputSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
});

function processUser(input: unknown): ProcessedUser {
  // Assertion 1: input validation via Zod
  const validated = UserInputSchema.parse(input);

  // Assertion 2: business rule
  if (validated.age < 18) {
    throw new Error('User must be at least 18 years old');
  }

  return transformUser(validated);
}
```

**What counts as an assertion in TypeScript:**

1. Zod schema validation
2. Type guards with throw
3. Explicit if-checks with Error
4. `console.assert()` (development only)
5. Early returns after validation

**Rationale:**

- Statistically: 1 defect per 10-100 lines of code
- More assertions = more caught errors
- Defensive programming: catch errors early

---

### Rule 6: Smallest Possible Scope for Variables

**Original (C):**

> Data objects must be declared at the smallest possible level of scope.

**TypeScript Adaptation:**

```typescript
// WRONG -- variable declared too high
function processOrders(orders: Order[]): void {
  let total = 0; // declared at top, only used below
  let tempOrder: Order | null = null; // never used

  for (const order of orders) {
    // 50 lines that don't use total
  }

  for (const order of orders) {
    total += order.amount; // first use here
  }
}

// CORRECT -- variables in smallest scope
function processOrders(orders: Order[]): void {
  for (const order of orders) {
    // processing
  }

  // total only where needed
  const total = orders.reduce((sum, order) => sum + order.amount, 0);
}

// CORRECT -- block scope
function processData(data: Data): Result {
  {
    const validationResult = validate(data);
    if (!validationResult.success) {
      throw new Error(validationResult.error);
    }
  }
  // validationResult is no longer accessible here

  {
    const intermediate = transform(data);
    return finalize(intermediate);
  }
}
```

**Rationale:**

- Data hiding: what is not visible cannot be corrupted
- Easier debugging: fewer places where a variable can change
- Prevents reuse for incompatible purposes

**TypeScript-specific:** ALWAYS `const` when possible. `let` only when reassignment is needed. NEVER `var`.

---

### Rule 7: Check Return Values, Validate Parameters

**Original (C):**

> The return value of non-void functions must be checked by each calling function, and the validity of parameters must be checked inside each function.

**TypeScript Adaptation:**

```typescript
// WRONG -- return value ignored
async function processUser(id: number): Promise<void> {
  fetchUser(id); // promise ignored!
  updateUser(id, data); // error swallowed
}

// WRONG -- parameters not validated
function setUserAge(user: User, age: number): void {
  user.age = age; // what if age = -5 or 999?
}

// CORRECT -- check return values
async function processUser(id: number): Promise<void> {
  const user = await fetchUser(id);
  if (user === null) {
    throw new Error(`User not found: ${id}`);
  }

  const updateResult = await updateUser(id, data);
  if (!updateResult.success) {
    throw new Error(`Update failed: ${updateResult.error}`);
  }
}

// CORRECT -- validate parameters
function setUserAge(user: User, age: number): void {
  if (age < 0 || age > 150) {
    throw new Error(`Invalid age: ${age}. Must be between 0 and 150.`);
  }
  if (!Number.isInteger(age)) {
    throw new Error(`Age must be an integer, got: ${age}`);
  }
  user.age = age;
}

// CORRECT -- explicitly ignore when intentional
void analytics.trackEvent('user_action'); // void = deliberately ignored
```

**TypeScript-specific:**

- `@typescript-eslint/no-floating-promises` enforced
- All `Promise` returns must be awaited or marked with `void`
- Zod for runtime validation at system boundaries

**Rationale:**

- Standard library functions crash silently on wrong inputs
- Errors must propagate up the call chain
- Mechanical checkers can detect violations

---

### Rule 8: Restrict Preprocessor Usage

**Original (C):**

> The use of the preprocessor must be limited to the inclusion of header files and simple macro definitions. Token pasting, variable argument lists (ellipses), and recursive macro calls are not allowed.

**TypeScript Adaptation:**

TypeScript has no preprocessor, but equivalent concepts apply: **type-level metaprogramming** and **build-time conditionals**.

Standard utility types (`Partial`, `Pick`, `Omit`, `Record`, `ReturnType`) and single-level generics are fine. The problem is multi-level recursive conditional types that nobody can read.

```typescript
// FINE -- standard utility types
type PartialUser = Partial<User>;
type UserKeys = Pick<User, 'id' | 'email'>;

// FINE -- single-level generic
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// AVOID -- recursive conditional type gymnastics
type DeepReadonly<T> = T extends object ? { readonly [P in keyof T]: DeepReadonly<T[P]> } : T;

// FORBIDDEN -- incomprehensible type-level programming
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type DeepMerge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B ?
    K extends keyof A ?
      A[K] extends object ?
        B[K] extends object ?
          DeepMerge<A[K], B[K]>
        : B[K]
      : B[K]
    : B[K]
  : K extends keyof A ? A[K]
  : never;
};
```

**Rule of thumb:** If a type definition needs more than 2 levels of nesting or a comment to explain what it does, it is too complex. Extract it into a named interface or simplify the data model.

**Build-time conditionals** -- max 2-3 environment flags:

```typescript
// AVOID -- too many build-time conditionals (2^10 = 1024 versions)
const config = {
  define: {
    __DEV__: mode === 'development',
    __PROD__: mode === 'production',
    __TEST__: mode === 'test',
    __FEATURE_X__: process.env.ENABLE_FEATURE_X,
    // 10+ more flags...
  }
};

// CORRECT -- minimal build flags, runtime configuration for features
const config = {
  define: {
    __DEV__: mode === 'development',
  }
};

// Addons controlled at runtime via database (tenant_addons table)
const addons = await this.addonsService.getActiveAddons(tenantId);
```

**Rationale:**

- 10 conditional directives = 2^10 = 1024 possible code versions
- Recursive conditional types are unreadable and produce cryptic error messages
- Build configuration should be minimal; feature flags belong in the database

---

### Rule 9: Restrict Reference Depth

**Original (C):**

> The use of pointers should be restricted. Specifically, no more than one level of dereferencing is allowed. Pointer dereference operations may not be hidden in macro definitions or inside typedef declarations. Function pointers are not permitted.

**TypeScript Adaptation:**

The problem is **deeply nested data structures**, not the operators used to access them. Optional chaining (`?.`) is a safety feature -- it prevents crashes. The issue is when you need 6 levels of it.

```typescript
// PROBLEM -- the data structure is too deep (6 levels)
const value = data.users[0].profile.settings.notifications.email.frequency;
const freq = data?.users?.[0]?.profile?.settings?.notifications?.email?.frequency;

// CORRECT -- flatten the data model
interface UserNotificationSettings {
  emailFrequency: 'daily' | 'weekly' | 'never';
  pushEnabled: boolean;
}

const settings = getUserNotificationSettings(userId);
const frequency = settings.emailFrequency;

// CORRECT -- destructuring when traversal is unavoidable
function processUser(data: UserData): void {
  const { profile } = data;
  const { notifications } = profile.settings;
  const { emailFrequency } = notifications;
}

// FINE -- 2-3 levels of optional chaining for safe access
const userName = user?.profile?.displayName ?? 'Anonymous';
const firstOrder = orders?.[0]?.id;

// AVOID -- callback hell (deep nesting)
fetchUser(id, (user) => {
  fetchOrders(user.id, (orders) => {
    fetchPayments(orders[0].id, (payments) => {
      // 3 levels deep
    });
  });
});

// CORRECT -- flat async/await
async function processUserData(id: number): Promise<void> {
  const user = await fetchUser(id);
  const orders = await fetchOrders(user.id);
  const payments = await fetchPayments(orders[0].id);
}
```

**Maximum property access depth:** 3 levels. If you need more, flatten the data model or use destructuring.

**Rationale:**

- Deep nesting makes data flow hard to trace
- Errors in deep structures are hard to debug
- If your data needs 6 levels of access, the structure itself is the problem

---

### Rule 10: Zero Warnings -- Maximum Compiler Strictness

**Original (C):**

> All code must be compiled, from the first day of development, with all compiler warnings enabled at the compiler's most pedantic setting. All code must compile with these setting without any warnings. All code must be checked daily with at least one, but preferably more than one, state-of-the-art static source code analyzer and should pass the analyses with zero warnings.

**TypeScript Adaptation:**

```jsonc
// tsconfig.json -- MAXIMUM STRICTNESS
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
  },
}
```

```javascript
// eslint.config.js -- no warnings allowed
export default [
  {
    rules: {
      // all rules set to "error", not "warn"
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      // ... more strict rules
    },
  },
];
```

**Rationale:**

- Zero tolerance for warnings prevents "warning blindness"
- Warnings that accumulate eventually hide real problems
- Static analyzers catch entire classes of bugs automatically

---

## Summary

| Rule | Principle                 | TypeScript Enforcement                                                  |
| ---- | ------------------------- | ----------------------------------------------------------------------- |
| 1    | Simple control flow       | no unbounded recursion; bounded tree traversal with `MAX_DEPTH` allowed |
| 2    | Bounded loops             | `MAX_ITERATIONS` constant on while loops                                |
| 3    | Prevent memory leaks      | cleanup listeners, intervals, subscriptions on destroy                  |
| 4    | Max 60 lines/function     | `max-lines-per-function: 60`                                            |
| 5    | Min 2 assertions/function | Zod validation + business rule checks                                   |
| 6    | Smallest scope            | `const` > `let` > never `var`                                           |
| 7    | Check all returns         | `no-floating-promises`, validate params                                 |
| 8    | Minimal metaprogramming   | standard utility types OK; no recursive conditional types               |
| 9    | Max 3 levels deep         | flatten data models; `?.` is fine, deep structures are not              |
| 10   | Zero warnings             | `strict: true`, all ESLint rules as `error`                             |

---

## References

- Gerard J. Holzmann, "The Power of 10: Rules for Developing Safety-Critical Code", IEEE Computer, vol. 39, no. 6, pp. 95-97, June 2006
- [Original Paper (PDF)](https://web.eecs.umich.edu/~imarkov/10rules.pdf) -- NASA/JPL
- [Assixx TypeScript Standards](./TYPESCRIPT-STANDARDS.md) -- project-specific implementation of these rules
- [Assixx Code of Conduct](./CODE-OF-CONDUCT.md) -- hard limits derived from Power of Ten

---

## Changelog

| Version | Date       | Changes                                                                                                                                       |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1.0   | 2026-02-17 | Reworked Rules 1, 3, 8, 9 for TypeScript/SaaS context: bounded recursion exception, memory leak focus, utility types OK, optional chaining OK |
| 2.0.0   | 2026-02-17 | Translated to English, clean formatting, added summary table, references, changelog                                                           |
| 1.0.0   | 2025-11-25 | Initial adaptation of Power of Ten for TypeScript/Assixx                                                                                      |
