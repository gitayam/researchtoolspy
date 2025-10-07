# Maltego Integration Guide

## Overview

Research Tools now supports exporting network graphs directly to Maltego, the industry-standard OSINT (Open Source Intelligence) platform for link analysis and data visualization. This integration enables intelligence analysts to leverage Maltego's powerful transform capabilities with Research Tools' entity relationship data.

## What is Maltego?

Maltego is a comprehensive OSINT and graphical link analysis tool used by law enforcement, intelligence agencies, security researchers, and corporations worldwide for:
- Intelligence gathering and link analysis
- Social network analysis and profiling
- Infrastructure mapping and reconnaissance
- Fraud detection and investigation
- Cybersecurity threat intelligence

## Quick Start (5 Minutes)

### 1. Export Your Network Graph

1. Navigate to **Network Analysis** in Research Tools
2. Click the **Export** button
3. Select **"Maltego CSV"** as the export format
4. Click **Export** - this downloads two CSV files:
   - `maltego-entities-[timestamp].csv` - Your entities with Maltego types
   - `maltego-links-[timestamp].csv` - Relationships between entities

### 2. Import into Maltego

1. Open Maltego (Desktop Client)
2. Create a new graph or open existing one
3. Go to **Import** → **Import from File**
4. Select `maltego-entities-[timestamp].csv`
5. Configure import settings:
   - **Entity Type Column**: "Entity Type"
   - **Entity Value Column**: "Entity Value"
   - **Additional Properties**: Select "Weight", "Connections", "Notes"
6. Click **Import**

Your Research Tools entities now appear in Maltego as native entities!

### 3. Work with Your Data

- Run transforms on imported entities
- Expand relationships using Maltego's transform hub
- Apply Maltego's layout algorithms
- Export results back to various formats

## Entity Type Mapping

Research Tools entities are mapped to standard Maltego entity types:

| Research Tools Type | Maltego Type | Description | Use Cases |
|---------------------|--------------|-------------|-----------|
| ACTOR | `maltego.Person` | People, organizations, groups | Social network analysis, org charts |
| SOURCE | `maltego.Document` | Documents, reports, articles | Source tracking, citation analysis |
| EVENT | `maltego.Phrase` | Events, incidents, activities | Timeline analysis, incident correlation |
| PLACE | `maltego.Location` | Geographic locations | Geospatial analysis, territory mapping |
| BEHAVIOR | `maltego.Phrase` | Patterns, behaviors, actions | Behavioral analysis, pattern recognition |
| EVIDENCE | `maltego.Document` | Evidence items, data points | Evidence tracking, chain of custody |

### Why This Mapping?

- **Person**: Natural fit for actors (individuals, organizations)
- **Document**: Ideal for sources and evidence (traceable artifacts)
- **Phrase**: Flexible for abstract concepts (events, behaviors)
- **Location**: Direct mapping for geographic entities
- These are standard Maltego types with broad transform support

## CSV File Format

### Entities CSV (`maltego-entities-*.csv`)

```csv
"Entity Type","Entity Value","Weight","Connections","Notes"
"maltego.Person","John Doe",5,5,"Original Type: ACTOR"
"maltego.Location","Washington DC",12,12,"Original Type: PLACE"
"maltego.Document","Intel Report #42",3,3,"Original Type: SOURCE"
```

**Columns:**
- **Entity Type**: Maltego-compatible entity type (e.g., maltego.Person)
- **Entity Value**: The entity name/identifier (primary value)
- **Weight**: Node weight (connection count from graph)
- **Connections**: Number of connections (for reference)
- **Notes**: Original Research Tools entity type for reference

### Links CSV (`maltego-links-*.csv`)

```csv
"Source","Target","Relationship","Weight","Confidence"
"John Doe","Intel Report #42","CREATED",5,"CONFIRMED"
"Washington DC","Military Base Alpha","CONTAINS",8,"PROBABLE"
```

**Columns:**
- **Source**: Source entity name
- **Target**: Target entity name
- **Relationship**: Relationship type (e.g., KNOWS, WORKS_AT, LOCATED_IN)
- **Weight**: Link strength/importance (1-10)
- **Confidence**: Relationship confidence level

**Note**: Maltego doesn't directly import links from CSV - use this file as reference for manual linking or custom transform development.

## Common Use Cases

### 1. OSINT Investigation Expansion

**Workflow:**
1. Build initial network in Research Tools (actors, sources, events)
2. Export to Maltego CSV
3. Run Maltego transforms to expand intelligence:
   - Person → Email addresses, phone numbers, social media
   - Location → IP ranges, websites hosted, infrastructure
   - Document → Related publications, citations, authors
