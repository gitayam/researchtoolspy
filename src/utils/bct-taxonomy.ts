/**
 * Behaviour Change Technique Taxonomy v1 (BCTTv1)
 *
 * Source: Michie, S., Richardson, M., Johnston, M., et al. (2013).
 * The Behavior Change Technique Taxonomy (v1) of 93 hierarchically clustered techniques:
 * building an international consensus for the reporting of behavior change interventions.
 * Annals of Behavioral Medicine 46(1):81-95.
 *
 * Official taxonomy: https://www.ucl.ac.uk/health-psychology/BCTtaxonomy/
 *
 * Used in BCW Step 7 — see Michie, Atkins, West (2014) Table 3.3 for the
 * function-to-BCT mapping that BCT_BY_FUNCTION encodes.
 *
 * Cited in: docs/frameworks/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md (P1-2);
 * irregularpedia.org/general/behavior-analysis/ (Behaviour Change Techniques section).
 */

export interface BCT {
  id: string;
  group: number;
  label: string;
  definition: string;
  example?: string;
}

export interface BCTGrouping {
  number: number;
  name: string;
}

export type InterventionFunction =
  | 'education'
  | 'persuasion'
  | 'incentivisation'
  | 'coercion'
  | 'training'
  | 'restriction'
  | 'environmental_restructuring'
  | 'modelling'
  | 'enablement';

// Data
export const BCT_GROUPINGS: BCTGrouping[] = [
  { number: 1, name: 'Goals and planning' },
  { number: 2, name: 'Feedback and monitoring' },
  { number: 3, name: 'Social support' },
  { number: 4, name: 'Shaping knowledge' },
  { number: 5, name: 'Natural consequences' },
  { number: 6, name: 'Comparison of behaviour' },
  { number: 7, name: 'Associations' },
  { number: 8, name: 'Repetition and substitution' },
  { number: 9, name: 'Comparison of outcomes' },
  { number: 10, name: 'Reward and threat' },
  { number: 11, name: 'Regulation' },
  { number: 12, name: 'Antecedents' },
  { number: 13, name: 'Identity' },
  { number: 14, name: 'Scheduled consequences' },
  { number: 15, name: 'Self-belief' },
  { number: 16, name: 'Covert learning' },
];

