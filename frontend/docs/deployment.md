# Deployment Guide

This guide covers deploying ResearchTools for different use cases and technical expertise levels.

## 📊 Audience Guide

| Your Role | Start Here |
|-----------|------------|
| **Researcher/End User** | Skip to [Quick Deploy with Docker](#quick-deploy-with-docker) |
| **IT Administrator** | Read [Production Deployment](#production-deployment) |
| **Developer/DevOps** | See [Advanced Configuration](#advanced-configuration) |
| **Self-Hosting at Home** | Follow [Simple Self-Hosting](#simple-self-hosting) |

---

## 🚀 Quick Deploy with Docker
*For researchers who want to run locally*

### What You Need
- A computer with 4GB RAM minimum
- Docker Desktop installed ([Download here](https://www.docker.com/products/docker-desktop))

### Three Simple Steps

1. **Download the project**
   ```bash
   git clone https://github.com/[your-org]/researchtoolspy.git
   cd researchtoolspy
   ```

2. **Start the application**
   ```bash
   docker-compose up
   ```

3. **Open in browser**
   - Visit: http://localhost:6780
   - That's it! Start creating analyses

### Stopping the Application
```bash
# Press Ctrl+C in the terminal
# Or run:
docker-compose down
```

---

## 🏠 Simple Self-Hosting
*For personal or small team use*

### Option 1: Using Docker (Recommended)

#### Prerequisites
- Linux server (Ubuntu recommended) or Windows/Mac
- 2GB RAM minimum
- Docker and Docker Compose installed

#### Step-by-Step Setup

1. **Install Docker** (if not installed)
   
   On Ubuntu/Debian:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```
   
   On Windows/Mac: Download Docker Desktop from [docker.com](https://docker.com)

2. **Get the code**
   ```bash
   git clone https://github.com/[your-org]/researchtoolspy.git
   cd researchtoolspy
   ```

3. **Configure environment**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit with your favorite editor (nano, vim, or notepad)
   nano .env
   ```
   
   Basic settings to change:
   ```env
   # Change this to your domain or IP
   NEXT_PUBLIC_APP_URL=http://your-domain.com:6780
   
   # Set to 'production' for live use
   NODE_ENV=production
   
   # Keep port as 6780 or change if needed
   PORT=6780
   ```

4. **Start the application**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. **Access your instance**
   - Local: http://localhost:6780
   - Network: http://[your-ip]:6780

### Option 2: Without Docker

#### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org))
- Git

#### Installation Steps

1. **Clone and enter directory**
   ```bash
   git clone https://github.com/[your-org]/researchtoolspy.git
   cd researchtoolspy/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build for production**
   ```bash
   npm run build
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Keep it running** (Linux/Mac)
   ```bash
   # Install PM2 to keep app running
   npm install -g pm2
   
   # Start with PM2
   pm2 start npm --name "researchtools" -- start
   
   # Auto-start on reboot
   pm2 startup
   pm2 save
   ```

---

## 🏢 Production Deployment
*For IT administrators and organizations*

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4GB | 8GB |
| Storage | 20GB | 50GB SSD |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| Docker | 20.10+ | Latest stable |
| Node.js | 18.0+ | 20.x LTS |

### Security Checklist

- [ ] **HTTPS/SSL configured** (see [SSL Setup](#ssl-setup))
- [ ] **Firewall configured** (only ports 80, 443, 6780 open)
- [ ] **Environment variables secured** (never commit .env)
- [ ] **Rate limiting enabled** (built-in, verify in logs)
- [ ] **Regular backups configured** (see [Backup Strategy](#backup-strategy))
- [ ] **Monitoring setup** (see [Monitoring](#monitoring))
- [ ] **Update schedule defined** (monthly recommended)

### Production Docker Setup

1. **Create production compose file**
   
   Create `docker-compose.prod.yml`:
   ```yaml
   version: '3.8'
   
   services:
     frontend:
       build:
         context: ./frontend
         dockerfile: Dockerfile.prod
       ports:
         - "6780:6780"
       environment:
         - NODE_ENV=production
         - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
       volumes:
         - ./data:/app/data
       restart: unless-stopped
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:6780/api/health"]
         interval: 30s
         timeout: 10s
         retries: 3
   
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf
         - ./ssl:/etc/nginx/ssl
       depends_on:
         - frontend
       restart: unless-stopped
   ```

2. **Configure Nginx reverse proxy**
   
   Create `nginx.conf`:
   ```nginx
   events {
     worker_connections 1024;
   }
   
   http {
     upstream frontend {
       server frontend:6780;
     }
   
     server {
       listen 80;
       server_name your-domain.com;
       return 301 https://$server_name$request_uri;
     }
   
     server {
       listen 443 ssl http2;
       server_name your-domain.com;
   
       ssl_certificate /etc/nginx/ssl/cert.pem;
       ssl_certificate_key /etc/nginx/ssl/key.pem;
       
       # Security headers
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-XSS-Protection "1; mode=block" always;
       add_header Strict-Transport-Security "max-age=31536000" always;
   
       location / {
         proxy_pass http://frontend;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection 'upgrade';
         proxy_set_header Host $host;
         proxy_cache_bypass $http_upgrade;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
       }
     }
   }
   ```

3. **Deploy with Docker Compose**
   ```bash
   # Build and start
   docker-compose -f docker-compose.prod.yml up -d --build
   
   # View logs
   docker-compose -f docker-compose.prod.yml logs -f
   
   # Stop
   docker-compose -f docker-compose.prod.yml down
   ```

### SSL Setup

#### Option 1: Let's Encrypt (Free)

1. **Install Certbot**
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Get certificate**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. **Auto-renewal**
   ```bash
   sudo certbot renew --dry-run
   ```

#### Option 2: Cloudflare (Recommended)

1. Add your domain to Cloudflare
2. Enable "Full (strict)" SSL mode
3. Use Cloudflare's Origin Certificate
4. Enable additional security features (WAF, DDoS protection)

### Backup Strategy

#### What to Backup
Since we use localStorage, backups are client-side. However, for production:

1. **Application data** (if using optional backend)
   ```bash
   # Backup script (backup.sh)
   #!/bin/bash
   BACKUP_DIR="/backups/researchtools"
   DATE=$(date +%Y%m%d_%H%M%S)
   
   # Backup data directory
   tar -czf $BACKUP_DIR/data_$DATE.tar.gz /app/data
   
   # Keep only last 30 days
   find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
   ```

2. **Configuration files**
   - `.env` file
   - `nginx.conf`
   - SSL certificates
   - Docker compose files

3. **Schedule backups**
   ```bash
   # Add to crontab
   0 2 * * * /path/to/backup.sh
   ```

---

## ⚙️ Advanced Configuration
*For developers and DevOps engineers*

### Environment Variables

Complete list of environment variables:

```env
# Application
NODE_ENV=production
PORT=6780
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Security
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
SESSION_TIMEOUT_MS=14400000

# Features
ENABLE_ANALYTICS=false
ENABLE_ERROR_REPORTING=false

# Optional Backend API
API_URL=http://api:8000
API_KEY=your-secret-key

# Storage
MAX_LOCALSTORAGE_MB=10
AUTO_CLEANUP_DAYS=90

# Performance
NEXT_TELEMETRY_DISABLED=1
NEXT_OPTIMIZE_FONTS=true
NEXT_OPTIMIZE_IMAGES=true
```

### Kubernetes Deployment

For large-scale deployments, use our Kubernetes manifests:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: researchtools
spec:
  replicas: 3
  selector:
    matchLabels:
      app: researchtools
  template:
    metadata:
      labels:
        app: researchtools
    spec:
      containers:
      - name: frontend
        image: researchtools:latest
        ports:
        - containerPort: 6780
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 6780
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 6780
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Performance Tuning

#### Node.js Optimization
```javascript
// next.config.js
module.exports = {
  poweredByHeader: false,
  compress: true,
  optimizeFonts: true,
  images: {
    minimumCacheTTL: 60,
  },
  experimental: {
    optimizeCss: true,
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.optimization.minimize = true
    return config
  },
}
```

#### Docker Optimization
```dockerfile
# Multi-stage build for smaller image
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build

EXPOSE 6780
CMD ["npm", "start"]
```

### Monitoring

#### Health Checks
The application provides health endpoints:

- `/api/health` - Basic health check
- `/api/metrics` - Prometheus-compatible metrics

#### Recommended Monitoring Stack

1. **Prometheus** for metrics
2. **Grafana** for visualization
3. **Loki** for log aggregation
4. **Alertmanager** for notifications

Example Prometheus config:
```yaml
scrape_configs:
  - job_name: 'researchtools'
    static_configs:
      - targets: ['localhost:6780']
    metrics_path: '/api/metrics'
    scrape_interval: 30s
```

### Horizontal Scaling

For high availability:

1. **Use Redis for session storage** (if backend added)
2. **Configure load balancer** (HAProxy/Nginx)
3. **Set up database replication** (if using backend)
4. **Enable CDN** for static assets

---

## 🔧 Troubleshooting Deployment

### Common Issues

| Problem | Solution |
|---------|----------|
| Port 6780 already in use | Change PORT in .env or use different port |
| Docker permission denied | Add user to docker group: `sudo usermod -aG docker $USER` |
| Out of memory | Increase Docker memory limit or add swap space |
| SSL certificate errors | Check certificate paths and permissions |
| Slow performance | Enable production mode, add caching headers |

### Debug Mode

Enable debug logging:
```bash
# Set in .env
DEBUG=true
LOG_LEVEL=debug

# Or run with:
DEBUG=true npm start
```

### Getting Help

1. Check logs: `docker-compose logs -f`
2. Verify health: `curl http://localhost:6780/api/health`
3. Review [Troubleshooting Guide](./troubleshooting.md)
4. Open GitHub issue with deployment logs

---

## 📱 Mobile & Tablet Access

The application is fully responsive. For mobile access:

1. Ensure device is on same network
2. Access via: `http://[server-ip]:6780`
3. Add to home screen for app-like experience
4. Works offline after first load (PWA)

---

## 🔄 Updates & Maintenance

### Updating the Application

```bash
# Backup first!
./backup.sh

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```

### Database Migrations
*Only if using optional backend*

```bash
# Run migrations
docker-compose exec api python manage.py migrate
```

### Maintenance Mode

Create `maintenance.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Maintenance</title>
    <style>
        body { 
            font-family: Arial; 
            text-align: center; 
            padding: 50px;
        }
    </style>
</head>
<body>
    <h1>🔧 Under Maintenance</h1>
    <p>We'll be back shortly. Your work is safe!</p>
    <p>Expected return: <strong>[TIME]</strong></p>
</body>
</html>
```

Enable maintenance:
```nginx
# In nginx.conf
location / {
    return 503;
    error_page 503 @maintenance;
}

location @maintenance {
    root /usr/share/nginx/html;
    rewrite ^.*$ /maintenance.html break;
}
```

---

## 🎯 Quick Reference

### Essential Commands

```bash
# Start application
docker-compose up -d

# Stop application
docker-compose down

# View logs
docker-compose logs -f

# Restart application
docker-compose restart

# Update application
git pull && docker-compose up -d --build

# Check status
docker-compose ps

# Enter container
docker-compose exec frontend sh
```

### Important Paths

| Item | Location |
|------|----------|
| Application | `/app` |
| Logs | `/app/logs` |
| Data | `/app/data` |
| Config | `/app/.env` |
| SSL Certs | `/etc/nginx/ssl` |

---

*Last Updated: December 2024*  
*Deployment Guide Version: 1.0*