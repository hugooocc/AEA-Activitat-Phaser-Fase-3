<script setup>
import { ref, reactive, watch } from 'vue';
import PhaserCanvas from './components/PhaserCanvas.vue';

// ---------- Fase 1 · Avatar ----------
const nom = ref('Anna');
const mostrarJoc = ref(true);
const color = ref('#10b981');
const estats = ['Disponible', 'Ocupat', 'Absent'];
const estat = ref('Disponible');
const pausat = ref(false);

// ---------- Fase 2 · Mapa ----------
const capesVisibles = reactive({ Terra: true, Parets: true, Mobles: true });
const debugColisions = ref(false);
const zoom = ref(1);

// ---------- [NOU FASE 3] Moviment ----------
const velocitat = ref(160);          // [REPTE 1]
const canvasRef = ref(null);         // [REPTE 2] ref al component per cridar tornarAlSpawn()

// Mentre s'escriu en un camp de text o desplegable, el teclat de Phaser s'ha d'aturar
const escrivint = ref(false);
const esCampDeText = (el) => el?.matches?.('input:not([type]), input[type="text"], select, textarea') ?? false;
const onFocusIn = (event) => { escrivint.value = esCampDeText(event.target); };
const onFocusOut = () => { escrivint.value = false; };

// Dades que arriben DES de Phaser (Phaser → Vue)
const progres = ref(0);
const infoMapa = ref(null);
const zonaActual = ref(null);
const casella = ref(null);

// [REPTE 3] Avís temporal en entrar a una zona nova
const avis = ref(null);
let temporitzadorAvis = null;
function onCanviZona(zona) {
  const anterior = zonaActual.value;
  zonaActual.value = zona;
  if (anterior === null) return; // la primera zona (en carregar) no mostra avís
  avis.value = zona === 'Fora de zona' ? 'Has sortit de les zones' : `Has entrat a: ${zona}`;
  clearTimeout(temporitzadorAvis);
  temporitzadorAvis = setTimeout(() => { avis.value = null; }, 2500);
}

watch(mostrarJoc, (visible) => {
  if (!visible) {
    progres.value = 0;
    infoMapa.value = null;
    zonaActual.value = null;
    casella.value = null;
    avis.value = null;
  }
});
</script>

<template>
  <main class="contenidor-app" @focusin="onFocusIn" @focusout="onFocusOut">
    <h1>PoC Fase 3 · Moviment WASD</h1>

    <fieldset class="controls">
      <legend>Avatar</legend>
      <label>
        Nom
        <!-- Enter treu el focus del camp i torna el control al teclat del joc -->
        <input v-model="nom" placeholder="Escriu el teu nom d'usuari..." @keyup.enter="$event.target.blur()" />
      </label>
      <label>
        Color
        <input v-model="color" type="color" />
      </label>
      <label>
        Estat
        <select v-model="estat" @change="$event.target.blur()">
          <option v-for="e in estats" :key="e" :value="e">{{ e }}</option>
        </select>
      </label>
      <button :disabled="!mostrarJoc" @click="pausat = !pausat">
        {{ pausat ? 'Reprèn' : 'Pausa' }}
      </button>
      <button @click="mostrarJoc = !mostrarJoc">
        {{ mostrarJoc ? 'Amaga el llenç' : 'Mostra el llenç' }}
      </button>
    </fieldset>

    <fieldset class="controls">
      <legend>Mapa</legend>
      <div class="grup">
        <span class="titol">Capes</span>
        <label v-for="(visible, capa) in capesVisibles" :key="capa" class="check">
          <input v-model="capesVisibles[capa]" type="checkbox" />
          {{ capa }}
        </label>
      </div>
      <label class="check">
        <input v-model="debugColisions" type="checkbox" />
        Mostra col·lisions
      </label>
      <label>
        Zoom · {{ zoom.toFixed(1) }}×
        <input v-model.number="zoom" type="range" min="0.7" max="2" step="0.1" />
      </label>
    </fieldset>

    <!-- [NOU FASE 3] Controls de moviment -->
    <fieldset class="controls">
      <legend>Moviment</legend>
      <label>
        Velocitat · {{ velocitat }} px/s
        <input v-model.number="velocitat" type="range" min="80" max="320" step="20" />
      </label>
      <button :disabled="!mostrarJoc" @click="canvasRef?.tornarAlSpawn()">
        Torna a l'Spawn
      </button>
      <p class="ajuda">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o fletxes per moure't
        <span v-if="escrivint" class="pausa-teclat">· teclat del joc aturat mentre escrius (Enter per tornar)</span>
      </p>
    </fieldset>

    <div v-if="mostrarJoc" class="escenari">
      <PhaserCanvas
        ref="canvasRef"
        :nomUsuari="nom"
        :colorAvatar="color"
        :estat="estat"
        :pausat="pausat"
        :capesVisibles="capesVisibles"
        :debugColisions="debugColisions"
        :zoom="zoom"
        :velocitat="velocitat"
        :teclatActiu="!escrivint"
        @carrega-progres="progres = $event"
        @mapa-carregat="infoMapa = $event"
        @canvi-zona="onCanviZona"
        @canvi-casella="casella = $event"
      />
      <!-- [REPTE 3] Avís sobreposat al llenç -->
      <Transition name="avis">
        <div v-if="avis" class="avis">{{ avis }}</div>
      </Transition>
    </div>

    <section v-if="mostrarJoc" class="info">
      <p v-if="!infoMapa">Carregant mapa… {{ Math.round(progres * 100) }}%</p>
      <dl v-else>
        <dt>Mapa</dt>
        <dd>{{ infoMapa.nom }} · {{ infoMapa.amplada }} × {{ infoMapa.alcada }} tiles de {{ infoMapa.midaTile }} px</dd>
        <dt>Tiles sòlids</dt>
        <dd>{{ infoMapa.tilesSolids }}</dd>
        <dt>Casella</dt>
        <dd class="casella">{{ casella ? `(${casella.x}, ${casella.y})` : '—' }}</dd>
        <dt>Zona actual</dt>
        <dd class="zona">{{ zonaActual ?? '—' }}</dd>
      </dl>
    </section>
  </main>
