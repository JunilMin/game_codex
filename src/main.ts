import Phaser from 'phaser'
import './style.css'

type Melee = 'sword' | 'spear' | 'dagger'
type Gun = 'pistol' | 'shotgun'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="shell">
    <header><span class="kicker">PROTOTYPE 01</span><h1>POSSESSION</h1><p>지옥문이 열렸다. 빼앗기기 전에 공포를 심어라.</p></header>
    <section id="game-wrap"><div id="game"></div><div id="vignette"></div></section>
    <footer>WASD 이동 · 좌클릭 공격 · 우클릭 패링 · SPACE 회피 · Q 신성한 약 · 1/2 무기 전환</footer>
  </main>`

const W = 1280
const H = 720

class PossessionScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite
  boss!: Phaser.Physics.Arcade.Sprite
  enemies!: Phaser.Physics.Arcade.Group
  bullets!: Phaser.Physics.Arcade.Group
  enemyShots!: Phaser.Physics.Arcade.Group
  walls!: Phaser.Physics.Arcade.StaticGroup
  keys!: Record<string, Phaser.Input.Keyboard.Key>
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  possession = 12
  fear = 0
  bossHp = 100
  medicine = 3
  points = 5
  melee: Melee = 'sword'
  gun: Gun = 'pistol'
  weaponSlot = 1
  meleeLevel = 1
  gunLevel = 1
  wave = 0
  gameStarted = false
  bossActive = false
  executable = false
  parryUntil = 0
  dodgeUntil = 0
  lastAttack = 0
  lastSpawn = 0
  waveStarted = 0
  playerActionUntil = 0
  lastDodgeAfterimage = 0
  bossActionUntil = 0
  statusText!: Phaser.GameObjects.Text
  possessionBar!: Phaser.GameObjects.Graphics
  bossBar!: Phaser.GameObjects.Graphics
  instruction!: Phaser.GameObjects.Text
  preparePanel!: Phaser.GameObjects.Container
  playerShadow!: Phaser.GameObjects.Ellipse
  bossShadow!: Phaser.GameObjects.Ellipse

  constructor() { super('possession') }

  preload() {
    this.load.image('arena', '/assets/hellgate-arena.png')
    this.load.spritesheet('guardianMotion', '/assets/guardian-motion-v3.png', { frameWidth: 313, frameHeight: 313 })
    this.load.spritesheet('demonMotion', '/assets/demon-motion-v2.png', { frameWidth: 313, frameHeight: 313 })
    this.load.spritesheet('bossMotion', '/assets/gatekeeper-motion-v2.png', { frameWidth: 313, frameHeight: 313 })
  }

  create() {
    this.resetRunState()
    this.physics.resume()
    this.makeTextures()
    this.createAnimations()
    this.drawArena()
    this.walls = this.physics.add.staticGroup()
    this.makeObstacle(155, 270, 150, 210)
    this.makeObstacle(1125, 270, 150, 210)
    this.makeObstacle(185, 560, 200, 100)
    this.makeObstacle(1095, 560, 200, 100)

    this.enemies = this.physics.add.group()
    this.bullets = this.physics.add.group()
    this.enemyShots = this.physics.add.group()
    this.player = this.physics.add.sprite(640, 570, 'guardianMotion', 0).setDisplaySize(118, 118).setDepth(20).setCollideWorldBounds(true)
    this.player.body!.setSize(95, 62).setOffset(109, 228)
    this.player.play('guardian-idle')
    this.playerShadow = this.add.ellipse(640, 600, 64, 22, 0x000000, .58).setDepth(18)
    this.boss = this.physics.add.sprite(640, 145, 'bossMotion', 0).setDisplaySize(174, 174).setDepth(20).setImmovable(true).setVisible(false).setActive(false)
    this.boss.body!.setSize(380, 300).setOffset(180, 400)
    this.bossShadow = this.add.ellipse(640, 195, 108, 34, 0x000000, .62).setDepth(18).setVisible(false)

    this.physics.add.collider(this.player, this.walls)
    this.physics.add.collider(this.enemies, this.walls)
    this.physics.add.collider(this.boss, this.walls)
    this.physics.add.overlap(this.player, this.enemies, (_, e) => this.playerHit(e as Phaser.Physics.Arcade.Sprite, 9))
    this.physics.add.overlap(this.player, this.enemyShots, (_, s) => { (s as Phaser.Physics.Arcade.Sprite).destroy(); this.playerHit(undefined, 12) })
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => { (b as Phaser.Physics.Arcade.Sprite).destroy(); this.damageEnemy(e as Phaser.Physics.Arcade.Sprite, 22 * this.powerMultiplier()) })
    this.physics.add.overlap(this.bullets, this.boss, (b) => { (b as Phaser.Physics.Arcade.Sprite).destroy(); this.damageBoss(7 * this.powerMultiplier()) })

    const kb = this.input.keyboard!
    this.cursors = kb.createCursorKeys()
    this.keys = kb.addKeys('W,A,S,D,Q,ONE,TWO,SPACE') as Record<string, Phaser.Input.Keyboard.Key>
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.gameStarted) return
      if (p.rightButtonDown()) this.parry()
      else this.attack(p.worldX, p.worldY)
    })
    this.input.mouse?.disableContextMenu()

    this.createHud()
    this.createPreparation()
  }

  resetRunState() {
    this.possession = 12
    this.fear = 0
    this.bossHp = 100
    this.medicine = 3
    this.points = 5
    this.melee = 'sword'
    this.gun = 'pistol'
    this.weaponSlot = 1
    this.meleeLevel = 1
    this.gunLevel = 1
    this.wave = 0
    this.gameStarted = false
    this.bossActive = false
    this.executable = false
    this.parryUntil = 0
    this.dodgeUntil = 0
    this.lastAttack = 0
    this.lastSpawn = 0
    this.waveStarted = 0
    this.playerActionUntil = 0
    this.lastDodgeAfterimage = 0
    this.bossActionUntil = 0
    const vignette = document.querySelector<HTMLDivElement>('#vignette')
    if (vignette) vignette.style.opacity = '0'
  }

  makeTextures() {
    if (this.textures.exists('bullet')) return
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xf6d477).fillCircle(5, 5, 5).generateTexture('bullet', 10, 10).clear()
    g.fillStyle(0xb63e45).fillCircle(6, 6, 6).generateTexture('enemyShot', 12, 12).destroy()
  }

  drawArena() {
    this.cameras.main.setBackgroundColor('#090a0d')
    this.add.image(640, 360, 'arena').setDisplaySize(W, H).setDepth(0)
    const g = this.add.graphics().setDepth(2)
    g.fillStyle(0x08090c, .2).fillRect(0, 0, W, H)
    for (const [x, y, r] of [[510,360,56],[770,390,44],[720,260,34]]) {
      g.fillStyle(0x7d1e2b, .12).fillCircle(x, y, r)
      g.lineStyle(2, 0xe3434c, .3).strokeCircle(x, y, r)
    }
  }

  createAnimations() {
    if (this.anims.exists('guardian-idle')) return
    this.anims.create({ key: 'guardian-idle', frames: this.anims.generateFrameNumbers('guardianMotion', { start: 0, end: 3 }), frameRate: 4, repeat: -1 })
    this.anims.create({ key: 'guardian-run', frames: this.anims.generateFrameNumbers('guardianMotion', { start: 4, end: 7 }), frameRate: 11, repeat: -1 })
    this.anims.create({ key: 'guardian-slash', frames: this.anims.generateFrameNumbers('guardianMotion', { start: 8, end: 11 }), frameRate: 15, repeat: 0 })
    this.anims.create({ key: 'guardian-parry', frames: this.anims.generateFrameNumbers('guardianMotion', { start: 12, end: 15 }), frameRate: 12, repeat: 0 })
    this.anims.create({ key: 'demon-idle', frames: this.anims.generateFrameNumbers('demonMotion', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
    this.anims.create({ key: 'demon-run', frames: this.anims.generateFrameNumbers('demonMotion', { start: 4, end: 7 }), frameRate: 10, repeat: -1 })
    this.anims.create({ key: 'demon-attack', frames: this.anims.generateFrameNumbers('demonMotion', { start: 8, end: 11 }), frameRate: 13, repeat: 0 })
    this.anims.create({ key: 'demon-death', frames: this.anims.generateFrameNumbers('demonMotion', { start: 12, end: 15 }), frameRate: 8, repeat: 0 })
    this.anims.create({ key: 'boss-idle', frames: this.anims.generateFrameNumbers('bossMotion', { start: 0, end: 3 }), frameRate: 4, repeat: -1 })
    this.anims.create({ key: 'boss-walk', frames: this.anims.generateFrameNumbers('bossMotion', { start: 4, end: 7 }), frameRate: 7, repeat: -1 })
    this.anims.create({ key: 'boss-attack', frames: this.anims.generateFrameNumbers('bossMotion', { start: 8, end: 11 }), frameRate: 5, repeat: 0 })
  }

  makeObstacle(x: number, y: number, w: number, h: number) {
    const body = this.walls.create(x, y, undefined).setVisible(false) as Phaser.Physics.Arcade.Sprite
    body.body!.setSize(w, h)
  }

  createHud() {
    this.possessionBar = this.add.graphics().setScrollFactor(0).setDepth(100)
    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(100)
    this.statusText = this.add.text(35, 22, '', { fontFamily: 'Arial', fontSize: '15px', color: '#dfd4c7' }).setDepth(101)
    this.instruction = this.add.text(640, 680, '', { fontFamily: 'Arial', fontSize: '15px', color: '#cabbb1', backgroundColor: '#111116cc', padding: { x: 14, y: 8 } }).setOrigin(.5).setDepth(101)
  }

  createPreparation() {
    const bg = this.add.rectangle(640, 360, 780, 520, 0x0d0e12, .96).setStrokeStyle(2, 0x7b3035)
    const title = this.add.text(640, 138, '봉인 수호자의 무기고', { fontFamily: 'Georgia', fontSize: '34px', color: '#eee1d2' }).setOrigin(.5)
    const sub = this.add.text(640, 183, '5 포인트로 무기를 선택하고 강화하십시오', { fontFamily: 'Arial', fontSize: '15px', color: '#aa9891' }).setOrigin(.5)
    const info = this.add.text(420, 240, '', { fontFamily: 'Arial', fontSize: '19px', color: '#e4d8cb', lineSpacing: 15 })
    const pointText = this.add.text(860, 240, '', { fontFamily: 'Arial', fontSize: '21px', color: '#e55a55' }).setOrigin(.5)
    const buttons: Phaser.GameObjects.Text[] = []
    const button = (x: number, y: number, label: string, fn: () => void) => {
      const t = this.add.text(x, y, label, { fontFamily: 'Arial', fontSize: '17px', color: '#e8ddd2', backgroundColor: '#34262a', padding: { x: 17, y: 11 } }).setInteractive({ useHandCursor: true }).on('pointerdown', () => { fn(); refresh() })
      buttons.push(t); return t
    }
    button(420, 380, '검 선택', () => { this.melee = 'sword' })
    button(535, 380, '창 선택', () => { if (this.spend(1)) this.melee = 'spear' })
    button(650, 380, '단검 선택', () => { if (this.spend(1)) this.melee = 'dagger' })
    button(420, 440, '권총 선택', () => { this.gun = 'pistol' })
    button(555, 440, '산탄총 선택', () => { if (this.spend(1)) this.gun = 'shotgun' })
    button(750, 380, '근접 강화 +1', () => { if (this.spend(1)) this.meleeLevel++ })
    button(750, 440, '총기 강화 +1', () => { if (this.spend(1)) this.gunLevel++ })
    const start = button(640, 545, '지옥문으로 진입', () => { this.preparePanel.setVisible(false); this.gameStarted = true; this.startWave() }).setOrigin(.5)
    const refresh = () => {
      info.setText(`근접 슬롯 [1]  ${this.melee.toUpperCase()}  Lv.${this.meleeLevel}\n원거리 슬롯 [2]  ${this.gun.toUpperCase()}  Lv.${this.gunLevel}\n신성한 약 [Q]  3개 지급`)
      pointText.setText(`잔여 포인트\n${this.points}`)
    }
    this.preparePanel = this.add.container(0, 0, [bg, title, sub, info, pointText, ...buttons]).setDepth(200)
    void start; refresh()
  }

  spend(n: number) { if (this.points < n) return false; this.points -= n; return true }

  startWave() {
    this.wave++
    this.waveStarted = this.time.now
    this.lastSpawn = 0
    this.instruction.setText(`WAVE ${this.wave} · 18초 생존 후 보스를 처형하십시오`)
    this.time.delayedCall(2200, () => this.instruction.setText(''))
  }

  update(time: number) {
    if (!this.gameStarted) return
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.weaponSlot = 1
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.weaponSlot = 2
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.useMedicine()
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.dodgeUntil = time + 280

    let dx = (this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0)
    let dy = (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0) - (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0)
    const v = new Phaser.Math.Vector2(dx, dy).normalize().scale(220 * this.speedMultiplier() * (time < this.dodgeUntil ? 2.1 : 1))
    this.player.setVelocity(v.x, v.y)
    this.player.setAlpha(time < this.dodgeUntil ? .55 : 1)
    this.updatePlayerAnimation(time, v)

    if (!this.bossActive && time - this.waveStarted < 18000 && time - this.lastSpawn > 1550) { this.spawnEnemy(); this.lastSpawn = time }
    if (!this.bossActive && time - this.waveStarted >= 18000 && this.enemies.countActive() === 0) this.spawnBoss()
    this.updateEnemies(time)
    this.updateBoss(time)
    this.updateGrounding()
    this.redrawHud()
    if (this.possession >= 100) this.endGame(false)
  }

  updatePlayerAnimation(time: number, velocity: Phaser.Math.Vector2) {
    if (time < this.dodgeUntil && time - this.lastDodgeAfterimage > 55) {
      this.lastDodgeAfterimage = time
      const ghost = this.add.image(this.player.x, this.player.y, 'guardianMotion', this.player.frame.name)
        .setDisplaySize(this.player.displayWidth, this.player.displayHeight).setAlpha(.3).setTint(0xaad8db).setDepth(this.player.depth - 1)
      this.tweens.add({ targets: ghost, alpha: 0, scaleX: ghost.scaleX * .88, scaleY: ghost.scaleY * .88, duration: 220, onComplete: () => ghost.destroy() })
    }
    if (time < this.playerActionUntil) return
    if (velocity.lengthSq() > 10) {
      this.player.play('guardian-run', true)
      this.player.setFlipX(velocity.x < 0)
    } else {
      this.player.play('guardian-idle', true)
    }
  }

  updateGrounding() {
    this.player.setDepth(20 + this.player.y / 30)
    this.playerShadow.setPosition(this.player.x, this.player.y + 31).setDepth(this.player.depth - 1).setScale(.92 + this.player.y / 5000)
    if (this.boss.visible) {
      this.boss.setDepth(20 + this.boss.y / 30)
      this.bossShadow.setVisible(true).setPosition(this.boss.x, this.boss.y + 48).setDepth(this.boss.depth - 1)
    }
    this.enemies.getChildren().forEach(o => {
      const e = o as Phaser.Physics.Arcade.Sprite
      const shadow = e.getData('shadow') as Phaser.GameObjects.Ellipse | undefined
      if (shadow) shadow.setPosition(e.x, e.y + 27).setDepth(e.depth - 1).setAlpha(e.alpha * .55)
    })
  }

  powerMultiplier() { return this.possession < 20 ? 1 : this.possession < 50 ? 1.15 : this.possession < 80 ? 1.4 : Math.max(.55, 1.25 - (this.possession - 80) * .035) }
  speedMultiplier() { return this.possession < 20 ? 1 : this.possession < 50 ? 1.05 : this.possession < 80 ? 1.2 : Math.max(.58, 1.1 - (this.possession - 80) * .027) }

  spawnEnemy() {
    const edge = Phaser.Math.Between(0, 3)
    const p = edge === 0 ? [50, Phaser.Math.Between(80, 640)] : edge === 1 ? [1230, Phaser.Math.Between(80, 640)] : edge === 2 ? [Phaser.Math.Between(80, 1200), 55] : [Phaser.Math.Between(80, 1200), 650]
    const e = this.enemies.create(p[0], p[1], 'demonMotion', 0) as Phaser.Physics.Arcade.Sprite
    e.setDisplaySize(88, 88).setData('hp', 32).setData('nextHit', 0).setDepth(18).setTint(0xe1ced0)
    e.setData('born', this.time.now)
    e.setData('shadow', this.add.ellipse(e.x, e.y + 27, 54, 18, 0x000000, .55).setDepth(17))
    e.body!.setSize(120, 72).setOffset(97, 221)
    e.play('demon-run')
  }

  updateEnemies(time: number) {
    this.enemies.getChildren().forEach(o => {
      const e = o as Phaser.Physics.Arcade.Sprite
      if (!e.active) return
      this.physics.moveToObject(e, this.player, 75 + this.wave * 8)
      e.setDepth(12 + e.y / 40)
      e.setFlipX(e.body!.velocity.x < 0)
      if (Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 54 && time > e.getData('nextHit')) {
        e.setData('nextHit', time + 1050)
        e.setVelocity(0)
        e.play('demon-attack', true)
        const tell = this.add.circle(e.x, e.y, 34, 0xd83f49, .18).setStrokeStyle(3, 0xff5963, .8).setDepth(16)
        this.tweens.add({ targets: tell, scale: .35, duration: 240, ease: 'Cubic.In', onComplete: () => tell.destroy() })
        this.tweens.add({ targets: e, scaleX: e.scaleX * .88, scaleY: e.scaleY * 1.14, y: e.y - 8, duration: 130, yoyo: true })
        this.time.delayedCall(250, () => {
          if (!e.active) return
          this.tweens.add({ targets: e, x: e.x + (this.player.x - e.x) * .42, y: e.y + (this.player.y - e.y) * .42, duration: 90, yoyo: true })
          if (Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 76) this.playerHit(e, 8)
          this.time.delayedCall(180, () => { if (e.active) e.play('demon-run', true) })
        })
      }
    })
  }

  spawnBoss() {
    this.bossActive = true
    this.boss.setPosition(640, 115).setVisible(true).setActive(true).setAlpha(0).setAngle(0)
    this.boss.play('boss-idle')
    this.bossHp = 100; this.fear = 0; this.executable = false
    this.boss.setData('nextAttack', this.time.now + 1300).setData('attackCount', 0)
    this.tweens.add({ targets: this.boss, alpha: 1, y: 165, duration: 700, ease: 'Back.Out' })
    this.cameras.main.flash(450, 90, 10, 18)
    this.instruction.setText('빙의된 문지기 · 붉은 섬광을 패링해 공포를 채우십시오')
  }

  updateBoss(time: number) {
    if (!this.bossActive || this.executable) return
    const d = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, this.player.x, this.player.y)
    if (time >= this.bossActionUntil) {
      if (d > 150) { this.physics.moveToObject(this.boss, this.player, 92); this.boss.play('boss-walk', true) }
      else { this.boss.setVelocity(0); this.boss.play('boss-idle', true) }
    }
    if (time < this.boss.getData('nextAttack') - 900) {
      this.boss.setFlipX(this.player.x < this.boss.x)
    }
    if (time > this.boss.getData('nextAttack')) {
      this.boss.setData('nextAttack', time + 2100)
      const count = this.boss.getData('attackCount') + 1; this.boss.setData('attackCount', count)
      const parryable = count % 3 !== 0
      this.showAttackTelegraph(parryable)
      this.time.delayedCall(850, () => {
        this.boss.clearTint()
        if (!this.bossActive) return
        if (parryable && Phaser.Math.Distance.Between(this.boss.x, this.boss.y, this.player.x, this.player.y) < 180) {
          if (this.time.now < this.parryUntil) this.successfulParry()
          else this.playerHit(undefined, 18)
        } else if (!parryable) {
          for (let i = 0; i < 8; i++) this.fireEnemyShot(i * Math.PI / 4)
        }
      })
    }
  }

  showAttackTelegraph(parryable: boolean) {
    this.boss.setVelocity(0)
    this.bossActionUntil = this.time.now + 920
    this.boss.play('boss-attack', true)
    const color = parryable ? 0xf0b94b : 0xa75cff
    const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y)
    const cone = this.add.arc(this.boss.x, this.boss.y, 180, Phaser.Math.RadToDeg(angle) - 28, Phaser.Math.RadToDeg(angle) + 28, false, color, .24).setDepth(16)
    const ring = this.add.circle(this.boss.x, this.boss.y, 100).setStrokeStyle(7, color, .9).setDepth(28)
    const cue = this.add.text(this.boss.x, this.boss.y - 115, parryable ? 'PARRY' : 'DODGE', {
      fontFamily: 'Georgia', fontSize: '17px', fontStyle: 'bold', color: parryable ? '#ffe19a' : '#d8a8ff',
      backgroundColor: '#09080dcc', padding: { x: 9, y: 5 }
    }).setOrigin(.5).setDepth(40)
    this.tweens.add({ targets: ring, scale: .22, alpha: 1, duration: 760, ease: 'Cubic.In' })
    this.tweens.add({ targets: this.boss, y: this.boss.y - 12, yoyo: true, duration: 420, ease: 'Sine.InOut' })
    this.time.delayedCall(760, () => {
      if (parryable) this.boss.setTint(0xffd36a)
      this.cameras.main.shake(70, .003)
    })
    this.time.delayedCall(900, () => { cone.destroy(); ring.destroy(); cue.destroy(); this.boss.clearTint(); if (this.bossActive && !this.executable) this.boss.play('boss-idle', true) })
  }

  fireEnemyShot(a: number) {
    const s = this.enemyShots.create(this.boss.x, this.boss.y, 'enemyShot') as Phaser.Physics.Arcade.Sprite
    s.setVelocity(Math.cos(a) * 210, Math.sin(a) * 210).setDepth(25)
    this.time.delayedCall(3500, () => s.destroy())
  }

  attack(x: number, y: number) {
    if (this.time.now - this.lastAttack < (this.weaponSlot === 1 ? 330 : 460)) return
    this.lastAttack = this.time.now
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, x, y)
    this.player.setFlipX(x < this.player.x)
    if (this.weaponSlot === 2) {
      this.playerActionUntil = this.time.now + 180
      this.tweens.add({ targets: this.player, x: this.player.x - Math.cos(angle) * 10, y: this.player.y - Math.sin(angle) * 10, duration: 55, yoyo: true, ease: 'Quad.Out' })
      const flash = this.add.circle(this.player.x + Math.cos(angle) * 52, this.player.y + Math.sin(angle) * 52, this.gun === 'shotgun' ? 18 : 10, 0xffd58a, .9).setDepth(45)
      this.tweens.add({ targets: flash, alpha: 0, scale: 2.3, duration: 90, onComplete: () => flash.destroy() })
      const pellets = this.gun === 'shotgun' ? 5 : 1
      for (let i = 0; i < pellets; i++) {
        const a = angle + (i - (pellets - 1) / 2) * .11
        const b = this.bullets.create(this.player.x, this.player.y, 'bullet') as Phaser.Physics.Arcade.Sprite
        b.setVelocity(Math.cos(a) * 560, Math.sin(a) * 560).setDepth(30)
        this.time.delayedCall(900, () => b.destroy())
      }
      return
    }
    this.playerActionUntil = this.time.now + 320
    this.player.play('guardian-slash', true)
    const range = this.melee === 'spear' ? 145 : this.melee === 'dagger' ? 75 : 105
    const damage = (this.melee === 'spear' ? 28 : this.melee === 'dagger' ? 18 : 24) * this.meleeLevel * this.powerMultiplier()
    const slash = this.add.arc(this.player.x, this.player.y, range, Phaser.Math.RadToDeg(angle) - 35, Phaser.Math.RadToDeg(angle) + 35, false, 0xe9d5b5, .32).setDepth(30)
    this.tweens.add({ targets: slash, alpha: 0, duration: 150, onComplete: () => slash.destroy() })
    if (this.bossActive && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y) < range + 35) {
      if (this.executable) this.executeBoss(); else this.damageBoss(damage * .32)
    }
    this.enemies.getChildren().forEach(o => { const e = o as Phaser.Physics.Arcade.Sprite; if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < range) this.damageEnemy(e, damage) })
  }

  parry() {
    this.parryUntil = this.time.now + 240
    this.playerActionUntil = this.time.now + 430
    this.player.play('guardian-parry', true)
    this.player.setTint(0xe8cf8b)
    this.time.delayedCall(250, () => this.player.clearTint())
  }

  successfulParry() {
    this.fear = Math.min(100, this.fear + 18)
    this.cameras.main.shake(100, .006)
    this.boss.setVelocity((this.boss.x - this.player.x) * 3, (this.boss.y - this.player.y) * 3)
    const burst = this.add.star((this.player.x + this.boss.x) / 2, (this.player.y + this.boss.y) / 2, 8, 8, 34, 0xffe2a1, .95).setDepth(60)
    this.tweens.add({ targets: burst, alpha: 0, scale: 2.2, angle: 45, duration: 220, onComplete: () => burst.destroy() })
    this.instruction.setText(`패링 성공 · 공포 ${Math.round(this.fear)}%`)
    this.time.delayedCall(700, () => { if (!this.executable) this.instruction.setText('') })
    if (this.fear >= 100) this.makeExecutable('공포에 굴복했습니다')
  }

  playerHit(source?: Phaser.Physics.Arcade.Sprite, amount = 10) {
    if (this.time.now < this.dodgeUntil) return
    if (this.time.now < this.parryUntil && source) { source.destroy(); this.possession = Math.max(0, this.possession - 2); return }
    this.possession = Math.min(100, this.possession + amount)
    this.cameras.main.shake(150, .008)
    this.player.setTint(0xb92f3b); this.time.delayedCall(180, () => this.player.clearTint())
    this.playerActionUntil = this.time.now + 240
    this.tweens.add({ targets: this.player, scaleX: this.player.scaleX * 1.12, scaleY: this.player.scaleY * .82, duration: 70, yoyo: true })
  }

  damageEnemy(e: Phaser.Physics.Arcade.Sprite, n: number) {
    e.setData('hp', e.getData('hp') - n)
    e.setTint(0xffffff); this.time.delayedCall(80, () => e.clearTint())
    if (e.getData('hp') <= 0) {
      e.disableBody(true, false)
      e.play('demon-death', true)
      this.tweens.add({ targets: e, alpha: 0, duration: 520, delay: 260, onComplete: () => { (e.getData('shadow') as Phaser.GameObjects.Ellipse | undefined)?.destroy(); e.destroy() } })
    } else {
      this.tweens.add({ targets: e, x: e.x + (e.x - this.player.x) * .1, duration: 85, ease: 'Quad.Out' })
    }
  }

  damageBoss(n: number) {
    if (!this.bossActive || this.executable) return
    this.bossHp = Math.max(0, this.bossHp - n)
    this.boss.setTint(0xffffff); this.time.delayedCall(80, () => this.boss.clearTint())
    if (this.bossHp <= 0) this.makeExecutable('육체가 무너졌습니다')
  }

  makeExecutable(reason: string) {
    this.executable = true
    this.boss.setVelocity(0).setTint(0x6d151b)
    this.boss.stop().setFrame(13)
    this.tweens.add({ targets: this.boss, scaleY: this.boss.scaleY * .88, y: this.boss.y + 12, duration: 420, ease: 'Back.Out' })
    this.add.circle(this.boss.x, this.boss.y - 15, 9, 0xff1515).setStrokeStyle(4, 0xffffff).setDepth(50).setName('weakpoint')
    this.instruction.setText(`${reason} · 붉은 핵에 근접 공격으로 처형하십시오`)
  }

  executeBoss() {
    this.bossActive = false
    this.boss.setActive(false)
    this.boss.setFrame(15)
    this.children.getByName('weakpoint')?.destroy()
    this.cameras.main.flash(500, 190, 30, 35)
    this.tweens.add({ targets: this.boss, alpha: 0, angle: 90, scaleX: this.boss.scaleX * 1.25, duration: 650, onComplete: () => this.boss.setVisible(false) })
    this.tweens.add({ targets: this.bossShadow, alpha: 0, duration: 650 })
    this.instruction.setText('처형 성공 · 지옥문이 잠시 닫혔습니다')
    this.time.delayedCall(1800, () => this.endGame(true))
  }

  useMedicine() {
    if (this.medicine <= 0 || this.possession <= 0) return
    this.medicine--; this.possession = Math.max(0, this.possession - 25)
    this.player.setTint(0x9ee8d0); this.time.delayedCall(450, () => this.player.clearTint())
  }

  redrawHud() {
    const color = this.possession < 50 ? 0xd8cdbf : this.possession < 80 ? 0xe44a43 : 0x7c1b32
    this.possessionBar.clear().fillStyle(0x17151a, .95).fillRoundedRect(30, 48, 360, 22, 5).fillStyle(color).fillRoundedRect(34, 52, 352 * this.possession / 100, 14, 4)
    this.statusText.setText(`빙의율 ${Math.round(this.possession)}%   신성한 약 ${this.medicine}/3   [${this.weaponSlot}] ${this.weaponSlot === 1 ? this.melee.toUpperCase() : this.gun.toUpperCase()}`)
    this.bossBar.clear()
    if (this.bossActive) {
      this.bossBar.fillStyle(0x17151a, .95).fillRoundedRect(440, 25, 400, 50, 7)
        .fillStyle(0xb5353b).fillRect(450, 37, 380 * this.bossHp / 100, 9)
        .fillStyle(0xd2b37a).fillRect(450, 55, 380 * this.fear / 100, 7)
    }
    const vignette = document.querySelector<HTMLDivElement>('#vignette')!
    vignette.style.opacity = String(Math.max(0, (this.possession - 55) / 45))
  }

  endGame(win: boolean) {
    this.gameStarted = false
    this.physics.pause()
    if (!win) this.tweens.add({ targets: this.player, angle: 90, alpha: .25, y: this.player.y + 24, duration: 520, ease: 'Cubic.In' })
    const panel = this.add.rectangle(640, 360, 620, 300, 0x0c0c10, .96).setStrokeStyle(2, win ? 0xc3a66c : 0x8f2731).setDepth(300)
    const title = this.add.text(640, 285, win ? 'GATE SEALED' : 'VESSEL LOST', { fontFamily: 'Georgia', fontSize: '46px', color: win ? '#e8d5ad' : '#d34248' }).setOrigin(.5).setDepth(301)
    const copy = this.add.text(640, 355, win ? '공포를 이겨내고 악마를 처형했습니다.' : '육체가 완전히 빼앗겼습니다.', { fontFamily: 'Arial', fontSize: '18px', color: '#c9bdb4' }).setOrigin(.5).setDepth(301)
    const restart = this.add.text(640, 430, '다시 시작', { fontFamily: 'Arial', fontSize: '18px', color: '#fff', backgroundColor: '#762d33', padding: { x: 28, y: 13 } }).setOrigin(.5).setDepth(301).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart())
    void panel; void title; void copy; void restart
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#090a0d',
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: PossessionScene,
})
