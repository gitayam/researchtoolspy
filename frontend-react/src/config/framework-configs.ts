export interface FrameworkSection {
  key: string
  label: string
  description: string
  color: string
  bgColor: string
  icon: string
  hasDeficitAssessment?: boolean  // For COM-B components in behavior analysis
  comBComponent?: 'physical_capability' | 'psychological_capability' | 'physical_opportunity' | 'social_opportunity' | 'reflective_motivation' | 'automatic_motivation'
  promptQuestions?: string[]  // Guided questions to help users know what to document
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
    description: 'Systematic COG analysis across DIMEFIL domains with vulnerability scoring and network visualization (JP 3-0 methodology)',
    itemType: 'custom' as 'text' | 'qa',  // Custom COG implementation with specialized UI
    sections: [
      {
        key: 'operational_context',
        label: 'Operational Context',
        description: 'Define objectives, operating environment, and constraints',
        color: 'border-gray-500',
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        icon: '📋'
      },
      {
        key: 'centers_of_gravity',
        label: 'Centers of Gravity',
        description: 'Identify COGs across DIMEFIL domains (Friendly, Adversary, Host Nation)',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '🎯'
      },
      {
        key: 'critical_capabilities',
        label: 'Critical Capabilities',
        description: 'Primary abilities (verbs) that enable the COG to function',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '⚡'
      },
      {
        key: 'critical_requirements',
        label: 'Critical Requirements',
        description: 'Essential conditions and resources (nouns) needed for capabilities',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '📋'
      },
      {
        key: 'critical_vulnerabilities',
        label: 'Critical Vulnerabilities',
        description: 'Weaknesses that can be exploited with Impact/Attainability/Follow-up scoring',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '⚠️'
      },
      {
        key: 'network_analysis',
        label: 'Network Analysis',
        description: 'Visualize relationships and calculate centrality measures',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '🕸️'
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
    title: 'Behavior Analysis',
    description: 'Objective documentation of behaviors in specific locations/contexts (based on U.S. Army FM TM 3-53.11)',
    sections: [
      {
        key: 'basic_info',
        label: 'Basic Information',
        description: 'Define the behavior and context being analyzed (WHAT behavior, WHERE, WHEN)',
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
      {
        key: 'environmental_factors',
        label: 'Environmental Factors',
        description: 'Physical and environmental context. What infrastructure, resources, and accessibility factors exist?',
        color: 'border-teal-500',
        bgColor: 'bg-teal-50 dark:bg-teal-900/20',
        icon: '🌍',
        promptQuestions: [
          'What physical infrastructure exists? (buildings, roads, facilities)',
          'What resources are available? (equipment, materials, spaces)',
          'What are the accessibility considerations?',
          'What physical constraints or enablers exist?',
          'What environmental conditions affect this? (weather, climate, terrain)'
        ]
      },
      {
        key: 'social_context',
        label: 'Social and Cultural Context',
        description: 'Cultural norms, social influences, and community dynamics around this behavior.',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: '👥',
        promptQuestions: [
          'What are the cultural norms around this behavior?',
          'What social influences exist? (family, peers, community)',
          'Are there community leaders or influencers?',
          'What group dynamics or social pressures exist?',
          'How do people talk about or communicate about this behavior?'
        ]
      },
      {
        key: 'consequences',
        label: 'Consequences and Outcomes',
        description: 'What happens after someone performs this behavior? Rewards, costs, outcomes.',
        color: 'border-pink-500',
        bgColor: 'bg-pink-50 dark:bg-pink-900/20',
        icon: '⚖️',
        promptQuestions: [
          'What are the immediate consequences?',
          'What are the long-term outcomes?',
          'What rewards exist? (intrinsic and extrinsic)',
          'What costs or penalties exist?',
          'What unintended consequences occur?'
        ]
      },
      {
        key: 'symbols',
        label: 'Symbols and Signals',
        description: 'Visual, auditory, or social cues associated with this behavior.',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '🎭',
        promptQuestions: [
          'What symbols are associated with this behavior?',
          'What signals indicate someone is about to do this or has done it?',
          'Are there visual cues? (clothing, logos, badges)',
          'Are there auditory cues? (sounds, music, verbal phrases)',
          'What social status or identity markers exist?'
        ]
      },
      {
        key: 'observed_patterns',
        label: 'Observed Patterns',
        description: 'Variations and patterns in how different people perform this behavior.',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '🔄',
        promptQuestions: [
          'What variations exist in how people perform this?',
          'What are common sequences or typical paths?',
          'What shortcuts or workarounds do people use?',
          'How does performance vary by subgroup or demographic?',
          'What adaptations do people make to constraints?'
        ]
      },
      {
        key: 'potential_audiences',
        label: 'Potential Target Audiences',
        description: 'Who performs this behavior? Who could but doesn\'t? Identify audience segments for COM-B Analysis.',
        color: 'border-violet-500',
        bgColor: 'bg-violet-50 dark:bg-violet-900/20',
        icon: '🎯',
        promptQuestions: [
          'Who currently performs this behavior?',
          'Who could perform it but doesn\'t?',
          'What are the key demographic segments?',
          'What psychographic differences exist between groups?',
          'Who influences whether others perform this?'
        ]
      }
    ]
  },

  'comb-analysis': {
    type: 'comb-analysis',
    title: 'COM-B Analysis (Behaviour Change Wheel)',
    description: 'Target-audience-specific assessment using the COM-B model and Behaviour Change Wheel methodology',
    sections: [
      {
        key: 'setup',
        label: 'Analysis Setup',
        description: 'Link to behavior and define target audience',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '🎯'
      },
      {
        key: 'target_audience',
        label: 'Target Audience Definition',
        description: 'Demographics, psychographics, current relationship to behavior',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '👥'
      },
      // COM-B COMPONENT ASSESSMENTS
      {
        key: 'physical_capability',
        label: 'Physical Capability Assessment',
        description: 'Does this audience have the physical skills, strength, stamina needed?',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '💪',
        hasDeficitAssessment: true,
        comBComponent: 'physical_capability'
      },
      {
        key: 'psychological_capability',
        label: 'Psychological Capability Assessment',
        description: 'Does this audience have the knowledge, cognitive skills, comprehension needed?',
        color: 'border-amber-500',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        icon: '🧠',
        hasDeficitAssessment: true,
        comBComponent: 'psychological_capability'
      },
      {
        key: 'physical_opportunity',
        label: 'Physical Opportunity Assessment',
        description: 'Does this audience have access to environmental factors, time, resources, infrastructure?',
        color: 'border-teal-500',
        bgColor: 'bg-teal-50 dark:bg-teal-900/20',
        icon: '🌍',
        hasDeficitAssessment: true,
        comBComponent: 'physical_opportunity'
      },
      {
        key: 'social_opportunity',
        label: 'Social Opportunity Assessment',
        description: 'Do cultural norms, social cues, peer influence support this audience?',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: '👥',
        hasDeficitAssessment: true,
        comBComponent: 'social_opportunity'
      },
      {
        key: 'reflective_motivation',
        label: 'Reflective Motivation Assessment',
        description: 'Do this audience\'s beliefs, intentions, goals, identity align with the behavior?',
        color: 'border-indigo-500',
        bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
        icon: '🎯',
        hasDeficitAssessment: true,
        comBComponent: 'reflective_motivation'
      },
      {
        key: 'automatic_motivation',
        label: 'Automatic Motivation Assessment',
        description: 'Do this audience\'s emotions, impulses, habits, desires support the behavior?',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '⚡',
        hasDeficitAssessment: true,
        comBComponent: 'automatic_motivation'
      },
      // ADDITIONAL CONTEXT
      {
        key: 'contextual_factors',
        label: 'Contextual Factors',
        description: 'Environmental, cultural, or situational factors affecting this audience',
        color: 'border-slate-500',
        bgColor: 'bg-slate-50 dark:bg-slate-900/20',
        icon: '🌐'
      },
      {
        key: 'assumptions',
        label: 'Assumptions',
        description: 'What assumptions were made during this assessment?',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '⚠️'
      },
      {
        key: 'limitations',
        label: 'Limitations',
        description: 'What are the limitations of this analysis?',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '🚫'
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
    description: '6-stage structured COG methodology: Identify threats, map critical capabilities/requirements, and determine leverage points for influence operations',
    itemType: 'qa',
    sections: [
      {
        key: 'threat_id',
        label: 'Threat Identification',
        description: 'Define the issue and location being analyzed',
        color: 'border-gray-500',
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        icon: '📋'
      },
      {
        key: 'problem',
        label: 'Problem (P)',
        description: 'What is the specific problem or threat behavior?',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '⚠️'
      },
      {
        key: 'undesired_actor',
        label: 'Undesired Actor (U)',
        description: 'Who is the adversary or actor of responsibility causing this problem?',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '👤'
      },
      {
        key: 'target_audience',
        label: 'Target Audience (TA)',
        description: 'What audiences can be influenced to counter this threat?',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '🎯'
      },
      {
        key: 'remedy',
        label: 'Remedy (R)',
        description: 'What is the desired end state or solution?',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '✅'
      },
      {
        key: 'story',
        label: 'Story (S)',
        description: 'What narrative or messaging supports the remedy?',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        icon: '📖'
      },
      {
        key: 'critical_capabilities',
        label: 'Critical Capabilities',
        description: 'What capabilities enable the undesired actor to execute the threat?',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '⚡'
      },
      {
        key: 'critical_requirements',
        label: 'Critical Requirements',
        description: 'What essential conditions, resources, or dependencies support these capabilities?',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '📋'
      },
      {
        key: 'proximate_targets',
        label: 'Proximate Targets',
        description: 'What tangible entities can be influenced or targeted to disrupt critical requirements?',
        color: 'border-pink-500',
        bgColor: 'bg-pink-50 dark:bg-pink-900/20',
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
