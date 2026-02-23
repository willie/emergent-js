## 2025-05-15 - AI Client Initialization & Build Process
**Vulnerability:** Not a vulnerability, but a security-related build constraint. The AI client initializes at module scope in `lib/chat/action-analyzer.ts` (or similar), requiring API keys to be present during build time.
**Learning:** Next.js build process tries to statically generate pages or compile API routes, triggering the module-scope code. If API keys are missing, the build fails.
**Prevention:** Always provide dummy environment variables (`OPENAI_API_KEY=dummy`, `OPENROUTER_API_KEY=dummy`) when running `pnpm build` for verification in environments without real secrets.

## 2025-05-15 - Centralized Chat Validation
**Vulnerability:** Chat API (`app/api/chat/route.ts`) lacked strict input validation and relied on loose type casting, making it susceptible to prompt injection (via `role: 'system'`) and DoS via malformed JSON.
**Learning:** `req.json()` must be wrapped in `try/catch`. Input validation should be centralized to ensure consistency across endpoints.
**Prevention:** Use `lib/chat/validation.ts` which implements `zod` schemas to enforce `role` restrictions (no 'system') and validates model IDs.
