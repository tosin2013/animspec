// VitePress configuration for the animspec community site.
// The site root is docs/: the repository's own markdown documents render
// as pages in place (spec 006, contracts/site.md). Mermaid fences render
// as diagrams via vitepress-plugin-mermaid (with the mermaid package):
// withMermaid injects the plugin itself, so it is not added again under
// vite.plugins, and everything is bundled locally, so there is still no
// external origin at view time (FR-008).
import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

// Links in the rendered documents point at repository files that are not site
// pages (../VOCABULARY.md, ../CONTRIBUTING.md, ...). They stay as they are:
// the documents are canonical on GitHub and are never edited for the site,
// so their links are excluded from the build's dead-link check. Reported
// links are normalised (./../X, ./X), so the patterns match those forms.
const rootFileLinks = [
  /^(\.\/)?\.{2}\//,
  /^\.{1,2}\/(CLA|SECURITY|CODE_OF_CONDUCT|RELEASING|VOCABULARY|CONTRIBUTING)$/,
];

export default withMermaid(
  defineConfig({
    base: "/animspec/",
    lang: "en-US",
    title: "animspec",
    description:
      "Deterministic, declarative animation. The same spec, signal and seed always produce the same frame.",
    ignoreDeadLinks: rootFileLinks,
    mermaid: {
      // Grayscale diagrams on the light theme; the plugin switches to a
      // dark theme automatically when the site is in dark mode.
      theme: "neutral",
    },
    themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Gallery", link: "/gallery" },
      { text: "Contribute", link: "/contribute" },
      {
        text: "Documentation",
        items: [
          { text: "User guide", link: "/user-guide" },
          { text: "Vocabulary", link: "/vocabulary" },
          { text: "Deployment", link: "/deployment" },
          { text: "Design document", link: "/DESIGN_DOC" },
          { text: "Contributing", link: "/contributing" },
        ],
      },
      { text: "GitHub", link: "https://github.com/tosin2013/animspec" },
    ],
    sidebar: [
      {
        text: "Site",
        items: [
          { text: "Home", link: "/" },
          { text: "Gallery", link: "/gallery" },
          { text: "Contribute", link: "/contribute" },
        ],
      },
      {
        text: "Documentation",
        items: [
          { text: "User guide", link: "/user-guide" },
          { text: "Vocabulary", link: "/vocabulary" },
          { text: "Deployment", link: "/deployment" },
          { text: "Design document", link: "/DESIGN_DOC" },
          { text: "Contributing", link: "/contributing" },
        ],
      },
    ],
    search: { provider: "local" },
    outline: { level: [2, 3] },
    externalLinkIcon: true,
  },
  }),
);