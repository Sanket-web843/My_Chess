import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import OfflinePage from './pages/OfflinePage.jsx';
import OnlinePage from './pages/OnlinePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<HomePage />} />
        <Route path="/offline" element={<OfflinePage />} />
        <Route path="/online"  element={<OnlinePage />} />
        <Route path="*"        element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
