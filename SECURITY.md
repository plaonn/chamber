# Security Policy

Chamber is a small, pre-1.0, maintainer-led open-source project. Security reports are handled on a best-effort basis. Security fixes normally target the current `main` branch; historical releases or snapshots may not receive backports.

## Reporting a vulnerability

Do **not** publish exploit details, credentials, private transcripts, sensitive hook payloads, or other confidential material in a public GitHub issue.

If GitHub offers **Private vulnerability reporting** for this repository, use the repository's Security tab and choose the private vulnerability reporting flow.

If that option is not available, open only a minimal public issue requesting a private security contact path. Do not include reproduction details, exploit code, sensitive logs, or affected private data in that issue.

A useful private report should contain only what is necessary to assess the issue:

- affected Chamber version or commit;
- affected runtime/adapter and version;
- impact and attacker prerequisites;
- minimal reproduction or proof of concept;
- suggested mitigation, if known.

Please sanitize all evidence. Chamber's normal privacy boundary also applies to security reports: do not send real secrets, credentials, private transcripts, or unrelated sensitive payloads when synthetic evidence can demonstrate the issue.

## Scope

Security issues include vulnerabilities in Chamber code or documented Chamber-controlled behavior. Vulnerabilities in Codex, Gemini CLI, GitHub, operating systems, or other third-party services should normally be reported to their respective maintainers unless Chamber creates or materially worsens the vulnerability.

There is no bug-bounty program or guaranteed response-time SLA.
