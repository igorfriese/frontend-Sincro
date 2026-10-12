// ---------- Máscaras (formatam enquanto digita) ----------
// 00.000.000/0000-00 — a API aceita com ou sem pontuação (confere os 14 dígitos)
function mascararCnpj(valor) {
  return String(valor || "")
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// (00) 0000-0000 ou (00) 00000-0000 (celular)
function mascararTelefone(valor) {
  const digitos = String(valor || "").replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos ? `(${digitos}` : "";
  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);
  const corte = digitos.length > 10 ? 5 : 4;
  return resto.length > corte
    ? `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
    : `(${ddd}) ${resto}`;
}

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

  if (campo.matches('[data-mascara="cnpj"]')) {
    campo.value = mascararCnpj(campo.value);
  }

  if (campo.matches('[data-mascara="telefone"]')) {
    campo.value = mascararTelefone(campo.value);
  }
});
