import { useState } from 'react';

export default function SwotPage() {
  const [swotData, setSwotData] = useState({
    strengths: [''],
    weaknesses: [''],
    opportunities: [''],
    threats: [''],
  });

  const handleSubmit = async () => {
    const response = await fetch('https://researchtoolspy-gateway-dev.wemea-5ahhf.workers.dev/api/v1/frameworks/swot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(swotData),
    });
    const result = await response.json();
    console.log('SWOT saved:', result);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">SWOT Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-green-800">Strengths</h2>
          <textarea
            className="w-full h-32 p-3 border rounded"
            placeholder="Enter strengths..."
            onChange={(e) => setSwotData({...swotData, strengths: [e.target.value]})}
          />
        </div>

        {/* Weaknesses */}
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-red-800">Weaknesses</h2>
          <textarea
            className="w-full h-32 p-3 border rounded"
            placeholder="Enter weaknesses..."
            onChange={(e) => setSwotData({...swotData, weaknesses: [e.target.value]})}
          />
        </div>

        {/* Opportunities */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">Opportunities</h2>
          <textarea
            className="w-full h-32 p-3 border rounded"
            placeholder="Enter opportunities..."
            onChange={(e) => setSwotData({...swotData, opportunities: [e.target.value]})}
          />
        </div>

        {/* Threats */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-yellow-800">Threats</h2>
          <textarea
            className="w-full h-32 p-3 border rounded"
            placeholder="Enter threats..."
            onChange={(e) => setSwotData({...swotData, threats: [e.target.value]})}
          />
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          Save Analysis
        </button>
      </div>
    </div>
  );
}