# Gephi Import Guide
**Created**: 2025-10-06
**Tool Version**: Gephi 0.10.x

---

## 📊 Quick Start: Export & Import in 5 Minutes

### Step 1: Export from Research Tools

1. Navigate to **Network Graph** page (`/dashboard/network-graph`)
2. Click the **Export** button (download icon) in the top right
3. In the export dialog, select:
   - **Format**: GEXF (Gephi native format with rich metadata)
   - **OR**: GraphML (universal XML format, also works great)
4. Click **Export**
5. Two files download: `network-graph-YYYY-MM-DD.gexf`

### Step 2: Open in Gephi

1. Download Gephi from https://gephi.org (free, open-source)
2. Launch Gephi
3. Go to **File → Open** (or Ctrl+O)
4. Select your `.gexf` file
5. In the import dialog:
   - **Graph Type**: Directed (recommended) or Undirected
   - **Import as**: New workspace
6. Click **OK**

🎉 **You're done!** Your network is now loaded in Gephi.

---

## 🎨 Recommended Visualization Workflow

### 1. Apply Layout Algorithm

Gephi offers several layout algorithms. For entity networks, we recommend:

#### **ForceAtlas 2** (Best for general networks)
1. Go to **Layout** panel (left side)
2. Select **ForceAtlas 2**
3. Settings:
   - **Scaling**: 10-50 (larger = more spread out)
   - **Gravity**: 1.0-5.0 (higher = more compact)
   - **Prevent Overlap**: ✅ Checked (prevents node collisions)
   - **LinLog mode**: ☑️ Check if you have clusters
4. Click **Run**
5. Let it run for 30-60 seconds
6. Click **Stop** when the layout stabilizes

#### **Fruchterman-Reingold** (Good for small networks <100 nodes)
1. Select **Fruchterman Reingold**
2. **Area**: 10000 (increase for more spacing)
3. **Gravity**: 10.0
4. **Speed**: 1.0
5. Click **Run**, wait 20-30 seconds, **Stop**

#### **Yifan Hu** (Fast, good for large networks)
1. Select **Yifan Hu**
2. Use default settings
3. Click **Run**, wait until convergence, **Stop**

### 2. Customize Node Appearance

Your export already includes color-coded nodes by entity type:

- 🔵 **ACTOR** - Blue (rgb(59, 130, 246))
- 🟣 **SOURCE** - Purple (rgb(139, 92, 246))
- 🔴 **EVENT** - Red (rgb(239, 68, 68))
- 🟢 **PLACE** - Green (rgb(16, 185, 129))
- 🟠 **BEHAVIOR** - Orange (rgb(245, 158, 11))
- 🟤 **EVIDENCE** - Indigo (rgb(99, 102, 241))

**To customize further:**

1. Go to **Appearance** panel (top left)
2. **Nodes** tab
3. **Ranking** or **Partition**:
   - **Color**: By `entity_type` (partition) - Already applied!
   - **Size**: By `connections` (ranking) - Scale by degree
4. Click **Apply**

**Example: Size nodes by connections**
1. Appearance → Nodes → **Ranking**
2. Choose attribute: **connections**
3. Set min size: 5, max size: 50
4. Click **Apply**

### 3. Customize Edge Appearance

Your export includes edge thickness based on confidence:
- **CONFIRMED**: Thick lines (thickness: 3)
- **PROBABLE**: Medium lines (thickness: 2)
- **POSSIBLE/SUSPECTED**: Thin lines (thickness: 1)

**To adjust edge colors:**
1. Appearance → **Edges**
2. **Unique** color (all same) or **Partition** by `confidence`
3. Set colors:
   - CONFIRMED: Black `#000000`
   - PROBABLE: Dark gray `#666666`
   - POSSIBLE: Light gray `#999999`
4. Click **Apply**

### 4. Show/Hide Labels

**Show all labels:**
1. Bottom toolbar → **Text** icon (T)
2. Click to toggle labels on/off

**Show labels for important nodes only:**
1. **Filters** panel (right side)
2. **Attributes → Ranking → connections**
3. Drag to main area
4. Set range (e.g., connections > 5)
5. Click **Filter**
6. Right-click filtered selection → **Select nodes**
7. Show labels for selection only

---

## 📈 Network Analysis Features

### 1. Calculate Network Metrics

**Run Statistics** (right panel):

1. **Average Degree**
   - Click **Run**
   - Shows average connections per node
   - Useful for understanding network density

2. **Network Diameter**
   - Click **Run**
   - Longest shortest path in network
   - Indicates how "spread out" the network is

3. **Modularity** (Community Detection)
   - Click **Run**
   - Algorithm: Resolution = 1.0
   - Detects clusters/communities
   - Creates new attribute: `Modularity Class`

