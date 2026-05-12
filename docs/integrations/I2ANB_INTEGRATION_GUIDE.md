# i2 Analyst's Notebook Integration Guide

## Overview

Research Tools now supports exporting network graphs directly to IBM i2 Analyst's Notebook (ANB), the industry-standard link analysis software used by law enforcement, intelligence agencies, and security professionals worldwide. This integration enables seamless transfer of entity relationship data for advanced investigative analysis, case management, and courtroom presentations.

## What is i2 Analyst's Notebook?

i2 Analyst's Notebook is IBM's premier visual intelligence analysis software used for:
- Law enforcement investigations
- Intelligence analysis and reporting
- Fraud detection and financial crime investigation
- Counter-terrorism and homeland security
- Corporate security and compliance

**Key Features:**
- Timeline analysis with temporal visualization
- Geographic mapping and spatial analysis
- Association matrices and network analysis
- Case management and evidence tracking
- Court-ready reports and presentations

## Quick Start (5 Minutes)

### 1. Export Your Network Graph

1. Navigate to **Network Analysis** in Research Tools
2. Click the **Export** button
3. Select **"i2 Analyst's Notebook"** as the export format
4. Click **Export** - this downloads two CSV files:
   - `i2anb-entities-[timestamp].csv` - Entity data with ANB types
   - `i2anb-links-[timestamp].csv` - Link relationships

### 2. Import into i2 Analyst's Notebook

#### Using Import Wizard (Recommended)

1. Open i2 Analyst's Notebook
2. Create a new chart or open existing one
3. Go to **Tools** → **Import Data** → **Import from Text/CSV**
4. **Import Entities**:
   - Select `i2anb-entities-[timestamp].csv`
   - Configure mapping:
     - **Entity ID**: EntityID
     - **Label**: Label
     - **Entity Type**: EntityType
     - **Icon**: Icon
     - **Custom Properties**: Connections, OriginalType
   - Click **Import**
5. **Import Links**:
   - Select `i2anb-links-[timestamp].csv`
   - Configure mapping:
     - **Link ID**: LinkID
     - **Source ID**: SourceID
     - **Target ID**: TargetID
     - **Link Type**: LinkType
     - **Link Strength**: LinkStrength
     - **Custom Properties**: Confidence, Weight
   - Click **Import**

Your Research Tools entities and relationships now appear in ANB!

### 3. Analyze Your Data

- Apply ANB's **layout algorithms**
- Use **timeline view** for temporal analysis
- Create **association matrices** to identify connections
- Generate **reports** with ANB's reporting tools
- Export for **courtroom presentations**

## Entity Type Mapping

Research Tools entities are mapped to standard i2 ANB entity types:

| Research Tools Type | i2 ANB Type | Icon | Description | Common Uses |
|---------------------|-------------|------|-------------|-------------|
| ACTOR | Person | Person | Individuals, suspects, victims | Criminal investigations, org charts |
| SOURCE | Document | Document | Reports, intel, evidence docs | Evidence tracking, source analysis |
| EVENT | Event | Calendar | Incidents, meetings, activities | Timeline analysis, incident correlation |
| PLACE | Location | Location | Geographic locations, addresses | Geospatial analysis, crime mapping |
| BEHAVIOR | Activity | Activity | Patterns, actions, modus operandi | Behavioral analysis, profiling |
| EVIDENCE | Evidence Item | Evidence | Physical evidence, digital artifacts | Evidence chain of custody, forensics |

### Why This Mapping?

- **Person**: Standard ANB type for individuals and organizations
- **Document**: Traceable artifacts and intelligence sources
- **Event**: Temporal analysis and timeline reconstruction
- **Location**: Geographic analysis and crime mapping
- **Activity**: Behavioral patterns and modus operandi
- **Evidence Item**: Chain of custody and evidence management

## CSV File Format

### Entities CSV (`i2anb-entities-*.csv`)

```csv
"EntityID","Label","EntityType","Icon","Connections","OriginalType"
"actor-001","John Doe","Person","Person",5,"ACTOR"
"place-042","Washington DC","Location","Location",12,"PLACE"
"source-023","Intel Report #42","Document","Document",3,"SOURCE"
```

