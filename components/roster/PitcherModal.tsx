'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { EnrichedPitcher } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface Props {
  pitcher: EnrichedPitcher | null;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 font-medium">{value || '—'}</span>
    </div>
  );
}

export function PitcherModal({ pitcher, onClose, isFavorite = false, onToggleFavorite }: Props) {
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
                <div className="md:w-64 shrink-0">
                  <div className="relative aspect-square md:h-full min-h-[200px] bg-gradient-to-br from-[#0A1628] to-[#1E3A5F]">
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

                      {onToggleFavorite && (
                        <button
                          onClick={() => onToggleFavorite(pitcher.pitcher_id)}
                          className={cn(
                            'p-2 rounded-full transition-colors shrink-0',
                            isFavorite ? 'bg-yellow-100 text-yellow-500' : 'bg-slate-100 text-slate-400 hover:text-yellow-500'
                          )}
                        >
                          <svg className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}
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
