import { AuthGuard } from "@/components/auth/AuthGuard";
import { BottomNav } from "@/components/layout/BottomNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-stone-50">
        <main className="pb-24 max-w-lg mx-auto">
          {children}
        </main>
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
