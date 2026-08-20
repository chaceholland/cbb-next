"use client";
import { useState, useEffect } from "react";
import { Navigation, TabBar, HeroSection } from "@/components/shared";
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
import { useGameFavorites } from "@/lib/hooks/useGameFavorites";
import { useFollows } from "@/lib/hooks/useFollows";
import { FollowView } from "@/components/follow/FollowView";

type Tab = "schedule" | "rosters" | "analytics" | "favorites" | "follow";

const TABS: { id: Tab; label: string }[] = [
  { id: "schedule", label: "📅 Schedule" },
  { id: "rosters", label: "⚾ Rosters" },
  { id: "analytics", label: "📊 Analytics" },
  { id: "favorites", label: "★ Favorites" },
  { id: "follow", label: "👤 Follow" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const { favorites, toggleFavorite } = useFavorites();
  const { favoriteGameIds, toggleFavoriteGame } = useGameFavorites();
  const { follows, toggleFollow } = useFollows();
  const [activateFavorites, setActivateFavorites] = useState(false);

  // Sync tab with URL hash
  useEffect(() => {
    const isTab = (v: string): v is Tab =>
      v === "schedule" ||
      v === "rosters" ||
      v === "analytics" ||
      v === "favorites" ||
      v === "follow";
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
    { key: "5", action: () => handleTabChange("follow") },
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
      <TabBar items={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="min-h-screen bg-slate-900">
        <div
          className={`mx-auto px-4 py-8 ${activeTab === "schedule" ? "max-w-[1600px]" : "max-w-7xl"}`}
        >
          {activeTab === "schedule" && (
            <ScheduleView
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              favoriteGameIds={favoriteGameIds}
              toggleFavoriteGame={toggleFavoriteGame}
            />
          )}
          {activeTab === "rosters" && (
            <RosterView
              activateFavorites={activateFavorites}
              onFavoritesActivated={() => setActivateFavorites(false)}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
            />
          )}
          {activeTab === "analytics" && <AnalyticsView />}
          {activeTab === "follow" && (
            <FollowView follows={follows} toggleFollow={toggleFollow} />
          )}
          {activeTab === "favorites" && (
            <FavoritesView
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              favoriteGameIds={favoriteGameIds}
              toggleFavoriteGame={toggleFavoriteGame}
            />
          )}
        </div>
      </main>
    </>
  );
}
