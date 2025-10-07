# Network Analysis with Research Tools Data
# Author: Research Tools Team
# Date: 2025-10-06
# Description: Analyze entity networks exported from Research Tools platform

# Install required packages (run once)
install_packages <- function() {
  if (!require("igraph")) install.packages("igraph")
  if (!require("dplyr")) install.packages("dplyr")
  if (!require("ggplot2")) install.packages("ggplot2")
  if (!require("tidyr")) install.packages("tidyr")
}

# Uncomment to install packages
# install_packages()

# Load required libraries
library(igraph)
library(dplyr)
library(ggplot2)
library(tidyr)

# ============================================================================
# 1. LOAD DATA
# ============================================================================

# Set working directory to where you downloaded the CSV files
# setwd("~/Downloads/")

# Load node and edge data
nodes <- read.csv("network-nodes-2025-10-06.csv",
                  stringsAsFactors = FALSE,
                  encoding = "UTF-8")

edges <- read.csv("network-edges-2025-10-06.csv",
                  stringsAsFactors = FALSE,
                  encoding = "UTF-8")

# Preview data
cat("\n=== NODE DATA PREVIEW ===\n")
head(nodes)
cat("\n=== EDGE DATA PREVIEW ===\n")
head(edges)

# Data summary
cat("\n=== DATA SUMMARY ===\n")
cat("Total nodes:", nrow(nodes), "\n")
cat("Total edges:", nrow(edges), "\n")
cat("Unique entity types:", length(unique(nodes$entity_type)), "\n")
cat("Entity type distribution:\n")
print(table(nodes$entity_type))

# ============================================================================
# 2. CREATE NETWORK GRAPH
# ============================================================================

# Create igraph object from edge list
g <- graph_from_data_frame(
  d = edges[, c("source", "target", "relationship_type", "weight", "confidence")],
  directed = TRUE,
  vertices = nodes
)

# Basic network info
cat("\n=== NETWORK PROPERTIES ===\n")
cat("Network type:", ifelse(is_directed(g), "Directed", "Undirected"), "\n")
cat("Number of vertices:", vcount(g), "\n")
cat("Number of edges:", ecount(g), "\n")
cat("Network density:", edge_density(g), "\n")
cat("Average degree:", mean(degree(g)), "\n")

# ============================================================================
# 3. CENTRALITY METRICS
# ============================================================================

cat("\n=== CALCULATING CENTRALITY METRICS ===\n")

# Degree centrality (number of connections)
nodes$degree <- degree(g, mode = "all")
nodes$in_degree <- degree(g, mode = "in")
nodes$out_degree <- degree(g, mode = "out")

# Betweenness centrality (information broker potential)
nodes$betweenness <- betweenness(g, directed = TRUE, normalized = TRUE)

# Closeness centrality (how quickly information reaches node)
nodes$closeness <- closeness(g, mode = "all", normalized = TRUE)

# Eigenvector centrality (importance based on connections to important nodes)
nodes$eigenvector <- eigen_centrality(g, directed = TRUE)$vector

# PageRank (Google's algorithm for importance)
nodes$pagerank <- page_rank(g)$vector

# Display top 10 most central nodes
cat("\nTop 10 by Degree Centrality:\n")
print(nodes %>%
        arrange(desc(degree)) %>%
        select(name, entity_type, degree, betweenness, pagerank) %>%
        head(10))

cat("\nTop 10 by Betweenness (Information Brokers):\n")
print(nodes %>%
        arrange(desc(betweenness)) %>%
        select(name, entity_type, betweenness, degree) %>%
        head(10))

# ============================================================================
# 4. COMMUNITY DETECTION
# ============================================================================

cat("\n=== COMMUNITY DETECTION ===\n")

# Louvain algorithm (modularity optimization)
communities_louvain <- cluster_louvain(as.undirected(g))
nodes$community_louvain <- membership(communities_louvain)

cat("Number of communities (Louvain):", length(communities_louvain), "\n")
cat("Modularity score:", modularity(communities_louvain), "\n")

# Community sizes
cat("\nCommunity sizes:\n")
print(table(nodes$community_louvain))

