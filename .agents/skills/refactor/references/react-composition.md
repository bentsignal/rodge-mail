# React Composition

Use this reference when cleaning up React, JSX, TSX, or React Native code after the feature works but the implementation feels monolithic, hard to review, prop-drilled, or agent-shaped.

## Source Of Truth

Use the project's existing code as the primary source of truth. Before applying this guide, read nearby components, recently-refined files, and the user's current preferred examples. Match those patterns first.

This reference is a guide for what to look for: composition shape, state access, reviewability, early returns, and avoiding prop drilling. It is not a substitute for studying the codebase in front of you.

## Target Shape

The final code should feel like a reviewer can open the entry file and understand the feature in one pass. Prefer a parent that reads as a stable outline. Put conditional rendering inside named sub-components, and use early returns there instead of ternaries in the parent's return statement.

For routes/pages, preserve a visible outline of the page in the route file. The route should show the meaningful data query/loading gates, provider setup, and the named page sections in order. Do not hide the whole route behind a one-line `<FeaturePage />` or `<FeatureFeed />` wrapper when the route-specific composition would be clearer inline.

In this repo, the web `$username` route is the model: the route component fetches/consumes profile data, passes it into `ProfileStore`, and then shows the actual profile header layout, actions, separator, and post list in the same file. Business logic still belongs in hooks/stores, but route-specific UI composition should remain readable at the route.

```tsx
export const Route = createFileRoute("/_authed/$username")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.profile.queries.getByUsername, {
          username: params.username,
        }),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.posts.queries.getByUsername, {
          username: params.username,
        }),
      ),
    ]);
  },
  component: ProfilePage,
});

function ProfilePage() {
  const result = useSuspenseQuery({
    ...convexQuery(api.profile.queries.getByUsername, {
      username: Route.useParams({ select: (p) => p.username }),
    }),
    select: (data) => data,
  });

  if (result.data === null) {
    throw notFound();
  }

  const { info: profile, relationship } = result.data;
  return (
    <div className="max-w-auto mx-auto flex flex-col gap-4 px-4 pt-8 sm:max-w-md sm:pt-12 lg:max-w-xl">
      <ProfileStore profile={profile} relationship={relationship}>
        <div className="flex items-center gap-4">
          <PFP variant="md" />
          <div className="flex flex-col">
            <Name className="font-bold" />
            <Username />
          </div>
          <PrimaryButton className="ml-auto hidden lg:flex" />
        </div>
        <Bio />
        <UserProvidedLink className="mb-1" />
        <PrimaryButton className="flex lg:hidden" />
        <Separator />
      </ProfileStore>
      <ProfilePostList />
    </div>
  );
}

function ProfilePostList() {
  const { data: posts } = useSuspenseQuery({
    ...convexQuery(api.posts.queries.getByUsername, {
      username: Route.useParams({ select: (p) => p.username }),
    }),
    select: (data) => data,
  });

  return (
    <div className="flex min-h-screen flex-col gap-6 pb-28">
      <EmptyPosts posts={posts} />
      {posts.map((post) => (
        <Post key={post._id} post={post} />
      ))}
    </div>
  );
}

function EmptyPosts({ posts }: { posts: unknown[] }) {
  if (posts.length > 0) return null;

  return (
    <div className="border-border bg-card text-muted-foreground rounded-lg border p-6 text-center text-sm">
      No posts yet.
    </div>
  );
}
```

This is the review feel to aim for: clear ordering, named responsibilities, and no large inline machinery in the route/page.

## Example: Early Returns Inside Sub-Components

Sub-components should pull the feature state they need and decide whether they render. This keeps the parent linear.

```tsx
function EmptyPosts({ posts }: { posts: unknown[] }) {
  if (posts.length > 0) return null;

  return (
    <div className="border-border bg-card text-muted-foreground rounded-lg border p-6 text-center text-sm">
      No posts yet.
    </div>
  );
}
```

## Example: Route Outline Without Opaque Wrappers

When a route has meaningful page sections, keep that composition visible in the route. Extract the behavior and state mechanics, not the outline that helps a reviewer see what page they are on.

```tsx
function ProfilePage() {
  return (
    <div className="max-w-auto mx-auto flex flex-col gap-4 px-4 pt-8 sm:max-w-md sm:pt-12 lg:max-w-xl">
      <ProfileStore profile={profile} relationship={relationship}>
        <div className="flex items-center gap-4">
          <PFP variant="md" />
          <div className="flex flex-col">
            <Name className="font-bold" />
            <Username />
          </div>
          <PrimaryButton className="ml-auto hidden lg:flex" />
        </div>
        <Bio />
        <UserProvidedLink className="mb-1" />
        <PrimaryButton className="flex lg:hidden" />
        <Separator />
      </ProfileStore>
      <ProfilePostList />
    </div>
  );
}
```

Do not replace that route with an opaque wrapper unless the wrapper is already a well-known app shell or layout abstraction:

