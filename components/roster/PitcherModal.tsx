'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { EnrichedPitcher } from '@/lib/supabase/types';
import { RosterPitcherDataQualityIssue } from './RosterView';
import { cn } from '@/lib/utils';

interface Props {
  pitcher: EnrichedPitcher | null;
  onClose: () => void;
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
    customNote?: string
  ) => void;
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 font-medium">{value || '—'}</span>
    </div>
  );
}

export function PitcherModal({ pitcher, onClose, isFavorite = false, onToggleFavorite, hasIssue = false, issueData, onIssueToggle }: Props) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [pitcher]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (pitcher) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [pitcher]);

  const showHeadshot = pitcher?.headshot && !imgError;
  const showTeamLogo = !showHeadshot && pitcher?.team.logo;

  const initials = pitcher
    ? (pitcher.display_name || pitcher.name)
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '';

  return (
    <AnimatePresence>
      {pitcher && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/10 hover:bg-black/20 text-slate-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex flex-col md:flex-row overflow-y-auto max-h-[90vh]">
                {/* Left: Photo */}
                <div className="md:w-64 shrink-0 overflow-hidden">
                  <div className="relative aspect-square md:aspect-auto md:h-full min-h-[200px] bg-gradient-to-br from-[#0A1628] to-[#1E3A5F]">
                    {showHeadshot ? (
                      <Image
                        src={pitcher.headshot!}
                        alt={pitcher.display_name || pitcher.name}
                        fill
                        className="object-cover"
                        onError={() => setImgError(true)}
                      />
                    ) : showTeamLogo ? (
                      <div className="absolute inset-0 flex items-center justify-center p-8">
                        <Image
                          src={pitcher.team.logo!}
                          alt={pitcher.team.display_name}
                          width={160}
                          height={160}
                          className="object-contain opacity-80"
                          onError={() => {/* silent */}}
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white font-bold text-6xl">{initials}</span>
                      </div>
                    )}

                    {/* Gradient overlay at bottom */}
                    <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />

                    {/* Number badge on photo */}
                    {pitcher.number && (
                      <div className="absolute bottom-3 left-3 bg-white/20 backdrop-blur-sm text-white text-sm font-bold px-3 py-1 rounded-full">
                        #{pitcher.number}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Details */}
                <div className="flex-1 p-6 overflow-y-auto">
                  {/* Header */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                          {pitcher.display_name || pitcher.name}
                        </h2>
                        <p className="text-slate-500 mt-1">{pitcher.team.display_name}</p>
                        {pitcher.team.conference && (
                          <p className="text-xs text-slate-400 mt-0.5">{pitcher.team.conference}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {onToggleFavorite && (
                          <button
                            onClick={() => onToggleFavorite(pitcher.pitcher_id)}
                            className={cn(
                              'p-2 rounded-full transition-colors',
                              isFavorite ? 'bg-yellow-100 text-yellow-500' : 'bg-slate-100 text-slate-400 hover:text-yellow-500'
                            )}
                          >
                            <svg className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                        )}
                        {onIssueToggle && (
                          <PitcherIssueButton
                            pitcherId={pitcher.pitcher_id}
                            pitcherName={pitcher.display_name || pitcher.name}
                            teamId={pitcher.team_id}
                            teamName={pitcher.team.display_name}
                            hasIssue={hasIssue}
                            issueData={issueData}
                            onIssueToggle={onIssueToggle}
                          />
                        )}
                      </div>
                    </div>

                    {/* Position badge */}
                    {pitcher.position && (
                      <div className="mt-3">
                        <span className={cn(
                          'text-xs font-bold px-3 py-1 rounded-full border',
                          pitcher.position.toUpperCase().includes('LHP')
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        )}>
                          {pitcher.position}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-0">
                    <DetailRow label="Jersey" value={pitcher.number ? `#${pitcher.number}` : null} />
                    <DetailRow label="Position" value={pitcher.position} />
                    <DetailRow label="Year" value={pitcher.year} />
                    <DetailRow label="Height" value={pitcher.height} />
                    <DetailRow label="Weight" value={pitcher.weight} />
                    <DetailRow label="Hometown" value={pitcher.hometown} />
                    <DetailRow label="Bats/Throws" value={pitcher.bats_throws} />
                  </div>

                  {/* ESPN Link */}
                  {pitcher.espn_link && (
                    <div className="mt-6">
                      <a
                        href={pitcher.espn_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        View on ESPN
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Pitcher Issue Button Component
function PitcherIssueButton({
  pitcherId,
  pitcherName,
  teamId,
  teamName,
  hasIssue,
  issueData,
  onIssueToggle,
}: {
  pitcherId: string;
  pitcherName: string;
  teamId: string;
  teamName: string;
  hasIssue: boolean;
  issueData?: RosterPitcherDataQualityIssue;
  onIssueToggle: (
    pitcherId: string,
    pitcherName: string,
    teamId: string,
    teamName: string,
    selectedIssues: string[],
    customNote?: string
  ) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Track if component is mounted (for SSR compatibility)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state with props when modal opens
  useEffect(() => {
    if (showMenu) {
      setSelectedIssues(issueData?.issues || []);
      setCustomNote(issueData?.customNote || '');
      setShowCustomInput((issueData?.issues || []).includes('Misc.'));
    }
  }, [showMenu, issueData]);

  const issueOptions = [
    'Missing headshot',
    'Wrong team',
    'Missing position',
    'Missing height/weight',
    'Missing hometown',
    'Missing bats/throws',
    'Incorrect stats',
    'Try Rescraping for All Data',
    'Try Rescraping for Headshot Data',
    'Misc.',
  ];

  const handleIssueSelect = (issue: string) => {
    if (issue === 'Misc.') {
      setShowCustomInput(!showCustomInput);
    }

    setSelectedIssues(prev => {
      if (prev.includes(issue)) {
        return prev.filter(i => i !== issue);
      } else {
        return [...prev, issue];
      }
    });
  };

  const handleSave = () => {
    onIssueToggle(pitcherId, pitcherName, teamId, teamName, selectedIssues, customNote);
    setShowMenu(false);
  };

  const handleClear = () => {
    setSelectedIssues([]);
    setCustomNote('');
    setShowCustomInput(false);
    onIssueToggle(pitcherId, pitcherName, teamId, teamName, [], '');
    setShowMenu(false);
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={cn(
          'p-2 rounded-full transition-all',
          hasIssue
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-300'
        )}
        aria-label="Report pitcher data quality issue"
        type="button"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </button>

      {showMenu && mounted && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Pitcher Data Quality Issues</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-700 hover:text-slate-900 flex-shrink-0"
                  aria-label="Close modal"
                  type="button"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">{pitcherName} - {teamName}</p>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-3">
                {issueOptions.map(option => (
                  <label
                    key={option}
                    className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 rounded-lg transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIssues.includes(option)}
                      onChange={() => handleIssueSelect(option)}
                      className="w-5 h-5 text-blue-600 bg-white border-2 border-slate-300 rounded cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 checked:bg-blue-600 checked:border-blue-600 accent-blue-600"
                    />
                    <span className="text-base text-slate-700">{option}</span>
                  </label>
                ))}

                {showCustomInput && (
                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Describe the issue..."
                    className="w-full mt-3 p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
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
        document.body
      )}
    </>
  );
}
