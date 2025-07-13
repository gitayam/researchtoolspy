from django.db import models
from django.contrib.auth.models import User

class FrameworkSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    framework_type = models.CharField(max_length=50)
    title = models.CharField(max_length=200)
    session_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class FrameworkResponse(models.Model):
    session = models.ForeignKey(FrameworkSession, on_delete=models.CASCADE)
    component = models.CharField(max_length=100)
    response_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
