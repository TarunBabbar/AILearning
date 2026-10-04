// Tailwind 4 ships its PostCSS plugin in a separate package; using `tailwindcss`
// directly here no longer works and leaves the @-directives unprocessed.
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
