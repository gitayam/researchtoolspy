from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import FrameworkSession, FrameworkResponse
from .serializers import FrameworkSessionSerializer, FrameworkResponseSerializer
from .framework_registry import framework_registry

class FrameworkSessionViewSet(viewsets.ModelViewSet):
    queryset = FrameworkSession.objects.all()
    serializer_class = FrameworkSessionSerializer

    @action(detail=True, methods=['post'])
    def add_response(self, request, pk=None):
        session = self.get_object()
        serializer = FrameworkResponseSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(session=session)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def list_frameworks(self, request):
        return Response(list(framework_registry.frameworks.keys()))

    @action(detail=True, methods=['post'])
    def generate(self, request, pk=None):
        # This will be implemented later
        return Response(status=status.HTTP_501_NOT_IMPLEMENTED)

    @action(detail=True, methods=['post'])
    def analyze(self, request, pk=None):
        # This will be implemented later
        return Response(status=status.HTTP_501_NOT_IMPLEMENTED)

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        # This will be implemented later
        return Response(status=status.HTTP_501_NOT_IMPLEMENTED)
