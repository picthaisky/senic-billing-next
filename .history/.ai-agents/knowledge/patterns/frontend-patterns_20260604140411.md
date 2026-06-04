# Frontend Patterns

## Component Organization

- Layout components live under `frontend/src/components/layout/`.
- Feature pages/components live under feature folders such as `dashboard`, `forms`, `customers`, `products`, `payments`, `settings`, and `profile`.
- Shared behavior belongs in `frontend/src/hooks/`, `frontend/src/store/`, `frontend/src/services/`, or `frontend/src/utils/`.

## API Integration

- Use `apiClient` so JWT handling and global 401 behavior stay centralized.
- Keep backend response shape changes synchronized with DTO usage in frontend components.
- Do not duplicate auth token logic in feature components.

## Design System

- Use existing CSS variables and theme classes from `index.css` and related style files.
- Keep Thai copy concise and businesslike.
- Use Lucide React icons for actions, navigation, and status.
- Preserve responsive behavior: desktop sidebar, mobile bottom nav, FAB, and table-to-card transformations.

## Financial Forms

- Keep VAT mode and totals visible and predictable.
- Avoid hidden rounding changes between display and submitted payload.
- Add test vectors or manual validation notes for VAT/discount edge cases.

## Real-Time UX

- Treat SignalR as a UI freshness channel, not the source of truth.
- Reconcile important state with API data after payment or system status events when possible.