# Time-Series Analysis with Research Tools Data
# Author: Research Tools Team
# Date: 2025-10-06
# Description: Analyze temporal patterns in entity mentions and relationships

# Install required packages (run once)
install_packages <- function() {
  if (!require("dplyr")) install.packages("dplyr")
  if (!require("ggplot2")) install.packages("ggplot2")
  if (!require("tidyr")) install.packages("tidyr")
  if (!require("lubridate")) install.packages("lubridate")
  if (!require("forecast")) install.packages("forecast")
  if (!require("zoo")) install.packages("zoo")
}

# Uncomment to install packages
# install_packages()

# Load required libraries
library(dplyr)
library(ggplot2)
library(tidyr)
library(lubridate)
library(forecast)
library(zoo)

# ============================================================================
# 1. LOAD AND PREPARE DATA
# ============================================================================

cat("\n=== LOADING DATA ===\n")

# Load entity timeline data (you'll need to export this from Research Tools)
# Expected columns: date, entity_id, entity_type, entity_name, mention_count

# For this example, we'll create synthetic data
# In practice, you would load your exported CSV:
# timeline <- read.csv("entity_timeline.csv", stringsAsFactors = FALSE)

# Create example timeline data (remove this and use real data)
set.seed(42)
dates <- seq(as.Date("2025-01-01"), as.Date("2025-10-06"), by = "day")
entities <- c("Russian GRU", "APT28", "Fancy Bear", "Iranian IRGC", "Chinese MSS")

timeline <- expand.grid(
  date = dates,
  entity_name = entities,
  stringsAsFactors = FALSE
) %>%
  mutate(
    entity_type = "ACTOR",
    mention_count = rpois(n(), lambda = sample(2:10, n(), replace = TRUE)),
    date = as.Date(date)
  )

cat("Timeline data loaded:\n")
cat("  Date range:", min(timeline$date), "to", max(timeline$date), "\n")
cat("  Total observations:", nrow(timeline), "\n")
cat("  Unique entities:", length(unique(timeline$entity_name)), "\n")

# ============================================================================
# 2. AGGREGATE BY TIME PERIOD
# ============================================================================

cat("\n=== AGGREGATING DATA ===\n")

# Daily totals
daily_totals <- timeline %>%
  group_by(date) %>%
  summarise(
    total_mentions = sum(mention_count),
    unique_entities = n_distinct(entity_name),
    .groups = "drop"
  )

# Weekly aggregation
weekly_totals <- timeline %>%
  mutate(week = floor_date(date, "week")) %>%
  group_by(week) %>%
  summarise(
    total_mentions = sum(mention_count),
    unique_entities = n_distinct(entity_name),
    .groups = "drop"
  )

# Monthly aggregation
monthly_totals <- timeline %>%
  mutate(month = floor_date(date, "month")) %>%
  group_by(month) %>%
  summarise(
    total_mentions = sum(mention_count),
    unique_entities = n_distinct(entity_name),
    .groups = "drop"
  )

# By entity
entity_totals <- timeline %>%
  group_by(entity_name) %>%
  summarise(
    total_mentions = sum(mention_count),
    avg_daily_mentions = mean(mention_count),
    first_seen = min(date),
    last_seen = max(date),
    days_active = n_distinct(date),
    .groups = "drop"
  ) %>%
  arrange(desc(total_mentions))

cat("\nTop 10 entities by total mentions:\n")
print(head(entity_totals, 10))

# ============================================================================
# 3. TREND VISUALIZATION
# ============================================================================

cat("\n=== CREATING TREND VISUALIZATIONS ===\n")

# Plot 1: Daily mention trends
p1 <- ggplot(daily_totals, aes(x = date, y = total_mentions)) +
  geom_line(color = "steelblue", size = 1) +
  geom_smooth(method = "loess", se = TRUE, color = "darkred", alpha = 0.2) +
  labs(title = "Daily Entity Mentions Over Time",
       subtitle = "With smoothed trend line (LOESS)",
       x = "Date",
       y = "Total Mentions") +
  theme_minimal() +
  theme(plot.title = element_text(face = "bold"))

print(p1)
ggsave("daily_mentions_trend.png", p1, width = 12, height = 6)

# Plot 2: Entity-specific trends (top 5)
top5_entities <- head(entity_totals$entity_name, 5)
top5_data <- timeline %>%
  filter(entity_name %in% top5_entities)

p2 <- ggplot(top5_data, aes(x = date, y = mention_count, color = entity_name)) +
  geom_line(size = 0.8, alpha = 0.7) +
  geom_smooth(method = "loess", se = FALSE, size = 1.2) +
  facet_wrap(~entity_name, ncol = 1, scales = "free_y") +
  labs(title = "Entity-Specific Mention Trends",
       subtitle = "Top 5 entities by total mentions",
       x = "Date",
       y = "Mentions") +
  theme_minimal() +
  theme(legend.position = "none")