**Columns:**
- **EntityID**: Unique identifier (required for linking)
- **Label**: Display name on chart
- **EntityType**: ANB entity type (Person, Document, Event, etc.)
- **Icon**: Icon to display (matches EntityType typically)
- **Connections**: Number of connections (for analysis)
- **OriginalType**: Original Research Tools entity type (for reference)

### Links CSV (`i2anb-links-*.csv`)

```csv
"LinkID","SourceID","TargetID","LinkType","LinkStrength","Confidence","Weight"
"link-1","actor-001","source-023","CREATED",5,"CONFIRMED",5
"link-2","place-042","place-101","CONTAINS",8,"PROBABLE",8
```

**Columns:**
- **LinkID**: Unique link identifier
- **SourceID**: Source entity ID (matches EntityID from entities CSV)
- **TargetID**: Target entity ID (matches EntityID from entities CSV)
- **LinkType**: Relationship type (KNOWS, WORKS_AT, CREATED, etc.)
- **LinkStrength**: Numeric weight/strength (1-10)
- **Confidence**: Confidence level (CONFIRMED, PROBABLE, SUSPECTED, UNKNOWN)
- **Weight**: Alternative weight field (same as LinkStrength)

## Common Use Cases

### 1. Criminal Investigation Case Building

**Workflow:**
1. Build investigation network in Research Tools (suspects, victims, evidence)
2. Export to i2 ANB CSV
3. Import into ANB case file
4. Use ANB tools:
   - **Timeline**: Reconstruct sequence of events
   - **Association Matrix**: Identify connections between suspects
   - **Geographic Map**: Plot crime locations
5. Generate court-ready reports with ANB

**Benefit**: Professional law enforcement-grade analysis and reporting

### 2. Counter-Terrorism Intelligence Analysis

**Workflow:**
1. Aggregate intelligence in Research Tools (actors, events, sources)
2. Perform COG analysis to identify key nodes
3. Export COG results to i2 ANB
4. ANB analysis:
   - Identify command and control structures
   - Map operational cells and networks
   - Track communication patterns
   - Temporal analysis of terrorist activities
5. Brief intelligence findings with ANB charts

**Benefit**: Strategic intelligence visualization for decision-makers

### 3. Financial Crime Investigation

**Workflow:**
1. Map financial relationships in Research Tools (entities, transactions, accounts)
2. Export to i2 ANB
3. Use ANB's financial analysis tools:
   - Follow money trails
   - Identify shell companies and beneficial owners
   - Detect unusual transaction patterns
   - Link offshore accounts
4. Build evidence packages for prosecution

**Benefit**: Complex financial network analysis and evidence presentation

### 4. Fraud Detection & Analysis

**Workflow:**
1. Import fraud indicators into Research Tools
2. Build fraud network (perpetrators, victims, methods)
3. Export to i2 ANB
4. ANB pattern analysis:
   - Identify common modus operandi
   - Link related fraud cases
   - Detect organized fraud rings
   - Predict potential targets
5. Generate fraud reports for stakeholders

**Benefit**: Pattern recognition and fraud ring detection

### 5. Corporate Security & Insider Threats

**Workflow:**
1. Map corporate structure in Research Tools (employees, assets, access)
2. Identify risk indicators and anomalies
3. Export to i2 ANB
4. Security analysis:
   - Insider threat detection
   - Access control review
   - Data exfiltration patterns
   - Relationship anomalies
5. Brief security leadership with ANB visualizations

**Benefit**: Insider threat prevention and security posture assessment

## Advanced Techniques

### Timeline Analysis

i2 ANB excels at temporal analysis:

**Preparation in Research Tools:**
1. Ensure events have timestamps
2. Link events to actors and locations
3. Export to i2 ANB

**In i2 ANB:**
1. Open Timeline view
2. Plot events chronologically
3. Filter by entity type (e.g., show only suspect activities)
4. Identify patterns and sequences
5. Generate timeline reports

