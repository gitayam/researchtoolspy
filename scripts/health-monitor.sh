#!/bin/bash
# Health Monitor Script for Research Tools Platform
# Monitors all critical services and generates alerts

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/research-tools-health.log"
API_ENDPOINT="http://100.107.228.108:8000/api/v1"
FRONTEND_ENDPOINT="http://localhost:6780"
ALERT_THRESHOLD=3  # Number of failures before alerting

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}$(date '+%Y-%m-%d %H:%M:%S'): ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}$(date '+%Y-%m-%d %H:%M:%S'): SUCCESS: $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}$(date '+%Y-%m-%d %H:%M:%S'): WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Health check functions
check_api_health() {
    local endpoint="$API_ENDPOINT/health"
    log "Checking API health at $endpoint"
    
    if curl -f -s --connect-timeout 10 --max-time 30 "$endpoint" > /dev/null 2>&1; then
        log_success "API health check passed"
        return 0
    else
        log_error "API health check failed"
        return 1
    fi
}

check_frontend_health() {
    log "Checking frontend health at $FRONTEND_ENDPOINT"
    
    if curl -f -s --connect-timeout 10 --max-time 30 "$FRONTEND_ENDPOINT" > /dev/null 2>&1; then
        log_success "Frontend health check passed"
        return 0
    else
        log_error "Frontend health check failed (this is expected in production)"
        return 1
    fi
}

check_docker_containers() {
    log "Checking Docker container status"
    
    # Check if we can reach the Docker daemon via SSH
    local containers_running=0
    
    if ssh -o ConnectTimeout=10 root@100.107.228.108 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E '(omnicore-api|omnicore-postgres|omnicore-redis)'" >/dev/null 2>&1; then
        containers_running=$(ssh root@100.107.228.108 "docker ps | grep -E '(omnicore-api|omnicore-postgres|omnicore-redis)' | wc -l")
        
        if [ "$containers_running" -ge 3 ]; then
            log_success "All critical containers are running ($containers_running/3)"
            return 0
        else
            log_error "Only $containers_running/3 critical containers are running"
            return 1
        fi
    else
        log_error "Cannot connect to Docker daemon on Proxmox server"
        return 1
    fi
}

check_database_connectivity() {
    log "Checking database connectivity via API"
    
    local health_response=$(curl -s --connect-timeout 10 --max-time 30 "$API_ENDPOINT/health" 2>/dev/null)
    
    if echo "$health_response" | grep -q '"database".*"healthy"'; then
        log_success "Database connectivity check passed"
        return 0
    else
        log_error "Database connectivity check failed"
        return 1
    fi
}

check_redis_connectivity() {
    log "Checking Redis connectivity via API"
    
    local health_response=$(curl -s --connect-timeout 10 --max-time 30 "$API_ENDPOINT/health" 2>/dev/null)
    
    if echo "$health_response" | grep -q '"redis".*"healthy"'; then
        log_success "Redis connectivity check passed"
        return 0
    else
        log_error "Redis connectivity check failed"
        return 1
    fi
}

check_disk_space() {
    log "Checking disk space on Proxmox server"
    
    local disk_usage=$(ssh root@100.107.228.108 "df -h / | tail -1 | awk '{print \$5}' | sed 's/%//'" 2>/dev/null)
    
    if [ -n "$disk_usage" ] && [ "$disk_usage" -lt 90 ]; then
        log_success "Disk space check passed (${disk_usage}% used)"
        return 0
    elif [ "$disk_usage" -ge 90 ]; then
        log_error "Disk space critical (${disk_usage}% used)"
        return 1
    else
        log_error "Could not check disk space"
        return 1
    fi
}

# Recovery functions
restart_services() {
    log "Attempting to restart services"
    
    if ssh root@100.107.228.108 "cd /home/researchtoolspy && docker-compose restart" >/dev/null 2>&1; then
        log_success "Services restarted successfully"
        sleep 30  # Wait for services to start
        return 0
    else
        log_error "Failed to restart services"
        return 1
    fi
}

