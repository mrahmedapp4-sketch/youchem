---
name: Student report images
description: Rendering constraint for embedded stamp and signature assets in student HTML/PDF reports.
---

Embedded report images should be loaded as data URLs, explicitly kept visible during print, and awaited before Chromium generates the PDF. Large source canvases may also require a clipped display frame so the actual mark is visible rather than only its whitespace.

**Why:** Browser preview and PDF generation can differ, and image load timing or print CSS can make valid embedded PNGs appear missing.

**How to apply:** When changing student report branding, verify both the HTML route and Chromium PDF path, not only the source file paths or CSS dimensions.