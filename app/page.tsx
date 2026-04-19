"use client";
import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { HeroSection } from "@/components/HeroSection";
import { TabBar } from "@/components/TabBar";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { FavoritesView } from "@/components/schedule/FavoritesView";
import { RosterView } from "@/components/roster/RosterView";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { CommandPalette } from "@/components/command/CommandPalette";
import { KeyboardHints } from "@/components/KeyboardHints";
import { registerNavigationCommands } from "@/lib/commands/navigation";
import { registerHelpCommands } from "@/lib/commands/help";
import { useKeyboard } from "@/lib/hooks/useKeyboard";
import { useFavorites } from "@/lib/hooks/useFavorites";

type Tab = "schedule" | "rosters" | "analytics" | "favorites";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const { favorites, toggleFavorite } = useFavorites();
  const [activateFavorites, setActivateFavorites] = useState(false);

  // Sync tab with URL hash
  useEffect(() => {
    const isTab = (v: string): v is Tab =>
      v === "schedule" ||
      v === "rosters" ||
      v === "analytics" ||
      v === "favorites";
    const hash = window.location.hash.slice(1);
    if (isTab(hash)) setActiveTab(hash);

    const handler = () => {
      const h = window.location.hash.slice(1);
      if (isTab(h)) setActiveTab(h);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Register navigation and help commands on mount
  useEffect(() => {
    registerNavigationCommands(handleTabChange);
    registerHelpCommands();
  }, []);

  // Add keyboard shortcuts for direct tab switching
  useKeyboard([
    { key: "1", action: () => handleTabChange("schedule") },
    { key: "2", action: () => handleTabChange("rosters") },
    { key: "3", action: () => handleTabChange("analytics") },
    { key: "4", action: () => handleTabChange("favorites") },
  ]);

  return (
    <>
      <CommandPalette />
      <KeyboardHints />
      <Navigation
        favoritesCount={favorites.length}
        onFavoritesClick={() => {
          setActivateFavorites(true);
          handleTabChange("rosters");
        }}
      />
      <HeroSection />
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="min-h-screen bg-slate-900">
        <div className={`mx-auto px-4 py-8 ${activeTab === "schedule" ? "max-w-[1600px]" : "max-w-7xl"}`}>
          {activeTab === "schedule" && <ScheduleView favorites={favorites} toggleFavorite={toggleFavorite} />}
          {activeTab === "rosters" && (
            <RosterView
              activateFavorites={activateFavorites}
              onFavoritesActivated={() => setActivateFavorites(false)}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
            />
          )}
          {activeTab === "analytics" && <AnalyticsView />}
          {activeTab === "favorites" && (
            <FavoritesView
              favorites={favorites}
              toggleFavorite={toggleFavorite}
            />
          )}
        </div>
      </main>
    </>
  );
}
