/**
 * Framework Examples
 * These examples demonstrate proper usage of each framework
 * and serve as templates for users
 */

export interface FrameworkExample {
  framework_type: string
  title: string
  description: string
  is_example: boolean
  data: any
}

export const frameworkExamples: FrameworkExample[] = [
  {
    framework_type: 'behavior',
    title: '[EXAMPLE] Voting in U.S. Federal General Elections',
    description: 'Comprehensive behavior analysis of voting behavior in American federal general elections, documenting when, where, and how citizens cast ballots.',
    is_example: true,
    data: {
      basic_info: [
        {
          question: 'What behavior are you analyzing?',
          answer: 'Voting in person at a polling location during a U.S. federal general election (for President, Senate, and House of Representatives)'
        },
        {
          question: 'Where does this behavior occur?',
          answer: 'Designated polling places across all 50 states, District of Columbia, and U.S. territories. Locations include public schools, community centers, libraries, churches, government buildings, and other accessible public spaces.'
        },
        {
          question: 'When does this behavior typically occur?',
          answer: 'Federal general elections occur on the first Tuesday after the first Monday in November in even-numbered years. Polls typically open 6:00-7:00 AM and close 7:00-9:00 PM depending on state law. Early voting periods vary by state, ranging from 4-45 days before Election Day.'
        }
      ],
      timeline: {
        description: 'Timeline of voting behavior from voter registration through ballot casting',
        events: [
          {
            time: '30-45 days before election',
            event: 'Voter registration deadline (varies by state)',
            duration: 'One-time or periodic update',
            notes: 'Some states allow same-day registration; others require registration 30 days prior'
          },
          {
            time: '4-45 days before election',
            event: 'Early voting period begins (if available in state)',
            duration: 'Varies widely by state',
            notes: '43 states and DC offer early voting; hours and locations vary'
          },
          {
            time: '1-7 days before election',
            event: 'Voter reviews sample ballot and polling location',
            duration: '10-30 minutes',
            notes: 'Many voters research candidates and ballot measures online or via mail'
          },
          {
            time: 'Election Day morning (6:00 AM - 12:00 PM)',
            event: 'Voter arrives at polling location',
            duration: '5-120 minutes total (including wait time)',
            notes: 'Morning hours typically see higher traffic before work'
          },
          {
            time: 'Upon arrival',
            event: 'Voter checks in with poll worker',
            duration: '1-5 minutes',
            notes: 'Provides name/address, shows ID if required by state, receives ballot'
          },
          {
            time: 'After check-in',
            event: 'Voter proceeds to voting booth/station',
            duration: '5-15 minutes',
            notes: 'Marks paper ballot or uses electronic voting machine'
          },
          {
            time: 'After completing ballot',
            event: 'Voter submits ballot',
            duration: '1-2 minutes',
            notes: 'Feeds paper ballot into scanner or confirms electronic submission'
          },
          {
            time: 'After submission',
            event: 'Voter receives "I Voted" sticker and exits',
            duration: '30 seconds',
            notes: 'Symbolic completion ritual'
          }
        ],
        alternative_paths: [
          {
            path: 'Mail-in/Absentee voting',
            description: 'Voter requests, completes, and mails ballot from home',
            notes: 'Available in all states but requirements vary; some states are vote-by-mail only'
          },
          {
            path: 'Drop-box submission',
            description: 'Voter completes mail ballot but deposits in secure drop box',
            notes: 'Available in 28 states; seen as faster/more reliable than mail'
          },
          {
            path: 'Provisional ballot',
            description: 'Voter whose eligibility is questioned casts provisional ballot',
            notes: 'Counted after eligibility is verified post-election'
          }
        ]
      },
      environmental_factors: [
        {
          question: 'What physical infrastructure exists?',
          answer: 'Polling places require: accessible buildings with parking, ADA-compliant entrances and voting booths, climate-controlled indoor spaces, privacy booths/curtains, ballot scanners or electronic voting machines, tables for poll workers, signage indicating polling location, backup power sources, and security measures.'
        },
        {
          question: 'What resources are available?',
          answer: 'Resources include: paper ballots or electronic voting systems, ballot marking devices for accessibility, magnifying tools, audio ballots, poll worker assistance, sample ballots, voter information pamphlets, language assistance (as required by Voting Rights Act), curbside voting for disabled voters, and "I Voted" stickers.'
        },
        {
          question: 'What are the accessibility considerations?',
          answer: 'Legal requirements: ADA compliance, wheelchair accessibility, assistance for voters with disabilities, language assistance in jurisdictions with significant non-English speaking populations, curbside voting options. Barriers: Limited parking, long distances from parking to entrance, lack of public transportation, limited hours conflicting with work schedules.'
        },
        {
          question: 'What physical constraints or enablers exist?',
          answer: 'Constraints: Limited number of voting machines/booths creates wait times, single entrance/exit creates bottlenecks, lack of seating for elderly/disabled waiting, weather (rain/snow) impacts outdoor waiting. Enablers: Extended early voting hours, multiple polling locations, vote centers allowing any voter in county, mail-in voting infrastructure.'
        },
        {
          question: 'What environmental conditions affect this?',
          answer: 'Weather impacts voter turnout and comfort (rain, snow, extreme heat/cold affect willingness to wait in lines). Natural disasters can disrupt elections. Seasonal darkness in northern states due to November timing. COVID-19 pandemic significantly altered voting infrastructure with social distancing, sanitization, and shift to mail voting.'
        }
      ],
      social_context: [
        {
          question: 'What are the cultural norms around this behavior?',
          answer: 'Voting is viewed as a civic duty and patriotic act. Strong cultural emphasis on "I Voted" stickers as social proof. Many families have traditions of voting together. First-time voters often accompanied by family. Social media sharing of voting (photos outside polling places). Workplace culture varies: some employers provide paid time off, others do not. Veterans and elderly often seen as highly committed voters.'
        },
        {
          question: 'What social influences exist?',
          answer: 'Family: Parents often bring children to polling places as civic education; family political discussions influence participation. Peers: Social network voting status influences turnout (social pressure). Community: Churches, unions, and community organizations mobilize voters. Media: News coverage, social media reminders, celebrity endorsements. Political campaigns: Door-to-door canvassing, phone banking, mailers, text reminders.'
        },
        {
          question: 'Are there community leaders or influencers?',
          answer: 'Political party organizers, clergy/religious leaders, union leaders, community activists, local elected officials, teachers, social media influencers, celebrities, trusted family matriarchs/patriarchs, veterans groups, civic organizations (League of Women Voters).'
        },
        {
          question: 'What group dynamics or social pressures exist?',
          answer: 'Peer pressure to vote (asking "did you vote?"), family expectations especially in politically engaged families, workplace discussions creating social pressure, competitive dynamics between political groups, shame/stigma for not voting in some communities, pride in multi-generational voting traditions.'
        },
        {
          question: 'How do people talk about or communicate about this behavior?',
          answer: 'Social media: Sharing "I Voted" stickers, check-ins at polling places, reminders to vote. Conversations: Asking friends/family if they voted, discussing wait times, comparing experiences. News media: Coverage of lines, issues, projections. Campaign communications: Texts, emails, mailers, door knocks reminding to vote. Word of mouth about polling place locations and wait times.'
        }
      ],
      consequences: [
        {
          question: 'What are the immediate consequences?',
          answer: 'Positive: Receive "I Voted" sticker (social proof), sense of civic accomplishment, ability to legitimately participate in post-election discussions. Negative: Time cost (15 minutes to 2+ hours), may miss work/wages, physical discomfort from waiting in line. Neutral: Ballot is cast and counted (ideally).'
        },
        {
          question: 'What are the long-term outcomes?',
          answer: 'Individual vote contributes to election outcomes, strengthens democratic participation habit, maintains voter registration status, eligibility for jury duty, sense of political efficacy, ability to hold elected officials accountable, potential policy outcomes aligned with vote choice.'
        },
        {
          question: 'What rewards exist (intrinsic and extrinsic)?',
          answer: 'Intrinsic: Civic pride, sense of duty fulfilled, psychological satisfaction, feeling connected to democracy, empowerment. Extrinsic: "I Voted" sticker, social approval, free food/drinks from businesses (Krispy Kreme, Starbucks offers), ability to complain about government legitimately, avoiding social judgment for not voting.'
        },
        {
          question: 'What costs or penalties exist?',
          answer: 'Time cost: 15 minutes to 3+ hours. Economic: Lost wages if no paid time off, childcare costs, transportation costs. Physical: Standing in line, parking challenges. Psychological: Decision fatigue from complex ballots, anxiety about doing it correctly, intimidation if poll watchers present. Opportunity cost: Could be doing something else.'
        },
        {
          question: 'What unintended consequences occur?',
          answer: 'Long lines can deter future voting, complex ballots lead to undervoting, partisan poll watching can intimidate some voters, voter ID laws disproportionately affect some populations, consolidation of polling places increases travel burden, same-day registration challenges for poll workers, provisional ballots create uncertainty, mail voting can be rejected for signature mismatch.'
        }
      ],
      symbols: [
        {
          question: 'What symbols are associated with this behavior?',
          answer: '"I Voted" sticker (oval, red/white/blue, American flag), American flag at polling locations, campaign signs outside polling places (within legal distance), ballot box imagery, purple finger ink (international symbol), suffragette colors (purple, white, gold), party symbols (donkey, elephant).'
        },
        {
          question: 'What signals indicate someone is about to do this or has done it?',
          answer: 'Before: Discussing Election Day plans, checking polling location online, researching candidates, social media posts about voting plans. During: Walking toward polling location, waiting in line, "I Voted" sticker selfies. After: "I Voted" sticker worn all day, social media posts, discussions about voting experience, checking election results.'
        },
        {
          question: 'Are there visual cues?',
          answer: '"I Voted" stickers on clothing, campaign t-shirts/buttons, political bumper stickers, yard signs, polling place signage (American flag, "Vote Here" signs), red/white/blue decorations, ballot imagery, democratic symbols (eagle, liberty bell), party colors (red/blue).'
        },
        {
          question: 'Are there auditory cues?',
          answer: 'News anchors reminding "get out and vote," political ads on TV/radio, poll workers calling out numbers or names, ballot scanner beep when ballot is accepted, conversations in line about candidates, "I Voted" social media notifications with sounds, patriotic music at campaign events.'
        },
        {
          question: 'What social status or identity markers exist?',
          answer: '"I Voted" sticker signals civic engagement and social responsibility, discussing voting demonstrates political awareness, first-time voter status celebrated, veteran/military voter honored, multi-generational voting photos show family civic tradition, political party affiliation signaled by merchandise, informed voter status from discussing down-ballot races.'
        }
      ],
      observed_patterns: [
        {
          question: 'What variations exist in how people perform this?',
          answer: 'Method variations: In-person Election Day, early in-person, mail-in/absentee, drop box. Timing: Morning before work, lunchtime, evening after work, mid-day (retirees/flexible schedules). Preparation: Some research all candidates, others straight-ticket vote, some decide in booth. Social: Voting alone, with family, with friends, bringing children as education.'
        },
        {
          question: 'What are common sequences or typical paths?',
          answer: 'Most common: (1) Register to vote → (2) Receive voter registration card → (3) Research candidates few days before → (4) Vote in person on Election Day morning → (5) Submit ballot → (6) Wear "I Voted" sticker → (7) Share on social media → (8) Watch results that night.'
        },
        {
          question: 'What shortcuts or workarounds do people use?',
          answer: 'Early voting to avoid Election Day lines, mail voting to avoid lines entirely, voting at less busy times (mid-morning, early afternoon), bringing sample ballot pre-filled out to speed booth time, using voter guides from trusted sources rather than independent research, straight-ticket voting to reduce decision time, strategic polling place selection if multiple locations available.'
        },
        {
          question: 'How does performance vary by subgroup or demographic?',
          answer: 'Elderly: Higher turnout, more likely to vote in person, more familiar with process. Young people: Lower turnout, more likely to need assistance, more likely to vote by mail. Minorities: May face longer wait times due to polling place locations, higher use of provisional ballots. Rural vs urban: Different infrastructure, wait times, access to early voting. Wealthy vs poor: Paid time off vs wage loss, transportation access varies.'
        },
        {
          question: 'What adaptations do people make to constraints?',
          answer: 'Work constraints: Vote early morning or use early voting. Childcare: Bring children or vote by mail. Transportation: Carpool, use ride-sharing programs, request absentee ballot. Disability: Use curbside voting, mail voting, assisted voting. Language barrier: Bring translator, use language assistance, request bilingual ballot. Long lines: Vote during off-peak hours or early vote. Voter ID: Obtain free state ID, use alternative verification.'
        }
      ],
      potential_audiences: [
        {
          question: 'Who currently performs this behavior?',
          answer: 'In 2020: ~67% of eligible voters (158 million people). Higher rates: Age 65+ (74%), college graduates (77%), higher income households, white voters (71%), long-time residents, married individuals. Consistent voters across election cycles.'
        },
        {
          question: 'Who could perform it but doesn\'t?',
          answer: '~33% of eligible voters (~80 million). Disproportionately: Age 18-29 (52% turnout), less than high school education (51%), lower income, minorities (though varies), renters vs homeowners, recently moved, unmarried, those with criminal records (if eligible), those who face language barriers.'
        },
        {
          question: 'What are the key demographic segments?',
          answer: 'By age: Young voters (18-29), middle-aged (30-54), seniors (55+). By education: High school or less, some college, college graduates, advanced degrees. By race: White, Black, Hispanic, Asian, Native American. By location: Urban, suburban, rural. By income: Under $30K, $30-75K, $75K+. By partisanship: Democrats, Republicans, Independents.'
        },
        {
          question: 'What psychographic differences exist between groups?',
          answer: 'Highly engaged: Political news consumers, party activists, issue voters, civic-minded, high political efficacy. Disengaged: Feel vote doesn\'t matter, distrustful of system, politically alienated, see all candidates as same. Intermittent: Vote in presidential but not midterm elections, vote only when personally affected, need social mobilization.'
        },
        {
          question: 'Who influences whether others perform this?',
          answer: 'Direct: Family members (especially parents), friends, coworkers, romantic partners. Institutional: Political parties, campaigns, civic organizations, religious leaders, union organizers, community activists. Media: News anchors, political commentators, social media influencers, celebrities. Systemic: Poll workers, election administrators, employers (through time-off policies).'
        }
      ]
    }
  }
]
