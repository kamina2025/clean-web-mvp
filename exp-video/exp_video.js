// ==========================================
// 1. CONFIGURACIÓN GLOBAL Y CATÁLOGO NANFLIX
// ==========================================
const CREADOR_NANO = "nano_19dppxbmzraheooi888n9i9mrks9y5xgop1cg83p3engz3nisfdqj8urma86";

const TRACKERS_WEBTORRENT = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.btorrent.xyz'
];

// Base de datos del catálogo
const CATALOGO = {
  'sintel': {
    title: 'Sintel',
    magnet: 'magnet:?xt=urn:btih:4cdebbc744f902c57bed1841ebfac88f19cf22b5&dn=Sintel.mp4&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com'
  },
  'big-buck-bunny': {
    title: 'Big Buck Bunny',
    magnet: 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Big%20Buck%20Bunny&tr=wss%3A%2F%2Ftracker.openwebtorrent.com'
  },
  'tears-of-steel': {
    title: 'Tears of Steel',
    magnet: 'magnet:?xt=urn:btih:209c8226b299b30d9e0f28a9270632a68a5c3789&dn=Tears%20of%20Steel&tr=wss%3A%2F%2Ftracker.openwebtorrent.com'
  },
  'night-living-dead': {
    title: 'Night of the Living Dead (1968)',
    magnet: 'magnet:?xt=urn:btih:8c903b22ad28a4918e6c466480f2d4e68e0d4c89&dn=Night_of_the_Living_Dead&tr=wss%3A%2F%2Ftracker.openwebtorrent.com'
  }
};

// Variables de Estado
let torrentCliente = null;
let seleccionActual = null; // { contentId, modelType, price }

// Elementos del DOM
const paymentModal = document.getElementById('payment-modal');
const playerModal = document.getElementById('player-modal');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const payAmount = document.getElementById('pay-amount');
const payButton = document.getElementById('pay-button');
const playerTitle = document.getElementById('player-title');

// Stats P2P
const statPeers = document.getElementById('stat-peers');
const statDownload = document.getElementById('stat-download');
const statUpload = document.getElementById('stat-upload');

// STATUS USER
const currentPlanName = document.getElementById('current-plan-name');
const userStatusBadge = document.getElementById('user-status-badge');

// ==========================================
// 2. COMPROBACIÓN DE INICIO Y ESTADO DE SUSCRIPCIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  actualizarEstadoSuscripcion();
});

function actualizarEstadoSuscripcion() {
  const subPass = localStorage.getItem('nanflix_sub_pass');
  if (subPass) {
    const passData = JSON.parse(subPass);
    if (new Date().getTime() < passData.expires) {
      if (currentPlanName) currentPlanName.innerText = "Suscripción VIP (Activa)";
      if (userStatusBadge) userStatusBadge.className = "status-badge status-sub";
      return true;
    }
  }
  if (currentPlanName) currentPlanName.innerText = "Freemium (SD)";
  if (userStatusBadge) userStatusBadge.className = "status-badge status-free";
  return false;
}

// ==========================================
// 3. SELECTOR DE CONTENIDOS & MODELOS DE NEGOCIO
// ==========================================
window.selectContent = function(contentId, modelType, price) {
  const item = CATALOGO[contentId];
  if (!item) {
    alert("Contenido no disponible temporalmente.");
    return;
  }

  seleccionActual = { contentId, modelType, price, title: item.title, magnet: item.magnet };

  // --- MODELO 1: FREEMIUM (GRATIS) ---
  if (modelType === 'free') {
    console.log(`🟢 Acceso Freemium concedido para: ${item.title}`);
    iniciarReproductor(item.title, item.magnet);
    return;
  }

  // --- MODELO 2: PAY-PER-VIEW (PAGO POR USO) ---
  if (modelType === 'ppv') {
    modalTitle.innerText = `Alquilar: ${item.title}`;
    modalDescription.innerText = `Obtén acceso HD inmediato por 24 horas pagando con tu wallet Nano.`;
    payAmount.innerText = price;
    payButton.innerText = `⚡ Pagar ${price} XNO (Pay-Per-View)`;
    payButton.onclick = ejecutarPagoNano;
    paymentModal.classList.remove('hidden');
    return;
  }

  // --- MODELO 3: SUSCRIPCIÓN PREMIUM ---
  if (modelType === 'sub') {
    const tieneSub = actualizarEstadoSuscripcion();
    if (tieneSub) {
      console.log(`💜 Acceso Premium por suscripción activa para: ${item.title}`);
      iniciarReproductor(item.title, item.magnet);
    } else {
      openSubscriptionModal();
    }
  }
};

