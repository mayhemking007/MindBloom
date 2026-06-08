import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./layout/AppLayout";
import { MapPage } from "./pages/MapPage";
import { AuthPage } from "./pages/AuthPage";
import { CalendarPage } from "./pages/CalendarPage";
import { NotesPage } from "./pages/NotesPage";
import { PublicSharePage } from "./pages/PublicSharePage";
import { ReflectPage } from "./pages/ReflectPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodayPage } from "./pages/TodayPage";

export function App() {
  return (
    <Routes>
      <Route path="share/:token" element={<PublicSharePage />} />
      <Route path="login" element={<AuthPage mode="login" />} />
      <Route path="register" element={<AuthPage mode="register" />} />
      <Route element={<AppLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="timeline" element={<Navigate replace to="/notes" />} />
        <Route path="reflect" element={<ReflectPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
