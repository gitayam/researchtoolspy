# Critical Infrastructure Dependencies
*Essential Components for Research Tools Platform Stability*

## 🏗️ Infrastructure Overview

### Current Architecture Status ✅
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│   Next.js       │◄──►│   FastAPI        │◄──►│   PostgreSQL    │
│   Port 6780     │    │   Port 8000      │    │   Port 5432     │
│   Local Dev     │    │   Docker/Proxmox │    │   Docker        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌──────────────────┐             │
         └──────────────►│   Redis Cache    │◄────────────┘
                        │   Port 6379      │
                        │   Docker         │
                        └──────────────────┘
```

## 🔧 Core Infrastructure Components

### 1. Proxmox Virtualization Platform
**Server**: 100.107.228.108
**Role**: Host for all containerized services
**Status**: ✅ Active and Healthy

**Critical Dependencies:**
- Hardware: Enterprise-grade virtualization server
- Network: Stable network connectivity
- Storage: High-performance storage for VM images and data
- Backup: VM snapshot capabilities

**Monitoring Requirements:**
```bash
# Check Proxmox node status
pvecm status
pvesh get /nodes/proxmox/status

# Monitor resource usage
pvesh get /nodes/proxmox/status
```

### 2. Docker Infrastructure
**Purpose**: Container orchestration for backend services
**Status**: ✅ Running with docker-compose

**Critical Components:**
```yaml
services:
  omnicore-api:
    image: api_api:latest
    ports: ["8000:8000"]
    restart: always
    
  omnicore-postgres:
    image: postgres:15
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]
    
  omnicore-redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]
    
  omnicore-celery:
    image: api_celery:latest
    depends_on: [postgres, redis]
```

**Health Check Commands:**
```bash
# Container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Resource usage
docker stats --no-stream

# Container logs
docker logs omnicore-api --tail 50
docker logs omnicore-postgres --tail 50
```

### 3. Network Configuration
**Frontend to Backend Communication:**
- Frontend: `http://localhost:6780` (development)
- Backend API: `http://localhost:8000/api/v1` (proxied to Proxmox)
- Environment Variable: `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`

**Internal Docker Network:**
- Network: `api_omnicore-network`
- PostgreSQL: `postgres:5432` (internal)
- Redis: `redis:6379` (internal)
- API: `api:8000` (internal)

## 💾 Data Storage Dependencies

### 1. PostgreSQL Database
**Version**: PostgreSQL 15
**Container**: `omnicore-postgres`
**Port**: 5432 (internal), mapped externally
**Volume**: `api_postgres_data` (persistent)

**Critical Data:**
- User accounts and hash authentication
- Analysis framework data (SWOT, ACH, COG, etc.)
- Research tool configurations
- Session and authentication tokens

**Backup Strategy:**
```bash
# Automated daily backup
docker exec omnicore-postgres pg_dump -U postgres researchtoolsdb > backup_$(date +%Y%m%d).sql

# Backup verification
psql -h localhost -U postgres -d researchtoolsdb -c "SELECT COUNT(*) FROM users;"
```

### 2. Redis Cache
**Version**: Redis 7-alpine
**Container**: `omnicore-redis`
**Port**: 6379 (internal)
**Volume**: `api_redis_data` (persistent)

**Cached Data:**
- User sessions
- API response cache
- Rate limiting counters
- Temporary analysis data

**Cache Monitoring:**
```bash
# Redis health check
docker exec omnicore-redis redis-cli ping

# Cache statistics
docker exec omnicore-redis redis-cli info memory
docker exec omnicore-redis redis-cli info stats
```

### 3. File System Dependencies
**Frontend Static Assets:**
- Location: `/Users/sac/Git/researchtoolspy/frontend/`
- Built assets: `.next/` directory
- Configuration: `.env.local`

**Backend Application:**
- Location: `/home/researchtoolspy/api/` (on Proxmox)
- Dependencies: Python packages, requirements.txt
- Configuration: Environment variables in docker-compose

**Log Files:**
- Application logs: Docker container logs
- System logs: Proxmox system logs
- Access logs: Web server logs (if configured)

