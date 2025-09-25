import { Routes, Route } from 'react-router-dom';
import AchListPage from './ach/AchListPage';
import AchCreatePage from './ach/AchCreatePage';
import AchViewPage from './ach/AchViewPage';

export default function AchPage() {
  return (
    <Routes>
      <Route index element={<AchListPage />} />
      <Route path="create" element={<AchCreatePage />} />
      <Route path=":id" element={<AchViewPage />} />
    </Routes>
  );
}