export interface FrameworkSection {
  key: string
  label: string
  description: string
  color: string
  bgColor: string
  icon: string
}

export interface FrameworkConfig {
  type: string
  title: string
  description: string
  sections: FrameworkSection[]
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

  'vrio': {
    type: 'vrio',
    title: 'VRIO Framework',
    description: 'Value, Rarity, Imitability, Organization',
    sections: [
      {
        key: 'value',
        label: 'Value',
        description: 'Does it provide value to customers?',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '💎'
      },
      {
        key: 'rarity',
        label: 'Rarity',
        description: 'Is it rare or unique?',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '⭐'
      },
      {
        key: 'imitability',
        label: 'Imitability',
        description: 'Is it costly to imitate?',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '🔒'
      },
      {
        key: 'organization',
        label: 'Organization',
        description: 'Is the organization organized to exploit it?',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '🏢'
      }
    ]
  },

  'cog': {
    type: 'cog',
    title: 'Center of Gravity Analysis',
    description: 'Critical capabilities, requirements, and vulnerabilities',
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
    description: 'Stakeholder mapping and influence assessment',
    sections: [
      {
        key: 'high_power_high_interest',
        label: 'High Power, High Interest',
        description: 'Manage closely - key players',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '👑'
      },
      {
        key: 'high_power_low_interest',
        label: 'High Power, Low Interest',
        description: 'Keep satisfied',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '🤝'
      },
      {
        key: 'low_power_high_interest',
        label: 'Low Power, High Interest',
        description: 'Keep informed',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '📢'
      },
      {
        key: 'low_power_low_interest',
        label: 'Low Power, Low Interest',
        description: 'Monitor - minimal effort',
        color: 'border-gray-500',
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        icon: '👥'
      }
    ]
  },

  'trend': {
    type: 'trend',
    title: 'Trend Analysis',
    description: 'Identify and forecast emerging trends',
    sections: [
      {
        key: 'emerging_trends',
        label: 'Emerging Trends',
        description: 'New trends just beginning to form',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '🌱'
      },
      {
        key: 'growing_trends',
        label: 'Growing Trends',
        description: 'Trends gaining momentum',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '📈'
      },
      {
        key: 'mature_trends',
        label: 'Mature Trends',
        description: 'Well-established trends at peak',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '🎯'
      },
      {
        key: 'declining_trends',
        label: 'Declining Trends',
        description: 'Trends losing relevance',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '📉'
      }
    ]
  },

  'deception': {
    type: 'deception',
    title: 'Deception Detection',
    description: 'Identify and analyze deception indicators',
    sections: [
      {
        key: 'behavioral_indicators',
        label: 'Behavioral Indicators',
        description: 'Observable behavioral patterns suggesting deception',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '👁️'
      },
      {
        key: 'verbal_indicators',
        label: 'Verbal Indicators',
        description: 'Linguistic cues and speech patterns',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '💬'
      },
      {
        key: 'contextual_indicators',
        label: 'Contextual Indicators',
        description: 'Situational and environmental factors',
        color: 'border-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: '🔍'
      },
      {
        key: 'physiological_indicators',
        label: 'Physiological Indicators',
        description: 'Physical responses and reactions',
        color: 'border-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: '❤️'
      }
    ]
  },

  'behavior': {
    type: 'behavior',
    title: 'Behavioral Analysis',
    description: 'Analyze patterns of behavior',
    sections: [
      {
        key: 'normal_patterns',
        label: 'Normal Patterns',
        description: 'Baseline behavioral patterns',
        color: 'border-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: '✅'
      },
      {
        key: 'anomalies',
        label: 'Anomalies',
        description: 'Deviations from normal behavior',
        color: 'border-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: '⚠️'
      },
      {
        key: 'triggers',
        label: 'Triggers',
        description: 'Events or conditions causing behavior changes',
        color: 'border-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: '⚡'
      },
      {
        key: 'predictions',
        label: 'Predictions',
        description: 'Expected future behavioral patterns',
        color: 'border-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: '🔮'
      }
    ]
  },

  'starbursting': {
    type: 'starbursting',
    title: 'Starbursting',
    description: 'Question-based brainstorming technique',
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
  }
}
