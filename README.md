# Personal portfolio

A personal portfolio with five written case studies, six shorter project snapshots, a résumé section, original animated walkthroughs, and a separate presentation room. No framework, package install, build service, or external runtime is required.

## Run

Requires Node.js 20 or newer.

```sh
npm start
```

Open `http://127.0.0.1:4173`. The server binds to this machine only. Set `PORT` to use another port.

- Website: `/`
- Résumé section: `/#resume`
- Written cases: `/work/toast-closeout.html`, `/work/toast-cash-drawer.html`, `/work/goto-wallboard.html`, `/work/goto-conversation-intelligence.html`, `/work/cattia.html`
- Presentation room: `/presentations/`
- Toast slide viewer: `/presentation/`

The static HTML can also be opened directly from disk. For the presentation, use the arrow keys, Page Up/Down, Home/End, or bottom controls. `F` toggles fullscreen. The slide navigator includes 20 core slides and 3 backups. Speaker notes are embedded as hidden `aside.speaker-notes` elements for editing; no separate presenter window is installed.

The default presentation fits one viewport. Increasing text size switches to scrollable slides so enlarged content is never clipped. Scroll within the slide, or Tab to it and use Up/Down or Page Up/Down. Left/Right and the bottom arrows still change slides. The slide navigator supports Tab, Shift+Tab, and Escape, and returns focus to its opener when closed.

## Structure

`index.html` is the portfolio homepage. `work/` contains the five detailed reading cases; the homepage's More work section contains six source-grounded snapshots. `presentations/index.html` is the separate presentation hub. Only the Toast closeout deck is available; the other projects link to their written cases, not placeholder decks. `styles.css` and `site.js` own the website's visual design and image viewer.

`presentation/index.html` is the presentation source of truth inside this project. The slide copy is ordinary HTML, not generated app data. `presentation/presentation.css` owns its case-specific layouts. `presentation/motion.js` shares animation playback policy between the website and deck; `presentation/motion.css` shares the original device-screen geometry. The standard `deck.css` and `engine.js` were copied from Emma's presentation runtime. Keep that runtime separate from local composition changes. The website and case-specific deck stylesheet use installed Arial/sans-serif fallbacks; restricted Community Pro and Segoe Pro font files remain local and are excluded from Git. The unchanged runtime's font-face declarations are unused by this deck.

The website and presentation reuse Toast closeout media in `presentation/assets/`. Other source images live in `assets/work/`; other original GIFs and their video/poster derivatives live in `assets/motion/`. All product imagery came from the user-provided Figma portfolio. No stock imagery or external analytics are included.

The Cattia case adapts the game sequence on Appendix page `10:253`. Ten individually retrieved source PNGs live at `assets/work/cattia-*.png`: seven game screenshots from `10:866` (2436×1125 each), gameplay architecture from `10:883` (4096×2716), player flows from `10:946` (2917×4096), and the design-system board from `10:652` (4096×2347). These are image assets, not flattened slide exports. They are retained without further resizing, with expand controls and direct full-resolution links for the dense boards. The selected game screens are static; no game recording or artificial animation is claimed.

The newer game-interface resources are staged separately in `resources/cattia-2025-2026/`. `manifest.json` preserves source node IDs, original names, crop coordinates, and the user's goals: a more immersive milk-box concept and less unnecessary UI noise from the original board design. The user identified Core Game file `BYX0zxImY0uNoo34SuEbWH`, Main interface `5454:22640`, as the new source of truth; its inspected page is named “Final spec - 2025.” Four original 3× row exports supply 16 individual UI-state images and four milk-box reference crops; an unmodified milk-box shell SVG is preserved separately. `contact-sheet.png` provides a visual index. The last three screen images retain the source's extra render-height effects rather than resampling them. These are preparation resources only: no new screens or outcome claims have been substituted into the existing case, no upgrade narrative has been invented, and nothing was changed in Figma.

## Original animation

Eleven original animated GIFs are retained: four Toast closeout interactions, two cash-drawer flows, four wallboard sequences, and one conversation-intelligence prototype. Every GIF has a silent H.264 MP4 derivative and a static JPEG poster, generated locally with the existing FFmpeg and Pillow tools. Videos use CRF 14, retain the original pixel dimensions without downscaling, and preserve the original duration. Odd dimensions are padded by one pixel for H.264, not rescaled. Square-pixel output matches the GIFs' browser display rather than inheriting their inconsistent pixel-aspect flags. Posters use JPEG quality 95 without chroma subsampling. The stepped wallboard sequences remain stepped rather than inventing motion.