## 🔗 External Dependencies

### 1. Network Connectivity
**Requirements:**
- Internet access for package downloads
- Local network stability for frontend-backend communication
- DNS resolution for domain names

**Critical Ports:**
- 22: SSH access to Proxmox server
- 8000: Backend API access
- 6780: Frontend development server
- 5432: PostgreSQL (if external access needed)
- 6379: Redis (if external access needed)

### 2. Development Environment
**Local Machine Dependencies:**
- Node.js 18+ for frontend development
- npm/yarn for package management
- Python 3.11+ for backend development (optional local)
- Docker client for container management

**Required Environment Files:**
```bash
# Frontend: /Users/sac/Git/researchtoolspy/frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXTAUTH_SECRET=development_secret_key_change_in_production
NEXTAUTH_URL=http://localhost:6780

# Backend: Already configured in docker-compose.yml
```

## 📊 Performance Dependencies

### 1. Resource Requirements
**Minimum System Resources:**
- RAM: 4GB total (2GB for database, 1GB for API, 1GB for cache)
- CPU: 2 cores minimum for backend processing
- Storage: 20GB for database and application data
- Network: 100Mbps for adequate response times

**Monitoring Thresholds:**
- Memory usage: Alert at 80% utilization
- CPU usage: Alert at 75% sustained load
- Disk usage: Alert at 90% capacity
- Network latency: Alert if > 100ms response time

### 2. Scaling Considerations
**Horizontal Scaling Points:**
- API containers: Can scale to multiple instances behind load balancer
- Database: Read replicas for query scaling
- Redis: Cluster mode for high availability
- Frontend: CDN deployment for global distribution

## 🛡️ Security Dependencies

### 1. Access Control
**SSH Access:**
- Server: 100.107.228.108
- Authentication: SSH keys required
- User: root (current setup)

**Database Security:**
- PostgreSQL user authentication
- Network isolation within Docker
- No external database exposure (currently)

**API Security:**
- Hash-based authentication system
- CORS configuration for frontend access
- Rate limiting (planned)

### 2. Certificate Management
**Current Status:**
- Development: HTTP only
- Production: HTTPS required for production deployment

**SSL/TLS Requirements:**
- Valid certificates for production domain
- Certificate auto-renewal process
- Secure cipher suites configuration

## 🔧 Configuration Management

### 1. Environment Variables
**Critical Configuration:**
```bash
# Backend (docker-compose.yml)
POSTGRES_DB=researchtoolsdb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${SECURE_PASSWORD}
REDIS_URL=redis://redis:6379/0
SECRET_KEY=${GENERATED_SECRET_KEY}

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 2. Service Discovery
**Internal Services:**
- Database: `postgres:5432` (Docker network)
- Cache: `redis:6379` (Docker network)
- API: `api:8000` (Docker network)

**External Services:**
- Frontend: `localhost:6780` (development)
- API: `100.107.228.108:8000` (production)

## 🚨 Failure Points & Mitigation

### 1. Single Points of Failure
**Database Container:**
- Risk: Data loss if container fails
- Mitigation: Automated backups, persistent volumes
- Recovery: Database restore from backup

**Proxmox Server:**
- Risk: Complete service outage
- Mitigation: VM snapshots, off-site backups
- Recovery: VM restoration on backup hardware

**Network Connectivity:**
- Risk: Frontend-backend disconnection
- Mitigation: Circuit breaker pattern, offline mode
- Recovery: Automatic reconnection logic

### 2. Common Failure Scenarios

#### Scenario 1: Database Connection Lost
```bash
# Symptoms
curl http://localhost:8000/api/v1/health
# Returns: {"database": {"status": "unhealthy"}}

# Recovery Steps
1. Check container status: docker ps | grep postgres
2. Check logs: docker logs omnicore-postgres
3. Restart if needed: docker-compose restart postgres
4. Verify health: curl http://localhost:8000/api/v1/health
```

#### Scenario 2: API Container Crash
```bash
# Symptoms
curl http://localhost:8000/api/v1/health
# Returns: Connection refused

