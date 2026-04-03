"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { EnrichedPitcher } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { RosterPitcherDataQualityIssue } from "./RosterView";

interface Props {
  pitcher: EnrichedPitcher;
  index: number;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  hasIssue?: boolean;
  issueData?: RosterPitcherDataQualityIssue;
  onIssueToggle?: (
    pitcherId: string,
    pitcherName: string,
    teamId: string,
    teamName: string,
    selectedIssues: string[],
    customNote?: string,
  ) => void;
}

function getHandBadge(
  position: string | null | undefined,
): { label: string; className: string } | null {
  if (!position) return null;
  const pos = position.toUpperCase();
  if (pos.includes("LHP") || pos.includes("LEFT")) {
    return {
      label: "LHP",
      className: "bg-emerald-900/50 text-emerald-400 border-emerald-700",
    };
  }
  if (pos.includes("RHP") || pos.includes("RIGHT")) {
    return {
      label: "RHP",
      className: "bg-blue-900/50 text-blue-400 border-blue-700",
    };
  }
  return {
    label: pos.slice(0, 3),
    className: "bg-slate-700 text-slate-300 border-slate-600",
  };
}

const issueOptions = [
  "Missing headshot",
  "Wrong team",
  "Missing position",
  "Missing height/weight",
  "Missing hometown",
  "Missing bats/throws",
  "Incorrect stats",
  "Misc.",
];

