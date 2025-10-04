export interface FrameworkDescription {
  title: string
  context: string
  wikipediaUrl?: string
  goodUseCases: string[]
  notIdealFor: string[]
}

export const frameworkDescriptions: Record<string, FrameworkDescription> = {
  'swot': {
    title: 'SWOT Analysis',
    context: `SWOT Analysis is a strategic planning framework that evaluates Strengths, Weaknesses, Opportunities, and Threats. Developed in the 1960s at Stanford Research Institute, SWOT helps organizations understand their internal capabilities (strengths/weaknesses) and external environment (opportunities/threats) to inform strategic decision-making. This versatile tool is used across business, nonprofit, and government sectors for strategic planning and competitive analysis.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/SWOT_analysis',
    goodUseCases: [
      'Business strategy development and market positioning',
      'Product launch planning and competitive analysis',
      'Personal career planning and self-assessment',
      'Organizational assessment before major initiatives',
      'Quarterly or annual strategic reviews',
      'Evaluating partnerships or M&A opportunities'
    ],
    notIdealFor: [
      'Highly complex multi-stakeholder problems requiring deep analysis',
      'Quantitative financial analysis or detailed ROI calculations',
      'Time-sensitive decisions requiring immediate action',
      'Problems requiring specialized domain expertise beyond basic strategy',
      'Detailed operational planning with specific timelines and resources'
    ]
  },

  'pest': {
    title: 'PEST Analysis',
    context: `PEST Analysis examines the macro-environmental factors affecting organizations through four key dimensions: Political, Economic, Social, and Technological factors. Created by Harvard professor Francis Aguilar in 1967, PEST provides a framework for scanning the external environment to identify opportunities and threats. Variants include PESTLE (adding Legal and Environmental) and PESTEL. This framework is essential for understanding the broader context in which organizations operate.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/PEST_analysis',
    goodUseCases: [
      'Market entry strategy for new countries or regions',
      'Long-term strategic planning and scenario building',
      'Assessing regulatory and policy impacts on business',
      'Understanding macro trends affecting entire industries',
      'Investment decisions requiring environmental scanning',
      'Risk assessment for international operations'
    ],
    notIdealFor: [
      'Internal organizational issues or capability assessment',
      'Short-term tactical decisions (less than 6 months)',
      'Detailed competitor analysis or market positioning',
      'Product-level or operational planning',
      'Issues requiring technical or specialized domain analysis'
    ]
  },

  'ach': {
    title: 'Analysis of Competing Hypotheses',
    context: `ACH is a structured intelligence analysis methodology developed by CIA analyst Richards J. Heuer Jr. in the 1970s. Unlike conventional analysis that seeks to confirm hypotheses, ACH focuses on disproving them by systematically evaluating evidence against multiple competing explanations. This approach helps overcome confirmation bias and provides more rigorous, defensible conclusions. ACH is now widely used in intelligence, law enforcement, and business analysis.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Analysis_of_competing_hypotheses',
    goodUseCases: [
      'Intelligence analysis with multiple possible explanations',
      'Criminal investigations with competing theories',
      'Medical diagnosis with differential diagnoses',
      'Root cause analysis of complex failures or incidents',
      'Evaluating competing strategic options',
      'Due diligence investigations requiring rigorous analysis'
    ],
    notIdealFor: [
      'Problems with only one plausible explanation',
      'Time-sensitive decisions requiring immediate action',
      'Issues without sufficient evidence for evaluation',
      'Brainstorming or creative exploration phases',
      'Problems where intuition and experience are primary decision factors'
    ]
  },

  'cog': {
    title: 'Center of Gravity Analysis',
    context: `Center of Gravity (COG) analysis identifies the source of power that provides an entity with its strength, freedom of action, and will to act. Originally a military concept from Carl von Clausewitz's "On War" (1832), COG analysis examines critical capabilities, critical requirements, and critical vulnerabilities to understand what sustains an adversary's power and how it might be neutralized. This framework is widely used in military planning, competitive intelligence, and strategic analysis.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Center_of_gravity_(military)',
    goodUseCases: [
      'Military campaign planning and strategy development',
      'Competitive analysis to identify rival vulnerabilities',
      'Understanding adversary or competitor power structures',
      'Strategic planning for influence operations',
      'Counterterrorism and counterinsurgency analysis',
      'Business strategy to identify competitive advantages'
    ],
    notIdealFor: [
      'Collaborative environments requiring partnership building',
      'Internal organizational development or team building',
      'Problems without clear adversarial relationships',
      'Technology assessment or innovation planning',
      'Customer satisfaction or user experience analysis'
    ]
  },

  'pmesii-pt': {
    title: 'PMESII-PT Analysis',
    context: `PMESII-PT is a comprehensive operational environment assessment framework used primarily by military and intelligence organizations. It examines Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, and Time factors. Developed by the U.S. military for operational planning, PMESII-PT provides a holistic view of complex operational environments, enabling better understanding of interconnected systems and potential second-order effects of actions.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/PMESII-PT',
    goodUseCases: [
      'Military operational planning and mission analysis',
      'Stability operations and nation-building assessments',
      'Humanitarian assistance and disaster response planning',
      'Complex emergencies requiring multi-domain understanding',
      'Peacekeeping mission planning and assessment',
      'Regional analysis for diplomatic or development initiatives'
    ],
    notIdealFor: [
      'Simple business decisions or commercial applications',
      'Individual-level analysis or personal planning',
      'Short-term tactical problems (hours to days)',
      'Technology-focused product development',
      'Problems limited to a single domain or sector'
    ]
  },

  'dotmlpf': {
    title: 'DOTMLPF Analysis',
    context: `DOTMLPF examines organizational capability through seven domains: Doctrine, Organization, Training, Material, Leadership, Personnel, and Facilities. Developed by the U.S. Department of Defense for capability-based planning, DOTMLPF ensures comprehensive assessment of what's needed to achieve organizational objectives. This framework is particularly valuable for identifying gaps and planning improvements across all aspects of organizational capability.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/DOTMLPF',
    goodUseCases: [
      'Military capability development and gap analysis',
      'Organizational transformation and modernization',
      'Comprehensive readiness assessments',
      'Requirements definition for new capabilities',
      'Training program development and assessment',
      'Resource allocation across multiple domains'
    ],
    notIdealFor: [
      'External market or competitor analysis',
      'Customer-focused or user experience problems',
      'Strategic positioning or business model innovation',
      'Financial planning or investment analysis',
      'Policy development or regulatory compliance'
    ]
  },

  'dime': {
    title: 'DIME Framework',
    context: `DIME analyzes instruments of national power through four categories: Diplomatic, Information, Military, and Economic. Used extensively in national security and foreign policy analysis, DIME helps evaluate how nations or actors employ different forms of power to achieve objectives. This framework is essential for understanding statecraft, influence operations, and strategic competition in the international arena.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Instruments_of_national_power',
    goodUseCases: [
      'National security strategy development',
      'Foreign policy analysis and planning',
      'Understanding state-level competition and conflict',
      'Sanctions planning and economic statecraft',
      'Information operations and influence campaign analysis',
      'Assessing adversary intentions and capabilities'
    ],
    notIdealFor: [
      'Non-state actor analysis (corporations, NGOs)',
      'Internal organizational problems or development',
      'Technical or product-level analysis',
      'Individual or small-group behavior analysis',
      'Commercial business strategy without geopolitical context'
    ]
  },

  'stakeholder': {
    title: 'Stakeholder Analysis',
    context: `Stakeholder Analysis identifies and assesses individuals, groups, or organizations that affect or are affected by a project, policy, or decision. By mapping stakeholders based on their power and interest, this framework helps prioritize engagement strategies and manage relationships effectively. Originally developed in business management, stakeholder analysis is now used across project management, policy development, and change management initiatives.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Stakeholder_analysis',
    goodUseCases: [
      'Project planning and stakeholder engagement strategy',
      'Change management and organizational transformation',
      'Policy development requiring multi-stakeholder buy-in',
      'Crisis management and communication planning',
      'Community engagement for development projects',
      'Political analysis and coalition building'
    ],
    notIdealFor: [
      'Technical problems without social/political dimensions',
      'Individual decision-making without stakeholder impact',
      'Purely analytical or research-focused work',
      'Situations with very few stakeholders',
      'Time-sensitive decisions requiring immediate action'
    ]
  },

  'deception': {
    title: 'Deception Detection (CIA SATS)',
    context: `The CIA's Structured Analytic Techniques for Deception Detection, based on Richards J. Heuer Jr.'s methodology, provides a systematic approach to identifying potential deception using four key assessments: MOM (Motive, Opportunity, Means), POP (Patterns of Practice), MOSES (My Own Sources), and EVE (Evaluation of Evidence). This framework helps analysts overcome cognitive biases and rigorously evaluate whether information might be deliberately misleading.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Analysis_of_competing_hypotheses',
    goodUseCases: [
      'Intelligence analysis of potentially deceptive information',
      'Counterintelligence and security investigations',
      'Evaluating adversary information operations',
      'Due diligence for high-stakes business transactions',
      'Fraud detection and forensic accounting',
      'Assessing propaganda and disinformation campaigns'
    ],
    notIdealFor: [
      'Routine information verification without deception risk',
      'Collaborative environments built on trust',
      'Creative or exploratory analysis phases',
      'Time-sensitive decisions requiring quick action',
      'Problems without clear adversarial dynamics'
    ]
  },

  'behavior': {
    title: 'Behavior Analysis (Target Audience Analysis)',
    context: `Based on U.S. Army Field Manual TM 3-53.11 Chapter 2, this framework provides systematic analysis of behaviors within their social, cultural, and environmental context. It examines what drives behaviors, what obstacles exist, and what capabilities are required. This comprehensive approach helps understand target audiences for influence operations, behavior change campaigns, and cultural analysis.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Behavior_modification',
    goodUseCases: [
      'Military information operations and influence campaigns',
      'Public health behavior change programs',
      'Cultural analysis for foreign engagement',
      'Social marketing and advocacy campaigns',
      'Understanding adversary or population behaviors',
      'Community development and social programs'
    ],
    notIdealFor: [
      'Individual psychology or clinical assessment',
      'Technology or systems analysis',
      'Financial or economic analysis',
      'Problems not involving human behavior change',
      'Quick tactical decisions without behavior analysis needs'
    ]
  },

  'starbursting': {
    title: 'Starbursting',
    context: `Starbursting is a creative brainstorming technique that generates questions rather than answers. By systematically asking Who, What, When, Where, Why, and How questions about a topic, starbursting helps uncover gaps in understanding, identify research needs, and ensure comprehensive analysis. This technique, developed as part of creative problem-solving methodologies, is particularly valuable in early stages of planning and analysis.`,
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Brainstorming#Variations',
    goodUseCases: [
      'Initial project planning and scoping',
      'Research question development',
      'Requirements gathering for new initiatives',
      'Problem definition and exploration',
      'Gap analysis and information needs assessment',
      'Creative ideation and concept development'
    ],
    notIdealFor: [
      'Final decision-making or solution selection',
      'Detailed implementation planning',
      'Problems where questions are already well-defined',
      'Quantitative analysis or calculations',
      'Situations requiring immediate answers rather than questions'
    ]
  },

  'causeway': {
    title: 'Causeway Analysis (PUTAR)',
    context: `Causeway Analysis uses the PUTAR methodology (Problem, Undesired Actor, Target Audience, Remedy, Story) to analyze threats and develop influence operations strategies. This framework systematically identifies critical capabilities, requirements, and proximate targets that can be influenced to counter adversary actions. Developed for military information operations, Causeway provides a structured approach to understanding and disrupting adversary capabilities.`,
    wikipediaUrl: null,
    goodUseCases: [
      'Counter-terrorism and counter-insurgency operations',
      'Influence operations and strategic communications',
      'Threat network analysis and disruption',
      'Understanding adversary decision-making processes',
      'Developing targeted messaging campaigns',
      'Strategic competition and gray zone operations'
    ],
    notIdealFor: [
      'Collaborative or partnership-based initiatives',
      'Commercial business strategy without adversaries',
      'Internal organizational development',
      'Technical or scientific analysis',
      'Problems without clear adversarial actors'
    ]
  }
}
