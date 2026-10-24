// Dynamic config layered on top of app.json — only exists for the one field
// below that can't be a single static value, because this app is deployed
// to two different hosts with two different URL shapes:
//   - GitHub Pages serves it from a subpath: famos-amos.github.io/family-portal
//   - Hostinger (familyhuddle.space) serves it from the domain root
// `experiments.baseUrl` controls what every exported asset path (the JS
// bundle, favicon, etc.) is prefixed with — get it wrong and the exported
// index.html references files that 404, which renders as a blank page
// (confirmed: this is exactly what happened on Hostinger when the app.json
// value, hardcoded for GitHub Pages, was used for the root-domain build).
//
// Defaults to root ('', correct for Hostinger and local testing) unless
// PAGES_BASE_PATH is set — only the GitHub Actions workflow sets it, to
// "/family-portal", for its own export step.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.PAGES_BASE_PATH ?? '',
  },
});