# Main health check routine
run_health_checks() {
    local failed_checks=0
    local total_checks=6
    
    log "=== Starting Health Check Cycle ==="
    
    # API Health
    if ! check_api_health; then
        ((failed_checks++))
    fi
    
    # Frontend Health (optional in production)
    if ! check_frontend_health; then
        log_warning "Frontend check failed (may be expected in production)"
    fi
    
    # Docker Containers
    if ! check_docker_containers; then
        ((failed_checks++))
    fi
    
    # Database Connectivity
    if ! check_database_connectivity; then
        ((failed_checks++))
    fi
    
    # Redis Connectivity
    if ! check_redis_connectivity; then
        ((failed_checks++))
    fi
    
    # Disk Space
    if ! check_disk_space; then
        ((failed_checks++))
    fi
    
    # Summary
    local success_rate=$(( (total_checks - failed_checks) * 100 / total_checks ))
    
    if [ "$failed_checks" -eq 0 ]; then
        log_success "All health checks passed (100% success rate)"
        return 0
    elif [ "$failed_checks" -le 2 ]; then
        log_warning "$failed_checks/$total_checks checks failed (${success_rate}% success rate)"
        return 1
    else
        log_error "$failed_checks/$total_checks checks failed (${success_rate}% success rate) - CRITICAL"
        return 2
    fi
}

# Alert function
send_alert() {
    local severity="$1"
    local message="$2"
    
    # For now, just log the alert. In the future, this could send emails, Slack messages, etc.
    case "$severity" in
        "CRITICAL")
            log_error "ALERT: $message"
            ;;
        "WARNING")
            log_warning "ALERT: $message"
            ;;
        "INFO")
            log "ALERT: $message"
            ;;
    esac
}

# Auto-recovery function
attempt_recovery() {
    log "Attempting automatic recovery"
    
    if restart_services; then
        sleep 60  # Wait for services to fully start
        
        if run_health_checks >/dev/null 2>&1; then
            log_success "Automatic recovery successful"
            send_alert "INFO" "Services automatically recovered"
            return 0
        else
            log_error "Automatic recovery failed - manual intervention required"
            send_alert "CRITICAL" "Automatic recovery failed - manual intervention required"
            return 1
        fi
    else
        log_error "Could not restart services"
        send_alert "CRITICAL" "Could not restart services - manual intervention required"
        return 1
    fi
}

# Status report function
generate_status_report() {
    cat << EOF
=== Research Tools Platform Status Report ===
Generated: $(date)

API Endpoint: $API_ENDPOINT
Frontend: $FRONTEND_ENDPOINT

Services Status:
$(ssh root@100.107.228.108 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -4" 2>/dev/null || echo "Cannot connect to Proxmox server")

Recent Logs (last 10 entries):
$(tail -10 "$LOG_FILE" 2>/dev/null || echo "No log file found")

=== End Report ===
EOF
}

# Main execution
main() {
    case "${1:-check}" in
        "check")
            run_health_checks
            exit_code=$?
            
            if [ $exit_code -eq 2 ]; then
                # Critical failure - attempt recovery
                attempt_recovery
            elif [ $exit_code -eq 1 ]; then
                # Minor issues - just alert
                send_alert "WARNING" "Some health checks failed"
            fi
            
            exit $exit_code
            ;;
        "recover")
            attempt_recovery
            ;;
        "report")
            generate_status_report
            ;;
        "monitor")
            log "Starting continuous monitoring (check every 60 seconds)"
            while true; do
                run_health_checks
                sleep 60
            done
            ;;
        *)
            echo "Usage: $0 {check|recover|report|monitor}"
            echo "  check   - Run one-time health check"
            echo "  recover - Attempt service recovery"
            echo "  report  - Generate status report"
            echo "  monitor - Continuous monitoring"
            exit 1
            ;;
    esac
}

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
main "$@"