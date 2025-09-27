diff --git a//dev/null b/game.js
index 0000000000000000000000000000000000000000..6fb83f728a48e7844054063b3deeddfb9884e0b0 100644
--- a//dev/null
+++ b/game.js
@@ -0,0 +1,336 @@
+/*
+ * Flappy Beer - Phaser 3 implementation
+ * -------------------------------------
+ * A lightweight Flappy Bird clone featuring a beer bottle hero.
+ * The code is intentionally well-commented to make future tweaks simple.
+ */
+
+const GAME_WIDTH = 288;
+const GAME_HEIGHT = 512;
+const PIPE_SPEED = -160; // pixels per second
+const PIPE_GAP = 120; // vertical gap between pipes
+const PIPE_DELAY = 1500; // milliseconds between pipe pairs
+const STORAGE_KEY = 'flappy-beer-best-score';
+
+class FlappyBeerScene extends Phaser.Scene {
+  constructor() {
+    super('FlappyBeerScene');
+  }
+
+  preload() {
+    // Load all assets from the assets/ directory.
+    this.load.image('background', 'assets/bg.png');
+    this.load.image('pipe', 'assets/pipe.png');
+    this.load.image('beer', 'assets/beer.png');
+  }
+
+  create() {
+    this.gameWidth = this.scale.width;
+    this.gameHeight = this.scale.height;
+
+    // A tile sprite allows us to create the illusion of an infinite scrolling background.
+    this.background = this.add
+      .tileSprite(0, 0, this.gameWidth, this.gameHeight, 'background')
+      .setOrigin(0, 0);
+
+    // Group that will hold our pipe sprites.
+    this.pipes = this.physics.add.group();
+
+    // Create the beer bottle player sprite and fine-tune its physics body.
+    this.player = this.physics.add.sprite(this.gameWidth * 0.25, this.gameHeight * 0.5, 'beer');
+    this.player.setCollideWorldBounds(true);
+    this.player.body.allowGravity = false; // gravity is enabled only after the first tap.
+    this.player.setOrigin(0.5, 0.5);
+    this.player.body.setSize(this.player.width * 0.6, this.player.height * 0.85);
+    this.player.body.setOffset((this.player.width - this.player.body.width) / 2, (this.player.height - this.player.body.height) / 2);
+
+    // Give the bird a gentle idle animation while waiting to start.
+    this.playerIdleTween = this.tweens.add({
+      targets: this.player,
+      y: this.player.y + 8,
+      duration: 800,
+      yoyo: true,
+      repeat: -1,
+      ease: 'Sine.easeInOut'
+    });
+
+    // Score setup.
+    this.score = 0;
+    this.bestScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
+    this.scoreText = this.add
+      .text(this.gameWidth / 2, 40, '0', {
+        fontFamily: 'Arial',
+        fontSize: '32px',
+        color: '#ffffff',
+        stroke: '#000000',
+        strokeThickness: 4
+      })
+      .setOrigin(0.5, 0.5);
+
+    this.bestScoreText = this.add
+      .text(this.gameWidth / 2, 80, `Best: ${this.bestScore}`, {
+        fontFamily: 'Arial',
+        fontSize: '18px',
+        color: '#ffffff',
+        stroke: '#000000',
+        strokeThickness: 3
+      })
+      .setOrigin(0.5, 0.5);
+
+    // On-screen prompts for starting and restarting.
+    this.instructionsText = this.add
+      .text(this.gameWidth / 2, this.gameHeight * 0.55, 'Tap or press SPACE\n to start pouring!', {
+        fontFamily: 'Arial',
+        fontSize: '20px',
+        align: 'center',
+        color: '#ffffff',
+        stroke: '#000000',
+        strokeThickness: 4
+      })
+      .setOrigin(0.5, 0.5);
+
+    this.gameOverText = this.add
+      .text(this.gameWidth / 2, this.gameHeight * 0.4, 'Game Over', {
+        fontFamily: 'Arial Black',
+        fontSize: '36px',
+        color: '#ffedaa',
+        stroke: '#8b4513',
+        strokeThickness: 6
+      })
+      .setOrigin(0.5, 0.5)
+      .setVisible(false);
+
+    this.restartPromptText = this.add
+      .text(this.gameWidth / 2, this.gameHeight * 0.55, '', {
+        fontFamily: 'Arial',
+        fontSize: '20px',
+        align: 'center',
+        color: '#ffffff',
+        stroke: '#000000',
+        strokeThickness: 4
+      })
+      .setOrigin(0.5, 0.5)
+      .setVisible(false);
+
+    // Flags to manage game state.
+    this.isGameRunning = false;
+    this.hasStarted = false;
+    this.isGameOver = false;
+
+    // Input handling for both mouse/touch and keyboard.
+    this.input.on('pointerdown', this.handleInput, this);
+    this.input.keyboard.on('keydown-SPACE', this.handleInput, this);
+
+    // Collision detection between the player and pipes.
+    this.physics.add.overlap(this.player, this.pipes, this.handlePipeCollision, null, this);
+  }
+
+  update(time, delta) {
+    // Scroll the background while the game is running.
+    if (this.isGameRunning) {
+      this.background.tilePositionX += (Math.abs(PIPE_SPEED) * delta) / 1000;
+    }
+
+    if (!this.isGameOver) {
+      // Tilt the beer bottle based on its vertical speed.
+      const velocityY = this.player.body.velocity.y;
+      const targetAngle = Phaser.Math.Clamp((velocityY / 300) * 90, -25, 90);
+      this.player.setRotation(Phaser.Math.DegToRad(targetAngle));
+    }
+
+    // Manually handle ground collision (bottom edge of the canvas).
+    if (!this.isGameOver && this.hasStarted && this.player.y >= this.gameHeight - this.player.height * 0.5) {
+      this.gameOver();
+    }
+
+    // Destroy pipes that have moved off-screen and update score.
+    this.pipes.getChildren().forEach((pipe) => {
+      if (!pipe.active) {
+        return;
+      }
+      if (pipe.getData('isTop') && !pipe.getData('scored') && pipe.x + pipe.width / 2 < this.player.x) {
+        pipe.setData('scored', true);
+        this.incrementScore();
+      }
+      if (pipe.x + pipe.width < -50) {
+        pipe.destroy();
+      }
+      if (!this.isGameRunning) {
+        pipe.body.setVelocityX(0);
+      }
+    });
+  }
+
+  handleInput() {
+    if (!this.isGameRunning) {
+      if (!this.hasStarted) {
+        this.startGame();
+      } else if (this.isGameOver) {
+        this.restartGame();
+        return;
+      }
+    }
+
+    if (this.isGameRunning) {
+      this.flap();
+    }
+  }
+
+  startGame() {
+    this.hasStarted = true;
+    this.isGameRunning = true;
+    this.isGameOver = false;
+
+    // Remove idle animation and enable gravity.
+    if (this.playerIdleTween) {
+      this.playerIdleTween.stop();
+      this.playerIdleTween.remove();
+      this.playerIdleTween = null;
+    }
+    this.player.body.allowGravity = true;
+    this.player.setVelocity(0, 0);
+
+    this.instructionsText.setVisible(false);
+    this.restartPromptText.setVisible(false);
+    this.gameOverText.setVisible(false);
+
+    // Start spawning pipes.
+    this.spawnTimer = this.time.addEvent({
+      delay: PIPE_DELAY,
+      callback: this.spawnPipes,
+      callbackScope: this,
+      loop: true
+    });
+
+    this.flap();
+  }
+
+  restartGame() {
+    // Reset state and clean up.
+    this.pipes.clear(true, true);
+    this.score = 0;
+    this.scoreText.setText('0');
+    this.player.setTint(0xffffff);
+    this.player.setVelocity(0, 0);
+    this.player.setRotation(0);
+    this.player.setPosition(this.gameWidth * 0.25, this.gameHeight * 0.5);
+    this.player.body.allowGravity = false;
+
+    this.bestScoreText.setText(`Best: ${this.bestScore}`);
+
+    this.isGameRunning = false;
+    this.hasStarted = false;
+    this.isGameOver = false;
+
+    if (this.spawnTimer) {
+      this.spawnTimer.remove(false);
+      this.spawnTimer = null;
+    }
+
+    this.instructionsText.setText('Tap or press SPACE\n to start pouring!');
+    this.instructionsText.setVisible(true);
+    this.gameOverText.setVisible(false);
+    this.restartPromptText.setVisible(false);
+
+    // Restore the idle tween.
+    this.playerIdleTween = this.tweens.add({
+      targets: this.player,
+      y: this.player.y + 8,
+      duration: 800,
+      yoyo: true,
+      repeat: -1,
+      ease: 'Sine.easeInOut'
+    });
+  }
+
+  flap() {
+    this.player.setVelocityY(-260);
+    this.player.setRotation(Phaser.Math.DegToRad(-22));
+  }
+
+  spawnPipes() {
+    const pipeX = this.gameWidth + 50;
+    const centerY = Phaser.Math.Between(120, this.gameHeight - 120);
+    const topPipeY = centerY - PIPE_GAP / 2;
+    const bottomPipeY = centerY + PIPE_GAP / 2;
+
+    const topPipe = this.pipes.create(pipeX, topPipeY, 'pipe');
+    topPipe.setOrigin(0.5, 1);
+    topPipe.body.allowGravity = false;
+    topPipe.setImmovable(true);
+    topPipe.body.setVelocityX(PIPE_SPEED);
+    topPipe.setData('isTop', true);
+    topPipe.setData('scored', false);
+
+    const bottomPipe = this.pipes.create(pipeX, bottomPipeY, 'pipe');
+    bottomPipe.setOrigin(0.5, 0);
+    bottomPipe.body.allowGravity = false;
+    bottomPipe.setImmovable(true);
+    bottomPipe.body.setVelocityX(PIPE_SPEED);
+    bottomPipe.setData('isTop', false);
+  }
+
+  handlePipeCollision() {
+    this.gameOver();
+  }
+
+  gameOver() {
+    if (this.isGameOver) {
+      return;
+    }
+
+    this.isGameRunning = false;
+    this.isGameOver = true;
+
+    if (this.spawnTimer) {
+      this.spawnTimer.remove(false);
+      this.spawnTimer = null;
+    }
+
+    // Stop pipes in place.
+    this.pipes.getChildren().forEach((pipe) => {
+      pipe.body.setVelocityX(0);
+    });
+
+    this.player.setTint(0xff9f80);
+
+    // Update best score and save it.
+    if (this.score > this.bestScore) {
+      this.bestScore = this.score;
+      localStorage.setItem(STORAGE_KEY, String(this.bestScore));
+    }
+
+    this.bestScoreText.setText(`Best: ${this.bestScore}`);
+
+    this.gameOverText.setVisible(true);
+    this.restartPromptText.setText(`Score: ${this.score}\nTap to play again`);
+    this.restartPromptText.setVisible(true);
+  }
+
+  incrementScore() {
+    this.score += 1;
+    this.scoreText.setText(String(this.score));
+  }
+}
+
+const config = {
+  type: Phaser.AUTO,
+  parent: 'game-container',
+  width: GAME_WIDTH,
+  height: GAME_HEIGHT,
+  backgroundColor: '#4ec0ca',
+  physics: {
+    default: 'arcade',
+    arcade: {
+      gravity: { y: 900 },
+      debug: false
+    }
+  },
+  scale: {
+    mode: Phaser.Scale.FIT,
+    autoCenter: Phaser.Scale.CENTER_BOTH
+  },
+  scene: [FlappyBeerScene]
+};
+
+new Phaser.Game(config);
