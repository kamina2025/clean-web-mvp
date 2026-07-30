// popup.js
const NANO_RPC_ENDPOINT = "https://rpc.nano.to/?key=RPC-KEY-EDDAAAC6AE5E4F6C98823E6758FD88";

document.addEventListener("DOMContentLoaded", () => {
  const balanceText = document.getElementById("balanceText");
  const addressText = document.getElementById("addressText");
  const autoPayToggle = document.getElementById("autoPayToggle");
  const historyList = document.getElementById("historyList");
  const qrcodeDiv = document.getElementById("qrcode");
  const btnRefresh = document.getElementById("btnRefresh");

  // 1. Cargar datos desde almacenamiento local (0 consumo RPC)
  chrome.storage.local.get(["nanoAddress", "lastBalance", "autoPayEnabled", "historyTx"], (res) => {
    const address = res.nanoAddress || "Generando billetera...";
    addressText.innerText = address;

    if (res.lastBalance) {
      balanceText.innerText = `${res.lastBalance} XNO`;
    } else {
      balanceText.innerText = "0.000000 XNO";
    }

    autoPayToggle.checked = res.autoPayEnabled !== false;

    // Generar QR comprobando disponibilidad de la librería
    if (res.nanoAddress && qrcodeDiv && res.nanoAddress.startsWith("nano_")) {
      qrcodeDiv.innerHTML = "";
      try {
        if (typeof QRCode !== "undefined") {
          new QRCode(qrcodeDiv, {
            text: res.nanoAddress,
            width: 100,
            height: 100
          });
        } else if (window.QRCode) {
          new window.QRCode(qrcodeDiv, {
            text: res.nanoAddress,
            width: 100,
            height: 100
          });
        }
      } catch (err) {
        console.warn("⚠️ Módulo QR no disponible:", err);
      }
    }

    renderizarHistorial(res.historyTx || []);
  });

  // 2. Copiar dirección al portapapeles
  addressText.addEventListener("click", () => {
    if (addressText.innerText.startsWith("nano_")) {
      navigator.clipboard.writeText(addressText.innerText);
      const original = addressText.innerText;
      addressText.innerText = "¡Copiado!";
      setTimeout(() => addressText.innerText = original, 1500);
    }
  });

  // 3. Interruptor de Autopago
  autoPayToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ autoPayEnabled: e.target.checked });
  });

  // 4. Refresco manual de Saldo (1 Petición RPC bajo demanda)
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

  // 5. Exportar Semilla / Llave Privada
  document.getElementById("btnExport").addEventListener("click", () => {
    chrome.storage.local.get(["nanoSeed"], (res) => {
      if (res.nanoSeed) {
        prompt("🔒 Copia tu Semilla/Llave Privada (guárdala en un lugar seguro):", res.nanoSeed);
      } else {
        alert("No se encontró ninguna semilla guardada.");
      }
    });
  });

  // 6. Importar Semilla (Limpieza completa y re-sincronización)
  document.getElementById("btnImport").addEventListener("click", () => {
    const nuevaSemilla = prompt("⚠️ ADVERTENCIA: Reemplazará tu billetera actual.\n\nIngresa la nueva Semilla (64 caracteres hex):");
    
    if (nuevaSemilla && /^[0-9a-fA-F]{64}$/.test(nuevaSemilla.trim())) {
      // Limpiar datos de la billetera anterior
      chrome.storage.local.remove(["nanoAddress", "lastBalance", "historyTx"], () => {
        chrome.storage.local.set({ nanoSeed: nuevaSemilla.trim() }, () => {
          alert("✅ Semilla importada con éxito. Cierra y vuelve a abrir el popup para sincronizar la nueva dirección.");
          window.close();
        });
      });
    } else if (nuevaSemilla) {
      alert("❌ Semilla inválida. Debe ser una cadena hexadecimal de 64 caracteres.");
    }
  });

  // Consulta RPC de saldo
  function obtenerSaldoRPC(address) {
    fetch(NANO_RPC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "account_balance", account: address })
    })
    .then(res => res.json())
    .then(data => {
      if (data.balance !== undefined) {
        const balanceXNO = (BigInt(data.balance) / BigInt("1000000000000000000000000000000")).toString();
        const decimales = (BigInt(data.balance) % BigInt("1000000000000000000000000000000")).toString().padStart(30, "0").slice(0, 6);
        const saldoFormateado = `${balanceXNO}.${decimales}`;
        
        balanceText.innerText = `${saldoFormateado} XNO`;
        chrome.storage.local.set({ lastBalance: saldoFormateado });
      }
    })
    .catch((err) => {
      console.error("Error consultando saldo:", err);
      balanceText.innerText = "Error RPC";
    });
  }

  // Renderizado de lista de transacciones recientes
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