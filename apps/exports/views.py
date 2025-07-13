from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.frameworks.models import FrameworkSession
from .exporters.json_exporter import JsonExporter

class ExportSessionView(APIView):
    def get(self, request, session_id):
        try:
            session = FrameworkSession.objects.get(id=session_id)
            # This is a simplified implementation. In a real scenario,
            # we would have a more sophisticated way of getting the data.
            data = {
                'session_id': session.id,
                'framework_type': session.framework_type,
                'title': session.title,
                'session_data': session.session_data,
                'responses': list(session.frameworkresponse_set.values())
            }
            exporter = JsonExporter()
            exported_data = exporter.export(data)
            return JsonResponse(exported_data, safe=False, content_type='application/json')
        except FrameworkSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)
