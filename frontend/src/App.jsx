import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/Upload';
import AnalysisPage from './pages/Analysis';
import NormalizationPage from './pages/Normalization';
import SchemaDesignerPage from './pages/SchemaDesigner';
import ExportPage from './pages/Export';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeDataset, setActiveDataset] = useState(null);
  const [activeSchema, setActiveSchema] = useState(null);

  const handleUploadSuccess = (dataset) => {
    setActiveDataset(dataset);
    setActiveTab('analysis');
  };

  const handleSelectDataset = (dataset) => {
    setActiveDataset(dataset);
  };

  const handleNormalizationReady = (schema) => {
    setActiveSchema(schema);
  };

  const handleMigrationSuccess = (migrationResult) => {
    if (activeDataset) {
      setActiveDataset((prev) => ({
        ...prev,
        status: 'migrated',
        target_database: migrationResult.targetDatabaseName,
      }));
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      {/* Fixed Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDataset={activeDataset}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar activeDataset={activeDataset} />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
          <div className="max-w-[1440px] mx-auto">
            {activeTab === 'dashboard' && (
              <Dashboard
                activeDataset={activeDataset}
                onSelectDataset={handleSelectDataset}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'upload' && (
              <UploadPage
                onUploadSuccess={handleUploadSuccess}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'analysis' && (
              <AnalysisPage
                activeDataset={activeDataset}
                onNavigate={setActiveTab}
                onAnalysisComplete={() => {}}
              />
            )}

            {activeTab === 'normalization' && (
              <NormalizationPage
                activeDataset={activeDataset}
                onNavigate={setActiveTab}
                onNormalizationReady={handleNormalizationReady}
              />
            )}

            {activeTab === 'schema' && (
              <SchemaDesignerPage
                activeDataset={activeDataset}
                initialSchema={activeSchema}
                onNavigate={setActiveTab}
                onMigrationSuccess={handleMigrationSuccess}
              />
            )}

            {activeTab === 'export' && (
              <ExportPage
                activeDataset={activeDataset}
                onNavigate={setActiveTab}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
