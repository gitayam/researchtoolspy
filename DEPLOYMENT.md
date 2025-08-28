# ResearchTools Modern Stack Deployment

## 🏗️ Modern Architecture
- **Frontend**: Next.js 15 with TypeScript (port 6780)
- **Backend**: FastAPI with Python (port 8000) 
- **Database**: PostgreSQL 15 (port 5432)
- **Cache**: Redis 7 (port 6379)

## 🚀 Quick Deployment

### 1. Prerequisites
```bash
# Install Docker and Docker Compose
sudo apt update
sudo apt install docker.io docker-compose -y

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Clone and Setup
```bash
# Clone repository
git clone <repository-url> researchtoolspy
cd researchtoolspy

# Ensure .env file exists with all required variables
cat .env
```

### 3. Deploy Modern Stack
```bash
# Remove any legacy containers
docker compose down -v

# Build and start modern stack
docker compose up -d --build

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

### 4. Access Applications

After deployment:

- **🎨 Frontend (Next.js)**: http://localhost:6780
  - Hash-based authentication system
  - Framework analysis tools (ACH, SWOT, COG, PMESII-PT)
  - Modern React interface with dark mode

- **🔧 API (FastAPI)**: http://localhost:8000
  - API documentation: http://localhost:8000/docs
  - Health check: http://localhost:8000/api/v1/health

- **🗄️ Database (PostgreSQL)**: localhost:5432
- **🗃️ Cache (Redis)**: localhost:6379

## 📋 Required Environment Variables

Your `.env` file must contain:

```env
# Django/API Settings
SECRET_KEY=your_secret_key_here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com
CORS_ALLOWED_ORIGINS=http://localhost:6780,https://your-domain.com

# Database Configuration  
POSTGRES_DB=researchtools
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_PORT=5432
POSTGRES_URL=postgresql://postgres:your_secure_password@db:5432/researchtools

# Frontend Configuration
FRONTEND_PORT=6780
NEXT_PUBLIC_API_URL=http://localhost:8000
NODE_ENV=production

# Optional: OpenAI Integration
OPENAI_API_KEY=sk-your-openai-key

# Redis
REDIS_URL=redis://redis:6379/0
```

## 🔧 Troubleshooting

### Service Won't Start
```bash
# Check logs for specific service
docker compose logs frontend
docker compose logs api  
docker compose logs db

# Rebuild specific service
docker compose up -d --build frontend
```

### Database Issues
```bash
# Check PostgreSQL health
docker compose exec db pg_isready -U postgres

# Access database
docker compose exec db psql -U postgres -d researchtools

# Reset database
docker compose down -v
docker volume rm researchtoolspy_postgres_data
docker compose up -d --build
```

### Frontend Build Issues
```bash
# Check Next.js build logs
docker compose logs frontend

# Rebuild frontend only
docker compose up -d --build frontend
```

### API Issues
```bash
# Check FastAPI logs
docker compose logs api

# Test API health
curl http://localhost:8000/api/v1/health

# Restart API service
docker compose restart api
```

## 🌐 Production Deployment

### Security Checklist
- [ ] Change default passwords in `.env`
- [ ] Set `DEBUG=False`
- [ ] Configure proper `ALLOWED_HOSTS`
- [ ] Set up SSL certificates
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable log rotation

### Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Frontend
    location / {
        proxy_pass http://localhost:6780;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker Compose Production Override
Create `docker-compose.prod.yml`:
```yaml
version: '3.8'
services:
  frontend:
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://your-domain.com
      - FRONTEND_PORT=6780
  
  api:
    environment:
      - DEBUG=False
      - ALLOWED_HOSTS=your-domain.com,localhost

  db:
    volumes:
      - /opt/researchtools/postgres:/var/lib/postgresql/data
```

Deploy with:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## 🧹 Cleanup Legacy Components

The following files are no longer used with the modern stack:
- `app.py` (Streamlit legacy)
- Root `Dockerfile` (Streamlit legacy)
- `requirements-*.txt` (Python legacy)
- Any `STREAMLIT_*` environment variables

## 🎯 Features Available

### ✅ Working Features
- **Hash-based Authentication**: Mullvad-style privacy-focused login
- **Framework Analysis Tools**: 
  - ACH (Analysis of Competing Hypotheses)
  - SWOT (Strengths, Weaknesses, Opportunities, Threats)
  - COG (Center of Gravity)
  - PMESII-PT (Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time)
- **Auto-save**: Local storage for anonymous users
- **Export**: PDF and other format exports
- **Dark Mode**: Full dark mode support
- **Responsive Design**: Mobile-friendly interface

### 🚧 In Development
- DOTMLPF framework integration
- Advanced collaboration features
- Real-time analysis sharing

The modern stack provides a complete, production-ready framework analysis platform with no legacy dependencies.