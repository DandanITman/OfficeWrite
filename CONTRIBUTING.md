# Contributing to Officewrite

Officewrite is a **non-profit educational project** and **free, open-source alternative to Microsoft Word**. We welcome contributors of all skill levels: students, teachers, developers, and anyone who wants to help make free word processing better for everyone.

## Ways to contribute

- **Report bugs**: [Open an issue](https://github.com/DandanITman/OfficeWrite/issues) with steps to reproduce
- **Suggest features**: Especially features that help education and accessibility
- **Submit code**: Fork, branch, test, pull request
- **Improve docs**: README, testing guides, classroom materials
- **Add tests**: See `docs/testing.md` and `.cursor/skills/officewrite-add-regression-test/`

## Development setup

```bash
git clone https://github.com/DandanITman/OfficeWrite.git
cd Officewrite
npm install
npx playwright install chromium
npm run dev
```

## Before you open a PR

```bash
npm run regression
```

This runs typecheck, build, unit tests, e2e tests, and visual regression.

## Project values

1. **Free for everyone**: No paywalls, no subscriptions, no license keys
2. **Educational first**: Clear code, good docs, safe defaults for learners
3. **Open source**: Anyone can read, fork, and improve the project
4. **Local & private**: Documents stay on the user's machine by default
5. **No vendor lock-in**: Support open formats (DOCX, plain text, `.officewrite`)

## Code of conduct

Be respectful and constructive. This project exists to help people learn and create, so keep it welcoming.
