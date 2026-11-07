import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, ArrowRight, CheckCircle2, Sparkles, Building2, ShoppingBag, Stethoscope, Play } from 'lucide-react';
import UploadCard from '../components/UploadCard';
import DataTable from '../components/DataTable';
import { uploadFile } from '../services/api';

const sampleStudentCSV = `student_id,student_name,student_email,department_id,department_name,department_head,course_id,course_name,credits,instructor_name,semester,grade
S101,Aarav Sharma,aarav@univ.edu,D01,Computer Science,Dr. Alan Turing,CS101,Data Structures,4,Prof. Knuth,Fall 2024,A
S101,Aarav Sharma,aarav@univ.edu,D01,Computer Science,Dr. Alan Turing,CS102,Database Systems,3,Prof. Codd,Fall 2024,A-
S102,Diya Patel,diya@univ.edu,D01,Computer Science,Dr. Alan Turing,CS101,Data Structures,4,Prof. Knuth,Fall 2024,B+
S102,Diya Patel,diya@univ.edu,D01,Computer Science,Dr. Alan Turing,CS103,Operating Systems,4,Prof. Tanenbaum,Spring 2025,A
S103,Rohan Verma,rohan@univ.edu,D02,Electronics,Dr. Claude Shannon,EC201,Digital Signals,3,Prof. Oppenheim,Fall 2024,B
S103,Rohan Verma,rohan@univ.edu,D02,Electronics,Dr. Claude Shannon,EC202,Microprocessors,4,Prof. Hennessy,Spring 2025,A
S104,Ananya Sen,ananya@univ.edu,D02,Electronics,Dr. Claude Shannon,EC201,Digital Signals,3,Prof. Oppenheim,Fall 2024,A
S105,Kabir Mehta,kabir@univ.edu,D03,Mechanical Eng,Dr. James Watt,ME301,Thermodynamics,3,Prof. Carnot,Fall 2024,B+
S105,Kabir Mehta,kabir@univ.edu,D03,Mechanical Eng,Dr. James Watt,ME302,Fluid Mechanics,4,Prof. Navier,Spring 2025,B
S106,Neha Gupta,neha@univ.edu,D01,Computer Science,Dr. Alan Turing,CS102,Database Systems,3,Prof. Codd,Fall 2024,A+`;

const sampleSalesCSV = `order_id,order_date,customer_id,customer_name,customer_email,customer_city,customer_state,product_id,product_name,category,unit_price,quantity,discount_percent
ORD-1001,2024-01-15,CUST-01,Alice Johnson,alice@gmail.com,Seattle,WA,PROD-501,Mechanical Keyboard,Electronics,120.00,2,0.05
ORD-1001,2024-01-15,CUST-01,Alice Johnson,alice@gmail.com,Seattle,WA,PROD-502,Wireless Mouse,Electronics,45.00,1,0.00
ORD-1002,2024-01-16,CUST-02,Bob Smith,bob@yahoo.com,Austin,TX,PROD-503,USB-C Monitor Hub,Electronics,85.00,1,0.10
ORD-1003,2024-01-17,CUST-03,Carol White,carol@outlook.com,Denver,CO,PROD-501,Mechanical Keyboard,Electronics,120.00,1,0.00
ORD-1003,2024-01-17,CUST-03,Carol White,carol@outlook.com,Denver,CO,PROD-504,Ergonomic Chair,Furniture,250.00,1,0.15
ORD-1004,2024-01-18,CUST-02,Bob Smith,bob@yahoo.com,Austin,TX,PROD-502,Wireless Mouse,Electronics,45.00,3,0.05
ORD-1005,2024-01-19,CUST-04,David Brown,david@gmail.com,Boston,MA,PROD-505,Standing Desk,Furniture,420.00,1,0.20
ORD-1005,2024-01-19,CUST-04,David Brown,david@gmail.com,Boston,MA,PROD-503,USB-C Monitor Hub,Electronics,85.00,2,0.05`;

