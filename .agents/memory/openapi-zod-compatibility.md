---
name: OpenAPI/Zod compatibility
description: Generator/runtime compatibility constraint for this pnpm workspace
---

OpenAPI schemas using email formats or integer types can cause the current generated Zod code to emit helpers unavailable in the installed Zod runtime.

**Why:** Codegen uses a newer schema vocabulary than the workspace's Zod runtime supports.

**How to apply:** Prefer a string regex pattern for email validation and numeric schemas for counts/limits unless the workspace's generator and Zod versions are upgraded together.