import { HashRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { FontScaleProvider } from "./context/FontScaleContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";
import { WeekStartProvider } from "./context/WeekStartContext";
import { DataStoreProvider } from "./store/DataStore";
import { ConfirmDialogProvider } from "./components/ConfirmDialog";
import AutoBackupRunner from "./components/AutoBackupRunner";
import { api } from "./lib/api";
import LockScreen from "./pages/LockScreen";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AddExpense from "./pages/AddExpense";
import Search from "./pages/Search";
import AllExpenses from "./pages/AllExpenses";
import CalendarPage from "./pages/CalendarPage";
import PlannedPurchases from "./pages/PlannedPurchases";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Guide from "./pages/Guide";

function AppContent() {
  const { isLocked, loading } = useAuth();

  // بمجرد ما نعرف هل التطبيق مقفول أو لأ (أي أول شاشة حقيقية جاهزة للعرض،
  // سواء LockScreen أو الصفحات نفسها)، نطلب إغلاق نافذة splash وإظهار
  // النافذة الرئيسية. هذا يغطي الحالتين معاً بخلاف وضعها داخل Layout فقط
  // (الذي لا يُعرض أصلاً لو كان التطبيق مقفولاً بكلمة سر).
  useEffect(() => {
    if (!loading) {
      api.closeSplashscreen();
    }
  }, [loading]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="text-muted">Loading...</span>
      </div>
    );
  }

  if (isLocked) return <LockScreen />;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="add" element={<AddExpense />} />
        <Route path="search" element={<Search />} />
        <Route path="expenses" element={<AllExpenses />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="planned" element={<PlannedPurchases />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="guide" element={<Guide />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <FontScaleProvider>
        <AuthProvider>
          <WeekStartProvider>
            <DataStoreProvider>
              {/* يشغّل فحص/تصدير النسخة الاحتياطية التلقائية فور بدء تشغيل التطبيق،
                  بدل ما يستنى لحد ما المستخدم يفتح صفحة Settings → Backup بنفسه */}
              <AutoBackupRunner />
              <ConfirmDialogProvider>
                <SidebarProvider>
                  {/* HashRouter لأن Tauri يحمّل الملفات من file:// وليس سيرفر حقيقي */}
                  <HashRouter>
                    <AppContent />
                  </HashRouter>
                </SidebarProvider>
              </ConfirmDialogProvider>
            </DataStoreProvider>
          </WeekStartProvider>
        </AuthProvider>
      </FontScaleProvider>
    </ThemeProvider>
  );
}