</template>

<style scoped>
.contenidor-app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 1rem;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-end;
  gap: 0.75rem;
  width: 100%;
  max-width: 640px;
  margin: 0;
  padding: 0.6rem 0.9rem 0.8rem;
  border: 1px solid #334155;
  border-radius: 8px;
}

legend {
  padding: 0 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #10b981;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

.grup {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.titol {
  font-size: 0.8rem;
  color: #94a3b8;
}

label.check {
  flex-direction: row;
  align-items: center;
  gap: 0.35rem;
  color: #f1f5f9;
  font-size: 0.9rem;
}

input,
select,
button {
  font: inherit;
  font-size: 0.95rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid #334155;
  border-radius: 6px;
  background: #1e293b;
  color: #f1f5f9;
}

input[type='color'] {
  width: 3rem;
  height: 2.3rem;
  padding: 0.15rem;
  cursor: pointer;
}

input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
  padding: 0;
  accent-color: #10b981;
}

input[type='range'] {
  padding: 0;
  accent-color: #10b981;
}

button {
  cursor: pointer;
  background: #10b981;
  border-color: #10b981;
  color: #0f172a;
  font-weight: 600;
}

button:hover:not(:disabled) {
  filter: brightness(1.1);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ajuda {
  flex-basis: 100%;
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  color: #94a3b8;
}

kbd {
  display: inline-block;
  min-width: 1.4em;
  margin: 0 1px;
  padding: 0 0.3em;
  border: 1px solid #475569;
  border-bottom-width: 2px;
  border-radius: 4px;
  background: #1e293b;
  color: #f1f5f9;
  font-family: inherit;
  font-size: 0.75rem;
  text-align: center;
}

.pausa-teclat {
  color: #fbbf24;
}

.escenari {
  position: relative;
}

.avis {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  background: rgb(15 23 42 / 0.85);
  border: 1px solid #10b981;
  color: #f1f5f9;
  font-size: 0.85rem;
  white-space: nowrap;
  pointer-events: none;
}

.avis-enter-active,
.avis-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.avis-enter-from,
.avis-leave-to {
  opacity: 0;
  transform: translate(-50%, -6px);
}

.info {
  width: 100%;
  max-width: 640px;
  font-size: 0.85rem;
  color: #cbd5e1;
}

.info p {
  margin: 0;
  text-align: center;
}

dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.3rem 1rem;
  margin: 0;
}

dt {
  color: #94a3b8;
}

dd {
  margin: 0;
}

.casella {
  font-variant-numeric: tabular-nums;
}

.zona {
  color: #10b981;
  font-weight: 600;
}
</style>
