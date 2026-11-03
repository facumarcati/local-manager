// Aplica las preferencias antes de pintar la página para evitar destellos.
(() => {
  let theme = "dark",
    textSize = "normal";
  try {
    theme = localStorage.getItem("local-manager-theme") || theme;
    textSize = localStorage.getItem("local-manager-text") || textSize;
  } catch {}
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.textSize =
    textSize === "large" ? "large" : "normal";
})();
