---
name: Student access controls
description: Product/security boundary for account and browser-device blocking in the student platform.
---

Account blocking must remain the authoritative control for denying a student access. A browser/device identifier can add friction and stop reuse of the same browser profile, but it is not a hardware identity: clearing site storage, using private browsing, or switching devices can create a new identifier.

**Why:** Browser-managed identifiers are controlled by the user and cannot provide a cryptographic guarantee that a person can never return from another browser or device.

**How to apply:** Keep blocked accounts rejected server-side on every authenticated request, persist blocked device identifiers independently of the account so deleting an account does not immediately remove the device block, and describe the limitation honestly when discussing enforcement.