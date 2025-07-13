from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services.conversion import ConversionService

class CsvToJsonView(APIView):
    def post(self, request):
        csv_content = request.data.get('csv_content')
        if not csv_content:
            return Response({'error': 'CSV content is required.'}, status=status.HTTP_400_BAD_REQUEST)

        service = ConversionService()
        try:
            json_content = service.csv_to_json(csv_content)
            return Response({'json_content': json_content})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
