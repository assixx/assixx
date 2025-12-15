# The Power of Ten - Regeln für Safety-Critical Code

> **Quelle:** Gerard J. Holzmann, NASA/JPL Laboratory for Reliable Software
> **Original Paper:** [P10.pdf](./P10.pdf)
> **Adaptiert für:** TypeScript/JavaScript (Assixx Project)
> **Version:** 1.0.0
> **Erstellt:** 25.11.2025

---

## Warum diese Regeln?

Die meisten Coding-Guidelines enthalten über 100 Regeln - und werden deshalb ignoriert. Holzmann argumentiert: **10 strikte, verifizierbare Regeln** sind effektiver als 100 vage Empfehlungen.

Diese Regeln wurden bei NASA/JPL für **mission-critical Software** entwickelt - Code, der Raumschiffe, Flugzeuge und Atomkraftwerke steuert. Ein Bug kann töten.

> *"The rules act like the seat-belt in your car: initially they are perhaps a little uncomfortable, but after a while their use becomes second-nature and not using them becomes unimaginable."*
> — Gerard J. Holzmann

---

## Die 10 Regeln

### Regel 1: Einfache Kontrollfluss-Strukturen

**Original (C):**
> Restrict all code to very simple control flow constructs – do not use `goto` statements, `setjmp` or `longjmp` constructs, and direct or indirect recursion.

**TypeScript-Adaptation:**

```typescript
// ❌ VERBOTEN - Rekursion
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1); // Rekursiver Aufruf
}

// ✅ RICHTIG - Iterativ
function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

// ❌ VERBOTEN - Indirekte Rekursion
function processA(data: Data): void {
  // ... logic
  processB(data); // ruft processA auf
}

function processB(data: Data): void {
  // ... logic
  processA(data); // Zyklus!
}

// ✅ RICHTIG - Lineare Verarbeitung
function processData(data: Data): void {
  const stepA = transformA(data);
  const stepB = transformB(stepA);
  return stepB;
}
```

**Rationale:**
- Einfacher Kontrollfluss = bessere Verifizierbarkeit
- Ohne Rekursion: Azyklischer Call-Graph, beweisbar terminierend
- Statische Analyse kann Stack-Nutzung berechnen

**Ausnahme:** Tail-Call-Optimierung ist in JS/TS nicht garantiert - daher KEINE Rekursion, auch keine "tail-recursive" Funktionen.

---

### Regel 2: Alle Loops mit fester Obergrenze

**Original (C):**
> All loops must have a fixed upper-bound. It must be trivially possible for a checking tool to prove statically that a preset upper-bound on the number of iterations of a loop cannot be exceeded.

**TypeScript-Adaptation:**

```typescript
// ❌ VERBOTEN - Unbekannte Obergrenze
while (condition) {
  // Kann ewig laufen
}

// ❌ VERBOTEN - Externe Abhängigkeit ohne Limit
while (await fetchNextPage()) {
  processPage();
}

// ✅ RICHTIG - Explizite Obergrenze
const MAX_ITERATIONS = 10000;
let iterations = 0;

while (condition && iterations < MAX_ITERATIONS) {
  iterations++;
  // Logic
}

if (iterations >= MAX_ITERATIONS) {
  throw new Error(`Loop exceeded maximum iterations: ${MAX_ITERATIONS}`);
}

// ✅ RICHTIG - for...of mit bekanntem Array
for (const item of items) { // items.length ist bekannt
  process(item);
}

// ✅ RICHTIG - for mit explizitem Limit
const MAX_PAGES = 100;
for (let page = 0; page < MAX_PAGES; page++) {
  const data = await fetchPage(page);
  if (data.length === 0) break;
  processPage(data);
}
```

**Rationale:**
- Verhindert Runaway-Code und Endlosschleifen
- Statisch beweisbar, dass Code terminiert
- Bei Überschreitung: Expliziter Fehler statt stilles Hängen

---

### Regel 3: Keine dynamische Speicherallokation nach Initialisierung

**Original (C):**
> Do not use dynamic memory allocation after initialization.

**TypeScript-Adaptation:**

Da JavaScript/TypeScript Garbage Collection verwendet, ist diese Regel adaptiert:

