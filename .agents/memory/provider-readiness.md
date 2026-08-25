---
name: Provider readiness states
description: Durable product rule for NOVA's optional AI, research, image, and billing providers
---

Optional external providers are represented as explicit readiness states in both API responses and UI, never as fake generated content.

**Why:** The app must remain honest and safe when a provider key or connection is not configured.

**How to apply:** Keep provider adapters behind environment variables or managed integrations, expose configuration status to the admin surface, and show an actionable configuration-required state to end users.