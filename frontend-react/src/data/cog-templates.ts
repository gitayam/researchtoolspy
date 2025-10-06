// COG Analysis Templates
// Pre-built templates to accelerate COG analysis creation

import type { COGAnalysis, OperationalContext, CenterOfGravity, CriticalCapability, CriticalRequirement, CriticalVulnerability } from '@/types/cog-analysis'

export interface COGTemplate {
  id: string
  name: string
  description: string
  category: 'adversary' | 'friendly' | 'host_nation' | 'cyber' | 'information'
  icon: string
  template_data: Omit<COGAnalysis, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'status'>
}

// Template 1: Adversary Command & Control COG
export const adversaryCommandControlTemplate: COGTemplate = {
  id: 'template-adversary-c2',
  name: 'Adversary Command & Control',
  description: 'Template for analyzing adversary command and control structures and identifying vulnerabilities in military decision-making processes',
  category: 'adversary',
  icon: '🎖️',
  template_data: {
    title: 'Adversary Command & Control Analysis',
    description: 'Analysis of adversary command and control structure to identify critical vulnerabilities for targeting',
    operational_context: {
      objective: 'Identify and prioritize adversary command and control vulnerabilities to degrade their decision-making capability',
      desired_impact: 'Disrupt adversary ability to coordinate forces and execute operational plans, forcing reactive posture',
      our_identity: 'Joint Task Force with multi-domain capabilities including cyber, EW, and kinetic strike',
      operating_environment: 'Theater-level operations against peer adversary with integrated air defense and sophisticated C2 architecture (PMESII-PT: contested electromagnetic spectrum, urban population centers, complex terrain)',
      constraints: ['Must minimize civilian casualties', 'Limited precision strike munitions', 'Restricted cyber authorities requiring approval'],
      restraints: ['Cannot target civilian infrastructure', 'Rules of engagement prohibit strikes on certain facilities', 'No cross-border operations without authorization'],
      timeframe: '30-45 days from current assessment to decision point',
      strategic_level: 'operational',
    },
    scoring_system: 'linear',
    centers_of_gravity: [
      {
        id: 'cog-1',
        actor_category: 'adversary',
        actor_name: 'Adversary Forces',
        domain: 'military',
        description: 'Integrated Command and Control System enabling synchronized multi-domain operations',
        rationale: 'Without this C2 system, adversary cannot coordinate air, ground, and naval forces effectively. Loss of this capability would force decentralized operations and significantly degrade combat power.',
        confidence: 'high',
        priority: 1,
        validated: true,
        linked_evidence: [],
      },
    ],
    critical_capabilities: [
      {
        id: 'cap-1',
        cog_id: 'cog-1',
        capability: 'Coordinate multi-domain strike operations across theater',
        description: 'Ability to synchronize air, naval, ground, and cyber operations in real-time against multiple targets',
        strategic_contribution: 'Enables adversary to achieve decision superiority and mass effects at critical points',
        linked_evidence: [],
      },
      {
        id: 'cap-2',
        cog_id: 'cog-1',
        capability: 'Maintain situational awareness of friendly forces disposition',
        description: 'Real-time intelligence picture of friendly forces locations, capabilities, and intentions',
        strategic_contribution: 'Allows adversary to exploit gaps, avoid strengths, and time operations for maximum effect',
        linked_evidence: [],
      },
    ],
    critical_requirements: [
      {
        id: 'req-1',
        capability_id: 'cap-1',
        requirement: 'Redundant communication network (fiber, satellite, radio)',
        requirement_type: 'infrastructure',
        description: 'Multiple communication pathways ensuring C2 connectivity even under attack',
        linked_evidence: [],
      },
      {
        id: 'req-2',
        capability_id: 'cap-1',
        requirement: 'Centralized operations center with decision-making authority',
        requirement_type: 'infrastructure',
        description: 'Physical location where senior leaders make time-sensitive operational decisions',
        linked_evidence: [],
      },
      {
        id: 'req-3',
        capability_id: 'cap-2',
        requirement: 'ISR platform network (satellites, UAVs, SIGINT)',
        requirement_type: 'equipment',
        description: 'Collection assets providing continuous coverage of friendly force movements',
        linked_evidence: [],
      },
    ],
    critical_vulnerabilities: [
      {
        id: 'vuln-1',
        requirement_id: 'req-1',
        vulnerability: 'Fiber optic cable hub located at known chokepoint',
        vulnerability_type: 'physical',
        description: 'Critical fiber junction serving three command nodes concentrated in small geographic area, single point of failure',
        exploitation_method: 'Precision strike or cyber attack on fiber junction to sever communications between forward units and strategic command',
        expected_effect: 'Adversary loses primary C2 link to forward forces within 2-4 hours. Command authority devolves to lower echelons, degrading coordination by 60-70%. Recovery time: 48-72 hours.',
        recommended_actions: ['Conduct detailed target analysis of fiber hub', 'Develop kinetic and non-kinetic strike options', 'Coordinate with cyber command for dual-pronged approach', 'Plan follow-on strikes to prevent rapid repair'],
        confidence: 'high',
        scoring: {
          impact_on_cog: 5,
          attainability: 4,
          follow_up_potential: 5,
        },
        composite_score: 14,
        linked_evidence: [],
      },
      {
        id: 'vuln-2',
        requirement_id: 'req-2',
        vulnerability: 'Operations center lacks hardening against cyber attack',
        vulnerability_type: 'cyber',
        description: 'Command center network vulnerable to intrusion due to legacy systems and insufficient segmentation',
        exploitation_method: 'Cyber operations to disrupt or degrade C2 systems, potentially insert false information',
        expected_effect: 'Temporary loss of C2 situational awareness (12-24 hours). Potential for decision-making based on corrupted data. Forces confusion and delays in adversary response.',
        recommended_actions: ['Develop cyber operation plan targeting C2 network', 'Coordinate with national-level cyber authorities', 'Prepare information operations to exploit confusion', 'Plan complementary kinetic strikes during degraded C2 window'],
        confidence: 'medium',
        scoring: {
          impact_on_cog: 4,
          attainability: 3,
          follow_up_potential: 4,
        },
        composite_score: 11,
        linked_evidence: [],
      },
      {
        id: 'vuln-3',
        requirement_id: 'req-3',
        vulnerability: 'Limited number of over-the-horizon relay satellites',
        vulnerability_type: 'physical',
        description: 'Only 3 satellites provide relay capability for theater ISR assets, creating temporal coverage gaps',
        exploitation_method: 'Anti-satellite weapons or electronic warfare to deny adversary ISR during critical operations',
        expected_effect: 'Adversary loses 40-50% ISR coverage during satellite denial window (6-8 hour gaps). Creates opportunity for friendly maneuver without detection.',
        recommended_actions: ['Coordinate ASAT employment with national command authority', 'Time friendly operations to coincide with ISR gaps', 'Develop EW plan for satellite jamming as alternative', 'Exploit gaps for force repositioning'],
        confidence: 'medium',
        scoring: {
          impact_on_cog: 4,
          attainability: 2,
          follow_up_potential: 5,
        },
        composite_score: 11,
        linked_evidence: [],
      },
    ],
  },
}