4. Import enriched data back to Research Tools

**Benefit**: Leverage Maltego's vast transform library (Shodan, Twitter, DNS, WHOIS, etc.)

### 2. Social Network Mapping

**Workflow:**
1. Identify key actors in Research Tools (COG analysis, stakeholder analysis)
2. Export actor network to Maltego
3. Run social media transforms:
   - LinkedIn connections
   - Twitter followers/following
   - Facebook friends
4. Visualize complete social graph in Maltego
5. Export high-value targets back to Research Tools for deeper analysis

**Benefit**: Cross-platform social network reconstruction

### 3. Infrastructure Reconnaissance

**Workflow:**
1. Map target infrastructure in Research Tools (domains, IPs, locations)
2. Export to Maltego as Location and Document entities
3. Run technical transforms:
   - DNS lookups
   - WHOIS data
   - SSL certificate chains
   - IP geolocation
4. Build comprehensive infrastructure map
5. Identify attack surface and vulnerabilities

**Benefit**: Technical reconnaissance with automated data collection

### 4. Threat Intelligence Correlation

**Workflow:**
1. Import IOCs (Indicators of Compromise) into Research Tools
2. Build initial threat actor profile
3. Export to Maltego
4. Run threat intelligence transforms:
   - VirusTotal lookups
   - AlienVault OTX correlation
   - ThreatCrowd pivoting
5. Identify additional IOCs and campaigns
6. Update Research Tools threat database

**Benefit**: Automated threat intelligence enrichment

### 5. Link Analysis for Investigations

**Workflow:**
1. Build case network in Research Tools (suspects, evidence, events)
2. Export to Maltego
3. Apply Maltego's link analysis algorithms:
   - Shortest path between entities
   - Central node identification
   - Cluster detection
4. Generate investigation reports with Maltego's reporting tools
5. Maintain investigation database in Research Tools

**Benefit**: Professional law enforcement-grade link analysis

## Advanced Techniques

### Custom Entity Properties

Research Tools exports additional properties in the "Notes" field:
```
Original Type: ACTOR
```

You can add custom transforms that parse this field to:
- Preserve Research Tools metadata
- Create bidirectional sync workflows
- Maintain entity provenance

### Batch Import Workflow

For large datasets:

```bash
# Export multiple network views
1. Export entire network (all entities)
2. Export by entity type (actors only, sources only)
3. Export by analysis (COG entities, ACH entities)

# Import strategically
1. Import core entities first
2. Run transforms on core entities
3. Import secondary entities
4. Manual linking as needed
```

### Transform Development

Develop custom Maltego transforms to:
- Query Research Tools API directly
- Sync entity updates bidirectionally
- Automate exports on schedule
- Create Research Tools-specific entity types

**Example Use Case**: Create a "ResearchTools.COGAnalysis" entity type that links to specific COG analyses in your database.

## Maltego Features to Leverage

### Layout Algorithms
- **Block Layout**: Group entities by type
- **Circular Layout**: Show network density
- **Hierarchical Layout**: Organizational structures
- **Organic Layout**: Natural force-directed positioning

### Filters and Selections
- Filter by entity type
- Select by property value
- Hide/show specific relationships
- Focus on specific clusters

### Transforms
- **Built-in Transforms**: 100+ free transforms
- **Transform Hub**: Premium transform packs
- **Custom Transforms**: Python/Java SDK for custom transforms

### Reporting
- Generate PDF reports
- Export to various formats (PNG, SVG, GraphML)
- Create presentation-ready graphs
- Document investigation workflows

## Limitations & Workarounds

### Link Import Not Supported

**Issue**: Maltego CSV import only supports entities, not links/relationships

**Workarounds**:
1. **Manual Linking**: Use the exported links CSV as reference for manual connections
2. **Custom Transform**: Develop a Python transform that reads the links CSV and creates connections
3. **GraphML Export**: Use Research Tools' GraphML export instead for full link preservation
4. **Neo4j Bridge**: Import to Neo4j first, then use Maltego's Neo4j connector

### Entity Type Limitations

**Issue**: Some Research Tools entity types don't have direct Maltego equivalents

**Solution**: We map to flexible types like `maltego.Phrase` which accept custom properties and support most transforms

### Bidirectional Sync

**Issue**: Changes in Maltego don't automatically sync back to Research Tools

**Solution**: Export from Maltego → Import to Research Tools as new entities, or develop custom sync transform

