# CBB Pitcher Tracker

A modern Next.js application for tracking college baseball pitchers across 64 D1 teams, featuring real-time game schedules, detailed rosters, and performance analytics.

## Features

### Sprint 1: UX Improvements

#### User Experience
- **Dark Mode**: Toggle between light and dark themes with persistent preference
- **Command Palette**: Universal search and navigation with Cmd+K / Ctrl+K
- **Keyboard Shortcuts**: Navigate with 1, 2, 3 keys for tab switching
- **Skeleton Loaders**: Content-aware loading states for better perceived performance
- **Empty States**: Helpful messages and recovery actions when no results found
- **Sticky Headers**: Navigation and tabs stay visible while scrolling
- **Filter Memory**: Your last filter selections are remembered per view
- **Keyboard Hints**: First-visit guide showing all available shortcuts

### Sprint 2: Stats & Performance Analysis

- **Pitcher Statistics**: Complete stats calculation engine with ERA, WHIP, K/9, BB/9, K/BB
- **Leaderboards**: Top 10 pitchers across 6 statistical categories with minimum IP qualifications
- **Team Records**: Win-loss records, home/away splits, win/loss streaks
- **Conference Standings**: Real-time standings for all conferences sorted by win percentage
- **Performance Charts**: Visual ERA and K/9 trends using Recharts
- **Pitcher Modal Stats**: Dedicated Stats tab with season totals, recent form, and performance charts
- **Schedule Integration**: Team records displayed alongside game matchups
- **Analytics Dashboard**: Comprehensive leaderboards integrated into analytics view

### Keyboard Shortcuts
- `Cmd+K` / `Ctrl+K` - Open command palette
- `1`, `2`, `3` - Switch between Schedule, Rosters, Analytics tabs
- `/` - Focus search input (coming soon)
- `Esc` - Close modals and command palette

### Command Palette
Search and navigate from anywhere:
- Navigate to any view (Schedule, Rosters, Analytics)
- Toggle dark mode
- Show keyboard shortcuts
- Search teams, pitchers, games (coming soon)
- Filter shortcuts (coming soon)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
