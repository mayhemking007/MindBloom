import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./layout/AppLayout";
import { MapPage } from "./pages/MapPage";
import { NotesPage } from "./pages/NotesPage";
import { ReflectPage } from "./pages/ReflectPage";
import { TodayPage } from "./pages/TodayPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="timeline" element={<Navigate replace to="/notes" />} />
        <Route path="reflect" element={<ReflectPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
