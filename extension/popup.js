const NANO_RPC_ENDPOINT = "https://rpc.nano.to/?key=RPC-KEY-EDDAAAC6AE5E4F6C98823E6758FD88";

// 1. Generar semilla segura de 64 caracteres hex
function generarSemillaSegura() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('').toUpperCase();
}

// 2. Detectar la librería (incluyendo NanocurrencyWeb que usa tu nanocurrency.min.js)
function obtenerLibreriaNano() {
  if (typeof NanocurrencyWeb !== "undefined") return NanocurrencyWeb;
  if (typeof nanocurrency !== "undefined") return nanocurrency;
  if (typeof NanoCurrency !== "undefined") return NanoCurrency;
  if (typeof window.NanocurrencyWeb !== "undefined") return window.NanocurrencyWeb;
  return null;
}

// 3. Función universal para derivar la primera dirección (index 0) desde la seed
function derivarDireccionNano(seed) {
  const nanoLib = obtenerLibreriaNano();
  if (!nanoLib) return null;

  try {
    // Método Estándar de nanocurrency-web (wallet.legacyAccounts)
    if (nanoLib.wallet && typeof nanoLib.wallet.legacyAccounts === "function") {
      const cuentas = nanoLib.wallet.legacyAccounts(seed, 0, 0);
      return cuentas[0]?.address || null;
    }
    // Métodos alternativos
    if (typeof nanoLib.deriveSecretKey === "function") {
      const secretKey = nanoLib.deriveSecretKey(seed, 0);
      const publicKey = nanoLib.derivePublicKey(secretKey);
      return nanoLib.deriveAddress(publicKey);
    }
  } catch (err) {
    console.error("Error derivando dirección Nano:", err);
  }
  return null;
}

document.addEventListener("DOMContentLoaded", () => {
  const balanceText = document.getElementById("balanceText");
  const addressText = document.getElementById("addressText");
  const autoPayToggle = document.getElementById("autoPayToggle");
  const historyList = document.getElementById("historyList");
  const qrcodeDiv = document.getElementById("qrcode");
  const btnRefresh = document.getElementById("btnRefresh");

  // A. Cargar o Crear Billetera al abrir
  chrome.storage.local.get(["nanoSeed", "nanoAddress", "lastBalance", "autoPayEnabled", "historyTx"], (res) => {
    let seed = res.nanoSeed;
    let address = res.nanoAddress;

    // Si NO hay semilla, se crea una automáticamente
    if (!seed) {
      seed = generarSemillaSegura();
      chrome.storage.local.set({ nanoSeed: seed });
      console.log("Nueva semilla generada automáticamente.");
    }

    // Si NO hay dirección guardada (o está vacía), la derivamos con la librería
    if (!address || !address.startsWith("nano_")) {
      const direccionCalculada = derivarDireccionNano(seed);
      if (direccionCalculada) {
        address = direccionCalculada;
        chrome.storage.local.set({ nanoAddress: address });
      }
    }

    addressText.innerText = address || "Sin billetera (Error librería)";

    if (res.lastBalance) {
      balanceText.innerText = `${res.lastBalance} XNO`;
    } else {
      balanceText.innerText = "0.000000 XNO";
    }

    autoPayToggle.checked = res.autoPayEnabled !== false;

    // Generar código QR
    if (address && qrcodeDiv && address.startsWith("nano_")) {
      qrcodeDiv.innerHTML = "";
      try {
        const QR = typeof QRCode !== "undefined" ? QRCode : window.QRCode;
        if (QR) {
          new QR(qrcodeDiv, { text: address, width: 100, height: 100 });
        }
      } catch (err) {
        console.warn("⚠️ Módulo QR no disponible:", err);
      }
    }

    renderizarHistorial(res.historyTx || []);

    // Consultar saldo si tenemos dirección válida
    if (address && address.startsWith("nano_")) {
      obtenerSaldoRPC(address);
    }
  });

  // B. Copiar dirección al portapapeles
  addressText.addEventListener("click", () => {
    if (addressText.innerText.startsWith("nano_")) {
      navigator.clipboard.writeText(addressText.innerText);
      const original = addressText.innerText;
      addressText.innerText = "¡Copiado!";
      setTimeout(() => addressText.innerText = original, 1500);
    }
  });

  // C. Interruptor Autopago
  autoPayToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ autoPayEnabled: e.target.checked });
  });

  // D. Botón Refrescar Saldo
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      chrome.storage.local.get(["nanoAddress"], (res) => {
        if (res.nanoAddress && res.nanoAddress.startsWith("nano_")) {
          balanceText.innerText = "Consultando...";
          obtenerSaldoRPC(res.nanoAddress);
        }
      });
    });
  }

  // E. Exportar Semilla
  document.getElementById("btnExport").addEventListener("click", () => {
    chrome.storage.local.get(["nanoSeed"], (res) => {
      if (res.nanoSeed) {
        prompt("🔒 Copia tu Semilla/Llave Privada (guárdala en un lugar seguro):", res.nanoSeed);
      } else {
        alert("No se encontró ninguna semilla guardada.");
      }
    });
  });

  // F. Importar Semilla
  document.getElementById("btnImport").addEventListener("click", () => {
    const nuevaSemilla = prompt("⚠️ ADVERTENCIA: Reemplazará tu billetera actual.\n\nIngresa la nueva Semilla (64 caracteres hex):");

    if (nuevaSemilla && /^[0-9a-fA-F]{64}$/.test(nuevaSemilla.trim())) {
      const seedLimpia = nuevaSemilla.trim().toUpperCase();
      const nuevaDireccion = derivarDireccionNano(seedLimpia);

      if (!nuevaDireccion) {
        alert("❌ Error: No se pudo derivar la dirección con la librería Nano.");
        return;
      }

      chrome.storage.local.remove(["nanoAddress", "lastBalance", "historyTx"], () => {
        chrome.storage.local.set({
          nanoSeed: seedLimpia,
          nanoAddress: nuevaDireccion
        }, () => {
          alert("✅ Semilla importada y dirección actualizada con éxito:\n" + nuevaDireccion);
          window.location.reload();
        });
      });
    } else if (nuevaSemilla) {
      alert("❌ Semilla inválida. Debe ser una cadena hexadecimal de 64 caracteres.");
    }
  });

  // G. Consulta RPC de saldo
  function obtenerSaldoRPC(address) {
    fetch(NANO_RPC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "account_balance", account: address })
    })
    .then(res => res.json())
    .then(data => {
      if (data.balance !== undefined) {
        const raw = BigInt(data.balance);
        const mega = BigInt("1000000000000000000000000000000"); // 10^30
        
        const entero = (raw / mega).toString();
        const resto = (raw % mega).toString().padStart(30, "0").slice(0, 6);
        const saldoFormateado = `${entero}.${resto}`;

        balanceText.innerText = `${saldoFormateado} XNO`;
        chrome.storage.local.set({ lastBalance: saldoFormateado });
      }
    })
    .catch((err) => {
      console.error("Error consultando saldo:", err);
      balanceText.innerText = "Error RPC";
    });
  }

  // H. Historial de transacciones
  function renderizarHistorial(lista) {
    if (!lista || lista.length === 0) return;
    historyList.innerHTML = "";
    lista.slice(-5).reverse().forEach(tx => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <span>-${tx.monto} XNO</span>
        <span class="tx-hash" title="${tx.hash}">${tx.hash.slice(0, 8)}...</span>
      `;
      historyList.appendChild(item);
    });
  }
});