# poc-fase3-vue-phaser

Prova de Concepte de la **Fase 3**: moure l'avatar amb **WASD / fletxes** pel mapa de Tiled de la Fase 2, amb **físiques Arcade**, **col·lisions** contra parets i mobles i una **càmera que segueix** el jugador.

Parteix del codi de la Fase 2. L'oscil·lació automàtica de les fases anteriors desapareix: ara l'avatar es mou amb el teclat.

## Execució

```bash
npm install      # instal·la les dependències
npm run dev      # servidor de desenvolupament → http://localhost:5173
npm run build    # versió de producció a dist/
npm run preview  # serveix dist/ en local
```

## Abast

**Dins de l'scope**

- Activar el motor de físiques **Arcade** a la configuració del joc.
- Convertir l'avatar en un **Container** (cercle + nom + estat) amb cos físic circular.
- Llegir el teclat (WASD + fletxes) i normalitzar el moviment en diagonal.
- Col·lisions amb els tiles marcats `collides = true` i amb els límits del mapa.
- Càmera que segueix el jugador (`startFollow`).
- Evitar el conflicte entre el teclat de Phaser i els `<input>` de Vue.
- **Phaser → Vue**: casella (columna, fila) i zona actual, emeses només quan canvien.

**Fora de l'scope (fases següents)**

- Vídeo i WebRTC entre usuaris (Fases 4 i 5).
- Backend Node.js i altres jugadors en temps real.

## Estructura

| Fitxer | Responsabilitat |
| --- | --- |
| `public/assets/` | Mapa i tileset de la Fase 2 (sense canvis). |
| `src/App.vue` | Controls (avatar, mapa, moviment), detecció de focus als camps de text i panell d'informació. |
| `src/components/PhaserCanvas.vue` | Configuració amb `physics`, props → `watch()`, esdeveniments → `emit()` i `defineExpose()`. |
| `src/game/MainScene.js` | Jugador amb cos físic, col·lisions, càmera, teclat i mètodes públics. |

## Passos clau

### 1. Activar les físiques (`PhaserCanvas.vue`)

```js
physics: {
  default: 'arcade',
  arcade: { gravity: { x: 0, y: 0 }, debug: false } // vista zenital: sense gravetat
}
```

### 2. El jugador és un Container amb cos físic

```js
this.jugador = this.add.container(spawn.x, spawn.y, [this.avatar, this.etiqueta, this.textEstat])
  .setSize(24, 24);                          // un Container necessita mida per tenir cos
this.physics.add.existing(this.jugador);
this.jugador.body.setCircle(12).setCollideWorldBounds(true);
```

Els fills tenen posicions **relatives** al container: el nom és a `(0, -26)` i l'estat a `(0, 26)`. Es mouen junts amb el cos físic, i ja no cal recol·locar-los a `update()` com a les fases 1 i 2. El radi (12 px) és més petit que un tile (32 px) perquè l'avatar passi per les portes.

### 3. Col·lisions, límits i càmera

```js
this.physics.world.setBounds(0, 0, this.mapa.widthInPixels, this.mapa.heightInPixels);
this.physics.add.collider(this.jugador, Object.values(this.capes));
this.cameras.main.startFollow(this.jugador, true, 0.15, 0.15);
```

El `collider` fa servir els tiles marcats a la Fase 2 amb `setCollisionByProperty({ collides: true })`.

### 4. Teclat i moviment a `update()`

```js
this.tecles = this.input.keyboard.addKeys({ amunt: 'W', avall: 'S', esquerra: 'A', dreta: 'D' });
this.fletxes = this.input.keyboard.createCursorKeys();

// a update():
const dx = Number(dreta.isDown || f.right.isDown) - Number(esquerra.isDown || f.left.isDown);
const dy = Number(avall.isDown || f.down.isDown) - Number(amunt.isDown || f.up.isDown);
const direccio = new Phaser.Math.Vector2(dx, dy).normalize().scale(this.velocitat);
this.jugador.body.setVelocity(direccio.x, direccio.y);
```

`normalize()` evita que en diagonal l'avatar vagi √2 vegades (un 41 %) més ràpid.

### 5. ⚠️ Conflicte entre el teclat de Phaser i els `<input>` de Vue

Phaser **captura** les tecles registrades (W, A, S, D, fletxes, espai i Shift) i en crida `preventDefault()` a tota la pàgina. Sense cap mesura, en escriure «wasd hola» a la caixa del nom només hi apareix **«hol»**, i a sobre l'avatar es mou mentre escrius.

La solució respecta la separació Vue / Phaser:

1. `App.vue` detecta amb `@focusin` / `@focusout` si el focus és en un camp de text o un desplegable.
2. Ho passa com a prop: `:teclatActiu="!escrivint"`.
3. `PhaserCanvas.vue` ho observa amb `watch()` i crida `escena.activarTeclat(actiu)`.
4. L'escena desactiva el teclat i la captura global:

```js
activarTeclat(actiu) {
  const teclat = this.input.keyboard;
  teclat.enabled = actiu;
  if (actiu) teclat.enableGlobalCapture();
  else { teclat.disableGlobalCapture(); teclat.resetKeys(); }
}
```

En prémer **Enter** el camp perd el focus i el control torna al joc. Fer clic al mapa també fa perdre el focus al camp.

### 6. Phaser → Vue només quan hi ha canvis

`update()` s'executa 60 cops per segon. La casella i la zona es calculen cada fotograma, però només s'emeten (`canvi-casella`, `canvi-zona`) quan **canvien**.

## Repte d'autonomia

1. **Velocitat configurable**: slider de 80 a 320 px/s → prop `velocitat` → `canviarVelocitat()`.
2. **Torna a l'Spawn**: és una **acció puntual**, no un estat, així que no la passem com a prop. `PhaserCanvas.vue` exposa un mètode amb `defineExpose({ tornarAlSpawn })`, i `App.vue` el crida amb una `ref` al component: `canvasRef.value.tornarAlSpawn()`. A l'escena, `body.reset(x, y)` mou el cos i en posa la velocitat a 0.
3. **Zona ressaltada + avís**: en canviar de zona, Phaser pinta un rectangle translúcid a sobre (`Graphics`) i Vue mostra durant 2,5 s l'avís «Has entrat a: …» damunt del llenç.

A més, «Mostra col·lisions» (Fase 2) ara també dibuixa el **cos físic** de l'avatar (debug d'Arcade, en magenta).

## Proves al navegador

- [ ] En carregar, l'avatar és al Passadís, a la casella (15, 10).
- [ ] WASD i les fletxes el mouen, i en diagonal no va més ràpid.
- [ ] Les parets, els mobles, els arbres i l'aigua l'aturen. Les cadires i les portes es poden travessar.
- [ ] La càmera el segueix i no surt dels límits del mapa.
- [ ] El panell mostra la casella i la zona, i en entrar a una zona nova apareix l'avís.
- [ ] Es pot escriure qualsevol nom (amb W, A, S, D i espais) sense que l'avatar es mogui.
- [ ] Velocitat, «Torna a l'Spawn», Pausa, zoom, capes i col·lisions funcionen.
- [ ] Amaga/Mostra repetidament: un sol `<canvas>` i cap error a la consola (F12).

## Lliurament

Comprimir la carpeta en un `.zip` **sense `node_modules`** (ni `dist`), o lliurar l'enllaç al repositori Git.
