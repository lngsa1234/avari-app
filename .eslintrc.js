/**
 * ESLint configuration for avari-app (Next.js 14, App Router).
 *
 * Policy: "fix when touched, not all at once."
 * Both rules below are kept as `warn` on purpose. They surface deferred
 * decisions we address opportunistically when editing the relevant file —
 * they are not ignorable noise, and they are not a bulk-migration backlog.
 *
 * Disabling either rule would silently remove real guardrails; leaving them
 * as errors would block CI on pre-existing tech debt. `warn` is the right
 * pressure level.
 */
module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Intentional: <img> → next/image migration is not mechanical.
    // It involves layout (fixed vs fill), next.config.js remotePatterns,
    // and CLS/perf tradeoffs. Convert when touching a component, not in bulk.
    '@next/next/no-img-element': 'warn',

    // Intentional: auto-adding missing deps can cause infinite re-renders.
    // Each instance needs case-by-case review ("is this stale?" vs
    // "is this intentionally frozen?"). Leaving it as warn keeps the
    // signal without pushing us into risky auto-fixes.
    'react-hooks/exhaustive-deps': 'warn',

    // Apostrophes/quotes in JSX copy — low signal, high volume noise.
    'react/no-unescaped-entities': 'off',
  },
};
