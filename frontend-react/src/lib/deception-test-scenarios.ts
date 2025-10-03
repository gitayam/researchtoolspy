/**
 * Historical Deception Test Scenarios
 * Real-world and simulated scenarios for testing and training
 * Based on documented intelligence community case studies
 */

import type { DeceptionScores } from './deception-scoring'

export interface TestScenario {
  id: string
  title: string
  category: 'historical' | 'training' | 'simulation'
  classification: 'UNCLASSIFIED' | 'HISTORICAL'
  scenario: string
  mom: string
  pop: string
  moses: string
  eve: string
  expectedScores: DeceptionScores
  expectedLikelihood: number
  groundTruth: 'CONFIRMED_DECEPTION' | 'NO_DECEPTION' | 'UNCERTAIN'
  learningPoints: string[]
  references?: string[]
}

export const DECEPTION_TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'operation-fortitude',
    title: 'Operation Fortitude - D-Day Deception (1944)',
    category: 'historical',
    classification: 'HISTORICAL',
    scenario: `Allied forces are preparing for a major amphibious assault on Nazi-occupied Europe. Intelligence indicates the First United States Army Group (FUSAG) under General Patton is massing in Southeast England, apparently preparing to invade Pas-de-Calais, the shortest crossing to France. Extensive radio traffic, dummy equipment, and agent reports confirm FUSAG's presence and readiness.

Key Indicators:
- FUSAG radio intercepts show 150,000+ troops in Southeast England
- Aerial reconnaissance confirms tank formations and landing craft
- Double agent reports detail invasion preparations for Pas-de-Calais
- General Patton (most aggressive Allied commander) leads the force
- Weather patterns favor late June invasion window

Question: Is the Allied invasion actually targeting Pas-de-Calais as indicated?`,

    mom: `MOTIVE: Allied forces have overwhelming motive to deceive about invasion location:
- Strategic surprise is critical for amphibious assault success
- German reserves at Pas-de-Calais would devastate actual landing site
- Deception could save thousands of Allied lives
- Historical precedent: Allies used deception successfully in North Africa, Sicily

OPPORTUNITY: Allies control multiple deception channels:
- Control of double agents through "Double Cross System"
- Complete air superiority prevents German aerial reconnaissance
- ULTRA intelligence allows Allies to read German Enigma traffic
- Monopoly on cross-channel information flow

MEANS: Allies possess sophisticated deception capabilities:
- Physical deception: Inflatable tanks, fake landing craft, dummy airfields
- Electronic deception: False radio traffic patterns
- Special Effects: Hollywood set designers create realistic dummy equipment
- Organizational: Dedicated deception planning units (London Controlling Section)`,

    pop: `HISTORICAL PATTERN: Allies have demonstrated consistent deception doctrine:
- Operation Mincemeat (1943): False documents on corpse deceived Germans about Sicily invasion
- Operation Barclay (1943): Multi-layered deception for North Africa
- Documented commitment to deception at highest strategic level
- British deception tradition dating to WWI

SOPHISTICATION: Allied deception capabilities are world-class:
- Dedicated deception planning organizations
- Integration with intelligence (ULTRA) for feedback
- Multi-domain approach (physical, electronic, human intelligence)
- Strategic patience (months of buildup)

SUCCESS RATE: Previous Allied deceptions have high success rate:
- Sicily invasion deception: Complete success
- North Africa deceptions: Significant impact
- Germans have fallen for Allied deceptions repeatedly
- No evidence of German penetration of Allied deception apparatus`,

    moses: `SOURCE VULNERABILITY: German intelligence sources are highly vulnerable:
- Double agents: All German agents in UK are controlled by British (unknown to Germans)
- Aerial reconnaissance: Impossible due to Allied air superiority
- Signals intelligence: German Enigma is compromised (unknown to Germans)
- Human intelligence in UK: Non-existent (MI5 controls all German agents)

MANIPULATION EVIDENCE: Strong evidence sources are being manipulated:
- Agent reports too consistent and convenient
- All sources point to same conclusion (Pas-de-Calais)
- Information arrives through channels Allies can control
- No independent corroboration available to Germans
- Pattern matches known Allied deception doctrine`,

    eve: `INTERNAL CONSISTENCY: Information is suspiciously consistent:
- All sources (agents, SIGINT, reconnaissance) align perfectly
- No contradictory intelligence
- Narrative is too clean and coherent
- Timing of information is convenient
- Details confirm German expectations (confirmation bias risk)

EXTERNAL CORROBORATION: Limited true independent corroboration:
- Cannot verify with neutral third parties
- All information flows through Allied-controlled channels
- Physical evidence (tanks, ships) could be fabricated
- No German agents operating independently in UK
- Cannot confirm Patton's actual location independently

ANOMALY DETECTION: Several anomalies present:
- FUSAG order of battle seems unusually large
- Patton's silence (uncharacteristic for such an aggressive commander)
- Concentration in Southeast England is obvious (why not conceal?)
- German expectations align perfectly with intelligence (suspicious)
- Invasion site (Pas-de-Calais) is most heavily defended (illogical choice)`,

    expectedScores: {
      motive: 5,
      opportunity: 5,
      means: 5,
      historicalPattern: 5,
      sophisticationLevel: 5,
      successRate: 5,
      sourceVulnerability: 5,
      manipulationEvidence: 5,
      internalConsistency: 2,
      externalCorroboration: 1,
      anomalyDetection: 4
    },

    expectedLikelihood: 85,
    groundTruth: 'CONFIRMED_DECEPTION',

    learningPoints: [
      'Perfect information consistency can be a deception indicator (too good to be true)',
      'Adversary motive and capability must be assessed independently of source reporting',
      'Source vulnerability analysis (MOSES) is critical - all German sources were compromised',
      'When adversary controls information channels, deception likelihood increases dramatically',
      'Historical patterns matter - Allies had demonstrated deception capabilities',
      'Anomalies (Patton commanding obvious buildup at most defended point) should raise suspicion',
      'Confirmation bias risk: Germans wanted to believe Pas-de-Calais was the target'
    ],

    references: [
      'Operation Fortitude: The D-Day Deception Campaign',
      'Double Cross System: MI5 Control of German Agents',
      'ULTRA: Allied Breaking of German Enigma Codes'
    ]
  },

  {
    id: 'cuban-missile-crisis',
    title: 'Soviet Missiles in Cuba - October 1962',
    category: 'historical',
    classification: 'HISTORICAL',
    scenario: `U-2 reconnaissance photographs show Soviet medium-range ballistic missile (MRBM) sites under construction in Cuba, 90 miles from Florida. Soviet Premier Khrushchev and Cuban leader Castro have repeatedly denied any offensive weapons deployment to Cuba, claiming only defensive SAM systems are present.

Key Intelligence:
- U-2 photos show clear MRBM site construction (October 14, 1962)
- Photo analysis: Sites match Soviet MRBM deployment pattern
- HUMINT reports: Soviet ships delivered large crated cargo to Cuba
- Soviet public statements: "Only defensive weapons in Cuba"
- Castro statements: "Cuba has right to defend itself"

Question: Are the Soviets actually deploying offensive nuclear missiles in Cuba, or is this a misinterpretation of defensive installations?`,

    mom: `MOTIVE: Soviets have limited motive to deceive about missile presence:
- If discovered, deception creates severe credibility damage
- Nuclear missile deployment would violate tacit understanding with US
- Risk of nuclear confrontation extremely high if deception discovered
- Soviet doctrine emphasizes secrecy, not deception (prefer denial over false narrative)
- Limited strategic benefit to lying after photographic evidence exists

OPPORTUNITY: Soviets have very limited deception opportunities:
- US has overhead reconnaissance capability (U-2)
- CIA has HUMINT sources in Cuba
- Cannot control US information collection
- Physical evidence (missile sites) cannot be hidden once constructed
- US cryptologic capabilities provide independent verification

MEANS: Soviets lack effective means for this deception:
- Cannot fake U-2 photographs
- Cannot manipulate US imagery analysis
- Cannot prevent US aerial reconnaissance
- Limited ability to create false physical sites
- Denial statements ineffective against photographic evidence`,

    pop: `HISTORICAL PATTERN: Soviet deception patterns differ from this case:
- Soviets historically use denial and secrecy, not elaborate deception
- No precedent for major strategic deception by Soviets against US
- Soviet doctrine emphasizes operational security over deception operations
- Pattern: Deny until evidence is overwhelming, then acknowledge

SOPHISTICATION: Soviet capabilities do not match deception requirements:
- Excellent at maskirovka (military deception in warfare)
- Limited strategic deception against US technical collection
- Cannot manipulate US satellite/aircraft imagery
- Stronger at denial than creating false narratives

SUCCESS RATE: Limited track record of strategic deception:
- Previous Soviet denials (military deployments) eventually proven true or false by evidence
- No successful strategic deception against US overhead reconnaissance
- US imagery analysis has proven reliable in past assessments`,

    moses: `SOURCE VULNERABILITY: US sources are not vulnerable to Soviet manipulation:
- U-2 imagery: Direct photographic evidence, not susceptible to human manipulation
- Photo interpreters: Trained analysts using standardized methodology
- Multiple independent collection platforms
- Imagery cross-referenced with HUMINT and SIGINT
- Soviet cannot access or manipulate US reconnaissance aircraft

MANIPULATION EVIDENCE: No evidence of source manipulation:
- Photographs are primary source (objective evidence)
- Analysis methodology is standard CIA procedure
- Multiple analysts reached same conclusion independently
- Physical evidence matches known Soviet MRBM deployment patterns
- No indicators of US source compromise`,

    eve: `INTERNAL CONSISTENCY: Evidence is highly consistent:
- U-2 photos clearly show MRBM site construction
- Site configuration matches Soviet MRBM deployment pattern exactly
- Timeline of construction matches MRBM site development
- Supporting evidence (ship cargo, construction activity) aligns
- Multiple photo missions confirm ongoing construction

EXTERNAL CORROBORATION: Strong independent corroboration:
- HUMINT reports align with photographic evidence
- SIGINT intercepts discuss missile deployment
- Physical site construction visible in photos
- Soviet defensive reactions (SAM deployments) consistent with protecting missile sites
- Multiple intelligence sources independently confirm

ANOMALY DETECTION: No significant anomalies detected:
- Site construction follows known Soviet MRBM pattern
- Scale and configuration match MRBM specifications
- Timeline reasonable for missile deployment
- Supporting infrastructure (roads, fuel storage) consistent
- Soviet behavior (denial) expected for sensitive deployment`,

    expectedScores: {
      motive: 1,
      opportunity: 1,
      means: 1,
      historicalPattern: 1,
      sophisticationLevel: 1,
      successRate: 1,
      sourceVulnerability: 0,
      manipulationEvidence: 0,
      internalConsistency: 5,
      externalCorroboration: 5,
      anomalyDetection: 0
    },

    expectedLikelihood: 5,
    groundTruth: 'NO_DECEPTION',

    learningPoints: [
      'Objective photographic evidence is difficult to manipulate or deceive',
      'When adversary lacks means to deceive (cannot fake satellite imagery), deception likelihood is low',
      'Strong external corroboration from independent sources increases confidence',
      'Adversary denial in face of physical evidence is expected behavior, not deception indicator',
      'Technical collection (overhead imagery) more reliable than human sources for physical deployments',
      'High internal consistency + high external corroboration + low manipulation vulnerability = high confidence in non-deception',
      'This case demonstrates when NOT to assess deception - clear physical evidence prevails'
    ],

    references: [
      'CIA Imagery Analysis of Soviet Missiles in Cuba',
      'Cuban Missile Crisis: Intelligence Assessment',
      'US Overhead Reconnaissance Programs'
    ]
  },

  {
    id: 'wmds-iraq-2003',
    title: 'Iraqi WMDs - Pre-Iraq War 2003',
    category: 'training',
    classification: 'HISTORICAL',
    scenario: `Intelligence community assesses that Iraq possesses weapons of mass destruction (WMDs) including chemical and biological weapons programs and possibly reconstituted nuclear program. Key source "Curveball" provides detailed information about mobile biological weapons laboratories. Iraqi regime denies WMD possession but refuses full compliance with UN inspectors.

Key Intelligence:
- Curveball (Iraqi defector): Detailed accounts of mobile bioweapons labs
- Aluminum tubes: Purchased by Iraq, possibly for uranium enrichment centrifuges
- Iraqi procurement: Dual-use equipment purchases consistent with WMD program
- UN inspections: Iraq's non-cooperation and gaps in accounting
- Satellite imagery: Facilities possibly related to WMD production

Question: Does Iraq possess active WMD programs as intelligence indicates?`,

    mom: `MOTIVE: Iraq has motive to deceive (but which direction?):
- If WMDs exist: Motive to hide them from UN/US
- If no WMDs: Motive to appear strong to Iran and domestic opponents
- Saddam's regime survival depends on appearing powerful
- Strategic ambiguity serves Iraqi interests
- Limited motive to deceive US intelligence community directly

OPPORTUNITY: Limited Iraqi opportunity to deceive US intelligence:
- Cannot control US satellite imagery
- Cannot manipulate US SIGINT collection
- Limited ability to plant false information in US intelligence channels
- Some opportunity through controlled defector access

MEANS: Iraqi deception means are limited:
- No access to US collection systems to manipulate
- Cannot create false satellite imagery
- Limited ability to control defector narratives after they leave Iraq
- Weak capabilities for sophisticated technical deception`,

    moses: `SOURCE VULNERABILITY: US sources have vulnerabilities:
- Curveball: Single source, no direct US access (handled by German intelligence)
- Never interviewed by US intelligence directly
- No corroborating sources for mobile bioweapons lab claims
- Defector motivation: Seeking asylum, possible embellishment
- Potential for defector fabrication not adequately assessed

MANIPULATION EVIDENCE: Some evidence of potential source issues:
- Curveball's handling was exclusively through foreign intelligence service
- German intelligence warnings about source reliability ignored
- Source had personal motivation (asylum) to provide alarming information
- Technical details of mobile labs later proven implausible
- No independent verification of Curveball's claims`,

    eve: `INTERNAL CONSISTENCY: Information has consistency problems:
- UN inspectors finding no evidence contradicts intelligence claims
- Aluminum tubes: Dual-use, equally consistent with conventional rockets
- Satellite imagery ambiguous (facilities could have multiple purposes)
- Gap between intelligence assessment certainty and evidence strength
- Intelligence community disagreement (State Department INR dissent)

EXTERNAL CORROBORATION: Weak independent corroboration:
- UN inspectors not finding WMDs (negative evidence)
- Satellite imagery inconclusive
- Most evidence relies on inference rather than direct observation
- Allied intelligence services have doubts
- No Iraqi WMD use despite military pressure (would expect use if possessed)

ANOMALY DETECTION: Several anomalies:
- Iraq allowing some inspections (risky if hiding WMDs)
- No Iraqi WMD use when regime survival threatened (2003 invasion)
- Intelligence certainty exceeds evidence quality
- Analytic assumptions driving conclusions (mirror imaging: "We would have WMDs in their position")
- Confirmation bias: Evidence fitting narrative emphasized, contradictory evidence minimized`,

    expectedScores: {
      motive: 2,
      opportunity: 2,
      means: 2,
      historicalPattern: 2,
      sophisticationLevel: 2,
      successRate: 2,
      sourceVulnerability: 4,
      manipulationEvidence: 3,
      internalConsistency: 2,
      externalCorroboration: 2,
      anomalyDetection: 4
    },

    expectedLikelihood: 45,
    groundTruth: 'NO_DECEPTION',

    learningPoints: [
      'CRITICAL: Assess whether intelligence is being deceived by adversary OR self-deceived by own assumptions',
      'Single-source intelligence (Curveball) without independent verification is high-risk',
      'Source vulnerability matters: Defector motivations (asylum-seeking) can lead to embellishment',
      'Confirmation bias is a deception indicator: Seeking evidence that confirms hypothesis while ignoring contradictions',
      'Analytic assumptions can create false certainty: "They must have WMDs because we would"',
      'Anomaly: Iraq not using WMDs when regime survival at stake suggests they may not exist',
      'This case shows intelligence failure from self-deception rather than adversary deception',
      'Policy pressure can create bias: Analysts may unconsciously support policy preferences'
    ],

    references: [
      'Senate Intelligence Committee Report on Iraqi WMD Intelligence',
      'Curveball: The Defector Who Fooled the World',
      'CIA Inspector General Report on Iraqi WMDs'
    ]
  },

  {
    id: 'training-scenario-1',
    title: 'Training Scenario: Adversary Military Exercise',
    category: 'training',
    classification: 'UNCLASSIFIED',
    scenario: `Adversary nation announces major military exercise along border, citing "routine annual training." Exercise involves 75,000 troops, armor, artillery, and air support. Timing coincides with political tensions over disputed territory.

Intelligence Indicators:
- Exercise larger than previous years (typical: 20,000 troops)
- Forward positioning of logistics (fuel, ammunition)
- Call-up of reserve units (not typical for exercises)
- Exercise duration extended from 2 weeks to "indefinite"
- Communication patterns differ from previous exercises

Question: Is this actually a routine military exercise or preparation for invasion masked as exercise?`,

    mom: `MOTIVE: Adversary has strong motive to use exercise as invasion cover:
- Allows troop massing without international alarm
- Political tensions provide justification for "enhanced readiness"
- Historical precedent: Major powers have used exercises as invasion pretexts (Russia-Ukraine 2022)
- Strategic surprise achieved through deception

OPPORTUNITY: Adversary controls narrative around exercise:
- Can declare any military activity as "exercise"
- Controls timing, scale, and duration
- Can modify "exercise" parameters at will
- International norms accept sovereign military exercises

MEANS: Adversary possesses deception means:
- Established exercise pattern provides plausible cover
- Can stage realistic exercise while maintaining invasion option
- Physical preparations (logistics forward) serve dual purpose
- Communications can be managed to appear routine`,

    pop: `HISTORICAL PATTERN: Adversary has used exercise deception before:
- 2014: "Exercise" preceded territorial seizure
- Pattern of exercises escalating to military action
- Doctrine emphasizes maskirovka (military deception)
- Cultural acceptance of deception as legitimate military tool

SOPHISTICATION: Adversary has professional deception capabilities:
- Military deception integrated into operational planning
- Professional maskirovka units
- Track record of successful military deceptions
- Multi-domain deception (political, military, information)

SUCCESS RATE: Previous exercises-to-invasion have succeeded:
- International community typically accepts exercise narrative
- By the time deception clear, military advantage already gained
- Costs of deception (diplomatic) outweighed by military benefits`,

    moses: `SOURCE VULNERABILITY: Our sources are moderately vulnerable:
- Open source (exercise announcements): Controlled by adversary
- SIGINT: Can be manipulated through false communications
- Satellite imagery: Shows physical reality but intent is ambiguous
- HUMINT: Limited access to adversary decision-making
- Exercise participants may genuinely believe it's an exercise

MANIPULATION EVIDENCE: Some indicators of possible manipulation:
- Official statements emphasize "routine" nature (potentially scripted)
- Exercise announcement timing convenient (provides cover)
- Communications patterns designed to appear normal
- No independent confirmation of exercise vs. invasion intent`,

    eve: `INTERNAL CONSISTENCY: Significant inconsistencies present:
- "Routine" exercise is 3x larger than previous years
- Logistics positioning excessive for exercise (fuel/ammo forward)
- Reserve call-up unusual for exercise
- "Indefinite" duration inconsistent with exercise narrative
- Political timing (tensions) contradicts "routine annual" claim

EXTERNAL CORROBORATION: Limited independent verification:
- Cannot independently verify true purpose
- Satellite imagery confirms military buildup but not intent
- No neutral third party can confirm "exercise" vs. invasion prep
- Historical pattern suggests exercises can be pretexts

ANOMALY DETECTION: Multiple anomalies detected:
- Scale anomaly: 3x larger than historical exercises
- Logistics anomaly: Forward positioning excessive
- Duration anomaly: "Indefinite" vs. planned 2-week exercises
- Timing anomaly: Coincides with political tensions
- Communications anomaly: Patterns differ from previous exercises`,

    expectedScores: {
      motive: 5,
      opportunity: 5,
      means: 4,
      historicalPattern: 4,
      sophisticationLevel: 4,
      successRate: 4,
      sourceVulnerability: 4,
      manipulationEvidence: 3,
      internalConsistency: 2,
      externalCorroboration: 2,
      anomalyDetection: 5
    },

    expectedLikelihood: 75,
    groundTruth: 'UNCERTAIN',

    learningPoints: [
      'Exercise-as-cover is common deception technique in military operations',
      'Anomalies (scale, logistics, duration) are key deception indicators',
      'Intent cannot be directly observed - must be inferred from actions',
      'Historical patterns matter - adversary doctrine includes maskirovka',
      'Multiple anomalies increase deception likelihood significantly',
      'Even if "exercise" is genuine, preparations enable rapid transition to invasion',
      'Intelligence should assess both "is it deception?" and "what are our decision timelines?"'
    ]
  }
]