## Troubleshooting

### Entities Don't Import

**Check:**
- CSV file encoding (should be UTF-8)
- Entity Type column contains valid Maltego types
- Entity Value column is not empty
- File is not corrupted (open in Excel to verify)

**Fix:**
```bash
# Re-export with correct encoding
1. Export again from Research Tools
2. Open CSV in text editor to verify format
3. Ensure no special characters cause issues
```

### Transforms Don't Work on Imported Entities

**Reason**: Some transforms require specific properties or entity subtype

**Fix:**
1. Check transform requirements in Maltego docs
2. Add properties manually in Maltego
3. Use generic transforms (Google search, Wikipedia, etc.)
4. Convert to different entity type if needed

### Large Graphs Slow to Import

**Solution:**
- Filter network before export (by entity type or date)
- Import in batches (100-500 entities at a time)
- Use Maltego Professional (handles larger graphs)
- Upgrade hardware (SSD, 16GB+ RAM recommended)

## Best Practices

### Data Hygiene
✅ **Clean entity names** before export (remove duplicates)
✅ **Validate relationships** in Research Tools first
✅ **Filter irrelevant entities** to reduce noise
✅ **Use consistent naming conventions**

### Performance Optimization
✅ **Export subsets** for focused analysis (not entire database)
✅ **Use filters** in Maltego to manage large graphs
✅ **Save frequently** (Maltego graphs can be complex)
✅ **Archive old exports** (CSV files are small, keep for reference)

### Security Considerations
⚠️ **Sensitive Data**: Maltego files may contain classified information
⚠️ **Cloud Transforms**: Some transforms send data to third-party APIs
⚠️ **Data Retention**: Follow your organization's data handling policies
⚠️ **Export Controls**: Be aware of intelligence sharing restrictions

### Workflow Integration
✅ **Research Tools = Storage**: Central intelligence repository
✅ **Maltego = Expansion**: OSINT gathering and enrichment
✅ **Research Tools ← Import**: Bring enriched data back for analysis
✅ **Repeat**: Iterative intelligence cycle

## Alternative Approaches

If Maltego doesn't fit your workflow:

### 1. GraphML Export
- Use Research Tools' **GraphML** export instead
- Preserves full link structure
- Import to Gephi, Cytoscape, yEd
- Better for pure network visualization

### 2. Neo4j Integration
- Use Research Tools' **Neo4j Cypher** export
- Full graph database with query capabilities
- Maltego has Neo4j connector (bidirectional sync possible)
- Best for programmatic analysis

### 3. i2 Analyst's Notebook
- Use Research Tools' **i2 ANB** export instead
- Law enforcement-focused analysis tool
- Better for case management and reporting
- See: `docs/I2ANB_INTEGRATION_GUIDE.md`

## Maltego Resources

### Official Documentation
- [Maltego User Guide](https://docs.maltego.com/)
- [Transform Development Guide](https://docs.maltego.com/support/solutions/articles/15000017605)
- [CSV Import Tutorial](https://docs.maltego.com/support/solutions/articles/15000010781)

### Training & Certification
- [Maltego Academy](https://www.maltego.com/maltego-academy/)
- [SANS FOR578: Cyber Threat Intelligence](https://www.sans.org/cyber-security-courses/cyber-threat-intelligence/)
- [Maltego Certification Exam](https://www.maltego.com/certification/)

### Community & Support
- [Maltego Forums](https://www.maltego.com/community/)
- [Transform Hub](https://www.maltego.com/transform-hub/)
- [GitHub: Maltego TRX](https://github.com/Maltego/maltego-trx) (Python SDK)

## Related Documentation

- [Network Graph User Guide](./NETWORK_GRAPH.md)
- [i2 Analyst's Notebook Integration](./I2ANB_INTEGRATION_GUIDE.md)
- [Gephi Integration](./GEPHI_IMPORT_GUIDE.md)
- [Neo4j Integration](./NEO4J_IMPORT_GUIDE.md)

## Support

### Report Issues
- **GitHub Issues**: [researchtoolspy/issues](https://github.com/gitayam/researchtoolspy/issues)
- **Label**: `maltego-export`
- **Include**: Sample CSV, Maltego version, error message

### Contact
- GitHub: [@gitayam](https://github.com/gitayam)
- Project: [Research Tools](https://github.com/gitayam/researchtoolspy)

---

**Last Updated**: 2025-10-07
**Maltego Version Tested**: 4.6+
**Export Format Version**: 1.0.0
