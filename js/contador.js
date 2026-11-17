// Contador de visitas anónimo con GoatCounter (sin cookies).
// 1. Crea una cuenta gratis en https://www.goatcounter.com/signup y elige un código, por ejemplo "votoutil".
// 2. Escribe ese código entre las comillas de abajo y sube este fichero a GitHub.
// Si se deja vacío, no se cuenta nada.
var GOATCOUNTER = "";

(function () {
  if (!GOATCOUNTER || location.protocol === "file:") return;
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", "https://" + GOATCOUNTER + ".goatcounter.com/count");
  document.head.appendChild(s);
})();
