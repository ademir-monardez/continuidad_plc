const SUPABASE_URL = "https://nursugqypwjcxgooltgo.supabase.co";
const SUPABASE_KEY = "sb_publishable_6tSi5_on0TrNxfzn8Iue1Q_mdSSOqGo";
const EQUIPO_ID = "ALT-EQ001";
const MAX_COILS = 7;
const coilStates = Array(MAX_COILS).fill(null);

const detailConnection = document.getElementById("detailConnection");
const detailConnectionDot = document.getElementById("detailConnectionDot");
const detailConnectionText = document.getElementById("detailConnectionText");
const historyTableBody = document.getElementById("historyTableBody");
const historyPrevButton = document.getElementById("historyPrevButton");
const historyNextButton = document.getElementById("historyNextButton");
const historyPageText = document.getElementById("historyPageText");
const HISTORY_PAGE_SIZE = 10;
let historyPage = 0;
let lastHistoryRowCount = 0;

function setDetailConnection(isConnected) {
  detailConnection.classList.remove("loading");
  detailConnection.classList.toggle("connected", isConnected);
  detailConnection.classList.toggle("disconnected", !isConnected);
  detailConnectionDot.classList.toggle("connected", isConnected);
  detailConnectionDot.classList.toggle("error", !isConnected);
  detailConnectionText.textContent = isConnected ? "CONECTADO" : "DESCONECTADO";
}

function setDetailCoilState(coilId, value) {
  const card = document.querySelector(`.detail-coil-card[data-coil="${coilId}"]`);

  if (!card) {
    return;
  }

  const falseLight = card.querySelector(".false-light");
  const trueLight = card.querySelector(".true-light");

  falseLight.classList.toggle("active", value === false);
  trueLight.classList.toggle("active", value === true);
}

function renderDetailCoils() {
  for (let i = 0; i < MAX_COILS; i++) {
    setDetailCoilState(i, coilStates[i]);
  }
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(value));
}

function renderHistoryRows(rows) {
  historyTableBody.innerHTML = "";

  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No hay registros para mostrar.";
    row.appendChild(cell);
    historyTableBody.appendChild(row);
    return;
  }

  for (const item of rows) {
    const row = document.createElement("tr");
    const values = [
      item.coil_nombre ?? "",
      String(item.estado_actual),
      item.evento ?? "",
      formatDate(item.fecha_deteccion)
    ];

    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }

    historyTableBody.appendChild(row);
  }
}

function updateHistoryPagination() {
  historyPrevButton.disabled = historyPage === 0;
  historyNextButton.disabled = lastHistoryRowCount < HISTORY_PAGE_SIZE;
  historyPageText.textContent = `Pagina ${historyPage + 1}`;
}

async function loadHistoryPage() {
  const from = historyPage * HISTORY_PAGE_SIZE;
  const to = from + HISTORY_PAGE_SIZE - 1;
  const historyUrl = new URL(`${SUPABASE_URL}/rest/v1/deteccion_coils`);
  historyUrl.searchParams.set("select", "coil_nombre,estado_actual,evento,fecha_deteccion");
  historyUrl.searchParams.set("order", "fecha_deteccion.desc");

  const response = await fetch(historyUrl, {
    headers: {
      apikey: SUPABASE_KEY,
      Range: `${from}-${to}`
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = await response.json();
  lastHistoryRowCount = rows.length;
  renderHistoryRows(rows);
  updateHistoryPagination();
}

async function loadDetailState() {
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
  const isConnected = equipos[0]?.estado_equipo === "encendido";

  setDetailConnection(isConnected);

  if (!isConnected) {
    for (let i = 0; i < MAX_COILS; i++) {
      coilStates[i] = null;
    }

    renderDetailCoils();
    return;
  }

  const coilsUrl = new URL(`${SUPABASE_URL}/rest/v1/deteccion_coils`);
  coilsUrl.searchParams.set("select", "coil_id,estado_actual,fecha_deteccion");
  coilsUrl.searchParams.set("coil_id", "in.(0,1,2,3,4,5,6)");
  coilsUrl.searchParams.set("order", "fecha_deteccion.desc");
  coilsUrl.searchParams.set("limit", "70");

  const coilsResponse = await fetch(coilsUrl, {
    headers: {
      apikey: SUPABASE_KEY
    }
  });

  if (!coilsResponse.ok) {
    throw new Error(await coilsResponse.text());
  }

  const rows = await coilsResponse.json();
  const seen = new Set();

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
  }

  renderDetailCoils();
}

async function refreshDetailState() {
  try {
    await loadDetailState();
  } catch {
    setDetailConnection(false);

    for (let i = 0; i < MAX_COILS; i++) {
      coilStates[i] = null;
    }

    renderDetailCoils();
  }
}

historyPrevButton.addEventListener("click", async () => {
  if (historyPage === 0) {
    return;
  }

  historyPage -= 1;
  await loadHistoryPage();
});

historyNextButton.addEventListener("click", async () => {
  if (lastHistoryRowCount < HISTORY_PAGE_SIZE) {
    return;
  }

  historyPage += 1;
  await loadHistoryPage();
});

renderDetailCoils();
refreshDetailState();
loadHistoryPage();
setInterval(refreshDetailState, 1000);