```tsx
function ProfilePage() {
  return <ProfileFeaturePage profile={profile} relationship={relationship} />;
}
```

That version hides the page from the route file. A reviewer has to jump files before they can see the profile image/name/username row, responsive actions, separator, and post list.

This is not a ban on every ternary in all React code. It is a rule against using ternaries inside return JSX to make parent components choose which feature sub-component should render. If a branch affects feature structure, name the branch with a component and let that component use early returns.

Do not make the parent carry structural branches or feature state just to decide which section appears:

```tsx
function ProfilePostList({ posts }: { posts: Post[] }) {
  return (
    <div>
      {posts.length === 0 ? <EmptyPosts posts={posts} /> : null}
      {posts.map((post) => (
        <Post key={post._id} post={post} />
      ))}
    </div>
  );
}
```

The parent version above makes reviewers parse branching before they can understand the feature structure. Prefer `<EmptyPosts posts={posts} />` in the parent, with that component deciding whether it should render.

## Refactor Heuristics

Move code out of the page or route when it:

- Owns a distinct interaction, such as drag/drop, confirmation, uploading, removing, selecting, filtering, or editing.
- Has its own loading, empty, error, disabled, confirmation, or optimistic state.
- Would be easier to review if named by domain responsibility.
- Makes the top-level component stop reading like the user's workflow.

Keep code together when splitting would force an awkward abstraction or create a component whose name is less clear than the JSX it replaces. Do not keep code together just to avoid creating a store; avoiding prop drilling is part of the desired final shape.

## Component Boundaries

Prefer components that answer one clear question:

- "How does the user add media?"
- "How is one preview tile rendered?"
- "What happens when the primary action is clicked?"
- "How is the confirmation dialog controlled?"
- "How does this field bind to feature state?"

Use feature-language names. Avoid vague names like `Content`, `Section`, `Wrapper`, `Controls`, or `Manager` unless the surrounding code has an established convention that makes them precise.

Prefer early returns inside these named components for empty, loading, hidden, unauthenticated, disabled, or error-only states. Avoid ternary-heavy return JSX in parent components when extracting a named component would make the workflow easier to scan.

## Data Flow And Stores

Avoid prop drilling feature state and actions through intermediate components. If state/actions are needed by multiple nested pieces of a feature, create or reuse a feature-scoped Rostra store so leaf components can select exactly what they need.

When implementing or changing a Rostra store, read the project-local `rostra` skill at `.agents/.skills/rostra/SKILL.md`. This reference intentionally does not duplicate the Rostra API rules.

Aim for this data shape:

- A feature entrypoint wraps the relevant subtree in a store provider.
- Leaf components select only the state/actions they use.
- Actions live near the feature store or feature hook that owns the state.
- Derived booleans have names that explain product meaning, such as `canSubmit`, `isEmpty`, `hasUploadingItems`, or `isConfirmOpen`.

Props are still appropriate for reusable presentational components, primitive UI components, and local parent-child values that do not create drilling. For feature-specific components under a store provider, selecting from the store is often clearer than threading props through layout layers.

## Local Helpers

Use private helpers inside the same file when they are only meaningful to one component family. Split into a separate file when:

- The helper is reused by multiple files.
- The file has multiple independent responsibilities.
- The helper contains domain logic that deserves direct tests.
- The component file is becoming hard to scan even after extracting child components.

Do not create shared utilities just because two lines look similar. Shared abstractions should encode a real concept.

## UI State

Prefer small, local UI state for transient component-only interactions, such as hover, drag-over, pending remove confirmation, menu open state, or selected tab inside one widget.

Prefer feature-level Rostra state for data that affects publishing, saving, navigation, validation, server calls, or multiple sibling/nested components.

Avoid duplicating the same state in both places. If local state and feature state can disagree, consolidate ownership before polishing the UI.

## Reviewability Checklist

Before finishing, check that:

- The route/page reads as a short feature outline.
- Each extracted component has a clear responsibility and a useful name.
- Parent components are not cluttered with ternaries for child visibility that could live as early returns inside child components.
- Feature state is not prop-drilled through layout/intermediate components.
- Store consumers select only the data/actions they need.
- Dead mobile/desktop variants, unused props, stale imports, and obsolete files are removed.
- Complex branches are isolated behind named components or functions.
- Behavior, styling intent, accessibility labels, and validation remain intact.
- The diff is easier to review than the original implementation, even if it has more files.

## What To Avoid

- Splitting every JSX tag into a component.
- Passing feature state/actions down through multiple component layers.
- Creating one-off generic abstractions like `BaseCard`, `SmartForm`, or `ActionBar` without a real shared concept.
- Moving feature-specific logic into global shared folders.
- Keeping duplicate mobile and desktop components when one responsive composition can express both.
- Leaving hidden fixed-position bars, stale overlays, or dead entrypoints after changing responsive layout.
- Adding explanatory comments where a better component, variable, or store selector name would solve the problem.
