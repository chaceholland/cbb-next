'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { EnrichedPitcher } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface Props {
  pitcher: EnrichedPitcher;
  index: number;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

function getHandBadge(position: string | null | undefined): { label: string; className: string } | null {
  if (!position) return null;
  const pos = position.toUpperCase();
  if (pos.includes('LHP') || pos.includes('LEFT')) {
    return { label: 'LHP', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
  if (pos.includes('RHP') || pos.includes('RIGHT')) {
    return { label: 'RHP', className: 'bg-blue-100 text-blue-700 border-blue-200' };
  }
  return { label: pos.slice(0, 3), className: 'bg-slate-100 text-slate-600 border-slate-200' };
}

export function PitcherCard({ pitcher, index, onClick, isFavorite = false, onToggleFavorite }: Props) {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  // Only animate first 12 cards for performance
  const shouldAnimate = index < 12;
  const staggerDelay = shouldAnimate ? Math.min(index * 0.03, 0.36) : 0;

  const showHeadshot = pitcher.headshot && !imgError;
  const showTeamLogo = !showHeadshot && pitcher.team.logo;

  const handBadge = getHandBadge(pitcher.position);

  const initials = (pitcher.display_name || pitcher.name)
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(pitcher.pitcher_id);
  };

  // Shared card content
  const cardContent = (
      <div className="rounded-2xl bg-white shadow-md hover:shadow-xl transition-shadow duration-200 overflow-hidden border border-slate-100">
        {/* Headshot / Team logo area */}
        <div className="relative aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
          {showHeadshot ? (
            <>
              {imgLoading && (
                <div className="absolute inset-0 bg-slate-200 animate-pulse" />
              )}
              <Image
                src={pitcher.headshot!}
                alt={pitcher.display_name || pitcher.name}
                fill
                className={cn(
                  'object-cover transition-opacity duration-300',
                  imgLoading ? 'opacity-0' : 'opacity-100'
                )}
                onLoad={() => setImgLoading(false)}
                onError={() => { setImgError(true); setImgLoading(false); }}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                priority={index < 4}
                loading={index < 8 ? 'eager' : 'lazy'}
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
                onError={() => {/* silent fail */}}
                loading={index < 8 ? 'eager' : 'lazy'}
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
                'absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-colors z-10',
                isFavorite
                  ? 'bg-yellow-400/90 text-white'
                  : 'bg-black/30 text-white/70 hover:bg-black/50 hover:text-white'
              )}
            >
              <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
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
          <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">
            {pitcher.display_name || pitcher.name}
          </h3>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {pitcher.team.display_name}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {handBadge && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', handBadge.className)}>
                {handBadge.label}
              </span>
            )}
            {pitcher.team.conference && (
              <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200 truncate">
                {pitcher.team.conference.split(' ').slice(0, 2).join(' ')}
              </span>
            )}
          </div>
        </div>
      </div>
  );

  // Return with or without animation based on index
  if (shouldAnimate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: staggerDelay, ease: 'easeOut' }}
        whileHover={{ y: -4, transition: { duration: 0.15 } }}
        onClick={onClick}
        className="cursor-pointer"
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <div onClick={onClick} className="cursor-pointer">
      {cardContent}
    </div>
  );
}
