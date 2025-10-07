# Accessibility Compliance (WCAG 2.1 AA)

This document outlines the accessibility features and compliance measures implemented in the application.

## Overview

The application targets **WCAG 2.1 Level AA** compliance to ensure usability for people with disabilities, including those using:
- Screen readers (NVDA, JAWS, VoiceOver)
- Keyboard-only navigation
- High contrast modes
- Screen magnification

## Implemented Features

### 1. **Keyboard Navigation** (WCAG 2.1.1)
- ✅ **Skip to Content Link**: Press `Tab` on page load to reveal skip link
- ✅ **Keyboard Focus Indicators**: All interactive elements have visible focus states
- ✅ **Tab Order**: Logical tab order throughout the application
- ✅ **No Keyboard Traps**: All modals and overlays can be exited with `Esc` key

### 2. **Semantic HTML & Landmarks** (WCAG 1.3.1, 2.4.1)
- ✅ **Proper Document Structure**: `<header>`, `<main>`, `<nav>`, `<aside>`
- ✅ **ARIA Landmarks**: `role="main"`, `role="banner"`, `role="navigation"`
- ✅ **Heading Hierarchy**: Proper `<h1>` through `<h6>` nesting
- ✅ **List Semantics**: `<ul>`, `<ol>`, `<li>` for navigation and lists

### 3. **ARIA Labels & Descriptions** (WCAG 4.1.2)
- ✅ **Icon-Only Buttons**: All buttons with only icons include `aria-label`
- ✅ **Expandable Sections**: `aria-expanded` for collapsible navigation
- ✅ **Dialog Modals**: `role="dialog"`, `aria-modal="true"`, `aria-label`
- ✅ **Decorative Icons**: `aria-hidden="true"` for non-functional icons
- ✅ **Form Labels**: All form inputs have associated labels

### 4. **Color Contrast** (WCAG 1.4.3)
- ✅ **Text Contrast**: Minimum 4.5:1 ratio for normal text
- ✅ **Large Text Contrast**: Minimum 3:1 ratio for large text (18pt+)
- ✅ **Dark Mode Support**: High contrast in both light and dark themes
- ✅ **Focus Indicators**: 2px blue outline with sufficient contrast

### 5. **Responsive & Mobile** (WCAG 1.4.10)
- ✅ **Mobile Touch Targets**: Minimum 44x44px touch areas
- ✅ **Responsive Design**: Content reflows without horizontal scrolling
- ✅ **Pinch-to-Zoom**: Not disabled on mobile
- ✅ **Safe Area Insets**: Proper padding for notched devices

### 6. **Error Handling** (WCAG 3.3.1, 3.3.3)
- ✅ **Form Validation**: Clear error messages with suggestions
- ✅ **Error Identification**: Red highlights and icons
- ✅ **Recovery Suggestions**: Specific guidance for fixing errors
- ✅ **Authentication Errors**: User-friendly messages

### 7. **Loading States** (WCAG 2.2.1)
- ✅ **Progress Indicators**: Visual loading animations
- ✅ **Screen Reader Announcements**: Status updates for async actions
- ✅ **No Timeouts**: No automatic timeouts on user actions

## Component-Specific Accessibility

### SkipToContent
```tsx
// Keyboard users can jump directly to main content
<a href="#main-content">Skip to main content</a>
```

### DashboardLayout
```tsx
// Semantic structure with proper landmarks
<main id="main-content" role="main" aria-label="Main content">
  <Outlet />
</main>
```

### DashboardHeader
```tsx
// Semantic header with proper role
<header role="banner">
  <button aria-label="Open navigation menu" aria-expanded={isOpen}>
    <Menu aria-hidden="true" />
  </button>
</header>
```

### DashboardSidebar
```tsx
// Accessible navigation with proper ARIA
<nav aria-label="Main navigation">
  <button
    aria-expanded={isExpanded}
    aria-label="Analysis frameworks menu"
  >
    Analysis Frameworks
  </button>
</nav>
```

## Testing Checklist

### Keyboard Navigation
- [ ] `Tab` key navigates through all interactive elements
- [ ] `Shift+Tab` navigates backwards
- [ ] `Enter` and `Space` activate buttons
- [ ] `Escape` closes modals and menus
- [ ] Focus is visible on all elements
- [ ] No keyboard traps

### Screen Reader Testing
- [ ] Test with NVDA (Windows)
- [ ] Test with JAWS (Windows)
- [ ] Test with VoiceOver (macOS/iOS)
- [ ] All images have meaningful alt text
- [ ] Headings announce page structure
- [ ] Form labels are properly associated
- [ ] Error messages are announced
- [ ] Loading states are announced

### Visual Testing
- [ ] Zoom to 200% without horizontal scroll
- [ ] High contrast mode works correctly
- [ ] Dark mode has sufficient contrast
- [ ] Focus indicators are visible
- [ ] Text is readable at all sizes

### Mobile Testing
- [ ] Touch targets are at least 44x44px
- [ ] Pinch-to-zoom works
- [ ] Gestures are not required
- [ ] Content reflows properly
- [ ] Forms are usable on small screens

## Known Issues & Future Improvements

### Current Limitations
- ⚠️ Some third-party components (React Force Graph) may not be fully accessible
- ⚠️ Complex data visualizations need additional ARIA descriptions
- ⚠️ PDF exports may need accessibility improvements

### Roadmap
- 🔲 Add more descriptive ARIA labels to data tables
- 🔲 Implement live regions for dynamic content updates
- 🔲 Add keyboard shortcuts documentation
- 🔲 Improve screen reader announcements for complex interactions
- 🔲 Add preference for reduced motion (respects `prefers-reduced-motion`)

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)

## Compliance Statement

This application strives to meet WCAG 2.1 Level AA standards. We are committed to continuous improvement and welcome feedback on accessibility issues.

**Last Updated**: October 2025
**Audited By**: Development Team
**Next Audit**: TBD

## Contact

For accessibility questions or to report issues:
- GitHub Issues: [researchtoolspy/issues](https://github.com/gitayam/researchtoolspy/issues)
- Label: `accessibility`
