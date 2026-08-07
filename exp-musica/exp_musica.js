const CREADOR_NANO = "nano_19dppxbmzraheooi888n9i9mrks9y5xgop1cg83p3engz3nisfdqj8urma86";

const TRACKERS_WSS = [
  "tr=wss%3A%2F%2Ftracker.openwebtorrent.com",
  "tr=wss%3A%2F%2Ftracker.btorrent.xyz"
].join("&");

const MAGNET_ALBUM_COMPLETO = `magnet:?xt=urn:btih:7d5fc5e5f4255c478a1e69d50a37ff814b6cab65&dn=album&${TRACKERS_WSS}`;

// Catálogo de canciones: Las 2 primeras GRATIS (Freemium)
const CANCIONES = [
  {
    id: 1,
    nombre: "Let The Buzzards Feed",
    artista: "Jon Shuemaker",
    precio: 0,
    esGratis: true,
    magnet: `magnet:?xt=urn:btih:c44c629b7d8d752c38fa4a9b47711b7855527832&dn=01+Jon+Shuemaker+-+Let+The+Buzzards+Feed.mp3&${TRACKERS_WSS}`
  },
  {
    id: 2,
    nombre: "Chloroplast Sunrise",
    artista: "Jon Shuemaker",
    precio: 0,
    esGratis: true,
    magnet: `magnet:?xt=urn:btih:16e986ccbef4bc7f1bdc3c2a69b80984ab0a815f&dn=01+Jon+Shuemaker+-+Chloroplast+Sunrise.mp3&${TRACKERS_WSS}`
  },
  {
    id: 3,
    nombre: "New Eden",
    artista: "Jon Shuemaker",
    precio: 0.0001,
    esGratis: false,
    magnet: `magnet:?xt=urn:btih:946d8518f51221206c15c59e801d0589716fef6b&dn=01+Jon+Shuemaker+-+New+Eden.mp3&${TRACKERS_WSS}`
  },
  {
    id: 4,
    nombre: "The Other Realm",
    artista: "Jon Shuemaker",
    precio: 0.0001,
    esGratis: false,
    magnet: `magnet:?xt=urn:btih:459daf3796c7e2b3c07187cb8cd0fef0650f3e90&dn=01+Jon+Shuemaker+-+The+Other+Realm.mp3&${TRACKERS_WSS}`
  },
  {
    id: 5,
    nombre: "Traces",
    artista: "Jon Shuemaker",
    precio: 0.0001,
    esGratis: false,
    magnet: `magnet:?xt=urn:btih:c3e564b3286d0416021c7e3bd19d0cf6d55c818d&dn=01+Jon+Shuemaker+-+Traces.mp3&${TRACKERS_WSS}`
  }
];

// Estado global
let albumComprado = false;
let esFanVip = false;
let transaccionPendiente = null;
let statsInterval = null;

const client = new WebTorrent();

document.addEventListener("DOMContentLoaded", () => {
  renderizarListaCanciones();
});

function renderizarListaCanciones() {
  const container = document.getElementById('trackList');
  if (!container) return;

  container.innerHTML = CANCIONES.map((cancion, index) => {
    let etiquetaPrecio = "";
    if (cancion.esGratis) {
      etiquetaPrecio = `<span style="color: #10b981; font-weight: bold;">FREE</span>`;
    } else if (albumComprado) {
      etiquetaPrecio = `<span style="color: #3b82f6;">Desbloqueado (Álbum)</span>`;
    } else {
      etiquetaPrecio = `Tarifa: ${cancion.precio} XNO`;
    }

    return `
      <div class="track-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #374151;">
        <div>
          <strong>${index + 1}. ${cancion.nombre}</strong><br>
          <small style="color: #9ca3af;">${cancion.artista} — ${etiquetaPrecio}</small>
        </div>
        <button class="play-btn" onclick="solicitarAccesoPista(${cancion.id})">▶️ Reproducir</button>
      </div>
    `;
  }).join('');
}

function solicitarAccesoPista(cancionId) {
  const cancion = CANCIONES.find(c => c.id === cancionId);
  if (!cancion) return;

  if (cancion.esGratis || albumComprado) {
    document.getElementById('musicStatus').innerText = `🎶 Acceso concedido: Cargando "${cancion.nombre}"...`;
    conectarYReproducirTorrent(cancion);
    return;
  }

  transaccionPendiente = { tipo: "STREAM", datos: cancion };
  document.getElementById('musicStatus').innerText = `⏳ Pagando ${cancion.precio} XNO para escuchar "${cancion.nombre}"...`;

  dispararPagoNano(cancion.precio, `Música: ${cancion.nombre}`);
}

function comprarAlbum() {
  if (albumComprado) {
    alert("¡Ya has comprado el álbum completo!");
    return;
  }

  transaccionPendiente = { tipo: "ALBUM", precio: 0.0004 };
  document.getElementById('musicStatus').innerText = `⏳ Procesando compra del Álbum completo (0.0004 XNO)...`;

  dispararPagoNano(0.0004, "Compra de Álbum Completo - Jon Shuemaker");
}

function suscribirseFan() {
  if (esFanVip) {
    alert("¡Ya eres un Fan VIP de Jon Shuemaker!");
    return;
  }

  transaccionPendiente = { tipo: "FAN_VIP", precio: 0.001 };
  document.getElementById('musicStatus').innerText = `⏳ Pagando suscripción Fan VIP (0.001 XNO)...`;

  dispararPagoNano(0.001, "Suscripción Fan VIP - Jon Shuemaker");
}