Reading pages use native Play/Pause/Seek controls and link to each original GIF. Silent animations start and loop while visible, unless reduced motion is requested. User pauses are respected across scrolling. Recordings pause when the page is hidden, scrolled offscreen, or their slide becomes inactive; the deck navigator also pauses the background. Paired device animations can play together. Browsers that block automatic playback show a notice and keep native Play available. Navigator thumbnails retain only posters, not playable video sources. The preview server supports byte ranges for playback and seeking.

The Toast reading-page hero now layers its terminal and handheld recordings over the original device artwork instead of displaying the flattened static export. It has a shared Play/Pause button. The deck reuses its four recordings on the cover and slides 10, 14, 15, and 23. The device artwork is sourced from Figma layers `1:822` and `1:818`; screen placement follows `1:823` and `1:819`. Native artwork is 1136×739 and 498×1242. Recordings remain limited to the source GIF detail: the Toast landscape recordings are 800×464 and the handheld is 440×876. No AI upscaling or claim of HD source detail is made.

The recordings are silent interface demonstrations, with adjacent text descriptions. They are not live products or evidence of transcription accuracy. Source GIFs remain unchanged. Serving the site does not require FFmpeg or Pillow; they were used only to prepare the existing assets.

## Content boundaries

- Toast only in this presentation. GoTo is intentionally excluded.
- The website includes Toast cash drawer, GoTo wallboard, and GoTo conversation intelligence. Cash drawer and wallboard have no supplied quantified outcome studies. Conversation intelligence reached a **sales concept demo**, with qualitative feedback and unresolved accuracy/security concerns, not a documented production launch.
- Cattia is a separate written mobile-game case, not part of the Toast presentation. Its source reports an alpha test with 15 participants, an 8/10 art/UI rating, and a 7/10 player-satisfaction rating. These are visibly qualified source-reported results: no test dates, recruitment details, rating instrument, or raw responses were supplied. No public launch, retention, commercial outcome, or current project status is inferred. The interaction/visual-design credit does not imply authorship of every game-art asset or the technical-lead role.
- The role during this work was **senior product designer**. The principal-level interview target does not change the historical title.
- The approximate 50% shorter closeout time and 5% fewer support tickets are **directional trial estimates**, not independently verified measurements. Definitions and methodology still need confirmation.
- Saved tip entry does not imply a closed check. The system closes a check only when its required payment information is complete.
- Retrospective discussion points are proposed editorial copy, not claims about historical activities.
- The résumé section uses the September 24, 2025 Figma résumé (node `27:3`): five employment entries, independent game-studio work, education, core skills, and community activity. It visibly qualifies “Present” as that source's wording, not a verification of current employment. Unsupported résumé impact percentages are not repeated. The original Figma résumé and LinkedIn remain linked; no PDF download is claimed.
- No source Figma files have been modified. Public publication includes the website and presentation, not the staged refresh resources, restricted fonts, or presentation planning documents. Review product imagery and sharing permissions before publishing further material.

The local proposal, outline, and interview brief in `presentation/PRESENTATION.md`, `presentation/slides.md`, and `presentation/context.md` are excluded from the public repository. Speaker notes embedded in the presentation HTML are part of the published deck and are readable in its source.

## Deployment

GitHub Pages serves this project directly from the `main` branch's repository root. `.nojekyll` keeps the HTML, CSS, JavaScript, and media as ordinary static files; the Node server is only for local preview and is not run by the hosting service. Enable **Settings → Pages → Deploy from a branch → main → / (root)**. Subsequent pushes to `main` automatically update the site.

The public routes include `/`, `/#resume`, `/presentations/`, `/presentation/`, and the five individual case URLs listed above. The `/work/` directory contains the case pages, not its own index page.

`.gitignore` excludes `resources/`, presentation planning documents, restricted font files, local environment files, and dependency directories. Keep these exclusions when committing updates. A public repository exposes every committed file, not just files linked from the homepage. GitHub Pages does not provide password protection for these case studies or the deck.

## Checks

```sh
npm run check
```

These dependency-free checks cover local pages and links, the résumé and its navigation, primary text-color contrast, posters and preserved animation files, original video pixel dimensions, the ten Cattia image dimensions and alpha-evidence boundaries, publication exclusions and system-font fallbacks, visible playback, user pause, reduced motion, blocked-autoplay notices, slide/navigator lifecycle, native media controls, separate reading/presentation routes, content caveats, and the static preview server including video byte ranges. The staged-resource integrity test runs when the local-only resource folder exists; a fresh public checkout explicitly skips that test.

The deck's self-audit remains in the local-only `presentation/PRESENTATION.md`. Manual screen-reader testing, a cold-load performance benchmark, print/export verification, and a live rehearsal have not been performed.
