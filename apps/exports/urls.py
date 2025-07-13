from django.urls import path
from .views import ExportSessionView

urlpatterns = [
    path('session/<int:session_id>/', ExportSessionView.as_view(), name='export-session'),
]
