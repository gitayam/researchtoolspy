"""
URL configuration for research_tools_project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.authtoken.views import obtain_auth_token
from apps.core.health import health_check, readiness_check, liveness_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', obtain_auth_token, name='api_token_auth'),
    path('api/frameworks/', include('apps.frameworks.urls')),
    path('api/ai/', include('apps.ai_services.urls')),
    
    # Health check endpoints
    path('api/health/', health_check, name='health_check'),
    path('api/health/readiness/', readiness_check, name='readiness_check'),
    path('api/health/liveness/', liveness_check, name='liveness_check'),
]