function IssueModal({
  pitcher,
  issueData,
  onIssueToggle,
  onClose,
}: {
  pitcher: EnrichedPitcher;
  issueData?: RosterPitcherDataQualityIssue;
  onIssueToggle: (
    pitcherId: string,
    pitcherName: string,
    teamId: string,
    teamName: string,
    selectedIssues: string[],
    customNote?: string,
  ) => void;
  onClose: () => void;
}) {
  const [selectedIssues, setSelectedIssues] = useState<string[]>(
    issueData?.issues || [],
  );
  const [customNote, setCustomNote] = useState(issueData?.customNote || "");
  const [showCustomInput, setShowCustomInput] = useState(
    (issueData?.issues || []).includes("Misc."),
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleIssueSelect = (issue: string) => {
    if (issue === "Misc.") setShowCustomInput((v) => !v);
    setSelectedIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue],
    );
  };

  const handleSave = () => {
    onIssueToggle(
      pitcher.pitcher_id,
      pitcher.display_name || pitcher.name,
      pitcher.team.team_id,
      pitcher.team.display_name,
      selectedIssues,
      customNote,
    );
    onClose();
  };

  const handleClear = () => {
    onIssueToggle(
      pitcher.pitcher_id,
      pitcher.display_name || pitcher.name,
      pitcher.team.team_id,
      pitcher.team.display_name,
      [],
      "",
    );
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl shadow-black/30 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">
              Data Quality Issues
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-slate-100"
              type="button"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-slate-300 mt-2">
            {pitcher.display_name || pitcher.name} · {pitcher.team.display_name}
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-3">
            {issueOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleIssueSelect(option)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all duration-150",
                  selectedIssues.includes(option)
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "bg-slate-900 border-slate-600 text-slate-200 hover:border-blue-400 hover:bg-slate-700",
                )}
              >
                {option}
              </button>
            ))}
            {showCustomInput && (
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Describe the issue..."
                className="w-full mt-3 p-3 border border-slate-600 rounded-lg bg-slate-900 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex gap-3">
          <button
            onClick={handleClear}
            className="flex-1 px-4 py-3 bg-slate-700 text-slate-200 rounded-lg font-medium hover:bg-slate-600 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PitcherCard({
  pitcher,
  index,
  onClick,
  isFavorite = false,
  onToggleFavorite,
  hasIssue = false,
  issueData,
  onIssueToggle,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [showIssueModal, setShowIssueModal] = useState(false);

  // Only animate first 12 cards for performance
  const shouldAnimate = index < 12;
  const staggerDelay = shouldAnimate ? Math.min(index * 0.03, 0.36) : 0;

  const showHeadshot = pitcher.headshot && !imgError;
  const showTeamLogo = !showHeadshot && pitcher.team.logo;

  const handBadge = getHandBadge(pitcher.position);

  const initials = (pitcher.display_name || pitcher.name)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(pitcher.pitcher_id);
  };

  const handleIssueClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowIssueModal(true);
  };

  // Shared card content
  const cardContent = (
    <div className="rounded-2xl bg-slate-800 shadow-md shadow-black/30 hover:shadow-xl transition-shadow duration-200 overflow-hidden border border-slate-700">
      {/* Headshot / Team logo area */}
      <div className="relative aspect-square bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center overflow-hidden">
        {showHeadshot ? (
          <>
            {imgLoading && (
              <div className="absolute inset-0 bg-slate-700 animate-pulse" />
            )}
            <Image
              src={pitcher.headshot!}
              alt={pitcher.display_name || pitcher.name}
              fill
              className={cn(
                "object-cover transition-opacity duration-300",
                imgLoading ? "opacity-0" : "opacity-100",
                ["294", "132"].includes(pitcher.team.team_id)
                  ? "object-top"
                  : "",
              )}
              onLoad={() => setImgLoading(false)}
              onError={() => {
                setImgError(true);
                setImgLoading(false);
              }}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={index < 4}
              loading={index < 8 ? "eager" : "lazy"}
              quality={75}
            />
          </>
        ) : showTeamLogo ? (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] flex items-center justify-center p-6">
            <Image
              src={pitcher.team.logo!}
              alt={pitcher.team.display_name}
              width={120}
              height={120}
              className="object-contain opacity-80"
              onError={() => {
                /* silent fail */
              }}
              loading={index < 8 ? "eager" : "lazy"}
              quality={85}
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a73e8] to-[#ea4335] flex items-center justify-center">
            <span className="text-white font-bold text-4xl">{initials}</span>
          </div>
        )}

        {/* Favorite button */}
        {onToggleFavorite && (
          <button
            onClick={handleFavoriteClick}
            className={cn(
              "absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-colors z-10",
              isFavorite
                ? "bg-yellow-400/90 text-white"
                : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white",
            )}
          >
            <svg
              className="w-4 h-4"
              fill={isFavorite ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        )}

        {/* Number badge */}
        {pitcher.number && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
            #{pitcher.number}
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="p-3">
        <h3 className="font-bold text-slate-100 text-sm leading-tight truncate">
          {pitcher.display_name || pitcher.name}
        </h3>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {pitcher.team.display_name}
        </p>
        <div className="flex items-center justify-between gap-1.5 mt-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {handBadge && (
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  handBadge.className,
                )}
              >
                {handBadge.label}
              </span>
            )}
            {pitcher.team.conference && (
              <span className="text-[10px] text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full border border-slate-600 truncate">
                {pitcher.team.conference.split(" ").slice(0, 2).join(" ")}
              </span>
            )}
          </div>
          {/* Issue button */}
          {onIssueToggle && (
            <button
              onClick={handleIssueClick}
              className={cn(
                "p-2 rounded-lg transition-all shrink-0",
                hasIssue
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : "bg-slate-700 text-slate-400 hover:bg-slate-600",
              )}
              title="Report data quality issue"
              type="button"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showIssueModal && onIssueToggle && (
        <IssueModal
          pitcher={pitcher}
          issueData={issueData}
          onIssueToggle={onIssueToggle}
          onClose={() => setShowIssueModal(false)}
        />
      )}
    </div>
  );

  // Return with or without animation based on index
  if (shouldAnimate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          delay: staggerDelay,
          ease: "easeOut",
          scale: { duration: 0.25, ease: "easeOut", delay: 0 },
        }}
        whileHover={{ scale: 1.3 }}
        onClick={onClick}
        className="cursor-pointer relative z-0 hover:z-10"
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.3 }}
      transition={{ scale: { duration: 0.25, ease: "easeOut" } }}
      className="cursor-pointer relative z-0 hover:z-10"
    >
      {cardContent}
    </motion.div>
  );
}
