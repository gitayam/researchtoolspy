import pytest
from datetime import datetime
from sqlalchemy import Column, String, Integer
from sqlalchemy.exc import SQLAlchemyError, OperationalError
from ..models.base import BaseModel
from ..core.exceptions import (
    DatabaseError,
    ResourceNotFoundError,
    ValidationError
)

class _TestModel(BaseModel):
    """Test model for testing BaseModel functionality."""
    __tablename__ = "test_model"
    
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    value = Column(Integer, nullable=False)

def test_model_creation(db_session):
    """Test model creation and basic operations."""
    # Create test model
    test_model = _TestModel(
        name="Test Model",
        description="Test Description",
        value=42,
        created_by="test_user"
    )
    
    # Save to database
    saved_model = test_model.save(db_session)
    
    # Verify saved model
    assert saved_model.id is not None
    assert saved_model.name == "Test Model"
    assert saved_model.description == "Test Description"
    assert saved_model.value == 42
    assert saved_model.created_by == "test_user"
    assert isinstance(saved_model.created_at, datetime)
    assert isinstance(saved_model.updated_at, datetime)

def test_model_update(db_session):
    """Test model update functionality."""
    # Create and save test model
    test_model = _TestModel(
        name="Original Name",
        description="Original Description",
        value=42,
        created_by="test_user"
    ).save(db_session)
    
    # Update model
    updated_model = test_model.update(
        db_session,
        name="Updated Name",
        description="Updated Description",
        value=100,
        updated_by="test_user"
    )
    
    # Verify updates
    assert updated_model.name == "Updated Name"
    assert updated_model.description == "Updated Description"
    assert updated_model.value == 100
    assert updated_model.updated_by == "test_user"

def test_model_delete(db_session):
    """Test model deletion."""
    # Create and save test model
    test_model = _TestModel(
        name="Test Model",
        description="Test Description",
        value=42,
        created_by="test_user"
    ).save(db_session)
    
    # Get model ID
    model_id = test_model.id
    
    # Delete model
    test_model.delete(db_session)
    
    # Verify deletion
    assert _TestModel.get_by_id(db_session, model_id) is None

def test_model_to_dict(db_session):
    """Test model to_dict method."""
    # Create test model
    test_model = _TestModel(
        name="Test Model",
        description="Test Description",
        value=42,
        created_by="test_user"
    ).save(db_session)
    
    # Convert to dictionary
    model_dict = test_model.to_dict()
    
    # Verify dictionary contents
    assert isinstance(model_dict, dict)
    assert model_dict["name"] == "Test Model"
    assert model_dict["description"] == "Test Description"
    assert model_dict["value"] == 42
    assert model_dict["created_by"] == "test_user"
    assert "id" in model_dict
    assert "created_at" in model_dict
    assert "updated_at" in model_dict

def test_model_validation(db_session):
    """Test model validation."""
    # Test missing required field
    with pytest.raises(ValidationError) as exc_info:
        _TestModel(
            name="Test Model",
            description="Test Description",
            created_by="test_user"
        ).save(db_session)
    
    assert exc_info.value.error_code == "VALIDATION_ERROR"
    assert "value" in exc_info.value.details["missing_fields"]
    
    # Test valid model
    test_model = _TestModel(
        name="Test Model",
        description="Test Description",
        value=42,
        created_by="test_user"
    )
    test_model.validate()  # Should not raise

def test_model_filtering(db_session):
    """Test model filtering functionality."""
    # Create test models
    models = [
        _TestModel(
            name=f"Test Model {i}",
            description=f"Description {i}",
            value=i,
            created_by="test_user"
        ).save(db_session)
        for i in range(5)
    ]
    
    # Test filtering
    filtered_models = _TestModel.get_all(
        db_session,
        filters={"value": 3}
    )
    
    assert len(filtered_models) == 1
    assert filtered_models[0].value == 3

def test_delete_unsaved_model(db_session):
    """Test deleting an unsaved model."""
    # Create model without saving
    test_model = _TestModel(
        name="Test Model",
        description="Test Description",
        value=42,
        created_by="test_user"
    )
    
    # Attempt to delete unsaved model
    with pytest.raises(ResourceNotFoundError) as exc_info:
        test_model.delete(db_session)
    
    assert exc_info.value.error_code == "MODEL_NOT_FOUND"
    assert "Cannot delete unsaved model" in str(exc_info.value)

def test_update_unsaved_model(db_session):
    """Test updating an unsaved model."""
    # Create model without saving
    test_model = _TestModel(
        name="Test Model",
        description="Test Description",
        value=42,
        created_by="test_user"
    )
    
    # Attempt to update unsaved model
    with pytest.raises(ResourceNotFoundError) as exc_info:
        test_model.update(db_session, name="Updated Name")
    
    assert exc_info.value.error_code == "MODEL_NOT_FOUND"
    assert "Cannot update unsaved model" in str(exc_info.value)

def test_get_by_id_not_found(db_session):
    """Test getting a non-existent model by ID."""
    # Try to get model with non-existent ID
    result = _TestModel.get_by_id(db_session, 999999)
    assert result is None

def test_database_error_handling(db_session, monkeypatch):
    """Test database error handling."""
    # Create test model
    test_model = _TestModel(
        name="Test Model",
        description="Test Description",
        value=42,
        created_by="test_user"
    )
    
    # Mock database error
    def mock_commit_error(*args, **kwargs):
        raise SQLAlchemyError("Mock database error")
    
    # Apply mock
    monkeypatch.setattr(db_session, "commit", mock_commit_error)
    
    # Test save error
    with pytest.raises(DatabaseError) as exc_info:
        test_model.save(db_session)
    assert exc_info.value.error_code == "DB_SAVE_ERROR"

def test_operational_error_handling(db_session, monkeypatch):
    """Test handling of operational errors."""
    # Create test model
    test_model = _TestModel(
        name="Test Model",
        description="Test Description",
        value=42,
        created_by="test_user"
    )
    
    # Mock operational error
    def mock_operational_error(*args, **kwargs):
        raise OperationalError("statement", "parameters", "orig")
    
    # Apply mock
    monkeypatch.setattr(db_session, "commit", mock_operational_error)
    
    # Test save error
    with pytest.raises(DatabaseError) as exc_info:
        test_model.save(db_session)
    assert exc_info.value.error_code == "DB_SAVE_ERROR"

def test_model_timestamps(db_session):
    """Test model timestamp handling."""
    # Create test model
    test_model = _TestModel(
        name="Test Model",
        description="Test Description",
        value=42,
        created_by="test_user"
    ).save(db_session)
    
    # Verify initial timestamps
    initial_created_at = test_model.created_at
    initial_updated_at = test_model.updated_at
    
    # Update model
    test_model.update(db_session, name="Updated Name")
    
    # Verify timestamps after update
    assert test_model.created_at == initial_created_at
    assert test_model.updated_at > initial_updated_at 