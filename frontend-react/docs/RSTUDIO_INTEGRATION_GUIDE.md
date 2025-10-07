# RStudio Integration Guide
**Created**: 2025-10-06
**RStudio Version**: 2023.12.0+

---

## 📊 Quick Start: Export & Analyze in 10 Minutes

### Step 1: Export from Research Tools

1. Navigate to **Network Graph** page (`/dashboard/network-graph`)
2. Click the **Export** button (download icon)
3. In the export dialog, select:
   - **Format**: CSV Edge List
   - This downloads TWO files:
     - `network-nodes-YYYY-MM-DD.csv` (node attributes)
     - `network-edges-YYYY-MM-DD.csv` (relationships)
4. Click **Export**

### Step 2: Open in RStudio

1. Download RStudio from https://posit.co/download/rstudio-desktop/ (free)
2. Launch RStudio
3. Create new R script: **File → New File → R Script**
4. Save to same folder as your CSV files
5. Set working directory: **Session → Set Working Directory → To Source File Location**

### Step 3: Run Pre-Built Analysis Scripts

We provide two ready-to-use analysis scripts:

#### Option A: Network Analysis Script

```r
# Download the script
download.file(
  "https://raw.githubusercontent.com/gitayam/researchtoolspy/main/frontend-react/docs/r-scripts/network_analysis.R",
  "network_analysis.R"
)

# Run the script
source("network_analysis.R")
```

**What it does**:
- Calculates centrality metrics (degree, betweenness, PageRank)
- Detects communities (Louvain algorithm)
- Creates 5+ visualizations
- Exports enriched data with metrics

#### Option B: Time-Series Analysis Script

```r
# Download the script
download.file(
  "https://raw.githubusercontent.com/gitayam/researchtoolspy/main/frontend-react/docs/r-scripts/time_series_analysis.R",
  "time_series_analysis.R"
)

# Run the script (requires timeline data)
source("time_series_analysis.R")
```

**What it does**:
- Trend analysis and forecasting
- Anomaly detection
- Entity correlation analysis
- Time-series decomposition

🎉 **You're done!** Results appear in your working directory.

---

## 📦 Package Installation

### Required Packages

Before running analysis scripts, install these packages (one-time setup):

```r
# Install core packages
install.packages(c(
  "igraph",      # Network analysis
  "dplyr",       # Data manipulation
  "ggplot2",     # Visualization
  "tidyr",       # Data tidying
  "lubridate",   # Date handling
  "forecast",    # Time-series forecasting
  "zoo"          # Time-series utilities
))
```

### Verify Installation

```r
# Check package versions
sessionInfo()
```

---

## 🔍 Step-by-Step Network Analysis Workflow

### 1. Load Your Data

```r
library(igraph)
library(dplyr)
library(ggplot2)

# Load exported CSV files
nodes <- read.csv("network-nodes-2025-10-06.csv",
                  stringsAsFactors = FALSE,
                  encoding = "UTF-8")

edges <- read.csv("network-edges-2025-10-06.csv",
                  stringsAsFactors = FALSE,
                  encoding = "UTF-8")

# Preview data
head(nodes)
head(edges)

# Summary statistics
cat("Total nodes:", nrow(nodes), "\n")
cat("Total edges:", nrow(edges), "\n")
cat("Entity types:", unique(nodes$entity_type), "\n")
```

### 2. Create Network Graph

```r
# Build igraph object
g <- graph_from_data_frame(
  d = edges[, c("source", "target", "relationship_type", "weight", "confidence")],
  directed = TRUE,
  vertices = nodes
)

# Network properties
cat("Directed:", is_directed(g), "\n")
cat("Vertices:", vcount(g), "\n")
cat("Edges:", ecount(g), "\n")
cat("Density:", edge_density(g), "\n")
```

### 3. Calculate Centrality Metrics

```r
# Degree centrality (connections)
nodes$degree <- degree(g, mode = "all")

# Betweenness centrality (information brokers)
nodes$betweenness <- betweenness(g, directed = TRUE, normalized = TRUE)

# PageRank (importance)
nodes$pagerank <- page_rank(g)$vector

# Top 10 most central nodes
nodes %>%
  arrange(desc(pagerank)) %>%
  select(name, entity_type, degree, betweenness, pagerank) %>%
  head(10)
```

### 4. Community Detection

```r
# Louvain algorithm (finds clusters)
communities <- cluster_louvain(as.undirected(g))
nodes$community <- membership(communities)

cat("Number of communities:", length(communities), "\n")
cat("Modularity:", modularity(communities), "\n")

# Community sizes
table(nodes$community)

# What types of entities are in each community?
nodes %>%
  group_by(community, entity_type) %>%
  summarise(count = n(), .groups = "drop") %>%
  pivot_wider(names_from = entity_type, values_from = count, values_fill = 0)
```

