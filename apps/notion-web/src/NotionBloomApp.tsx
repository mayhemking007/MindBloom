import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { useAuth } from "../../web/src/auth/AuthContext";
import { NotionDocumentPage } from "../../web/src/pages/NotionDocumentPage";
import { NotionPage } from "../../web/src/pages/NotionPage";
import { NotionBloomAuthPage } from "./pages/NotionBloomAuthPage";
import { NotionBloomLandingPage } from "./pages/NotionBloomLandingPage";
import { NotionBloomLayout } from "./layout/NotionBloomLayout";

function RequireAccount() {
  const { isLoading, user } = useAuth();
  if (isLoading) return <main className="grid min-h-dvh place-items-center bg-bloom-bg text-[13px] text-bloom-text-secondary">Opening your garden…</main>;
  return user ? <Outlet /> : <Navigate replace to="/login" />;
}

export function NotionBloomApp() {
  return <Routes>
    <Route index element={<NotionBloomLandingPage />} />
    <Route path="login" element={<NotionBloomAuthPage mode="login" />} />
    <Route path="register" element={<NotionBloomAuthPage mode="register" />} />
    <Route element={<RequireAccount />}>
      <Route element={<NotionBloomLayout />}>
        <Route path="notion" element={<NotionPage brandName="Notion Bloom" />} />
        <Route path="notion/:documentId" element={<NotionDocumentPage brandName="Notion Bloom" />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate replace to="/" />} />
  </Routes>;
}
