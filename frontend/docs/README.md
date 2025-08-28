# ResearchTools Documentation

Welcome to the ResearchTools documentation. This project uses a privacy-first bookmark authentication system inspired by Mullvad VPN's approach.

## 📚 Documentation Index

### Core Documentation

#### Authentication & Security
- 🔐 [Bookmark Authentication System](./bookmark-authentication.md) - Complete guide to our privacy-first authentication
- 🛠️ [Technical Implementation](./bookmark-auth-implementation.md) - Developer guide for bookmark auth
- 🔒 [Privacy & Security Policy](./privacy-security.md) *(coming soon)*

#### User Documentation
- 📖 [User Guide](./user-guide.md) *(coming soon)* - Getting started and workflows
- 🤝 [Collaboration Guide](./collaboration.md) *(coming soon)* - Sharing and team workflows
- 🔧 [Troubleshooting](./troubleshooting.md) *(coming soon)* - Common issues and solutions

#### Framework Guides
- 📊 [SWOT Analysis](./frameworks/swot-analysis.md) *(coming soon)*
- 🎯 [ACH Framework](./frameworks/ach-framework.md) *(coming soon)*
- 🌍 [PMESII-PT](./frameworks/pmesii-pt.md) *(coming soon)*
- ⚖️ [COG Analysis](./frameworks/cog-analysis.md) *(coming soon)*
- 🏗️ [DOTMLpf](./frameworks/dotmlpf.md) *(coming soon)*

#### Technical Documentation
- 🔌 [API Documentation](./api.md) *(coming soon)*
- 💾 [Auto-Save System](./auto-save.md) *(coming soon)*
- 🚀 [Deployment Guide](./deployment.md) *(coming soon)*
- ⚡ [Performance Guide](./performance.md) *(coming soon)*
- ♿ [Accessibility Guide](./accessibility.md) *(coming soon)*

#### Developer Resources
- 👥 [Contributing Guide](./contributing.md) *(coming soon)*
- 🏛️ [Architecture Decision Records](./adr/) *(coming soon)*
- 📦 [Migration Guides](./migration/) *(coming soon)*

#### Legal & Compliance
- 📜 [Terms of Service](./legal/terms-of-service.md) *(coming soon)*
- 🗑️ [Data Retention Policy](./legal/data-retention.md) *(coming soon)*
- ✅ [Acceptable Use Policy](./legal/acceptable-use.md) *(coming soon)*

#### Emergency & Support
- 🚨 [Emergency Procedures](./emergency.md) *(coming soon)*
- 📞 [Support Resources](./support.md) *(coming soon)*

## 🚀 Quick Start

### For Users
1. **Generate a Bookmark Code**: Visit `/register` to create your 16-digit bookmark code
2. **Save It Securely**: Store in a password manager immediately (NO RECOVERY if lost!)
3. **Access Your Work**: Use your code at `/login` to return to saved analyses

### For Developers
1. **Clone the Repository**: `git clone [repo-url]`
2. **Install Dependencies**: `npm install`
3. **Start Development**: `npm run dev` (runs on port 6780)
4. **Read Core Docs**: Start with [Bookmark Authentication](./bookmark-authentication.md)

## 🔑 Key Concepts

### Bookmark vs Account
- **Not an account system** - No user profiles or personal data
- **Bookmark codes** - 16-digit codes to return to your work
- **Privacy-first** - No email, no password, no recovery
- **Like Mullvad VPN** - Inspired by their numbered account approach

### Security Features
- **53.1 bits of entropy** - 9 quadrillion possible combinations
- **Cryptographically secure** - Uses Web Crypto API
- **No weak passwords** - Random generation only
- **No phishing risk** - Nothing personal to steal

## 📋 Documentation Standards

### File Structure
```
docs/
├── README.md                 # This file
├── bookmark-authentication.md # Core auth documentation
├── bookmark-auth-implementation.md # Technical implementation
├── frameworks/              # Framework-specific guides
│   ├── swot-analysis.md
│   ├── ach-framework.md
│   └── ...
├── adr/                    # Architecture Decision Records
│   ├── 001-bookmark-authentication.md
│   └── ...
├── migration/              # Migration guides
│   ├── from-accounts.md
│   └── ...
└── legal/                  # Legal documentation
    ├── terms-of-service.md
    └── ...
```

### Documentation Style Guide

#### Headers
- Use descriptive headers with proper hierarchy
- Include emojis for visual navigation
- Keep headers concise but clear

#### Code Examples
- Provide TypeScript examples where possible
- Include comments explaining key concepts
- Show both good and bad practices

#### Warnings
- Use clear warning boxes for critical information
- Emphasize "NO RECOVERY" for bookmark codes
- Highlight security considerations

#### Links
- Link to related documentation
- Reference external sources (especially Mullvad)
- Keep links up-to-date

## 🤝 Contributing to Documentation

We welcome documentation improvements! Please:

1. **Follow the style guide** above
2. **Keep language clear and concise**
3. **Include practical examples**
4. **Update the index** when adding new docs
5. **Test all code examples**

## 📞 Need Help?

- **Documentation Issues**: Open an issue on GitHub
- **Security Concerns**: See [Emergency Procedures](./emergency.md)
- **General Questions**: Check [User Guide](./user-guide.md) first

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial documentation with bookmark auth |

## 📜 License

This documentation is part of the ResearchTools project and follows the same license terms.

---

*Last Updated: December 2024*  
*Documentation Version: 1.0*