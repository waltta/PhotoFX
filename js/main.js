/* js/main.js */

/* ------------------------------------------------------------------
 * 1️⃣  Variables globales
 * ------------------------------------------------------------------ */
const fileInput   = document.getElementById('fileInput');
const canvas      = document.getElementById('previewCanvas');
const ctx         = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');

/* Canvas temporaire : utilisé pour encoder/décoder JPEG (artefacts) */
const tempCanvas = document.createElement('canvas');
const tempCtx    = tempCanvas.getContext('2d');

let originalImg;          // image chargée par l’utilisateur
let currentQuality = 0.9; // valeur de qualité à envoyer dans canvas.toBlob()

/* ------------------------------------------------------------------
 * 2️⃣  Animation VHS « vidéo » (toggle + loop)
 * ------------------------------------------------------------------ */
let vhsAnimId       = null;
let isVHSAnimating  = false;

/**
 * Dessine une seule image « VHS‑style » avec un léger jitter et les
 * scanlines. Cette fonction est appelée à chaque frame de l’animation.
 */
function drawVHSFrame() {
  /* Valeurs des sliders (blur / brightness) */
  const blurVal       = parseFloat(document.getElementById('blurSlider').noUiSlider.get());
  const brightnessVal = parseFloat(document.getElementById('brightnessSlider').noUiSlider.get());

  /* On redessine le canvas complet à chaque frame */
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  /* --------------------------------------------------------------
   * 1️⃣  Application des filtres (blur / brightness)
   * -------------------------------------------------------------- */
  if ('filter' in ctx) {
    ctx.filter = `blur(${blurVal}px) brightness(${brightnessVal})`;
  }

  /* --------------------------------------------------------------
   * 2️⃣  Décalage aléatoire (jitter) – « vibrato » VHS
   * -------------------------------------------------------------- */
  const jitterX = Math.random() * 4 - 2; // ±2px
  const jitterY = Math.random() * 4 - 2;
  ctx.save();
  ctx.translate(jitterX, jitterY);
  ctx.drawImage(originalImg, 0, 0);
  ctx.restore();

  /* Reset des filtres */
  ctx.filter = 'none';

  /* --------------------------------------------------------------
   * 3️⃣  Scanlines (ligne noire semi‑transparente)
   * -------------------------------------------------------------- */
  const lineHeight = 4;
  for (let y = 0; y < canvas.height; y += lineHeight) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, y, canvas.width, 1);
  }

  /* --------------------------------------------------------------
   * 4️⃣  Effets supplémentaires (grain / old‑film)
   * -------------------------------------------------------------- */
  if (document.getElementById('noiseEffect').checked) {
    applyNoise(); // applique un grain aléatoire
  }
  if (document.getElementById('oldFilmEffect').checked) {
    // Old‑film = VHS + Noise + teinte rougeâtre
    applyOldFilm();
  }

  /* --------------------------------------------------------------
   * 5️⃣  Pas de re‑encodage JPEG en mode vidéo (le rendu est déjà fluide)
   * -------------------------------------------------------------- */
}

/**
 * Démarre la boucle d’animation à ~12 fps.
 */
function startVHSAnimation() {
  if (vhsAnimId !== null) return; // déjà lancé
  const fps = 12;
  const interval = 1000 / fps;
  let lastTime = performance.now();

  function loop(now) {
    if (now - lastTime >= interval) {
      drawVHSFrame();
      lastTime = now;
    }
    vhsAnimId = requestAnimationFrame(loop);
  }

  isVHSAnimating = true;
  vhsAnimId = requestAnimationFrame(loop);
}

/**
 * Arrête la boucle d’animation.
 */
function stopVHSAnimation() {
  if (vhsAnimId !== null) cancelAnimationFrame(vhsAnimId);
  vhsAnimId = null;
  isVHSAnimating = false;
}

/* ------------------------------------------------------------------
 * 3️⃣  Upload & affichage de l’image d’origine
 * ------------------------------------------------------------------ */
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      originalImg   = img;
      canvas.width  = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      enableControls();          // rend visibles les sliders
      downloadBtn.disabled = false; // bouton de téléchargement prêt
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

/* ------------------------------------------------------------------
 * 4️⃣  Initialisation des sliders (noUiSlider)
 * ------------------------------------------------------------------ */
function initSliders() {
  /* Blur slider */
  noUiSlider.create(document.getElementById('blurSlider'), {
    start: 0,
    range: { min: 0, max: 20 },
    step: 1,
    tooltips: true
  });

  /* Brightness slider (0‑2) */
  noUiSlider.create(document.getElementById('brightnessSlider'), {
    start: 1,
    range: { min: 0, max: 2 },
    step: 0.01,
    tooltips: true
  });

  /* Quality slider (0‑1) */
  noUiSlider.create(document.getElementById('qualitySlider'), {
    start: currentQuality,
    range: { min: 0, max: 1 },
    step: 0.01,
    tooltips: true
  });

  /* Lien chaque changement de slider à applyEffects */
  document.querySelectorAll('.noUi-target').forEach(slider =>
    slider.noUiSlider.on('update', applyEffects)
  );

  /* Checkboxes « effets supplémentaires » (VHS, grain, old‑film, VHS‑video) */
  document.querySelectorAll('.effect-checkbox')
    .forEach(cb => cb.addEventListener('change', handleEffectToggle));
}

