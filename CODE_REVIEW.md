# ZEUS Code Review Guidelines

## Why Code Review Matters

Code review is essential for maintaining the quality and security of ZEUS. Since ZEUS handles users' Bitcoin and Lightning funds, thorough review helps prevent bugs that could result in financial loss.

Review is also a bottleneck in open source development. By contributing quality reviews, you provide immediate value to the project while learning the codebase.

## For New Contributors: Review First

If you're new to ZEUS, consider starting with code review before writing code:

### Benefits of Reviewing First

- **Learn the codebase**: Understand patterns, conventions, and architecture
- **Understand quality standards**: See what feedback maintainers provide
- **Provide immediate value**: Help move PRs forward
- **Build relationships**: Get to know maintainers and other contributors
- **Discover contribution opportunities**: Find areas that need improvement

## How to Review a Pull Request

### 1. Understand the Context

Before diving into code:

- Read the PR description and linked issues
- Understand what problem is being solved
- Check if the approach was discussed beforehand

### 2. Check Out and Build

```bash
# Fetch the PR locally
git fetch origin pull/PR_NUMBER/head:pr-PR_NUMBER
git checkout pr-PR_NUMBER

# Install dependencies and build
yarn install

# Run tests
yarn verify
```

### 3. Test the Changes

- **Run the app** on a device or simulator
- **Test the specific feature** being changed
- **Test edge cases**: Empty states, error conditions, large inputs
- **Test related features** that might be affected
- **Test on both platforms** if possible (iOS and Android)

### 4. Review the Code

#### Correctness

- Does the code do what it claims to do?
- Are there logic errors or off-by-one mistakes?
- Are edge cases handled?
- Is error handling appropriate?

#### Security

ZEUS handles Bitcoin funds. Be vigilant about:

- Sensitive data exposure (keys, macaroons, seeds)
- Input validation for payment-related code
- Secure storage usage
- Potential for fund loss scenarios

#### Code Quality

- Is the code readable and maintainable?
- Does it follow existing patterns in the codebase?
- Are TypeScript types used properly (no unnecessary `any`)?
- Is there appropriate test coverage?

#### Architecture

- Does the change fit well with the existing architecture?
- Are there better approaches?
- Will this be easy to maintain long-term?

#### Performance

- Are there unnecessary re-renders?
- Is data fetched efficiently?
- Could this cause performance issues on low-end devices?

#### User Experience

- Is the UI consistent with the rest of the app?
- Does it work well in different themes?
- Is it accessible?
- How does it look with different locales?
- Does it look good at different screen resolutions + system font sizes?

### 5. Review Commits Individually

- Each commit should be logical and self-contained
- Commit messages should be clear and descriptive
- The commit history should tell a story

### 6. Check CI Status

- All automated checks should pass
- If checks fail, the contributor should fix them before review continues

## Providing Feedback

### Be Constructive

- Focus on the code, not the person
- Explain *why* something should change, not just *what*
- Provide suggestions, not just criticism
- Acknowledge good work

### Be Specific

Bad: "This needs improvement"

Good: "This function handles both parsing and validation. Consider splitting it into two functions for better testability."

### Use Appropriate Terminology

- **Nitpick/nit**: Minor suggestion, not blocking (style, naming)
- **Suggestion**: Recommended improvement, use judgment
- **Request changes**: Must be addressed before merge
- **Question**: Seeking clarification, not necessarily a change request

### Example Comments

```markdown
**Nitpick**: Consider renaming `data` to `channelDetails` for clarity.

**Suggestion**: This could be extracted into a custom hook to make it
reusable in other components.

**Security concern**: This logs the invoice which may contain sensitive
payment details. Consider removing or redacting the log.

**Question**: Is there a reason we're not using the existing `formatSats`
utility here?
```

## Review Approval Terminology

Use these terms to communicate your review status:

### ACK (Acknowledged)

Full approval. You have:
- Reviewed the code thoroughly
- Tested the changes
- Approve the PR for merge

Example: `ACK 3a4b5c6 - Tested on iOS and Android, works as expected.`

### tACK (Tested ACK)

You have tested the changes but haven't done a full code review.

Example: `tACK - Tested the new channel open flow on Android, works correctly.`

### cACK (Concept ACK)

You agree with the concept/approach but haven't reviewed the implementation in detail.

Example: `cACK - I agree we need better error handling for failed payments.`

### NACK (Negative ACK)

You recommend against merging. Should include a detailed explanation.

Example: `NACK - This approach could lead to stuck payments in edge cases. See my detailed comment above.`

### Needs Changes

Specific changes are required before you can approve.

## Review Checklist

Use this checklist when reviewing PRs:

### Code Quality
- [ ] Code is readable and well-organized
- [ ] TypeScript types are appropriate (no unnecessary `any`)
- [ ] Follows existing code patterns
- [ ] No dead code or commented-out code
- [ ] Appropriate error handling

### Security
- [ ] No sensitive data logged or exposed
- [ ] Inputs are validated appropriately
- [ ] Secure storage used for sensitive data
- [ ] No potential fund loss scenarios

### Testing
- [ ] Tests pass (`yarn verify`)
- [ ] New functionality has test coverage
- [ ] Manually tested the changes
- [ ] Edge cases tested

### User Experience
- [ ] UI is consistent with existing design
- [ ] Works in different themes (light/dark)
- [ ] Localization strings added for new text
- [ ] Accessible

### Git
- [ ] Commits are atomic and well-described
- [ ] Branch is up-to-date with master
- [ ] No merge commits (rebased)

### Documentation
- [ ] User-facing changes are documented
- [ ] Complex code has appropriate comments
- [ ] PR description explains the changes

## Responding to Reviews

As a PR author, when receiving review feedback:

1. **Thank the reviewer** for their time
2. **Address all comments** - respond or make changes
3. **Use fixup commits** during review for easy re-review
4. **Don't take it personally** - feedback is about the code
5. **Ask for clarification** if feedback is unclear
6. **Squash fixups** before final merge

## Review Etiquette

### For Reviewers

- Review promptly when possible
- Be thorough but don't block on minor issues
- Approve when changes are good enough, not perfect
- Consider the contributor's experience level
- Be encouraging, especially to new contributors

### For Contributors

- Be patient - reviewers are volunteers
- Respond to all feedback
- Keep PRs reasonably sized for easier review
- Don't push changes without addressing feedback
- Be open to suggestions

## Time Expectations

- Simple changes: A few days
- Medium changes: 1-2 weeks
- Large changes: Varies based on complexity

Complex changes may require multiple review rounds. This is normal and helps ensure quality.

## Getting Your PRs Reviewed

To help get faster reviews:

1. **Keep PRs small and focused** - easier to review
2. **Write a clear description** - help reviewers understand context
3. **Include screenshots/videos** for UI changes
4. **Ensure CI passes** before requesting review
5. **Respond promptly** to feedback
6. **Be active in the community** - review others' PRs too

## Questions?

If you have questions about the review process:

- Ask in the [Developer Slack](https://zeusln.slack.com/join/shared_invite/zt-qw205nqa-o4VJJC0zPI7HiSfToZGoVw#/)
- Join the [Telegram](https://t.me/zeusLN)
- Comment on the PR or issue
