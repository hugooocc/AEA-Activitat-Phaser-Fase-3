import Phaser from 'phaser';

// Color del text d'estat segons l'opció triada a Vue (Fase 1)
const COLORS_ESTAT = {
  Disponible: '#34d399',
  Ocupat: '#f87171',
  Absent: '#fbbf24'
};

const ESTIL_TEXT = { fontFamily: 'sans-serif', color: '#ffffff', stroke: '#0f172a', strokeThickness: 3 };

// [NOU FASE 3] Velocitat per defecte en píxels per segon
const VELOCITAT_BASE = 160;
// Radi del cos físic: més petit que un tile (32 px) perquè l'avatar passi per les portes
const RADI_AVATAR = 12;

export class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  // 0. Carreguem el mapa i el tileset (Fase 2)
  preload() {
    this.load.on('progress', (valor) => this.game.events.emit('carrega-progres', valor));
    this.load.image('tiles-oficina', 'assets/tilesets/oficina.png');
    this.load.tilemapTiledJSON('mapa-oficina', 'assets/maps/oficina.json');
  }

  create() {
    // 1. Mapa de Tiled (Fase 2)
    this.mapa = this.make.tilemap({ key: 'mapa-oficina' });
    const tileset = this.mapa.addTilesetImage('oficina', 'tiles-oficina', 32, 32, 1, 2);
    this.capes = {
      Terra: this.mapa.createLayer('Terra', tileset, 0, 0),
      Parets: this.mapa.createLayer('Parets', tileset, 0, 0),
      Mobles: this.mapa.createLayer('Mobles', tileset, 0, 0)
    };
    Object.values(this.capes).forEach((capa) => capa.setCollisionByProperty({ collides: true }));

    const spawn = this.mapa.findObject('Objectes', (obj) => obj.name === 'Spawn');
    this.spawn = { x: spawn.x, y: spawn.y };

    this.zones = this.mapa.getObjectLayer('Objectes').objects
      .filter((obj) => obj.type === 'zona')
      .map((obj) => ({ nom: obj.name, rect: new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height) }));

    // [REPTE 3] Ressaltat de la zona actual (per sota dels rètols i de l'avatar)
    this.graficsZona = this.add.graphics().setDepth(4);

    for (const zona of this.zones) {
      this.add.text(zona.rect.centerX, zona.rect.y + 4, zona.nom.toUpperCase(), {
        ...ESTIL_TEXT, fontSize: '11px', strokeThickness: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)', padding: { x: 6, y: 2 }
      }).setOrigin(0.5, 0).setDepth(5);
    }

    // 2. [NOU FASE 3] El jugador és un Container: cercle + nom + estat es mouen JUNTS.
    //    Les posicions dels fills són RELATIVES al container (0, 0 = centre de l'avatar).
    this.avatar = this.add.circle(0, 0, RADI_AVATAR, 0x10b981).setStrokeStyle(2, 0x0f172a);
    this.etiqueta = this.add.text(0, -26, 'Anna', { ...ESTIL_TEXT, fontSize: '14px' }).setOrigin(0.5);
    this.textEstat = this.add.text(0, 26, 'Disponible', {
      ...ESTIL_TEXT, fontSize: '12px', color: COLORS_ESTAT.Disponible
    }).setOrigin(0.5);

    this.jugador = this.add.container(spawn.x, spawn.y, [this.avatar, this.etiqueta, this.textEstat])
      .setDepth(10)
      .setSize(RADI_AVATAR * 2, RADI_AVATAR * 2); // un Container necessita mida per tenir cos físic

    // 3. [NOU FASE 3] Físiques Arcade: cos circular, límits del món = mida del mapa
    this.physics.world.setBounds(0, 0, this.mapa.widthInPixels, this.mapa.heightInPixels);
    this.physics.add.existing(this.jugador);
    this.jugador.body.setCircle(RADI_AVATAR).setCollideWorldBounds(true);

    // 4. [NOU FASE 3] Col·lisions amb els tiles marcats amb collides = true (de totes les capes)
    this.physics.add.collider(this.jugador, Object.values(this.capes));

    // 5. [NOU FASE 3] La càmera segueix el jugador (lerp 0.15 = moviment suau)
    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.mapa.widthInPixels, this.mapa.heightInPixels);
    camera.startFollow(this.jugador, true, 0.15, 0.15);

    // 6. [NOU FASE 3] Teclat: WASD + fletxes
    this.tecles = this.input.keyboard.addKeys({ amunt: 'W', avall: 'S', esquerra: 'A', dreta: 'D' });
    this.fletxes = this.input.keyboard.createCursorKeys();
    this.velocitat = VELOCITAT_BASE;

    this.graficsDebug = this.add.graphics().setDepth(20).setVisible(false);
  }

  // 7. Bucle continu a 60 FPS: llegim el teclat i fixem la velocitat del cos físic
  update() {
    const { amunt, avall, esquerra, dreta } = this.tecles;
    const f = this.fletxes;

    // -1, 0 o 1 a cada eix
    const dx = Number(dreta.isDown || f.right.isDown) - Number(esquerra.isDown || f.left.isDown);
    const dy = Number(avall.isDown || f.down.isDown) - Number(amunt.isDown || f.up.isDown);

    // Normalitzem perquè en diagonal no anem √2 vegades més ràpid
    const direccio = new Phaser.Math.Vector2(dx, dy).normalize().scale(this.velocitat);
    this.jugador.body.setVelocity(direccio.x, direccio.y);

    this.detectarZona();
    this.detectarCasella();
  }

  // Avisem Vue NOMÉS quan canvia la zona (no 60 cops per segon)
  detectarZona() {
    const zona = this.zones.find((z) => z.rect.contains(this.jugador.x, this.jugador.y));
    const nom = zona?.nom ?? 'Fora de zona';
    if (nom === this.zonaActual) return;

    this.zonaActual = nom;
    this.ressaltarZona(zona);
    this.game.events.emit('canvi-zona', nom);
  }

  // Coordenades de tile (columna, fila) de l'avatar; també només quan canvien
  detectarCasella() {
    const x = this.mapa.worldToTileX(this.jugador.x);
    const y = this.mapa.worldToTileY(this.jugador.y);
    if (x === this.casella?.x && y === this.casella?.y) return;

    this.casella = { x, y };
    this.game.events.emit('canvi-casella', this.casella);
  }

  // [REPTE 3] Rectangle translúcid sobre la zona on és l'avatar
  ressaltarZona(zona) {
    this.graficsZona.clear();
    if (!zona) return;
    this.graficsZona
      .fillStyle(0x10b981, 0.12).fillRectShape(zona.rect)
      .lineStyle(2, 0x10b981, 0.7).strokeRectShape(zona.rect);
  }

  // ---------- Mètodes públics (Vue → Phaser) ----------

  infoMapa() {
    const propietat = (nom) => this.mapa.properties?.find?.((p) => p.name === nom)?.value;
    const tilesSolids = Object.values(this.capes)
      .reduce((total, capa) => total + capa.filterTiles((tile) => tile.collides).length, 0);
    return {
      nom: propietat('nom') ?? 'Mapa sense nom',
      amplada: this.mapa.width,
      alcada: this.mapa.height,
      midaTile: this.mapa.tileWidth,
      capes: Object.keys(this.capes),
      zones: this.zones.map((z) => z.nom),
      tilesSolids
    };
  }

  actualitzarNom(nouNom) {
    this.etiqueta?.setText(nouNom || 'Anònim');
  }

  canviarColor(hexColor) {
    const color = typeof hexColor === 'string' ? parseInt(hexColor.replace('#', ''), 16) : hexColor;
    if (Number.isNaN(color)) return;
    this.avatar?.setFillStyle(color);
  }

  actualitzarEstat(nouEstat) {
    this.textEstat?.setText(nouEstat).setColor(COLORS_ESTAT[nouEstat] ?? '#ffffff');
  }

  mostrarCapa(nom, visible) {
    this.capes?.[nom]?.setVisible(visible);
  }

  // Tiles sòlids (Fase 2) + [NOU FASE 3] cos físic de l'avatar (debug d'Arcade)
  mostrarColisions(visible) {
    if (!this.graficsDebug) return;
    this.graficsDebug.clear().setVisible(visible);
    if (visible) {
      for (const capa of Object.values(this.capes)) {
        capa.renderDebug(this.graficsDebug, {
          tileColor: null,
          collidingTileColor: new Phaser.Display.Color(239, 68, 68, 130),
          faceColor: new Phaser.Display.Color(255, 255, 255, 220)
        });
      }
    }

    const mon = this.physics.world;
    if (visible && !mon.debugGraphic) mon.createDebugGraphic();
    mon.drawDebug = visible;
    mon.debugGraphic?.clear(); // en desactivar-lo, Phaser ja no l'esborra sol
  }

  // Amb startFollow() la càmera ja manté l'avatar al centre: només cal canviar el zoom
  canviarZoom(zoom) {
    this.cameras.main.setZoom(zoom);
  }

  // [REPTE 1] Velocitat en píxels per segon
  canviarVelocitat(velocitat) {
    this.velocitat = velocitat;
  }

  // [REPTE 2] Teletransport al punt d'aparició (reset() també posa la velocitat a 0)
  tornarAlSpawn() {
    this.jugador?.body.reset(this.spawn.x, this.spawn.y);
  }

  // [NOU FASE 3] Desactiva el teclat de Phaser mentre l'usuari escriu en un camp de Vue.
  // Phaser fa preventDefault() de les tecles capturades (W, A, S, D, fletxes):
  // sense això NO es podrien escriure aquestes lletres a l'<input> del nom.
  activarTeclat(actiu) {
    const teclat = this.input.keyboard;
    if (!teclat) return;
    teclat.enabled = actiu;
    if (actiu) {
      teclat.enableGlobalCapture();
    } else {
      teclat.disableGlobalCapture();
      teclat.resetKeys(); // evita que una tecla quedi "enganxada" si estava premuda
    }
  }
} // <-- Clau de tancament de class MainScene