/* ------------------------------------------------------------------
 * 5️⃣  Gestion de l’affichage des sliders
 * ------------------------------------------------------------------ */
function enableControls() {
  document.getElementById('controls-section').style.display = 'block';
}
document.getElementById('controls-section').style.display = 'none';

/* ------------------------------------------------------------------
 * 6️⃣  Gestion des check‑boxes (VHS, grain, old‑film, VHS‑video)
 * ------------------------------------------------------------------ */
function handleEffectToggle() {
  const vhsCheckbox = document.getElementById('vhsVideoEffect');
  const isVHS = vhsCheckbox && vhsCheckbox.checked;

  if (isVHS) {
    // Mode VHS : on démarre l’animation
    startVHSAnimation();
  } else {
    // Mode statique : arrêter la vidéo et appliquer les effets courants
    stopVHSAnimation();
    applyEffects();   // applique low‑light, vintage, glitch … selon les check‑boxes actifs
  }
}


/* ------------------------------------------------------------------
 * 7️⃣  Effets en temps réel (mode « statique »)
 * ------------------------------------------------------------------ */

/**
 * Fonction appelée à chaque mise à jour de slider ou de checkbox.
 * Elle applique blur/brightness, puis les effets supplémentaires,
 * et déclenche le re‑encodage JPEG (artefacts) dans le mode statique.
 */
function applyEffects() {
  if (!originalImg) return;

  /* Si on est en mode vidéo VHS, on ne fait rien ici
   * – l’animation gère la mise à jour. */
  if (document.getElementById('vhsVideoEffect').checked) {
    return;
  }

  /* Arrêter une éventuelle animation précédente */
  stopVHSAnimation();

  /* Reset du canvas principal et dessin de l’image originale */
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(originalImg, 0, 0);

  /* Valeurs actuelles des sliders */
  const blurVal        = parseFloat(document.getElementById('blurSlider').noUiSlider.get());
  const brightnessVal  = parseFloat(document.getElementById('brightnessSlider').noUiSlider.get());
  const qualityVal     = parseFloat(document.getElementById('qualitySlider').noUiSlider.get());

  /* Stockage de la qualité pour le téléchargement */
  currentQuality = qualityVal;

  /* Application des filtres via ctx.filter (support moderne) */
  if ('filter' in ctx) {
    let filterStr = `blur(${blurVal}px) brightness(${brightnessVal})`;
    ctx.filter = filterStr;
    ctx.drawImage(originalImg, 0, 0);
    ctx.filter = 'none';
  }

  /* Effets supplémentaires (checkboxes) */
  if (document.getElementById('vhsEffect').checked) {
    applyVHS();
  }
  if (document.getElementById('noiseEffect').checked) {
    applyNoise();
  }
  if (document.getElementById('oldFilmEffect').checked) {
    applyOldFilm(); // VHS + Noise + tint
  }

  /* Re‑encodage JPEG pour les artefacts */
  scheduleJPEG(qualityVal);
}

/* ------------------------------------------------------------------
 * 8️⃣  Distorsion JPEG « live »
 * ------------------------------------------------------------------ */
let jpegPendingQuality = null;   // dernière valeur demandée
let isJpegProcessing    = false; // est‑on déjà en train de traiter ?

/**
 * Lance (ou programme) le re‑encodage JPEG.
 * Le délai de 100 ms évite un spam d’appels lorsqu’on fait glisser rapidement les sliders.
 */
function scheduleJPEG(q) {
  jpegPendingQuality = q;
  if (!isJpegProcessing) setTimeout(processJPEG, 100);
}

/**
 * Fonction qui exécute réellement le re‑encodage JPEG.
 * Elle est appelée par `scheduleJPEG` après un court délai.
 */
function processJPEG() {
  if (jpegPendingQuality === null) { isJpegProcessing = false; return; }

  const q = jpegPendingQuality;
  jpegPendingQuality = null;
  isJpegProcessing = true;

  /* On copie l’état actuel du canvas principal dans le tempCanvas */
  tempCanvas.width  = canvas.width;
  tempCanvas.height = canvas.height;
  tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.drawImage(canvas, 0, 0);

  /* Encodage JPEG → blob */
  tempCanvas.toBlob(
    async blob => {
      const bitmap = await createImageBitmap(blob); // décodage
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0);
      isJpegProcessing = false;

      /* Si une nouvelle valeur est arrivée pendant le traitement,
       * on la traite immédiatement. */
      if (jpegPendingQuality !== null) processJPEG();
    },
    'image/jpeg',
    q
  );
}

/* ------------------------------------------------------------------
 * 9️⃣  Effets supplémentaires (sans sliders)
 * ------------------------------------------------------------------ */

/**
 * Effet VHS : légère augmentation de contraste, couleur dégradée,
 * puis superposition de fines lignes noires pour les scanlines.
 */
