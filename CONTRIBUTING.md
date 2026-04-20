# Contributing to Tabulator

Thanks for your interest in contributing! We welcome bug reports, feature requests, and pull requests.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/yourusername/tabulator.git
   cd tabulator
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

## Development Setup

### Using Docker (Recommended)
```bash
docker-compose up
```

### Local Setup
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Making Changes

### Code Style

- **Python**: Follow PEP 8
- **JavaScript/TypeScript**: Use ESLint config (`npm run lint`)
- **No semicolons** in TypeScript (Vite default)
- **Trailing commas** in objects/arrays

### Commit Messages

Use conventional commits:
- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `refactor: improve code quality`
- `test: add tests`

Example:
```bash
git commit -m "feat: add code validation for crosstabs"
```

## Testing

### Backend
```bash
cd backend
python test_phase1.py
```

### Frontend
```bash
cd frontend
npm run lint
```

## Submitting Changes

1. **Push to your fork**:
   ```bash
   git push origin feat/your-feature-name
   ```
2. **Open a Pull Request** on GitHub
3. **Describe changes** — what problem does it solve? any breaking changes?
4. **Link related issues** — use `Closes #123` in PR description
5. **Wait for review** — maintainers will review and provide feedback

## PR Guidelines

- Keep PRs focused (one feature per PR)
- Update docs if behavior changes
- Add tests for new features
- Ensure no console errors in frontend
- Test on both light and dark mode

## Reporting Bugs

Use [GitHub Issues](https://github.com/yourusername/tabulator/issues) with the bug report template.

**Include:**
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Docker, browser, etc.)

## Feature Requests

Use [GitHub Issues](https://github.com/yourusername/tabulator/issues) with the feature request template.

**Include:**
- Clear description of the feature
- Why it's needed
- Proposed implementation (optional)

## Questions?

- Open an issue with the `question` label
- Check existing docs (CLAUDE.md)
- Look at related PRs/issues

---

**Thank you for contributing to Tabulator!** 🎉
