pdf.js 3.11.174 by Mozilla, Apache License 2.0 (notice at the top of each file).
Source: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/
Verified against cdnjs SRI sha512 hashes on 2026-11-17.
Kept on 3.x because it is a classic script that also works from file:// (4.x+ is ES-module only).
js/scan.js loads it with isEvalSupported: false, which closes CVE-2024-4367 for this version.
