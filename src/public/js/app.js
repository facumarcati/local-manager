const dialog = document.querySelector("#confirm-dialog");
let pendingForm = null;
document
  .querySelectorAll(".nav-item.active")
  .forEach((a) => a.setAttribute("aria-current", "page"));
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.closest("dialog")) return;
  if (form.dataset.sending === "true") {
    event.preventDefault();
    return;
  }
  if (form.hasAttribute("data-confirm") && form.dataset.confirmed !== "true") {
    event.preventDefault();
    pendingForm = form;
    const amount = form.elements.amount?.value,
      date = form.elements.date?.value;
    document.querySelector("#confirm-message").textContent =
      form.dataset.confirm +
      (amount
        ? " Importe: $ " +
          new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2 }).format(
            Number(amount),
          ) +
          "."
        : "") +
      (date ? " Fecha: " + date.split("-").reverse().join("/") + "." : "");
    dialog.returnValue = "";
    dialog.showModal();
    return;
  }
  form.dataset.sending = "true";
  form.querySelectorAll('button[type="submit"]').forEach((b) => {
    b.disabled = true;
    b.textContent = "Guardando…";
  });
});
dialog?.addEventListener("close", () => {
  const form = pendingForm;
  pendingForm = null;
  if (dialog.returnValue === "confirm" && form) {
    form.dataset.confirmed = "true";
    form.requestSubmit();
  }
});
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-back]")) {
    if (history.length > 1) history.back();
    else location.href = "/";
  }
  const all = event.target.closest("[data-select-all]");
  if (all) {
    const boxes = [
        ...all.closest("fieldset").querySelectorAll('input[type="checkbox"]'),
      ],
      checked = boxes.every((b) => b.checked);
    boxes.forEach((b) => {
      b.checked = !checked;
    });
    all.textContent = checked ? "Seleccionar todos" : "Quitar selección";
  }
});
document.addEventListener("input", (event) => {
  const input = event.target.closest("[data-filter]");
  if (input) {
    const query = input.value.trim().toLocaleLowerCase("es"),
      items = [...document.querySelectorAll(input.dataset.filter)];
    let count = 0;
    items.forEach((item) => {
      item.hidden = !item.textContent.toLocaleLowerCase("es").includes(query);
      if (!item.hidden) count++;
    });
    const empty = document.querySelector(".filter-empty");
    if (empty) empty.hidden = count > 0 || items.length === 0;
  }
  if (event.target.matches("#pay-amount")) showBalance();
});
function showBalance() {
  const amount = document.querySelector("#pay-amount"),
    preview = document.querySelector("[data-balance]");
  if (!amount || !preview) return;
  const value = Number(amount.value),
    remaining = Number(preview.dataset.balance);
  const format = (v) =>
    new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  preview.textContent =
    !Number.isFinite(value) || value < 0 || value > remaining
      ? "Revisá el importe: debe estar entre $ 0,01 y $ " +
        format(remaining) +
        "."
      : "Después de este movimiento quedan pendientes $ " +
        format(Math.max(0, remaining - value)) +
        ".";
}
function initializeView() {
  document
    .querySelectorAll('button[type="submit"]')
    .forEach((b) => (b.dataset.originalText = b.textContent));
  showBalance();
}
initializeView();
document.addEventListener("app:view-loaded", initializeView);
window.addEventListener("pageshow", () => {
  document.querySelectorAll("form[data-sending]").forEach((f) => {
    delete f.dataset.sending;
    delete f.dataset.confirmed;
    f.querySelectorAll('button[type="submit"]').forEach((b) => {
      b.disabled = false;
      if (b.dataset.originalText) b.textContent = b.dataset.originalText;
    });
  });
});
function syncPreferences() {
  const theme = document.querySelector("[data-theme-switch]"),
    text = document.querySelector("[data-text-switch]");
  if (theme) theme.checked = document.documentElement.dataset.theme === "dark";
  if (text)
    text.checked = document.documentElement.dataset.textSize === "large";
}
syncPreferences();
window.addEventListener("pageshow", syncPreferences);
document.addEventListener("change", (event) => {
  const input = event.target;
  if (input.matches("[data-theme-switch]")) {
    const value = input.checked ? "dark" : "light";
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("local-manager-theme", value);
    } catch {}
  }
  if (input.matches("[data-text-switch]")) {
    const value = input.checked ? "large" : "normal";
    document.documentElement.dataset.textSize = value;
    try {
      localStorage.setItem("local-manager-text", value);
    } catch {}
  }
});

function syncPersonalExpense() {
  const input = document.querySelector("[data-personal-expense]"),
    locals = document.querySelector("[data-expense-locals]");
  if (!input || !locals) return;
  locals.disabled = input.checked;
  if (input.checked) {
    locals.querySelectorAll('input[name="locals"]').forEach((box) => {
      box.checked = false;
    });
    const all = locals.querySelector("[data-select-all]");
    if (all) all.textContent = "Seleccionar todos";
  }
}
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-personal-expense]")) syncPersonalExpense();
});
document.addEventListener("app:view-loaded", syncPersonalExpense);
window.addEventListener("pageshow", syncPersonalExpense);
syncPersonalExpense();
