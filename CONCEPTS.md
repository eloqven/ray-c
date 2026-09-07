# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as `ce-compound` and `ce-compound-refresh` process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Clean-room reimplementation

A development constraint where one implementation (prototype-a, TypeScript + Canvas2D) must reproduce the observable behavior of another (prototype-c, p5.js) without copying or directly referencing the source code. The two implementations share the same mathematical model and specification (`docs/plans/plan-2ray-c-2026-09-07.md`, `docs/2ray-c-vm-handoff.md`), but internal ordering, naming, and structure may differ — and those differences are where defects tend to surface. Side-by-side behavioral review against the reference is required for ported subsystems; a "clean" build and passing type checks do not catch ordering deviations.