4. **PageRank**
   - Click **Run**
   - Identifies most "important" nodes
   - Useful for finding influential actors

5. **Betweenness Centrality**
   - Click **Run**
   - Finds nodes that bridge communities
   - High betweenness = information brokers

### 2. Color Nodes by Community

After running **Modularity**:

1. Appearance → Nodes → **Partition**
2. Choose: `Modularity Class`
3. **Palette**: Click to choose color scheme
4. Click **Apply**

Now nodes are colored by community membership!

### 3. Find Central Nodes

After running **PageRank** or **Betweenness Centrality**:

1. **Data Laboratory** tab (top)
2. Sort by `PageRank` or `Betweenness Centrality` (click column header)
3. Top 10 nodes = most central/influential

### 4. Filter Network

**Filter by entity type:**
1. Filters → **Attributes → Partition → entity_type**
2. Drag to main area
3. Check/uncheck entity types to show/hide
4. Click **Filter**

**Filter by confidence:**
1. Filters → **Attributes → Partition → confidence**
2. Drag to main area
3. Select confidence levels (CONFIRMED, PROBABLE, etc.)
4. Click **Filter**

**Filter by connection count:**
1. Filters → **Attributes → Ranking → connections**
2. Drag to main area
3. Set range slider (e.g., connections > 3)
4. Click **Filter**

---

## 🔍 Advanced Use Cases

### Use Case 1: Identify Key Actors

**Goal**: Find the most connected actors in the network

1. Run statistics: **PageRank** + **Degree**
2. Go to **Data Laboratory**
3. Filter rows: `entity_type` = "ACTOR"
4. Sort by `PageRank` descending
5. Top 10 = most influential actors

**Visualize:**
- Appearance → Nodes → Size by `PageRank`
- Appearance → Nodes → Color by `entity_type`
- Apply layout: ForceAtlas 2
- Result: Larger nodes = more influential

### Use Case 2: Community Detection

**Goal**: Find clusters of related entities

1. Run statistics: **Modularity** (Resolution: 1.0)
2. Appearance → Nodes → Color by `Modularity Class`
3. Layout: **ForceAtlas 2** with **LinLog mode** ✅
4. Result: Distinct colored clusters

**Interpretation:**
- Each color = one community/cluster
- Entities in same cluster are tightly connected
- Useful for identifying operational cells, media ecosystems, etc.

### Use Case 3: Path Finding

**Goal**: Find shortest path between two entities

1. Click **Shortest Path** tool (toolbar)
2. Click source node
3. Click target node
4. Gephi highlights the path
5. **Path length** shown in window

**Export path:**
- Right-click highlighted path → **Select**
- File → **Export** → Graph file → **GEXF**
- Saves only the path for reporting

### Use Case 4: Temporal Analysis (if using multiple exports)

**Goal**: Show how network evolves over time

1. Export network at Time 1 (e.g., 2025-01-01)
2. Export network at Time 2 (e.g., 2025-10-06)
3. Open both in Gephi (separate workspaces)
4. Compare:
   - Node count changes
   - New relationships formed
   - Communities shifted

**Advanced**: Use Gephi's **Timeline** feature
- Requires GEXF with `<spells>` (future enhancement)
- Shows network animation over time

---

## 📤 Export Visualizations from Gephi

### Export as Image (for reports/presentations)

1. **Preview** tab (top)
2. Click **Refresh** (bottom left)
3. Adjust settings:
   - **Preset**: Default or Publication
   - **Show labels**: Yes/No
   - **Edge thickness**: 1.0-3.0
   - **Node border**: 1.0 (makes nodes pop)
4. **Export**: SVG (vector) or PNG (raster)

**Recommended for:**
- **PowerPoint**: PNG at 1920x1080 or 3840x2160 (4K)
- **Reports**: SVG (scales infinitely)
- **Web**: PNG at 1280x720

### Export as Interactive Web Page

1. Install **Sigma Exporter** plugin:
   - Tools → **Plugins** → Available Plugins → **SigmaExporter**
   - Install and restart Gephi
2. File → **Export** → **Sigma.js template**
3. Choose output folder
4. Opens interactive HTML file in browser

**Features:**
- Zoom and pan
- Search nodes
- Click for details
- Perfect for sharing with non-Gephi users

### Export Back to CSV/JSON

After analysis in Gephi, you can export enriched data:

1. **Data Laboratory** tab
2. **Export table** button (bottom)
3. Choose format: **CSV** or **Excel**
4. Now includes new columns:
   - `Modularity Class` (community)
   - `PageRank` (centrality)
   - `Betweenness Centrality`
   - etc.

