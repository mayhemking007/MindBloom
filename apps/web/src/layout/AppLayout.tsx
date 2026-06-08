import { Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { BottomNav } from "../components/nav/BottomNav";

export function AppLayout() {
  const { ownerKind, user } = useAuth();
  const ownerKey = `${ownerKind}:${user?.id ?? "demo"}`;

  return (
    <div className="min-h-dvh bg-bloom-bg text-bloom-text-primary">
      <div className="mx-auto min-h-dvh w-full max-w-[1440px] bg-bloom-bg md:grid md:grid-cols-[220px_minmax(0,1fr)]">
        <BottomNav />
        <div key={ownerKey} className="min-w-0 pb-[76px] md:pb-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