### Geographic Mapping

For crime mapping and geospatial analysis:

**Preparation in Research Tools:**
1. Geocode locations (add lat/long if available)
2. Link events to locations
3. Export to i2 ANB

**In i2 ANB:**
1. Open Map view
2. Plot entities geographically
3. Analyze spatial patterns:
   - Crime hot spots
   - Territorial boundaries
   - Movement patterns
   - Safe houses and meeting locations

### Association Matrix Analysis

Identify hidden connections:

**In i2 ANB:**
1. Select entities of interest
2. Generate association matrix
3. Analyze:
   - Who knows whom?
   - Shared connections
   - Intermediaries and brokers
   - Network clusters
4. Export matrix to Excel for statistical analysis

### Social Network Analysis

**Preparation in Research Tools:**
1. Build social network (actors + relationships)
2. Calculate centrality metrics (if available)
3. Export to i2 ANB

**In i2 ANB:**
1. Apply centrality algorithms:
   - Degree centrality (most connected)
   - Betweenness centrality (brokers/intermediaries)
   - Closeness centrality (influence)
2. Identify:
   - Leaders and coordinators
   - Information brokers
   - Peripheral members
   - Sub-groups and cliques

## i2 ANB Features to Leverage

### Chart Layouts
- **Standard Layout**: Clear hierarchical view
- **Circular Layout**: Show network density
- **Timeline Layout**: Chronological sequence
- **Geographic Layout**: Spatial distribution
- **Tabular Layout**: Spreadsheet-like view

### Analysis Tools
- **Find Paths**: Shortest path between entities
- **Find Connections**: Common connections
- **Expand Network**: Add connected entities
- **Search and Filter**: Find specific entities/links
- **Conditional Formatting**: Highlight based on properties

### Reporting & Export
- **Briefing Charts**: Simplified views for presentations
- **PDF Reports**: Court-ready documentation
- **PowerPoint Export**: Briefing slides
- **Excel Export**: Data tables for further analysis
- **Image Export**: High-resolution PNG/SVG

### Case Management
- **iBase Integration**: Central intelligence database
- **Analyst's Notebook Premium**: Multi-user collaboration
- **IBM i2 iHub**: Web-based access and sharing
- **Version Control**: Track chart changes over time

## Troubleshooting

### Entities Import But Links Don't Appear

**Issue**: Link IDs don't match Entity IDs

**Fix:**
1. Verify EntityID in entities CSV matches SourceID/TargetID in links CSV
2. Check for typos or case sensitivity
3. Ensure both CSVs imported successfully
4. Re-export from Research Tools if necessary

### Entity Types Not Recognized

**Issue**: i2 ANB doesn't recognize custom entity types

**Fix:**
1. Use standard ANB types (Person, Document, Event, Location, etc.)
2. Create custom entity types in ANB first (Tools → Entity Types → Add)
3. Re-import with custom types configured

### Large Datasets Cause Performance Issues

**Issue**: Charts with 1000+ entities are slow

**Solution:**
- Filter data before export in Research Tools
- Import in phases (core entities first, expand as needed)
- Use i2 ANB Premium (better performance)
- Consider iBase for large-scale data management
- Export subsets for focused analysis

### Unicode Characters Display Incorrectly

**Issue**: Names with special characters (Chinese, Arabic, etc.) don't display properly

**Fix:**
1. Ensure CSV file encoding is UTF-8 with BOM
2. Check i2 ANB language settings
3. Verify font support for special characters
4. Re-export with proper encoding

## Best Practices

### Data Quality
✅ **Verify entity uniqueness** (no duplicate IDs)
✅ **Clean entity labels** (consistent naming)
✅ **Validate links** (ensure source/target entities exist)
✅ **Add metadata** (use Connections and OriginalType fields)

### Import Strategy
✅ **Start small** (import subset first to verify)
✅ **Core entities first** (then expand network)
✅ **Document import settings** (save for repeatability)
✅ **Backup ANB charts** (before major imports)

