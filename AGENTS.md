# Repository Rules

## Integration Baseline

- For new projects or new third-party integrations, check the official documentation first.
- Prefer the vendor's current official terminology in code, environment variables, and setup docs.
- Do not introduce legacy naming in a fresh setup unless there is an active backward-compatibility requirement.

## Supabase

- In new setups, prefer:
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY`
- Avoid legacy `anon` / `service_role` naming in new initialization work.

## Product Auth

- In prototype and testing phases, default to the lightest authentication that is sufficient to validate the product loop.
- Prefer simple username/password for internal testing over email OTP unless the user explicitly asks for OTP.
- When reasoning about future consumer auth, assume phone verification is more likely than email verification unless the user says otherwise.

## Product-Driven Technical Design

- When deciding between single-item and batch-oriented technical designs, anchor the choice to the product workflow and expected usage shape first.
- If the product plan is unclear and there is a realistic batch scenario, ask and clarify before locking into a single-item implementation path.
- Do not default to a "single item first, batch later" design in workflows that may be batch-dominant, because that can make the baseline product unusable rather than merely unoptimized.
