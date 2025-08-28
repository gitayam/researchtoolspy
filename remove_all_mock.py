#!/usr/bin/env python3
"""Remove all mock data from frontend pages"""

import os
import re

# List of files to clean
files_to_clean = [
    # Framework pages
    "frontend/src/app/(dashboard)/frameworks/swot/page.tsx",
    "frontend/src/app/(dashboard)/frameworks/cog/page.tsx",
    "frontend/src/app/(dashboard)/frameworks/dime/page.tsx",
    "frontend/src/app/(dashboard)/frameworks/pmesii-pt/page.tsx",
    "frontend/src/app/(dashboard)/frameworks/pest/page.tsx",
    "frontend/src/app/(dashboard)/frameworks/stakeholder/page.tsx",
    "frontend/src/app/(dashboard)/frameworks/surveillance/page.tsx",
    "frontend/src/app/(dashboard)/frameworks/trend/page.tsx",
    "frontend/src/app/(dashboard)/frameworks/vrio/page.tsx",
    "frontend/src/app/(dashboard)/collaboration/page.tsx",
    "frontend/src/app/(dashboard)/evidence/page.tsx",
]

def clean_mock_analyses(file_path):
    """Replace mockAnalyses arrays with empty arrays"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Pattern to match mock analyses arrays
    pattern = r'const mockAnalyses = \[[^\]]*\]'
    replacement = 'const mockAnalyses: any[] = []'
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if new_content != content:
        with open(file_path, 'w') as f:
            f.write(new_content)
        print(f"✅ Cleaned mockAnalyses in {file_path}")
        return True
    return False

def clean_collaboration_page():
    """Clean collaboration page mock data"""
    file_path = "frontend/src/app/(dashboard)/collaboration/page.tsx"
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Replace all mock arrays
    patterns = [
        (r'const mockTeams = \[[^\]]*\]', 'const mockTeams: any[] = []'),
        (r'const mockCollaborators = \[[^\]]*\]', 'const mockCollaborators: any[] = []'),
        (r'const mockSharedAnalyses = \[[^\]]*\]', 'const mockSharedAnalyses: any[] = []'),
        (r'const mockActivity = \[[^\]]*\]', 'const mockActivity: any[] = []'),
    ]
    
    changed = False
    for pattern, replacement in patterns:
        new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        if new_content != content:
            content = new_content
            changed = True
    
    if changed:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"✅ Cleaned collaboration page mock data")

def clean_evidence_page():
    """Clean evidence page mock data"""
    file_path = "frontend/src/app/(dashboard)/evidence/page.tsx"
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Replace mockEvidence
    pattern = r'const mockEvidence: Evidence\[\] = \[[^\]]*\]'
    replacement = 'const mockEvidence: Evidence[] = []'
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    # Update mockStats to empty values
    stats_pattern = r'const mockStats: EvidenceStatistics = \{[^}]*\}'
    stats_replacement = '''const mockStats: EvidenceStatistics = {
  total_count: 0,
  by_type: {
    [EvidenceType.DOCUMENT]: 0,
    [EvidenceType.URL]: 0,
    [EvidenceType.REPORT]: 0,
    [EvidenceType.SOCIAL_MEDIA]: 0,
    [EvidenceType.IMAGE]: 0,
    [EvidenceType.VIDEO]: 0,
    [EvidenceType.EMAIL]: 0,
    [EvidenceType.AUDIO]: 0,
    [EvidenceType.TEXT]: 0,
    [EvidenceType.OTHER]: 0
  },
  by_status: {
    [EvidenceStatus.VERIFIED]: 0,
    [EvidenceStatus.DRAFT]: 0,
    [EvidenceStatus.DISPUTED]: 0,
    [EvidenceStatus.ARCHIVED]: 0
  },
  by_credibility: {
    [CredibilityLevel.VERY_HIGH]: 0,
    [CredibilityLevel.HIGH]: 0,
    [CredibilityLevel.MODERATE]: 0,
    [CredibilityLevel.LOW]: 0,
    [CredibilityLevel.VERY_LOW]: 0,
    [CredibilityLevel.UNKNOWN]: 0
  },
  recent_additions: 0,
  pending_evaluation: 0,
  expiring_soon: 0,
  most_used_tags: [],
  framework_usage: []
}'''
    
    content = re.sub(stats_pattern, stats_replacement, content, flags=re.DOTALL)
    
    with open(file_path, 'w') as f:
        f.write(content)
    print(f"✅ Cleaned evidence page mock data")

def main():
    print("🧹 Cleaning all mock data from frontend pages...\n")
    
    # Clean framework pages
    for file_path in files_to_clean:
        if 'collaboration' in file_path:
            clean_collaboration_page()
        elif 'evidence' in file_path:
            clean_evidence_page()
        elif os.path.exists(file_path):
            clean_mock_analyses(file_path)
    
    print("\n✨ All mock data has been removed!")

if __name__ == "__main__":
    main()