// Template 2: Adversary Information Operations COG
export const adversaryInformationOpsTemplate: COGTemplate = {
  id: 'template-adversary-info-ops',
  name: 'Adversary Information Operations',
  description: 'Template for analyzing adversary information warfare capabilities and identifying weaknesses in propaganda and influence networks',
  category: 'information',
  icon: '📡',
  template_data: {
    title: 'Adversary Information Operations Analysis',
    description: 'Analysis of adversary information warfare ecosystem to identify vulnerabilities for counter-IO operations',
    operational_context: {
      objective: 'Identify critical vulnerabilities in adversary information operations to degrade their ability to influence target populations',
      desired_impact: 'Reduce adversary information influence by 50-60%, expose disinformation campaigns, and restore confidence in legitimate information sources',
      our_identity: 'Joint Information Operations Task Force with cyber, PSYOP, and strategic communications capabilities',
      operating_environment: 'Global information environment with focus on contested regions (PMESII-PT: high social media penetration, low media literacy, existing distrust of institutions)',
      constraints: ['Must avoid censorship appearance', 'Limited platform cooperation', 'Cannot violate free speech norms', 'Budget constraints on counter-messaging'],
      restraints: ['No offensive cyber operations against civilian platforms', 'Cannot directly attribute without evidence', 'Avoid escalation to kinetic domain'],
      timeframe: '60-90 days for measurable effect on information environment',
      strategic_level: 'strategic',
    },
    scoring_system: 'linear',
    centers_of_gravity: [
      {
        id: 'cog-1',
        actor_category: 'adversary',
        actor_name: 'State Information Apparatus',
        domain: 'information',
        description: 'Coordinated network of state media, troll farms, and proxy accounts enabling large-scale influence operations',
        rationale: 'This apparatus is the primary mechanism for adversary strategic messaging and disinformation. Without it, adversary loses ability to shape narrative and influence foreign populations at scale.',
        confidence: 'high',
        priority: 1,
        validated: true,
        linked_evidence: [],
      },
    ],
    critical_capabilities: [
      {
        id: 'cap-1',
        cog_id: 'cog-1',
        capability: 'Amplify narratives across multiple platforms simultaneously',
        description: 'Ability to coordinate messaging across state media, social media, and proxy sites to flood information space',
        strategic_contribution: 'Creates perception of grassroots support and drowns out counter-narratives',
        linked_evidence: [],
      },
      {
        id: 'cap-2',
        cog_id: 'cog-1',
        capability: 'Evade platform detection and content moderation',
        description: 'Sophisticated techniques to avoid automated and human detection of coordinated inauthentic behavior',
        strategic_contribution: 'Ensures persistent presence on platforms even during enforcement actions',
        linked_evidence: [],
      },
    ],
    critical_requirements: [
      {
        id: 'req-1',
        capability_id: 'cap-1',
        requirement: 'Network of coordinated social media accounts (estimated 10,000+ accounts)',
        requirement_type: 'infrastructure',
        description: 'Large-scale network of accounts operated by troll farms to amplify and distribute content',
        linked_evidence: [],
      },
      {
        id: 'req-2',
        capability_id: 'cap-2',
        requirement: 'Platform policy compliance and technical evasion tactics',
        requirement_type: 'information',
        description: 'Understanding of platform algorithms and moderation to avoid detection while maximizing reach',
        linked_evidence: [],
      },
    ],
    critical_vulnerabilities: [
      {
        id: 'vuln-1',
        requirement_id: 'req-1',
        vulnerability: 'Centralized account management infrastructure',
        vulnerability_type: 'cyber',
        description: 'Account credentials and automation scripts managed through limited number of servers, creating single point of failure',
        exploitation_method: 'Coordinate with platforms to identify and remove coordinated accounts in synchronized takedown',
        expected_effect: 'Adversary loses 60-70% of amplification network within 48 hours. IO effectiveness drops significantly, requiring 2-3 months to rebuild network. Follow-on degradation as users lose trust in remaining accounts.',
        recommended_actions: ['Compile account network mapping data', 'Brief platforms on coordinated behavior patterns', 'Coordinate multi-platform takedown timing', 'Prepare messaging to highlight takedown success', 'Monitor for reconstitution attempts'],
        confidence: 'high',
        scoring: {
          impact_on_cog: 5,
          attainability: 4,
          follow_up_potential: 5,
        },
        composite_score: 14,
        linked_evidence: [],
      },
      {
        id: 'vuln-2',
        requirement_id: 'req-2',
        vulnerability: 'Dependence on specific platform features and algorithms',
        vulnerability_type: 'informational',
        description: 'IO campaigns optimized for current platform recommendation algorithms; vulnerable to algorithm changes',
        exploitation_method: 'Work with platforms to adjust algorithms to de-prioritize coordinated inauthentic behavior',
        expected_effect: 'Reach and engagement metrics drop 40-50% as content stops appearing in recommendations. Adversary forced to adapt tactics, creating temporary disruption window.',
        recommended_actions: ['Engage platform trust & safety teams', 'Provide technical indicators of coordinated behavior', 'Advocate for algorithm adjustments', 'Monitor effectiveness of changes'],
        confidence: 'medium',
        scoring: {
          impact_on_cog: 4,
          attainability: 3,
          follow_up_potential: 3,
        },
        composite_score: 10,
        linked_evidence: [],
      },
    ],
  },
}