export const BCT_TAXONOMY: BCT[] = [
  { id: '1.1', group: 1, label: 'Goal setting (behaviour)', definition: '' },
  { id: '1.2', group: 1, label: 'Problem solving', definition: '' },
  { id: '1.3', group: 1, label: 'Goal setting (outcome)', definition: '' },
  { id: '1.4', group: 1, label: 'Action planning', definition: '' },
  { id: '1.5', group: 1, label: 'Review behaviour goal(s)', definition: '' },
  { id: '1.6', group: 1, label: 'Discrepancy between current behaviour and goal', definition: '' },
  { id: '1.7', group: 1, label: 'Review outcome goal(s)', definition: '' },
  { id: '1.8', group: 1, label: 'Behavioural contract', definition: '' },
  { id: '1.9', group: 1, label: 'Commitment', definition: '' },

  { id: '2.1', group: 2, label: 'Monitoring of behaviour by others without feedback', definition: '' },
  { id: '2.2', group: 2, label: 'Feedback on behaviour', definition: '' },
  { id: '2.3', group: 2, label: 'Self-monitoring of behaviour', definition: '' },
  { id: '2.4', group: 2, label: 'Self-monitoring of outcome(s) of behaviour', definition: '' },
  { id: '2.5', group: 2, label: 'Monitoring of outcome(s) of behaviour without feedback', definition: '' },
  { id: '2.6', group: 2, label: 'Biofeedback', definition: '' },
  { id: '2.7', group: 2, label: 'Feedback on outcome(s) of behaviour', definition: '' },

  { id: '3.1', group: 3, label: 'Social support (unspecified)', definition: '' },
  { id: '3.2', group: 3, label: 'Social support (practical)', definition: '' },
  { id: '3.3', group: 3, label: 'Social support (emotional)', definition: '' },

  { id: '4.1', group: 4, label: 'Instruction on how to perform the behaviour', definition: '' },
  { id: '4.2', group: 4, label: 'Information about Antecedents', definition: '' },
  { id: '4.3', group: 4, label: 'Re-attribution', definition: '' },
  { id: '4.4', group: 4, label: 'Behavioural experiments', definition: '' },

  { id: '5.1', group: 5, label: 'Information about health consequences', definition: '' },
  { id: '5.2', group: 5, label: 'Salience of consequences', definition: '' },
  { id: '5.3', group: 5, label: 'Information about social and environmental consequences', definition: '' },
  { id: '5.4', group: 5, label: 'Monitoring of emotional consequences', definition: '' },
  { id: '5.5', group: 5, label: 'Anticipated regret', definition: '' },
  { id: '5.6', group: 5, label: 'Information about emotional consequences', definition: '' },

  { id: '6.1', group: 6, label: 'Demonstration of the behaviour', definition: '' },
  { id: '6.2', group: 6, label: 'Social comparison', definition: '' },
  { id: '6.3', group: 6, label: 'Information about others\' approval', definition: '' },

  { id: '7.1', group: 7, label: 'Prompts/cues', definition: '' },
  { id: '7.2', group: 7, label: 'Cue signalling reward', definition: '' },
  { id: '7.3', group: 7, label: 'Reduce prompts/cues', definition: '' },
  { id: '7.4', group: 7, label: 'Remove access to the reward', definition: '' },
  { id: '7.5', group: 7, label: 'Remove aversive stimulus', definition: '' },
  { id: '7.6', group: 7, label: 'Satiation', definition: '' },
  { id: '7.7', group: 7, label: 'Exposure', definition: '' },
  { id: '7.8', group: 7, label: 'Associative learning', definition: '' },

  { id: '8.1', group: 8, label: 'Behavioural practice/rehearsal', definition: '' },
  { id: '8.2', group: 8, label: 'Behaviour substitution', definition: '' },
  { id: '8.3', group: 8, label: 'Habit formation', definition: '' },
  { id: '8.4', group: 8, label: 'Habit reversal', definition: '' },
  { id: '8.5', group: 8, label: 'Overcorrection', definition: '' },
  { id: '8.6', group: 8, label: 'Generalisation of target behaviour', definition: '' },
  { id: '8.7', group: 8, label: 'Graded tasks', definition: '' },

  { id: '9.1', group: 9, label: 'Credible source', definition: '' },
  { id: '9.2', group: 9, label: 'Pros and cons', definition: '' },
  { id: '9.3', group: 9, label: 'Comparative imagining of future outcomes', definition: '' },

  { id: '10.1', group: 10, label: 'Material incentive (behaviour)', definition: '' },
  { id: '10.2', group: 10, label: 'Material reward (behaviour)', definition: '' },
  { id: '10.3', group: 10, label: 'Non-specific reward', definition: '' },
  { id: '10.4', group: 10, label: 'Social reward', definition: '' },
  { id: '10.5', group: 10, label: 'Social incentive', definition: '' },
  { id: '10.6', group: 10, label: 'Non-specific incentive', definition: '' },
  { id: '10.7', group: 10, label: 'Self-incentive', definition: '' },
  { id: '10.8', group: 10, label: 'Incentive (outcome)', definition: '' },
  { id: '10.9', group: 10, label: 'Self-reward', definition: '' },
  { id: '10.10', group: 10, label: 'Reward (outcome)', definition: '' },
  { id: '10.11', group: 10, label: 'Future punishment', definition: '' },

  { id: '11.1', group: 11, label: 'Pharmacological support', definition: '' },
  { id: '11.2', group: 11, label: 'Reduce negative emotions', definition: '' },
  { id: '11.3', group: 11, label: 'Conserving mental resources', definition: '' },
  { id: '11.4', group: 11, label: 'Paradoxical instructions', definition: '' },

  { id: '12.1', group: 12, label: 'Restructuring the physical environment', definition: '' },
  { id: '12.2', group: 12, label: 'Restructuring the social environment', definition: '' },
  { id: '12.3', group: 12, label: 'Avoidance/reducing exposure to cues for the behaviour', definition: '' },
  { id: '12.4', group: 12, label: 'Distraction', definition: '' },
  { id: '12.5', group: 12, label: 'Adding objects to the environment', definition: '' },
  { id: '12.6', group: 12, label: 'Body changes', definition: '' },

  { id: '13.1', group: 13, label: 'Identification of self as role model', definition: '' },
  { id: '13.2', group: 13, label: 'Framing/reframing', definition: '' },
  { id: '13.3', group: 13, label: 'Incompatible beliefs', definition: '' },
  { id: '13.4', group: 13, label: 'Valued self-identity', definition: '' },
  { id: '13.5', group: 13, label: 'Identity associated with changed behaviour', definition: '' },

  { id: '14.1', group: 14, label: 'Behaviour cost', definition: '' },
  { id: '14.2', group: 14, label: 'Punishment', definition: '' },
  { id: '14.3', group: 14, label: 'Remove reward', definition: '' },
  { id: '14.4', group: 14, label: 'Reward approximation', definition: '' },
  { id: '14.5', group: 14, label: 'Rewarding completion', definition: '' },
  { id: '14.6', group: 14, label: 'Situation-specific reward', definition: '' },
  { id: '14.7', group: 14, label: 'Reward incompatible behaviour', definition: '' },
  { id: '14.8', group: 14, label: 'Reward alternative behaviour', definition: '' },
  { id: '14.9', group: 14, label: 'Reduce reward frequency', definition: '' },
  { id: '14.10', group: 14, label: 'Remove punishment', definition: '' },

  { id: '15.1', group: 15, label: 'Verbal persuasion about capability', definition: '' },
  { id: '15.2', group: 15, label: 'Mental rehearsal of successful performance', definition: '' },
  { id: '15.3', group: 15, label: 'Focus on past success', definition: '' },
  { id: '15.4', group: 15, label: 'Self-talk', definition: '' },

  { id: '16.1', group: 16, label: 'Imaginary punishment', definition: '' },
  { id: '16.2', group: 16, label: 'Imaginary reward', definition: '' },
  { id: '16.3', group: 16, label: 'Vicarious consequences', definition: '' },
];