```typescript
// ❌ VERMEIDEN - Dynamische Objekt-Erstellung in Hot Paths
function processRequest(req: Request): Response {
  const temp = { ...req.data }; // Neues Objekt bei jedem Aufruf
  const result = { status: 'ok', data: temp }; // Noch ein Objekt
  return result;
}

// ✅ BESSER - Object Pools oder pre-allokierte Strukturen
class ResponsePool {
  private pool: Response[] = [];
  private readonly MAX_POOL_SIZE = 100;

  acquire(): Response {
    return this.pool.pop() ?? this.createNew();
  }

  release(response: Response): void {
    if (this.pool.length < this.MAX_POOL_SIZE) {
      this.reset(response);
      this.pool.push(response);
    }
  }

  private createNew(): Response { /* ... */ }
  private reset(response: Response): void { /* ... */ }
}

// ✅ RICHTIG - Strukturen bei Init erstellen
const RESPONSE_TEMPLATES = {
  success: { success: true, data: null as unknown },
  error: { success: false, error: null as unknown },
} as const;

// ✅ RICHTIG - Arrays mit bekannter Größe
const buffer = new Array<number>(BUFFER_SIZE).fill(0);
```

**Rationale:**
- Vorhersagbares Speicherverhalten
- Vermeidung von GC-Pauses in kritischen Pfaden
- Einfachere Analyse des Speicherverbrauchs

**Pragmatische Anwendung:** In TypeScript ist diese Regel weniger strikt. Fokus auf:
- Keine Speicher-Lecks (Event Listeners entfernen, Subscriptions beenden)
- Große Datenstrukturen wiederverwenden
- In Performance-kritischem Code: Object Pools nutzen

---

### Regel 4: Maximale Funktionslänge ~60 Zeilen

**Original (C):**
> No function should be longer than what can be printed on a single sheet of paper in a standard reference format with one line per statement and one line per declaration. Typically, this means no more than about 60 lines of code per function.

**TypeScript-Adaptation:**

```typescript
// ❌ VERBOTEN - Funktion über 60 Zeilen
async function handleUserRegistration(data: RegistrationData): Promise<User> {
  // 150 Zeilen Code...
  // Validation
  // Database queries
  // Email sending
  // Logging
  // Error handling
  // ...mehr Code...
}

// ✅ RICHTIG - Aufgeteilt in logische Einheiten
async function handleUserRegistration(data: RegistrationData): Promise<User> {
  const validated = validateRegistrationData(data);      // ~15 Zeilen
  const user = await createUserInDatabase(validated);    // ~20 Zeilen
  await sendWelcomeEmail(user);                          // ~10 Zeilen
  logRegistration(user);                                 // ~5 Zeilen
  return user;
}

function validateRegistrationData(data: RegistrationData): ValidatedData {
  // Max 60 Zeilen - eine logische Einheit
}

async function createUserInDatabase(data: ValidatedData): Promise<User> {
  // Max 60 Zeilen - eine logische Einheit
}
```

**Rationale:**
- Jede Funktion = eine verständliche, testbare Einheit
- Passt auf einen Bildschirm/eine Seite
- Lange Funktionen = Zeichen schlechter Struktur

**Messung:** ESLint Rule `max-lines-per-function` auf 60 setzen.

---

### Regel 5: Mindestens 2 Assertions pro Funktion

**Original (C):**
> The assertion density of the code should average to a minimum of two assertions per function. Assertions are used to check for anomalous conditions that should never happen in real-life executions.

**TypeScript-Adaptation:**

```typescript
// ❌ UNZUREICHEND - Keine Validierung
function divideNumbers(a: number, b: number): number {
  return a / b; // Was wenn b === 0?
}

// ✅ RICHTIG - Mit Assertions/Validierungen
function divideNumbers(a: number, b: number): number {
  // Assertion 1: Parameter-Validierung
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`Invalid input: a=${a}, b=${b} must be finite numbers`);
  }

  // Assertion 2: Geschäftslogik-Validierung
  if (b === 0) {
    throw new Error('Division by zero is not allowed');
  }

  const result = a / b;

  // Assertion 3 (optional): Post-Condition
  if (!Number.isFinite(result)) {
    throw new Error(`Unexpected result: ${result}`);
  }

  return result;
}

// ✅ RICHTIG - Mit Zod-Validierung
import { z } from 'zod';

const UserInputSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
});

function processUser(input: unknown): ProcessedUser {
  // Assertion 1: Input-Validierung via Zod
  const validated = UserInputSchema.parse(input);

  // Assertion 2: Business Rule
  if (validated.age < 18) {
    throw new Error('User must be at least 18 years old');
  }

  return transformUser(validated);
}
```