// Template 3: Friendly Logistics COG
export const friendlyLogisticsTemplate: COGTemplate = {
  id: 'template-friendly-logistics',
  name: 'Friendly Logistics COG',
  description: 'Template for analyzing friendly forces logistics to identify and protect critical vulnerabilities in supply chains',
  category: 'friendly',
  icon: '🚚',
  template_data: {
    title: 'Friendly Logistics COG Protection Analysis',
    description: 'Self-assessment of friendly logistics vulnerabilities to prioritize protection measures',
    operational_context: {
      objective: 'Identify critical vulnerabilities in friendly logistics system to prioritize force protection and redundancy measures',
      desired_impact: 'Ensure uninterrupted logistics support to deployed forces despite adversary targeting',
      our_identity: 'Deployed Joint Task Force operating 800km from strategic support base',
      operating_environment: 'Extended logistics lines through contested territory with adversary long-range fires and cyber threats (PMESII-PT: limited host nation support, degraded infrastructure, austere forward operating bases)',
      constraints: ['Limited airlift capacity', 'Restricted ground convoy routes', 'Budget limits on redundancy', 'Cannot rely on local sourcing'],
      restraints: ['Force protection requirements limit convoy speed', 'Environmental regulations restrict fuel storage', 'Cannot militarize civilian infrastructure without host nation approval'],
      timeframe: 'Immediate assessment for next 90 days of operations',
      strategic_level: 'operational',
    },
    scoring_system: 'linear',
    centers_of_gravity: [
      {
        id: 'cog-1',
        actor_category: 'friendly',
        actor_name: 'Joint Task Force',
        domain: 'military',
        description: 'Logistics supply chain enabling sustained forward operations',
        rationale: 'Without continuous logistics, forward forces cannot sustain operations beyond 7-10 days. This supply chain is essential to mission accomplishment.',
        confidence: 'confirmed',
        priority: 1,
        validated: true,
        linked_evidence: [],
      },
    ],
    critical_capabilities: [
      {
        id: 'cap-1',
        cog_id: 'cog-1',
        capability: 'Deliver fuel, ammunition, and supplies to forward operating bases',
        description: 'Ability to transport critical supplies from rear logistics hub to forward units within operational timeline',
        strategic_contribution: 'Enables sustained combat operations and freedom of maneuver',
        linked_evidence: [],
      },
    ],
    critical_requirements: [
      {
        id: 'req-1',
        capability_id: 'cap-1',
        requirement: 'Ground convoy routes and forward logistics nodes',
        requirement_type: 'infrastructure',
        description: 'Primary supply route (MSR) and forward staging areas for redistribution',
        linked_evidence: [],
      },
      {
        id: 'req-2',
        capability_id: 'cap-1',
        requirement: 'Logistics tracking and coordination systems',
        requirement_type: 'information',
        description: 'Movement tracking and inventory management systems to coordinate supply delivery',
        linked_evidence: [],
      },
    ],
    critical_vulnerabilities: [
      {
        id: 'vuln-1',
        requirement_id: 'req-1',
        vulnerability: 'Single bridge chokepoint on primary supply route',
        vulnerability_type: 'physical',
        description: 'MSR crosses river at single bridge; no alternate route within 200km. Bridge vulnerable to adversary strike or sabotage',
        exploitation_method: 'Adversary could destroy bridge with precision strike, severing primary logistics line',
        expected_effect: 'If bridge destroyed, forward forces limited to 7-10 days supply before significant degradation. Airlift insufficient to sustain operations. Mission failure risk: HIGH.',
        recommended_actions: ['Establish alternate supply route (even if longer)', 'Pre-position 30-day supply forward', 'Install bridge protection systems (air defense, counter-UAS)', 'Develop expedient bridging plan with engineer assets', 'Coordinate host nation for route redundancy'],
        confidence: 'confirmed',
        scoring: {
          impact_on_cog: 5,
          attainability: 4,
          follow_up_potential: 2,
        },
        composite_score: 11,
        linked_evidence: [],
      },
      {
        id: 'vuln-2',
        requirement_id: 'req-2',
        vulnerability: 'Logistics systems vulnerable to cyber attack',
        vulnerability_type: 'cyber',
        description: 'Movement tracking systems accessible via network; insufficient cyber hardening and backup procedures',
        exploitation_method: 'Adversary cyber operations could corrupt data or deny access to tracking systems',
        expected_effect: 'Loss of visibility on supply status and locations. Manual tracking reduces efficiency by 50%, increases delivery times, and creates potential for shortages. Recovery time: 48-72 hours.',
        recommended_actions: ['Implement network segmentation for logistics systems', 'Develop manual backup procedures and train personnel', 'Conduct cyber resilience exercise', 'Establish alternate communications for convoy coordination'],
        confidence: 'high',
        scoring: {
          impact_on_cog: 4,
          attainability: 3,
          follow_up_potential: 3,
        },
        composite_score: 10,
        linked_evidence: [],
      },
    ],
  },
}

