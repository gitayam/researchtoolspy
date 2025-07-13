from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FrameworkSessionViewSet

router = DefaultRouter()
router.register(r'sessions', FrameworkSessionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
