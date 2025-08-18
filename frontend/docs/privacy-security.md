# Privacy & Security Policy

## 🎯 Audience Guide

| Your Role | Key Sections |
|-----------|-------------|
| **End Users/Researchers** | [What We Don't Collect](#what-we-dont-collect), [Your Data](#your-data-your-control) |
| **IT Administrators** | [Technical Security](#technical-security-measures), [Compliance](#compliance-standards) |
| **Privacy Officers** | [Data Handling](#data-handling-practices), [Legal Framework](#legal-framework) |
| **Students/Academics** | [Research Ethics](#research-ethics), [Academic Use](#academic-use-guidelines) |

---

## 🛡️ Privacy-First Philosophy

ResearchTools is built on a **privacy-by-design** principle inspired by services like [Mullvad VPN](https://mullvad.net/en/help/no-logging-data-policy). We believe your research should remain private, and we've architected our system to make privacy breaches technically impossible.

### Core Privacy Principles

1. **Data Minimization**: We collect nothing we don't absolutely need
2. **Local Processing**: Your research stays on your device
3. **Anonymous Access**: No personal identifiers required
4. **No Tracking**: We don't monitor your research patterns
5. **Transparent Security**: Open about what we do and don't collect

---

## ❌ What We DON'T Collect

### Personal Information (0% Collection)
- ❌ **Email addresses** - Not required, never asked
- ❌ **Names** - No first name, last name, or usernames
- ❌ **Phone numbers** - No contact information whatsoever
- ❌ **Physical addresses** - No location data collected
- ❌ **IP address logging** - Not stored or tracked
- ❌ **Device fingerprinting** - No attempt to identify devices
- ❌ **Social media accounts** - No third-party login integration

### Research Content (0% Server Storage)
- ❌ **Analysis content** - Your frameworks stay in your browser
- ❌ **Research data** - Never transmitted to our servers
- ❌ **Draft analyses** - Not backed up on our systems
- ❌ **Export content** - Processed locally, not stored
- ❌ **Collaboration content** - Shared directly between users
- ❌ **Search queries** - No search history maintained

### Behavioral Data (0% Tracking)
- ❌ **Usage patterns** - No analytics tied to individuals
- ❌ **Login times** - No access pattern monitoring
- ❌ **Feature usage** - No behavioral profiling
- ❌ **Session duration** - No time-based tracking
- ❌ **Click tracking** - No user interaction monitoring
- ❌ **A/B testing data** - No experimental user grouping

### Technical Identifiers (0% Correlation)
- ❌ **Bookmark hash logging** - Never stored in server logs
- ❌ **Session correlation** - Can't link multiple sessions to same user
- ❌ **Cross-device tracking** - Impossible by design
- ❌ **Browser fingerprints** - No device identification attempts
- ❌ **Network analysis** - No traffic pattern analysis

---

## ✅ What We DO Collect (Minimal & Anonymous)

### System Health Only
- ✅ **Aggregate usage**: Total number of users (not who they are)
- ✅ **Error rates**: System errors for reliability (no user identification)
- ✅ **Performance metrics**: Response times for optimization
- ✅ **Security events**: Attack attempts for protection (no user correlation)

### Example of Our Anonymous Metrics
```json
{
  "daily_active_sessions": 1247,
  "framework_usage": {
    "swot": 456,
    "ach": 234,
    "pmesii-pt": 189
  },
  "error_rate": 0.02,
  "average_response_time": "120ms"
}
```

**Notice**: No user identifiers, no personal data, no tracking capability.

---

## 🔐 Your Data, Your Control

### How Your Data is Stored

#### Browser LocalStorage (Your Device Only)
```
Your Computer/Device
├── Browser LocalStorage
│   ├── bookmark_codes: ["1234567890123456"]
│   ├── swot_analysis_data: { analysis content }
│   ├── ach_framework_data: { framework data }
│   └── session_preferences: { settings }
└── Our Servers: EMPTY (no user data)
```

#### What This Means
- **Complete Control**: You control all your research data
- **No Surveillance**: We cannot access your work
- **Instant Deletion**: Clear browser data = all data gone
- **No Recovery**: We cannot help recover lost work (by design)
- **Device Bound**: Data only exists where you created it

### Data Portability (100% Yours)
- **Export Anytime**: Download all your work in standard formats
- **No Lock-in**: Data exports work with other tools
- **Format Choice**: PDF, Word, JSON, PowerPoint options
- **Instant Access**: No waiting periods or approval processes

### Data Deletion (Immediate & Complete)
- **Browser Clearing**: Removes all data instantly
- **No Server Copies**: Nothing to delete on our end
- **No Backups**: We don't backup your personal data
- **No Recovery**: Deletion is permanent (your choice)

---

## 🔒 Technical Security Measures

### Bookmark Authentication Security

#### Cryptographic Strength
- **53.1 bits of entropy**: 9,000,000,000,000,000 possible combinations
- **Secure generation**: Uses `crypto.getRandomValues()` Web API
- **No weak codes**: Impossible to choose predictable bookmarks
- **Range validation**: Only valid 16-digit codes accepted

#### Attack Resistance
```
Brute Force Analysis:
├── Total combinations: 9 × 10^15
├── Assuming 100,000 active users
├── Random guess success rate: 0.000001%
├── With rate limiting (5 attempts/15min)
└── Time to breach: Effectively impossible
```

### Application Security

#### Transport Security
- ✅ **HTTPS Enforced**: All traffic encrypted in transit
- ✅ **HSTS Headers**: Force secure connections
- ✅ **Certificate Pinning**: Prevent man-in-the-middle attacks
- ✅ **Perfect Forward Secrecy**: Past traffic stays secure

#### Content Security
- ✅ **Content Security Policy**: Prevent XSS attacks
- ✅ **X-Frame-Options**: Prevent clickjacking
- ✅ **Input Validation**: All user input sanitized
- ✅ **Output Encoding**: Prevent script injection

#### Rate Limiting (DDoS Protection)
```javascript
Rate Limits:
├── Bookmark validation: 5 attempts / 15 minutes
├── Export generation: 10 exports / hour
├── API requests: 100 requests / hour
└── Failed attempts: Progressive delays
```

### Infrastructure Security

#### Server Security
- ✅ **Regular Security Updates**: Automated patching
- ✅ **Firewall Protection**: Only necessary ports open
- ✅ **Intrusion Detection**: Monitoring for attacks
- ✅ **Vulnerability Scanning**: Regular security audits

#### Data Security
- ✅ **No User Database**: Can't be breached if it doesn't exist
- ✅ **Stateless Architecture**: No persistent user sessions
- ✅ **Encrypted Logs**: System logs encrypted at rest
- ✅ **Secure Disposal**: Server data securely wiped

---

## 📋 Compliance Standards

### GDPR Compliance (EU)

#### Article 5 - Data Processing Principles
- ✅ **Lawfulness**: No personal data processing
- ✅ **Purpose Limitation**: Only system operation data
- ✅ **Data Minimization**: Absolute minimum collection
- ✅ **Accuracy**: No personal data to be inaccurate
- ✅ **Storage Limitation**: No indefinite personal data storage
- ✅ **Integrity**: Strong security measures in place

#### GDPR Rights (Automatically Satisfied)
| Right | Our Compliance |
|-------|----------------|
| Right to be Informed | ✅ This policy provides full transparency |
| Right of Access | ✅ No data to access (client-side only) |
| Right to Rectification | ✅ No data to rectify |
| Right to Erasure | ✅ Clear browser data anytime |
| Right to Restrict Processing | ✅ No processing occurs |
| Right to Data Portability | ✅ Export features available |
| Right to Object | ✅ No tracking to object to |
| Rights related to Automated Decision Making | ✅ No automated profiling |

### CCPA Compliance (California)

#### Categories of Personal Information
- **Collected**: None
- **Sold**: None (nothing to sell)
- **Disclosed**: None (nothing to disclose)
- **Retention**: N/A (no collection)

#### Consumer Rights
- ✅ **Right to Know**: No personal information collected
- ✅ **Right to Delete**: No personal information to delete
- ✅ **Right to Opt-Out**: No sale of information occurs
- ✅ **Right to Non-Discrimination**: No different treatment possible

### SOC 2 Type II Considerations

#### Trust Services Principles
- ✅ **Security**: Strong security controls implemented
- ✅ **Availability**: High uptime and disaster recovery
- ✅ **Processing Integrity**: Data integrity maintained
- ✅ **Confidentiality**: No confidential data to protect
- ✅ **Privacy**: Privacy by design architecture

---

## 🏛️ Legal Framework

### Data Controller Status
ResearchTools acts as a **data processor** for system operation only. Users are the **data controllers** for their research content.

### Legal Basis (GDPR Article 6)
- **Legitimate Interest**: System operation and security
- **No Consent Required**: No personal data processing
- **No Special Categories**: No sensitive data collection

### Data Protection Officer
**Contact**: privacy@[your-domain].com  
**Role**: Oversee compliance and handle privacy inquiries  
**Response Time**: 72 hours maximum

### Jurisdiction
- **Primary**: [Your Jurisdiction]
- **Dispute Resolution**: [Your Local Courts]
- **Applicable Law**: [Local Privacy Laws]

---

## 🎓 Research Ethics

### Academic Use Guidelines

#### Institutional Review Board (IRB) Considerations
- **No Human Subjects**: Tool usage typically doesn't require IRB approval
- **Research Content**: Follow your institution's data handling requirements
- **Collaboration**: Document team member contributions appropriately
- **Publication**: Cite methodology and tool usage transparently

#### Data Handling Best Practices
1. **Sensitive Research**: Don't rely solely on browser storage
2. **Collaboration**: Only share bookmark codes with authorized team members
3. **Backup Strategy**: Regular exports for important research
4. **Retention Policy**: Follow institutional data retention requirements

#### Citation and Attribution
```
Recommended Citation:
Analysis conducted using ResearchTools privacy-preserving 
framework platform. [Framework] methodology applied according 
to [relevant standards]. No personal data collected or 
transmitted during analysis process.
```

### Ethical Research Practices
- **Informed Consent**: For any research involving human subjects
- **Data Anonymization**: Use tool's privacy features appropriately  
- **Secure Collaboration**: Protect bookmark codes like passwords
- **Publication Ethics**: Declare tool usage and methodology

---

## 🚨 Security Incident Response

### Incident Types We Monitor
- **System Intrusion Attempts**: Automated detection and response
- **Rate Limit Violations**: Potential abuse detection
- **Application Errors**: System integrity monitoring
- **Infrastructure Issues**: Service availability monitoring

### What We DON'T Monitor
- ❌ Individual user behavior
- ❌ Research content access
- ❌ Bookmark code usage patterns
- ❌ Collaboration activities

### Incident Response Process
1. **Detection**: Automated monitoring systems
2. **Assessment**: Determine scope and impact
3. **Containment**: Isolate affected systems
4. **Resolution**: Fix underlying issue
5. **Communication**: Notify users if necessary (rare)

### User Notification Policy
We will notify users only if:
- Service availability is significantly impacted
- Security vulnerability affects user data (highly unlikely given architecture)
- Legal requirement for notification exists

**Notification Methods**: Website banner, system status page

---

## 🔄 Privacy Policy Updates

### Change Notification
- **Material Changes**: 30-day advance notice via website
- **Technical Updates**: Immediate posting with changelog
- **Contact Changes**: Updated immediately

### Version Control
- **Current Version**: 1.0 (December 2024)
- **Previous Versions**: Available upon request
- **Change Log**: All modifications documented

### User Rights on Changes
- **Continued Use**: Constitutes acceptance of changes
- **Objection Rights**: Stop using service anytime
- **Data Portability**: Export data before policy changes take effect

---

## 📞 Privacy Contact Information

### Data Protection Inquiries
**Email**: privacy@[your-domain].com  
**Response Time**: 72 hours maximum  
**Available Languages**: [English, others as applicable]

### Security Concerns
**Email**: security@[your-domain].com  
**Encryption**: PGP key available upon request  
**Response Time**: 24 hours for security issues

### General Questions
**Documentation**: This policy and [User Guide](./user-guide.md)  
**Community**: [Community forums or support channels]  
**FAQ**: [Frequently asked questions section]

---

## ✅ Privacy Verification

### Third-Party Audits
- **Security Audits**: Annual third-party security assessments
- **Code Reviews**: Open source components reviewed
- **Penetration Testing**: Regular security testing
- **Privacy Impact Assessments**: Conducted for major changes

### Transparency Reports
We publish annual transparency reports covering:
- Security incidents (anonymized)
- System availability statistics  
- Legal requests received (expected: zero)
- Privacy policy effectiveness

### Self-Assessment Tools
Users can verify our privacy claims:
- **Browser DevTools**: Inspect network traffic (see: no tracking)
- **LocalStorage Inspection**: Verify data storage location
- **Export Verification**: Confirm data portability
- **Code Review**: [Open source components available]

---

## 🌍 International Considerations

### Cross-Border Data Transfers
- **No International Transfers**: Data stays on user's device
- **Server Location**: [Your server location]
- **CDN Usage**: Static assets only, no user data
- **Adequacy Decisions**: Not applicable (no personal data transfers)

### Regional Privacy Laws
- **GDPR** (EU): Fully compliant by design
- **CCPA** (California): Exceeds requirements  
- **PIPEDA** (Canada): Compliant
- **Privacy Act** (Australia): Compliant
- **LGPD** (Brazil): Compliant
- **Other Jurisdictions**: Generally compliant due to privacy-first design

---

## 📊 Privacy Metrics Dashboard

We maintain public metrics showing our privacy commitment:

```
Privacy Metrics (Updated Monthly)
├── Personal Data Collected: 0 bytes
├── User Profiles Created: 0
├── Email Addresses Stored: 0
├── Third-Party Data Sharing: 0 instances
├── Government Data Requests: 0
├── Data Breaches: 0 (impossible by design)
└── User Complaints: [Current number]
```

**Public Dashboard**: [Link to public metrics page]

---

## 🔍 Frequently Asked Privacy Questions

### Q: Can you see my research?
**A**: No. Your research is stored only in your browser's localStorage. We have no access to this data.

### Q: Do you backup my data?
**A**: No. We don't store your research data on our servers, so there's nothing for us to backup. You control all backups through exports.

### Q: Can you recover my lost bookmark code?
**A**: No. This is intentional - we don't store bookmark codes on our servers, so we cannot recover them.

### Q: Do you use cookies for tracking?
**A**: We use minimal technical cookies for site function only. No tracking cookies are used.

### Q: Can law enforcement request my data?
**A**: They can request, but we have no personal data to provide. Your research stays on your device.

### Q: How is this different from Google/Microsoft?
**A**: Those services collect extensive user data for advertising. We collect nothing personal and have no advertising model.

### Q: What if you get hacked?
**A**: Hackers would find no user data - your research isn't stored on our servers. System security protects availability, not your data (which isn't there).

### Q: Why should I trust this?
**A**: Don't trust - verify. Use browser developer tools to see exactly what data is sent (spoiler: none of your research).

---

**Last Updated**: December 2024  
**Policy Version**: 1.0  
**Next Review**: June 2025

---

*This policy is written in plain language to ensure accessibility. Legal terminology is used only where necessary for precision. If you need clarification on any section, please contact our privacy team.*