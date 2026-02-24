# Sprint 1 (UX Week) - Testing Checklist

## Test Environment
- Browser: Chrome/Firefox/Safari
- Screen sizes: Desktop (1920px), Tablet (768px), Mobile (375px)
- Modes: Light mode, Dark mode

---

## Task 1: Infrastructure ✓

### Zustand Stores
- [ ] Preferences stored in localStorage: `cbb-preferences`
- [ ] Theme persists across refreshes
- [ ] Recent searches tracked (max 5)

### Keyboard Hook
- [ ] Shortcuts fire correctly
- [ ] Modifiers work (Cmd/Ctrl)
- [ ] Doesn't fire when typing in inputs

---

## Task 2: Dark Mode ✓

### Theme Toggle
- [ ] Toggle button visible in navigation
- [ ] Click toggles between light/dark
- [ ] Theme persists on refresh
- [ ] System preference detection works

### Dark Mode Styling
- [ ] All components render correctly in dark mode
- [ ] Text is readable (sufficient contrast)
- [ ] Borders and backgrounds are themed
- [ ] No visual glitches or white flashes

---

## Task 3: Command Palette ✓

### Opening/Closing
- [ ] Cmd+K (Mac) opens palette
- [ ] Ctrl+K (Windows/Linux) opens palette
- [ ] Escape closes palette
- [ ] Click backdrop closes palette

### Search & Navigation
- [ ] Search filters commands in real-time
- [ ] Empty state shows when no results
- [ ] Commands grouped by category
- [ ] Keyboard navigation works (arrows, enter)

---

## Task 4: Navigation Commands ✓

### Command Palette Commands
- [ ] "Go to Schedule" command works
- [ ] "Go to Rosters" command works
- [ ] "Go to Analytics" command works
- [ ] Search finds commands by keywords

### Direct Keyboard Shortcuts
- [ ] Press 1 → Switches to Schedule
- [ ] Press 2 → Switches to Rosters
- [ ] Press 3 → Switches to Analytics
- [ ] URL hash updates correctly

---

## Task 5: Skeleton Loaders ✓

### Loading States
- [ ] Schedule shows skeleton on load
- [ ] Rosters shows skeleton on load
- [ ] Analytics shows skeleton on load
- [ ] Skeletons match actual content layout

### Animation
- [ ] Pulse animation is smooth
- [ ] Works in light mode
- [ ] Works in dark mode
- [ ] No layout shift when content loads

---

## Task 7: Filter Memory ✓

### Persistence
- [ ] Schedule filters persist on refresh
- [ ] Roster filters persist on refresh
- [ ] Each view has independent memory
- [ ] localStorage keys correct

### Restoration Notification
- [ ] Blue banner shows on restore
- [ ] Auto-dismisses after 3 seconds
- [ ] Manual dismiss works
- [ ] Doesn't show if filters are default

### Clear Functionality
- [ ] "Clear all filters" resets filters
- [ ] Clears localStorage data
- [ ] Refresh loads default filters

---

## Task 8: Sticky Headers ✓

### Navigation Bar
- [ ] Sticks to top when scrolling
- [ ] Shadow appears when scrolled
- [ ] Z-index correct (above content)
- [ ] Works on all views

### Tab Bar
- [ ] Sticks below navigation
- [ ] Shadow appears when scrolled
- [ ] Z-index correct (below nav, above content)

### Week Headers (Schedule)
- [ ] Week headers stick when scrolling
- [ ] Stack correctly with nav/tabs
- [ ] Z-index hierarchy correct

---

## Task 10: Empty States ✓

### Schedule View
- [ ] Shows empty state when no games
- [ ] Icon displays correctly
- [ ] "Clear all filters" button works
- [ ] Message is helpful

### Roster View - Teams
- [ ] Shows empty state when no teams
- [ ] "Clear filters" button works

### Roster View - Pitchers
- [ ] Shows empty state when searching
- [ ] Shows empty state for favorites
- [ ] Context-aware messages
- [ ] Action buttons work correctly

---

## Task 11: Keyboard Shortcuts Hint ✓

### First Visit
- [ ] Hints appear on first visit
- [ ] Position: bottom-right corner
- [ ] All shortcuts listed
- [ ] Doesn't block UI

### Dismissal
- [ ] X button dismisses hints
- [ ] "Got it" button dismisses hints
- [ ] Doesn't reappear on refresh
- [ ] Preference saved to localStorage

### Re-showing
- [ ] Cmd+K → search "keyboard" → shows command
- [ ] Command re-enables hints
- [ ] Hints reappear after re-enabling

### Styling
- [ ] Works in light mode
- [ ] Works in dark mode
- [ ] kbd tags are styled correctly
- [ ] Animation is smooth

---

## Cross-Browser Testing

### Chrome
- [ ] All features work
- [ ] No console errors
- [ ] Performance is good

### Firefox
- [ ] All features work
- [ ] No console errors
- [ ] Performance is good

### Safari
- [ ] All features work
- [ ] No console errors
- [ ] Performance is good

---

## Mobile Testing (if applicable)

### Responsive Design
- [ ] Layout adapts to mobile
- [ ] Touch targets are adequate (44px min)
- [ ] Text is readable
- [ ] No horizontal scroll

### Mobile Interactions
- [ ] Tap to open modals
- [ ] Swipe gestures work (if implemented)
- [ ] Keyboard on mobile works

---

## Performance Testing

### Load Times
- [ ] Initial page load < 2 seconds
- [ ] Tab switching is instant
- [ ] Filter updates are fast
- [ ] Command palette opens instantly

### Bundle Size
- [ ] Check bundle size: `npm run build` output
- [ ] Verify no duplicate dependencies
- [ ] Check for unused imports

---

## Accessibility Testing

### Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical
- [ ] Focus indicators are visible
- [ ] No keyboard traps

### Screen Readers
- [ ] Semantic HTML used throughout
- [ ] ARIA labels on icon buttons
- [ ] Alt text on images
- [ ] Announcements for state changes

---

## Final Checks

- [ ] No console errors in production build
- [ ] All features documented
- [ ] Git history is clean
- [ ] All commits have proper messages
- [ ] README updated with new features