const sampleHospitalCSV = `patient_id,patient_name,patient_dob,patient_phone,doctor_id,doctor_name,doctor_specialization,ward_id,ward_name,ward_capacity,admission_date,discharge_date,diagnosis,treatment_cost
P001,Riya Sharma,1990-05-12,9876543210,D01,Dr. Mehta,Cardiology,W01,Cardiology Ward,20,2024-01-10,2024-01-18,Hypertension,15000.00
P002,Arjun Nair,1975-08-23,9123456789,D02,Dr. Verma,Orthopedics,W02,Orthopedic Ward,15,2024-01-12,2024-01-20,Fracture,22000.00
P003,Sneha Pillai,2001-02-15,9988776655,D01,Dr. Mehta,Cardiology,W01,Cardiology Ward,20,2024-01-14,2024-01-21,Arrhythmia,18500.00
P004,Amit Joshi,1988-11-30,9871234560,D03,Dr. Rao,Neurology,W03,Neurology Ward,10,2024-01-15,2024-01-25,Migraine,12000.00
P005,Priya Kapoor,1995-07-07,9765432100,D02,Dr. Verma,Orthopedics,W02,Orthopedic Ward,15,2024-01-16,2024-01-22,Knee Injury,19000.00
P006,Rahul Desai,1982-03-19,9654321098,D04,Dr. Singh,Pulmonology,W04,Pulmonology Ward,12,2024-01-17,2024-01-24,Pneumonia,21000.00
P007,Meena Kumar,1970-09-04,9543210987,D01,Dr. Mehta,Cardiology,W01,Cardiology Ward,20,2024-01-18,2024-01-28,Heart Failure,45000.00
P008,Vikram Reddy,2005-12-20,9432109876,D03,Dr. Rao,Neurology,W03,Neurology Ward,10,2024-01-19,2024-01-26,Epilepsy,17500.00`;

const UploadPage = ({ onUploadSuccess, onNavigate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadedDataset, setUploadedDataset] = useState(null);

  const handleUpload = async (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const res = await uploadFile(file, (progress) => {
        setUploadProgress(progress);
      });

      if (res.success) {
        setUploadedDataset(res.dataset);
        onUploadSuccess(res.dataset);
      } else {
        setError(res.message || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error uploading file');
    } finally {
      setIsUploading(false);
    }
  };

  const loadSampleDataset = (name, csvContent) => {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], `${name}.csv`, { type: 'text/csv' });
    handleUpload(file);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dataset Ingestion</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload unnormalized CSV or Excel files. SmartDB preserves your original raw file and profiles all attributes.
        </p>
      </div>

      {/* Main Upload Zone */}
      <UploadCard
        onFileSelected={handleUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        error={error}
      />

      {/* Demonstration Datasets */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase">
            Academic Demonstration Datasets
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Load benchmark datasets designed to demonstrate 1NF, 2NF, and 3NF decomposition properties.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: University */}
          <div className="border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors bg-slate-50/40 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-slate-800">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm">University Enrollments</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Demonstrates partial dependencies ($student\_id, course\_id \to grade$) and transitive dependencies ($student\_id \to dept\_id \to dept\_head$).
              </p>
            </div>
            <button
              onClick={() => loadSampleDataset('university_enrollment', sampleStudentCSV)}
              disabled={isUploading}
              className="mt-4 w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Play className="w-3 h-3 text-blue-600" />
              <span>Load University Dataset</span>
            </button>
          </div>

          {/* Card 2: Retail */}
          <div className="border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors bg-slate-50/40 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-slate-800">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold text-sm">Retail Order Transactions</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Demonstrates multi-attribute candidate keys ($order\_id, product\_id$) with customer transitive dependencies ($customer\_id \to city, state$).
              </p>
            </div>
            <button
              onClick={() => loadSampleDataset('retail_orders', sampleSalesCSV)}
              disabled={isUploading}
              className="mt-4 w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Play className="w-3 h-3 text-emerald-600" />
              <span>Load Retail Dataset</span>
            </button>
          </div>

          {/* Card 3: Hospital */}
          <div className="border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors bg-slate-50/40 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-slate-800">
                <Stethoscope className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-sm">Hospital Patient Admissions</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Demonstrates multiple entity decomposition: Patients, Doctors ($doctor\_id \to specialization$), and Hospital Wards ($ward\_id \to capacity$).
              </p>
            </div>
            <button
              onClick={() => loadSampleDataset('hospital_admissions', sampleHospitalCSV)}
              disabled={isUploading}
              className="mt-4 w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Play className="w-3 h-3 text-purple-600" />
              <span>Load Hospital Dataset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Raw Data Preview */}
      {uploadedDataset && uploadedDataset.preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Preview: {uploadedDataset.original_name}
              </h2>
              <p className="text-xs text-slate-500">
                Showing first {uploadedDataset.preview.length} rows of {uploadedDataset.row_count} total records
              </p>
            </div>

            <button
              onClick={() => onNavigate('analysis')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              <span>Proceed to Dependency Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <DataTable
            headers={Object.keys(uploadedDataset.preview[0] || {})}
            rows={uploadedDataset.preview}
            pageSize={10}
          />
        </div>
      )}
    </div>
  );
};

export default UploadPage;
