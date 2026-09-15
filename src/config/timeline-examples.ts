/**
 * Timeline example corpus
 *
 * The "initial reliable demo set" named in the timeline roadmap's
 * "Case-study and demo corpus" section: published chronologies chosen because
 * each exercises a distinct extraction failure mode, and because all five are
 * plain HTML. The roadmap deliberately holds PDF-heavy, dynamic, mapped, and
 * high-volume sources (NTSB Dali, January 6, GAO, USGS, ACLED) back for the
 * advanced ingestion suite — do not promote one of those into this list without
 * confirming the extractor handles its format.
 *
 * These are third-party pages fetched live at the publisher's URL. Nothing here
 * redistributes source text; an example carries only a locator and our own
 * description of what it demonstrates. Extraction therefore reflects whatever
 * the publisher serves today, and an example can legitimately fail if a page
 * moves behind an interstitial or is retired.
 */

export interface TimelineExample {
  /** Stable id — safe to use as a React key and in analytics. */
  id: string
  /** Short label for the button. */
  title: string
  /** Who published it, shown as the secondary line. */
  publisher: string
  /** The page the extractor will be pointed at. */
  url: string
  /** One line on why this example is worth opening. */
  demonstrates: string
}

export const timelineExamples: TimelineExample[] = [
  {
    id: 'crowdstrike-falcon-pir',
    title: 'Falcon content update post-incident review',
    publisher: 'CrowdStrike',
    url: 'https://www.crowdstrike.com/en-us/blog/falcon-content-update-preliminary-post-incident-report/',
    demonstrates:
      'Deployment, detection, rollback and recovery in one short incident — the fastest end-to-end extraction.',
  },
  {
    id: 'nasa-apollo-13',
    title: 'Apollo 13 accident chronology',
    publisher: 'NASA',
    url: 'https://www.nasa.gov/history/detailed-chronology-of-events-surrounding-the-apollo-13-accident/',
    demonstrates:
      'Sub-minute sequencing against mission elapsed time, and a concise story drawn from a much denser ledger.',
  },
  {
    id: 'who-covid-chronology',
    title: 'COVID-19 timeline',
    publisher: 'World Health Organization',
    url: 'https://www.who.int/news/item/29-06-2020-covidtimeline',
    demonstrates:
      'A long-running institutional response with data cutoffs, where the record keeps being updated.',
  },
  {
    id: '911-commission-ch1',
    title: '9/11 Commission Report, Chapter 1',
    publisher: 'National Commission on Terrorist Attacks',
    url: 'https://911commission.gov/report/911Report_Ch1.htm',
    demonstrates:
      'Simultaneous aircraft, agency and command tracks, each with an explicit evidentiary basis.',
  },
  {
    id: 'cfr-us-iran-tracker',
    title: 'U.S.–Iran confrontation tracker',
    publisher: 'Council on Foreign Relations',
    url: 'https://www.cfr.org/global-conflict-tracker/conflict/confrontation-between-united-states-and-iran',
    demonstrates:
      'Contested, still-moving reporting with sources per entry and a visible last-updated state.',
  },
]
