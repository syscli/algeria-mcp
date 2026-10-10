# Security

## Reporting a problem

Report security problems privately through GitHub:
https://github.com/syscli/algeria-mcp/security/advisories/new

Please do not open a public issue for them. You will get an answer within
7 days.

Wrong data or a wrong validation result is an ordinary bug: open an issue in
https://github.com/syscli/algeria or https://github.com/syscli/dz-format.

## Supported versions

Fixes go into the latest release. Until 1.0, there are no fixes for older
minor versions.

## What this server does

- It runs locally over stdio and only reads data shipped with its
  dependencies. It makes no network calls, writes no files and runs no
  commands. Every tool is read-only.
- Releases are published from GitHub Actions with npm provenance, so each
  version on npm can be traced to the commit and workflow that built it. Check
  it with `npm audit signatures`.
