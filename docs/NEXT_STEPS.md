# Next Steps (Project Planning)

Follow-up work that can be done gradually.

---

## 1. Tests

- **Integration tests (testnet):** 1–2 real swap/launchToken scenarios with live RPC. Use `.env` for keys; skip in CI if env not set.
- **Error scenario tests:** Extend coverage for invalid address, mainnet guard, etc.

## 2. CI / Automation

- **GitHub Actions:** Already added (`.github/workflows/ci.yml`). Ensure `pnpm run test` exists and test files are in `tests/`.
- **Docs in CI:** Optional step to run `pnpm run docs:generate` and publish or commit `docs/api-reference/`.

## 3. Documentation

- **README:** Error handling and API reference sections added.
- **Error contract:** In `docs/api.md`, add a table of which method throws which error codes.

## 4. Optional

- **launchToken issuer lock:** Set auth required on issuer (SetOptions).
- **Mainnet token issuance env:** Document `ALLOW_MAINNET_TOKEN_ISSUANCE` if applicable.