# What entity types are in each community?
cat("\nEntity types by community:\n")
community_composition <- nodes %>%
  group_by(community_louvain, entity_type) %>%
  summarise(count = n(), .groups = "drop") %>%
  pivot_wider(names_from = entity_type, values_from = count, values_fill = 0)
print(community_composition)

# ============================================================================
# 5. VISUALIZATIONS
# ============================================================================

cat("\n=== CREATING VISUALIZATIONS ===\n")

# Plot 1: Degree Distribution
p1 <- ggplot(nodes, aes(x = degree)) +
  geom_histogram(binwidth = 1, fill = "steelblue", color = "black", alpha = 0.7) +
  labs(title = "Degree Distribution",
       subtitle = paste("Network with", vcount(g), "nodes"),
       x = "Degree (Number of Connections)",
       y = "Frequency") +
  theme_minimal()

print(p1)
ggsave("degree_distribution.png", p1, width = 8, height = 6)

# Plot 2: Centrality Comparison
centrality_data <- nodes %>%
  select(name, degree, betweenness, closeness, pagerank) %>%
  arrange(desc(pagerank)) %>%
  head(20) %>%
  pivot_longer(cols = c(degree, betweenness, closeness, pagerank),
               names_to = "metric",
               values_to = "value")

p2 <- ggplot(centrality_data, aes(x = reorder(name, value), y = value, fill = metric)) +
  geom_col() +
  facet_wrap(~metric, scales = "free") +
  coord_flip() +
  labs(title = "Top 20 Nodes by Centrality Metrics",
       x = "Node",
       y = "Centrality Value") +
  theme_minimal() +
  theme(legend.position = "none")

print(p2)
ggsave("centrality_comparison.png", p2, width = 12, height = 10)

# Plot 3: Entity Type Distribution
p3 <- ggplot(nodes, aes(x = entity_type, fill = entity_type)) +
  geom_bar() +
  labs(title = "Entity Type Distribution",
       x = "Entity Type",
       y = "Count") +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1)) +
  scale_fill_brewer(palette = "Set2")

print(p3)
ggsave("entity_type_distribution.png", p3, width = 8, height = 6)

# Plot 4: Community Sizes
community_sizes <- data.frame(
  community = as.factor(1:length(communities_louvain)),
  size = sizes(communities_louvain)
)

p4 <- ggplot(community_sizes, aes(x = community, y = size, fill = size)) +
  geom_col() +
  labs(title = "Community Sizes (Louvain Algorithm)",
       x = "Community ID",
       y = "Number of Nodes") +
  theme_minimal() +
  scale_fill_gradient(low = "lightblue", high = "darkblue")

print(p4)
ggsave("community_sizes.png", p4, width = 10, height = 6)

# ============================================================================
# 6. NETWORK GRAPH VISUALIZATION
# ============================================================================

cat("\n=== PLOTTING NETWORK GRAPH ===\n")

# Prepare layout (this may take a while for large networks)
set.seed(42) # For reproducibility
layout <- layout_with_fr(g) # Fruchterman-Reingold layout

# Color nodes by entity type
entity_colors <- c(
  "ACTOR" = "#3b82f6",      # blue
  "SOURCE" = "#8b5cf6",     # purple
  "EVENT" = "#ef4444",      # red
  "PLACE" = "#10b981",      # green
  "BEHAVIOR" = "#f59e0b",   # orange
  "EVIDENCE" = "#6366f1"    # indigo
)
V(g)$color <- entity_colors[V(g)$entity_type]

# Size nodes by degree
V(g)$size <- scales::rescale(degree(g), to = c(3, 15))

# Plot network
png("network_graph.png", width = 1920, height = 1080, res = 150)
plot(g,
     layout = layout,
     vertex.label = ifelse(degree(g) > quantile(degree(g), 0.9), V(g)$name, NA), # Label top 10% nodes
     vertex.label.cex = 0.8,
     vertex.label.color = "black",
     vertex.frame.color = "white",
     edge.arrow.size = 0.3,
     edge.width = 0.5,
     edge.color = "gray70",
     main = "Entity Network Graph")

