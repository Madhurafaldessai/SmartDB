import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

export const getHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
  return response.data;
};

export const getAllDatasets = async () => {
  const response = await api.get('/datasets');
  return response.data;
};

export const getDatasetDetails = async (id) => {
  const response = await api.get(`/datasets/${id}`);
  return response.data;
};

export const analyzeDataset = async (id) => {
  const response = await api.post(`/datasets/${id}/analyze`);
  return response.data;
};

export const updateFunctionalDependencies = async (id, dependencies) => {
  const response = await api.put(`/datasets/${id}/dependencies`, { dependencies });
  return response.data;
};

export const getDataQualityReport = async (id) => {
  const response = await api.get(`/datasets/${id}/quality`);
  return response.data;
};

export const suggestNormalization = async (id, payload = {}) => {
  const response = await api.post(`/datasets/${id}/normalize`, payload);
  return response.data;
};

export const runMigration = async (id, payload) => {
  const response = await api.post(`/datasets/${id}/migrate`, payload);
  return response.data;
};

export const getMigrationStatus = async (id) => {
  const response = await api.get(`/datasets/${id}/status`);
  return response.data;
};

export const getERDData = async (id) => {
  const response = await api.get(`/datasets/${id}/erd`);
  return response.data;
};

export const getAuditReport = async (id) => {
  const response = await api.get(`/datasets/${id}/report`);
  return response.data;
};

export const getExcelDownloadUrl = (datasetId) => `/api/datasets/${datasetId}/excel`;
export const getSqlDownloadUrl = (datasetId) => `/api/datasets/${datasetId}/sql`;

export default api;
