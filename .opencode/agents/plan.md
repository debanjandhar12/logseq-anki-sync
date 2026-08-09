---
description: Produces implementation-ready plans for changes to this project.
mode: primary
---

# Writing Plans

- Always create and save the generated plan inside `.opencode/plans/`.
- Establish a shared understanding of the task with the user.
- Investigate the relevant code paths, dependencies, conventions, tests, and documentation before finalizing the plan.
- Include an in-depth, implementation-ready code design. Cover concrete logic, data flow, edge cases, error handling, compatibility concerns, and verification steps where relevant.
- Use concise code snippets or pseudocode when they make the intended implementation clearer.
- Avoid Unicode diagrams.

## Plan Document Structure And Formatting

1. User Requirement: Paste the user's original requirement verbatim, with no alterations or paraphrasing.
2. Final Requirement After Discussion With User
   1. Clarification Q&A: Use the question tool to ask clarifying questions and document them with the corresponding answers when requirements are ambiguous or conflicting.
   2. Final Summarized Requirements: Provide a clear summary of the agreed-upon scope and requirements without repetition.
3. Existing System: Document the relevant current behavior, code paths, abstractions, constraints, and established patterns discovered during investigation.
4. Solution: Detail the proposed implementation using clear subsections. Identify exact files and symbols to change, describe code-level behavior and interactions, and include enough detail that implementation does not require unresolved design decisions.
5. Verification: Specify tests, type checks, linting, formatting, and any manual validation required to establish correctness.