Use this enriched CSV for:
- Statistical analysis in R/Python
- Reports with community labels
- Further processing

---

## 🛠️ Troubleshooting

### Problem: Nodes Overlap

**Solution 1: Prevent Overlap**
- Layout: ForceAtlas 2
- Enable **Prevent Overlap** ✅
- Increase **Scaling** (10 → 50)

**Solution 2: Manually Drag**
- Select nodes
- Drag to reposition
- Use **Lock** (pin icon) to fix position

### Problem: Network Too Dense (messy)

**Solution 1: Filter Low-Weight Edges**
1. Filters → **Attributes → Ranking → weight**
2. Set range: weight > 0.5 (adjust threshold)
3. Click **Filter**

**Solution 2: Show Only CONFIRMED Relationships**
1. Filters → **Attributes → Partition → confidence**
2. Select only **CONFIRMED**
3. Click **Filter**

**Solution 3: Focus on Subgraph**
1. Select nodes of interest (Ctrl+Click)
2. Right-click → **Select neighbors**
3. File → **Export** → Save subgraph

### Problem: Labels Unreadable

**Solution 1: Increase Font Size**
1. **Preview** tab → **Settings**
2. **Font size**: 12 → 24 (adjust)

**Solution 2: Show Labels for Large Nodes Only**
1. Filters → **Attributes → Ranking → connections**
2. Range: connections > 5
3. Filter → Select → Show labels for selection

**Solution 3: Abbreviate Labels**
1. **Data Laboratory**
2. Right-click `name` column → **Manipulate**
3. Create abbreviations manually or with formula

### Problem: Can't Open GEXF File

**Error**: "Parsing error" or "Invalid format"

**Solution 1: Try GraphML Instead**
- Export from Research Tools using **GraphML** format
- Open in Gephi (more forgiving parser)

**Solution 2: Validate GEXF**
- Use online validator: https://gephi.org/gexf/validator.html
- Report issues to Research Tools team

**Solution 3: Check Gephi Version**
- Use Gephi 0.10.1+ (latest version)
- Older versions may not support GEXF 1.3

---

## 📚 Additional Resources

### Gephi Documentation
- Official Docs: https://gephi.org/users/
- Tutorials: https://gephi.org/users/tutorial-visualization/
- Forum: https://github.com/gephi/gephi/discussions

### Video Tutorials
- "Gephi Tutorial - Basics" (10 min): https://www.youtube.com/watch?v=GXtbL8avpik
- "Network Visualization with Gephi" (30 min course): https://www.youtube.com/watch?v=PAXy5Urhb-I

### Books
- *Network Graph Analysis and Visualization with Gephi* by Ken Cherven
- *Analyzing Social Networks* by Stephen Borgatti (theory + Gephi examples)

### Research Tools Support
- Feedback: https://github.com/gitayam/researchtoolspy/issues
- Integration Plan: See `EXTERNAL_TOOLS_INTEGRATION_PLAN.md`

---

## 💡 Tips & Best Practices

### Tip 1: Save Your Workspace
- File → **Save As** → `.gephi` file
- Preserves layout, colors, filters
- Reopen anytime to continue work

### Tip 2: Use Presets for Consistency
- Appearance → **Preset** dropdown
- Save custom color/size schemes
- Apply to multiple networks for consistency

### Tip 3: Batch Processing (Advanced)
- Use Gephi **Toolkit** (Java library)
- Automate layout + analysis + export
- See: https://gephi.org/toolkit/

### Tip 4: Combine with R/Python
- Export from Gephi → CSV
- Load in R: `library(igraph)` or `library(network)`
- Load in Python: `import networkx as nx`
- Run statistical tests, machine learning

### Tip 5: Version Control Your Exports
- Name files with dates: `network-2025-10-06.gexf`
- Track changes over time
- Compare network evolution

---

## 🎯 Next Steps

After mastering Gephi basics, consider:

1. **Advanced Layouts**:
   - Circular layout (for hierarchies)
   - Geo layout (if nodes have coordinates)
   - Custom algorithms via plugins

2. **Statistical Analysis**:
   - Ego network analysis
   - K-core decomposition
   - Clustering coefficient

3. **Dynamic Networks**:
   - Time-series network animation
   - Temporal metrics
   - Evolution analysis

4. **Integration**:
   - Export to Neo4j for graph database queries
   - Export to R for statistical modeling
   - Export to D3.js for custom web visualizations

---

**Questions or Issues?**

- Research Tools: Create issue at https://github.com/gitayam/researchtoolspy/issues
- Gephi: Ask in Gephi forums or GitHub discussions

**Happy Network Analysis! 🎉**
