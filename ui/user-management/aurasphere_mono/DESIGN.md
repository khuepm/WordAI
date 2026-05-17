# Design System Specification: The Ethereal Editor

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Curator"**

This design system moves away from the cluttered, utility-first interfaces of traditional word processors toward a "Focus-first" editorial experience. The goal is to eliminate the "software" feel and replace it with a "workspace" feel. We achieve this through **Intentional Asymmetry** and **Tonal Depth**—breaking the rigid 12-column grid to allow text to breathe, using wide margins and off-center alignments that mimic high-end print journalism. 

The system rejects the "box-in-a-box" layout. Instead, it treats the UI as a series of fluid, overlapping sheets of digital paper. We prioritize the "AuraSphere" concept: AI is not a sidebar tool but a soft, glowing presence that emerges from the negative space when needed, then recedes into the background to preserve the user's flow.

---

## 2. Colors & Surface Philosophy
The palette is built on a foundation of sophisticated neutrals, punctuated by a "Liquid Intelligence" accent.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders for sectioning or containment. 
Structure must be defined through:
1.  **Tonal Shifts:** Placing a `surface-container-low` element against a `surface` background.
2.  **Negative Space:** Using the Spacing Scale (specifically `8` to `12`) to create mental boundaries.
3.  **Soft Shadows:** Diffused depth that implies a boundary without drawing a line.

### Surface Hierarchy & Nesting
Treat the interface as a physical stack. 
*   **Base Layer:** `surface` (#f8f9fa).
*   **The Canvas:** `surface-container-lowest` (#ffffff). This is where the writing happens.
*   **Secondary Context:** `surface-container` (#edeeef) for navigation or secondary panels.
*   **AI Interactions:** Use `primary` (#4343d5) and `primary-container` (#5d5fef) only for moments of AI intervention.

### The "Glass & Gradient" Rule
To achieve the "Liquid Data" feel, floating elements (modals, AI suggestions) must use **Glassmorphism**. Apply `surface-container-lowest` at 80% opacity with a `20px` backdrop-blur. 
**Signature Texture:** Use a subtle linear gradient from `primary` to `primary-container` (at a 135° angle) for high-intent actions. This provides a "glow" that feels alive, unlike static flat colors.

---

## 3. Typography
We employ a high-contrast typographic pairing to distinguish between the *system* and the *creation*.

*   **The System (UI):** `Manrope` (Sans-Serif). Clean, geometric, and modern. Used for navigation, labels, and metadata.
    *   *Headline-LG:* 2rem, tight tracking (-0.02em).
    *   *Label-MD:* 0.75rem, uppercase with +0.05em tracking for architectural clarity.
*   **The Creation (Editor):** `Newsreader` (Serif). An elegant, highly readable editorial face that encourages long-form thought.
    *   *Body-LG:* 1rem, line-height 1.6. This is the "Golden Ratio" for the writing experience.
    *   *Title-LG:* 1.375rem. Used for document headers to feel like a published manuscript.

---

## 4. Elevation & Depth
Depth is not a decoration; it is information.

### The Layering Principle
Avoid shadows for static elements. Instead, stack containers:
*   Place an `outline-variant` ghost-border (10% opacity) around a `surface-container-high` card to give it a "paper-thin" edge against a `surface` background.

### Ambient Shadows
For "AuraSphere" components (floating AI suggestions):
*   **Blur:** 40px - 60px.
*   **Spread:** -5px.
*   **Color:** `on-surface` at 4% opacity, or `primary` at 8% opacity for AI-specific "glows." This mimics natural light diffusion.

### The "Ghost Border" Fallback
If contrast ratios fail, use a 1px border using `outline-variant` at 15% opacity. Never use a solid grey line.

---

## 5. Components

### The Fluid Button
*   **Primary:** `primary` background, `on-primary` text. No border. Radius: `md` (0.75rem). 
*   **Interaction:** On hover, the button should transition to `primary-container` with a subtle `primary` outer glow (4px blur).
*   **States:** Use `surface-tint` for pressed states to simulate "liquid" displacement.

### AuraSphere Suggestions (Custom Component)
Instead of a standard dropdown, AI suggestions appear as glassmorphic "bubbles" that bleed into the editor background.
*   **Background:** `surface-container-lowest` at 70% opacity + backdrop-blur.
*   **Shadow:** `primary` tinted ambient shadow (8%).
*   **Separation:** No dividers. Use `3` (1rem) spacing between suggestion items.

### Input Fields & Text Areas
*   **Inactive:** `surface-container-low` background. No border.
*   **Focus:** Shifts to `surface-container-lowest`. A soft `primary` glow (2px) appears only on the bottom edge to indicate an active "line of thought."
*   **Error:** Background shifts to `error-container`, text to `on-error-container`.

### Cards & Lists
*   **Forbid Dividers:** Use `surface-container-low` to `surface-container-high` transitions to distinguish items.
*   **Padding:** Always use `4` (1.4rem) or `5` (1.7rem) for internal card padding to ensure the "Focus-first" philosophy is maintained.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical margins. If the text is centered, keep the AI utilities floating in the right margin at a lower opacity.
*   **Do** use the `24` (8.5rem) spacing token for top-of-page headers to create an editorial feel.
*   **Do** ensure Dark Mode uses `inverse-surface` (#2e3132) as the base to keep the "ink on paper" contrast soft on the eyes.

### Don’t
*   **Don't** use 100% black (#000000). Use `on-surface` (#191c1d) for text to prevent eye fatigue.
*   **Don't** use sharp 90-degree corners. Everything must have at least a `sm` (0.25rem) radius to feel "liquid."
*   **Don't** use standard "drop shadows." Use the Ambient Shadow rules to ensure the UI feels like it’s floating in light, not hovering over a dark void.