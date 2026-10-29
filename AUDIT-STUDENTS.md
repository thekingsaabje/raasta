# Five-student walk-through (2026-10-29)

The live site was used as five fictional students. Each profile was run through the real assessment API (`/api/route/evaluate`), and every page was viewed at laptop (1440×900) and phone (390×844) sizes.

| Student | Profile | What went wrong before | Fixed |
|---|---|---|---|
| **Ayesha** | FSc 82%, wants a bachelor's, small budget | Deutschlandstipendium and other "apply once you're enrolled" awards appeared as fits she could apply for from Pakistan. The next steps were generic ("attestation"), with no IBCC step for FSc. | Each award now shows a timing note: "You apply after a university there has admitted or enrolled you". An IBCC equivalence step is added for intermediate holders, with the official link. |
| **Bilal** | BSCS 3.1/4, 2-year gap, no IELTS, wants a master's in Germany | Both DAAD master's programmes showed as **potential fits**, although our own research quoted DAAD: Pakistan isn't on the programme's country list. | The exclusion is now a checkable rule (`residence_excluded`), and both show as "Likely not eligible" with the quote. MAECI is fixed the same way (`nationality_excluded`). |
| **Hamza** | Self-funded, year 2 in China | He was told to "Plan a language test" and shown new-applicant awards as if he could use them now. | Students already abroad get "Ask your university's international office" and renewal steps instead. New-applicant awards say they're "Relevant only if you apply for your next degree". |
| **Sana** | MPhil 3.6, IELTS 6.5, wants a PhD in Italy | Only one Italian PhD lead, and several "closed" rows with nothing to do. | Every scholarship page now has a step-by-step "How to apply" plan. For closed rounds it says "Prepare now so you're ready when the next call opens". Thin PhD coverage remains a data gap (see TODO). |
| **Usman** | BCom 65%, master's anywhere, PKR 3M | 28 results with the same generic next steps, mostly "needs confirmation". | Next steps are now country-specific: Campus China/CSC, German missions and the visa money proof, Universitaly pre-enrolment and CIMEA, and Korea GKS. Each has its official site. Results sort by the soonest deadline. A "full funding only" answer puts fully funded awards first. |

## Other problems seen as a student
- **Typography felt flat.** The thin condensed serif is replaced by **Bricolage Grotesque** (bold, characterful headings) and **Figtree** (friendly, readable text). Both are self-hosted and free (OFL).
- **"Not yet verified" was everywhere and read as "don't trust this".** Labels now say what the official page shows: "Open · per official page". When the new free checker has re-read the page and found the quoted text, the label becomes "Open · checked 29 Oct". "Confirmed" is still reserved for records a reviewer has checked.
- **Students saw internal operating details.** The Tavily search quota and the internal research notes ("evidence-check… raw text read") are now shown to admins only.
- **The homepage put browsing first.** "Find my scholarships" (the guided route) is the main button again, and "Browse all awards" is secondary.
- **The language question had no "I don't have one yet" answer**, so students kept being told it was missing. It now has three answers: a result, "Not yet", or "My degree was taught in English (MOI)". The MOI answer adds a step to ask each university in writing.
- **Search needed exact spelling.** The catalogue now uses typo-tolerant search (minisearch): "daad scholarsip" and "politecnico milan" both work.
- **Accessibility.** An automated axe-core audit now runs on six key pages. It found contrast that was too low on grey text and table markup that confused screen readers. Both are fixed, and the check now passes with no serious or critical issues.
- **Stale results.** A slow, older request could overwrite newer filtered results in the catalogue. This is fixed in the shared data hook.

## Still open
- Korea has been added; see REPORT.md for the records and their sources.
- PhD-specific Italian and German funding coverage is thin.
- No record is reviewer-confirmed yet. The founder needs to confirm records in Admin → Scholarships, where the "Confirm" buttons are.
