// =================================================================
// 📦 CARGA DE CONFIGURACIÓN Y LIBRERÍAS
// =================================================================
// Cargar config.js primero para que la variable CONFIG esté disponible
try {
  importScripts('config.js');
} catch (e) {
  console.warn("⚠️ No se encontró config.js local, se usará la clave por defecto/fallback.");
}

// Cargar la librería de Nano
importScripts('nanocurrency.min.js');

// =================================================================
// ⚙️ CONFIGURACIÓN Y CONTROL DE CUOTA NANO.TO & APPS SCRIPT
// =================================================================
// Cargar desde config.js si existe, o usar un fallback
const NANO_TO_API_KEY = (typeof CONFIG !== "undefined" && CONFIG.NANO_TO_API_KEY) 
  ? CONFIG.NANO_TO_API_KEY 
  : "TU_API_KEY_AQUI";

const NANO_RPC_ENDPOINT = NANO_TO_API_KEY 
  ? `https://rpc.nano.to/?key=${NANO_TO_API_KEY}` 
  : "https://rpc.nano.to";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzHcnhmQ1nfrdKPbXe4vgrVFYj_8eMybWjHJ5bmGCARImsyDTa6DNFITlB6zo9RYG9UsA/exec";

// Asegurar compatibilidad de la librería
const nanocurrency = self.NanocurrencyWeb || window.NanocurrencyWeb || self.nanocurrency;

console.log("🛡️ Service Worker de Web Limpia (Modo Auto-Recepción + Indexador) iniciado.");
// =================================================================
// 🛠️ FUNCIONES AUXILIARES CRIPTOGRÁFICAS Y CONVERSIÓN
// =================================================================
function generarSemillaHexSegura() {
  const array = new Uint8Array(32);
  self.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nanoToRaw(montoXNO) {
  const [enteros, decimales = ""] = montoXNO.toString().split(".");
  const decimalesPadded = decimales.padEnd(30, "0").slice(0, 30);
  const rawStr = enteros + decimalesPadded;
  return BigInt(rawStr.replace(/^0+/, "") || "0").toString();
}

// Guarda la transacción en local y deduce el monto enviado de la caché de saldo
function guardarHistorialLocal(monto, hash) {
  chrome.storage.local.get(["historyTx", "lastBalance"], (res) => {
    const historial = res.historyTx || [];
    historial.push({
      monto: monto,
      hash: hash,
      timestamp: new Date().toISOString()
    });

    let nuevoSaldoCache = res.lastBalance;
    if (res.lastBalance) {
      const saldoActual = parseFloat(res.lastBalance);
      const resta = Math.max(0, saldoActual - parseFloat(monto));
      nuevoSaldoCache = resta.toFixed(6);
    }

    chrome.storage.local.set({
      historyTx: historial,
      lastBalance: nuevoSaldoCache
    });
  });
}

// =================================================================
// 🔐 OBTENER BILLETERA LOCAL (SIN RED)
// =================================================================
async function obtenerBilleteraLocal() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["nanoSeed", "nanoAddress"], (result) => {
      let seed = result.nanoSeed;
      let address = result.nanoAddress;

      if (!seed || typeof seed !== "string" || !/^[0-9a-fA-F]{64}$/.test(seed.trim())) {
        console.log("⚠️ Semilla vacía o inválida detectada. Generando nueva semilla...");
        seed = generarSemillaHexSegura();

        const cuentas = nanocurrency.wallet.legacyAccounts(seed, 0, 1);
        const secretKey = cuentas[0].privateKey;
        address = cuentas[0].address;

        chrome.storage.local.set({ nanoSeed: seed, nanoAddress: address }, () => {
          console.log("🆕 Nueva billetera generada localmente:", address);
          resolve({ seed, address, secretKey });
        });
      } else {
        seed = seed.trim();
        const cuentas = nanocurrency.wallet.legacyAccounts(seed, 0, 1);
        const secretKey = cuentas[0].privateKey;
        address = cuentas[0].address;

        resolve({ seed, address, secretKey });
      }
    });
  });
}

