export interface FrameworkSection {
  key: string
  label: string
  description: string
  color: string
  bgColor: string
  icon: string
  hasDeficitAssessment?: boolean  // For COM-B components in behavior analysis
  comBComponent?: 'physical_capability' | 'psychological_capability' | 'physical_opportunity' | 'social_opportunity' | 'reflective_motivation' | 'automatic_motivation'
}

export interface FrameworkConfig {
  type: string
  title: string
  description: string
  sections: FrameworkSection[]
  itemType?: 'text' | 'qa'  // 'text' for regular items, 'qa' for question-answer pairs
}

export const frameworkConfigs: Record<string, FrameworkConfig> = {
  'pest': {
    type: 'pest',
    title: 'PEST Analysis',
    description: 'Political, Economic, Social, Technological',
    sections: [
      {
        key: 'political',
        label: 'Political',
        description: 'Political factors affecting the organization',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '🏛️'
      },
      {
        key: 'economic',
        label: 'Economic',
        description: 'Economic factors and trends',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '💰'
      },
      {
        key: 'social',
        label: 'Social',
        description: 'Social and cultural factors',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '👥'
      },
      {
        key: 'technological',
        label: 'Technological',
        description: 'Technological innovations and trends',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '🔬'
      }
    ]
  },

  'pmesii-pt': {
    type: 'pmesii-pt',
    title: 'PMESII-PT Analysis',
    description: 'Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time',
    itemType: 'qa',
    sections: [
      {
        key: 'political',
        label: 'Political',
        description: 'Political structures and governance',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '🏛️'
      },
      {
        key: 'military',
        label: 'Military',
        description: 'Military capabilities and posture',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '🎖️'
      },
      {
        key: 'economic',
        label: 'Economic',
        description: 'Economic systems and resources',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '💰'
      },
      {
        key: 'social',
        label: 'Social',
        description: 'Social structures and demographics',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '👥'
      },
      {
        key: 'information',
        label: 'Information',
        description: 'Information systems and flow',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: '📡'
      },
      {
        key: 'infrastructure',
        label: 'Infrastructure',
        description: 'Physical and organizational infrastructure',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '🏗️'
      },
      {
        key: 'physical',
        label: 'Physical Environment',
        description: 'Geography, terrain, and climate',
        color: 'border-teal-500',
        bgColor: 'bg-teal-50 dark:bg-teal-900/20',
        icon: '🌍'
      },
      {
        key: 'time',
        label: 'Time',
        description: 'Temporal factors and timing',
        color: 'border-indigo-500',
        bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
        icon: '⏰'
      }
    ]
  },

  'dotmlpf': {
    type: 'dotmlpf',
    title: 'DOTMLPF Analysis',
    description: 'Doctrine, Organization, Training, Material, Leadership, Personnel, Facilities',
    sections: [
      {
        key: 'doctrine',
        label: 'Doctrine',
        description: 'Fundamental principles and tactics',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '📖'
      },
      {
        key: 'organization',
        label: 'Organization',
        description: 'Organizational structure and design',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '🏢'
      },
      {
        key: 'training',
        label: 'Training',
        description: 'Training programs and readiness',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '🎓'
      },
      {
        key: 'material',
        label: 'Material',
        description: 'Equipment and technology',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '⚙️'
      },
      {
        key: 'leadership',
        label: 'Leadership',
        description: 'Leadership capabilities and development',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '👔'
      },
      {
        key: 'personnel',
        label: 'Personnel',
        description: 'Personnel management and resources',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '👥'
      },
      {
        key: 'facilities',
        label: 'Facilities',
        description: 'Physical facilities and installations',
        color: 'border-pink-500',
        bgColor: 'bg-pink-50 dark:bg-pink-900/20',
        icon: '🏗️'
      }
    ]
  },

  'dime': {
    type: 'dime',
    title: 'DIME Framework',
    description: 'Diplomatic, Information, Military, Economic',
    itemType: 'qa',
    sections: [
      {
        key: 'diplomatic',
        label: 'Diplomatic',
        description: 'Diplomatic relationships and negotiations',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '🤝'
      },
      {
        key: 'information',
        label: 'Information',
        description: 'Information operations and intelligence',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: '📡'
      },
      {
        key: 'military',
        label: 'Military',
        description: 'Military capabilities and operations',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '🎖️'
      },
      {
        key: 'economic',
        label: 'Economic',
        description: 'Economic power and sanctions',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '💰'
      }
    ]
  },

  'cog': {
    type: 'cog',
    title: 'Center of Gravity Analysis',
    description: 'Critical capabilities, requirements, and vulnerabilities',
    itemType: 'qa',
    sections: [
      {
        key: 'center_of_gravity',
        label: 'Center of Gravity',
        description: 'Source of power that provides strength',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '🎯'
      },
      {
        key: 'critical_capabilities',
        label: 'Critical Capabilities',
        description: 'Primary abilities of the center of gravity',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '⚡'
      },
      {
        key: 'critical_requirements',
        label: 'Critical Requirements',
        description: 'Essential conditions and resources needed',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '📋'
      },
      {
        key: 'critical_vulnerabilities',
        label: 'Critical Vulnerabilities',
        description: 'Weaknesses that can be exploited',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '⚠️'
      }
    ]
  },

  'stakeholder': {
    type: 'stakeholder',
    title: 'Stakeholder Analysis',
    description: 'Power/Interest Matrix - Comprehensive stakeholder mapping and engagement planning',
    itemType: 'stakeholder' as 'text' | 'qa',
    sections: [
      {
        key: 'high_power_high_interest',
        label: 'Key Players',
        description: 'High Power, High Interest - Manage Closely: Engage actively, involve in decisions, build strong relationships',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '👑'
      },
      {
        key: 'high_power_low_interest',
        label: 'Keep Satisfied',
        description: 'High Power, Low Interest - Keep Satisfied: Regular updates, ensure concerns addressed, maintain goodwill',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '🤝'
      },
      {
        key: 'low_power_high_interest',
        label: 'Keep Informed',
        description: 'Low Power, High Interest - Keep Informed: Regular communication, leverage as advocates, consult on issues',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '📢'
      },
      {
        key: 'low_power_low_interest',
        label: 'Monitor',
        description: 'Low Power, Low Interest - Monitor: Minimal effort, periodic updates, watch for changes in status',
        color: 'border-gray-500',
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        icon: '👥'
      }
    ]
  },

  'deception': {
    type: 'deception',
    title: 'Deception Detection (SATS)',
    description: 'CIA Structured Analytic Techniques for detecting deception - based on Richards J. Heuer Jr. methodology',
    sections: [
      {
        key: 'scenario',
        label: 'Scenario',
        description: 'Describe the information or situation being analyzed for potential deception',
        color: 'border-gray-500',
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        icon: '📋'
      },
      {
        key: 'mom',
        label: 'MOM (Motive, Opportunity, Means)',
        description: 'Assess whether the adversary has motive, opportunity, and means to deceive',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '🎯'
      },
      {
        key: 'pop',
        label: 'POP (Patterns of Practice)',
        description: 'Examine historical deception patterns of this actor',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '📊'
      },
      {
        key: 'moses',
        label: 'MOSES (My Own Sources)',
        description: 'Evaluate vulnerability of your information sources to manipulation',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '🔍'
      },
      {
        key: 'eve',
        label: 'EVE (Evaluation of Evidence)',
        description: 'Assess internal consistency and corroboration of evidence',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '✓'
      },
      {
        key: 'assessment',
        label: 'Overall Assessment',
        description: 'Synthesize findings and determine deception likelihood',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '📝'
      }
    ]
  },

  'behavior': {
    type: 'behavior',
    title: 'Behavior Analysis (COM-B Model)',
    description: 'Based on COM-B Model (Capability, Opportunity, Motivation → Behavior) by Michie, van Stralen, & West, and TM 3-53.11',
    sections: [
      {
        key: 'basic_info',
        label: 'Basic Information',
        description: 'Define the target behavior and context being analyzed',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '📋'
      },
      {
        key: 'timeline',
        label: 'Behavior Timeline',
        description: 'Document when, where, and how long the behavior occurs (interactive timeline with forks)',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '📅'
      },
      // COM-B: CAPABILITY
      {
        key: 'physical_capability',
        label: 'Physical Capability',
        description: 'Physical skills, strength, stamina required to perform the behavior',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '💪',
        hasDeficitAssessment: true,
        comBComponent: 'physical_capability'
      },
      {
        key: 'psychological_capability',
        label: 'Psychological Capability',
        description: 'Knowledge, cognitive skills, mental capacity, comprehension needed',
        color: 'border-amber-500',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        icon: '🧠',
        hasDeficitAssessment: true,
        comBComponent: 'psychological_capability'
      },
      // COM-B: OPPORTUNITY
      {
        key: 'physical_opportunity',
        label: 'Physical Opportunity',
        description: 'Environmental factors: time, resources, locations, accessibility, infrastructure',
        color: 'border-teal-500',
        bgColor: 'bg-teal-50 dark:bg-teal-900/20',
        icon: '🌍',
        hasDeficitAssessment: true,
        comBComponent: 'physical_opportunity'
      },
      {
        key: 'social_opportunity',
        label: 'Social Opportunity',
        description: 'Cultural norms, social cues, peer influence, interpersonal factors',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: '👥',
        hasDeficitAssessment: true,
        comBComponent: 'social_opportunity'
      },
      // COM-B: MOTIVATION
      {
        key: 'reflective_motivation',
        label: 'Reflective Motivation',
        description: 'Beliefs, intentions, goals, identity, conscious decision-making processes',
        color: 'border-indigo-500',
        bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
        icon: '🎯',
        hasDeficitAssessment: true,
        comBComponent: 'reflective_motivation'
      },
      {
        key: 'automatic_motivation',
        label: 'Automatic Motivation',
        description: 'Emotions, impulses, habits, desires, affective reactions',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '⚡',
        hasDeficitAssessment: true,
        comBComponent: 'automatic_motivation'
      },
      // Additional Analysis
      {
        key: 'barriers',
        label: 'Barriers and Facilitators',
        description: 'What prevents or enables the behavior? Obstacles and supporting factors',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '⚠️'
      },
      {
        key: 'consequences',
        label: 'Consequences and Outcomes',
        description: 'Rewards, costs, positive/negative outcomes for performing the behavior',
        color: 'border-pink-500',
        bgColor: 'bg-pink-50 dark:bg-pink-900/20',
        icon: '⚖️'
      },
      {
        key: 'symbols',
        label: 'Symbols and Signals',
        description: 'Cultural symbols, gestures, codes, or signals associated with the behavior',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '🎭'
      },
      {
        key: 'intervention_strategies',
        label: 'Intervention Strategies',
        description: 'Evidence-based strategies to change behavior (based on Behaviour Change Wheel)',
        color: 'border-lime-500',
        bgColor: 'bg-lime-50 dark:bg-lime-900/20',
        icon: '📊'
      },
      {
        key: 'target_audiences',
        label: 'Target Audience Segmentation',
        description: 'Primary, secondary, enablers, opposers, beneficiaries of behavior change',
        color: 'border-violet-500',
        bgColor: 'bg-violet-50 dark:bg-violet-900/20',
        icon: '🎪'
      }
    ]
  },

  'starbursting': {
    type: 'starbursting',
    title: 'Starbursting',
    description: 'Question-based brainstorming technique',
    itemType: 'qa',
    sections: [
      {
        key: 'who',
        label: 'Who Questions',
        description: 'Questions about people and stakeholders',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '👤'
      },
      {
        key: 'what',
        label: 'What Questions',
        description: 'Questions about the subject matter',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '❓'
      },
      {
        key: 'when',
        label: 'When Questions',
        description: 'Questions about timing and schedule',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '⏰'
      },
      {
        key: 'where',
        label: 'Where Questions',
        description: 'Questions about location and place',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '📍'
      },
      {
        key: 'why',
        label: 'Why Questions',
        description: 'Questions about reasons and motivations',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '💡'
      },
      {
        key: 'how',
        label: 'How Questions',
        description: 'Questions about methods and processes',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: '⚙️'
      }
    ]
  },

  'causeway': {
    type: 'causeway',
    title: 'Causeway Analysis',
    description: 'Strategic threat and influence operations framework using PUTAR methodology',
    sections: [
      {
        key: 'scenario',
        label: 'Scenario Development',
        description: 'Define Issue, Location, and Threat being analyzed',
        color: 'border-gray-500',
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        icon: '📋'
      },
      {
        key: 'putars',
        label: 'PUTAR Identification',
        description: 'Problem, Undesired Actor, Target Audience, Remedy, Story',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '🎯'
      },
      {
        key: 'critical_capabilities',
        label: 'Critical Capabilities',
        description: 'Capabilities needed by actors to execute threats',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '⚡'
      },
      {
        key: 'critical_requirements',
        label: 'Critical Requirements',
        description: 'Requirements needed for each capability',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '📋'
      },
      {
        key: 'proximate_targets',
        label: 'Proximate Targets',
        description: 'Tangible targets that can be influenced or attacked',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '🎪'
      }
    ]
  },

  'surveillance': {
    type: 'surveillance',
    title: 'Surveillance Framework (ISR Collection Planning)',
    description: 'Intelligence, Surveillance, and Reconnaissance operations planning based on RAND Strategies-to-Tasks methodology',
    itemType: 'qa',
    sections: [
      {
        key: 'commanders_guidance',
        label: "Commander's Guidance",
        description: 'Top-level strategic objectives and operational priorities',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '⭐'
      },
      {
        key: 'intelligence_requirements',
        label: 'Intelligence Requirements',
        description: 'Priority Intelligence Requirements (PIRs) and Essential Elements of Information (EEIs)',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '🎯'
      },
      {
        key: 'collection_strategies',
        label: 'Collection Strategies',
        description: 'Methods, platforms, and approaches for information gathering',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '📡'
      },
      {
        key: 'surveillance_targets',
        label: 'Surveillance Targets',
        description: 'Entities, locations, or activities requiring persistent monitoring',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '👁️'
      },
      {
        key: 'reconnaissance_tasks',
        label: 'Reconnaissance Tasks',
        description: 'Specific information-gathering missions to answer intelligence questions',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '🔍'
      },
      {
        key: 'collection_assets',
        label: 'Collection Assets',
        description: 'Available sensors, platforms, and resources for ISR operations',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: '🛰️'
      },
      {
        key: 'processing_plan',
        label: 'Information Processing',
        description: 'Analysis, fusion, and integration procedures',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '⚙️'
      },
      {
        key: 'dissemination',
        label: 'Dissemination Plan',
        description: 'Intelligence sharing and distribution procedures',
        color: 'border-pink-500',
        bgColor: 'bg-pink-50 dark:bg-pink-900/20',
        icon: '📤'
      }
    ]
  },

  'fundamental-flow': {
    type: 'fundamental-flow',
    title: 'Fundamental Flow Analysis',
    description: 'Intelligence cycle and information flow analysis for process optimization',
    itemType: 'qa',
    sections: [
      {
        key: 'planning_direction',
        label: 'Planning & Direction',
        description: 'Requirements definition and collection priorities',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '📋'
      },
      {
        key: 'collection',
        label: 'Collection',
        description: 'Information gathering from various sources and methods',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '📡'
      },
      {
        key: 'processing',
        label: 'Processing',
        description: 'Converting raw data into usable formats and structures',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '⚙️'
      },
      {
        key: 'exploitation_production',
        label: 'Exploitation & Production',
        description: 'Analysis and intelligence product creation',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '🔬'
      },
      {
        key: 'dissemination',
        label: 'Dissemination',
        description: 'Distribution of intelligence to consumers and stakeholders',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '📤'
      },
      {
        key: 'feedback_evaluation',
        label: 'Feedback & Evaluation',
        description: 'Assessment of intelligence value and process effectiveness',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: '📊'
      },
      {
        key: 'information_sources',
        label: 'Information Sources',
        description: 'Catalog of available information feeds and collection capabilities',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '🗂️'
      },
      {
        key: 'flow_metrics',
        label: 'Flow Metrics',
        description: 'Timeliness, accuracy, relevance, and efficiency measurements',
        color: 'border-pink-500',
        bgColor: 'bg-pink-50 dark:bg-pink-900/20',
        icon: '📈'
      }
    ]
  }
}