# Recovery Steps
1. Check container: docker ps | grep api
2. Check logs: docker logs omnicore-api
3. Restart: docker-compose restart api
4. Monitor: docker logs -f omnicore-api
```

#### Scenario 3: Frontend Build Failure
```bash
# Symptoms
npm run build fails with errors

# Recovery Steps
1. Check environment: cat .env.local
2. Clear cache: rm -rf .next
3. Reinstall deps: rm -rf node_modules && npm install
4. Rebuild: npm run build
```

## 📋 Maintenance Procedures

### 1. Regular Maintenance Tasks
**Daily:**
- Monitor container health
- Check disk space usage
- Review application logs

**Weekly:**
- Database backup verification
- Security updates check
- Performance metrics review

**Monthly:**
- Full system backup
- Dependency updates
- Security audit

### 2. Update Procedures
**Application Updates:**
```bash
# Backend API update
cd /home/researchtoolspy
git pull origin main
docker-compose build api
docker-compose up -d api

# Frontend update (development)
cd /Users/sac/Git/researchtoolspy/frontend
git pull origin main
npm install
npm run build
```

**Infrastructure Updates:**
```bash
# Docker updates
docker-compose pull
docker-compose up -d

# System updates (Proxmox)
apt update && apt upgrade -y
```

## 🎯 Monitoring Integration Points

### 1. Health Check Endpoints
**API Health:**
- Endpoint: `GET /api/v1/health`
- Response: System status, database, cache health
- Frequency: Every 30 seconds

**Database Health:**
- Connection test: PostgreSQL ping
- Query test: Simple SELECT statement
- Performance: Query response time

### 2. Metrics Collection
**Application Metrics:**
- Request count and response times
- Error rates by endpoint
- User authentication success/failure rates

**Infrastructure Metrics:**
- Container CPU and memory usage
- Database connection pool status
- Redis cache hit/miss ratios

## 🚀 Deployment Dependencies

### 1. CI/CD Pipeline Requirements
**Build Dependencies:**
- Node.js 18+ for frontend builds
- Python 3.11+ for backend testing
- Docker for container builds

**Deployment Dependencies:**
- SSH access to Proxmox server
- Docker Compose on target server
- Git repository access

### 2. Environment Promotion
**Development → Staging → Production:**
1. Environment variable management
2. Database migration execution
3. Container image promotion
4. Configuration validation

## 📞 Emergency Contacts & Procedures

### 1. Escalation Path
**Level 1:** Automated recovery scripts
**Level 2:** Manual intervention procedures
**Level 3:** Infrastructure team contact
**Level 4:** Vendor support (if applicable)

### 2. Emergency Recovery
**Quick Recovery Commands:**
```bash
# Full system restart
cd /home/researchtoolspy
docker-compose down && docker-compose up -d

# Database emergency restore
./scripts/emergency-recovery.sh restore

# Application rollback
git checkout HEAD~1
docker-compose build && docker-compose up -d
```

## 🔮 Future Dependencies

### 1. Scaling Requirements
**Load Balancer:** Nginx or Traefik for multi-instance API
**Database Clustering:** PostgreSQL read replicas
**Cache Clustering:** Redis Cluster for high availability
**CDN:** CloudFlare or AWS CloudFront for frontend assets

### 2. Monitoring Enhancement
**Prometheus:** Metrics collection and alerting
**Grafana:** Visualization and dashboards
**ELK Stack:** Log aggregation and analysis
**Uptime Monitoring:** External service monitoring

---

## ✅ Critical Actions Required

1. **Immediate (Next 24 hours):**
   - ✅ Verify all containers are running with restart policies
   - ✅ Confirm backup scripts are executable
   - ✅ Test emergency recovery procedures

2. **Short-term (Next Week):**
   - [ ] Implement automated health monitoring
   - [ ] Set up daily backup verification
   - [ ] Create monitoring dashboard

3. **Medium-term (Next Month):**
   - [ ] Deploy comprehensive monitoring stack
   - [ ] Implement blue-green deployment
   - [ ] Set up external uptime monitoring

This infrastructure documentation provides a complete view of all critical dependencies and ensures the platform can maintain high availability and quick recovery from failures.