# Add legend
legend("topright",
       legend = names(entity_colors),
       col = entity_colors,
       pch = 19,
       pt.cex = 1.5,
       cex = 0.8,
       title = "Entity Type")
dev.off()

cat("Network graph saved to: network_graph.png\n")

# ============================================================================
# 7. EXPORT ENHANCED DATA
# ============================================================================

cat("\n=== EXPORTING ENRICHED DATA ===\n")

# Save nodes with centrality metrics
write.csv(nodes, "network_nodes_enriched.csv", row.names = FALSE, fileEncoding = "UTF-8")
cat("Enriched node data saved to: network_nodes_enriched.csv\n")

# Summary report
summary_stats <- data.frame(
  metric = c("Total Nodes", "Total Edges", "Network Density", "Average Degree",
             "Number of Communities", "Modularity", "Max Degree", "Network Diameter"),
  value = c(
    vcount(g),
    ecount(g),
    round(edge_density(g), 4),
    round(mean(degree(g)), 2),
    length(communities_louvain),
    round(modularity(communities_louvain), 4),
    max(degree(g)),
    ifelse(is.connected(g), diameter(g), NA)
  )
)

write.csv(summary_stats, "network_summary.csv", row.names = FALSE)
cat("Network summary saved to: network_summary.csv\n")

# ============================================================================
# 8. ADVANCED ANALYSIS EXAMPLES
# ============================================================================

cat("\n=== ADVANCED ANALYSIS ===\n")

# Find shortest path between two nodes (example: first ACTOR to first SOURCE)
actor_nodes <- V(g)[V(g)$entity_type == "ACTOR"]
source_nodes <- V(g)[V(g)$entity_type == "SOURCE"]

if (length(actor_nodes) > 0 && length(source_nodes) > 0) {
  path <- shortest_paths(g,
                         from = actor_nodes[1],
                         to = source_nodes[1],
                         output = "both")

  if (length(path$vpath[[1]]) > 1) {
    cat("\nShortest path from", V(g)$name[actor_nodes[1]], "to", V(g)$name[source_nodes[1]], ":\n")
    cat("Path length:", length(path$vpath[[1]]) - 1, "steps\n")
    cat("Path:", paste(V(g)$name[path$vpath[[1]]], collapse = " → "), "\n")
  }
}

# K-core decomposition (find densely connected subgraphs)
kcore <- coreness(g)
nodes$kcore <- kcore
cat("\nK-core decomposition:\n")
cat("Max k-core:", max(kcore), "\n")
cat("Nodes in max k-core:", sum(kcore == max(kcore)), "\n")

# Assortativity (do similar nodes connect to each other?)
assortativity_degree <- assortativity_degree(g)
cat("\nDegree assortativity:", round(assortativity_degree, 4), "\n")
cat("Interpretation:", ifelse(assortativity_degree > 0, "Hubs connect to hubs", "Hubs connect to periphery"), "\n")

# ============================================================================
# 9. EXPORT TO OTHER FORMATS
# ============================================================================

cat("\n=== EXPORTING TO OTHER FORMATS ===\n")

# Save as GraphML for other tools (Gephi, Cytoscape)
write_graph(g, "network.graphml", format = "graphml")
cat("GraphML export saved to: network.graphml\n")

# Save as edge list (simple format)
write_graph(g, "network_edgelist.txt", format = "edgelist")
cat("Edge list saved to: network_edgelist.txt\n")

# ============================================================================
# DONE!
# ============================================================================

cat("\n=== ANALYSIS COMPLETE ===\n")
cat("Generated files:\n")
cat("  - degree_distribution.png\n")
cat("  - centrality_comparison.png\n")
cat("  - entity_type_distribution.png\n")
cat("  - community_sizes.png\n")
cat("  - network_graph.png\n")
cat("  - network_nodes_enriched.csv\n")
cat("  - network_summary.csv\n")
cat("  - network.graphml\n")
cat("  - network_edgelist.txt\n")

cat("\nNext steps:\n")
cat("  1. Review the visualizations\n")
cat("  2. Examine network_nodes_enriched.csv for centrality metrics\n")
cat("  3. Investigate communities for operational insights\n")
cat("  4. Use network.graphml in Gephi for interactive exploration\n")
