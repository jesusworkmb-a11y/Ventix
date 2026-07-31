import axios from 'axios';

// Fuente única de comunicación con el backend. Los módulos de UI no deben
// crear sus propias instancias de axios (consistencia, §33.3).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

export default api;