// =================================================================
// 📥 PROCESAR Y ACEPTAR ENVÍOS PENDIENTES (AUTO-RECEIVE)
// =================================================================
async function procesarBloquesPendientes(wallet) {
  try {
    const resReceivable = await fetch(NANO_RPC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "receivable",
        account: wallet.address,
        count: "5",
        threshold: "1"
      })
    });

    const dataReceivable = await resReceivable.json();
    const blocks = dataReceivable.blocks;

    if (!blocks || Object.keys(blocks).length === 0) {
      return { procesados: 0 };
    }

    console.log(`📥 Se encontraron ${Object.keys(blocks).length} transacción(es) pendiente(s). Procesando...`);
    let procesados = 0;

    for (const sendHash in blocks) {
      const amountRaw = typeof blocks[sendHash] === "object" ? blocks[sendHash].amount : blocks[sendHash];

      const resAccount = await fetch(NANO_RPC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "account_info", account: wallet.address, representative: "true" })
      });
      const accountInfo = await resAccount.json();

      const balanceRaw = accountInfo.balance || "0";
      const frontier = accountInfo.frontier || "0000000000000000000000000000000000000000000000000000000000000000";
      const representative = accountInfo.representative || wallet.address;

      const workRoot =
        frontier === "0000000000000000000000000000000000000000000000000000000000000000"
          ? nanocurrency.wallet.legacyAccounts(wallet.seed, 0, 1)[0].publicKey
          : frontier;

      const resWork = await fetch(NANO_RPC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "work_generate", hash: workRoot })
      });
      const workData = await resWork.json();

      if (!workData.work) continue;

      const receiveData = {
        walletBalanceRaw: String(balanceRaw),
        toAddress: wallet.address,
        representativeAddress: representative,
        frontier: frontier,
        transactionHash: sendHash,
        amountRaw: String(amountRaw),
        work: workData.work
      };

      const signedBlock = nanocurrency.block.receive(receiveData, wallet.secretKey);
      const blockPayload = typeof signedBlock === "string" ? JSON.parse(signedBlock) : signedBlock;

      const resProcess = await fetch(NANO_RPC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process",
          json_block: "true",
          subtype: "receive",
          block: blockPayload
        })
      });
      const processData = await resProcess.json();

      if (processData.hash) {
        console.log(`✅ Depósito aceptado y sumado al saldo. Hash de recepción: ${processData.hash}`);
        procesados++;
      }
    }

    return { procesados };
  } catch (err) {
    console.warn("⚠️ No se pudieron procesar depósitos pendientes:", err.message);
    return { procesados: 0, error: err.message };
  }
}

// =================================================================
// 💸 ENVÍO DE MICROPAGO (CON AUTO-RECEPCIÓN PREVIA)
// =================================================================
async function enviarMicropagoReal(direccionDestino, montoXNO) {
  console.log(`📡 Iniciando proceso de pago...`);

  try {
    const wallet = await obtenerBilleteraLocal();
    await procesarBloquesPendientes(wallet);

    console.log("1️⃣ Consultando estado de la cuenta...");
    const resAccount = await fetch(NANO_RPC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "account_info",
        account: wallet.address,
        representative: "true"
      })
    });
    const accountInfo = await resAccount.json();

    const balanceRaw = accountInfo.balance || "0";
    const frontier = accountInfo.frontier || "0000000000000000000000000000000000000000000000000000000000000000";
    const representative = accountInfo.representative || wallet.address;

    const amountRaw = nanoToRaw(montoXNO);
    console.log(`📐 Monto a transferir: ${montoXNO} XNO (${amountRaw} RAW)`);

    if (BigInt(balanceRaw) < BigInt(amountRaw)) {
      console.warn(`⚠️ Saldo insuficiente en la billetera local.`);
      return { success: false, error: "Saldo insuficiente" };
    }

    const workRoot =
      frontier === "0000000000000000000000000000000000000000000000000000000000000000"
        ? nanocurrency.wallet.legacyAccounts(wallet.seed, 0, 1)[0].publicKey
        : frontier;

    console.log("2️⃣ Solicitando Proof-of-Work (PoW)...");
    const resWork = await fetch(NANO_RPC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "work_generate", hash: workRoot })
    });
    const workData = await resWork.json();

    if (!workData.work) {
      throw new Error("No se pudo generar el PoW: " + JSON.stringify(workData));
    }

    console.log("⚙️ Firmando bloque localmente...");
    const sendData = {
      walletBalanceRaw: String(balanceRaw),
      fromAddress: wallet.address,
      toAddress: direccionDestino,
      representativeAddress: representative,
      frontier: frontier,
      amountRaw: String(amountRaw),
      work: workData.work
    };

    const signedBlock = nanocurrency.block.send(sendData, wallet.secretKey);
    const blockPayload = typeof signedBlock === "string" ? JSON.parse(signedBlock) : signedBlock;

    console.log("3️⃣ Publicando bloque firmado...");
    const resProcess = await fetch(NANO_RPC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "process",
        json_block: "true",
        subtype: "send",
        block: blockPayload
      })
    });
    const processData = await resProcess.json();

    if (processData.hash) {
      console.log(`🎉 Transacción exitosa! Hash: ${processData.hash}`);
      return { success: true, hash: processData.hash };
    } else {
      console.error("❌ La red rechazó el bloque:", processData);
      return { success: false, error: JSON.stringify(processData) };
    }
  } catch (err) {
    console.error("❌ Error en la transacción:", err);
    return { success: false, error: err.message };
  }
}

