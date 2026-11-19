<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import Phaser from 'phaser';
import { MainScene } from '../game/MainScene';

// Props que rebem des d'App.vue (Vue → Phaser)
const props = defineProps({
  // Fase 1
  nomUsuari: { type: String, default: 'Anna' },
  colorAvatar: { type: String, default: '#10b981' },
  estat: { type: String, default: 'Disponible' },
  pausat: { type: Boolean, default: false },
  // Fase 2
  capesVisibles: { type: Object, default: () => ({ Terra: true, Parets: true, Mobles: true }) },
  debugColisions: { type: Boolean, default: false },
  zoom: { type: Number, default: 1 },
  // [NOU FASE 3]
  velocitat: { type: Number, default: 160 },
  teclatActiu: { type: Boolean, default: true }
});

// Esdeveniments cap a App.vue (Phaser → Vue)
const emit = defineEmits(['carrega-progres', 'mapa-carregat', 'canvi-zona', 'canvi-casella']);

const contenidor = ref(null);
let game = null;

const obtenirEscena = () => game?.scene.getScene('MainScene');

function sincronitzarEscena() {
  const escena = obtenirEscena();
  if (!escena) return;
  escena.actualitzarNom(props.nomUsuari);
  escena.canviarColor(props.colorAvatar);
  escena.actualitzarEstat(props.estat);
  for (const [nom, visible] of Object.entries(props.capesVisibles)) escena.mostrarCapa(nom, visible);
  escena.mostrarColisions(props.debugColisions);
  escena.canviarZoom(props.zoom);
  escena.canviarVelocitat(props.velocitat);
  escena.activarTeclat(props.teclatActiu);
  if (props.pausat) escena.scene.pause();
}

onMounted(() => {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 640, height: 400,
    backgroundColor: '#1e293b',
    smoothPixelArt: true,
    // [NOU FASE 3] Motor de físiques Arcade (sense gravetat: vista zenital)
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false }
    },
    parent: contenidor.value,
    scene: [MainScene]
  });

  game.events.on('carrega-progres', (valor) => emit('carrega-progres', valor));
  game.events.on('canvi-zona', (zona) => emit('canvi-zona', zona));
  game.events.on('canvi-casella', (casella) => emit('canvi-casella', casella));

  // Amb preload() la càrrega és asíncrona: esperem l'esdeveniment 'create' de l'escena (Fase 2)
  game.events.once('ready', () => {
    obtenirEscena()?.events.once('create', (escena) => {
      sincronitzarEscena();
      emit('mapa-carregat', escena.infoMapa());
    });
  });
});

onUnmounted(() => {
  game?.destroy(true);
  game = null;
});

// ---------- Watchers (Vue → Phaser): ESTAT que es manté ----------
watch(() => props.nomUsuari, (nouNom) => obtenirEscena()?.actualitzarNom(nouNom));
watch(() => props.colorAvatar, (nouColor) => obtenirEscena()?.canviarColor(nouColor));
watch(() => props.estat, (nouEstat) => obtenirEscena()?.actualitzarEstat(nouEstat));
watch(() => props.pausat, (pausa) => {
  const escena = obtenirEscena();
  if (!escena) return;
  if (pausa) escena.scene.pause();
  else escena.scene.resume();
});
watch(() => props.capesVisibles, (capes) => {
  const escena = obtenirEscena();
  for (const [nom, visible] of Object.entries(capes)) escena?.mostrarCapa(nom, visible);
}, { deep: true });
watch(() => props.debugColisions, (visible) => obtenirEscena()?.mostrarColisions(visible));
watch(() => props.zoom, (zoom) => obtenirEscena()?.canviarZoom(zoom));
// [NOU FASE 3]
watch(() => props.velocitat, (v) => obtenirEscena()?.canviarVelocitat(v));
watch(() => props.teclatActiu, (actiu) => obtenirEscena()?.activarTeclat(actiu));

// ---------- [REPTE 2] ACCIONS puntuals: millor un mètode exposat que una prop ----------
// App.vue el crida amb una ref al component: canvasRef.value.tornarAlSpawn()
defineExpose({
  tornarAlSpawn: () => obtenirEscena()?.tornarAlSpawn()
});
</script>

<template>
  <div ref="contenidor" class="llenc"></div>
</template>

<style scoped>
.llenc {
  line-height: 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);
}
</style>