print(p2)
ggsave("entity_specific_trends.png", p2, width = 12, height = 10)

# Plot 3: Heatmap of entity activity
p3 <- ggplot(top5_data, aes(x = date, y = entity_name, fill = mention_count)) +
  geom_tile(color = "white") +
  scale_fill_gradient(low = "white", high = "darkblue") +
  labs(title = "Entity Activity Heatmap",
       subtitle = "Darker = more mentions",
       x = "Date",
       y = "Entity",
       fill = "Mentions") +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

print(p3)
ggsave("entity_activity_heatmap.png", p3, width = 14, height = 6)

# ============================================================================
# 4. TIME SERIES DECOMPOSITION
# ============================================================================

cat("\n=== TIME SERIES DECOMPOSITION ===\n")

# Convert to time series object
ts_data <- ts(daily_totals$total_mentions,
              start = c(year(min(daily_totals$date)), yday(min(daily_totals$date))),
              frequency = 365)

# Decompose into trend, seasonal, and random components
decomp <- stl(ts_data, s.window = "periodic")

# Plot decomposition
png("time_series_decomposition.png", width = 1200, height = 800, res = 120)
plot(decomp,
     main = "Time Series Decomposition of Entity Mentions",
     col = "steelblue")
dev.off()

cat("Time series components:\n")
cat("  Trend: Long-term increase or decrease\n")
cat("  Seasonal: Recurring patterns (weekly/monthly)\n")
cat("  Remainder: Random fluctuations\n")

# ============================================================================
# 5. FORECASTING
# ============================================================================

cat("\n=== FORECASTING FUTURE MENTIONS ===\n")

# Fit ARIMA model (automatic parameter selection)
fit_arima <- auto.arima(ts_data)

cat("\nARIMA Model Summary:\n")
print(summary(fit_arima))

# Forecast next 30 days
forecast_arima <- forecast(fit_arima, h = 30)

# Plot forecast
png("forecast_30_days.png", width = 1200, height = 600, res = 120)
plot(forecast_arima,
     main = "30-Day Forecast of Entity Mentions",
     xlab = "Time",
     ylab = "Mentions",
     col = "steelblue",
     fcol = "darkred",
     shadecols = c("lightpink", "mistyrose"))
legend("topleft",
       legend = c("Historical", "Forecast", "80% CI", "95% CI"),
       col = c("steelblue", "darkred", "lightpink", "mistyrose"),
       lty = 1,
       cex = 0.8)
dev.off()

cat("\nForecast summary (next 7 days):\n")
print(head(data.frame(
  day = 1:7,
  forecast = round(forecast_arima$mean[1:7], 1),
  lower_80 = round(forecast_arima$lower[1:7, 1], 1),
  upper_80 = round(forecast_arima$upper[1:7, 1], 1)
), 7))

# ============================================================================
# 6. CHANGE POINT DETECTION
# ============================================================================

cat("\n=== DETECTING SIGNIFICANT CHANGES ===\n")

# Calculate rolling mean and standard deviation
daily_totals <- daily_totals %>%
  mutate(
    ma_7 = rollmean(total_mentions, k = 7, fill = NA, align = "right"),
    ma_30 = rollmean(total_mentions, k = 30, fill = NA, align = "right"),
    sd_7 = rollapply(total_mentions, width = 7, FUN = sd, fill = NA, align = "right")
  )

# Detect anomalies (mentions > 2 standard deviations from 7-day mean)
daily_totals <- daily_totals %>%
  mutate(
    is_anomaly = abs(total_mentions - ma_7) > 2 * sd_7,
    is_anomaly = ifelse(is.na(is_anomaly), FALSE, is_anomaly)
  )

anomalies <- daily_totals %>%
  filter(is_anomaly == TRUE)

cat("\nDetected anomalies (unusual spikes/dips):\n")
cat("  Total anomalies:", nrow(anomalies), "\n")
if (nrow(anomalies) > 0) {
  cat("\nTop 5 anomalous days:\n")
  print(anomalies %>%
          arrange(desc(abs(total_mentions - ma_7))) %>%
          select(date, total_mentions, ma_7) %>%
          head(5))
}

# Plot with anomalies highlighted
p4 <- ggplot(daily_totals, aes(x = date, y = total_mentions)) +
  geom_line(color = "steelblue", alpha = 0.6) +
  geom_line(aes(y = ma_7), color = "darkblue", size = 1) +
  geom_point(data = anomalies, aes(x = date, y = total_mentions),
             color = "red", size = 3, shape = 21, fill = "yellow") +
  labs(title = "Anomaly Detection in Entity Mentions",
       subtitle = "Red points = mentions >2 SD from 7-day moving average",
       x = "Date",
       y = "Total Mentions") +
  theme_minimal()

