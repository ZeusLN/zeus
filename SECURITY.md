# Security Policy

ZEUS is a self-custodial Bitcoin/Lightning wallet and remote node manager. Vulnerabilities in ZEUS can put user funds and privacy at risk, and we take every report seriously.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or social media.**

Instead, email us at **zeusln@tutanota.com**.

If your report contains sensitive details, please encrypt it with our PGP key:

- Key ID: `AAC48DE8AB8DEE84`
- Fingerprint: `96C2 2520 7F21 37E2 78C3 1CF7 AAC4 8DE8 AB8D EE84`
- Available [in this repo](https://github.com/ZeusLN/zeus/blob/master/PGP.txt) and at [zeusln.com/PGP.txt](https://zeusln.com/PGP.txt)

### What to include

To help us triage and resolve the issue quickly, please include as much of the following as you can:

- A description of the vulnerability and its potential impact
- Step-by-step instructions to reproduce the issue
- The affected version(s) of ZEUS, your platform (Android/iOS), and the wallet/backend type in use (e.g. embedded LND, remote LND, Core Lightning, LndHub, Nostr Wallet Connect, Cashu)
- Any proof-of-concept code, logs, or screenshots (please redact seeds, macaroons, runes, and other credentials)
- Whether the issue has been disclosed anywhere else

### What to expect

- We will acknowledge your report as soon as possible and keep you informed as we investigate
- We will work with you to understand and validate the issue
- Once a fix is released, we are happy to credit you for the discovery if you would like

We ask that you give us a reasonable amount of time to address the issue before any public disclosure, and that you avoid actions that put user funds or data at risk (e.g. accessing or modifying other users' wallets) while researching.

## Scope

Reports of particular interest include:

- Loss or theft of user funds
- Exposure of seeds, private keys, macaroons, runes, or other credentials
- Bypass of PIN, passphrase, or duress protections
- Payment, invoice, or swap handling flaws (overpayment, amount manipulation, fake payment confirmation)
- Privacy leaks (e.g. traffic that bypasses Tor when Tor is enabled, certificate validation flaws)
- Vulnerabilities in ZEUS-operated infrastructure users depend on (ZEUS Pay, LSP)

Issues in third-party dependencies (LND, Core Lightning, LDK, etc.) should be reported upstream to the respective projects, though we appreciate a heads-up if ZEUS is affected.

## Supported Versions

Only the latest release of ZEUS is supported with security updates. Please make sure you are running the most recent version, and update before reporting if possible.

## Verifying Releases

All releases and all maintainer commits since October 20, 2021 are signed with the PGP key above. Android builds are reproducible; see [docs/ReproducibleBuilds.md](docs/ReproducibleBuilds.md) for how to verify that a released APK matches the source code.
