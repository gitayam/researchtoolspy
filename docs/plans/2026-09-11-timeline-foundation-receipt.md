# Timeline foundation delivery receipt

Later publication and deployment are recorded in the [release receipt](./2026-09-11-timeline-release-receipt.md). This receipt preserves its original local-validation state.

Historical receipt: the [continuation](./2026-09-11-timeline-continuation-receipt.md)
resolves the browser limitations recorded below and adds the first durable API slice.

Date: 2026-09-11. Local implementation only; no canonical landing, mirror update,
or deployment. The dirty primary checkout remains untouched.

Implementation and independent source acceptance bind candidate
`98495ac3e3b33e238aa2be43751a10a4843e4bff` on
`work/timeline-foundation-20260911`, based on
`559425f24802911715676173db4e7bae81a99efb`.
The later receipt commit changes documentation only. Native cooperative editors
owned the TL-00 and TL-02 file sets in the [charter](./2026-09-11-timeline-tranche-charter.md);
the integration owner committed, and validator_review independently accepted the
exact candidate. No external model dispatch or remote candidate transfer occurred.

TL-00 supplies frozen extraction/error schemas, OpenAPI, a bounded generic client,
and a versioned synthetic fixture corpus/rubric. TL-02 supplies local narrative
metadata, chapters, selected-event ordering, stable inspection links, strict import,
and recovery of unreadable drafts. Original extraction and ledger identities remain
separate from narrative presentation. These features do not implement durable storage
or published evidence links.

| Verification at candidate | Result |
| --- | --- |
| Focused existing and new contract suites | 67 passed |
| App, functions, workers, scraping, standalone client TypeScript | All five passed |
| Vite production build | Passed; large-chunk advisory remains |
| Chromium timeline UI suites | 15 passed; 6 download-dependent failures |
| Credential-free validator boundary canary | Passed |
| Independent source review | Accepted; no source blockers |
| Mobile Safari / complete verification command | Incomplete |

All candidate commands ran in a credential-free macOS validator with read-only
source, explicit writable output paths and loopback-only networking. Boundary
probes denied outside file access, credential/controller access, inherited child
access and external networking. This is a cooperative verification lane, not
qualification for hostile autonomous external model execution.

The six Chromium failures all stop at `download.path: canceled`. A minimal
browser-only Blob download with an attached anchor and no URL revocation also
fails, supporting an environment limitation; application export correctness is
still unverified. Matching WebKit 2287 stalls while creating a page before loading
the application; a newer installed version also stalled. Docker fallback stalled
before exposing a socket, so no container test success is claimed. Download tests
retain their real byte assertions. No release gate was weakened to obtain green tests.
The desktop narrative screenshot was inspected; mobile visual acceptance remains open.

TL-00 is `verified_local`; TL-02 remains implemented with acceptance incomplete.
TL-01 and TL-03 through TL-18 remain pending. Resume acceptance in a qualified
browser validator with matching Playwright browsers, then run `npm run test:timeline`
from the integration worktree. Actual download/import/recovery and mobile Safari
checks must pass before TL-02 is marked verified.

The [machine receipt](./2026-09-11-timeline-foundation-receipt.json) records commands,
exit codes, instruction/prompt/runtime/log fingerprints and publication state.
Source-bearing test logs and browser artifacts remain private in the local validator
output directory; the repository contains only redacted metadata.