/**
 * Get test scenario by ID
 */
export function getTestScenario(id: string): TestScenario | undefined {
  return DECEPTION_TEST_SCENARIOS.find(s => s.id === id)
}

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(category: TestScenario['category']): TestScenario[] {
  return DECEPTION_TEST_SCENARIOS.filter(s => s.category === category)
}

/**
 * Validate AI analysis against ground truth
 */
export function validateAnalysis(
  scenarioId: string,
  calculatedLikelihood: number,
  calculatedScores: Partial<DeceptionScores>
): {
  accurate: boolean
  likelihoodDelta: number
  scoreDelta: { [key: string]: number }
  assessment: string
} {
  const scenario = getTestScenario(scenarioId)
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found`)
  }

  const likelihoodDelta = Math.abs(calculatedLikelihood - scenario.expectedLikelihood)
  const scoreDelta: { [key: string]: number } = {}

  let totalScoreDelta = 0
  let scoreCount = 0

  Object.keys(scenario.expectedScores).forEach(key => {
    const expected = scenario.expectedScores[key as keyof DeceptionScores]
    const calculated = calculatedScores[key as keyof DeceptionScores] || 0
    const delta = Math.abs(calculated - expected)
    scoreDelta[key] = delta
    totalScoreDelta += delta
    scoreCount++
  })

  const avgScoreDelta = totalScoreDelta / scoreCount
  const accurate = likelihoodDelta <= 15 && avgScoreDelta <= 1.5

  let assessment = ''
  if (accurate) {
    assessment = `Excellent accuracy: ${likelihoodDelta}% likelihood delta, ${avgScoreDelta.toFixed(1)} avg score delta`
  } else if (likelihoodDelta <= 25 && avgScoreDelta <= 2) {
    assessment = `Good accuracy: ${likelihoodDelta}% likelihood delta, ${avgScoreDelta.toFixed(1)} avg score delta`
  } else {
    assessment = `Needs improvement: ${likelihoodDelta}% likelihood delta, ${avgScoreDelta.toFixed(1)} avg score delta`
  }

  return {
    accurate,
    likelihoodDelta,
    scoreDelta,
    assessment
  }
}
