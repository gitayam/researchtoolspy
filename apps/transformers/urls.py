from django.urls import path
from .views import CsvToJsonView

urlpatterns = [
    path('csv-json/', CsvToJsonView.as_view(), name='csv-json'),
]
