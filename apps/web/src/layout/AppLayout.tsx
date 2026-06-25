import { Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { BottomNav } from "../components/nav/BottomNav";

export function AppLayout() {
  const { isLoading, ownerKind, user } = useAuth();
  const ownerKey = `${ownerKind}:${user?.id ?? "demo"}`;

  return (
    <div className="min-h-dvh bg-bloom-bg text-bloom-text-primary">
      <div className="min-h-dvh w-full bg-bloom-bg md:flex md:flex-col">
        <BottomNav />
        <div key={ownerKey} className="min-w-0 pb-[76px] md:min-h-0 md:flex-1 md:pb-0">
          {isLoading ? (
            <main className="grid min-h-[calc(100dvh-60px)] place-items-center px-4 text-[14px] text-bloom-text-secondary md:min-h-[calc(100dvh-56px)]">
              Preparing MindBloom...
            </main>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}