function dispararPagoNano(monto, concepto) {
  window.postMessage({
    type: "CLEANWEB_MICROPAGO_TRIGGER",
    direccionDestino: CREADOR_NANO,
    montoXNO: monto,
    concepto: concepto
  }, "*");
}

window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEANWEB_PAGO_RESPUESTA") {
    const statusDiv = document.getElementById('musicStatus');

    if (event.data.exito && transaccionPendiente) {
      statusDiv.innerText = `⚡ Pago confirmado (${event.data.hash.substring(0, 10)}...). Activando contenido...`;

      if (transaccionPendiente.tipo === "STREAM") {
        conectarYReproducirTorrent(transaccionPendiente.datos);
      } 
      else if (transaccionPendiente.tipo === "ALBUM") {
        albumComprado = true;
        document.getElementById('downloadAlbumContainer').style.display = 'block';
        document.getElementById('btnAlbum').style.display = 'none';
        renderizarListaCanciones();
        statusDiv.innerText = `🎉 ¡Álbum desbloqueado con éxito! Puedes escuchar cualquier canción o descargar el Torrent completo.`;
      } 
      else if (transaccionPendiente.tipo === "FAN_VIP") {
        esFanVip = true;
        document.getElementById('fanBadgeContainer').style.display = 'block';
        document.getElementById('btnFan').innerText = "⭐ Eres Fan VIP";
        document.getElementById('btnFan').disabled = true;
        statusDiv.innerText = `👑 ¡Bienvenido al Club Fan VIP! Tu estampilla ya aparece en portada.`;
      }

      transaccionPendiente = null;
    } else {
      statusDiv.innerText = `❌ Operación cancelada o fallida: ${event.data.error || "Error de saldo/pago"}`;
      transaccionPendiente = null;
    }
  }
});

/**
 * Conexión P2P y reinicio limpio del elemento de audio HTML5
 */
/**
 * Destruye el reproductor anterior y crea uno nuevo e independiente para evitar colisiones en MediaSource.
 */
function reiniciarReproductorAudio() {
  const container = document.getElementById('audioContainer');
  if (!container) return document.getElementById('mainAudioPlayer');

  // Limpiar HTML del contenedor para destruir cualquier MediaSourceStream activo
  container.innerHTML = '<audio id="mainAudioPlayer" controls style="display: block; margin-top: 15px; width: 100%;"></audio>';
  return document.getElementById('mainAudioPlayer');
}

/**
 * Conexión P2P y reinicio limpio del elemento de audio HTML5
 */
function conectarYReproducirTorrent(cancion) {
  const statusDiv = document.getElementById('musicStatus');
  
  // Recreamos la etiqueta <audio> limpia para evitar InvalidStateError / appendBuffer
  const audioElement = reiniciarReproductorAudio();

  let torrent = client.get(cancion.magnet);

  if (torrent) {
    reproducirArchivo(torrent, audioElement, statusDiv, cancion);
  } else {
    client.add(cancion.magnet, (nuevoTorrent) => {
      reproducirArchivo(nuevoTorrent, audioElement, statusDiv, cancion);
    });
  }
}

function reproducirArchivo(torrent, audioElement, statusDiv, cancion) {
  const file = torrent.files.find(f => f.name.endsWith('.mp3') || f.name.endsWith('.ogg') || f.name.endsWith('.wav'));

  if (file) {
    statusDiv.innerText = `🎶 Streaming P2P: "${cancion.nombre}".`;
    document.getElementById('currentTrackTitle').innerText = `${cancion.nombre} - ${cancion.artista}`;

    // renderTo inyecta el stream en el elemento <audio> recién generado
    file.renderTo(audioElement, { autoplay: true }, (err) => {
      if (err) {
        console.error("Error al renderizar audio:", err);
      }
    });

    document.getElementById('p2pStats').style.display = 'block';
    iniciarMonitoreoPeers(torrent);
  } else {
    statusDiv.innerText = `❌ No se encontró un archivo de audio legible en el Torrent.`;
  }
}
function descargarArchivosAlbum() {
  const statusDiv = document.getElementById('musicStatus');
  statusDiv.innerText = `📦 Conectando al torrent del álbum completo para descarga local...`;

  client.add(MAGNET_ALBUM_COMPLETO, (torrent) => {
    torrent.files.forEach((file) => {
      file.getBlobURL((err, url) => {
        if (err) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    });
    statusDiv.innerText = `⬇️ Descarga del álbum iniciada.`;
  });
}

function iniciarMonitoreoPeers(torrent) {
  if (statsInterval) clearInterval(statsInterval);

  const numPeersEl = document.getElementById('numPeers');
  const downloadSpeedEl = document.getElementById('downloadSpeed');
  const uploadSpeedEl = document.getElementById('uploadSpeed');
  const progressBar = document.getElementById('torrentProgress');
  const progressPercent = document.getElementById('progressPercent');

  statsInterval = setInterval(() => {
    const porcentaje = Math.round(torrent.progress * 100);
    progressBar.value = porcentaje;
    progressPercent.innerText = `${porcentaje}%`;

    numPeersEl.innerText = torrent.numPeers;

    const downloadKbps = (torrent.downloadSpeed / 1024).toFixed(1);
    const uploadKbps = (torrent.uploadSpeed / 1024).toFixed(1);

    downloadSpeedEl.innerText = `${downloadKbps} KB/s`;
    uploadSpeedEl.innerText = `${uploadKbps} KB/s`;

    if (porcentaje === 100) {
      progressPercent.innerText = `100% (Compartiendo en enjambre / Seeding)`;
    }
  }, 500);
}