**Was zählt als Assertion in TypeScript:**
1. Zod/Joi Schema-Validierung
2. Type Guards mit throw
3. Explizite if-checks mit Error
4. `console.assert()` (nur Development)
5. Early Returns nach Validierung

**Rationale:**
- Statistisch: 1 Defekt pro 10-100 Zeilen Code
- Mehr Assertions = mehr abgefangene Fehler
- Defensive Programming: Fehler früh erkennen

---

### Regel 6: Kleinster möglicher Scope für Variablen

**Original (C):**
> Data objects must be declared at the smallest possible level of scope.

**TypeScript-Adaptation:**

```typescript
// ❌ FALSCH - Variable zu weit oben deklariert
function processOrders(orders: Order[]): void {
  let total = 0; // Weit oben, aber nur unten gebraucht
  let tempOrder: Order | null = null; // Nie gebraucht

  for (const order of orders) {
    // 50 Zeilen Code die total nicht nutzen
  }

  // Erst hier wird total gebraucht
  for (const order of orders) {
    total += order.amount;
  }
}

// ✅ RICHTIG - Variablen im kleinsten Scope
function processOrders(orders: Order[]): void {
  for (const order of orders) {
    // Verarbeitung
  }

  // total nur wo es gebraucht wird
  const total = orders.reduce((sum, order) => sum + order.amount, 0);
}

// ✅ RICHTIG - Block-Scope nutzen
function processData(data: Data): Result {
  // Validation-Block
  {
    const validationResult = validate(data);
    if (!validationResult.success) {
      throw new Error(validationResult.error);
    }
  }
  // validationResult ist hier nicht mehr zugänglich

  // Processing-Block
  {
    const intermediate = transform(data);
    return finalize(intermediate);
  }
}
```

**Rationale:**
- Data-Hiding: Was nicht sichtbar ist, kann nicht korrumpiert werden
- Einfacheres Debugging: Weniger Stellen wo Variable geändert werden kann
- Verhindert Wiederverwendung für inkompatible Zwecke

**TypeScript-Spezifisch:**
- IMMER `const` wenn möglich
- `let` nur wenn Reassignment nötig
- NIEMALS `var`

---

### Regel 7: Return-Values prüfen, Parameter validieren

**Original (C):**
> The return value of non-void functions must be checked by each calling function, and the validity of parameters must be checked inside each function.

**TypeScript-Adaptation:**

```typescript
// ❌ FALSCH - Return-Value ignoriert
async function processUser(id: number): Promise<void> {
  fetchUser(id); // Promise ignoriert!
  updateUser(id, data); // Fehler wird verschluckt
}

// ❌ FALSCH - Parameter nicht validiert
function setUserAge(user: User, age: number): void {
  user.age = age; // Was wenn age = -5 oder 999?
}

// ✅ RICHTIG - Return-Values prüfen
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

// ✅ RICHTIG - Parameter validieren
function setUserAge(user: User, age: number): void {
  if (age < 0 || age > 150) {
    throw new Error(`Invalid age: ${age}. Must be between 0 and 150.`);
  }
  if (!Number.isInteger(age)) {
    throw new Error(`Age must be an integer, got: ${age}`);
  }
  user.age = age;
}

// ✅ RICHTIG - Explizit ignorieren wenn beabsichtigt
void analytics.trackEvent('user_action'); // void = bewusst ignoriert
```

**TypeScript-Spezifisch:**
- `@typescript-eslint/no-floating-promises` erzwingen
- Alle `Promise`-Returns awaiten oder mit `void` markieren
- Zod für Runtime-Validierung an Systemgrenzen

**Rationale:**
- Standard-Libraries wie `strlen(0)` crashen still bei falschen Inputs
- Fehler müssen die Call-Chain hochpropagiert werden
- Mechanische Checker können Violations erkennen

---

### Regel 8: Preprocessor-Nutzung einschränken

**Original (C):**
> The use of the preprocessor must be limited to the inclusion of header files and simple macro definitions. Token pasting, variable argument lists (ellipses), and recursive macro calls are not allowed.

