from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/frameworks/', include('apps.frameworks.urls')),
    path('api/ai/', include('apps.ai_services.urls')),
    path('api/transform/', include('apps.transformers.urls')),
    path('api/export/', include('apps.exports.urls')),
]
