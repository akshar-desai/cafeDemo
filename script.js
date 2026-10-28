gsap.registerPlugin(SplitText);

/* ------------------------------------------------------------------
   1. Wait for REAL readiness (fonts + decoded images) before starting.
   On localhost these are instant; on Cloudflare they arrive mid-animation,
   which causes SplitText mis-measuring, font swaps and image-decode jank.
   A timeout guarantees the preloader never hangs on a slow/failed asset.
------------------------------------------------------------------- */
const ASSET_TIMEOUT = 4000;

const loadFonts = () =>
  Promise.all([
    document.fonts.load('800 1em "Barlow Condensed"'),
    document.fonts.load('600 1em "Barlow Condensed"'),
    document.fonts.load('500 1em "Instrument Sans"'),
  ])
    .then(() => document.fonts.ready)
    .catch(() => {});

const decodeImages = () =>
  Promise.all(
    Array.from(document.images, (img) => {
      img.loading = "eager";
      return img.decode().catch(() => {});
    }),
  );

let timeoutId;
const assetsReady = Promise.race([
  Promise.all([loadFonts(), decodeImages()]),
  new Promise((resolve) => {
    timeoutId = setTimeout(resolve, ASSET_TIMEOUT);
  }),
]).then(() => clearTimeout(timeoutId));

/* ------------------------------------------------------------------
   2. Animation (same timings, eases and positions as before)
------------------------------------------------------------------- */
const init = () => {
  const navLinks = SplitText.create(".nav-items a", {
    type: "words",
    mask: "words",
    wordsClass: "nav-word",
  });

  const heading = SplitText.create(".hero-header h1", {
    type: "lines, words, chars",
    charsClass: "char",
    wordsClass: "word",
  });

  const footerText = SplitText.create(".hero-footer p", {
    type: "lines",
    mask: "lines",
    linesClass: "footer-line",
  });

  const items = gsap.utils.toArray(".item");
  const itemImages = items.map((item) => item.querySelector("img"));
  const floatingTweens = [];

  // Initial states
  gsap.set(".preloader-revealer", { scale: 0 });
  gsap.set(".nav-logo img", { scale: 0 });
  gsap.set(navLinks.words, { yPercent: 100 });
  gsap.set(heading.chars, { y: 50, opacity: 0, scale: 0.5 });
  gsap.set(footerText.lines, { yPercent: 100 });
  // Pre-cache transforms so GSAP doesn't read computed styles mid-animation
  gsap.set(itemImages, { y: 0 });

  const itemTargets = [
    { x: "-20vw", y: "-30vh", rotation: -20 },
    { x: "25vw", y: "-20vh", rotation: 15 },
    { x: "-32vw", y: "30vh", rotation: 12 },
    { x: "15vw", y: "25vh", rotation: -15 },
  ];

  const EXIT_DISTANCE = 3.5;
  const itemExits = itemTargets.map((target) => ({
    x: parseFloat(target.x) * EXIT_DISTANCE + "vw",
    y: parseFloat(target.y) * EXIT_DISTANCE + "vh",
    rotation: target.rotation * 2.5,
  }));

  // Release GPU layers once the intro is over (keeps text crisp, frees memory)
  const releaseLayers = () => {
    gsap.set(
      [
        ...navLinks.words,
        ...heading.chars,
        ...footerText.lines,
        ...gsap.utils.toArray(".nav-logo img, .hero-img-bg, .hero-img img"),
      ],
      { willChange: "auto" },
    );
  };

  const tl = gsap.timeline({ delay: 0.5, onComplete: releaseLayers });

  // Reveal circles: scale (compositor) instead of clip-path (repaint)
  tl.to(".preloader-revealer", {
    scale: 1,
    duration: 1,
    stagger: 0.25,
    ease: "power2.inOut",
  });

  tl.set(".preloader-revealer", { display: "none" });

  items.forEach((item, i) => {
    const target = itemTargets[i];

    tl.to(
      item,
      {
        x: target.x,
        y: target.y,
        scale: 1,
        rotation: target.rotation,
        duration: 1,
        ease: "power3.out",
        onStart: () => {
          floatingTweens[i] = gsap.to(itemImages[i], {
            y: gsap.utils.random(-15, -25),
            duration: gsap.utils.random(1.5, 2.5),
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: gsap.utils.random(0, 0.5),
          });
        },
      },
      i === 0 ? "-=0.55" : "<0.075",
    );
  });

  tl.to(
    ".preloader-logo",
    { scale: 1, opacity: 1, duration: 1, ease: "power3.out" },
    "<",
  );

  tl.set(".preloader-bg", { display: "none" });

  tl.to({}, { duration: 1 });

  tl.add(() => floatingTweens.forEach((tween) => tween.kill()));

  items.forEach((item, i) => {
    const exit = itemExits[i];

    tl.to(
      item,
      {
        x: exit.x,
        y: exit.y,
        scale: 2.5,
        rotation: exit.rotation,
        duration: 0.75,
        ease: "power2.in",
      },
      i === 0 ? ">" : "<0.075",
    );
  });

  tl.to(
    ".preloader-logo",
    { y: "-120vh", scale: 2.5, duration: 0.75, ease: "power2.in" },
    "<",
  );

  tl.to(
    ".nav-logo img",
    { scale: 1, duration: 0.75, ease: "power3.out" },
    "-=0.4",
  );

  tl.to(
    navLinks.words,
    { yPercent: 0, duration: 0.75, stagger: 0.05, ease: "power3.out" },
    "<0.1",
  );

  tl.to(
    heading.chars,
    {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 1.5,
      stagger: 0.015,
      ease: "elastic.out(0.75, 0.25)",
    },
    "<0.15",
  );

  tl.to(
    footerText.lines,
    { yPercent: 0, duration: 0.75, stagger: 0.1, ease: "power3.out" },
    "<0.2",
  );

  tl.to(".hero-img-bg", { scale: 1, duration: 1, ease: "power3.out" }, "<0.1");

  tl.to(
    ".hero-img img",
    { y: "-50%", duration: 1, ease: "power3.out" },
    "<0.3",
  );

  tl.set(".preloader", { display: "none" });
};

assetsReady.then(init);