const SUPABASE_URL = "https://nursugqypwjcxgooltgo.supabase.co";
const SUPABASE_KEY = "sb_publishable_6tSi5_on0TrNxfzn8Iue1Q_mdSSOqGo";

const EQUIPO_ID = "ALT-EQ001";
const MAX_COILS = 7;
const coilStates = Array(MAX_COILS).fill(null);
const lastUpdate = document.getElementById("lastUpdate");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");
const coilPanels = document.querySelectorAll(".coils-panel");
const liveCoilPanel = document.querySelector(".coils-panel[data-live='true']");
const clickableCards = document.querySelectorAll("[data-href]");

function createCoilPanel(panel) {
  const title = panel.querySelector("h2")?.textContent ?? "Equipo ?";
  const defaultCount = panel.dataset.defaultCount ?? "3";
  const options = Array.from({ length: MAX_COILS }, (_, index) => {
    const value = String(index + 1);
    const selected = value === defaultCount ? " selected" : "";
    return `<option value="${value}"${selected}>${value}</option>`;
  }).join("");
  const rows = Array.from({ length: MAX_COILS }, (_, index) => `
          <div class="coil-row" data-coil="${index}">
            <strong>Coil ${index}:</strong>
            <div class="lights">
              <span class="light false-light" aria-label="Coil ${index} falso"></span>
              <span class="light true-light" aria-label="Coil ${index} verdadero"></span>
            </div>
          </div>`).join("");

  panel.dataset.activeCoilCount = defaultCount;
  panel.innerHTML = `
        <div class="panel-title">
          <h2>${title}</h2>
          <select class="coil-count-selector" aria-label="Cantidad de coils">
            ${options}
          </select>
        </div>

        <div class="coil-list">
${rows}
        </div>`;

  panel.querySelector(".coil-count-selector").addEventListener("change", (event) => {
    panel.dataset.activeCoilCount = event.target.value;
    renderPanelCoils(panel);
  });

  renderPanelCoils(panel);
}

coilPanels.forEach(createCoilPanel);

for (const card of clickableCards) {
  card.addEventListener("click", (event) => {
    if (event.target.closest("a, button, select")) {
      return;
    }

    window.location.href = card.dataset.href;
  });

  card.addEventListener("keydown", (event) => {
    if (event.target.closest("a, button, select")) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      window.location.href = card.dataset.href;
    }
  });
}

function setConnection(state, text) {
  connectionDot.classList.remove("connected", "error");
  connectionDot.classList.add(state);
  connectionText.textContent = text;
}

function setCoilState(panel, coilId, value) {
  const card = panel.querySelector(`[data-coil="${coilId}"]`);

  if (!card) {
    return;
  }

  const falseLight = card.querySelector(".false-light");
  const trueLight = card.querySelector(".true-light");

  falseLight.classList.toggle("active", value === false);
  trueLight.classList.toggle("active", value === true);
}

function renderPanelCoils(panel) {
  const activeCoilCount = Number(panel.dataset.activeCoilCount ?? 3);
  const isLivePanel = panel === liveCoilPanel;

  panel.classList.toggle("compact", activeCoilCount > 3);

  for (let i = 0; i < MAX_COILS; i++) {
    const row = panel.querySelector(`[data-coil="${i}"]`);

    if (row) {
      row.hidden = i >= activeCoilCount;
    }

    setCoilState(panel, i, isLivePanel && i < activeCoilCount ? coilStates[i] : null);
  }
}

function renderCoils() {
  if (liveCoilPanel) {
    renderPanelCoils(liveCoilPanel);
  }
}

function formatDate(value) {
  if (!value) {
    return "sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(value));
}

async function loadLatestStates() {
  const equipoUrl = new URL(`${SUPABASE_URL}/rest/v1/equipos_plc`);
  equipoUrl.searchParams.set("select", "estado_equipo");
  equipoUrl.searchParams.set("id_equipo", `eq.${EQUIPO_ID}`);
  equipoUrl.searchParams.set("limit", "1");

  const equipoResponse = await fetch(equipoUrl, {
    headers: {
      apikey: SUPABASE_KEY
    }
  });

  if (!equipoResponse.ok) {
    throw new Error(await equipoResponse.text());
  }

  const equipos = await equipoResponse.json();
  const estadoEquipo = equipos[0]?.estado_equipo ?? "apagado";

  if (estadoEquipo !== "encendido") {
    for (let i = 0; i < MAX_COILS; i++) {
      coilStates[i] = null;
    }

    renderCoils();
    setConnection("error", "DESCONECTADO");
    lastUpdate.textContent = "Equipo apagado. Mostrando coils en estado neutro.";
    return;
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/deteccion_coils`);
  url.searchParams.set("select", "coil_id,estado_actual,fecha_deteccion");
  url.searchParams.set("coil_id", "in.(0,1,2,3,4,5,6)");
  url.searchParams.set("order", "fecha_deteccion.desc");
  url.searchParams.set("limit", "70");

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = await response.json();
  const seen = new Set();
  let newestDate = null;

  for (let i = 0; i < MAX_COILS; i++) {
    coilStates[i] = false;
  }

  for (const row of rows) {
    if (seen.has(row.coil_id)) {
      continue;
    }

    seen.add(row.coil_id);
    if (row.coil_id >= 0 && row.coil_id < MAX_COILS) {
      coilStates[row.coil_id] = row.estado_actual;
    }

    newestDate = newestDate ?? row.fecha_deteccion;
  }

  renderCoils();
  setConnection("connected", "CONECTADO");

  if (newestDate) {
    lastUpdate.textContent = `Ultimo cambio recibido: ${formatDate(newestDate)}`;
  } else {
    lastUpdate.textContent = "Sin cambios registrados todavia. Mostrando coils en falso por defecto.";
  }
}

async function refresh() {
  try {
    await loadLatestStates();
  } catch (error) {
    setConnection("error", "SIN DATOS");
    lastUpdate.textContent = `No se pudo leer Supabase: ${error.message}`;
  }
}

renderCoils();
refresh();
setInterval(refresh, 1000);