window.openSubscriptionModal = function() {
  const PRECIO_SUSCRIPCION = '0.001'; // Corregido: Coincide exactamente con el valor mostrado
  seleccionActual = { contentId: 'sub_monthly', modelType: 'sub', price: PRECIO_SUSCRIPCION };
  
  modalTitle.innerText = `Pase VIP Mensual Nanflix`;
  modalDescription.innerText = `Acceso ilimitado a todo el catálogo, máxima resolución y velocidad Ultra P2P.`;
  payAmount.innerText = PRECIO_SUSCRIPCION;
  payButton.innerText = `⚡ Suscribirse por ${PRECIO_SUSCRIPCION} XNO / Mes`;
  payButton.onclick = ejecutarPagoNano;
  paymentModal.classList.remove('hidden');
};

// ==========================================
// 4. INTEGRACIÓN CON EXTENSIÓN Y MICROPAGOS
// ==========================================
function ejecutarPagoNano() {
  if (!seleccionActual) return;

  payButton.disabled = true;
  payButton.innerText = "⏳ Confirmando en la red Nano...";

  const conceptoPago = seleccionActual.modelType === 'sub' 
    ? "Suscripcion Mensual Nanflix" 
    : `Pay-Per-View: ${seleccionActual.title}`;

  window.postMessage({
    type: "CLEANWEB_MICROPAGO_TRIGGER",
    direccionDestino: CREADOR_NANO,
    montoXNO: parseFloat(seleccionActual.price),
    concepto: conceptoPago
  }, "*");
}

// Escuchar respuesta de la Extensión
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEANWEB_PAGO_RESPUESTA") {
    payButton.disabled = false;

    if (event.data.exito) {
      console.log(`✅ Pago exitoso! Hash: ${event.data.hash}`);
      closeModal();

      if (seleccionActual.modelType === 'sub') {
        // Guardar pase de suscripción válido por 30 días
        const expires = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);
        localStorage.setItem('nanflix_sub_pass', JSON.stringify({ hash: event.data.hash, expires }));
        actualizarEstadoSuscripcion();
        alert("🎉 ¡Suscripción VIP activada por 30 días!");
      } else {
        // Reproducir contenido Pay-Per-View alquilado
        iniciarReproductor(seleccionActual.title, seleccionActual.magnet);
      }
    } else {
      alert(`❌ Error en el pago: ${event.data.error || 'Transacción cancelada o saldo insuficiente'}`);
      payButton.innerText = "⚡ Reintentar Pago";
    }
  }
});

// ==========================================
// 5. MOTOR WEBTORRENT (STREAMING RESILIENTE CON FEEDBACK VISUAL)
// ==========================================
const videoLoader = document.getElementById('video-loader');
const loaderStatus = document.getElementById('loader-status');

function actualizarEstadoLoader(mensaje) {
  if (loaderStatus) loaderStatus.innerText = mensaje;
  if (videoLoader) videoLoader.classList.remove('hidden');
}

function ocultarLoader() {
  if (videoLoader) videoLoader.classList.add('hidden');
}

function iniciarReproductor(titulo, magnetUri) {
  playerTitle.innerText = `Reproduciendo: ${titulo}`;
  playerModal.classList.remove('hidden');
  actualizarEstadoLoader("⚡ Conectando a los trackers P2P...");

  iniciarWebTorrent(magnetUri);
}

