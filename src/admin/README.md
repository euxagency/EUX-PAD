# Pickup & Delivery – Admin UI

## Structure

- **WordPress-first**: All UI uses `@wordpress/components` (Card, Button, TextControl, SelectControl, ToggleControl, Notice, Flex, Spinner). This matches WordPress coding standards and keeps accessibility and styling consistent with the admin.
- **No Tailwind in admin**: Admin CSS is a single layer that customizes layout and tokens only. Tailwind is not used here so that:
  - Specificity stays low and WordPress styles are respected.
  - Customization is done via CSS variables (see below).

## File layout

- `wpd-admin-app.js` – Entry; mounts GlobalSettings, PickupSettings, or RulesPage by container ID.
- `components/AdminPageLayout.js` – Shared layout (title, description, page title, notice, content, actions).
- `components/GlobalSettings.js` – Global settings page.
- `components/PickupSettings.js` – Pickup settings page.
- `components/RulesPage.js` – Rules page (placeholder).
- `utils/api.js` – Shared `setApiDefaults()` for REST nonce.
- `css/wpd-admin-app.css` – All admin styles and design tokens.

## Customization

Admin appearance is controlled by **CSS custom properties** on `.wpd-admin` in `css/wpd-admin-app.css`:

| Variable | Purpose |
|----------|---------|
| `--wpd-admin-bg` | Page background |
| `--wpd-admin-text` | Primary text |
| `--wpd-admin-text-muted` | Secondary text |
| `--wpd-admin-border` | Borders |
| `--wpd-admin-card-bg` | Card background |
| `--wpd-admin-section-bg` | Section block background (e.g. grey area in Pickup) |
| `--wpd-admin-input-bg` | Input/textarea background |
| `--wpd-admin-input-border` | Input border |
| `--wpd-admin-radius` | Border radius |
| `--wpd-admin-spacing` | Main spacing |
| `--wpd-admin-max-width` | Max width of content |

Override in your theme or plugin by targeting `.wpd-admin` and setting these variables; no need to change component code.

## Naming

- **Layout**: BEM-like under `.wpd-admin` (e.g. `.wpd-admin__header`, `.wpd-admin__content`).
- **Sections**: `.wpd-admin-section`, `.wpd-admin-section__title`, `.wpd-admin-section__subtitle`.
- **Grids**: `.wpd-admin-grid-2`, `.wpd-admin-grid-3`, `.wpd-admin-toggle-row`.
