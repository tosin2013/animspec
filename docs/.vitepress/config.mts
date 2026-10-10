// VitePress configuration for the animspec community site.
// The site root is docs/: the repository's own markdown documents render
// as pages in place (spec 006, contracts/site.md).
import { defineConfig } from "vitepress";

// Links in the rendered documents point at repository files that are not site
// pages (../VOCABULARY.md, ../CONTRIBUTING.md, ...). They stay as they are:
// the documents are canonical on GitHub and are never edited for the site,
// so their links are excluded from the build's dead-link check.
const rootFileLinks = [
  /\.\.\/VOCABULARY\.md/,
  /\.\.\/CONTRIBUTING\.md/,
  /\.\.\/SECURITY\.md/,
  /\.\.\/CLA\.md/,
  /\.\.\/RELEASING\.md/,
  /\.\.\/CODE_OF_CONDUCT\.md/,
  /\.\.\/gallery\//,
  /^CLA\.md/,
  /^SECURITY\.md/,
  /^CODE_OF_CONDUCT\.md/,
  /^RELEASING\.md/,
];

export default defineConfig({
  base: "/animspec/",
  lang: "en-US",
  title: "animspec",
  description:
    "Deterministic, declarative animation. The same spec, signal and seed always produce the same frame.",
  ignoreDeadLinks: rootFileLinks,
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Gallery", link: "/gallery" },
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
});