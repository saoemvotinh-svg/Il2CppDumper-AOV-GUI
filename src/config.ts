export const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3001' : '';

export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}
