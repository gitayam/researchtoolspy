from django.urls import path
from .views import GenerateQueryView, SuggestionView

urlpatterns = [
    path('generate-query/', GenerateQueryView.as_view(), name='generate-query'),
    path('suggest/', SuggestionView.as_view(), name='suggest'),
]
