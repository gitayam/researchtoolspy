# Deception Detection Framework - User Guide

**Intelligence-Grade Analysis Using CIA SATS Methodology**

Version 1.0 | October 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Methodology: MOM-POP-MOSES-EVE](#methodology)
4. [Step-by-Step Workflow](#workflow)
5. [Scoring Guidelines](#scoring)
6. [AI-Assisted Analysis](#ai-analysis)
7. [Report Generation](#reports)
8. [Predictions & Trends](#predictions)
9. [Best Practices](#best-practices)
10. [Common Pitfalls](#pitfalls)
11. [Training Scenarios](#training)

---

## Overview

### What Is This Framework?

The Deception Detection Framework is an intelligence analysis tool implementing the **MOM-POP-MOSES-EVE methodology** developed by Richards J. Heuer Jr. for the CIA. It helps analysts systematically assess whether information might be the product of adversary deception.

### When Should You Use It?

Use this framework when:
- Receiving intelligence from potentially compromised sources
- Adversary has motive and means to deceive
- Information appears "too good to be true"
- Strategic decisions depend on intelligence accuracy
- Assessing hostile intentions based on observable actions

**Do NOT use for**:
- Routine information verification (use standard validation)
- Situations where deception is clearly impossible
- When you already have definitive proof

### Key Capabilities

✅ **11-Criterion Scoring System** (0-5 scales)
✅ **Weighted Calculation** → 0-100% deception likelihood
✅ **5 Risk Levels**: Critical, High, Medium, Low, Minimal
✅ **AI Integration**: GPT-4o-mini powered analysis
✅ **Visual Dashboards**: Real-time gauges and charts
✅ **Professional Reports**: PDF, DOCX with classification markings
✅ **Predictive Analysis**: Future risk trends and indicators to watch

---

## Quick Start

### Creating Your First Analysis

1. **Navigate to Framework**
   - Dashboard → Analysis Frameworks → Deception Detection (SATS)

2. **Click "New Analysis"**

3. **Fill Basic Information**
   - Title: Brief identifier (e.g., "Source X Intel Assessment")
   - Description: 1-2 sentence overview

4. **Complete Analysis Tabs**:

   **Tab 1: Scenario**
   - Describe the information/situation being analyzed
   - Include source, context, and specific claims

   **Tab 2: MOM (Motive, Opportunity, Means)**
   - Why would adversary deceive?
   - Can they control information channels?
   - Do they have deception capabilities?

   **Tab 3: POP (Patterns of Practice)**
   - Historical deception by this adversary?
   - Sophistication level of past deceptions?
   - Success rate of their deceptions?

   **Tab 4: MOSES (My Own Sources)**
   - Could our sources be compromised?
   - Evidence of source manipulation?

   **Tab 5: EVE (Evaluation of Evidence)**
   - Is information internally consistent?
   - Is it externally corroborated?
   - Are there anomalies?

   **Tab 6: Assessment**
   - Overall conclusion and recommendations

5. **Score Each Criterion** (see Scoring Guidelines below)

6. **Optional: Run AI Analysis** for automated scoring

7. **Save Analysis**

---

## Methodology: MOM-POP-MOSES-EVE

### MOM: Motive, Opportunity, Means (Weight: 30%)

**Purpose**: Assess adversary's capability and incentive to deceive

**Motive** (0-5):
- 0 = No conceivable motive to deceive
- 1-2 = Weak/circumstantial motive
- 3 = Moderate motive (some benefit from deception)
- 4 = Strong motive (significant strategic benefit)
- 5 = Critical motive (survival/strategic imperative)

**Opportunity** (0-5):
- 0 = No control over information channels
- 1-2 = Limited control
- 3 = Moderate control (some channels)
- 4 = Extensive control (most channels)
- 5 = Complete monopoly on information

**Means** (0-5):
- 0 = No deception capabilities
- 1-2 = Basic deception capabilities
- 3 = Professional capabilities
- 4 = Advanced/sophisticated capabilities
- 5 = World-class deception apparatus

### POP: Patterns of Practice (Weight: 25%)

**Purpose**: Examine adversary's historical deception behavior

**Historical Pattern** (0-5):
- 0 = No history of deception
- 1-2 = Rare/isolated deception instances
- 3 = Occasional deception
- 4 = Frequent deception
- 5 = Deception as standard doctrine

**Sophistication Level** (0-5):
- 0 = No demonstrated sophistication
- 1-2 = Basic/crude deceptions
- 3 = Moderately sophisticated
- 4 = Highly sophisticated (multi-layered)
- 5 = State-of-the-art (world-class)

**Success Rate** (0-5):
- 0 = Past deceptions always failed
- 1-2 = Low success rate
- 3 = Moderate success
- 4 = High success rate
- 5 = Nearly perfect success record

### MOSES: My Own Sources (Weight: 25%)

**Purpose**: Evaluate vulnerability of OUR sources to manipulation

**Source Vulnerability** (0-5):
- 0 = Source cannot be compromised
- 1-2 = Low vulnerability (multiple independent sources)
- 3 = Moderate vulnerability
- 4 = High vulnerability (single source, adversary access)
- 5 = Extreme vulnerability (adversary-controlled source)

**Manipulation Evidence** (0-5):
- 0 = No evidence of manipulation
- 1-2 = Weak/circumstantial indicators
- 3 = Moderate evidence
- 4 = Strong evidence of manipulation
- 5 = Definitive proof of manipulation

### EVE: Evaluation of Evidence (Weight: 20%)

**Purpose**: Assess quality and coherence of evidence

⚠️ **NOTE**: These scores are INVERTED - Low scores indicate HIGH deception risk

**Internal Consistency** (0-5): **INVERTED**
- 5 = Perfect internal consistency (low deception risk)
- 4 = High consistency
- 3 = Moderate consistency
- 2 = Some inconsistencies (moderate deception risk)
- 1-0 = Major inconsistencies (high deception risk)

**External Corroboration** (0-5): **INVERTED**
- 5 = Extensive independent corroboration (low deception risk)
- 4 = Strong corroboration
- 3 = Moderate corroboration
- 2 = Weak corroboration (moderate deception risk)
- 1-0 = No corroboration (high deception risk)

**Anomaly Detection** (0-5): **NOT INVERTED**
- 0 = No anomalies detected
- 1-2 = Minor anomalies
- 3 = Moderate anomalies
- 4 = Significant anomalies
- 5 = Extreme anomalies (very suspicious)

---

## Step-by-Step Workflow

### Phase 1: Information Gathering (Before Using Tool)

1. **Collect all available information**
   - Source intelligence
   - Contextual information
   - Historical data
   - Corroborating/contradicting evidence

2. **Identify what needs assessment**
   - What specific claim or information?
   - Who is the source?
   - What decisions depend on this?

### Phase 2: Analysis (Using the Tool)

3. **Scenario Description**
   - Write neutral description of situation
   - Include: What, Who, When, Where, Why (if known)
   - Describe source and access

4. **MOM Analysis**
   ```
   MOTIVE:
   - What does adversary gain from deception?
   - What do they lose if truth is known?
   - Strategic vs. tactical benefits?

   OPPORTUNITY:
   - What channels do they control?
   - Can we independently verify?
   - Information monopoly vs. competitive sources?

   MEANS:
   - What deception capabilities exist?
   - Resources allocated to deception?
   - Technical sophistication?
   ```

5. **POP Analysis**
   ```
   HISTORICAL PATTERN:
   - Past deception by this actor?
   - Frequency and consistency?
   - Doctrine/culture of deception?

   SOPHISTICATION:
   - Complexity of past deceptions?
   - Multi-layered or simple?
   - Professional organizations involved?

   SUCCESS RATE:
   - How often have they succeeded?
   - Did we detect past deceptions?
   - Lessons learned from failures?
   ```

6. **MOSES Analysis**
   ```
   SOURCE VULNERABILITY:
   - How many independent sources?
   - Adversary access to sources?
   - Source motivations/biases?

   MANIPULATION EVIDENCE:
   - Too convenient/perfect information?
   - Timing suspicious?
   - Source behavior changes?
   ```

7. **EVE Analysis**
   ```
   INTERNAL CONSISTENCY:
   - Does information hang together logically?
   - Any contradictions?
   - Timeline makes sense?

   EXTERNAL CORROBORATION:
   - Independent confirmation?
   - Multiple source types?
   - Third-party validation?

   ANOMALIES:
   - What seems odd or unusual?
   - Too good to be true?
   - Pattern breaks?
   ```

8. **Scoring**
   - Score each criterion 0-5
   - Use slider tooltips for guidance
   - Remember EVE inversions!

9. **Review Dashboard**
   - Check deception likelihood percentage
   - Review category breakdowns
   - Examine risk factor matrix

### Phase 3: Decision Support

10. **AI Analysis** (Optional)
    - Click "AI Analysis" for automated assessment
    - Review key indicators and recommendations
    - Compare with your manual analysis

11. **Predictions**
    - Review future risk trends
    - Note indicators to watch
    - Identify collection priorities

12. **Generate Report**
    - Export → Select format (PDF/DOCX/Briefing)
    - Set classification level
    - Customize organization/analyst name

---

## Scoring Guidelines

### General Principles

1. **Be Conservative**: When in doubt, score toward the middle (2-3)
2. **Use Evidence**: Base scores on specific evidence, not hunches
3. **Document Reasoning**: Write detailed MOM-POP-MOSES-EVE text explaining scores
4. **Seek Independence**: Try to score without bias from desired outcome
5. **Iterate**: First draft scores often improve with reflection

### Common Scoring Patterns

**High Deception Risk (70-100%)**:
- MOM scores: 4-5 (strong motive, opportunity, means)
- POP scores: 4-5 (proven deception track record)
- MOSES scores: 4-5 (vulnerable sources, manipulation evidence)
- EVE scores: 0-2 (low consistency, weak corroboration, anomalies)

**Medium Deception Risk (40-69%)**:
- MOM scores: 2-4 (moderate capability/incentive)
- POP scores: 2-4 (some deception history)
- MOSES scores: 2-4 (moderate source vulnerability)
- EVE scores: 2-3 (some issues but not severe)

**Low Deception Risk (0-39%)**:
- MOM scores: 0-2 (weak deception incentive/capability)
- POP scores: 0-2 (no deception track record)
- MOSES scores: 0-2 (robust sources)
- EVE scores: 4-5 (strong consistency and corroboration)

### Red Flags Requiring Higher Scores

🚩 **Motive**:
- Survival/existential threat
- Major strategic advantage
- Precedent of deception for similar situations

🚩 **Opportunity**:
- Information monopoly
- Control of all verification channels
- No independent access

🚩 **Means**:
- Dedicated deception organizations
- Successful past deceptions
- Multi-domain capabilities

🚩 **Source Vulnerability**:
- Single source with no corroboration
- Adversary access to source
- Source has bias/motivation

🚩 **Anomalies**:
- "Too perfect" information
- Timing too convenient
- Confirms exactly what adversary wants us to believe

---

## AI-Assisted Analysis

### When to Use AI Analysis

✅ **Good Use Cases**:
- Initial assessment of complex scenarios
- Validation of manual analysis
- Training/learning the methodology
- Identifying indicators you might have missed

❌ **Poor Use Cases**:
- Replacing human judgment entirely
- When scenario lacks detail (AI needs context)
- Classified information (AI is cloud-based)
- Final decision-making without human review

### How AI Analysis Works

1. **Scenario Processing**
   - AI reads your MOM-POP-MOSES-EVE text
   - Analyzes for deception indicators
   - Applies SATS methodology

2. **Automated Scoring**
   - Generates 0-5 scores for all 11 criteria
   - Applies conservative scoring principles
   - Explains reasoning for each score

3. **Executive Summary**
   - Bottom Line Up Front (BLUF)
   - Key indicators (3-5 pointing to deception)
   - Counter-indicators (evidence against deception)
   - Recommendations (3-4 actionable steps)

### Interpreting AI Results

**AI Strengths**:
- Pattern recognition across similar scenarios
- Consistent application of methodology
- Comprehensive indicator identification
- Unbiased by human cognitive biases

**AI Limitations**:
- Cannot access classified information
- Lacks real-world intelligence context
- May miss subtle cultural/political nuances
- Cannot interview sources or request additional collection

**Best Practice**: Use AI as a **second opinion**, not the final word. Compare AI analysis with your own assessment and investigate any significant differences.

---

## Report Generation

### Report Types

**1. Full Intelligence Report (PDF)**
- Multi-page comprehensive analysis
- All MOM-POP-MOSES-EVE sections
- Scoring matrix
- AI analysis results
- Classification headers/footers
- **Best for**: Complete analysis requiring documentation

**2. Executive Briefing (PDF)**
- 1-page summary
- BLUF (Bottom Line Up Front)
- Top 3 key findings
- Top 3 recommendations
- **Best for**: Commander/executive decision-makers

**3. Editable Report (DOCX)**
- Microsoft Word format
- All content from full report
- Editable for collaboration/review
- **Best for**: Draft reports requiring review

### Classification Levels

- **UNCLASSIFIED**: Training, examples, unclassified scenarios
- **CONFIDENTIAL**: Limited distribution required
- **SECRET**: Serious damage if disclosed
- **TOP SECRET**: Exceptionally grave damage if disclosed

⚠️ **IMPORTANT**: Classification markings are for formatting only. YOU are responsible for ensuring content is appropriately classified and handled according to your organization's security procedures.

### Report Customization

- **Organization Name**: Your unit/agency
- **Analyst Name**: Your name or "AI-Assisted Analysis"
- **Distribution Statement**: Control report sharing

---

## Predictions & Trends

### Future Risk Assessment

The system generates predictive analysis showing:

**Trend Direction**:
- **INCREASING**: Deception risk is growing
- **STABLE**: Risk level unchanged
- **DECREASING**: Risk is declining

**Confidence Interval**: Range of likely deception percentages (e.g., 60-80%)

**Key Drivers**: Top factors influencing the assessment

### Scenario Forecasts

"What if" analysis for different conditions:

```
IF: Additional corroborating evidence emerges
THEN: Deception likelihood increases 15-25%
LIKELIHOOD: 40% this occurs
```

### Indicators to Watch

Monitor these factors for changes in assessment:
- Source behavior changes
- New corroborating/contradicting evidence
- Adversary pattern shifts
- Access to new collection capabilities

**Action**: Set up monitoring for these indicators and re-run analysis if they change.

---

## Best Practices

### 1. Structured Analysis

✅ **DO**:
- Complete all MOM-POP-MOSES-EVE sections thoroughly
- Document specific evidence for each score
- Consider alternative explanations
- Seek disconfirming evidence

❌ **DON'T**:
- Rush to conclusions without completing analysis
- Let policy preferences bias scoring
- Ignore contradictory evidence
- Rely solely on AI analysis

### 2. Source Evaluation

✅ **DO**:
- Assess each source independently
- Consider source motivations and access
- Seek multiple independent sources
- Evaluate source track record

❌ **DON'T**:
- Assume all sources equally reliable
- Ignore source vulnerabilities
- Accept single-source reporting without skepticism
- Overlook adversary access to sources

### 3. Cognitive Bias Mitigation

**Common Biases**:

**Confirmation Bias**: Seeking evidence that confirms hypothesis
- **Mitigation**: Actively seek disconfirming evidence

**Mirror Imaging**: Assuming adversary thinks like you
- **Mitigation**: Study adversary culture, doctrine, history

**Anchoring**: Over-relying on first information received
- **Mitigation**: Re-evaluate with fresh eyes periodically

**Groupthink**: Conforming to team consensus
- **Mitigation**: Assign "devil's advocate" role

### 4. Collaboration

✅ **DO**:
- Share analysis with colleagues for review
- Seek subject matter expert input
- Document assumptions and gaps
- Update analysis with new information

❌ **DON'T**:
- Work in isolation on critical assessments
- Dismiss alternative viewpoints
- Treat analysis as final once completed
- Ignore gaps in knowledge

### 5. Continuous Learning

- Review past analyses when ground truth emerges
- Study historical deception cases
- Practice with training scenarios
- Share lessons learned

---

## Common Pitfalls

### Pitfall 1: "Too Good to Be True" Ignored

**Problem**: Information perfectly confirms what we want/expect
**Indicator**: All sources align perfectly with no contradictions
**Fix**: High score for "anomaly detection" - perfect consistency can indicate deception

### Pitfall 2: Overconfidence in Single Source

**Problem**: Making high-confidence assessment from single source
**Indicator**: No independent corroboration
**Fix**: High score for "source vulnerability" and low score for "external corroboration"

### Pitfall 3: Ignoring Base Rates

**Problem**: Not considering how often deception actually occurs
**Indicator**: Every scenario assessed as high deception likelihood
**Fix**: Most intelligence is NOT deception - be conservative

### Pitfall 4: Confirmation Bias

**Problem**: Only seeking evidence supporting pre-existing belief
**Indicator**: Analysis conclusion formed before completing methodology
**Fix**: Complete MOM-POP-MOSES-EVE before forming judgment

### Pitfall 5: Mirror Imaging

**Problem**: Assuming adversary would deceive for reasons WE would
**Indicator**: "They must be lying because we would in their position"
**Fix**: Study adversary doctrine, culture, historical patterns (POP analysis)

### Pitfall 6: Falling for "Analyst's Fallacy"

**Problem**: Believing all deceptions should be detectable
**Indicator**: "If it were deception, we would have noticed"
**Fix**: Successful deceptions, by definition, are not easily detected

### Pitfall 7: Ignoring EVE Inversions

**Problem**: Scoring EVE criteria without remembering they're inverted
**Indicator**: Low consistency scored as "1" instead of "1" meaning HIGH deception risk
**Fix**: Remember: EVE low scores = high deception risk

---

## Training Scenarios

### Included Training Scenarios

The system includes historical case studies:

1. **Operation Fortitude (D-Day Deception)** - Example of successful strategic deception
2. **Cuban Missile Crisis** - Example when NOT to assess deception
3. **Iraqi WMDs 2003** - Example of intelligence self-deception
4. **Military Exercise Scenario** - Training scenario for practice

### Using Training Scenarios

1. **Navigate to**: Analysis → Load Example
2. **Select scenario**
3. **Review scenario text (DON'T look at scores yet)**
4. **Complete your own analysis**
5. **Compare your scores with expected scores**
6. **Review learning points**

### Learning from Scenarios

After completing analysis:
- Compare your likelihood % with expected %
- Check score differences (>2 points needs review)
- Read "Learning Points" section
- Understand WHY scores differ
- Practice again on same scenario after 1 week

### Accuracy Targets

- **Excellent**: ≤15% likelihood delta, ≤1.5 avg score delta
- **Good**: ≤25% likelihood delta, ≤2.0 avg score delta
- **Needs Improvement**: >25% likelihood delta or >2.0 avg score delta

---

## FAQs

**Q: How long should an analysis take?**
A: Initial: 30-60 minutes. Complex scenarios: 2-4 hours. Don't rush - this is decision-quality intelligence.

**Q: Can I change scores after saving?**
A: Yes, click Edit. Intelligence analysis is iterative - update as new information arrives.

**Q: Should I use AI analysis for classified information?**
A: NO. AI is cloud-based. Use only for unclassified training/examples.

**Q: What if I score everything as "3" (middle)?**
A: You'll get ~50% deception likelihood. This is appropriate when truly uncertain, but you should have specific reasoning for each score.

**Q: Do I need to complete all MOM-POP-MOSES-EVE sections?**
A: Scenario is required. Others strongly recommended for quality analysis. More detail = better AI analysis.

**Q: How often should I re-assess?**
A: Whenever: 1) New evidence arrives, 2) Indicators to Watch change, 3) Major events occur, 4) Before major decisions

---

## Support & Feedback

**Training**: Review this guide and practice with included scenarios

**Questions**: Consult with your organization's intelligence training section

**Technical Issues**: Report at https://github.com/anthropics/claude-code/issues

**Methodology Questions**: Refer to Richards J. Heuer Jr.'s *Psychology of Intelligence Analysis* (CIA, 1999)

---

## References

1. **Heuer, Richards J. Jr.** *Psychology of Intelligence Analysis*. CIA Center for the Study of Intelligence, 1999.
2. **Heuer, Richards J. Jr. and Pherson, Randolph H.** *Structured Analytic Techniques for Intelligence Analysis*. CQ Press, 2010.
3. **CIA Center for the Study of Intelligence.** *Deception Maxims: Fact and Folklore*. Studies in Intelligence, 1981.
4. **Whaley, Barton.** *Stratagem: Deception and Surprise in War*. MIT Center for International Studies, 1969.

---

**Version**: 1.0
**Last Updated**: October 2025
**Classification**: UNCLASSIFIED

*This guide is for training and educational purposes. Apply methodology according to your organization's intelligence procedures and security requirements.*
