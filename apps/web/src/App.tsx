import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./layout/AppLayout";
import { MapPage } from "./pages/MapPage";
import { ReflectPage } from "./pages/ReflectPage";
import { TimelinePage } from "./pages/TimelinePage";
import { TodayPage } from "./pages/TodayPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="reflect" element={<ReflectPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
