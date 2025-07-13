from rest_framework import serializers
from .models import FrameworkSession, FrameworkResponse

class FrameworkSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FrameworkSession
        fields = '__all__'

class FrameworkResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = FrameworkResponse
        fields = '__all__'