function applyVHS() {
  /* color shift */
  ctx.filter = 'contrast(1.2) brightness(0.9) saturate(0.8)';
  ctx.drawImage(originalImg, 0, 0);
  ctx.filter = 'none';

  /* Overlay des scanlines */
  const lineHeight = 4;          // hauteur d’une ligne
  for (let y = 0; y < canvas.height; y += lineHeight) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, y, canvas.width, 1);
  }
}

function applyGlitchVHS() {
  // 1️⃣   Contraste + saturation réduits (teinte bleue)
  ctx.filter = 'contrast(0.9) saturate(0.7)';
  ctx.drawImage(originalImg, 0, 0);
  ctx.filter = 'none';

  // 2️⃣   Scanlines
  const lineHeight = 3;
  for(let y=0; y<canvas.height; y+=lineHeight){
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0,y,canvas.width,1);
  }

  // 3️⃣   Glitch aléatoire (déplacement de blocs horizontaux)
  const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const data = imgData.data;
  for(let i=0; i<Math.floor(canvas.height/10); i++){
    const yStart = Math.random()*canvas.height|0;
    const w = canvas.width|0;
    const h = (Math.random()*20+5)|0;
    const srcIdx = (yStart*h + 0)*4;
    const dstIdx = ((yStart+h)%canvas.height*canvas.width + 0)*4;
    for(let y=0; y<h && (yStart+y)<canvas.height; y++){
      const srcPos = ((yStart+y)*canvas.width+0)*4;
      const dstPos = (((yStart+y+h)%canvas.height)*canvas.width+0)*4;
      data[dstPos]   = data[srcPos];
      data[dstPos+1] = data[srcPos+1];
      data[dstPos+2] = data[srcPos+2];
    }
  }
  ctx.putImageData(imgData,0,0);
}

function applyLowLight() {
  // 1️⃣   Teinte froide + réduction de la luminosité
  ctx.filter = 'brightness(0.7) contrast(1.1)';
  ctx.drawImage(originalImg, 0, 0);
  ctx.filter = 'none';

  // 2️⃣   Bruit gaussien très prononcé
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i=0; i<data.length; i+=4) {
    const noise = Math.random()*60 - 30;   // [-30,+30]
    data[i]     += noise;   // R
    data[i+1]   += noise;   // G
    data[i+2]   += noise;   // B
  }
  ctx.putImageData(imgData,0,0);

  // 3️⃣   Overlay bleu clair (alpha 0.05)
  ctx.fillStyle = 'rgba(100,120,150,0.08)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function applyVintage() {
  // 1️⃣   Sepia + légère augmentation de contraste
  ctx.filter = 'sepia(0.4) contrast(1.15)';
  ctx.drawImage(originalImg, 0, 0);
  ctx.filter = 'none';

  // 2️⃣   Bruit doux
  const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const data = imgData.data;
  for (let i=0; i<data.length; i+=4) {
    const noise = Math.random()*20 -10; // [-10,+10]
    data[i]     += noise;
    data[i+1]   += noise;
    data[i+2]   += noise;
  }
  ctx.putImageData(imgData,0,0);

  // 3️⃣   Vignette sombre
  const vignette = document.createElement('canvas');
  vignette.width = canvas.width; vignette.height = canvas.height;
  const vgCtx = vignette.getContext('2d');
  const grd = vgCtx.createRadialGradient(
      canvas.width/2, canvas.height/2, 0,
      canvas.width/2, canvas.height/2, Math.max(canvas.width,canvas.height)/1.5);
  grd.addColorStop(0,'rgba(0,0,0,0)');
  grd.addColorStop(1,'rgba(0,0,0,0.4)');
  vgCtx.fillStyle = grd;
  vgCtx.fillRect(0,0,canvas.width,canvas.height);

  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(vignette,0,0);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Effet grain/noise : ajoute un bruit aléatoire aux pixels.
 */
function applyNoise() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.random() * 30 - 15; // plage [-15, +15]
    data[i]     += noise;   // R
    data[i + 1] += noise;   // G
    data[i + 2] += noise;   // B
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Effet “old‑film” : combinaison VHS + Noise + teinte rougeâtre.
 */
function applyOldFilm() {
  applyVHS();
  applyNoise();

  /* Teinte rougeâtre légère (globalCompositeOperation) */
  ctx.fillStyle = 'rgba(80,20,10,0.1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/* ------------------------------------------------------------------
 * 10️⃣  Téléchargement de l’image finale
 * ------------------------------------------------------------------ */
downloadBtn.addEventListener('click', () => {
  if (!originalImg) return;

  /* On force un re‑encodage JPEG à la dernière qualité sélectionnée
   * afin que le fichier téléchargé soit le plus proche possible de l’affichage. */
  scheduleJPEG(currentQuality);

  /* Une fois le blob généré, on crée le lien de téléchargement */
  tempCanvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href      = url;
    a.download  = 'image.jpg';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/jpeg', currentQuality);
});

/* ------------------------------------------------------------------
 * 11️⃣  Lancement de tout le script
 * ------------------------------------------------------------------ */
initSliders();   // initialise sliders + écouteurs
