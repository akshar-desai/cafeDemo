gsap.registerPlugin(SplitText);

/* Wait until every image is decoded (with a safety timeout). */
function waitForImages() {
  const decodeAll = Promise.all(
    Array.from(document.images).map((img) =>
      img.decode ? img.decode().catch(() => {}) : Promise.resolve(),
    ),
  );
  const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
  return Promise.race([decodeAll, timeout]);
}

/* Resolves after n real frames (with a fallback if rAF is paused). */
function nextFrames(n = 3) {
  return new Promise((resolve) => {
    const fallback = setTimeout(resolve, 400);
    const step = () => {
      if (--n <= 0) {
        clearTimeout(fallback);
        resolve();
      } else {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  });
}

async function init() {
  const preloader = document.querySelector(".preloader");

  /* Size the revealer circles so their radius equals what
     clip-path: circle(100%) used to reach: sqrt((w² + h²) / 2).
     diameter = 2 * radius = sqrt(2 * (w² + h²)) */
  const { width: pw, height: ph } = preloader.getBoundingClientRect();
  preloader.style.setProperty(
    "--reveal-d",
    Math.ceil(Math.sqrt(2 * (pw * pw + ph * ph))) + "px",
  );

  const hasNavLinks = document.querySelectorAll(".nav-items a").length > 0;

  const navLinks = hasNavLinks
    ? SplitText.create(".nav-items a", {
        type: "words",
        mask: "words",
        wordsClass: "nav-word",
      })
    : null;

  const heading = SplitText.create(".hero-header h1", {
    type: "words, chars",
    charsClass: "char",
    wordsClass: "word",
  });

  const footerText = SplitText.create(".hero-footer p", {
    type: "lines",
    mask: "lines",
    linesClass: "footer-line",
  });

  const navWords = navLinks ? navLinks.words : [];

  const revealers = gsap.utils.toArray(".preloader-revealer");
  const items = gsap.utils.toArray(".item");
  const itemImages = gsap.utils.toArray(".item img");
  const logo = ".preloader-logo";
  const heroLayers = [".hero-img-bg", ".hero-img img", ".nav-logo img"];

  // GPU layers only for the few elements that really need them
  gsap.set([...items, ...itemImages, logo, ...heroLayers], {
    willChange: "transform",
  });

  gsap.set(revealers, { scale: 0 });
  gsap.set(".nav-logo img", { scale: 0 });
  if (navWords.length) gsap.set(navWords, { yPercent: 100 });
  gsap.set(heading.chars, { y: 50, opacity: 0, scale: 0.5 });
  gsap.set(footerText.lines, { yPercent: 100 });

  /* PRE-WARM: elements at scale(0) are skipped by the browser, so their
     raster + GPU texture upload used to happen at the exact moment they
     first appeared (the visible hitch at revealer 3/4 -> items).
     Draw them once at 1% opacity (invisible) while the dark preloader
     covers the screen, then reset to the original start state. */
  gsap.set([...revealers, ...items], { scale: 1, opacity: 0.01 });
  gsap.set(logo, { opacity: 0.01 });
  await nextFrames(3);
  gsap.set(revealers, { scale: 0, opacity: 1 });
  gsap.set(items, { scale: 0, opacity: 1 });
  gsap.set(logo, { opacity: 0 });

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

  const floatingTweens = [];

  const tl = gsap.timeline({
    delay: 0.5,
    onComplete: () => {
      gsap.set(heroLayers, { clearProps: "willChange" });
      heading.revert();
      footerText.revert();
      if (navLinks) navLinks.revert();
    },
  });

  /* Same timing as before (duration 1, stagger 0.25, power2.inOut),
     but animating transform scale instead of clip-path. */
  revealers.forEach((rev, i) => {
    tl.to(
      rev,
      { scale: 1, duration: 1, ease: "power2.inOut", force3D: true },
      i * 0.25,
    );
  });

  /* Hide each revealer as soon as the next one fully covers it, so the GPU
     stops drawing stacked full-screen layers. Invisible to the eye.
     visibility instead of display:none -> no layout recalculation. */
  tl.set(revealers[0], { visibility: "hidden" }, 1.25);
  tl.set(revealers[1], { visibility: "hidden" }, 1.5);
  tl.set(revealers[2], { visibility: "hidden" }, 1.75);
  tl.set(revealers[3], { visibility: "hidden" }, 1.75);

  items.forEach((item, i) => {
    const target = itemTargets[i];
    const image = item.querySelector("img");

    tl.to(
      item,
      {
        x: target.x,
        y: target.y,
        scale: 1,
        rotation: target.rotation,
        duration: 1,
        ease: "power3.out",
        force3D: true,
        onStart: () => {
          floatingTweens[i] = gsap.to(image, {
            y: gsap.utils.random(-15, -25),
            duration: gsap.utils.random(1.5, 2.5),
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: gsap.utils.random(0, 0.5),
            force3D: true,
          });
        },
      },
      i === 0 ? "-=0.55" : "<0.075",
    );
  });

  tl.to(
    logo,
    { scale: 1, opacity: 1, duration: 1, ease: "power3.out", force3D: true },
    "<",
  );

  tl.set(".preloader-bg", { visibility: "hidden" });

  tl.to({}, { duration: 1 });

  tl.add(() => floatingTweens.forEach((tween) => tween && tween.kill()));

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
        force3D: true,
      },
      i === 0 ? ">" : "<0.075",
    );
  });

  tl.to(
    logo,
    { y: "-120vh", scale: 2.5, duration: 0.75, ease: "power2.in", force3D: true },
    "<",
  );

  tl.to(
    ".nav-logo img",
    { scale: 1, duration: 0.75, ease: "power3.out" },
    "-=0.4",
  );

  if (navWords.length) {
    tl.to(
      navWords,
      { yPercent: 0, duration: 0.75, stagger: 0.05, ease: "power3.out" },
      "<0.1",
    );
  }

  tl.to(
    heading.chars,
    {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 1.5,
      stagger: 0.015,
      ease: "elastic.out(0.75, 0.25)",
      force3D: false,
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
}

// Start only when fonts AND images are ready
Promise.all([document.fonts.ready, waitForImages()]).then(init);