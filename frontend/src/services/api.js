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

export const deleteDataset = async (id) => {
  const response = await api.delete(`/datasets/${id}`);
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

// CRUD API for physical generated tables
export const getGeneratedTables = async (id) => {
  const response = await api.get(`/datasets/${id}/tables`);
  return response.data;
};

export const getTableRecords = async (id, tableName, params = {}) => {
  const response = await api.get(`/datasets/${id}/tables/${tableName}/records`, { params });
  return response.data;
};

export const createRecord = async (id, tableName, record) => {
  const response = await api.post(`/datasets/${id}/tables/${tableName}/records`, { record });
  return response.data;
};

export const updateRecord = async (id, tableName, keys, updates) => {
  const response = await api.put(`/datasets/${id}/tables/${tableName}/records`, { keys, updates });
  return response.data;
};

export const deleteRecord = async (id, tableName, keys) => {
  const response = await api.delete(`/datasets/${id}/tables/${tableName}/records`, { data: { keys } });
  return response.data;
};

export const getExcelDownloadUrl = (datasetId) => `/api/datasets/${datasetId}/excel`;
export const getSqlDownloadUrl = (datasetId) => `/api/datasets/${datasetId}/sql`;

export default api;
