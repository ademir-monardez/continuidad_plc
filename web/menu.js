const menuButton = document.getElementById("menuButton");
const menuDropdown = document.getElementById("menuDropdown");

if (menuButton && menuDropdown) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuDropdown.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (menuButton.contains(event.target) || menuDropdown.contains(event.target)) {
      return;
    }

    menuDropdown.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  });
}
