# OmniCore API

Modern FastAPI backend for the OmniCore intelligence analysis platform, designed for intel analysts and researchers.

## Features

- **Analysis Frameworks**: SWOT, COG, PMESII-PT, DOTMLPF, ACH, and more
- **AI Integration**: OpenAI GPT assistance for analytical insights
- **Research Tools**: Web scraping, social media analysis, document processing
- **Export Capabilities**: PDF, Word, JSON exports for reports
- **Authentication**: JWT-based authentication with role-based access

## Quick Start

1. Install dependencies:
```bash
pip install -e .
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run the development server:
```bash
uvicorn app.main:app --reload
```

4. Access the API documentation at http://localhost:8000/api/v1/docs

## Development

This project uses modern Python development practices:

- **FastAPI** for the API framework
- **SQLAlchemy 2.0** with async support
- **Pydantic** for data validation
- **pytest** for testing
- **Black** and **Ruff** for code formatting

## Testing

Run tests with:
```bash
pytest tests/ -v
```

## Documentation

API documentation is automatically generated and available at `/api/v1/docs` when running the development server.