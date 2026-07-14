import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { ChapterPage } from "./app/ChapterPage";
import { Home } from "./app/Home";
import { LessonPage } from "./app/LessonPage";
import { ReviewPage } from "./app/ReviewPage";
import { SettingsPage } from "./app/SettingsPage";
import { StatsPage } from "./app/StatsPage";
import { TopBar } from "./components/TopBar";
import { useApp } from "./store/useApp";

export default function App() {
  const ready = useApp((s) => s.ready);
  const init = useApp((s) => s.init);
  const { pathname } = useLocation();

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!ready) return <div className="wrap" />;

  const inSession = pathname.includes("/lesson/") || pathname.endsWith("/practice") || pathname === "/review";

  return (
    <div className="wrap">
      {!inSession && <TopBar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chapter/:n" element={<ChapterPage />} />
        <Route path="/chapter/:n/lesson/:i" element={<LessonPage />} />
        <Route path="/chapter/:n/practice" element={<LessonPage practice />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
