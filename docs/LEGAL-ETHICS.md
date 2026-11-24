# Legal & Ethical Use

Hearth is built for **a parent or legal guardian to manage the devices of their own minor
child**, transparently. It is **not** a covert-surveillance ("stalkerware") tool and must not
be used to monitor another adult, an employee, a partner, or anyone without a lawful basis.

## Principles baked into the design
- **Transparency first.** The child device shows a visible "managed by Hearth" indicator and a
  consent/notice screen on first run. Covert, hidden-icon operation is intentionally not a goal.
- **Data minimization.** Capture only what a parental-control purpose needs. Screenshot capture
  and interval are configurable and can be disabled. Keyword lists target safety categories,
  not general reading of private conversations.
- **Security of sensitive data.** Screenshots and logs are encrypted at rest (M7), access is
  limited to the authenticated parent, and retention auto-purges on a configurable window.
- **Age-appropriateness.** As children grow, favor lighter-touch controls (reporting, agreed
  limits) over maximal monitoring. The UI should make graduated modes easy.

## Your responsibilities
- Monitoring minors' device use is generally lawful for parents/guardians, but **specifics vary
  by country/state** (wiretap, two-party consent, data-protection, and school/BYOD rules).
  Check local law. Nothing here is legal advice.
- For teenagers, consider informing them. Many jurisdictions and platform policies expect notice.
- iOS deliberately restricts silent monitoring. Hearth uses Apple-sanctioned mechanisms
  (Screen Time / Family Sharing / MDM profiles). Do not attempt to bypass platform protections.

## Out of scope (will not be built)
- Hidden/stealth mode designed to evade an informed user's awareness.
- Capturing credentials, two-factor codes, or full keystroke logs of messages.
- Any feature whose primary purpose is covert surveillance of a non-consenting adult.
