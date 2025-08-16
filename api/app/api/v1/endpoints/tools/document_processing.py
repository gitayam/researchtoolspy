"""
Document processing API endpoints for file analysis and conversion.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import os
import hashlib
from datetime import datetime
from enum import Enum
from pathlib import Path

from app.core.database import get_async_db
from app.core.auth import get_current_user
from app.core.logging import get_logger
from app.models.user import User
from app.models.research_tool import ResearchJob, ResearchJobStatus, ResearchJobType

logger = get_logger(__name__)

router = APIRouter()

# Enums and Models
class DocumentType(str, Enum):
    """Supported document types."""
    PDF = "pdf"
    DOCX = "docx"
    DOC = "doc"
    TXT = "txt"
    RTF = "rtf"
    HTML = "html"
    MARKDOWN = "md"
    CSV = "csv"
    XLSX = "xlsx"
    XLS = "xls"
    PPTX = "pptx"
    PPT = "ppt"


class ProcessingTask(str, Enum):
    """Document processing tasks."""
    EXTRACT_TEXT = "extract_text"
    EXTRACT_METADATA = "extract_metadata"
    CONVERT_FORMAT = "convert_format"
    ANALYZE_CONTENT = "analyze_content"
    GENERATE_SUMMARY = "generate_summary"
    EXTRACT_ENTITIES = "extract_entities"
    CLASSIFY_DOCUMENT = "classify_document"


class DocumentProcessingRequest(BaseModel):
    """Request model for document processing."""
    tasks: List[ProcessingTask]
    convert_to: Optional[DocumentType] = None
    extract_images: bool = False
    preserve_formatting: bool = True
    language: Optional[str] = "auto"
    analysis_options: Optional[Dict[str, Any]] = {}
    
    @validator('tasks')
    def validate_tasks(cls, v):
        """Validate processing tasks."""
        if not v:
            raise ValueError("At least one processing task is required")
        if ProcessingTask.CONVERT_FORMAT in v and len(v) == 1:
            raise ValueError("Convert format requires convert_to parameter")
        return v


class DocumentUploadResponse(BaseModel):
    """Response model for document upload."""
    file_id: str
    filename: str
    file_size: int
    file_type: str
    uploaded_at: datetime
    
    class Config:
        from_attributes = True


class DocumentProcessingJobResponse(BaseModel):
    """Response model for document processing jobs."""
    job_id: int
    file_id: str
    filename: str
    status: str
    progress_percentage: int
    current_step: Optional[str]
    tasks: List[str]
    started_at: Optional[datetime]
    estimated_completion: Optional[datetime]
    message: str
    
    class Config:
        from_attributes = True


class DocumentAnalysisResult(BaseModel):
    """Response model for document analysis results."""
    file_id: str
    filename: str
    file_type: str
    file_size: int
    processing_tasks: List[str]
    extracted_text: Optional[str]
    metadata: Optional[Dict[str, Any]]
    summary: Optional[str]
    entities: Optional[List[Dict[str, Any]]]
    classification: Optional[Dict[str, Any]]
    converted_files: Optional[List[Dict[str, str]]]
    processing_time: float
    
    class Config:
        from_attributes = True


# Document Processing Service
class DocumentProcessingService:
    """Service for document processing operations."""
    
    def __init__(self):
        self.upload_dir = Path("uploads/documents")
        self.output_dir = Path("uploads/processed")
        
        # Create directories if they don't exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_file_id(self, filename: str, content: bytes) -> str:
        """Generate unique file ID based on content hash."""
        content_hash = hashlib.sha256(content).hexdigest()
        timestamp = int(datetime.utcnow().timestamp())
        return f"{timestamp}_{content_hash[:16]}"
    
    async def save_uploaded_file(self, file: UploadFile) -> tuple[str, Path]:
        """Save uploaded file and return file ID and path."""
        content = await file.read()
        file_id = self.generate_file_id(file.filename, content)
        
        # Determine file extension
        file_extension = Path(file.filename).suffix.lower()
        file_path = self.upload_dir / f"{file_id}{file_extension}"
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(content)
        
        return file_id, file_path
    
    async def extract_text_from_pdf(self, file_path: Path) -> str:
        """Extract text from PDF file."""
        try:
            # Placeholder for PDF text extraction
            # In production, use PyPDF2, pdfplumber, or similar
            return f"Text extracted from PDF: {file_path.name} (PDF processing library required)"
        except Exception as e:
            logger.error(f"Failed to extract text from PDF: {e}")
            raise
    
    async def extract_text_from_docx(self, file_path: Path) -> str:
        """Extract text from DOCX file."""
        try:
            # Placeholder for DOCX text extraction
            # In production, use python-docx
            return f"Text extracted from DOCX: {file_path.name} (python-docx library required)"
        except Exception as e:
            logger.error(f"Failed to extract text from DOCX: {e}")
            raise
    
    async def extract_text_from_txt(self, file_path: Path) -> str:
        """Extract text from TXT file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            # Try different encodings
            for encoding in ['latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        return f.read()
                except UnicodeDecodeError:
                    continue
            raise ValueError("Unable to decode text file")
    
    async def extract_text(self, file_path: Path, file_type: str) -> str:
        """Extract text from document based on file type."""
        file_type = file_type.lower().replace('.', '')
        
        if file_type == 'pdf':
            return await self.extract_text_from_pdf(file_path)
        elif file_type in ['docx', 'doc']:
            return await self.extract_text_from_docx(file_path)
        elif file_type == 'txt':
            return await self.extract_text_from_txt(file_path)
        elif file_type == 'html':
            # Use BeautifulSoup for HTML
            from bs4 import BeautifulSoup
            with open(file_path, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f.read(), 'html.parser')
                return soup.get_text()
        else:
            return f"Text extraction not implemented for {file_type} files"
    
    async def extract_metadata(self, file_path: Path, file_type: str) -> Dict[str, Any]:
        """Extract metadata from document."""
        metadata = {
            "filename": file_path.name,
            "file_size": file_path.stat().st_size,
            "file_type": file_type,
            "created_at": datetime.fromtimestamp(file_path.stat().st_ctime).isoformat(),
            "modified_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
        }
        
        # Add file-type specific metadata
        if file_type.lower() == 'pdf':
            # Placeholder for PDF metadata extraction
            metadata.update({
                "pages": "Unknown (PDF library required)",
                "author": "Unknown",
                "title": "Unknown",
                "subject": "Unknown"
            })
        elif file_type.lower() in ['docx', 'doc']:
            # Placeholder for DOCX metadata extraction
            metadata.update({
                "word_count": "Unknown (python-docx required)",
                "author": "Unknown",
                "title": "Unknown"
            })
        
        return metadata
    
    async def generate_summary(self, text: str, max_length: int = 500) -> str:
        """Generate document summary."""
        # Simple extractive summary - first few sentences
        sentences = text.split('. ')
        
        summary = ""
        for sentence in sentences:
            if len(summary) + len(sentence) < max_length:
                summary += sentence + ". "
            else:
                break
        
        if not summary:
            summary = text[:max_length] + "..." if len(text) > max_length else text
        
        # In production, integrate with AI service for better summarization
        return summary.strip()
    
    async def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract named entities from text."""
        # Placeholder for named entity recognition
        # In production, use spaCy, NLTK, or cloud NER services
        
        # Simple keyword extraction as placeholder
        common_words = set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])
        words = text.split()
        
        # Find capitalized words (potential entities)
        entities = []
        for word in words:
            clean_word = word.strip('.,!?()[]{}":;')
            if (clean_word.istitle() and 
                len(clean_word) > 2 and 
                clean_word.lower() not in common_words):
                entities.append({
                    "text": clean_word,
                    "label": "UNKNOWN",
                    "confidence": 0.5
                })
        
        # Remove duplicates and limit results
        unique_entities = []
        seen = set()
        for entity in entities:
            if entity["text"] not in seen:
                seen.add(entity["text"])
                unique_entities.append(entity)
                if len(unique_entities) >= 20:  # Limit to top 20
                    break
        
        return unique_entities
    
    async def classify_document(self, text: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Classify document type and content."""
        # Simple rule-based classification
        text_lower = text.lower()
        
        # Document type classification
        if any(word in text_lower for word in ['report', 'analysis', 'findings', 'conclusion']):
            doc_type = "report"
        elif any(word in text_lower for word in ['memo', 'memorandum', 'from:', 'to:']):
            doc_type = "memo"
        elif any(word in text_lower for word in ['contract', 'agreement', 'terms', 'conditions']):
            doc_type = "legal"
        elif any(word in text_lower for word in ['invoice', 'payment', 'bill', 'amount']):
            doc_type = "financial"
        else:
            doc_type = "general"
        
        # Content classification
        if any(word in text_lower for word in ['confidential', 'classified', 'secret', 'restricted']):
            classification_level = "confidential"
        elif any(word in text_lower for word in ['internal', 'company only', 'proprietary']):
            classification_level = "internal"
        else:
            classification_level = "public"
        
        # Estimate reading time (average 200 words per minute)
        word_count = len(text.split())
        reading_time_minutes = max(1, word_count // 200)
        
        return {
            "document_type": doc_type,
            "classification_level": classification_level,
            "word_count": word_count,
            "estimated_reading_time": f"{reading_time_minutes} minutes",
            "language": "english",  # Placeholder
            "confidence": 0.7
        }
    
    async def convert_document(self, file_path: Path, source_type: str, target_type: str) -> Optional[Path]:
        """Convert document to different format."""
        # Placeholder for document conversion
        # In production, use libraries like pandoc, LibreOffice, or cloud conversion services
        
        output_filename = f"{file_path.stem}_converted.{target_type}"
        output_path = self.output_dir / output_filename
        
        # Simulate conversion
        conversion_note = f"Document conversion from {source_type} to {target_type} (conversion library required)"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(conversion_note)
        
        return output_path
    
    async def process_document_job(
        self,
        job_id: int,
        file_id: str,
        file_path: Path,
        tasks: List[ProcessingTask],
        options: Dict[str, Any],
        db: AsyncSession
    ):
        """Process a document processing job in the background."""
        try:
            # Get job
            result = await db.execute(
                select(ResearchJob).where(ResearchJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            
            if not job:
                logger.error(f"Document processing job {job_id} not found")
                return
            
            # Update job status
            job.status = ResearchJobStatus.IN_PROGRESS
            job.started_at = datetime.utcnow()
            job.current_step = "Starting document processing"
            await db.commit()
            
            results = {}
            total_tasks = len(tasks)
            file_type = file_path.suffix.lower().replace('.', '')
            
            for i, task in enumerate(tasks):
                try:
                    # Update progress
                    job.progress_percentage = int((i / total_tasks) * 100)
                    job.current_step = f"Processing: {task.value}"
                    await db.commit()
                    
                    if task == ProcessingTask.EXTRACT_TEXT:
                        text = await self.extract_text(file_path, file_type)
                        results["extracted_text"] = text[:10000]  # Limit size
                    
                    elif task == ProcessingTask.EXTRACT_METADATA:
                        metadata = await self.extract_metadata(file_path, file_type)
                        results["metadata"] = metadata
                    
                    elif task == ProcessingTask.GENERATE_SUMMARY:
                        if "extracted_text" not in results:
                            text = await self.extract_text(file_path, file_type)
                        else:
                            text = results["extracted_text"]
                        summary = await self.generate_summary(text)
                        results["summary"] = summary
                    
                    elif task == ProcessingTask.EXTRACT_ENTITIES:
                        if "extracted_text" not in results:
                            text = await self.extract_text(file_path, file_type)
                        else:
                            text = results["extracted_text"]
                        entities = await self.extract_entities(text)
                        results["entities"] = entities
                    
                    elif task == ProcessingTask.CLASSIFY_DOCUMENT:
                        if "extracted_text" not in results:
                            text = await self.extract_text(file_path, file_type)
                        else:
                            text = results["extracted_text"]
                        if "metadata" not in results:
                            metadata = await self.extract_metadata(file_path, file_type)
                        else:
                            metadata = results["metadata"]
                        classification = await self.classify_document(text, metadata)
                        results["classification"] = classification
                    
                    elif task == ProcessingTask.CONVERT_FORMAT:
                        target_type = options.get("convert_to")
                        if target_type:
                            converted_path = await self.convert_document(file_path, file_type, target_type)
                            if converted_path:
                                results["converted_files"] = [{
                                    "format": target_type,
                                    "filename": converted_path.name,
                                    "path": str(converted_path)
                                }]
                    
                except Exception as e:
                    logger.error(f"Failed to process task {task}: {e}")
                    results[f"{task.value}_error"] = str(e)
            
            # Update job completion
            job.status = ResearchJobStatus.COMPLETED
            job.progress_percentage = 100
            job.completed_at = datetime.utcnow()
            job.current_step = "Processing completed"
            job.result_data = json.dumps(results)
            
            await db.commit()
            
            logger.info(f"Completed document processing job {job_id}")
            
        except Exception as e:
            logger.error(f"Failed to process document job {job_id}: {e}")
            
            # Update job with error
            try:
                job.status = ResearchJobStatus.FAILED
                job.error_message = str(e)
                job.current_step = "Job failed"
                await db.commit()
            except Exception as commit_error:
                logger.error(f"Failed to update job status: {commit_error}")


# Service instance
document_service = DocumentProcessingService()

# API Endpoints
@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> DocumentUploadResponse:
    """
    Upload a document for processing.
    
    - **file**: Document file to upload
    """
    try:
        # Validate file type
        allowed_extensions = {'.pdf', '.docx', '.doc', '.txt', '.rtf', '.html', '.md', '.csv', '.xlsx', '.xls', '.pptx', '.ppt'}
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_extension} not supported. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Check file size (max 50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        if file.size and file.size > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds 50MB limit"
            )
        
        # Save file
        file_id, file_path = await document_service.save_uploaded_file(file)
        
        logger.info(f"Uploaded document {file.filename} as {file_id} for user {current_user.username}")
        
        return DocumentUploadResponse(
            file_id=file_id,
            filename=file.filename,
            file_size=file_path.stat().st_size,
            file_type=file_extension.replace('.', ''),
            uploaded_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Failed to upload document: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.post("/process/{file_id}", response_model=DocumentProcessingJobResponse)
async def process_document(
    file_id: str,
    request: DocumentProcessingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> DocumentProcessingJobResponse:
    """
    Start document processing job for an uploaded file.
    
    - **file_id**: ID of the uploaded file
    - **tasks**: List of processing tasks to perform
    - **convert_to**: Target format for conversion (if convert_format task is selected)
    - **extract_images**: Extract images from document
    - **preserve_formatting**: Preserve original formatting where possible
    """
    try:
        # Find uploaded file
        file_pattern = f"{file_id}.*"
        matching_files = list(document_service.upload_dir.glob(file_pattern))
        
        if not matching_files:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Uploaded file not found"
            )
        
        file_path = matching_files[0]
        filename = file_path.name
        
        # Validate convert_to parameter if needed
        if ProcessingTask.CONVERT_FORMAT in request.tasks and not request.convert_to:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="convert_to parameter required when convert_format task is selected"
            )
        
        # Create processing job
        job_data = {
            "file_id": file_id,
            "filename": filename,
            "tasks": [task.value for task in request.tasks],
            "convert_to": request.convert_to.value if request.convert_to else None,
            "extract_images": request.extract_images,
            "preserve_formatting": request.preserve_formatting,
            "language": request.language,
            "analysis_options": request.analysis_options
        }
        
        job = ResearchJob(
            job_type=ResearchJobType.DOCUMENT_PROCESSING,
            job_name=f"Process: {filename}",
            status=ResearchJobStatus.PENDING,
            input_data=json.dumps(job_data),
            user_id=current_user.id
        )
        
        db.add(job)
        await db.commit()
        await db.refresh(job)
        
        # Start background processing
        background_tasks.add_task(
            document_service.process_document_job,
            job.id,
            file_id,
            file_path,
            request.tasks,
            job_data,
            db
        )
        
        logger.info(f"Started document processing job {job.id} for file {file_id}")
        
        return DocumentProcessingJobResponse(
            job_id=job.id,
            file_id=file_id,
            filename=filename,
            status=job.status,
            progress_percentage=job.progress_percentage,
            current_step=job.current_step,
            tasks=[task.value for task in request.tasks],
            started_at=job.started_at,
            estimated_completion=None,
            message="Document processing job started successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to start document processing job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start processing job: {str(e)}"
        )


@router.get("/jobs/{job_id}/status", response_model=DocumentProcessingJobResponse)
async def get_processing_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> DocumentProcessingJobResponse:
    """
    Get the status of a document processing job.
    
    - **job_id**: ID of the processing job
    """
    try:
        result = await db.execute(
            select(ResearchJob).where(
                ResearchJob.id == job_id,
                ResearchJob.user_id == current_user.id,
                ResearchJob.job_type == ResearchJobType.DOCUMENT_PROCESSING
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processing job not found"
            )
        
        # Extract job data
        job_data = {}
        if job.input_data:
            try:
                job_data = json.loads(job.input_data)
            except json.JSONDecodeError:
                pass
        
        return DocumentProcessingJobResponse(
            job_id=job.id,
            file_id=job_data.get("file_id", "unknown"),
            filename=job_data.get("filename", "unknown"),
            status=job.status,
            progress_percentage=job.progress_percentage,
            current_step=job.current_step,
            tasks=job_data.get("tasks", []),
            started_at=job.started_at,
            estimated_completion=job.estimated_completion,
            message=f"Job status: {job.status}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get processing job status {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job status: {str(e)}"
        )


@router.get("/jobs/{job_id}/results")
async def get_processing_job_results(
    job_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Get the results of a completed document processing job.
    
    - **job_id**: ID of the processing job
    """
    try:
        result = await db.execute(
            select(ResearchJob).where(
                ResearchJob.id == job_id,
                ResearchJob.user_id == current_user.id,
                ResearchJob.job_type == ResearchJobType.DOCUMENT_PROCESSING
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processing job not found"
            )
        
        if job.status != ResearchJobStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not completed. Current status: {job.status}"
            )
        
        # Parse job data and results
        job_data = {}
        if job.input_data:
            try:
                job_data = json.loads(job.input_data)
            except json.JSONDecodeError:
                pass
        
        results = {}
        if job.result_data:
            try:
                results = json.loads(job.result_data)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse results for job {job_id}")
        
        processing_time = 0
        if job.started_at and job.completed_at:
            processing_time = (job.completed_at - job.started_at).total_seconds()
        
        return {
            "job_id": job.id,
            "file_id": job_data.get("file_id", "unknown"),
            "filename": job_data.get("filename", "unknown"),
            "file_type": job_data.get("filename", "").split('.')[-1] if job_data.get("filename") else "unknown",
            "processing_tasks": job_data.get("tasks", []),
            "status": job.status,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "processing_time": processing_time,
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get processing job results {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job results: {str(e)}"
        )


@router.get("/jobs")
async def get_processing_jobs(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    status_filter: Optional[str] = Query(None, description="Filter by job status")
) -> List[dict]:
    """
    Get user's document processing jobs with optional filtering.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    - **status_filter**: Filter by job status
    """
    try:
        query = select(ResearchJob).where(
            ResearchJob.user_id == current_user.id,
            ResearchJob.job_type == ResearchJobType.DOCUMENT_PROCESSING
        )
        
        if status_filter:
            query = query.where(ResearchJob.status == status_filter)
        
        query = query.order_by(ResearchJob.created_at.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        jobs = result.scalars().all()
        
        # Format jobs
        formatted_jobs = []
        for job in jobs:
            job_data = {}
            if job.input_data:
                try:
                    job_data = json.loads(job.input_data)
                except json.JSONDecodeError:
                    pass
            
            formatted_jobs.append({
                "job_id": job.id,
                "file_id": job_data.get("file_id", "unknown"),
                "filename": job_data.get("filename", "unknown"),
                "job_name": job.job_name,
                "status": job.status,
                "progress_percentage": job.progress_percentage,
                "current_step": job.current_step,
                "tasks": job_data.get("tasks", []),
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "created_at": job.created_at.isoformat()
            })
        
        return formatted_jobs
        
    except Exception as e:
        logger.error(f"Failed to get processing jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve processing jobs: {str(e)}"
        )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_processing_job(
    job_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel or delete a document processing job.
    
    - **job_id**: ID of the processing job to cancel
    """
    try:
        result = await db.execute(
            select(ResearchJob).where(
                ResearchJob.id == job_id,
                ResearchJob.user_id == current_user.id,
                ResearchJob.job_type == ResearchJobType.DOCUMENT_PROCESSING
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processing job not found"
            )
        
        # If job is running, mark as cancelled. If completed/failed, delete it.
        if job.status in [ResearchJobStatus.PENDING, ResearchJobStatus.IN_PROGRESS]:
            job.status = ResearchJobStatus.CANCELLED
            job.current_step = "Job cancelled by user"
            await db.commit()
        else:
            await db.delete(job)
            await db.commit()
        
        logger.info(f"Cancelled/deleted processing job {job_id} for user {current_user.username}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel processing job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel job: {str(e)}"
        )


@router.get("/supported-formats")
async def get_supported_formats() -> dict:
    """
    Get list of supported document formats and processing capabilities.
    """
    return {
        "input_formats": {
            "pdf": {
                "description": "Portable Document Format",
                "supports": ["text_extraction", "metadata_extraction", "conversion"]
            },
            "docx": {
                "description": "Microsoft Word Document",
                "supports": ["text_extraction", "metadata_extraction", "conversion"]
            },
            "doc": {
                "description": "Microsoft Word Document (Legacy)",
                "supports": ["text_extraction", "metadata_extraction", "conversion"]
            },
            "txt": {
                "description": "Plain Text",
                "supports": ["text_extraction", "analysis", "conversion"]
            },
            "rtf": {
                "description": "Rich Text Format",
                "supports": ["text_extraction", "metadata_extraction", "conversion"]
            },
            "html": {
                "description": "HyperText Markup Language",
                "supports": ["text_extraction", "metadata_extraction", "conversion"]
            },
            "md": {
                "description": "Markdown",
                "supports": ["text_extraction", "conversion"]
            },
            "csv": {
                "description": "Comma-Separated Values",
                "supports": ["data_extraction", "conversion"]
            },
            "xlsx": {
                "description": "Microsoft Excel Workbook",
                "supports": ["data_extraction", "metadata_extraction", "conversion"]
            }
        },
        "processing_tasks": {
            "extract_text": "Extract plain text content from documents",
            "extract_metadata": "Extract document properties and metadata",
            "convert_format": "Convert documents to different formats",
            "analyze_content": "Analyze document content and structure",
            "generate_summary": "Generate automatic document summaries",
            "extract_entities": "Extract named entities and key terms",
            "classify_document": "Classify document type and content"
        },
        "output_formats": ["txt", "pdf", "docx", "html", "md", "json"],
        "max_file_size": "50MB",
        "notes": "Some features require additional libraries in production environment"
    }