// =================================================================
// 📊 REGISTRO DE MÉTRICA EN GOOGLE APPS SCRIPT
// =================================================================
async function registrarMetricaIndexador(datosEvento) {
  try {
    const payload = {
      action: "log_transaction",
      site_id: datosEvento.site_id || "SITE-UNREGISTERED",
      dwell_time_sec: datosEvento.dwell_time_sec || 15,
      payment_status: datosEvento.payment_status,
      amount_xno: datosEvento.monto,
      nano_tx_hash: datosEvento.hash
    };

    console.log("📊 Enviando métrica a Google Sheets...", payload);

    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).catch((err) => console.warn("Métrica no registrada:", err));
  } catch (err) {
    console.error("⚠️ Error en métrica:", err);
  }
}

/// =================================================================
// 📩 OYENTE DE MENSAJES EN BACKGROUND WORKER
// =================================================================
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
  if (mensaje.action === "DISPARAR_MICROPAGO") {
    // Extraer datos recibidos desde content_script.js
    const { site_id, destino, monto, dwell_time_sec, url, titulo } = mensaje.datos || {};

    console.log(`📩 Solicitud recibida desde: ${titulo || "Página"} (${url || "N/A"})`);
    console.log(`💸 Procesando micropago: ${monto} XNO -> ${destino}`);

    // Ejecutar la función de envío real en la red Nano
    enviarMicropagoReal(destino, monto)
      .then((resultado) => {
        // Normalizar resultado para soportar tanto retorno de String (hash) como de Objeto ({ success, hash })
        const esExitoso = typeof resultado === "object" ? resultado.success !== false : Boolean(resultado);
        const txHash = typeof resultado === "object" ? resultado.hash || resultado.blockHash : resultado;

        if (esExitoso && txHash) {
          console.log(`✅ Micropago automático completado. Hash: ${txHash}`);

          // 1. Guardar en historial local (0 consumo RPC)
          if (typeof guardarHistorialLocal === "function") {
            guardarHistorialLocal(monto, txHash);
          }

          // 2. Registrar métrica en Google Sheets / Indexador
          if (typeof registrarMetricaIndexador === "function") {
            registrarMetricaIndexador({
              site_id: site_id || "SITE-UNREGISTERED",
              dwell_time_sec: dwell_time_sec || 0,
              payment_status: "SUCCESS",
              monto: monto,
              hash: txHash,
              url: url,
              titulo: titulo
            });
          }

          // Responder a content_script.js
          sendResponse({ exito: true, hash: txHash });
        } else {
          const errorMsg =
            typeof resultado === "object" && resultado.error ? resultado.error : "Transacción no confirmada";
          console.error("❌ Transacción fallida:", errorMsg);

          if (typeof registrarMetricaIndexador === "function") {
            registrarMetricaIndexador({
              site_id: site_id || "SITE-UNREGISTERED",
              dwell_time_sec: dwell_time_sec || 0,
              payment_status: "FAILED",
              monto: monto,
              hash: "FAILED_TX",
              url: url,
              titulo: titulo
            });
          }

          sendResponse({ exito: false, error: errorMsg });
        }
      })
      .catch((err) => {
        const errorString = err ? err.message || err.toString() : "Error desconocido";
        console.error("❌ Error inesperado durante el micropago:", errorString);

        if (typeof registrarMetricaIndexador === "function") {
          registrarMetricaIndexador({
            site_id: site_id || "SITE-UNREGISTERED",
            dwell_time_sec: dwell_time_sec || 0,
            payment_status: "FAILED",
            monto: monto,
            hash: "ERROR_TX",
            url: url,
            titulo: titulo
          });
        }

        sendResponse({ exito: false, error: errorString });
      });

    return true; // Mantiene el canal de comunicación abierto para la respuesta asíncrona (Manifest V3)
  }
});
