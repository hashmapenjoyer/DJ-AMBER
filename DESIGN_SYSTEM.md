# DJ-AMBER Design System Guide

## Overview

This design system provides a unified set of styles, variables, and components that all team members should use to ensure visual and aesthetic consistency across the entire application.

**File Location:** `src/styles/design-system.css`

## How to Use

### 1. Import the Design System

In your component files or CSS files, import the design system at the top:

```css
/* In your component's CSS file */
@import '../../styles/design-system.css';
```

Or in your main component file:

```tsx
// In your component.tsx
import '../../styles/design-system.css';
```

### 2. Use CSS Variables

All design tokens are available as CSS custom properties (variables). Access them using `var()`:

```css
.my-component {
  color: var(--text-primary);
  background-color: var(--bg-secondary);
  padding: var(--space-4);
  border-radius: var(--br-md);
}
```

### 3. Use Utility Classes

Pre-made utility classes are available for quick styling:

```html
<div class="card">
  <div class="card-header">
    <h2>My Section</h2>
  </div>
  <div class="card-body">
    <p class="text-secondary mb-4">Some description</p>
    <button class="btn btn-primary">Click me</button>
  </div>
</div>
```

---

## Colors

### Primary Palette
- **Primary**: `--color-primary` (#1a73e8) - Main brand color
- **Primary Light**: `--color-primary-light` (#5b9bff)
- **Primary Dark**: `--color-primary-dark` (#1557b0)

```css
.element {
  background-color: var(--color-primary);
  color: var(--color-white);
}
```

### Status Colors
- **Success**: `--color-success` (#34a853) - For positive actions/states
- **Warning**: `--color-warning` (#fbbc04) - For cautionary messages
- **Error**: `--color-error` (#ea4335) - For errors/alerts
- **Accent**: `--color-accent` (#ff6b35) - For emphasis/highlights

### Semantic Backgrounds
- `--bg-primary` - Most common background
- `--bg-secondary` - Secondary/nested elements
- `--bg-tertiary` - Tertiary/deep nested elements
- `--bg-light` - Light backgrounds

### Text Colors
- `--text-primary` - Main content text
- `--text-secondary` - Secondary text, less prominent
- `--text-tertiary` - Tertiary text, least prominent
- `--text-disabled` - Disabled states

### Neutral Grays
`--color-gray-50` through `--color-gray-900` for flexible grayscale options

---

## Typography

### Font Sizes
Use these predefined sizes for consistency:

```css
/* Available sizes in pixels */
--fs-xs: 0.75rem;       /* 12px */
--fs-sm: 0.875rem;      /* 14px */
--fs-base: 1rem;        /* 16px */
--fs-lg: 1.125rem;      /* 18px */
--fs-xl: 1.25rem;       /* 20px */
--fs-2xl: 1.5rem;       /* 24px */
--fs-3xl: 1.875rem;     /* 30px */
--fs-4xl: 2.25rem;      /* 36px */
--fs-5xl: 3rem;         /* 48px */
```

**Usage:**
```css
.section-title {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
}

.section-subtitle {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
}

.helper-text {
  font-size: var(--fs-sm);
  color: var(--text-tertiary);
}
```

### Font Weights
- `--fw-light`: 300
- `--fw-normal`: 400
- `--fw-medium`: 500
- `--fw-semibold`: 600
- `--fw-bold`: 700
- `--fw-extrabold`: 800

### Line Heights
- `--lh-tight`: 1.2 - For headings
- `--lh-normal`: 1.5 - For body text
- `--lh-relaxed`: 1.75 - For longer content
- `--lh-loose`: 2 - For accessibility

---

## Spacing

Use spacing variables for all padding, margin, and gaps:

```css
/* Scale in rems (multiply by 16 for pixels) */
--space-1: 0.25rem;     /* 4px */
--space-2: 0.5rem;      /* 8px */
--space-3: 0.75rem;     /* 12px */
--space-4: 1rem;        /* 16px */
--space-6: 1.5rem;      /* 24px */
--space-8: 2rem;        /* 32px */
--space-10: 2.5rem;     /* 40px */
--space-12: 3rem;       /* 48px */
```

**Usage:**
```css
.card {
  padding: var(--space-6);
  margin-bottom: var(--space-4);
  gap: var(--space-2);
}
```

### Utility Classes for Spacing

```html
<!-- Margin Top -->
<div class="mt-4">Content</div>

<!-- Margin Bottom -->
<div class="mb-6">Content</div>

<!-- Padding -->
<div class="p-4">Content</div>
```

---

## Border Radius

Round corners consistently:

```css
--br-none: 0
--br-sm: 0.25rem;       /* 4px */
--br-base: 0.375rem;    /* 6px */
--br-md: 0.5rem;        /* 8px */
--br-lg: 0.75rem;       /* 12px */
--br-xl: 1rem;          /* 16px */
--br-2xl: 1.5rem;       /* 24px */
--br-full: 9999px;      /* Pill-shaped */
```

**Usage:**
```css
.rounded-button {
  border-radius: var(--br-lg);
}

.pill-element {
  border-radius: var(--br-full);
}
```

---

## Shadows

Add depth with consistent shadows:

```css
--shadow-sm:   0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
--shadow-md:   0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg:   0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl:   0 20px 25px -5px rgba(0, 0, 0, 0.1);
--shadow-2xl:  0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

**Usage:**
```css
.card {
  box-shadow: var(--shadow-md);
}

.card:hover {
  box-shadow: var(--shadow-lg);
}
```

---

## Components

### Buttons

Use predefined button styles:

```html
<!-- Primary Button -->
<button class="btn btn-primary">Primary Action</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Secondary Action</button>

<!-- Accent Button -->
<button class="btn btn-accent">Highlight Action</button>

<!-- Success Button -->
<button class="btn btn-success">Confirm</button>

<!-- Error Button -->
<button class="btn btn-error">Delete</button>

<!-- Outline Button -->
<button class="btn btn-outline">Outline</button>

<!-- Size Variants -->
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary">Normal</button>
<button class="btn btn-primary btn-lg">Large</button>

<!-- Disabled State -->
<button class="btn btn-primary" disabled>Disabled</button>
```

### Cards

Structure your content with cards:

```html
<div class="card">
  <div class="card-header">
    <h3>Card Title</h3>
  </div>
  <div class="card-body">
    <p>Card content goes here</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

### Badges

Use badges for tags and status indicators:

```html
<!-- Standard Badge -->
<span class="badge">New</span>

<!-- Status Badges -->
<span class="badge badge-success">Active</span>
<span class="badge badge-warning">Pending</span>
<span class="badge badge-error">Failed</span>
<span class="badge badge-gray">Inactive</span>
```

### Forms

Style inputs consistently:

```html
<input type="text" placeholder="Enter text">
<textarea placeholder="Enter description"></textarea>
<select>
  <option>Choose an option</option>
</select>
```

---

## Utilities

### Text Utilities

```html
<!-- Colors -->
<p class="text-primary">Primary text</p>
<p class="text-secondary">Secondary text</p>
<p class="text-accent">Accent text</p>
<p class="text-success">Success text</p>
<p class="text-error">Error text</p>

<!-- Alignment -->
<p class="text-center">Centered</p>
<p class="text-left">Left aligned</p>
<p class="text-right">Right aligned</p>

<!-- Weight -->
<p class="text-normal">Normal weight</p>
<p class="text-semibold">Semibold weight</p>
<p class="text-bold">Bold weight</p>
```

### Flexbox Utilities

```html
<!-- Flex Container -->
<div class="flex">Items</div>

<!-- Flex with Direction -->
<div class="flex flex-col">Column</div>
<div class="flex flex-row">Row</div>

<!-- Flex Alignment -->
<div class="flex-center">Centered content</div>
<div class="flex-between">Space between items</div>

<!-- Flex Gap -->
<div class="flex flex-gap-2">Small gap</div>
<div class="flex flex-gap-4">Large gap</div>
```

### Display Utilities

```html
<!-- Visibility -->
<div class="hidden">Hidden element</div>
<div class="block">Block element</div>

<!-- Opacity -->
<div class="opacity-50">50% opacity</div>
<div class="opacity-75">75% opacity</div>
<div class="opacity-100">Full opacity</div>
```

---

## Transitions

Use consistent animation timings:

```css
--transition-fast: 150ms ease-in-out;
--transition-base: 250ms ease-in-out;
--transition-slower: 350ms ease-in-out;
--transition-slowest: 500ms ease-in-out;
```

**Usage:**
```css
.button {
  transition: background-color var(--transition-base);
}

.button:hover {
  background-color: var(--color-primary-dark);
}
```

---

## Z-Index Scale

Maintain stacking order:

```css
--z-hide: -1              /* Below everything */
--z-auto: auto            /* Auto detection */
--z-base: 0               /* Base layer */
--z-dropdown: 1000        /* Dropdowns */
--z-sticky: 1010          /* Sticky elements */
--z-fixed: 1020           /* Fixed elements */
--z-modal-backdrop: 1030  /* Modal backdrop */
--z-modal: 1040           /* Modals */
--z-popover: 1050         /* Popovers */
--z-tooltip: 1060         /* Tooltips */
--z-notification: 1070    /* Notifications */
```

---

## Best Practices

### ✅ Do:
- Use variables instead of hardcoded values
- Use utility classes for common patterns
- Use consistent spacing (always use `--space-*` variables)
- Reference the design system before creating new styles
- Keep accessibility in mind (color contrast, focus states)

### ❌ Don't:
- Hardcode colors (#ff0000, rgb(255,0,0), etc.)
- Use arbitrary margin/padding values (10px, 15px, etc.)
- Create custom button styles (use `.btn` classes)
- Override design system variables without team discussion

---

## Example Component

Here's an example of a properly styled component using the design system:

```tsx
import './MySection.css';

export default function MySection() {
  return (
    <div className="my-section">
      <h2>Section Title</h2>
      <p className="text-secondary mb-4">Description text</p>
      
      <div className="card">
        <div className="card-body flex flex-gap-4">
          <input type="text" placeholder="Enter text" />
          <button className="btn btn-primary">Submit</button>
        </div>
      </div>
      
      <div className="flex flex-gap-2 mt-6">
        <span className="badge badge-success">Active</span>
        <span className="badge badge-warning">Pending</span>
      </div>
    </div>
  );
}
```

```css
/* MySection.css */
@import '../../styles/design-system.css';

.my-section {
  padding: var(--space-6);
  background-color: var(--bg-primary);
}

.my-section h2 {
  color: var(--color-primary);
  margin-bottom: var(--space-2);
}
```

---

## Questions or Updates?

If you need to add new variables or update the design system, coordinate with the team to ensure all components remain consistent.

Enjoy building! 🎨
