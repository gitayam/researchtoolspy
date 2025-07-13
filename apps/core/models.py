from django.db import models

class BaseFramework(models.Model):
    name = models.CharField(max_length=100)
    version = models.CharField(max_length=20, default="1.0")
    components = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
