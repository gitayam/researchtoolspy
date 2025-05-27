import pytest
from datetime import datetime
from sqlalchemy import Column, String
from ..models.base import BaseModel

class TestModel(BaseModel):
    """Test model for testing BaseModel functionality."""
    __tablename__ = "test_model"
    
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

def test_model_creation(db_session):
    """Test model creation and basic operations."""
    # Create test model
    test_model = TestModel(
        name="Test Model",
        description="Test Description",
        created_by="test_user"
    )
    
    # Save to database
    saved_model = test_model.save(db_session)
    
    # Verify saved model
    assert saved_model.id is not None
    assert saved_model.name == "Test Model"
    assert saved_model.description == "Test Description"
    assert saved_model.created_by == "test_user"
    assert isinstance(saved_model.created_at, datetime)
    assert isinstance(saved_model.updated_at, datetime)

def test_model_update(db_session):
    """Test model update functionality."""
    # Create and save test model
    test_model = TestModel(
        name="Original Name",
        description="Original Description",
        created_by="test_user"
    ).save(db_session)
    
    # Update model
    updated_model = test_model.update(
        db_session,
        name="Updated Name",
        description="Updated Description",
        updated_by="test_user"
    )
    
    # Verify updates
    assert updated_model.name == "Updated Name"
    assert updated_model.description == "Updated Description"
    assert updated_model.updated_by == "test_user"

def test_model_delete(db_session):
    """Test model deletion."""
    # Create and save test model
    test_model = TestModel(
        name="Test Model",
        description="Test Description",
        created_by="test_user"
    ).save(db_session)
    
    # Get model ID
    model_id = test_model.id
    
    # Delete model
    test_model.delete(db_session)
    
    # Verify deletion
    assert TestModel.get_by_id(db_session, model_id) is None

def test_model_to_dict(db_session):
    """Test model to_dict method."""
    # Create test model
    test_model = TestModel(
        name="Test Model",
        description="Test Description",
        created_by="test_user"
    ).save(db_session)
    
    # Convert to dictionary
    model_dict = test_model.to_dict()
    
    # Verify dictionary contents
    assert isinstance(model_dict, dict)
    assert model_dict["name"] == "Test Model"
    assert model_dict["description"] == "Test Description"
    assert model_dict["created_by"] == "test_user"
    assert "id" in model_dict
    assert "created_at" in model_dict
    assert "updated_at" in model_dict 