document.addEventListener("input", function (event) {
  const campo = event.target;

  // Campos que NÃO podem receber números
  if (campo.matches("[data-no-numbers]")) {
    campo.value = campo.value.replace(/[0-9]/g, "");
  }

  // Campos que aceitam SOMENTE números
  if (campo.matches("[data-only-numbers]")) {
    campo.value = campo.value.replace(/\D/g, "");
  }
});
