import DashboardLauncher from "@/components/dashboard/DashboardLauncher";
import EditorStatusControl from "@/components/editor/EditorStatusControl";
import { EditorAccessProvider } from "@/components/editor/EditorAccessProvider";
import SiteAccessGate from "@/components/SiteAccessGate";
import SiteMap from "@/components/map/SiteMap";

export default function Home() {
  return (
    <EditorAccessProvider>
      <SiteAccessGate>
        <main className="min-h-dvh bg-slate-100">
          <header className="flex h-[72px] items-center justify-between border-b bg-white px-4 md:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-900 md:text-xl">
                National Ijtema 2026
              </h1>

              <p className="text-sm text-slate-500">
                Site Progress
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <DashboardLauncher />

              <EditorStatusControl />
            </div>
          </header>

          <SiteMap />
        </main>
      </SiteAccessGate>
    </EditorAccessProvider>
  );
}