### 5. Visualize Network

```r
# Simple plot
set.seed(42)
plot(g,
     vertex.size = 5,
     vertex.label.cex = 0.7,
     edge.arrow.size = 0.3,
     main = "Entity Network")

# Advanced: Color by entity type
entity_colors <- c(
  "ACTOR" = "#3b82f6",
  "SOURCE" = "#8b5cf6",
  "EVENT" = "#ef4444",
  "PLACE" = "#10b981",
  "BEHAVIOR" = "#f59e0b",
  "EVIDENCE" = "#6366f1"
)

V(g)$color <- entity_colors[V(g)$entity_type]
V(g)$size <- scales::rescale(degree(g), to = c(3, 15))

plot(g,
     layout = layout_with_fr(g),
     vertex.label = NA,
     edge.arrow.size = 0.3,
     main = "Entity Network (Color-coded by Type)")

legend("topright",
       legend = names(entity_colors),
       col = entity_colors,
       pch = 19,
       title = "Entity Type")
```

### 6. Export Results

```r
# Save enriched data
write.csv(nodes, "nodes_with_metrics.csv", row.names = FALSE)

# Create summary report
summary <- data.frame(
  metric = c("Total Nodes", "Total Edges", "Avg Degree", "Communities"),
  value = c(vcount(g), ecount(g), mean(degree(g)), length(communities))
)

write.csv(summary, "network_summary.csv", row.names = FALSE)
```

---

## 📈 Common Analysis Tasks

### Task 1: Find Most Important Nodes

**Question**: Who are the key actors in the network?

```r
# Rank by PageRank
key_actors <- nodes %>%
  filter(entity_type == "ACTOR") %>%
  arrange(desc(pagerank)) %>%
  select(name, degree, betweenness, pagerank) %>%
  head(10)

print(key_actors)

# Visualize
ggplot(key_actors, aes(x = reorder(name, pagerank), y = pagerank)) +
  geom_col(fill = "steelblue") +
  coord_flip() +
  labs(title = "Top 10 Actors by PageRank",
       x = "Actor",
       y = "PageRank Score") +
  theme_minimal()
```

**Output**: List of most influential actors with quantitative scores.

---

### Task 2: Identify Information Brokers

**Question**: Which nodes bridge different communities?

```r
# Nodes with high betweenness
brokers <- nodes %>%
  arrange(desc(betweenness)) %>%
  select(name, entity_type, community, betweenness) %>%
  head(15)

print(brokers)

# These nodes connect disparate parts of the network
# Removing them could fragment the network
```

**Interpretation**: High betweenness = critical connectors. Targeting these can disrupt information flow.

---

### Task 3: Detect Operational Cells

**Question**: Are there distinct groups of related entities?

```r
# Run multiple community detection algorithms
comm_louvain <- cluster_louvain(as.undirected(g))
comm_walktrap <- cluster_walktrap(as.undirected(g))
comm_infomap <- cluster_infomap(as.undirected(g))

# Compare results
cat("Louvain communities:", length(comm_louvain), "\n")
cat("Walktrap communities:", length(comm_walktrap), "\n")
cat("Infomap communities:", length(comm_infomap), "\n")

# Which algorithm gives best modularity?
cat("Modularity (Louvain):", modularity(comm_louvain), "\n")
cat("Modularity (Walktrap):", modularity(comm_walktrap), "\n")
cat("Modularity (Infomap):", modularity(comm_infomap), "\n")

# Use the best one
# Plot network colored by community
V(g)$community <- membership(comm_louvain)
plot(g,
     vertex.color = V(g)$community,
     vertex.label = NA,
     main = "Network Communities (Louvain)")
```

**Output**: Identification of operational cells, influence networks, or functional groups.

---

### Task 4: Find Shortest Path

**Question**: How is Actor X connected to Source Y?

```r
# Example: Path from first ACTOR to first SOURCE
actor_nodes <- V(g)[V(g)$entity_type == "ACTOR"]
source_nodes <- V(g)[V(g)$entity_type == "SOURCE"]

path <- shortest_paths(g,
                       from = actor_nodes[1],
                       to = source_nodes[1],
                       output = "both")

# Path details
cat("Path length:", length(path$vpath[[1]]) - 1, "hops\n")
cat("Path:", paste(V(g)$name[path$vpath[[1]]], collapse = " → "), "\n")

# Relationships in the path
if (length(path$epath[[1]]) > 0) {
  path_edges <- E(g)[path$epath[[1]]]
  cat("\nRelationship types along path:\n")
  print(path_edges$relationship_type)
}
```

