// Mantiene el menú y las preferencias; reemplaza solamente la vista solicitada.
let activeNavigation = null;
let renderedUrl = new URL(location.href);
const supportedPath =
  /^\/(?:$|payments(?:\/|$)|taxes(?:\/|$)|locals(?:\/|$)|contracts(?:\/|$))/;
const section = (url) => url.pathname.split("/")[1] || "home";
function rememberPosition() {
  history.replaceState(
    {
      ...history.state,
      appNavigation: true,
      scroll: { x: scrollX, y: scrollY },
    },
    "",
    location.href,
  );
}
rememberPosition();
function updateMenu(url) {
  document.querySelectorAll(".nav-item").forEach((link) => {
    const active = section(new URL(link.href)) === section(url);
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}
function focusDestination(root, url, options) {
  let target;
  if (url.hash) {
    try {
      target = root.querySelector(
        "#" + CSS.escape(decodeURIComponent(url.hash.slice(1))),
      );
    } catch {}
    if (target?.tagName === "DETAILS") target.open = true;
    target?.scrollIntoView({ block: "start" });
  }
  if (options.focusLabel) {
    target = [...root.querySelectorAll("a")].find(
      (a) =>
        a.getAttribute("aria-label") === options.focusLabel ||
        a.href === url.href,
    );
  }
  if (options.keyboard && !target) target = root.querySelector("h1");
  if (target) {
    if (!target.matches("a,button,input,select,textarea,summary"))
      target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}
async function navigate(
  url,
  {
    push = true,
    keyboard = false,
    focusLabel = null,
    direction = 1,
    scroll = null,
  } = {},
) {
  activeNavigation?.controller.abort();
  // Detiene transiciones anteriores antes de comenzar otra navegación.
  document
    .querySelectorAll(".page-wrapper,#dashboard-content")
    .forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
  const controller = new AbortController(),
    navigation = { controller };
  activeNavigation = navigation;
  const monthOnly =
    renderedUrl.pathname === "/" &&
    url.pathname === "/" &&
    !!document.querySelector("#dashboard-content");
  const selector = monthOnly ? "#dashboard-content" : ".page-wrapper";
  const current = document.querySelector(selector);
  if (!current) return;
  const main = document.querySelector("#contenido"),
    feedback = document.querySelector(".navigation-feedback");
  const sameSection = section(url) === section(renderedUrl);
  if (feedback) feedback.hidden = true;
  main.setAttribute("aria-busy", "true");
  main.classList.add("view-loading");
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20000);
  try {
    const response = await fetch(url.href, {
      headers: {
        "X-Requested-With": monthOnly ? "month-navigation" : "app-navigation",
      },
      signal: controller.signal,
    });
    if (response.status >= 500)
      throw new Error("No se pudo cargar la pantalla.");
    const parsed = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    const next = parsed.querySelector(selector);
    if (!next) throw new Error("Respuesta incompleta.");
    if (controller.signal.aborted) return;
    const animate =
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      typeof current.animate === "function";
    if (animate)
      await current.animate(
        [
          { opacity: 1, transform: "translateX(0)" },
          { opacity: 0, transform: "translateX(" + -10 * direction + "px)" },
        ],
        { duration: 110, easing: "ease-in", fill: "forwards" },
      ).finished;
    if (controller.signal.aborted) return;
    current.replaceWith(next);
    if (push) history.pushState({ appNavigation: true }, "", url.href);
    renderedUrl = new URL(url.href);
    if (!monthOnly) {
      document.title = parsed.title || document.title;
      const time = parsed.querySelector(".topbar time");
      if (time) document.querySelector(".topbar time")?.replaceWith(time);
    }
    updateMenu(url);
    document.dispatchEvent(new CustomEvent("app:view-loaded"));
    if (scroll)
      window.scrollTo({ left: scroll.x, top: scroll.y, behavior: "instant" });
    else if (!sameSection)
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    focusDestination(next, url, { keyboard, focusLabel });
    if (animate)
      next.animate(
        [
          { opacity: 0, transform: "translateX(" + 10 * direction + "px)" },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: 170, easing: "ease-out" },
      );
    const live = document.querySelector("#navigation-status"),
      month = next.querySelector(".period-selector strong");
    if (live)
      live.textContent = monthOnly
        ? "Resumen de " + month.textContent + " cargado."
        : (next.querySelector("h1")?.textContent || "Pantalla") + " cargada.";
  } catch (error) {
    if (
      activeNavigation === navigation &&
      (error.name !== "AbortError" || timedOut)
    ) {
      if (feedback) {
        feedback.textContent =
          "No pudimos cargar la pantalla. Revisá la conexión y volvé a intentarlo.";
        feedback.hidden = false;
      }
      // Si falló Atrás/Adelante, la dirección debe seguir correspondiendo a lo visible.
      if (!push)
        history.replaceState({ appNavigation: true }, "", renderedUrl.href);
    }
  } finally {
    clearTimeout(timeout);
    if (activeNavigation === navigation) {
      main.removeAttribute("aria-busy");
      main.classList.remove("view-loading");
      activeNavigation = null;
    }
  }
}
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (
    event.defaultPrevented ||
    !link ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    link.hasAttribute("download") ||
    (link.target && link.target !== "_self") ||
    link.hasAttribute("data-full-navigation")
  )
    return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !supportedPath.test(url.pathname))
    return;
  if (
    url.pathname === location.pathname &&
    url.search === location.search &&
    url.hash
  )
    return;
  event.preventDefault();
  rememberPosition();
  navigate(url, {
    keyboard: event.detail === 0,
    focusLabel: link.getAttribute("aria-label"),
    direction: link.getAttribute("aria-label") === "Mes anterior" ? -1 : 1,
  });
});
window.addEventListener("popstate", (event) => {
  navigate(new URL(location.href), {
    push: false,
    scroll: event.state?.scroll,
  });
});