function iniciarWebTorrent(magnetUri) {
  if (torrentCliente) {
    try {
      torrentCliente.destroy();
    } catch (e) {
      console.warn("⚠️ Limpiando cliente previo:", e);
    }
  }

  torrentCliente = new WebTorrent();

  torrentCliente.on('error', function (err) {
    console.warn("⚠️ Error en WebTorrent:", err.message || err);
    actualizarEstadoLoader("❌ Error conectando a la red P2P");
  });

  console.log("⚡ Conectando a la red P2P WebTorrent...");

  torrentCliente.add(magnetUri, { announce: TRACKERS_WEBTORRENT }, function (torrent) {
    actualizarEstadoLoader("🔍 Buscando peers y descargando metadatos...");

    torrent.on('error', (err) => console.warn("⚠️ Error en Torrent:", err));

    const file = torrent.files.find(f => f.name.endsWith('.webm') || f.name.endsWith('.mp4') || f.name.endsWith('.mkv'));

    if (!file) {
      actualizarEstadoLoader("❌ Archivo de video no encontrado en el Torrent");
      return;
    }

    console.log("✅ Archivo listo para streaming:", file.name);
    file.select();

    // Métricas P2P
    torrent.on('download', () => {
      if (statPeers) statPeers.innerText = torrent.numPeers;
      if (statDownload) statDownload.innerText = `${(torrent.downloadSpeed / 1024).toFixed(1)} KB/s`;
      if (statUpload) statUpload.innerText = `${(torrent.uploadSpeed / 1024).toFixed(1)} KB/s`;

      if (torrent.numPeers > 0 && !videoLoader.classList.contains('hidden')) {
        actualizarEstadoLoader(`🔋 Recibiendo datos (${torrent.numPeers} peer/s)...`);
      }
    });

    // Reemplazo limpio del reproductor
    const viejoPlayer = document.getElementById('video-player');
    const nuevoPlayer = viejoPlayer.cloneNode(false);
    
    nuevoPlayer.removeAttribute('src');
    nuevoPlayer.preload = "auto";
    nuevoPlayer.controls = true;
    
    // Ocultar el loader automáticamente cuando el video empiece a reproducirse
    nuevoPlayer.addEventListener('playing', () => {
      console.log("▶️ Reproducción iniciada. Ocultando loader.");
      ocultarLoader();
    });

    viejoPlayer.parentNode.replaceChild(nuevoPlayer, viejoPlayer);

    let renderStream;
    try {
      renderStream = file.renderTo(nuevoPlayer, { autoplay: false }, function (err, elem) {
        if (err) {
          console.warn("⚠️ Fallo en renderTo, intentando Blob URL:", err);
          iniciarReproduccionPorURL(file, nuevoPlayer);
          return;
        }

        elem.addEventListener('canplay', () => reproducirVideo(elem), { once: true });
      });

      if (renderStream && typeof renderStream.on === 'function') {
        renderStream.on('error', (err) => console.warn("⚠️ Error de buffer:", err));
      }
    } catch (e) {
      console.warn("⚠️ Excepción al renderizar, recurriendo a URL:", e);
      iniciarReproduccionPorURL(file, nuevoPlayer);
    }
  });
}

function iniciarReproduccionPorURL(file, videoElem) {
  file.getBlobURL(function (err, url) {
    if (err) {
      actualizarEstadoLoader("❌ Error cargando video");
      return;
    }
    videoElem.src = url;
    reproducirVideo(videoElem);
  });
}

function reproducirVideo(elem) {
  const promise = elem.play();
  if (promise !== undefined) {
    promise.then(() => {
      ocultarLoader();
    }).catch(err => {
      console.warn("⚠️ Autoplay silenciado por el navegador...", err);
      elem.muted = true;
      elem.play();
      ocultarLoader();
    });
  }
}

// ==========================================
// 6. GESTIÓN DE MODALES
// ==========================================
window.closeModal = function() {
  paymentModal.classList.add('hidden');
  payButton.disabled = false;
};

window.closePlayer = function() {
  playerModal.classList.add('hidden');
  const v = document.getElementById('video-player');
  if (v) v.pause();

  if (torrentCliente) {
    torrentCliente.destroy();
    torrentCliente = null;
  }
};