**Use case**: Understanding connection chains for targeting or assessment.

---

### Task 5: Compare Entity Types

**Question**: Do different entity types have different network roles?

```r
# Calculate metrics by entity type
type_summary <- nodes %>%
  group_by(entity_type) %>%
  summarise(
    count = n(),
    avg_degree = mean(degree),
    avg_betweenness = mean(betweenness),
    avg_pagerank = mean(pagerank),
    .groups = "drop"
  )

print(type_summary)

# Visualize
ggplot(type_summary, aes(x = entity_type, y = avg_degree, fill = entity_type)) +
  geom_col() +
  labs(title = "Average Degree by Entity Type",
       x = "Entity Type",
       y = "Average Degree") +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))
```

**Interpretation**: Identifies which entity types are most connected.

---

## 📊 Time-Series Analysis Workflows

### Workflow 1: Trend Analysis

```r
library(lubridate)
library(forecast)

# Load timeline data (export from Research Tools)
timeline <- read.csv("entity_timeline.csv")
timeline$date <- as.Date(timeline$date)

# Aggregate by day
daily <- timeline %>%
  group_by(date) %>%
  summarise(total_mentions = sum(mention_count), .groups = "drop")

# Plot trend
ggplot(daily, aes(x = date, y = total_mentions)) +
  geom_line(color = "steelblue") +
  geom_smooth(method = "loess", color = "red", se = TRUE) +
  labs(title = "Entity Mention Trends Over Time",
       x = "Date",
       y = "Total Mentions") +
  theme_minimal()
```

---

### Workflow 2: Forecasting

```r
# Convert to time series
ts_data <- ts(daily$total_mentions, frequency = 7) # Weekly seasonality

# Fit model
fit <- auto.arima(ts_data)

# Forecast next 14 days
forecast_result <- forecast(fit, h = 14)

# Plot
plot(forecast_result,
     main = "14-Day Forecast of Entity Mentions",
     xlab = "Time",
     ylab = "Mentions")

# Extract forecast values
forecast_df <- data.frame(
  day = 1:14,
  forecast = as.numeric(forecast_result$mean),
  lower_80 = as.numeric(forecast_result$lower[, 1]),
  upper_80 = as.numeric(forecast_result$upper[, 1])
)

print(forecast_df)
```

---

### Workflow 3: Anomaly Detection

```r
library(zoo)

# Calculate rolling statistics
daily <- daily %>%
  mutate(
    ma_7 = rollmean(total_mentions, k = 7, fill = NA, align = "right"),
    sd_7 = rollapply(total_mentions, width = 7, FUN = sd, fill = NA, align = "right")
  )

# Detect anomalies (>2 SD from mean)
daily <- daily %>%
  mutate(
    is_anomaly = abs(total_mentions - ma_7) > 2 * sd_7,
    is_anomaly = ifelse(is.na(is_anomaly), FALSE, is_anomaly)
  )

# Find anomalous days
anomalies <- daily %>% filter(is_anomaly == TRUE)

cat("Detected", nrow(anomalies), "anomalous days\n")
print(anomalies %>% select(date, total_mentions, ma_7))

# Plot with anomalies highlighted
ggplot(daily, aes(x = date, y = total_mentions)) +
  geom_line(color = "steelblue") +
  geom_point(data = anomalies, color = "red", size = 3) +
  geom_line(aes(y = ma_7), color = "darkblue", linetype = "dashed") +
  labs(title = "Anomaly Detection",
       subtitle = "Red points = unusual spikes/dips",
       x = "Date",
       y = "Mentions") +
  theme_minimal()
```

---

## 🛠️ Troubleshooting

### Problem: "Package not found"

**Solution**:
```r
# Install missing package
install.packages("package_name")

# Or install all at once
install.packages(c("igraph", "dplyr", "ggplot2", "tidyr", "forecast"))
```

---

### Problem: "Cannot read CSV file"

**Error**: `Error in file(file, "rt") : cannot open the connection`

**Solution**:
```r
# Check working directory
getwd()

# List files in directory
list.files()

# Set correct directory
setwd("~/Downloads/")

# Use full file path
nodes <- read.csv("/Users/yourname/Downloads/network-nodes-2025-10-06.csv")
```

---

### Problem: "Graph is empty" or "No edges"

**Solution**:
```r
# Check data loaded correctly
cat("Nodes:", nrow(nodes), "\n")
cat("Edges:", nrow(edges), "\n")

# Check column names match
colnames(edges)
# Should have: source, target, relationship_type, weight, confidence

# Recreate graph with explicit columns
g <- graph_from_data_frame(
  d = edges[, c("source", "target")],  # Minimum required
  directed = TRUE,
  vertices = nodes
)
```

---

### Problem: "Layout takes too long"

