const SUPABASE_URL = "https://nursugqypwjcxgooltgo.supabase.co";
const SUPABASE_KEY = "sb_publishable_6tSi5_on0TrNxfzn8Iue1Q_mdSSOqGo";

const coilStates = [false, false, false];
const lastUpdate = document.getElementById("lastUpdate");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");

function setConnection(state, text) {
  connectionDot.classList.remove("connected", "error");
  connectionDot.classList.add(state);
  connectionText.textContent = text;
}

function setCoilState(coilId, value) {
  const card = document.querySelector(`[data-coil="${coilId}"]`);

  if (!card) {
    return;
  }

  const falseLight = card.querySelector(".false-light");
  const trueLight = card.querySelector(".true-light");

  falseLight.classList.toggle("active", !value);
  trueLight.classList.toggle("active", value);
}

function renderCoils() {
  for (let i = 0; i < coilStates.length; i++) {
    setCoilState(i, coilStates[i]);
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
  const url = new URL(`${SUPABASE_URL}/rest/v1/deteccion_coils`);
  url.searchParams.set("select", "coil_id,estado_actual,fecha_deteccion");
  url.searchParams.set("coil_id", "in.(0,1,2)");
  url.searchParams.set("order", "fecha_deteccion.desc");
  url.searchParams.set("limit", "30");

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

  for (const row of rows) {
    if (seen.has(row.coil_id)) {
      continue;
    }

    seen.add(row.coil_id);
    coilStates[row.coil_id] = row.estado_actual;
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
