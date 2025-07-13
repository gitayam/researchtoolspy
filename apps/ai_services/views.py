from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .query_generator import QueryGenerator

class GenerateQueryView(APIView):
    def post(self, request):
        topic = request.data.get('topic')
        framework = request.data.get('framework')
        if not topic or not framework:
            return Response({'error': 'Topic and framework are required.'}, status=status.HTTP_400_BAD_REQUEST)

        generator = QueryGenerator()
        query = generator.generate_query(topic, framework)
        return Response({'query': query})

class SuggestionView(APIView):
    def post(self, request):
        context = request.data.get('context')
        if not context:
            return Response({'error': 'Context is required.'}, status=status.HTTP_400_BAD_REQUEST)

        generator = QueryGenerator()
        suggestions = generator.get_suggestions(context)
        return Response({'suggestions': suggestions})