// Template 4: Cyber Domain COG
export const cyberDomainTemplate: COGTemplate = {
  id: 'template-cyber-domain',
  name: 'Cyber Domain COG',
  description: 'Template for analyzing adversary cyber capabilities and critical infrastructure dependencies',
  category: 'cyber',
  icon: '💻',
  template_data: {
    title: 'Adversary Cyber Operations COG Analysis',
    description: 'Analysis of adversary cyber warfare capabilities to identify vulnerabilities for defensive and offensive cyber operations',
    operational_context: {
      objective: 'Identify vulnerabilities in adversary cyber operations infrastructure to enable defensive measures and potential offensive operations',
      desired_impact: 'Degrade adversary cyber attack capabilities while protecting friendly critical infrastructure',
      our_identity: 'Cyber Command element supporting Joint Task Force operations',
      operating_environment: 'Global cyberspace with focus on critical infrastructure protection (PMESII-PT: high internet connectivity, legacy OT systems, limited cyber workforce)',
      constraints: ['Legal authorities for offensive cyber operations', 'Risk of collateral damage to civilian infrastructure', 'Limited cyber operations capacity'],
      restraints: ['Cannot conduct operations without proper authorization', 'Must avoid escalation', 'Cannot target civilian-only infrastructure'],
      timeframe: '30-60 days for initial effects',
      strategic_level: 'strategic',
    },
    scoring_system: 'linear',
    centers_of_gravity: [
      {
        id: 'cog-1',
        actor_category: 'adversary',
        actor_name: 'State Cyber Forces',
        domain: 'cyber',
        description: 'Adversary cyber operations infrastructure enabling attacks on critical infrastructure',
        rationale: 'This infrastructure is the foundation of adversary cyber power projection. Without it, adversary cannot conduct large-scale cyber operations against strategic targets.',
        confidence: 'high',
        priority: 1,
        validated: true,
        linked_evidence: [],
      },
    ],
    critical_capabilities: [
      {
        id: 'cap-1',
        cog_id: 'cog-1',
        capability: 'Launch coordinated cyber attacks against critical infrastructure',
        description: 'Ability to compromise and disrupt power grids, communications, financial systems simultaneously',
        strategic_contribution: 'Enables strategic coercion and degradation of adversary warfighting capability without kinetic strikes',
        linked_evidence: [],
      },
    ],
    critical_requirements: [
      {
        id: 'req-1',
        capability_id: 'cap-1',
        requirement: 'Command and control infrastructure for cyber operations',
        requirement_type: 'infrastructure',
        description: 'Servers, networks, and personnel coordinating cyber attack campaigns',
        linked_evidence: [],
      },
      {
        id: 'req-2',
        capability_id: 'cap-1',
        requirement: 'Zero-day exploits and access to target networks',
        requirement_type: 'information',
        description: 'Pre-positioned access and sophisticated exploits for critical infrastructure systems',
        linked_evidence: [],
      },
    ],
    critical_vulnerabilities: [
      {
        id: 'vuln-1',
        requirement_id: 'req-1',
        vulnerability: 'Known IP ranges for cyber operations infrastructure',
        vulnerability_type: 'cyber',
        description: 'Cyber attack infrastructure operates from identifiable network ranges, enabling targeting',
        exploitation_method: 'Offensive cyber operations to disrupt C2 infrastructure or defensive measures to block communications',
        expected_effect: 'Disrupts adversary ability to coordinate cyber operations for 24-48 hours. Creates window for defensive hardening and forces adversary to re-establish C2 through alternate channels.',
        recommended_actions: ['Develop offensive cyber operation plan targeting C2 infrastructure', 'Coordinate with ISPs for traffic blocking', 'Prepare defensive measures to exploit disruption window', 'Monitor for infrastructure reconstitution'],
        confidence: 'high',
        scoring: {
          impact_on_cog: 4,
          attainability: 4,
          follow_up_potential: 4,
        },
        composite_score: 12,
        linked_evidence: [],
      },
      {
        id: 'vuln-2',
        requirement_id: 'req-2',
        vulnerability: 'Dependence on specific exploit types and vectors',
        vulnerability_type: 'cyber',
        description: 'Adversary cyber operations rely heavily on known exploit classes (e.g., phishing, supply chain)',
        exploitation_method: 'Accelerate patching and implement compensating controls for targeted vulnerabilities',
        expected_effect: 'Reduces adversary attack surface by 40-60%. Forces shift to less reliable attack vectors, decreasing success rate and increasing cost of operations.',
        recommended_actions: ['Conduct vulnerability assessment of critical systems', 'Accelerate patch deployment for targeted vulnerabilities', 'Implement network segmentation', 'Enhance email security and user training', 'Monitor for adversary adaptation'],
        confidence: 'high',
        scoring: {
          impact_on_cog: 3,
          attainability: 5,
          follow_up_potential: 3,
        },
        composite_score: 11,
        linked_evidence: [],
      },
    ],
  },
}