export const BCT_BY_FUNCTION: Record<InterventionFunction, { mostFrequent: string[]; lessFrequent: string[] }> = {
  education: {
    mostFrequent: ['5.3', '5.1', '2.2', '2.7', '7.1', '2.3'],
    lessFrequent: ['2.6', '2.4', '7.2', '7.6', '4.2', '4.3', '4.4', '5.6', '6.3'],
  },
  persuasion: {
    mostFrequent: ['9.1', '5.3', '5.1', '2.2', '2.7'],
    lessFrequent: ['2.6', '4.3', '15.3', '15.1', '13.2', '13.5', '13.1', '5.6', '5.2', '6.3', '6.2'],
  },
  incentivisation: {
    mostFrequent: ['2.2', '2.7', '2.1', '2.5', '2.3'],
    lessFrequent: [
      '11.4', '2.6', '2.4', '7.2', '7.5', '14.4', '14.5', '14.6', '14.7', '14.9', '14.8', '14.3', '10.4', '10.2',
      '10.10', '10.9', '10.3', '10.6', '10.8', '1.8', '1.9', '1.6', '16.2',
    ],
  },
  coercion: {
    mostFrequent: ['2.2', '2.7', '2.1', '2.5', '2.3'],
    lessFrequent: ['2.6', '2.4', '7.4', '14.2', '14.1', '14.3', '10.11', '1.8', '1.9', '1.6', '13.3', '5.5', '16.1'],
  },
  training: {
    mostFrequent: ['6.1', '4.1', '2.2', '2.7', '2.3', '8.1'],
    lessFrequent: ['2.6', '2.4', '8.3', '8.4', '8.7', '4.4', '15.2', '15.4', '10.9'],
  },
  restriction: {
    mostFrequent: [],
    lessFrequent: [],
  },
  environmental_restructuring: {
    mostFrequent: ['12.5', '7.1', '12.1'],
    lessFrequent: ['7.2', '7.4', '7.5', '7.6', '7.7', '7.8', '7.3', '12.2'],
  },
  modelling: {
    mostFrequent: ['6.1'],
    lessFrequent: [],
  },
  enablement: {
    mostFrequent: ['3.1', '3.2', '1.1', '1.3', '12.5', '1.2', '1.4', '2.3', '12.1', '1.5', '1.7'],
    lessFrequent: [],
  },
};

// Helpers
export function getBCTById(id: string): BCT | undefined {
  return BCT_TAXONOMY.find((bct) => bct.id === id);
}

export function getBCTsForFunction(fn: InterventionFunction): BCT[] {
  const ids = [...BCT_BY_FUNCTION[fn].mostFrequent, ...BCT_BY_FUNCTION[fn].lessFrequent];
  return BCT_TAXONOMY.filter((bct) => ids.includes(bct.id));
}

export function getBCTsByGroup(groupNumber: number): BCT[] {
  return BCT_TAXONOMY.filter((bct) => bct.group === groupNumber);
}