**For large networks (>1000 nodes)**:

```r
# Use faster layout algorithms
layout <- layout_with_drl(g)        # Fast for large graphs
layout <- layout_with_kk(g)         # Kamada-Kawai (medium speed)

# Or simplify graph first
g_simple <- simplify(g, remove.multiple = TRUE, remove.loops = TRUE)

# Filter to top nodes only
top_nodes <- V(g)[degree(g) > quantile(degree(g), 0.8)]
g_subset <- induced_subgraph(g, top_nodes)
plot(g_subset)
```

---

## 📚 Additional Resources

### Official Documentation
- **igraph**: https://igraph.org/r/
- **dplyr**: https://dplyr.tidyverse.org/
- **ggplot2**: https://ggplot2.tidyverse.org/
- **forecast**: https://pkg.robjhyndman.com/forecast/

### Books
- *R for Data Science* by Hadley Wickham (free online)
- *Statistical Analysis of Network Data with R* by Eric D. Kolaczyk
- *Forecasting: Principles and Practice* by Rob Hyndman (free online)

### Online Courses
- DataCamp: "Network Analysis in R"
- Coursera: "Social and Economic Networks: Models and Analysis"
- YouTube: "igraph Tutorial" by Katya Ognyanova

### Research Tools Support
- GitHub Issues: https://github.com/gitayam/researchtoolspy/issues
- Integration Plan: See `EXTERNAL_TOOLS_INTEGRATION_PLAN.md`

---

## 💡 Tips & Best Practices

### Tip 1: Save Your Workspace

```r
# Save all variables and objects
save.image("my_analysis.RData")

# Load later
load("my_analysis.RData")

# Or save specific objects
save(g, nodes, edges, file = "network_data.RData")
```

---

### Tip 2: Create Reproducible Scripts

Always include:

```r
# Header comment with metadata
# Title: Network Analysis of XYZ Operation
# Author: Your Name
# Date: 2025-10-06
# Data source: Research Tools export

# Set seed for reproducibility
set.seed(42)

# Load libraries
library(igraph)
library(dplyr)

# Document data sources
cat("Data files:\n")
cat("  Nodes:", "network-nodes-2025-10-06.csv", "\n")
cat("  Edges:", "network-edges-2025-10-06.csv", "\n")
```

---

### Tip 3: Export High-Quality Plots

```r
# For reports (PNG)
png("my_plot.png", width = 1920, height = 1080, res = 150)
plot(g)
dev.off()

# For presentations (PDF - vector graphics)
pdf("my_plot.pdf", width = 10, height = 8)
plot(g)
dev.off()

# For publication (TIFF)
tiff("my_plot.tiff", width = 3000, height = 2400, res = 300, compression = "lzw")
plot(g)
dev.off()
```

---

### Tip 4: Batch Process Multiple Networks

```r
# Analyze multiple exported files at once
files <- list.files(pattern = "network-nodes-.*\\.csv")

results <- lapply(files, function(file) {
  nodes <- read.csv(file)
  edges <- read.csv(gsub("nodes", "edges", file))

  g <- graph_from_data_frame(edges, directed = TRUE, vertices = nodes)

  data.frame(
    file = file,
    nodes = vcount(g),
    edges = ecount(g),
    density = edge_density(g),
    avg_degree = mean(degree(g))
  )
})

results_df <- do.call(rbind, results)
print(results_df)
```

---

### Tip 5: Combine with Other Tools

**Export to Gephi from R**:
```r
write_graph(g, "network.graphml", format = "graphml")
# Open network.graphml in Gephi for interactive visualization
```

**Export to Python/NetworkX**:
```r
write_graph(g, "network.gml", format = "gml")
# Load in Python: nx.read_gml("network.gml")
```

---

## 🎯 Next Steps

After mastering RStudio basics, consider:

1. **Machine Learning on Networks**:
   - Node classification (predict entity types)
   - Link prediction (forecast future relationships)
   - Anomaly detection (identify unusual entities)

2. **Advanced Visualization**:
   - Interactive networks with `visNetwork` package
   - 3D networks with `networkD3`
   - Animated networks over time

3. **Integration with Other Data**:
   - Merge network data with external databases
   - Geo-spatial analysis (if entities have locations)
   - Sentiment analysis of linked content

4. **Automated Reporting**:
   - R Markdown for automated reports
   - Shiny apps for interactive dashboards
   - Scheduled analysis with cron/Task Scheduler

---

**Questions or Issues?**

- Research Tools: https://github.com/gitayam/researchtoolspy/issues
- R Help: `?function_name` or `help(package_name)`
- Stack Overflow: Tag questions with `[r]` and `[igraph]`

**Happy Statistical Analysis! 📊**
