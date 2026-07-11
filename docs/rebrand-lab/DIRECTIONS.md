# Product directions

The shipping UI is intentionally untouched. The lab is a selection tool, not a
theme picker; choosing a direction would trigger a separate production
implementation and acceptance pass.

## What the current shell is communicating

The current desktop shell is an editorial three-pane mail client with a narrow
account rail, card-like central workspace, warm textured surfaces, serif
subjects, and soft transitions. Its Atlantic and Mineral options change the
palette, but preserve the same composition, information hierarchy, density, and
motion. Mobile is structurally separate and inherits another copy of those
palette values.

That explains why changing themes did not feel like changing the product. The
user is still looking at the same spatial model, the same inbox row, the same
reader, and the same interaction rhythm.

## 01 — Dispatch

**Thesis:** a keyboard-first operations desk for someone who treats mail as a
queue.

- Navigation is a persistent narrow dock. Accounts are channels inside the
  dock, not a full sidebar of labels.
- Rows behave like compact work items: fixed timestamp column, sender, subject,
  one-line summary, account stamp, and a hard selected marker.
- The reader is functional paper inside the console, with a tight action strip
  and attachments rendered as tickets.
- Motion is mechanical: two-pixel row shifts, snap selection, no springy cards.
- Mobile promotes the queue and turns the dock into a bottom command strip. The
  reader becomes its own pushed screen.
- Light mode resembles drafting paper and black hardware; dark mode resembles a
  low-glare operations console. Both use the same contrast hierarchy rather
  than reversing arbitrary colors.

This is the strongest option if speed, density, and keyboard fluency matter
most.

## 02 — Correspondence

**Thesis:** a calm reading room that makes personal mail feel worth reading.

- Top navigation frames the product as a library: Letters, People, Archive.
- The account column is an index with a daily greeting and a count, not a tool
  rail.
- Inbox rows are a table of contents with folio numbers, generous subjects, and
  quiet metadata.
- The reader is the dominant page. Reply is an inline continuation of the
  letter, not a floating utility button.
- Motion is page-like: fades and short vertical reveals, never lateral sliding
  chrome.
- Mobile opens with a compact daily brief followed by the correspondence list;
  a letter pushes into a distraction-free page.
- Light mode is warm paper with wine ink. Dark mode is a deliberately brown-
  black reading surface with softened rules and off-white type.

This is the strongest option if Rodge should feel intimate, human, and unlike
enterprise mail.

## 03 — Frequency

**Thesis:** a live communications instrument for triage and situational
awareness.

- Accounts become channels; filtering becomes tuning.
- The stream exposes time distance, account, classification, and priority at a
  glance.
- The reader keeps a transmission identity and makes automation/people/travel
  categorization visually explicit without recreating Focused/Other.
- Motion is ambient and useful: a restrained live waveform and a cursor pulse.
  Reduced-motion disables both.
- Mobile becomes a single signal stream with four channel presets in a bottom
  tuner. Reader and New are focused full-screen modes.
- Dark mode is primary and uses near-black/acid green with orange alerts. Light
  mode is not a washed-out inversion: it uses instrument-panel gray, dark olive
  typography, and a legible green signal color.

This is the strongest option if the product should feel singular, technical,
and alive.

## 04 — Orbit

**Thesis:** a tactile, personal workspace that makes several accounts feel like
one coherent place.

- Accounts have persistent spatial identity in an “orbit,” with icon, provider,
  unread count, and accent.
- Messages are touch-sized cards with semantic chips. The list is calmer and
  less dense than Dispatch.
- The reader floats as a rounded sheet over the workspace, giving it separation
  without a modal.
- Motion uses elevation: selected cards lift, the reader sheet settles, and the
  compose action rises from the navigation dock.
- Mobile is the native center of this direction: the feed and floating action
  dock are primary, while account management becomes a dedicated destination.
- Light mode uses cool mist and saturated violet; dark mode uses deep ink and
  lavender. Surface elevation, borders, and text all have explicit dark tokens.

This is the strongest option if touch ergonomics and a friendly personal-app
feeling matter most.

## Production design-system guardrails

Regardless of direction, production should replace palette-specific hex values
with a cross-platform semantic contract:

| Role                            | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `canvas`                        | App/window background and native root view      |
| `surface-1`                     | Navigation and inbox surface                    |
| `surface-2`                     | Reader, dialog, and elevated card surface       |
| `surface-selected`              | Stable selected state in either appearance      |
| `text-primary`                  | Body and critical labels                        |
| `text-secondary`                | Preview and supporting metadata                 |
| `text-tertiary`                 | Timestamps and low-priority chrome              |
| `border-subtle`                 | Structural dividers                             |
| `border-strong`                 | Inputs and active boundaries                    |
| `action-primary`                | New, Reply, and confirmation actions            |
| `status-success/warning/danger` | Sync and provider health only                   |
| `account-*`                     | Provider/account identity, never text hierarchy |

The resolved appearance must exist before rendering on every platform. Web SSR,
Electron bootstrap, Expo splash release, native headers, tab bars, status bars,
search chrome, dialogs, compose, reader empty states, and error screens must all
consume the same resolved semantic roles. A palette name alone is not an
appearance state.

## Suggested selection exercise

Do not choose from a static hero screenshot. For each promising direction,
compare all four lab states:

1. desktop light;
2. desktop dark;
3. mobile light;
4. mobile dark.

Then choose one direction or explicitly combine named parts, such as “Dispatch
navigation and density with Correspondence reader typography.” That creates a
real implementation brief and avoids drifting back into color-only themes.