### Analysis Workflow
✅ **Use layouts strategically** (match layout to analysis goal)
✅ **Apply filters** (reduce noise, focus on relevant data)
✅ **Save views** (document analysis steps)
✅ **Generate reports early** (document findings as you go)

### Security & Compliance
⚠️ **Classified Data**: Follow data handling protocols
⚠️ **Evidence Chain of Custody**: Document all imports
⚠️ **Access Controls**: Limit chart access to authorized personnel
⚠️ **Data Retention**: Follow organizational retention policies
⚠️ **Courtroom Presentation**: Ensure data integrity for legal proceedings

### Collaboration
✅ **Use iBase** for team collaboration
✅ **Export chart packages** for sharing
✅ **Document assumptions** in chart notes
✅ **Version control charts** (save dated copies)

## Limitations & Workarounds

### No Automatic Bi-directional Sync

**Issue**: Changes in ANB don't automatically update Research Tools

**Workaround**:
- **Manual export from ANB** → Import to Research Tools
- **Develop custom integration** using ANB APIs
- **Use iBase as intermediary** (both tools can access)

### Limited Metadata in CSV Format

**Issue**: CSV import doesn't support all ANB entity properties

**Workaround**:
- **Manual property addition** in ANB after import
- **Use ANB's iBase import** for richer data
- **Develop custom XML import** (ANB supports XML with full metadata)

### Geographic Coordinates Not Included

**Issue**: Exported locations don't include lat/long

**Workaround**:
- **Add coordinates in ANB** (right-click entity → Properties → Location)
- **Geocode in Research Tools** before export (future feature)
- **Import from separate geocoded CSV** (add coordinates after import)

## Comparison with Maltego

| Feature | i2 ANB | Maltego |
|---------|--------|---------|
| **Primary Use** | Law enforcement, intelligence | OSINT, threat intelligence |
| **Strengths** | Timeline, reporting, evidence | Transforms, automation, web data |
| **Link Import** | ✅ Yes (via CSV) | ❌ Limited (entities only) |
| **Cost** | $$$$ (Enterprise) | $-$$ (Community to Commercial) |
| **Best For** | Investigations, cases, courtroom | Reconnaissance, OSINT, enrichment |

**Recommendation**:
- Use **i2 ANB** for formal investigations, case management, and courtroom presentations
- Use **Maltego** for OSINT collection, data enrichment, and threat intelligence

## IBM i2 Resources

### Official Documentation
- [i2 Analyst's Notebook User Guide](https://www.ibm.com/docs/en/i2-analysts-notebook)
- [i2 iBase User Guide](https://www.ibm.com/docs/en/i2-ibase)
- [CSV Import Guide](https://www.ibm.com/docs/en/i2-analysts-notebook/9.2.3?topic=data-importing-csv-files)

### Training & Certification
- [IBM i2 Training](https://www.ibm.com/training/i2)
- [i2 Analyst Certification](https://www.ibm.com/training/certification)
- [Law Enforcement Training](https://www.ibm.com/products/i2-analysts-notebook/law-enforcement)

### Community & Support
- [IBM i2 Community](https://community.ibm.com/community/user/i2)
- [i2 Support Portal](https://www.ibm.com/mysupport/)
- [i2 YouTube Channel](https://www.youtube.com/user/IBM i2)

## Related Documentation

- [Network Graph User Guide](./NETWORK_GRAPH.md)
- [Maltego Integration](./MALTEGO_INTEGRATION_GUIDE.md)
- [Gephi Integration](./GEPHI_IMPORT_GUIDE.md)
- [Neo4j Integration](./NEO4J_IMPORT_GUIDE.md)

## Support

### Report Issues
- **GitHub Issues**: [researchtoolspy/issues](https://github.com/gitayam/researchtoolspy/issues)
- **Label**: `i2anb-export`
- **Include**: Sample CSV, ANB version, error message

### Contact
- GitHub: [@gitayam](https://github.com/gitayam)
- Project: [Research Tools](https://github.com/gitayam/researchtoolspy)

---

**Last Updated**: 2025-10-07
**i2 ANB Version Tested**: 9.2+
**Export Format Version**: 1.0.0
