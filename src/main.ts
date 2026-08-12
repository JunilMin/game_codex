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
  statusText!: Phaser.GameObjects.Text
  possessionBar!: Phaser.GameObjects.Graphics
  bossBar!: Phaser.GameObjects.Graphics
  instruction!: Phaser.GameObjects.Text
  preparePanel!: Phaser.GameObjects.Container

  constructor() { super('possession') }

  create() {
    this.resetRunState()
    this.physics.resume()
    this.makeTextures()
    this.drawArena()
    this.walls = this.physics.add.staticGroup()
    this.makeObstacle(330, 240, 70, 110)
    this.makeObstacle(950, 470, 85, 120)
    this.makeObstacle(960, 210, 145, 52)
    this.makeObstacle(310, 510, 140, 52)

    this.enemies = this.physics.add.group()
    this.bullets = this.physics.add.group()
    this.enemyShots = this.physics.add.group()
    this.player = this.physics.add.sprite(640, 570, 'player').setDepth(20).setCollideWorldBounds(true)
    this.player.body!.setSize(28, 34).setOffset(10, 18)
    this.boss = this.physics.add.sprite(640, 145, 'boss').setDepth(20).setImmovable(true).setVisible(false).setActive(false)

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
    const vignette = document.querySelector<HTMLDivElement>('#vignette')
    if (vignette) vignette.style.opacity = '0'
  }

  makeTextures() {
    if (this.textures.exists('player')) return
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xe8ded0).fillCircle(24, 28, 15).fillStyle(0x302b31).fillRect(13, 39, 22, 25).fillStyle(0xd5403a).fillTriangle(12, 42, 36, 42, 24, 65).generateTexture('player', 48, 68).clear()
    g.fillStyle(0x20181f).fillCircle(34, 31, 25).fillStyle(0x9f272e).fillTriangle(10, 15, 23, 4, 21, 24).fillTriangle(58, 15, 45, 4, 47, 24).fillStyle(0xd9483f).fillCircle(25, 28, 4).fillCircle(43, 28, 4).fillStyle(0x3b2025).fillRect(13, 47, 42, 36).generateTexture('boss', 68, 86).clear()
    g.fillStyle(0x6d252c).fillCircle(18, 17, 14).fillStyle(0x2b1d22).fillRect(8, 28, 20, 22).generateTexture('enemy', 36, 52).clear()
    g.fillStyle(0xf6d477).fillCircle(5, 5, 5).generateTexture('bullet', 10, 10).clear()
    g.fillStyle(0xb63e45).fillCircle(6, 6, 6).generateTexture('enemyShot', 12, 12).destroy()
  }

  drawArena() {
    this.cameras.main.setBackgroundColor('#090a0d')
    const g = this.add.graphics()
    g.fillStyle(0x17171c).fillRect(36, 36, W - 72, H - 72)
    for (let y = 70; y < H - 60; y += 48) {
      for (let x = 70; x < W - 60; x += 96) {
        const shift = ((y / 48) % 2) * 48
        g.lineStyle(1, 0x2c2930, .55).strokePoints([
          new Phaser.Math.Vector2(x + shift, y), new Phaser.Math.Vector2(x + 48 + shift, y + 24),
          new Phaser.Math.Vector2(x + shift, y + 48), new Phaser.Math.Vector2(x - 48 + shift, y + 24),
          new Phaser.Math.Vector2(x + shift, y)
        ])
      }
    }
    g.lineStyle(5, 0x4a292c).strokeRect(36, 36, W - 72, H - 72)
    g.fillStyle(0x220f14, .9).fillEllipse(640, 120, 300, 95)
    g.lineStyle(4, 0xa43039, .7).strokeEllipse(640, 120, 230, 64)
    g.fillStyle(0x54252a, .45).fillEllipse(640, 650, 180, 50)
    for (const [x, y, r] of [[510,360,56],[770,390,44],[720,260,34]]) {
      g.fillStyle(0x7d1e2b, .22).fillCircle(x, y, r)
      g.lineStyle(2, 0xc8323e, .45).strokeCircle(x, y, r)
    }
    this.add.text(640, 87, 'HELLGATE', { fontFamily: 'Georgia', fontSize: '13px', color: '#b9897e', letterSpacing: 5 }).setOrigin(.5)
  }

  makeObstacle(x: number, y: number, w: number, h: number) {
    const shadow = this.add.ellipse(x + 9, y + h / 2 + 9, w + 20, 28, 0x000000, .55).setDepth(4)
    const block = this.add.rectangle(x, y, w, h, 0x29262b).setStrokeStyle(3, 0x51464b).setDepth(10)
    this.add.rectangle(x, y - h / 2 + 8, w - 10, 12, 0x5c4a4d).setDepth(11)
    const body = this.walls.create(x, y, undefined).setVisible(false) as Phaser.Physics.Arcade.Sprite
    body.body!.setSize(w, h)
    void shadow; void block
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
    this.instruction.setText(`WAVE ${this.wave} · 35초 생존 후 보스를 처형하십시오`)
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

    if (!this.bossActive && time - this.waveStarted < 35000 && time - this.lastSpawn > 1550) { this.spawnEnemy(); this.lastSpawn = time }
    if (!this.bossActive && time - this.waveStarted >= 35000 && this.enemies.countActive() === 0) this.spawnBoss()
    this.updateEnemies(time)
    this.updateBoss(time)
    this.redrawHud()
    if (this.possession >= 100) this.endGame(false)
  }

  powerMultiplier() { return this.possession < 20 ? 1 : this.possession < 50 ? 1.15 : this.possession < 80 ? 1.4 : Math.max(.55, 1.25 - (this.possession - 80) * .035) }
  speedMultiplier() { return this.possession < 20 ? 1 : this.possession < 50 ? 1.05 : this.possession < 80 ? 1.2 : Math.max(.58, 1.1 - (this.possession - 80) * .027) }

  spawnEnemy() {
    const edge = Phaser.Math.Between(0, 3)
    const p = edge === 0 ? [50, Phaser.Math.Between(80, 640)] : edge === 1 ? [1230, Phaser.Math.Between(80, 640)] : edge === 2 ? [Phaser.Math.Between(80, 1200), 55] : [Phaser.Math.Between(80, 1200), 650]
    const e = this.enemies.create(p[0], p[1], 'enemy') as Phaser.Physics.Arcade.Sprite
    e.setData('hp', 32).setData('nextHit', 0).setDepth(18)
  }

  updateEnemies(time: number) {
    this.enemies.getChildren().forEach(o => {
      const e = o as Phaser.Physics.Arcade.Sprite
      if (!e.active) return
      this.physics.moveToObject(e, this.player, 75 + this.wave * 8)
      e.setDepth(12 + e.y / 40)
      if (Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 54 && time > e.getData('nextHit')) {
        e.setData('nextHit', time + 900); this.playerHit(e, 8)
      }
    })
  }

  spawnBoss() {
    this.bossActive = true
    this.boss.setPosition(640, 135).setVisible(true).setActive(true)
    this.bossHp = 100; this.fear = 0; this.executable = false
    this.boss.setData('nextAttack', this.time.now + 1300).setData('attackCount', 0)
    this.instruction.setText('빙의된 문지기 · 붉은 섬광을 패링해 공포를 채우십시오')
  }

  updateBoss(time: number) {
    if (!this.bossActive || this.executable) return
    const d = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, this.player.x, this.player.y)
    if (d > 150) this.physics.moveToObject(this.boss, this.player, 92)
    else this.boss.setVelocity(0)
    if (time > this.boss.getData('nextAttack')) {
      this.boss.setData('nextAttack', time + 1450)
      const count = this.boss.getData('attackCount') + 1; this.boss.setData('attackCount', count)
      const parryable = count % 3 !== 0
      this.boss.setTint(parryable ? 0xff4a4a : 0x9d59ff)
      this.time.delayedCall(380, () => {
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

  fireEnemyShot(a: number) {
    const s = this.enemyShots.create(this.boss.x, this.boss.y, 'enemyShot') as Phaser.Physics.Arcade.Sprite
    s.setVelocity(Math.cos(a) * 210, Math.sin(a) * 210).setDepth(25)
    this.time.delayedCall(3500, () => s.destroy())
  }

  attack(x: number, y: number) {
    if (this.time.now - this.lastAttack < (this.weaponSlot === 1 ? 330 : 460)) return
    this.lastAttack = this.time.now
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, x, y)
    if (this.weaponSlot === 2) {
      const pellets = this.gun === 'shotgun' ? 5 : 1
      for (let i = 0; i < pellets; i++) {
        const a = angle + (i - (pellets - 1) / 2) * .11
        const b = this.bullets.create(this.player.x, this.player.y, 'bullet') as Phaser.Physics.Arcade.Sprite
        b.setVelocity(Math.cos(a) * 560, Math.sin(a) * 560).setDepth(30)
        this.time.delayedCall(900, () => b.destroy())
      }
      return
    }
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
    this.player.setTint(0xe8cf8b)
    this.time.delayedCall(250, () => this.player.clearTint())
  }

  successfulParry() {
    this.fear = Math.min(100, this.fear + 18)
    this.cameras.main.shake(100, .006)
    this.boss.setVelocity((this.boss.x - this.player.x) * 3, (this.boss.y - this.player.y) * 3)
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
  }

  damageEnemy(e: Phaser.Physics.Arcade.Sprite, n: number) {
    e.setData('hp', e.getData('hp') - n)
    e.setTint(0xffffff); this.time.delayedCall(80, () => e.clearTint())
    if (e.getData('hp') <= 0) e.destroy()
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
    this.add.circle(this.boss.x, this.boss.y - 15, 9, 0xff1515).setStrokeStyle(4, 0xffffff).setDepth(50).setName('weakpoint')
    this.instruction.setText(`${reason} · 붉은 핵에 근접 공격으로 처형하십시오`)
  }

  executeBoss() {
    this.bossActive = false
    this.boss.setActive(false).setVisible(false)
    this.children.getByName('weakpoint')?.destroy()
    this.cameras.main.flash(500, 190, 30, 35)
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
