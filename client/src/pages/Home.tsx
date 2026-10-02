import { Navigate } from 'react-router-dom';

export function Home() {
  return <Navigate to="/dashboard" replace />;
}