**TypeScript-Adaptation:**

TypeScript hat keinen Preprocessor, aber äquivalente Konzepte:

```typescript
// ❌ VERMEIDEN - Komplexe Type-Level-Programmierung
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// ❌ VERMEIDEN - Zu viele Build-Time Conditionals
// In vite.config.js
const config = {
  define: {
    __DEV__: mode === 'development',
    __PROD__: mode === 'production',
    __TEST__: mode === 'test',
    __VERSION__: JSON.stringify(version),
    __FEATURE_X__: process.env.ENABLE_FEATURE_X,
    __FEATURE_Y__: process.env.ENABLE_FEATURE_Y,
    // 10+ weitere Flags...
  }
};

// ✅ RICHTIG - Einfache, verständliche Types
interface User {
  id: number;
  name: string;
  email: string;
}

type PartialUser = Partial<User>; // Standard-Utility, verständlich

// ✅ RICHTIG - Minimale Build-Konfiguration
// Maximal 2-3 Environment-Flags
const config = {
  define: {
    __DEV__: mode === 'development',
  }
};

// ✅ RICHTIG - Runtime-Konfiguration statt Build-Time
const featureFlags = {
  enableNewUI: config.features.newUI,
  enableBetaFeatures: config.features.beta,
};
```

**Rationale:**
- 10 Conditional-Compilation-Direktiven = 2^10 = 1024 mögliche Code-Versionen
- Komplexe Type-Level-Programmierung ist schwer zu verstehen und zu debuggen
- Build-Konfiguration sollte minimal und nachvollziehbar sein

---

### Regel 9: Referenz-Tiefe einschränken

**Original (C):**
> The use of pointers should be restricted. Specifically, no more than one level of dereferencing is allowed. Pointer dereference operations may not be hidden in macro definitions or inside typedef declarations. Function pointers are not permitted.

**TypeScript-Adaptation:**

```typescript
// ❌ VERBOTEN - Zu tiefe Verschachtelung
const value = data.users[0].profile.settings.notifications.email.frequency;

// ❌ VERBOTEN - Optionale Chaining-Ketten
const freq = data?.users?.[0]?.profile?.settings?.notifications?.email?.frequency;

// ✅ RICHTIG - Flache Strukturen
interface UserNotificationSettings {
  emailFrequency: 'daily' | 'weekly' | 'never';
  pushEnabled: boolean;
}

const settings = getUserNotificationSettings(userId);
const frequency = settings.emailFrequency;

// ✅ RICHTIG - Destructuring für Klarheit
function processUser(data: UserData): void {
  const { profile } = data;
  const { settings } = profile;
  const { emailFrequency } = settings.notifications;

  // Jetzt ist klar, was emailFrequency ist
}

// ❌ VERMEIDEN - Callbacks in Callbacks
fetchUser(id, (user) => {
  fetchOrders(user.id, (orders) => {
    fetchPayments(orders[0].id, (payments) => {
      // Callback Hell
    });
  });
});

// ✅ RICHTIG - Flache async/await
async function processUserData(id: number): Promise<void> {
  const user = await fetchUser(id);
  const orders = await fetchOrders(user.id);
  const payments = await fetchPayments(orders[0].id);
}
```

**Maximal erlaubte Tiefe:** 2-3 Levels

**Rationale:**
- Tiefe Verschachtelung erschwert statische Analyse
- Datenfluss wird schwer nachvollziehbar
- Fehler in tiefen Strukturen sind schwer zu debuggen

---

### Regel 10: Zero Warnings - Höchste Compiler-Strenge

**Original (C):**
> All code must be compiled, from the first day of development, with all compiler warnings enabled at the compiler's most pedantic setting. All code must compile with these setting without any warnings. All code must be checked daily with at least one, but preferably more than one, state-of-the-art static source code analyzer and should pass the analyses with zero warnings.

**TypeScript-Adaptation:**

```jsonc
// tsconfig.json - MAXIMALE STRENGE
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
    "noPropertyAccessFromIndexSignature": true
  }
}
```

```javascript
// eslint.config.js - Keine Warnings erlaubt
export default [
  {
    rules: {
      // Alle Rules auf "error", nicht "warn"
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      // ... weitere strikte Rules
    }
  }
];
```

