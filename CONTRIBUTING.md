# ZEUS Contribution Guidelines

## Introduction

ZEUS is a mobile Bitcoin/Lightning wallet and remote node manager. Like any software that interacts with Bitcoin and the Lightning Network, bugs in ZEUS could potentially result in financial loss for users. As such, we take code quality, security, and proper testing very seriously.

This document outlines the guidelines for contributing to ZEUS. We welcome contributions from the community, but ask that you follow these guidelines to ensure a smooth contribution process.

## Minimum Recommended Skillset

The following skills are recommended for contributors:

- Understanding of Bitcoin and the Lightning Network fundamentals
- Experience with TypeScript and React Native
- Familiarity with mobile development (iOS and/or Android)
- Knowledge of React patterns (state management, component lifecycle, hooks)
- Understanding of asynchronous programming and Promises
- Familiarity with Git and the pull request workflow
- Experience with unit testing (Jest)

## Required Reading

Before contributing, please familiarize yourself with:

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- The [Lightning Network specification (BOLTs)](https://github.com/lightning/bolts)
- [LND API Documentation](https://api.lightning.community/) (for LND-related features)
- [Core Lightning Documentation](https://docs.corelightning.org/) (for CLN-related features)

## Development Philosophy

### Share Early, Share Often

We encourage contributors to share their intentions early:

1. **Before starting work**: Check existing issues and pull requests to avoid duplicate efforts
2. **Open an issue first**: For significant changes, open an issue to discuss the approach before writing code
3. **Discuss new dependencies**: Before adding a new library or dependency, discuss it with maintainers first. There may be existing solutions in the codebase or preferred alternatives
4. **Work in progress PRs**: Feel free to open draft PRs early for feedback on your approach

This prevents wasted effort and ensures your contribution aligns with the project's direction.

### Code Quality Standards

- **Readability**: Code is read far more often than it is written. Prioritize clarity over cleverness
- **Maintainability**: Write code that future contributors (including yourself) can understand and modify
- **Security**: Never introduce code that could compromise user funds or privacy
- **Testing**: New features should include appropriate test coverage

## Development Environment Setup

### Prerequisites

- Node.js (LTS version)
- Yarn package manager
- React Native CLI
- Xcode (for iOS development)
- Android Studio (for Android development)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ZeusLN/zeus.git
cd zeus

# Install dependencies
yarn install

# For iOS
cd ios && pod install && cd ..

# Start the development server
yarn start

# Run on Android
yarn android

# Run on iOS
yarn ios
```

### Running Checks

```bash
# Run all units tests
yarn test

# Type checking
yarn tsc

# Code formatting check
yarn prettier

# Linting
yarn lint

# Run all checks at once (recommended before submitting PR)
yarn verify
```

### Lightning Development Environment

For a quick way to get a Lightning development environment running, check out [Polar](https://github.com/jamaljsr/polar).

### Android Development Notes

When configuring a new node on Android in dev, the `Host` field must be `10.0.2.2` - `127.0.0.1` or `localhost` won't work due to Android emulator networking.

## Code Style Guidelines

### TypeScript/React Native Standards

- Use TypeScript for all new code
- Follow the existing code style in the codebases
- Keep components focused and single-purpose
- Avoid `any` types - use proper typing

### Formatting

- Code is formatted using Prettier
- Run `yarn prettier-write` to format your code
- ESLint is used for linting: `yarn lint`
- Fix all linting issues: `yarn fix-all`

### Naming Conventions

- **Components**: PascalCase (e.g., `PaymentRequest.tsx`)
- **Utilities/helpers**: camelCase (e.g., `formatBalance.ts`)
- **Constants**: UPPER_SNAKE_CASE
- **Stores (MobX)**: PascalCase with `Store` suffix (e.g., `ChannelsStore.ts`)

### File Organization

- Place components in the appropriate directory under `views/` or `components/`
- Keep related files close together
- Stores go in `stores/`
- Utility functions go in `utils/`
- Backend implementations go in `backends/`

## Git Workflow

### Commit Messages

Write clear, descriptive commit messages:

```
component: Short summary of change (50 chars or less)

More detailed explanation if necessary. Wrap lines at 72 characters.
Explain the problem this commit solves and why this approach was chosen.
```

**Commit message prefixes** (use the affected area):
- `views:` for screen/view changes
- `components:` for reusable component changes
- `stores:` for MobX store changes
- `backends:` for backend implementation changes
- `utils:` for utility function changes
- `build:` for build configuration changes
- `docs:` for documentation changes
- `tests:` for test changes

### Atomic Commits

- Each commit should represent a single logical change
- Each commit should ideally pass all verification checks independently (`yarn tsc`, `yarn prettier`, `yarn lint`, `yarn test`)
- Use `git rebase -i` to clean up commit history before requesting review

### Branch Naming

Use descriptive branch names:
- `feature/add-taproot-support`
- `fix/invoice-parsing-error`
- `refactor/channel-list-component`

## Pull Request Process

### Before Submitting

1. Ensure all tests pass: `yarn verify`
2. Test your changes on both iOS and Android if possible
3. Update documentation if you're changing user-facing behavior
4. Rebase on the latest `master` branch

### PR Description

**Important**: Do not delete the pull request template. The template includes a checklist and questions about which platforms you've tested on. This information is essential for reviewers. Please fill out all sections of the template rather than replacing it with a custom description.

The template will ask you to provide:

- Summary of changes
- Which platforms were tested (iOS/Android)
- Checklist of completed items
- Screenshots/videos for UI changes

### Review Process

1. All PRs require at least one approval from a maintainer
2. Address all review feedback
3. Keep discussions focused and constructive
4. Use fixup commits during review, squash before merge

### Merge Requirements

- All CI checks must pass
- At least one maintainer approval
- No unresolved conversations
- Up-to-date with the base branch

## Testing Guidelines

### Unit Tests

- Write tests for new utility functions and business logic
- Use Jest for testing
- Place tests alongside the code they test (e.g., `utils/foo.ts` and `utils/foo.test.ts`)

### Manual Testing

Before submitting a PR, manually test:

1. The specific feature/fix on both platforms when possible
2. Related functionality that might be affected
3. Edge cases and error scenarios

**Important**: If you are making cosmetic/UI changes, please test on both Android and iOS as things don't render exactly the same on both platforms.

### Test Coverage

- Bug fixes should include a test that would have caught the bug
- New features should have reasonable test coverage
- Don't sacrifice test quality for coverage numbers

## Security Considerations

ZEUS handles Bitcoin and Lightning funds. Security is paramount:

- **Never log sensitive data**: Private keys, macaroons, seeds, etc.
- **Validate all inputs**: Especially for payment-related functionality
- **Be cautious with dependencies**: Review new dependencies for security
- **Handle errors gracefully**: Don't expose internal details in error messages
- **Use secure storage**: Sensitive data must use encrypted storage

If you discover a security vulnerability, please report it privately to the maintainers rather than opening a public issue.

## Internationalization (i18n)

ZEUS supports multiple languages:

- All user-facing strings should use the localization system
- Don't hardcode user-facing text in components
- **Only modify `locales/en.json`** when adding new strings - this is the source file for all translations
- Other locale files are managed through [Transifex](https://explore.transifex.com/ZeusLN/zeus/) and should not be modified directly in the repository
- If you'd like to contribute translations, please visit our [Transifex page](https://explore.transifex.com/ZeusLN/zeus/) and request a role for the language you'd like to help with

## Getting Help

- **Issues**: Check existing issues or open a new one
- **Telegram**: [ZEUS Telegram](https://t.me/zeusLN)
- **Slack**: [Developer Slack](https://zeusln.slack.com/join/shared_invite/zt-qw205nqa-o4VJJC0zPI7HiSfToZGoVw#/)

## First-Time Contributors

If you're new to ZEUS:

1. Look for issues labeled `good first issue`
2. Start by reviewing existing PRs to understand the process
3. Consider improving test coverage as a first contribution
4. Don't hesitate to ask questions

We appreciate all contributions, but please avoid trivial changes (typo fixes in comments, whitespace changes) as your first contribution. Focus on substantive improvements.

## Working on Issues

**Note on issue assignment**: GitHub issue assignment is reserved for ZEUS team members. Instead of asking to be assigned an issue, simply leave a comment indicating that you've started working on it. This helps others know the issue is being addressed while keeping the process lightweight.

We prioritize reviewing the first submission for any given issue or feature. However, if a better approach emerges during the review process, we may incorporate ideas from multiple contributions. Don't be discouraged if this happens - it's part of collaborative development and your effort is still valued.

## License

All contributions to ZEUS must be compatible with the AGPLv3 license. By submitting a pull request, you agree that your contribution will be licensed under the project's license.
