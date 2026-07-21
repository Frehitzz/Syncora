---
name: feature-planner
description: >
  Generate a detailed, step-by-step implementation tutorial for a feature.
  Use when the user asks to "plan a feature", "generate implementation instructions",
  "create a step-by-step guide", "write a tutorial for feature X",
  "generate feature instructions", or "plan out this feature step by step".
  Produces a comprehensive implementation document with concept explanations,
  code snippets, testing steps, and a completion checklist.
---

# Feature Planner Skill

You are generating a **detailed, beginner-friendly, step-by-step implementation tutorial** for a specific feature. The output should be a standalone document that a developer can follow from start to finish to implement the feature correctly.

---

## Workflow

### Phase 1: Research & Understand

Before writing anything, you MUST:

1. **Identify the feature** — Ask the user what feature to plan if not already specified.
2. **Read the project's roadmap/plan** — Look for files like `docs/plan/roadmap.md`, `README.md`, or any planning docs to understand where this feature fits.
3. **Analyze the existing codebase** — Understand:
   - The tech stack (framework, language, frontend/backend split)
   - Existing patterns (how controllers, models, components, tests are structured)
   - Naming conventions already in use
   - Related code that the feature will interact with
4. **Identify dependencies** — What existing code does the feature build on? What needs to exist first?

### Phase 2: Generate the Tutorial Document

Create the tutorial file at the project's documentation directory. Use this path pattern:
- If a `docs/tuts/` directory exists, use it: `docs/tuts/<phase>-<feature>.md`
- If a `docs/` directory exists, use: `docs/<feature-name>-guide.md`
- Otherwise, create at root: `<feature-name>-guide.md`

### Phase 3: Review & Verify

After generating, verify:
- All file paths referenced actually exist (or are marked as new files to create)
- Import statements are correct for the project's structure
- The code follows the project's existing patterns and conventions
- The test examples are compatible with the project's test framework

---

## Tutorial Document Format

Use this exact structure for the generated tutorial. Every section is intentional.

```markdown
# [Phase/Section] — [Feature Name]: [Human-Readable Title]

[2-3 sentence overview of what works NOW vs what this feature will add. Frame it as a before/after so the developer understands the gap they're filling.]

---

## 🧠 Before We Code: Understanding the Concepts

[For each NEW concept this feature introduces, add a subsection with:]

### What is [Concept]?

[Explain using a real-world analogy first (school PA system, post office, etc.), THEN map it to the technical equivalent. This is critical — don't skip the analogy.]

[Key points as bullet list if needed]

---

### The Full Flow for This Feature

[ASCII diagram showing the complete data/event flow from user action to result. Use numbered steps with arrows (│ ▼) showing the journey. Mark which steps already exist vs which are NEW.]

```
1. User does X
       │
       ▼ (already works)
2. Existing step
       │
       ▼ (NEW — this is what we're building)
3. New step we're adding
       │
       ▼
4. End result 🎉
```

[1-sentence note: "Steps 1–2 already exist. We're building steps 3–N in this tutorial."]

---

## Now Let's Build It! 🔨

---

## Step N: [Action-Oriented Title]

**What is this?**
[1-2 sentences explaining WHY this step exists. Not what it does — why it's needed.]

[Numbered sub-instructions:]

1. [Command to run, if any]:
   ```bash
   command here
   ```
   [1-sentence explanation of what the command does and what it creates]

2. Open `[file path]` and [add/replace/update]:
   ```[language]
   [Full, copy-pasteable code with inline comments explaining non-obvious lines]
   ```

   **Let's break down every part of this:**

   #### `[specific code element]`
   [2-3 sentence explanation of what this does and WHY. Use analogies where helpful.]

   #### `[next code element]`
   [Explanation]

   > **[Common question or gotcha]**
   > [Answer that prevents confusion]

---

[Repeat Step N pattern for each implementation step]

---

## Step N: Test It Manually

[Numbered list of exact steps to verify the feature works in the browser/app. Include:]
- What to run/start
- Exact user actions to perform
- What to expect to see
- Where to check for errors (DevTools, logs, etc.)

**Common issues:**
- **[Error message]** — [Fix]
- **[Symptom]** — [Cause and fix]

---

## Step N: Write Automated Tests

**Why do we need this?**
[Brief explanation]

[Test code with detailed inline comments explaining test concepts like mocking, faking, assertions]

Run the tests:
```bash
[test command]
```

---

## ✅ [Feature Name] Checklist

- [ ] [Each discrete deliverable as a checkbox]
- [ ] [Include both code AND verification items]
- [ ] [Tests written and passing]

---

## 🔮 What's Next? ([Next Feature] Preview)

[2-3 sentences teasing the next feature and how the concepts learned here connect to it.]

---

> **Tip:** [One practical tip for debugging or exploring the feature further]
```

---

## Writing Style Rules

1. **Explain WHY before WHAT** — Every step starts with why it's needed, not just what to do.
2. **Use real-world analogies** — PA systems, post offices, flight recorders, etc. for new concepts.
3. **Code must be copy-pasteable** — Full file contents or clearly marked insertion points with `← ADD THIS` markers.
4. **Inline comments in code** — Every non-obvious line gets a comment.
5. **Break down after code blocks** — Use `#### backtick-wrapped-code-element` sub-headings to explain each piece.
6. **Use blockquotes for gotchas** — `> **Question?**\n> Answer` format.
7. **Common issues section** — Bold error/symptom, em dash, solution.
8. **Match project conventions** — Use the project's existing naming, file structure, and coding style. Don't introduce new patterns.
9. **Mark new vs existing** — When showing full files, clearly indicate which parts are new (`← ADD THIS`) vs already existing (`// ... (leave as-is)`).
10. **Test explanations** — Treat test code as teaching moments. Explain mocking/faking concepts with analogies.

---

## Adaptation Rules

This skill is **project-agnostic**. When generating, adapt to:

- **Laravel + Inertia + React** → PHP backend steps + TSX frontend steps + Pest tests
- **Next.js** → API routes + React components + Jest/Vitest tests
- **Django + React** → Python views + React components + pytest tests
- **Rails** → Ruby controllers + ERB/JS views + RSpec tests
- **Any other stack** → Follow the same structure, use the stack's conventions

Always detect the stack from the codebase before generating. Never assume a stack.

---

## What NOT to Do

- ❌ Don't generate vague instructions like "implement the controller logic"
- ❌ Don't skip the conceptual explanation section
- ❌ Don't show partial code snippets without context of where they go
- ❌ Don't forget the ASCII flow diagram
- ❌ Don't skip the manual testing steps
- ❌ Don't write tests without explaining the testing concepts
- ❌ Don't use patterns that contradict the project's existing conventions
