import { Outlet } from "react-router-dom";

import { BottomNav } from "../components/nav/BottomNav";

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-bloom-bg text-bloom-text-primary">
      <div className="mx-auto min-h-dvh w-full max-w-[420px] bg-bloom-bg pb-[76px]">
        <Outlet />
        <BottomNav />
      </div>
    </div>
  );
}