// Template 5: Host Nation Critical Infrastructure
export const hostNationInfrastructureTemplate: COGTemplate = {
  id: 'template-host-nation-infrastructure',
  name: 'Host Nation Critical Infrastructure',
  description: 'Template for analyzing host nation critical infrastructure to identify protection priorities during operations',
  category: 'host_nation',
  icon: '🏭',
  template_data: {
    title: 'Host Nation Critical Infrastructure Protection Analysis',
    description: 'Assessment of host nation critical infrastructure vulnerabilities to prioritize protection during operations',
    operational_context: {
      objective: 'Identify critical vulnerabilities in host nation infrastructure that adversary will likely target, prioritize protection measures',
      desired_impact: 'Prevent adversary from achieving strategic effects through infrastructure attacks, maintain host nation support for operations',
      our_identity: 'Joint Task Force supporting host nation defense',
      operating_environment: 'Host nation with aging infrastructure and limited protection capabilities (PMESII-PT: high infrastructure interdependence, limited maintenance budgets, growing population straining capacity)',
      constraints: ['Host nation sovereignty limits our authorities', 'Limited resources for infrastructure protection', 'Cannot interfere with civilian operations'],
      restraints: ['Must coordinate all actions with host nation government', 'Cannot unilaterally deploy protection systems', 'Limited to advisory and assistance role in some areas'],
      timeframe: 'Immediate assessment for next 180 days',
      strategic_level: 'strategic',
    },
    scoring_system: 'linear',
    centers_of_gravity: [
      {
        id: 'cog-1',
        actor_category: 'host_nation',
        actor_name: 'Host Nation Government',
        domain: 'economic',
        description: 'Electrical power grid supporting critical government functions, economy, and population centers',
        rationale: 'Power grid failure would cripple government operations, collapse economy, and turn population against coalition forces. This infrastructure is essential to mission success and host nation stability.',
        confidence: 'confirmed',
        priority: 1,
        validated: true,
        linked_evidence: [],
      },
    ],
    critical_capabilities: [
      {
        id: 'cap-1',
        cog_id: 'cog-1',
        capability: 'Provide reliable electrical power to capital region and industrial centers',
        description: 'Ability to generate and distribute electricity to support government, economy, and 5 million residents',
        strategic_contribution: 'Enables continued governance, economic activity, and popular support for host nation government',
        linked_evidence: [],
      },
    ],
    critical_requirements: [
      {
        id: 'req-1',
        capability_id: 'cap-1',
        requirement: 'Three primary power generation stations',
        requirement_type: 'infrastructure',
        description: 'Main power plants (2 natural gas, 1 hydroelectric) providing 80% of capital region electricity',
        linked_evidence: [],
      },
      {
        id: 'req-2',
        capability_id: 'cap-1',
        requirement: 'SCADA systems controlling power distribution',
        requirement_type: 'equipment',
        description: 'Supervisory control and data acquisition systems managing grid operations',
        linked_evidence: [],
      },
    ],
    critical_vulnerabilities: [
      {
        id: 'vuln-1',
        requirement_id: 'req-1',
        vulnerability: 'Power stations lack air defense protection',
        vulnerability_type: 'physical',
        description: 'Generation facilities vulnerable to cruise missile, UAV, or SOF attack with no organic defenses',
        exploitation_method: 'Adversary could conduct standoff strike against power stations with high probability of success',
        expected_effect: 'Loss of 1-2 power stations would cause cascading grid failure affecting 4-5 million people. Restoration time: 2-4 weeks. Severe economic impact, humanitarian crisis, loss of host nation support for coalition operations. STRATEGIC FAILURE RISK.',
        recommended_actions: ['Deploy air defense systems to protect power generation sites (PRIORITY 1)', 'Establish no-fly zones around critical infrastructure', 'Coordinate with host nation on expedient hardening', 'Develop contingency plans for distributed power generation', 'Pre-position generators for critical facilities', 'Prepare IO campaign to mitigate population impact'],
        confidence: 'confirmed',
        scoring: {
          impact_on_cog: 5,
          attainability: 5,
          follow_up_potential: 2,
        },
        composite_score: 12,
        linked_evidence: [],
      },
      {
        id: 'vuln-2',
        requirement_id: 'req-2',
        vulnerability: 'SCADA systems accessible via internet with weak security',
        vulnerability_type: 'cyber',
        description: 'Legacy SCADA systems with default passwords, no network segmentation, remotely accessible for maintenance',
        exploitation_method: 'Adversary cyber operations could compromise SCADA to cause grid instability or shutdown',
        expected_effect: 'SCADA compromise could cause controlled shutdown (24-48 hour outage) or uncontrolled cascading failure (2-4 week outage). Significant economic and humanitarian impact. Host nation blame likely to fall on coalition forces.',
        recommended_actions: ['Conduct immediate SCADA security assessment with host nation', 'Implement network segmentation and access controls (PRIORITY 1)', 'Deploy cyber monitoring and defense capabilities', 'Develop manual override procedures', 'Train host nation personnel on cyber resilience', 'Establish 24/7 monitoring'],
        confidence: 'high',
        scoring: {
          impact_on_cog: 5,
          attainability: 4,
          follow_up_potential: 3,
        },
        composite_score: 12,
        linked_evidence: [],
      },
    ],
  },
}

// Export all templates as array
export const COG_TEMPLATES: COGTemplate[] = [
  adversaryCommandControlTemplate,
  adversaryInformationOpsTemplate,
  friendlyLogisticsTemplate,
  cyberDomainTemplate,
  hostNationInfrastructureTemplate,
]

// Helper function to get template by ID
export function getTemplateById(id: string): COGTemplate | undefined {
  return COG_TEMPLATES.find((t) => t.id === id)
}

// Helper function to get templates by category
export function getTemplatesByCategory(category: COGTemplate['category']): COGTemplate[] {
  return COG_TEMPLATES.filter((t) => t.category === category)
}

// Helper function to create analysis from template
export function createAnalysisFromTemplate(template: COGTemplate, userId: number): COGAnalysis {
  const now = new Date().toISOString()
  return {
    ...template.template_data,
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    created_by: userId,
    status: 'draft',
  }
}
