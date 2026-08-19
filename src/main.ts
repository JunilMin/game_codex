import Phaser from 'phaser'
import './style.css'

type Melee = 'sword' | 'spear'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="shell">
    <header><span class="kicker">PROTOTYPE 01</span><h1>POSSESSION</h1><p>지옥문이 열렸다. 빼앗기기 전에 공포를 심어라.</p></header>
    <section id="game-wrap"><div id="game"></div><div id="vignette"></div></section>
    <footer>WASD 이동 · 좌클릭 공격 · 우클릭 악성 중화 · SPACE 회피 · Q 신성한 약</footer>
  </main>`

const W = 1280
const H = 720
const MAP_W = 3200
const MAP_H = 3200

type MissionPhase = 'seals' | 'slaughter' | 'boss' | 'extract'

class PossessionScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite
  boss!: Phaser.Physics.Arcade.Sprite
  bossClone?: Phaser.Physics.Arcade.Sprite
  enemies!: Phaser.Physics.Arcade.Group
  enemyShots!: Phaser.Physics.Arcade.Group
  walls!: Phaser.Physics.Arcade.StaticGroup
  keys!: Record<string, Phaser.Input.Keyboard.Key>
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  possession = 12
  purification = 0
  bossHp = 300
  medicine = 3
  melee: Melee = 'sword'
  meleeLevel = 1
  wave = 0
  gameStarted = false
  bossActive = false
  bossPhase = 1
  cinematicPaused = false
  endingShown = false
  executable = false
  parryUntil = 0
  dodgeUntil = 0
  invulnerableUntil = 0
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
  storyPanel!: Phaser.GameObjects.Container
  controlsPanel!: Phaser.GameObjects.Container
  statueInteractPrompt!: Phaser.GameObjects.Text
  playerShadow!: Phaser.GameObjects.Ellipse
  playerContactShadow!: Phaser.GameObjects.Ellipse
  bossShadow!: Phaser.GameObjects.Ellipse
  bossContactShadows: Phaser.GameObjects.Ellipse[] = []
  weaponVisual!: Phaser.GameObjects.Image
  aimAngle = -.7
  weaponActionUntil = 0
  nextMeleeSwing = 1
  missionPhase: MissionPhase = 'seals'
  sealsActivated = 0
  enemiesKilled = 0
  isChannelingSeal = false
  isPaused = false
  pausePanel!: Phaser.GameObjects.Container
  sealNodes: Phaser.GameObjects.Container[] = []
  awakenedStatues: Phaser.GameObjects.Container[] = []
  extraction!: Phaser.GameObjects.Container
  hellGate!: Phaser.GameObjects.Container
  gateOpen!: Phaser.GameObjects.Image
  gateClosed!: Phaser.GameObjects.Image
  gateGlow!: Phaser.GameObjects.Ellipse
  exitSequenceStarted = false
  radar!: Phaser.GameObjects.Graphics
  objectiveText!: Phaser.GameObjects.Text
  interactProgress = 0
  activeSeal?: Phaser.GameObjects.Container

  constructor() { super('possession') }

  preload() {
    this.load.image('arena', '/assets/hellgate-arena.png')
    this.load.image('hellFloor', '/assets/hell-basalt-floor-v1.png')
    this.load.image('hellWall', '/assets/hell-fortress-wall-v1.png')
    this.load.image('hellGateOpen','/assets/hell-gate-open-v1.png')
    this.load.image('hellGateClosed','/assets/hell-gate-closed-v1.png')
    this.load.image('angelDirection', '/assets/angel-direction-v1.png')
    this.load.spritesheet('awakenedAngelStatue', '/assets/awakened-angel-statue-attack-v1.png', { frameWidth: 543, frameHeight: 724 })
    this.load.spritesheet('guardianMotion', '/assets/guardian-motion-v3.png', { frameWidth: 313, frameHeight: 313 })
    this.load.spritesheet('guardianUnarmed', '/assets/guardian-unarmed-v2.png', { frameWidth: 400, frameHeight: 313 })
    this.load.spritesheet('demonMotion', '/assets/demon-motion-v2.png', { frameWidth: 313, frameHeight: 313 })
    this.load.spritesheet('bossMotion', '/assets/gatekeeper-motion-v2.png', { frameWidth: 313, frameHeight: 313 })
    for (const name of ['sword', 'spear']) this.load.image(`weapon-${name}`, `/assets/weapon-${name}.png`)
  }

  create() {
    this.resetRunState()
    this.physics.resume()
    this.makeTextures()
    this.createAnimations()
    this.walls = this.physics.add.staticGroup()
    this.drawOperationMap()

    this.enemies = this.physics.add.group()
    this.enemyShots = this.physics.add.group()
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H)
    this.player = this.physics.add.sprite(400, 2780, 'guardianUnarmed', 0).setDisplaySize(92, 92).setDepth(20).setCollideWorldBounds(true).setTint(0xd0bbb5)
    this.player.body!.setSize(105, 62).setOffset(148, 228)
    this.player.play('guardian-idle')
    this.playerShadow = this.add.ellipse(400, 2811, 42, 12, 0x000000, .38).setDepth(18)
    this.playerContactShadow=this.add.ellipse(400,2809,27,7,0x000000,.76).setDepth(19)
    this.weaponVisual = this.add.image(400, 2780, 'weapon-sword').setDepth(22).setVisible(false)
    this.boss = this.physics.add.sprite(1600, 1500, 'bossMotion', 0).setDisplaySize(261, 261).setDepth(20).setImmovable(true).setVisible(false).setActive(false).setTint(0xc5aaa8)
    this.boss.body!.setSize(380, 300).setOffset(180, 400)
    this.bossShadow = this.add.ellipse(1600, 1575, 140, 34, 0x000000, .4).setDepth(18).setVisible(false)
    this.bossContactShadows=[this.add.ellipse(1560,1571,48,11,0x000000,.72),this.add.ellipse(1640,1571,48,11,0x000000,.72)].map(s=>s.setDepth(19).setVisible(false))

    this.physics.add.collider(this.player, this.walls)
    this.physics.add.collider(this.player,this.enemies)
    this.physics.add.collider(this.player,this.boss)
    // 일반 악마는 통로 밖의 벽을 타고 넘어오며, 플레이어와 보스만 벽에 막힌다.
    this.physics.add.collider(this.boss, this.walls)
    this.physics.add.overlap(this.player, this.enemyShots, (_, s) => { (s as Phaser.Physics.Arcade.Sprite).destroy(); this.purification=Math.max(0,this.purification-30);this.playerHit(undefined,25) })

    const kb = this.input.keyboard!
    this.cursors = kb.createCursorKeys()
    this.keys = kb.addKeys('W,A,S,D,E,Q,SPACE,ESC,F1') as Record<string, Phaser.Input.Keyboard.Key>
    kb.addCapture(['ESC','F1'])
    kb.on('keydown-F1',(event:KeyboardEvent)=>{event.preventDefault();this.enableBossTestMode()})
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.gameStarted || this.isPaused) return
      if (this.isChannelingSeal || (this.activeSeal && this.keys.E.isDown)) return
      if (p.button===2 || p.rightButtonDown()) {
        this.aimAngle=Phaser.Math.Angle.Between(this.player.x,this.player.y,p.worldX,p.worldY)
        this.player.setFlipX(p.worldX<this.player.x)
        this.parry()
      }
      else this.attack(p.worldX, p.worldY)
    })
    this.input.mouse?.disableContextMenu()

    this.createHud()
    this.createPauseMenu()
    this.createMissionObjects()
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H)
    this.cameras.main.setZoom(1)
    this.createPreparation()
    this.createControlGuide()
    this.createStoryIntro()
  }

  resetRunState() {
    this.possession = 12
    this.purification = 0
    this.bossHp = 300
    this.medicine = 3
    this.melee = 'sword'
    this.meleeLevel = 1
    this.wave = 0
    this.gameStarted = false
    this.bossActive = false
    this.bossPhase = 1
    this.cinematicPaused = false
    this.endingShown = false
    this.exitSequenceStarted = false
    this.bossClone = undefined
    this.executable = false
    this.parryUntil = 0
    this.dodgeUntil = 0
    this.invulnerableUntil = 0
    this.lastAttack = 0
    this.lastSpawn = 0
    this.waveStarted = 0
    this.playerActionUntil = 0
    this.lastDodgeAfterimage = 0
    this.bossActionUntil = 0
    this.aimAngle = -.7
    this.weaponActionUntil = 0
    this.nextMeleeSwing = 1
    this.missionPhase = 'seals'
    this.sealsActivated = 0
    this.enemiesKilled = 0
    this.isChannelingSeal = false
    this.isPaused = false
    this.sealNodes = []
    this.awakenedStatues = []
    this.bossContactShadows=[]
    this.interactProgress = 0
    this.activeSeal = undefined
    const vignette = document.querySelector<HTMLDivElement>('#vignette')
    if (vignette) vignette.style.opacity = '0'
  }

  makeTextures() {
    if (this.textures.exists('enemyShot')) return
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xb63e45).fillCircle(6, 6, 6).generateTexture('enemyShot', 12, 12).destroy()
  }

  drawOperationMap() {
    this.cameras.main.setBackgroundColor('#090a0d')
    this.add.tileSprite(MAP_W/2,MAP_H/2,MAP_W,MAP_H,'hellWall').setTileScale(.42).setDepth(0).setTint(0x100c0f)
    const pathMaskShape=this.make.graphics({x:0,y:0})
    const routes = [[400,2780,720,2200],[720,2200,1550,1550],[1550,1550,720,820],[1550,1550,2580,760],[1550,1550,2630,2440]]
    const hubs=[[400,2780],[720,820],[2580,760],[2630,2440],[1550,1550]]
    pathMaskShape.lineStyle(390,0xffffff,1)
    for(const [x1,y1,x2,y2] of routes) pathMaskShape.lineBetween(x1,y1,x2,y2)
    for(const [x,y] of hubs) pathMaskShape.fillStyle(0xffffff).fillCircle(x,y,x===1550?300:235)

    const pathBorder=this.add.graphics().setDepth(.8)
    pathBorder.lineStyle(434,0x040306,.99)
    for(const [x1,y1,x2,y2] of routes) pathBorder.lineBetween(x1,y1,x2,y2)
    pathBorder.fillStyle(0x040306,.99)
    for(const [x,y] of hubs) pathBorder.fillCircle(x,y,x===1550?320:255)
    pathBorder.lineStyle(408,0x7c3437,.76)
    for(const [x1,y1,x2,y2] of routes) pathBorder.lineBetween(x1,y1,x2,y2)
    pathBorder.fillStyle(0x7c3437,.76)
    for(const [x,y] of hubs) pathBorder.fillCircle(x,y,x===1550?308:243)

    const pathMask=pathMaskShape.createGeometryMask()
    const floor=this.add.tileSprite(MAP_W/2,MAP_H/2,MAP_W,MAP_H,'hellFloor').setTileScale(.5).setDepth(1).setTint(0xf1d8c9)
    floor.setMask(pathMask)
    const floorLight=this.add.rectangle(MAP_W/2,MAP_H/2,MAP_W,MAP_H,0xffe2cf,.1).setDepth(1.2)
    floorLight.setMask(pathMask)
    const g = this.add.graphics().setDepth(2)
    for(let x=80;x<MAP_W;x+=160) for(let y=80;y<MAP_H;y+=160) {
      const overlapsRoad=[
        [0,0],[-70,0],[70,0],[0,-70],[0,70],
        [-55,-55],[55,-55],[-55,55],[55,55]
      ].some(([ox,oy])=>this.isWalkable(x+ox,y+oy))
      if(overlapsRoad)continue
      this.makeObstacle(x,y,158,158)
      const jag=()=>Phaser.Math.Between(-16,16)
      const rock=[
        new Phaser.Math.Vector2(x-88+jag(),y-82+jag()),new Phaser.Math.Vector2(x+jag(),y-91+jag()),
        new Phaser.Math.Vector2(x+88+jag(),y-80+jag()),new Phaser.Math.Vector2(x+92+jag(),y+jag()),
        new Phaser.Math.Vector2(x+82+jag(),y+86+jag()),new Phaser.Math.Vector2(x+jag(),y+92+jag()),
        new Phaser.Math.Vector2(x-86+jag(),y+81+jag()),new Phaser.Math.Vector2(x-92+jag(),y+jag())
      ]
      g.fillStyle(0x020204,.46).fillPoints(rock,true)
      g.lineStyle(3,0x522326,.18).strokePoints(rock,true)
      if(Phaser.Math.Between(0,2)===0){
        g.lineStyle(2,0x9a4d43,.12)
        g.lineBetween(x-54+jag(),y-22+jag(),x-5+jag(),y+8+jag())
        g.lineBetween(x-5+jag(),y+8+jag(),x+48+jag(),y-10+jag())
      }
    }
    g.lineStyle(12,0xbb3d32,.65).strokeRect(5,5,MAP_W-10,MAP_H-10)
    this.decorateOperationMap(g)
  }

  decorateOperationMap(g:Phaser.GameObjects.Graphics) {
    const guides=[[535,2480,32],[850,2070,48],[1130,1870,48],[1280,1370,-42],[1810,1320,54],[2130,1110,54],[2080,1980,132],[2360,2210,132],[950,1080,-42],[2300,820,78]]
    for(const [x,y,_angle] of guides) {
      const glow=this.add.circle(x,y,58,0xb9fff0,.08).setDepth(4)
      const statue=this.add.image(x,y,'angelDirection').setDisplaySize(74,112).setAngle(0).setTint(0xb9aaa0).setDepth(5)
      this.tweens.add({targets:glow,scale:1.35,alpha:.2,duration:Phaser.Math.Between(850,1250),yoyo:true,repeat:-1})
      this.tweens.add({targets:statue,alpha:.72,duration:Phaser.Math.Between(1200,1700),yoyo:true,repeat:-1})
    }
    const debris=[[610,2380],[980,1980],[1230,1690],[980,1120],[1880,1260],[2230,930],[2070,1920],[2410,2250],[2810,2260]]
    for(const [x,y] of debris) {
      g.fillStyle(0x4b4140,.75).fillTriangle(x-25,y+12,x+10,y-17,x+31,y+15)
      g.lineStyle(3,0x837069,.45).lineBetween(x-18,y+5,x+18,y-8)
    }
  }

  isWalkable(x:number,y:number) {
    const hubs=[[400,2780,235],[720,820,235],[2580,760,235],[2630,2440,235],[1550,1550,300]]
    if(hubs.some(([hx,hy,r])=>Phaser.Math.Distance.Between(x,y,hx,hy)<r)) return true
    const routes=[[400,2780,720,2200],[720,2200,1550,1550],[1550,1550,720,820],[1550,1550,2580,760],[1550,1550,2630,2440]]
    return routes.some(([x1,y1,x2,y2])=>Phaser.Math.Distance.Between(x,y,Phaser.Math.Clamp(x,x1<x2?x1:x2,x1>x2?x1:x2),Phaser.Math.Clamp(y,y1<y2?y1:y2,y1>y2?y1:y2))<205 && this.distanceToSegment(x,y,x1,y1,x2,y2)<195)
  }

  distanceToSegment(px:number,py:number,x1:number,y1:number,x2:number,y2:number) {
    const dx=x2-x1,dy=y2-y1
    const t=Phaser.Math.Clamp(((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy),0,1)
    return Phaser.Math.Distance.Between(px,py,x1+t*dx,y1+t*dy)
  }

  createMissionObjects() {
    const positions = [[720,820],[2580,760],[2630,2440]]
    this.sealNodes = positions.map(([x,y], i) => {
      const aura = this.add.ellipse(0, 25, 118, 42, 0x75d9d1, .05).setStrokeStyle(3, 0xa9eee7, .24)
      const statue = this.add.sprite(0, -13, 'awakenedAngelStatue', 0).setDisplaySize(92,138).setTint(0x877d82).setAngle(0)
      const tearLeft = this.add.ellipse(-13,-35,5,22,0xbcecf0,.68)
      const tearRight = this.add.ellipse(10,-35,4,18,0xbcecf0,.58)
      const waveA = this.add.ellipse(0,28,92,30).setStrokeStyle(3,0xbcecf0,.26)
      const waveB = this.add.ellipse(0,28,138,46).setStrokeStyle(2,0xbcecf0,.14)
      const hpBack = this.add.rectangle(0,62,82,7,0x16171c,.9)
      const hpBar = this.add.rectangle(-41,62,82,5,0x9ee8d0,.9).setOrigin(0,.5).setVisible(false)
      const label = this.add.text(0, -105, `울부짖는 천사 ${i + 1}`, { fontFamily:'Arial', fontSize:'17px', color:'#d7d2d0', backgroundColor:'#0b0b0ecc', padding:{x:9,y:5} }).setOrigin(.5)
      const node = this.add.container(x,y,[aura,statue,tearLeft,tearRight,waveA,waveB,hpBack,hpBar,label]).setDepth(8)
        .setData('activated',false).setData('index',i).setData('hp',180).setData('nextShot',0)
        .setData('statue',statue).setData('tears',[tearLeft,tearRight]).setData('waves',[waveA,waveB]).setData('hpBar',hpBar)
      hpBack.setVisible(false)
      this.tweens.add({targets:[tearLeft,tearRight],y:'+=13',alpha:.08,duration:650+i*90,yoyo:true,repeat:-1})
      this.tweens.add({targets:waveA,scale:1.65,alpha:0,duration:1050,repeat:-1})
      this.tweens.add({targets:waveB,scale:1.5,alpha:0,duration:1350,delay:350,repeat:-1})
      return node
    })
    this.createHellGate()
    const threshold=this.add.rectangle(0,0,150,54,0x7e252b,.08).setStrokeStyle(3,0xc35a4f,.22)
    const label = this.add.text(0,-105,'열린 지옥문',{fontFamily:'Arial',fontSize:'17px',color:'#efc1ad',backgroundColor:'#160d10dd',padding:{x:10,y:5}}).setOrigin(.5)
    this.extraction = this.add.container(400,2780,[threshold,label]).setDepth(7).setVisible(false)
    this.tweens.add({targets:threshold,alpha:.28,duration:720,yoyo:true,repeat:-1})
  }

  createHellGate() {
    const shadow=this.add.ellipse(0,48,285,92,0x000000,.68)
    this.gateGlow=this.add.ellipse(0,24,174,72,0xc23b32,.18).setStrokeStyle(4,0xf17b55,.3)
    this.gateOpen=this.add.image(0,-28,'hellGateOpen').setDisplaySize(340,227)
    this.gateClosed=this.add.image(0,-28,'hellGateClosed').setDisplaySize(340,227).setAlpha(0).setVisible(false)
    this.hellGate=this.add.container(400,2935,[shadow,this.gateGlow,this.gateOpen,this.gateClosed]).setDepth(116)
    this.tweens.add({targets:this.gateGlow,scaleX:1.14,alpha:.32,duration:900,yoyo:true,repeat:-1,ease:'Sine.InOut'})
  }

  createAnimations() {
    if (this.anims.exists('guardian-idle')) return
    this.anims.create({ key: 'guardian-idle', frames: this.anims.generateFrameNumbers('guardianUnarmed', { start: 0, end: 3 }), frameRate: 4, repeat: -1 })
    this.anims.create({ key: 'guardian-run', frames: this.anims.generateFrameNumbers('guardianUnarmed', { start: 4, end: 7 }), frameRate: 11, repeat: -1 })
    this.anims.create({ key: 'guardian-slash', frames: this.anims.generateFrameNumbers('guardianUnarmed', { start: 8, end: 11 }), frameRate: 15, repeat: 0 })
    this.anims.create({ key: 'guardian-parry', frames: this.anims.generateFrameNumbers('guardianUnarmed', { start: 12, end: 15 }), frameRate: 12, repeat: 0 })
    this.anims.create({ key: 'demon-idle', frames: this.anims.generateFrameNumbers('demonMotion', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
    this.anims.create({ key: 'demon-run', frames: this.anims.generateFrameNumbers('demonMotion', { start: 4, end: 7 }), frameRate: 10, repeat: -1 })
    this.anims.create({ key: 'demon-attack', frames: this.anims.generateFrameNumbers('demonMotion', { start: 8, end: 11 }), frameRate: 13, repeat: 0 })
    this.anims.create({ key: 'demon-death', frames: this.anims.generateFrameNumbers('demonMotion', { start: 12, end: 15 }), frameRate: 8, repeat: 0 })
    this.anims.create({ key: 'angel-statue-attack', frames: this.anims.generateFrameNumbers('awakenedAngelStatue', { start: 0, end: 3 }), frameRate: 8, repeat: 0 })
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
    this.statusText = this.add.text(35, 22, '', { fontFamily: 'Arial', fontSize: '15px', color: '#dfd4c7' }).setScrollFactor(0).setDepth(101)
    this.instruction = this.add.text(640, 680, '', { fontFamily: 'Arial', fontSize: '15px', color: '#cabbb1', backgroundColor: '#111116cc', padding: { x: 14, y: 8 } }).setOrigin(.5).setScrollFactor(0).setDepth(101)
    this.objectiveText = this.add.text(925, 215, '', { fontFamily:'Arial', fontSize:'15px', color:'#f0dfca', backgroundColor:'#0a0b0dee', padding:{x:13,y:11}, lineSpacing:7, fixedWidth:323 }).setScrollFactor(0).setDepth(102)
    this.radar = this.add.graphics().setScrollFactor(0).setDepth(102)
    this.statueInteractPrompt=this.add.text(0,0,'상호 작용  E',{fontFamily:'Arial',fontSize:'16px',fontStyle:'bold',color:'#f4fff9',backgroundColor:'#14211fe8',padding:{x:12,y:8}}).setOrigin(.5).setDepth(90).setVisible(false)
  }

  createPauseMenu() {
    const bg=this.add.rectangle(640,360,600,500,0x090a0e,.97).setStrokeStyle(3,0x8d3b42)
    const title=this.add.text(640,145,'PAUSED',{fontFamily:'Georgia',fontSize:'44px',color:'#f0dfca'}).setOrigin(.5).setName('pauseTitle')
    const loadout=this.add.text(640,205,'일시정지 중 장비 변경',{fontFamily:'Arial',fontSize:'17px',color:'#bfaea4'}).setOrigin(.5)
    const state=this.add.text(640,260,'',{fontFamily:'Arial',fontSize:'18px',color:'#ffffff',align:'center'}).setOrigin(.5)
    const items:Phaser.GameObjects.GameObject[]=[bg,title,loadout,state]
    const button=(x:number,y:number,label:string,fn:()=>void)=>{const b=this.add.text(x,y,label,{fontFamily:'Arial',fontSize:'17px',color:'#fff',backgroundColor:'#402b30',padding:{x:18,y:12}}).setOrigin(.5).setScrollFactor(0).setInteractive({useHandCursor:true}).on('pointerdown',(_pointer:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{event.stopPropagation();fn();refresh()});items.push(b);return b}
    const swordButton=button(500,350,'검',()=>this.melee='sword');const spearButton=button(610,350,'창',()=>this.melee='spear')
    button(755,325,'계속하기',()=>this.togglePause());(items[items.length-1] as Phaser.GameObjects.Text).setName('pauseContinue')
    button(755,385,'다시 시작',()=>this.scene.restart())
    const refresh=()=>{
      state.setText(`근접 무기  ${this.melee.toUpperCase()}`)
      ;([[swordButton,'sword'],[spearButton,'spear']] as const).forEach(([b,weapon])=>{
        const selected=this.melee===weapon
        b.setBackgroundColor(selected?'#8d3b42':'#402b30').setColor(selected?'#fff4df':'#cdbfc0').setStroke(selected?'#f0c47a':'#000000',selected?2:0).setAlpha(selected?1:.72)
      })
    }
    items.forEach(item=>(item as unknown as Phaser.GameObjects.Text).setScrollFactor(0))
    this.pausePanel=this.add.container(0,0,items).setScrollFactor(0,0,true).setDepth(500).setVisible(false)
    refresh()
  }

  togglePause() {
    if(!this.gameStarted) return
    this.isPaused=!this.isPaused
    this.pausePanel.setVisible(this.isPaused)
    if(this.isPaused){this.player.setVelocity(0);this.physics.pause()}else this.physics.resume()
  }

  createPreparation() {
    const bg = this.add.rectangle(640, 360, 780, 520, 0x0d0e12, .96).setStrokeStyle(2, 0x7b3035)
    const title = this.add.text(640, 138, '봉인 수호자의 무기고', { fontFamily: 'Georgia', fontSize: '34px', color: '#eee1d2' }).setOrigin(.5)
    const sub = this.add.text(640, 183, '이번 작전에 사용할 근접 무기를 선택하십시오', { fontFamily: 'Arial', fontSize: '15px', color: '#aa9891' }).setOrigin(.5)
    const info = this.add.text(640, 245, '', { fontFamily: 'Arial', fontSize: '19px', color: '#e4d8cb', lineSpacing: 15, align:'center' }).setOrigin(.5)
    const buttons: Phaser.GameObjects.Text[] = []
    const button = (x: number, y: number, label: string, fn: () => void) => {
      const t = this.add.text(x, y, label, { fontFamily: 'Arial', fontSize: '17px', color: '#e8ddd2', backgroundColor: '#34262a', padding: { x: 17, y: 11 } }).setInteractive({ useHandCursor: true }).on('pointerdown', () => { fn(); refresh() })
      buttons.push(t); return t
    }
    const meleeLabel=this.add.text(455,385,'근접 무기',{fontFamily:'Arial',fontSize:'16px',color:'#aa9891'}).setOrigin(.5)
    const swordButton=button(580, 385, '검 선택', () => { this.melee = 'sword' })
    const spearButton=button(700, 385, '창 선택', () => { this.melee = 'spear' })
    const start = button(640, 545, '지옥문으로 진입', () => { this.preparePanel.setVisible(false); this.gameStarted = true; this.startWave() }).setOrigin(.5)
    const refresh = () => {
      info.setText(`선택 무기  ${this.melee.toUpperCase()}\n신성한 약 [Q]  3개 지급`)
      ;([[swordButton,'sword'],[spearButton,'spear']] as const).forEach(([b,weapon])=>{
        const selected=this.melee===weapon
        b.setBackgroundColor(selected?'#8d3b42':'#34262a').setColor(selected?'#fff4df':'#cdbfc0').setStroke(selected?'#f0c47a':'#000000',selected?2:0).setAlpha(selected?1:.72)
      })
    }
    this.preparePanel = this.add.container(0, 0, [bg, title, sub, info, meleeLabel, ...buttons]).setScrollFactor(0).setDepth(200).setVisible(false)
    void start; refresh()
  }

  createControlGuide() {
    const bg=this.add.rectangle(640,360,780,520,0x0d0e12,.97).setStrokeStyle(2,0x7b3035)
    const chapter=this.add.text(640,165,'OPERATION GUIDE',{fontFamily:'Arial',fontSize:'15px',color:'#a95a5e',letterSpacing:4}).setOrigin(.5)
    const title=this.add.text(640,220,'조작 방법',{fontFamily:'Georgia',fontSize:'35px',color:'#eee1d2'}).setOrigin(.5)
    const left=this.add.text(455,315,'W A S D\n좌클릭\n우클릭\nSPACE',{fontFamily:'Arial',fontSize:'18px',fontStyle:'bold',color:'#f0ded1',align:'right',lineSpacing:15}).setOrigin(1,.5)
    const right=this.add.text(485,315,'이동\n마력 무기 공격\n악성 중화(패링)\n회피/대시',{fontFamily:'Arial',fontSize:'18px',color:'#bdaea5',lineSpacing:15}).setOrigin(0,.5)
    const left2=this.add.text(750,315,'E\nQ\nESC',{fontFamily:'Arial',fontSize:'18px',fontStyle:'bold',color:'#f0ded1',align:'right',lineSpacing:15}).setOrigin(1,.5)
    const right2=this.add.text(780,315,'천사상과 상호 작용\n신성한 약 사용\n일시정지·무기 변경',{fontFamily:'Arial',fontSize:'18px',color:'#bdaea5',lineSpacing:15}).setOrigin(0,.5)
    const warning=this.add.text(640,455,'검  공속 x1.5 · 범위 x1.17 · 빙의 15%마다 공속 +0.2 / 범위 +0.06\n창  공속 x1.0 · 범위 x1.5 · 빙의 15%마다 공속 +0.1 / 범위 +0.11\n빙의율 100%가 되면 육체를 빼앗기고 사망',{fontFamily:'Arial',fontSize:'13px',color:'#d88d8d',backgroundColor:'#341a20aa',padding:{x:16,y:8},align:'center',lineSpacing:4}).setOrigin(.5)
    const enter=this.add.text(640,535,'봉인 수호자의 무기고로',{fontFamily:'Arial',fontSize:'17px',color:'#fff',backgroundColor:'#562d33',padding:{x:25,y:12}}).setOrigin(.5).setInteractive({useHandCursor:true})
      .on('pointerdown',()=>{this.controlsPanel.setVisible(false);this.preparePanel.setVisible(true)})
    this.controlsPanel=this.add.container(0,0,[bg,chapter,title,left,right,left2,right2,warning,enter]).setScrollFactor(0).setDepth(240).setVisible(false)
  }

  showNarrativeModal(chapterText:string,titleText:string,bodyText:string,buttonText:string,onClose:()=>void) {
    this.cinematicPaused=true
    this.player.setVelocity(0)
    this.physics.pause()
    const bg=this.add.rectangle(640,360,780,520,0x0d0e12,.98).setStrokeStyle(2,0x7b3035)
    const ornament=this.add.graphics().lineStyle(2,0x9a5557,.4).lineBetween(385,225,895,225).lineBetween(385,505,895,505)
    const chapter=this.add.text(640,170,chapterText,{fontFamily:'Arial',fontSize:'15px',color:'#a95a5e',letterSpacing:4}).setOrigin(.5)
    const title=this.add.text(640,275,titleText,{fontFamily:'Georgia',fontSize:'34px',color:'#eee1d2',align:'center',wordWrap:{width:650}}).setOrigin(.5)
    const body=this.add.text(640,385,bodyText,{fontFamily:'Arial',fontSize:'18px',color:'#c7b9af',align:'center',lineSpacing:12,wordWrap:{width:650}}).setOrigin(.5)
    const close=this.add.text(835,545,buttonText,{fontFamily:'Arial',fontSize:'17px',color:'#fff',backgroundColor:'#562d33',padding:{x:24,y:12}}).setOrigin(.5).setInteractive({useHandCursor:true})
    const modalItems:Phaser.GameObjects.GameObject[]=[bg,ornament,chapter,title,body,close]
    modalItems.forEach(item=>(item as Phaser.GameObjects.Text).setScrollFactor(0))
    const panel=this.add.container(0,0,modalItems).setScrollFactor(0,0,true).setDepth(600)
    close.on('pointerdown',(_pointer:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{event.stopPropagation();panel.destroy(true);this.cinematicPaused=false;this.physics.resume();onClose()})
  }

  createStoryIntro() {
    const pages=[
      {
        chapter:'I · 범람',
        title:'지옥은 더 이상 죽은 자만의 땅이 아니었다',
        body:'끝없이 태어난 악마들은 지옥의 골짜기와 성채를 가득 메웠다.\n서로를 집어삼켜도 공간은 부족했고, 마침내 그들의 시선은\n살아 있는 인간의 세계를 향하기 시작했다.'
      },
      {
        chapter:'II · 갈망',
        title:'악마들은 탈출을 원하기 시작했다',
        body:'처음에는 속삭임뿐이었다. 그러나 속삭임은 울부짖음이 되었고,\n울부짖음은 지옥문을 뒤흔드는 거대한 파도가 되었다.\n그들은 인간의 육체를 빼앗기 위해 문 너머로 나가려 한다.'
      },
      {
        chapter:'III · 마검사',
        title:'강한 정신으로 빙의를 거스르는 마검사',
        body:'악마들은 끊임없이 당신의 몸을 빼앗으려 한다. 그러나 강인한 정신력은\n그 침식을 붙잡아 두며, 빙의 게이지는 육체의 지배권이 얼마나\n악마에게 넘어갔는지를 나타낸다. 당신은 마력으로 검과 창을 부리고,\n침식된 힘까지 자신의 공격으로 바꾸어 지옥에 맞선다.\n빙의가 100%에 이르면 영혼은 육체에서 강제로 분리된다.\n남겨진 몸은 악마들에게 완전히 넘어가며, 그것은 곧 죽음을 뜻한다.'
      },
      {
        chapter:'IV · 순례',
        title:'세상의 모든 지옥문을 닫아라',
        body:'울부짖는 천사들을 깨우고, 그들을 삼키려는 악마를 베어라.\n당신은 무너진 성역과 불타는 도시를 지나 세계 곳곳을 누빈다.\n마지막 문이 닫힐 때까지 이 순례는 끝나지 않는다.'
      },
      {
        chapter:'V · 공포',
        title:'악마도 마검사를 두려워한다',
        body:'악마들은 무의식 깊은 곳에서 마검사를 두려워한다.\n특히 자신의 공격이 마력 무기에 막히는 순간, 그 공포는 선명해진다.\n문지기의 공포를 끝까지 채우면 무릎을 꿇릴 수 있다.\n그러나 한 번 쓰러진 문지기는 분노하여 두 육체로 갈라질 것이다.'
      }
    ]
    let page=0
    const bg=this.add.rectangle(640,360,780,520,0x0d0e12,.97).setStrokeStyle(2,0x7b3035)
    const ornament=this.add.graphics().lineStyle(2,0x9a5557,.4).lineBetween(385,225,895,225).lineBetween(385,505,895,505)
    const chapter=this.add.text(640,170,'',{fontFamily:'Arial',fontSize:'15px',color:'#a95a5e',letterSpacing:4}).setOrigin(.5)
    const title=this.add.text(640,260,'',{fontFamily:'Georgia',fontSize:'31px',color:'#eee1d2',align:'center',wordWrap:{width:650}}).setOrigin(.5)
    const body=this.add.text(640,375,'',{fontFamily:'Arial',fontSize:'18px',color:'#c7b9af',align:'center',lineSpacing:12,wordWrap:{width:650}}).setOrigin(.5)
    const count=this.add.text(410,535,'',{fontFamily:'Georgia',fontSize:'15px',color:'#806e68'}).setOrigin(0,.5)
    const next=this.add.text(830,535,'다음',{fontFamily:'Arial',fontSize:'17px',color:'#fff',backgroundColor:'#562d33',padding:{x:24,y:12}}).setOrigin(.5).setInteractive({useHandCursor:true})
    const render=()=>{
      const current=pages[page]
      chapter.setText(current.chapter)
      title.setText(current.title)
      body.setText(current.body).setY(page===2?395:375)
      count.setText(`${page+1} / ${pages.length}`)
      next.setText(page===pages.length-1?'봉인 수호자의 무기고로':'다음')
    }
    next.on('pointerdown',()=>{
      if(page<pages.length-1){
        page++
        this.cameras.main.flash(90,55,25,28)
        render()
      }else{
        this.storyPanel.setVisible(false)
        this.controlsPanel.setVisible(true)
      }
    })
    this.storyPanel=this.add.container(0,0,[bg,ornament,chapter,title,body,count,next]).setScrollFactor(0).setDepth(250)
    render()
  }

  startWave() {
    this.weaponVisual.setVisible(true)
    this.cameras.main.startFollow(this.player, true, .09, .09)
    this.wave++
    this.waveStarted = this.time.now
    this.lastSpawn = 0
    this.instruction.setText('작전 개시 · 울부짖는 천사상 세 기를 [E]로 깨우십시오')
    this.time.delayedCall(2200, () => this.instruction.setText(''))
  }

  updateMission(_time: number) {
    this.statueInteractPrompt.setVisible(false)
    if (this.missionPhase === 'seals') {
      let nearest: Phaser.GameObjects.Container | undefined
      let nearestDistance = Infinity
      for (const node of this.sealNodes) {
        if (node.getData('activated')) continue
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y)
        if (distance < nearestDistance) { nearest = node; nearestDistance = distance }
      }
      this.activeSeal = nearestDistance < 125 ? nearest : undefined
      if(this.activeSeal){
        this.statueInteractPrompt.setPosition(this.activeSeal.x,this.activeSeal.y-150).setVisible(true)
      }
      if (this.activeSeal && this.keys.E.isDown) {
        this.isChannelingSeal = true
        this.player.setVelocity(0)
        this.interactProgress += this.game.loop.delta
        this.statueInteractPrompt.setText(`각성 중  ${Math.min(100,Math.round(this.interactProgress/12))}%`)
        this.instruction.setText(`천사의 의식 회복 중 ${Math.min(100, Math.round(this.interactProgress / 12))}%`)
        if (this.interactProgress >= 1200) {
          const completedStatue=this.activeSeal
          this.activateSeal(completedStatue)
          return
        }
      } else {
        this.isChannelingSeal = false
        this.interactProgress = 0
        this.statueInteractPrompt.setText('상호 작용  E')
        if (this.activeSeal) this.instruction.setText('[E]를 길게 눌러 울부짖는 천사를 깨우기')
      }
    } else if (this.missionPhase === 'slaughter') {
      if (this.enemiesKilled >= 2000) {
        this.missionPhase = 'boss'
        this.enemies.getChildren().forEach(o=>{const e=o as Phaser.Physics.Arcade.Sprite;e.getData('shadow')?.destroy();e.getData('contactShadow')?.destroy()})
        this.enemies.clear(true,true)
        this.instruction.setText('2000마리 처리 완료 · 중앙 문지기가 출현합니다')
      }
    } else if (this.missionPhase === 'extract') {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.extraction.x, this.extraction.y) < 105) this.playExitSequence()
    }
  }

  activateSeal(node: Phaser.GameObjects.Container) {
    if(node.getData('activated'))return
    node.setData('activated', true)
    this.isChannelingSeal = false
    this.activeSeal = undefined
    this.statueInteractPrompt.setVisible(false).setText('상호 작용  E')
    this.invulnerableUntil=this.time.now+2400
    this.isPaused=false
    this.physics.resume()
    this.player.body!.enable=true
    this.player.setActive(true).setVelocity(0).setAlpha(1)
    this.sealsActivated++
    this.interactProgress = 0
    const aura = node.list[0] as Phaser.GameObjects.Ellipse
    const statue = node.getData('statue') as Phaser.GameObjects.Image
    const tears = node.getData('tears') as Phaser.GameObjects.Ellipse[]
    const waves = node.getData('waves') as Phaser.GameObjects.Ellipse[]
    aura.setFillStyle(0x8ffff0,.18).setStrokeStyle(4,0xd9fff7,.9)
    statue.setTint(0xe8fff9)
    tears.forEach(tear=>tear.setVisible(false))
    waves.forEach(wave=>wave.setStrokeStyle(3,0xd8fff6,.48))
    ;(node.list[6] as Phaser.GameObjects.Rectangle).setVisible(true)
    ;(node.getData('hpBar') as Phaser.GameObjects.Rectangle).setVisible(true)
    ;(node.list[8] as Phaser.GameObjects.Text).setText('깨어난 천사 · 성광 지원').setColor('#cafff2')
    this.awakenedStatues.push(node)
    const restingScaleX=statue.scaleX,restingScaleY=statue.scaleY
    this.tweens.add({targets:statue,y:-28,scaleX:restingScaleX*1.18,scaleY:restingScaleY*1.18,duration:330,yoyo:true,ease:'Back.Out'})
    for(let i=0;i<4;i++) this.time.delayedCall(i*90,()=>{
      const halo=this.add.ellipse(node.x,node.y+16,70,24).setStrokeStyle(4,0xcafff3,.85).setDepth(30)
      this.tweens.add({targets:halo,scaleX:3.2,scaleY:2.2,alpha:0,duration:520,onComplete:()=>halo.destroy()})
    })
    let banished=0
    ;[...this.enemies.getChildren()].forEach(o=>{
      const enemy=o as Phaser.Physics.Arcade.Sprite
      if(!enemy.active||Phaser.Math.Distance.Between(node.x,node.y,enemy.x,enemy.y)>620)return
      banished++
      this.enemiesKilled++
      ;(enemy.getData('shadow') as Phaser.GameObjects.Ellipse|undefined)?.destroy()
      ;(enemy.getData('contactShadow') as Phaser.GameObjects.Ellipse|undefined)?.destroy()
      enemy.destroy()
    })
    const sanctuary=this.add.ellipse(node.x,node.y,120,42,0xbaffeb,.12).setStrokeStyle(8,0xeafffa,.9).setDepth(65)
    this.tweens.add({targets:sanctuary,scaleX:10,scaleY:8,alpha:0,duration:520,ease:'Expo.Out',onComplete:()=>sanctuary.destroy()})
    this.possession = Math.max(0, this.possession - 8)
    this.instruction.setText(`천사 각성 완료 · ${this.sealsActivated}/3 · 주변 악마 ${banished}마리 추방`)
    for (let i=0;i<3;i++) this.time.delayedCall(i*220,()=>{if(['seals','slaughter'].includes(this.missionPhase))this.spawnEnemy()})
    if (this.sealsActivated === this.sealNodes.length) {
      this.missionPhase = 'slaughter'
      this.instruction.setText('퀘스트 2 개방 · 악마 2000마리를 처리하십시오')
    }
  }

  update(time: number) {
    if (!this.gameStarted) return
    if(this.cinematicPaused)return
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.togglePause()
    if (this.isPaused) return
    if(this.physics.world.isPaused)this.physics.resume()
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.useMedicine()
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.dodgeUntil = time + 280

    let dx = (this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0)
    let dy = (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0) - (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0)
    const v = new Phaser.Math.Vector2(dx, dy).normalize().scale(220 * this.speedMultiplier() * (time < this.dodgeUntil ? 2.1 : 1))
    this.player.setVelocity(v.x, v.y)
    this.player.setAlpha(time < this.dodgeUntil ? .55 : 1)
    this.updatePlayerAnimation(time, v)

    if (['seals','slaughter'].includes(this.missionPhase) && time - this.lastSpawn > 21 && this.enemies.countActive() < 210) { this.spawnEnemy(); this.lastSpawn = time }
    if (this.missionPhase === 'boss' && !this.bossActive) this.spawnBoss()
    this.updateMission(time)
    this.updateEnemies(time)
    this.updateAwakenedStatues(time)
    this.updateBoss(time)
    this.updateGrounding(time)
    this.updateWeaponVisual(time)
    this.redrawHud()
    if (this.possession >= 100) this.endGame(false)
  }

  updatePlayerAnimation(time: number, velocity: Phaser.Math.Vector2) {
    if (time < this.dodgeUntil && time - this.lastDodgeAfterimage > 55) {
      this.lastDodgeAfterimage = time
      const ghost = this.add.image(this.player.x, this.player.y, 'guardianUnarmed', this.player.frame.name)
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

  updateGrounding(_time:number) {
    this.player.setDepth(20 + this.player.y / 30)
    const playerAnim=this.player.anims.currentAnim?.key??''
    const playerFrame=this.player.anims.currentFrame?.index??0
    const playerStride=playerAnim==='guardian-run'?Math.sin(playerFrame*Math.PI*.5)*3:0
    const playerAction=playerAnim==='guardian-slash'||playerAnim==='guardian-parry'
    this.playerShadow.setPosition(this.player.x+playerStride,this.player.y+(playerAction?27:31)).setDepth(this.player.depth-1)
      .setDisplaySize(playerAction?47:42+(playerAnim==='guardian-run'?Math.abs(playerStride)*1.4:0),playerAction?10:12)
      .setAlpha(playerAction ? .34 : .38)
    this.playerContactShadow.setPosition(this.player.x+playerStride*.7,this.player.y+(playerAction?25:29)).setDepth(this.player.depth-.5)
      .setDisplaySize(playerAction?32:27,playerAction?6:7).setAlpha(this.player.alpha*.76)
    const moveBossShadow=(actor:Phaser.Physics.Arcade.Sprite,shadow:Phaser.GameObjects.Ellipse)=>{
      const anim=actor.anims.currentAnim?.key??''
      const frame=actor.anims.currentFrame?.index??0
      const attack=anim==='boss-attack'
      const progress=attack?Phaser.Math.Clamp((frame-1)/3,0,1):0
      const stride=anim==='boss-walk'?Math.sin(frame*Math.PI*.5)*7:0
      shadow.setVisible(actor.visible).setPosition(actor.x+stride+(attack?(actor.flipX?-1:1)*progress*12:0),actor.y+72+progress*9).setDepth(actor.depth-1)
        .setDisplaySize(140*(1+(attack?Math.sin(progress*Math.PI)*.18:Math.abs(stride)*.003)),34*(1-progress*.2)).setAlpha(actor.alpha*.4)
    }
    if (this.boss.visible) {
      this.boss.setDepth(20 + this.boss.y / 30)
      moveBossShadow(this.boss,this.bossShadow)
      const frame=this.boss.anims.currentFrame?.index??0
      const spread=this.boss.anims.currentAnim?.key==='boss-attack'?46+Math.sin(frame*Math.PI*.5)*8:42
      this.bossContactShadows.forEach((s,i)=>s.setVisible(true).setPosition(this.boss.x+(i?1:-1)*spread,this.boss.y+69+(i?1:-1)*2).setDepth(this.boss.depth-.5).setAlpha(this.boss.alpha*.72))
    }
    if(this.bossClone?.visible){
      this.bossClone.setDepth(20+this.bossClone.y/30)
      const cloneShadow=this.bossClone.getData('shadow') as Phaser.GameObjects.Ellipse|undefined
      if(cloneShadow)moveBossShadow(this.bossClone,cloneShadow)
      const contacts=this.bossClone.getData('contactShadows') as Phaser.GameObjects.Ellipse[]|undefined
      const frame=this.bossClone.anims.currentFrame?.index??0
      const spread=this.bossClone.anims.currentAnim?.key==='boss-attack'?46+Math.sin(frame*Math.PI*.5)*8:42
      contacts?.forEach((s,i)=>s.setPosition(this.bossClone!.x+(i?1:-1)*spread,this.bossClone!.y+69+(i?1:-1)*2).setDepth(this.bossClone!.depth-.5).setAlpha(this.bossClone!.alpha*.72))
    }
    this.enemies.getChildren().forEach(o => {
      const e = o as Phaser.Physics.Arcade.Sprite
      const shadow = e.getData('shadow') as Phaser.GameObjects.Ellipse | undefined
      const contact=e.getData('contactShadow') as Phaser.GameObjects.Ellipse|undefined
      if (shadow) {
        const climbing=e.getData('climbing')===true
        const anim=e.anims.currentAnim?.key??''
        const frame=e.anims.currentFrame?.index??0
        const stride=Math.sin(frame*Math.PI*.5)*(climbing?5:3)
        const attacking=anim==='demon-attack'
        shadow.setPosition(e.x+stride,e.y+(climbing?17:attacking?23:27)).setDepth(e.depth-1)
          .setDisplaySize(climbing?59:attacking?50:43+Math.abs(stride),climbing?9:attacking?9:12)
          .setAlpha(e.alpha*(climbing ? .25 : attacking ? .32 : .36))
        contact?.setPosition(e.x+stride*.7,e.y+(climbing?15:attacking?21:25)).setDepth(e.depth-.5)
          .setDisplaySize(climbing?34:attacking?28:23,climbing?5:6).setAlpha(e.alpha*(climbing ? .55 : .7))
      }
    })
  }

  updateWeaponVisual(time: number) {
    const name = this.melee
    const key = `weapon-${name}`
    if (this.weaponVisual.texture.key !== key) this.weaponVisual.setTexture(key)
    const heights: Record<Melee, number> = { sword: 210, spear: 270 }
    this.weaponVisual.setDisplaySize(this.weaponVisual.width / this.weaponVisual.height * heights[name], heights[name])
    const side = this.player.flipX ? -1 : 1
    const wx=this.player.x+38*side
    const wy=this.player.y-30
    this.weaponVisual.setOrigin(.06,.94).setPosition(wx,wy)
      .setFlipX(false).setDepth(this.player.depth+1).setVisible(this.player.visible).setAlpha(.96)
    if(time>=this.weaponActionUntil)this.weaponVisual.setAngle(this.player.flipX?-64:-4)
  }

  powerMultiplier() { return this.possession < 20 ? 1 : this.possession < 50 ? 1.15 : this.possession < 80 ? 1.4 : Math.max(.55, 1.25 - (this.possession - 80) * .035) }
  speedMultiplier() { return this.possession < 20 ? 1 : this.possession < 50 ? 1.05 : this.possession < 80 ? 1.2 : Math.max(.58, 1.1 - (this.possession - 80) * .027) }
  possessionWeaponTier(){return Math.floor(this.possession/15)}
  attackSpeedMultiplier(){return this.melee==='sword'?1.5+this.possessionWeaponTier()*.2:1+this.possessionWeaponTier()*.1}
  meleeSwingDegrees(){return this.melee==='sword'?210+this.possessionWeaponTier()*10:270+this.possessionWeaponTier()*20}

  spawnEnemy() {
    let p=[this.player.x+300,this.player.y]
    for(let tries=0;tries<24;tries++) {
      const a=Phaser.Math.FloatBetween(0,Math.PI*2), distance=Phaser.Math.Between(300,620)
      const candidate=[Phaser.Math.Clamp(this.player.x+Math.cos(a)*distance,80,MAP_W-80),Phaser.Math.Clamp(this.player.y+Math.sin(a)*distance,80,MAP_H-80)]
      if(this.isWalkable(candidate[0],candidate[1])) { p=candidate; break }
    }
    const e = this.enemies.create(p[0], p[1], 'demonMotion', 0) as Phaser.Physics.Arcade.Sprite
    e.setDisplaySize(88, 88).setData('hp', 16).setData('nextHit', 0).setDepth(18).setTint(0xe1ced0)
    e.setData('born', this.time.now)
    e.setData('climbing',false).setData('nextClaw',0)
    e.setData('shadow',this.add.ellipse(e.x,e.y+27,43,12,0x000000,.36).setDepth(17))
    e.setData('contactShadow',this.add.ellipse(e.x,e.y+25,23,6,0x000000,.7).setDepth(18))
    e.body!.setSize(120, 72).setOffset(97, 221)
    e.play('demon-run')
  }

  updateEnemies(time: number) {
    this.enemies.getChildren().forEach(o => {
      const e = o as Phaser.Physics.Arcade.Sprite
      if (!e.active) return
      const livingStatues=this.awakenedStatues.filter(s=>s.active&&s.getData('hp')>0)
      const nearestStatue=livingStatues.sort((a,b)=>Phaser.Math.Distance.Between(e.x,e.y,a.x,a.y)-Phaser.Math.Distance.Between(e.x,e.y,b.x,b.y))[0]
      const statueDistance=nearestStatue?Phaser.Math.Distance.Between(e.x,e.y,nearestStatue.x,nearestStatue.y):Infinity
      const playerDistance=Phaser.Math.Distance.Between(e.x,e.y,this.player.x,this.player.y)
      const target:Phaser.GameObjects.Container|Phaser.Physics.Arcade.Sprite=nearestStatue&&statueDistance<playerDistance*1.15?nearestStatue:this.player
      const tx=target===this.player?this.player.x:nearestStatue.x, ty=target===this.player?this.player.y:nearestStatue.y
      const angle=Phaser.Math.Angle.Between(e.x,e.y,tx,ty)
      const climbing=!this.isWalkable(e.x,e.y)
      const moveSpeed=(75+this.wave*8)*(climbing ? .72 : 1)
      e.setVelocity(Math.cos(angle)*moveSpeed,Math.sin(angle)*moveSpeed)
      if(climbing){
        e.setData('climbing',true).setDisplaySize(106,66).setAngle(Math.sin(time*.018+e.x*.01)*7).setTint(0xb98a8c)
        e.play('demon-run',true)
        if(time>e.getData('nextClaw')){
          e.setData('nextClaw',time+Phaser.Math.Between(150,240))
          const side=Phaser.Math.Between(-1,1)*14
          const scratch=this.add.graphics().setDepth(e.depth-1)
          scratch.lineStyle(2,0xc1675d,.38)
          for(let i=-1;i<=1;i++) scratch.lineBetween(e.x-Math.cos(angle)*18-Math.sin(angle)*(side+i*5),e.y-Math.sin(angle)*18+Math.cos(angle)*(side+i*5),e.x-Math.cos(angle)*39-Math.sin(angle)*(side+i*5),e.y-Math.sin(angle)*39+Math.cos(angle)*(side+i*5))
          this.tweens.add({targets:scratch,alpha:0,duration:420,onComplete:()=>scratch.destroy()})
        }
      }else if(e.getData('climbing')){
        e.setData('climbing',false).setDisplaySize(88,88).setAngle(0).setTint(0xe1ced0).play('demon-run',true)
      }
      e.setDepth(12 + e.y / 40)
      e.setFlipX(e.body!.velocity.x < 0)
      const attackDistance=target===this.player?54:76
      if (Phaser.Math.Distance.Between(e.x,e.y,tx,ty) < attackDistance && time > e.getData('nextHit')) {
        e.setData('nextHit', time + 1050)
        e.setVelocity(0)
        e.play('demon-attack', true)
        const tell = this.add.circle(e.x, e.y, 34, 0xd83f49, .18).setStrokeStyle(3, 0xff5963, .8).setDepth(16)
        this.tweens.add({ targets: tell, scale: .35, duration: 240, ease: 'Cubic.In', onComplete: () => tell.destroy() })
        this.tweens.add({ targets: e, scaleX: e.scaleX * .88, scaleY: e.scaleY * 1.14, y: e.y - 8, duration: 130, yoyo: true })
        this.time.delayedCall(250, () => {
          if (!e.active) return
          this.tweens.add({ targets: e, x: e.x + (tx - e.x) * .42, y: e.y + (ty - e.y) * .42, duration: 90, yoyo: true })
          if(target===this.player) {
            if (Phaser.Math.Distance.Between(e.x,e.y,this.player.x,this.player.y)<76) this.playerHit(e,5)
          } else if(nearestStatue.active&&Phaser.Math.Distance.Between(e.x,e.y,nearestStatue.x,nearestStatue.y)<105) {
            const harmless=this.add.text(nearestStatue.x,nearestStatue.y-70,'IMMUNE',{fontFamily:'Arial',fontSize:'11px',color:'#baffeb'}).setOrigin(.5).setDepth(40)
            this.tweens.add({targets:harmless,y:'-=18',alpha:0,duration:300,onComplete:()=>harmless.destroy()})
          }
          this.time.delayedCall(180, () => { if (e.active) e.play('demon-run', true) })
        })
      }
    })
  }

  spawnBoss() {
    this.bossActive = true
    this.bossHp = 300; this.purification = 0; this.executable = false
    this.showNarrativeModal('울부짖는 천사','문지기를 나에게 데려오라','내 성광은 악마의 육체를 태울 수 있다.\n문지기의 공격을 견디며 이곳까지 유인하라.','닫기',()=>{
      this.boss.setPosition(1600,1500).setVisible(true).setActive(true).setAlpha(0).setAngle(0).play('boss-idle')
      this.boss.setData('nextAttack',this.time.now+1300).setData('attackCount',0).setData('actionUntil',0)
      this.tweens.add({targets:this.boss,alpha:1,y:1550,duration:700,ease:'Back.Out'})
      this.instruction.setText('빙의된 문지기 · 공격을 패링해 공포를 채우십시오')
    })
  }

  updateBoss(time: number) {
    if (!this.bossActive || this.executable) return
    for(const actor of this.activeBosses())this.updateSingleBoss(actor,time)
  }

  activeBosses(){return [this.boss,this.bossClone].filter((b):b is Phaser.Physics.Arcade.Sprite=>!!b&&b.active&&b.visible)}

  updateSingleBoss(actor:Phaser.Physics.Arcade.Sprite,time:number){
    if(time<(actor.getData('actionUntil')??0)){
      actor.setVelocity(0)
      return
    }
    const statue=this.awakenedStatues.filter(s=>s.active&&s.getData('hp')>0).sort((a,b)=>Phaser.Math.Distance.Between(actor.x,actor.y,a.x,a.y)-Phaser.Math.Distance.Between(actor.x,actor.y,b.x,b.y))[0]
    const playerD=Phaser.Math.Distance.Between(actor.x,actor.y,this.player.x,this.player.y)
    const statueD=statue?Phaser.Math.Distance.Between(actor.x,actor.y,statue.x,statue.y):Infinity
    const target=statue&&statueD<playerD*.9?statue:this.player
    const tx=target.x,ty=target.y,d=Phaser.Math.Distance.Between(actor.x,actor.y,tx,ty)
    if(d>150){const a=Phaser.Math.Angle.Between(actor.x,actor.y,tx,ty);actor.setVelocity(Math.cos(a)*92,Math.sin(a)*92).play('boss-walk',true)}else actor.setVelocity(0).play('boss-idle',true)
    actor.setFlipX(tx<actor.x)
    if(time<=actor.getData('nextAttack'))return
    if(d>190)return
    const bossAttackSpeed=1
    actor.setData('nextAttack',time+2100/bossAttackSpeed)
    actor.setData('actionUntil',time+920)
    const count=(actor.getData('attackCount')??0)+1;actor.setData('attackCount',count)
    const parryable=true
    const attackId=(actor.getData('attackId')??0)+1
    actor.setData('attackId',attackId).setData('currentAttackParryable',parryable)
      .setData('parryOpenAt',time+330).setData('parryCloseAt',time+920)
    this.showAttackTelegraph(actor,parryable,tx,ty)
    this.time.delayedCall(850,()=>{
      if(!actor.active||this.executable)return
      if(actor.getData('parriedAttackId')===attackId)return
      if(target!==this.player){const targetStatue=target as Phaser.GameObjects.Container;if(targetStatue.active&&Phaser.Math.Distance.Between(actor.x,actor.y,targetStatue.x,targetStatue.y)<190)this.damageStatue(targetStatue,45);return}
      if(!parryable){for(let i=0;i<8;i++)this.fireEnemyShot(actor,i*Math.PI/4);return}
      if(Phaser.Math.Distance.Between(actor.x,actor.y,this.player.x,this.player.y)<190){
        if(this.time.now>=this.dodgeUntil&&this.time.now>=this.invulnerableUntil&&!this.isChannelingSeal){this.purification=Math.max(0,this.purification-30);this.playerHit(undefined,25)}
      }
    })
  }

  showAttackTelegraph(actor:Phaser.Physics.Arcade.Sprite,parryable:boolean,tx:number,ty:number) {
    actor.setVelocity(0).setAngle(0).play('boss-attack',true)
    const cue = this.add.text(actor.x, actor.y - 115, parryable ? 'NEUTRALIZE' : 'DODGE', {
      fontFamily: 'Georgia', fontSize: '17px', fontStyle: 'bold', color: parryable ? '#ffe19a' : '#d8a8ff',
      backgroundColor: '#09080dcc', padding: { x: 9, y: 5 }
    }).setOrigin(.5).setDepth(40)
    const windup=this.add.text(actor.x,actor.y+88,'도끼 강타',{fontFamily:'Arial',fontSize:'13px',color:parryable?'#ffe6a0':'#d8a8ff',backgroundColor:'#09080dcc',padding:{x:7,y:3}}).setOrigin(.5).setDepth(40)
    this.tweens.add({targets:actor,x:actor.x+(tx-actor.x)*.18,y:actor.y+(ty-actor.y)*.18,duration:760,ease:'Cubic.In'})
    this.time.delayedCall(760,()=>{if(parryable)actor.setTint(0xffd36a);this.cameras.main.shake(100,.006)})
    this.time.delayedCall(900,()=>{cue.destroy();windup.destroy();actor.setTint(0xc5aaa8).setAngle(0);if(actor.active&&!this.executable)actor.play('boss-idle',true)})
  }

  fireEnemyShot(actor:Phaser.Physics.Arcade.Sprite,a: number) {
    const s = this.enemyShots.create(actor.x,actor.y,'enemyShot') as Phaser.Physics.Arcade.Sprite
    s.setVelocity(Math.cos(a) * 210, Math.sin(a) * 210).setDepth(25)
    this.time.delayedCall(3500, () => s.destroy())
  }

  attack(x: number, y: number) {
    if (this.time.now - this.lastAttack < 330/this.attackSpeedMultiplier()) return
    this.lastAttack = this.time.now
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, x, y)
    this.aimAngle = angle
    this.player.setFlipX(x < this.player.x)
    this.playerActionUntil = this.time.now + 320
    this.weaponActionUntil = this.time.now + 320
    this.player.play('guardian-slash', true)
    const swingDirection=this.nextMeleeSwing
    this.nextMeleeSwing*=-1
    const swingDegrees=this.meleeSwingDegrees()
    const halfSwing=Phaser.Math.DegToRad(swingDegrees/2)
    const weaponStart=Phaser.Math.RadToDeg(angle-swingDirection*halfSwing)+58
    const weaponEnd=Phaser.Math.RadToDeg(angle+swingDirection*halfSwing)+58
    this.weaponVisual.setAngle(weaponStart)
    this.tweens.add({ targets: this.weaponVisual, angle:weaponEnd, duration:265, ease:'Cubic.Out' })
    const range = this.melee === 'spear' ? 240 : 188
    const damage = (this.melee === 'spear' ? 28 : 24) * this.meleeLevel * this.powerMultiplier()
    const slash = this.add.graphics().setDepth(30)
    const originX=this.player.x,originY=this.player.y-18
    const visualHalf=Math.min(halfSwing,Math.PI-.015),arcStart=angle-visualHalf,arcEnd=angle+visualHalf
    slash.fillStyle(0x82d4cf,.065).beginPath().moveTo(originX,originY).arc(originX,originY,range,arcStart,arcEnd).closePath().fillPath()
    slash.lineStyle(this.melee==='spear'?16:22,0x7cc2bd,.12).beginPath().arc(originX,originY,range*.72,arcStart,arcEnd).strokePath()
    slash.lineStyle(this.melee==='spear'?8:12,0xc7f1e8,.28).beginPath().arc(originX,originY,range*.9,arcStart,arcEnd).strokePath()
    slash.lineStyle(3,0xfff0d8,.72).beginPath().arc(originX,originY,range,arcStart,arcEnd).strokePath()
    this.tweens.add({targets:slash,alpha:0,duration:260,ease:'Cubic.Out',onComplete:()=>slash.destroy()})
    for(const boss of this.activeBosses()){
      const bossInFront=Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(this.player.x,this.player.y,boss.x,boss.y)-angle))<halfSwing
      if(bossInFront&&Phaser.Math.Distance.Between(this.player.x,this.player.y,boss.x,boss.y)<range+55){if(this.executable)this.executeBoss();else this.damageBoss(damage*.32)}
    }
    this.enemies.getChildren().forEach(o => {
      const e=o as Phaser.Physics.Arcade.Sprite
      const targetAngle=Phaser.Math.Angle.Between(this.player.x,this.player.y,e.x,e.y)
      const inFront=Math.abs(Phaser.Math.Angle.Wrap(targetAngle-angle))<halfSwing
      if(inFront&&Phaser.Math.Distance.Between(this.player.x,this.player.y,e.x,e.y)<range)this.damageEnemy(e,damage)
    })
  }

  updateAwakenedStatues(time:number) {
    for(const statue of this.awakenedStatues) {
      if(!statue.active||statue.getData('hp')<=0||time<statue.getData('nextShot')) continue
      const targets=this.enemies.getChildren().map(o=>o as Phaser.Physics.Arcade.Sprite).filter(e=>e.active&&Phaser.Math.Distance.Between(statue.x,statue.y,e.x,e.y)<520).sort((a,b)=>Phaser.Math.Distance.Between(statue.x,statue.y,a.x,a.y)-Phaser.Math.Distance.Between(statue.x,statue.y,b.x,b.y)).slice(0,10)
      const bossTargets=this.activeBosses().filter(b=>Phaser.Math.Distance.Between(statue.x,statue.y,b.x,b.y)<620)
      if(!targets.length&&!bossTargets.length)continue
      statue.setData('nextShot',time+660/this.attackSpeedMultiplier())
      const angel=statue.getData('statue') as Phaser.GameObjects.Sprite
      angel.setFlipX(false).setAngle(0).play('angel-statue-attack',true)
      this.time.delayedCall(235,()=>{
        if(!statue.active)return
        targets.forEach(target=>{if(target.active){this.statueLightning(target,false);this.damageEnemy(target,36)}})
        bossTargets.forEach(target=>{if(target.active&&!this.executable){this.statueLightning(target,true);this.damageBoss(36)}})
      })
      this.time.delayedCall(510,()=>{if(statue.active)angel.setFrame(0).setFlipX(false).setAngle(0)})
    }
  }

  statueLightning(target:Phaser.Physics.Arcade.Sprite,isBoss:boolean){
    const ratio=isBoss?Math.max(1.8,target.displayHeight/88):Math.max(.75,target.displayHeight/88)
    const height=(isBoss?250:145)*ratio,width=(isBoss?52:24)*ratio
    const bolt=this.add.graphics().setDepth(75)
    let px=target.x+Phaser.Math.FloatBetween(-width*.25,width*.25),py=target.y-height
    const points=7
    for(let i=1;i<=points;i++){
      const nx=i===points?target.x:target.x+Phaser.Math.FloatBetween(-width,width)
      const ny=target.y-height+(height/points)*i
      bolt.lineStyle((isBoss?13:7)*ratio,0xffe99a,.16).lineBetween(px,py,nx,ny)
      bolt.lineStyle((isBoss?4:2.5)*ratio,0xfff8c9,.96).lineBetween(px,py,nx,ny)
      if(isBoss&&i>2&&i<points){const branchX=nx+Phaser.Math.FloatBetween(-70,70)*ratio;bolt.lineStyle(3*ratio,0xffed91,.72).lineBetween(nx,ny,branchX,ny+Phaser.Math.Between(25,55)*ratio)}
      px=nx;py=ny
    }
    const impact=this.add.star(target.x,target.y,8,8*ratio,25*ratio,0xfff0a6,.82).setDepth(76)
    this.tweens.add({targets:[bolt,impact],alpha:0,scaleX:1.12,scaleY:1.12,duration:isBoss?320:210,onComplete:()=>{bolt.destroy();impact.destroy()}})
    if(isBoss)this.cameras.main.shake(130,.006)
  }

  damageStatue(statue:Phaser.GameObjects.Container,amount:number) {
    const hp=Math.max(0,statue.getData('hp')-amount)
    statue.setData('hp',hp)
    ;(statue.getData('hpBar') as Phaser.GameObjects.Rectangle).setScale(hp/180,1)
    const angel=statue.getData('statue') as Phaser.GameObjects.Image
    angel.setTint(0xff7b76)
    this.time.delayedCall(100,()=>{if(statue.active)angel.setTint(0xe8fff9)})
    if(hp>0)return
    statue.setActive(false)
    angel.setTint(0x3c3438).setAngle(12)
    ;(statue.list[8] as Phaser.GameObjects.Text).setText('침묵한 천사').setColor('#8f7d7d')
    const ash=this.add.rectangle(statue.x,statue.y,115,12,0x262126,.65).setDepth(30).setAngle(-12)
    this.tweens.add({targets:ash,scaleX:2.4,alpha:0,duration:650,onComplete:()=>ash.destroy()})
  }

  parry() {
    const now=this.time.now
    this.parryUntil = now + 240
    this.playerActionUntil = this.time.now + 430
    this.weaponActionUntil = this.time.now + 430
    this.player.play('guardian-parry', true)
    const side=this.player.flipX?-1:1
    const guardX=this.player.x+side*46,guardY=this.player.y-38,verticalAngle=-32
    this.weaponVisual.setPosition(guardX,guardY).setOrigin(.06,.94).setAngle(verticalAngle)
    const guard=this.add.image(guardX,guardY,`weapon-${this.melee}`).setOrigin(.06,.94).setDisplaySize(this.weaponVisual.displayWidth,this.weaponVisual.displayHeight).setAngle(verticalAngle).setTint(0xfff3c2).setDepth(this.player.depth+8)
    this.tweens.add({targets:guard,alpha:0,scaleX:1.08,scaleY:1.08,duration:330,onComplete:()=>guard.destroy()})
    this.player.setTint(0xe8cf8b)
    this.time.delayedCall(250, () => this.player.setTint(0xd0bbb5))
    const boss=this.activeBosses().find(actor=>{
      const attackFrame=actor.anims.currentFrame?.index??0
      const facingError=Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(this.player.x,this.player.y,actor.x,actor.y)-this.aimAngle))
      return actor.anims.currentAnim?.key==='boss-attack'&&attackFrame>=3&&facingError<1.15&&
      actor.getData('parriedAttackId')!==actor.getData('attackId')&&
      Phaser.Math.Distance.Between(actor.x,actor.y,this.player.x,this.player.y)<235
    })
    if(boss){
      boss.setData('parriedAttackId',boss.getData('attackId'))
      this.successfulParry(boss)
    }
  }

  enableBossTestMode() {
    if(!this.gameStarted||this.bossActive||this.missionPhase==='extract')return
    this.sealNodes.forEach(node=>{if(!node.getData('activated'))this.activateSeal(node)})
    this.sealsActivated=3
    this.enemiesKilled=2000
    this.enemies.getChildren().forEach(o=>{const e=o as Phaser.Physics.Arcade.Sprite;e.getData('shadow')?.destroy();e.getData('contactShadow')?.destroy()})
    this.enemies.clear(true,true)
    this.missionPhase='boss'
    this.lastSpawn=this.time.now
    this.instruction.setText('TEST MODE · 선행 퀘스트 완료 · 문지기 호출')
  }

  successfulParry(actor:Phaser.Physics.Arcade.Sprite) {
    this.purification = Math.min(100, this.purification + 18)
    this.cameras.main.shake(100, .006)
    actor.setVelocity((actor.x-this.player.x)*3,(actor.y-this.player.y)*3)
    const burst = this.add.star((this.player.x+actor.x)/2,(this.player.y+actor.y)/2,8,8,34,0xffe2a1,.95).setDepth(60)
    this.tweens.add({ targets: burst, alpha: 0, scale: 2.2, angle: 45, duration: 220, onComplete: () => burst.destroy() })
    this.instruction.setText(`중화 성공 · 악성 중화율 ${Math.round(this.purification)}%`)
    this.time.delayedCall(700, () => { if (!this.executable) this.instruction.setText('') })
    if (this.purification >= 100) this.makeExecutable('악성이 완전히 중화되었습니다')
  }

  neutralizeEnemy(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!enemy.active) return
    this.enemiesKilled++
    this.possession = Math.max(0, this.possession - 4)
    enemy.disableBody(true, false).setTint(0xb9fff0).play('demon-death', true)
    const halo = this.add.circle(enemy.x, enemy.y, 18, 0xaaffea, .25).setStrokeStyle(5, 0xd9fff6, .95).setDepth(70)
    const seal = this.add.star(enemy.x, enemy.y, 8, 12, 31, 0xeafff8, .9).setDepth(71)
    this.tweens.add({ targets: [halo, seal], scale: 2.8, alpha: 0, angle: 80, duration: 420, onComplete: () => { halo.destroy(); seal.destroy() } })
    this.tweens.add({ targets: enemy, alpha: 0, y: enemy.y - 28, duration: 450, onComplete: () => { (enemy.getData('shadow') as Phaser.GameObjects.Ellipse | undefined)?.destroy();(enemy.getData('contactShadow') as Phaser.GameObjects.Ellipse|undefined)?.destroy();enemy.destroy() } })
    this.instruction.setText('악성 중화 성공 · 빙의율 4% 감소')
    this.time.delayedCall(700, () => { if (!this.executable) this.instruction.setText('') })
  }

  playerHit(source?: Phaser.Physics.Arcade.Sprite, amount = 10) {
    if(this.isChannelingSeal)return
    if(this.time.now<this.invulnerableUntil)return
    if (this.time.now < this.dodgeUntil) return
    if (this.time.now < this.parryUntil && source) { this.neutralizeEnemy(source); return }
    this.possession = Math.min(100, this.possession + amount)
    this.cameras.main.shake(150, .008)
    this.tweens.killTweensOf(this.player)
    this.player.setDisplaySize(92, 92).setTint(0xb92f3b)
    this.time.delayedCall(180, () => { if (this.player.active) this.player.setTint(0xd0bbb5).setDisplaySize(92, 92) })
    this.playerActionUntil = this.time.now + 240
    const knockAngle = source ? Phaser.Math.Angle.Between(source.x, source.y, this.player.x, this.player.y) : Phaser.Math.FloatBetween(0, Math.PI * 2)
    this.tweens.add({ targets: this.player, x: this.player.x + Math.cos(knockAngle) * 9, y: this.player.y + Math.sin(knockAngle) * 9, duration: 65, yoyo: true, ease: 'Quad.Out' })
  }

  damageEnemy(e: Phaser.Physics.Arcade.Sprite, n: number) {
    e.setData('hp', e.getData('hp') - n)
    e.setTint(0xffffff); this.time.delayedCall(80, () => e.setTint(e.getData('climbing')?0xb98a8c:0xe1ced0))
    if (e.getData('hp') <= 0) {
      this.enemiesKilled++
      e.disableBody(true, false)
      e.play('demon-death', true)
      this.enemyDeathBurst(e)
    } else {
      this.tweens.add({ targets: e, x: e.x + (e.x - this.player.x) * .1, duration: 85, ease: 'Quad.Out' })
    }
  }

  enemyDeathBurst(e:Phaser.Physics.Arcade.Sprite) {
    const x=e.x,y=e.y
    this.cameras.main.shake(75,.0035)
    const base=Phaser.Math.Angle.Between(this.player.x,this.player.y,x,y)+Phaser.Math.FloatBetween(-.28,.28)
    const flash=this.add.ellipse(x,y,72,34,0xe14a45,.66).setRotation(base).setDepth(77)
    this.tweens.add({targets:flash,scaleX:1.65,scaleY:.72,alpha:0,duration:125,ease:'Quad.Out',onComplete:()=>flash.destroy()})

    // 짧은 직선 대신 크기와 궤적이 다른 방울을 흩뿌려 유기적인 비산감을 만든다.
    for(let i=0;i<30;i++) {
      const a=base+Phaser.Math.FloatBetween(-.82,.82)
      const distance=Phaser.Math.Between(72,285)
      const lateral=Phaser.Math.Between(-52,52)
      const size=Phaser.Math.Between(3,8)
      const drop=this.add.ellipse(
        x+Phaser.Math.Between(-12,12),y+Phaser.Math.Between(-12,12),
        size*Phaser.Math.FloatBetween(2.2,4.4),size,
        i%6===0?0xe04a46:i%3===0?0x6b111b:0xa91f2b,
        Phaser.Math.FloatBetween(.72,.96)
      ).setRotation(a).setDepth(76)
      const startX=drop.x,startY=drop.y
      const progress={value:0}
      this.tweens.add({
        targets:progress,value:1,duration:Phaser.Math.Between(260,560),ease:'Cubic.Out',
        onUpdate:()=>{
          const t=progress.value
          drop.setPosition(
            startX+Math.cos(a)*distance*t-Math.sin(a)*lateral*Math.sin(Math.PI*t),
            startY+Math.sin(a)*distance*t+Math.cos(a)*lateral*Math.sin(Math.PI*t)
          )
          drop.setRotation(a+lateral*.009*Math.sin(Math.PI*t)).setScale(1-.38*t).setAlpha(.92*(1-t*t))
        },
        onComplete:()=>drop.destroy()
      })
    }
    for(let i=0;i<7;i++) {
      const size=Phaser.Math.Between(8,20)
      const blot=this.add.polygon(
        x+Phaser.Math.Between(-24,24),y+Phaser.Math.Between(-20,20),
        [0,-size*.35,size*.65,-size*.18,size,.12,size*.28,size*.38,-size*.48,size*.25,-size*.72,-.05],
        i%3?0x72131d:0xb12830,Phaser.Math.FloatBetween(.42,.66)
      ).setRotation(Phaser.Math.FloatBetween(0,Math.PI*2)).setDepth(75)
      this.tweens.add({targets:blot,scaleX:Phaser.Math.FloatBetween(1.35,2),scaleY:Phaser.Math.FloatBetween(.8,1.3),alpha:0,duration:Phaser.Math.Between(300,540),ease:'Sine.Out',onComplete:()=>blot.destroy()})
    }
    this.tweens.add({targets:e,x:x+Math.cos(base)*70,y:y+Math.sin(base)*70,scaleX:e.scaleX*2.2,scaleY:e.scaleY*.18,alpha:0,duration:165,ease:'Expo.Out',onComplete:()=>{(e.getData('shadow') as Phaser.GameObjects.Ellipse|undefined)?.destroy();(e.getData('contactShadow') as Phaser.GameObjects.Ellipse|undefined)?.destroy();e.destroy()}})
  }

  damageBoss(n: number) {
    if (!this.bossActive || this.executable) return
    this.bossHp = Math.max(0, this.bossHp - n)
    this.activeBosses().forEach(b=>b.setTint(0xffffff));this.time.delayedCall(80,()=>this.activeBosses().forEach(b=>b.setTint(0xc5aaa8)))
    if (this.bossHp <= 0) this.makeExecutable('육체가 무너졌습니다')
  }

  makeExecutable(reason: string) {
    this.executable = true
    this.activeBosses().forEach(b=>{
      b.setVelocity(0).setTint(0x6d151b).stop().setFrame(13)
      this.tweens.add({targets:b,scaleY:b.scaleY*.88,y:b.y+12,duration:420,ease:'Back.Out'})
      this.add.circle(b.x,b.y-15,9,0xff1515).setStrokeStyle(4,0xffffff).setDepth(50).setName('weakpoint')
    })
    this.instruction.setText(`${reason} · 붉은 핵에 근접 공격으로 처형하십시오`)
  }

  executeBoss() {
    if(!this.bossActive)return
    this.children.getAll('name','weakpoint').forEach(o=>o.destroy())
    if(this.bossPhase===1){
      this.bossPhase=2;this.executable=false;this.bossHp=300;this.purification=0
      this.boss.setTint(0xc5aaa8).setScale(261/313).setPosition(1510,1530).setFrame(0).play('boss-idle',true).setData('nextAttack',this.time.now+1100).setData('attackCount',0).setData('actionUntil',0)
      this.bossClone=this.physics.add.sprite(1690,1530,'bossMotion',0).setDisplaySize(261,261).setDepth(20).setImmovable(true).setTint(0xc5aaa8).play('boss-idle')
      this.bossClone.body!.setSize(380,300).setOffset(180,400)
      this.bossClone.setData('nextAttack',this.time.now+1500).setData('attackCount',0).setData('actionUntil',0)
      this.bossClone.setData('shadow',this.add.ellipse(1690,1605,162,51,0x000000,.62).setDepth(18))
      this.bossClone.setData('contactShadows',[this.add.ellipse(1648,1601,48,11,0x000000,.72),this.add.ellipse(1732,1603,48,11,0x000000,.72)].map(s=>s.setDepth(19)))
      this.physics.add.collider(this.bossClone,this.walls)
      this.physics.add.collider(this.player,this.bossClone)
      this.cameras.main.shake(500,.014)
      this.showNarrativeModal('울부짖는 천사','분노가 문지기를 둘로 갈랐다','두 육체 모두를 나에게 데려오라.\n내 번개로 문지기의 분노를 불태우겠다.','닫기',()=>this.instruction.setText('두 문지기를 각성한 천사상으로 유인하십시오'))
      return
    }
    this.bossActive=false
    for(const b of this.activeBosses()){
      b.setActive(false).setFrame(15)
      for(let i=0;i<34;i++){const a=Phaser.Math.FloatBetween(0,Math.PI*2),d=Phaser.Math.Between(90,260);const blood=this.add.rectangle(b.x,b.y,Phaser.Math.Between(22,75),Phaser.Math.Between(3,9),i%4?0x8e1723:0xe34b45,.9).setOrigin(0,.5).setRotation(a).setDepth(80);this.tweens.add({targets:blood,x:b.x+Math.cos(a)*d,y:b.y+Math.sin(a)*d,scaleX:2.4,alpha:0,duration:Phaser.Math.Between(260,520),onComplete:()=>blood.destroy()})}
      this.tweens.add({targets:b,alpha:0,scaleX:b.scaleX*1.8,scaleY:b.scaleY*.3,duration:420,onComplete:()=>b.setVisible(false)})
      ;(b.getData('shadow') as Phaser.GameObjects.Ellipse|undefined)?.destroy()
      ;(b.getData('contactShadows') as Phaser.GameObjects.Ellipse[]|undefined)?.forEach(s=>s.destroy())
    }
    this.time.delayedCall(430,()=>{this.bossShadow.setVisible(false);this.bossContactShadows.forEach(s=>s.setVisible(false))})
    this.cameras.main.shake(650,.018)
    this.missionPhase = 'extract'
    this.extraction.setVisible(true)
    this.instruction.setText('목표 제거 완료 · 시작 지점의 탈출 구역으로 복귀하십시오')
  }

  useMedicine() {
    if (this.medicine <= 0 || this.possession <= 0) return
    this.medicine--; this.possession = Math.max(0, this.possession - 25)
    this.player.setTint(0x9ee8d0); this.time.delayedCall(450, () => this.player.setTint(0xd0bbb5))
  }

  redrawHud() {
    const color = this.possession < 50 ? 0xd8cdbf : this.possession < 80 ? 0xe44a43 : 0x7c1b32
    this.possessionBar.clear().fillStyle(0x17151a, .95).fillRoundedRect(30, 48, 360, 22, 5).fillStyle(color).fillRoundedRect(34, 52, 352 * this.possession / 100, 14, 4)
    this.statusText.setText(`빙의율 ${Math.round(this.possession)}%   공격 속도 x${this.attackSpeedMultiplier().toFixed(1)}   신성한 약 ${this.medicine}/3   무기 ${this.melee.toUpperCase()}${this.bossActive?`   공포 ${Math.round(this.purification)}%`:''}`)
    this.bossBar.clear()
    if (this.bossActive) {
      this.bossBar.fillStyle(0x17151a, .95).fillRoundedRect(440, 25, 400, 50, 7)
        .fillStyle(0xb5353b).fillRect(450,37,380*this.bossHp/300,9)
        .fillStyle(0x8de6cf).fillRect(450, 55, 380 * this.purification / 100, 7)
    }
    const done=this.missionPhase==='seals'?0:this.missionPhase==='slaughter'?1:2
    const mark=(index:number)=>index<done?'✓':index===done?'▶':'○'
    this.objectiveText.setText(`QUESTS\n${mark(0)} 1. 울부짖는 천사 각성  ${this.sealsActivated}/3\n${mark(1)} 2. 악마 섬멸  ${Math.min(this.enemiesKilled,2000)}/2000${this.missionPhase==='boss'?'\n\n▶ 중앙 문지기 처형':this.missionPhase==='extract'?'\n\n✓ 보스 처형 · 탈출 지점 복귀':''}`)
    this.drawRadar()
    const vignette = document.querySelector<HTMLDivElement>('#vignette')!
    vignette.style.opacity = String(Math.max(0, (this.possession - 55) / 45))
  }

  drawRadar() {
    const x=1080, y=28, size=168
    this.radar.clear().fillStyle(0x080a0d,.9).fillRoundedRect(x,y,size,size,8).lineStyle(2,0x8b7968,.65).strokeRoundedRect(x,y,size,size,8)
    const dot=(wx:number,wy:number,color:number,r=4)=>this.radar.fillStyle(color,1).fillCircle(x+wx/MAP_W*size,y+wy/MAP_H*size,r)
    this.radar.lineStyle(1,0x6d5d55,.25).lineBetween(x+size/2,y+4,x+size/2,y+size-4).lineBetween(x+4,y+size/2,x+size-4,y+size/2)
    for (const node of this.sealNodes) dot(node.x,node.y,node.getData('activated')?0x75e3c6:0xf05c61,5)
    if (this.missionPhase === 'boss') dot(1600,1550,0xffb24c,7)
    if(this.bossPhase===2&&this.bossClone?.active)dot(this.bossClone.x,this.bossClone.y,0xff754c,7)
    if (this.missionPhase === 'extract') dot(this.extraction.x,this.extraction.y,0x8ffff0,7)
    this.enemies.getChildren().slice(0,25).forEach(o=>{const e=o as Phaser.Physics.Arcade.Sprite;if(e.active)dot(e.x,e.y,0xa93b43,2)})
    dot(this.player.x,this.player.y,0xffffff,4)
  }

  playExitSequence() {
    if(this.exitSequenceStarted)return
    this.exitSequenceStarted=true
    this.gameStarted=false
    this.player.setVelocity(0).play('guardian-run',true)
    this.weaponVisual.setVisible(false)
    this.physics.pause()
    this.extraction.setVisible(false)
    this.instruction.setText('철수 중 · 지옥문을 봉쇄합니다')
    this.cameras.main.stopFollow()
    this.cameras.main.pan(this.hellGate.x,this.hellGate.y-35,620,'Sine.easeInOut')
    this.tweens.add({targets:this.player,x:400,y:3055,alpha:.08,duration:980,ease:'Sine.In',onComplete:()=>this.player.setVisible(false)})
    this.gateClosed.setVisible(true).setAlpha(0).setScale(.88,1)
    this.tweens.add({targets:this.gateOpen,alpha:0,scaleX:.9,duration:520,delay:510,ease:'Cubic.In'})
    this.tweens.add({targets:this.gateClosed,alpha:1,scaleX:1,duration:560,delay:510,ease:'Cubic.Out'})
    this.tweens.add({targets:this.gateGlow,scaleX:.18,scaleY:.5,alpha:0,duration:520,delay:650,ease:'Cubic.In'})
    this.time.delayedCall(1080,()=>{
      this.cameras.main.shake(260,.012)
      const sealFlash=this.add.ellipse(this.hellGate.x,this.hellGate.y,190,86,0xff8b63,.55).setDepth(118)
      this.tweens.add({targets:sealFlash,scaleX:1.35,scaleY:.4,alpha:0,duration:360,onComplete:()=>sealFlash.destroy()})
    })
    this.time.delayedCall(1680,()=>this.endGame(true))
  }

  endGame(win: boolean) {
    if(win){
      if(this.endingShown)return
      this.endingShown=true
      this.weaponVisual.setVisible(false)
      this.showNarrativeModal('봉인 기록 · 첫 번째 문','첫 번째 문이 닫혔다','울부짖던 악마들의 소리가 멀어지고, 갈라진 대지가 다시 맞물린다.\n첫 번째 지옥문이 성공적으로 닫혔다. 그러나 순례는 아직 끝나지 않았다.','닫기',()=>this.scene.restart())
      return
    }
    this.gameStarted = false
    this.weaponVisual.setVisible(false)
    this.physics.pause()
    if (!win) {
      this.isPaused=true
      this.player.setVelocity(0).setAlpha(.3).setTint(0x6f1d29)
      ;(this.pausePanel.getByName('pauseTitle') as Phaser.GameObjects.Text).setText('VESSEL LOST').setColor('#d34248')
      ;(this.pausePanel.getByName('pauseContinue') as Phaser.GameObjects.Text).setVisible(false).disableInteractive()
      this.pausePanel.setVisible(true)
      return
    }
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
