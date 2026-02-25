# Contributing to Tocket

Thank you for your interest in contributing to Tocket! This guide will help you get started.

## Getting Started

### Local Setup

```bash
git clone https://github.com/pedrocivita/tocket.git
cd tocket
npm install
npm run build
```

### Running Locally

```bash
node dist/index.js --help
```

## How to Contribute

### 1. Fork and Branch

Fork the repository and create a branch from `main`:

- `feature/short-description` — for new features
- `fix/short-description` — for bug fixes
- `docs/short-description` — for documentation changes

**Keep your fork in sync** before starting new work:

```bash
git remote add upstream https://github.com/pedrocivita/tocket.git
git fetch upstream
git checkout main
git merge upstream/main
```

### 2. Make Your Changes

- Keep changes focused and atomic
- Follow existing code style (TypeScript, ESM)
- Update documentation if your change affects the public API

### 3. Build and Test

All PRs must pass the full test suite before review:

```bash
npm run build        # Compile TypeScript
npm test             # Run all tests (149+ tests, 44+ suites)
```

If your change adds new functionality, add tests in `src/tests/`. If it modifies existing behavior, update the relevant tests.

### 4. Commit

Write clear, concise commit messages in English:

```
feat: add payload validation step
fix: handle missing .context directory gracefully
docs: clarify Memory Bank update workflow
```

### 5. Open a Pull Request

- Fill out the PR template completely
- Link any related issues
- Keep the PR scope small — one logical change per PR

### Review Process

- **CI must pass** — GitHub Actions runs build + tests on every PR
- Reviews typically happen within a few days
- Expect 1–2 rounds of feedback — iteration is normal
- Maintainers may suggest changes or request clarifications before merging

## Complex Proposals

For architectural changes or new commands, we use the **Memory Bank protocol**. Before writing code:

1. Run `tocket init` in your fork to scaffold `.context/`
2. Document your proposal in `.context/activeContext.md`
3. Open a discussion or issue describing your approach before submitting a PR

This helps maintainers understand your design intent and provide early feedback.

## Licensing

By submitting a pull request, you agree that your contributions will be licensed under the [MIT License](LICENSE). No CLA (Contributor License Agreement) is required.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