print(p4)
ggsave("anomaly_detection.png", p4, width = 14, height = 6)

# ============================================================================
# 7. CORRELATION ANALYSIS
# ============================================================================

cat("\n=== ENTITY CORRELATION ANALYSIS ===\n")

# Create wide format (entities as columns, dates as rows)
wide_data <- timeline %>%
  select(date, entity_name, mention_count) %>%
  pivot_wider(names_from = entity_name, values_from = mention_count, values_fill = 0)

# Calculate correlation matrix (excluding date column)
cor_matrix <- cor(wide_data[, -1])

cat("\nTop entity pairs with high correlation:\n")
cor_long <- as.data.frame(as.table(cor_matrix)) %>%
  rename(entity1 = Var1, entity2 = Var2, correlation = Freq) %>%
  filter(entity1 != entity2) %>%
  filter(correlation > 0.7) %>%
  arrange(desc(correlation))

print(head(cor_long, 10))

# Correlation heatmap
library(reshape2)
cor_melted <- melt(cor_matrix)

p5 <- ggplot(cor_melted, aes(Var1, Var2, fill = value)) +
  geom_tile(color = "white") +
  scale_fill_gradient2(low = "blue", high = "red", mid = "white",
                       midpoint = 0, limit = c(-1, 1)) +
  labs(title = "Entity Mention Correlation Matrix",
       x = "", y = "", fill = "Correlation") +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

print(p5)
ggsave("correlation_matrix.png", p5, width = 10, height = 10)

# ============================================================================
# 8. EXPORT RESULTS
# ============================================================================

cat("\n=== EXPORTING RESULTS ===\n")

# Save forecast
forecast_df <- data.frame(
  date = seq(max(daily_totals$date) + 1, by = "day", length.out = 30),
  forecast = as.numeric(forecast_arima$mean),
  lower_80 = as.numeric(forecast_arima$lower[, 1]),
  upper_80 = as.numeric(forecast_arima$upper[, 1]),
  lower_95 = as.numeric(forecast_arima$lower[, 2]),
  upper_95 = as.numeric(forecast_arima$upper[, 2])
)

write.csv(forecast_df, "forecast_30_days.csv", row.names = FALSE)
cat("Forecast saved to: forecast_30_days.csv\n")

# Save anomalies
if (nrow(anomalies) > 0) {
  write.csv(anomalies, "detected_anomalies.csv", row.names = FALSE)
  cat("Anomalies saved to: detected_anomalies.csv\n")
}

# Save entity statistics
write.csv(entity_totals, "entity_statistics.csv", row.names = FALSE)
cat("Entity statistics saved to: entity_statistics.csv\n")

# Summary report
summary_report <- data.frame(
  metric = c(
    "Date Range Start",
    "Date Range End",
    "Total Days",
    "Total Mentions",
    "Average Daily Mentions",
    "Peak Daily Mentions",
    "Unique Entities",
    "Detected Anomalies",
    "Forecast Next 7 Days (avg)"
  ),
  value = c(
    as.character(min(daily_totals$date)),
    as.character(max(daily_totals$date)),
    nrow(daily_totals),
    sum(daily_totals$total_mentions),
    round(mean(daily_totals$total_mentions), 1),
    max(daily_totals$total_mentions),
    length(unique(timeline$entity_name)),
    nrow(anomalies),
    round(mean(forecast_df$forecast[1:7]), 1)
  )
)

write.csv(summary_report, "time_series_summary.csv", row.names = FALSE)
cat("Summary report saved to: time_series_summary.csv\n")

# ============================================================================
# DONE!
# ============================================================================

cat("\n=== ANALYSIS COMPLETE ===\n")
cat("Generated files:\n")
cat("  - daily_mentions_trend.png\n")
cat("  - entity_specific_trends.png\n")
cat("  - entity_activity_heatmap.png\n")
cat("  - time_series_decomposition.png\n")
cat("  - forecast_30_days.png\n")
cat("  - anomaly_detection.png\n")
cat("  - correlation_matrix.png\n")
cat("  - forecast_30_days.csv\n")
cat("  - detected_anomalies.csv\n")
cat("  - entity_statistics.csv\n")
cat("  - time_series_summary.csv\n")

cat("\nKey findings:\n")
cat("  1. Review forecast_30_days.png for predicted mention trends\n")
cat("  2. Investigate anomalies in detected_anomalies.csv\n")
cat("  3. Check correlation_matrix.png for related entities\n")
cat("  4. Use time_series_decomposition.png to understand patterns\n")
