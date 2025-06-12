        /* ================================
         *  Enhanced Retro Racer
         * ================================*/

        // ----- Canvas Setup -----
        const canvas = document.getElementById("game");
        const ctx = canvas.getContext("2d");

        // Scale the canvas up using CSS for a chunky pixel look
        const PIXEL_SCALE = 1.2;
        canvas.style.width = canvas.width * PIXEL_SCALE + "px";
        canvas.style.height = canvas.height * PIXEL_SCALE + "px";

        // ----- Game State -----
        let gameState = "title"; // "title", "practice", "multiplayer"
        let myPlayerIndex = -1;
        let isHost = false;
        let roomId = null;
        let socket = null;
        let connected = false;
        let singlePlayerMode = false;
        let waitingForPlayer = false;

        // Soccer game state
        let scoreP1 = 0;
        let scoreP2 = 0;
        // Celebration state
        let celebrating = false;
        let confetti = [];
        let celebrateTimer = 0;
        const CELEBRATION_MS = 1500;

        // Remote player inputs
        let remoteInputs = {};

        // ----- Input Handling -----
        const keys = {};
        window.addEventListener("keydown", (e) => {
            keys[e.code] = true;
            if (e.code === "Escape" && (gameState === "practice" || gameState === "multiplayer")) {
                returnToTitle();
            }
        });
        window.addEventListener("keyup", (e) => (keys[e.code] = false));

        // ----- WebSocket Connection -----
        function initWebSocket() {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${location.host}`;
            
            socket = new WebSocket(wsUrl);
            
            socket.onopen = () => {
                console.log('Connected to server');
                connected = true;
                updateConnectionStatus('Connected');
                if (!singlePlayerMode) {
                    joinRoom();
                }
            };
            
            socket.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                handleServerMessage(msg);
            };
            
            socket.onclose = () => {
                console.log('Disconnected from server');
                connected = false;
                updateConnectionStatus('Disconnected - Reconnecting...');
                setTimeout(initWebSocket, 2000);
            };
            
            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                updateConnectionStatus('Connection Error');
            };
        }

        function sendMessage(msg) {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(msg));
            }
        }

        function handleServerMessage(msg) {
            switch (msg.type) {
                case 'joinAck':
                    myPlayerIndex = msg.playerIndex;
                    isHost = myPlayerIndex === 0;
                    updatePlayerCount(myPlayerIndex + 1);
                    updateConnectionStatus(`Connected as Player ${myPlayerIndex + 1}`);
                    
                    if (msg.gameState) {
                        scoreP1 = msg.gameState.scoreP1;
                        scoreP2 = msg.gameState.scoreP2;
                        celebrating = msg.gameState.celebrating;
                        
                        Object.assign(ball, msg.gameState.ball);
                        Object.assign(player, msg.gameState.player1);
                        Object.assign(player2, msg.gameState.player2);
                    }
                    break;
                    
                case 'playerJoined':
                    updatePlayerCount(msg.totalPlayers);
                    if (msg.totalPlayers === 2) {
                        if (singlePlayerMode && waitingForPlayer) {
                            // Transition from single player to multiplayer
                            transitionToMultiplayer();
                        } else if (isHost) {
                            document.getElementById('multiplayerButton').style.display = 'block';
                        }
                    }
                    break;
                    
                case 'playerLeft':
                    updatePlayerCount(msg.totalPlayers);
                    document.getElementById('multiplayerButton').style.display = 'none';
                    if (gameState === 'multiplayer') {
                        // Return to practice mode if other player leaves
                        transitionToPractice();
                    }
                    break;
                    
                case 'playerInput':
                    if (msg.playerIndex !== myPlayerIndex) {
                        remoteInputs = msg.input;
                    }
                    break;
                    
                case 'stateUpdate':
                    if (!isHost && gameState === 'multiplayer') {
                        const state = msg.state;
                        scoreP1 = state.scoreP1;
                        scoreP2 = state.scoreP2;
                        celebrating = state.celebrating;
                        
                        Object.assign(ball, state.ball);
                        Object.assign(player, state.player1);
                        Object.assign(player2, state.player2);
                    }
                    break;
                    
                case 'gameStarted':
                    startMultiplayer();
                    break;
                    
                case 'roomFull':
                    updateConnectionStatus('Room is full');
                    break;
            }
        }

        function joinRoom() {
            const params = new URLSearchParams(location.search);
            roomId = params.get('room') || generateRoomId();
            
            if (!params.get('room')) {
                const newUrl = `${location.pathname}?room=${roomId}`;
                history.replaceState({}, '', newUrl);
            }
            
            document.getElementById('roomId').textContent = roomId;
            sendMessage({ type: 'join', roomId: roomId });
        }

        function generateRoomId() {
            return Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        function updateConnectionStatus(status) {
            document.getElementById('connectionStatus').textContent = status;
        }

        function updatePlayerCount(count) {
            document.getElementById('playerCountValue').textContent = count;
        }

        function invitePlayer() {
            if (!roomId) {
                // Create room for multiplayer
                joinRoom();
                waitingForPlayer = true;
                updateGameMode('Waiting for Player...');
            }
            
            const url = `${location.origin}${location.pathname}?room=${roomId}`;
            if (navigator.share) {
                navigator.share({
                    title: 'Join my Car Ball game!',
                    text: 'Come play Car Ball with me!',
                    url: url
                });
            } else {
                navigator.clipboard.writeText(url).then(() => {
                    alert('Invite link copied to clipboard!\nShare it with a friend to play together.');
                }).catch(() => {
                    prompt('Share this link with a friend:', url);
                });
            }
        }

        function updateGameMode(mode) {
            document.getElementById('gameMode').textContent = mode;
        }

        function transitionToMultiplayer() {
            singlePlayerMode = false;
            waitingForPlayer = false;
            gameState = 'multiplayer';
            updateGameMode('Multiplayer Mode');
            
            // Reset positions for multiplayer
            player.x = 100;
            player.y = canvas.height / 2;
            player.vx = 0;
            player.vy = 0;
            player.heading = 0;
            
            player2.x = canvas.width - 100;
            player2.y = canvas.height / 2;
            player2.vx = 0;
            player2.vy = 0;
            player2.heading = Math.PI;
            
            resetBall();
            scoreP1 = 0;
            scoreP2 = 0;
        }

        function transitionToPractice() {
            singlePlayerMode = true;
            waitingForPlayer = false;
            gameState = 'practice';
            updateGameMode('Practice Mode');
            
            // Reset to single player position
            player.x = canvas.width / 2;
            player.y = canvas.height / 2;
            player.vx = 0;
            player.vy = 0;
            player.heading = -Math.PI / 2;
            
            resetBall();
        }

        // Send input to server
        setInterval(() => {
            if (connected && gameState === "multiplayer") {
                const input = {
                    forward: keys['KeyW'] || keys['ArrowUp'],
                    back: keys['KeyS'] || keys['ArrowDown'],
                    left: keys['KeyA'] || keys['ArrowLeft'],
                    right: keys['KeyD'] || keys['ArrowRight'],
                    brake: keys['Space']
                };
                sendMessage({ type: 'input', input: input });
            }
        }, 50);

        // ----- UI Functions -----
        function startSinglePlayer() {
            singlePlayerMode = true;
            gameState = "practice";
            myPlayerIndex = 0;
            isHost = true;
            
            document.getElementById("titleScreen").classList.add("hidden");
            document.getElementById("gameUI").style.display = "flex";
            updateGameMode('Practice Mode');
            
            // Position player in center for practice
            player.x = canvas.width / 2;
            player.y = canvas.height / 2;
            player.vx = 0;
            player.vy = 0;
            player.heading = -Math.PI / 2;
            
            resetBall();
            scoreP1 = 0;
            scoreP2 = 0;
        }

        function startMultiplayer() {
            if (isHost) {
                sendMessage({ type: 'startGame' });
            }
            singlePlayerMode = false;
            gameState = "multiplayer";
            updateGameMode('Multiplayer Mode');
            
            if (document.getElementById("titleScreen").classList.contains("hidden")) {
                // Already in game, just transition
                transitionToMultiplayer();
            } else {
                // Starting from title screen
                document.getElementById("titleScreen").classList.add("hidden");
                document.getElementById("gameUI").style.display = "flex";
            }
        }

        function returnToTitle() {
            gameState = "title";
            singlePlayerMode = false;
            waitingForPlayer = false;
            roomId = null;
            document.getElementById("titleScreen").classList.remove("hidden");
            document.getElementById("gameUI").style.display = "none";
            
            // Reset car positions
            player.x = 100;
            player.y = canvas.height / 2;
            player.vx = 0;
            player.vy = 0;
            player.heading = 0;
            
            player2.x = canvas.width - 100;
            player2.y = canvas.height / 2;
            player2.vx = 0;
            player2.vy = 0;
            player2.heading = Math.PI;
            
            resetBall();
            scoreP1 = 0;
            scoreP2 = 0;
        }

        function updateUI() {
            document.getElementById("topP1").textContent = scoreP1;
            document.getElementById("topP2").textContent = scoreP2;
        }

        // ----- Enhanced Car with Drifting -----
        class Car {
            constructor(x, y, color, controls) {
                this.x = x;
                this.y = y;
                this.heading = -Math.PI / 2;

                // Physics
                this.vx = 0;
                this.vy = 0;
                this.acceleration = 0.08;
                this.maxSpeed = 4;
                this.friction = 0.03;
                this.turnSpeed = 0.05;
                
                // Drift mechanics
                this.gripLevel = 0.85; // How much car grips vs slides
                this.driftAmount = 0; // Visual drift indicator
                this.handbrake = false;
                // Dimensions for drawing
                this.w = 14; // car width
                this.h = 24; // car length

                this.color = color;
                this.controls = controls;
            }

            update() {
                if (gameState !== "practice" && gameState !== "multiplayer") return;

                // Get input based on game mode and player index
                let inputKeys;
                if (singlePlayerMode && this === player) {
                    // Single player mode - only player 1 is controlled
                    inputKeys = keys;
                } else if (gameState === "multiplayer") {
                    if (this === player && myPlayerIndex === 0) {
                        inputKeys = keys;
                    } else if (this === player2 && myPlayerIndex === 1) {
                        inputKeys = keys;
                    } else {
                        // Use remote inputs for the other player
                        inputKeys = {};
                        if (remoteInputs.forward) inputKeys[this.controls.forward] = true;
                        if (remoteInputs.back) inputKeys[this.controls.back] = true;
                        if (remoteInputs.left) inputKeys[this.controls.left] = true;
                        if (remoteInputs.right) inputKeys[this.controls.right] = true;
                        if (remoteInputs.brake) inputKeys[this.controls.brake] = true;
                    }
                } else {
                    // Player 2 in single player mode - no input
                    inputKeys = {};
                }

                // Capture previous handbrake state then update current
                const prevHandbrake = this.handbrake;
                this.handbrake = inputKeys[this.controls.brake];

                // === Convert world velocity to car-local coordinates ===
                const cos = Math.cos(this.heading);
                const sin = Math.sin(this.heading);
                let forward = this.vx * cos + this.vy * sin;      // velocity along heading
                let lateral = -this.vx * sin + this.vy * cos;     // sideways velocity (drift component)

                // === Throttle & Brake ===
                if (inputKeys[this.controls.forward]) forward += this.acceleration;
                if (inputKeys[this.controls.back])    forward -= this.acceleration * 0.8;

                // === Steering ===
                let steerInput = 0;
                if (inputKeys[this.controls.left])  steerInput = -1;
                else if (inputKeys[this.controls.right]) steerInput = 1;

                // Turn rate grows with speed for tighter feel
                let turnRate = steerInput * this.turnSpeed * (Math.abs(forward) / 2 + 0.3);
                if (forward < 0) turnRate = -turnRate; // invert steering when reversing
                this.heading += turnRate;

                // === Handbrake & Drift Physics ===
                const forwardFriction = 0.02;                        // always present
                const sideFriction = this.handbrake ? 0.03 : 0.3;     // VERY grippy unless handbrake pressed

                forward *= (1 - forwardFriction);
                lateral *= (1 - sideFriction);

                // Drift indicator based on lateral slip
                const slip = Math.abs(lateral);
                this.driftAmount = Math.min(slip * 25, 100);

                // --- Drift particle effects ---
                if (this.handbrake && slip > 0.4) {
                    // tyre marks
                    tyreMarks.push({ x: this.x, y: this.y, life: 200 });
                    // smoke
                    smoke.push({ x: this.x - cos*15, y: this.y - sin*15, vy: -0.5+Math.random()*-0.5, vx:(Math.random()-0.5)*0.5, life:60, alpha:1 });
                    // accumulate drift charge
                    this.driftCharge = (this.driftCharge || 0) + 1;
                    if (this.driftCharge > 60) {
                        // continuous sparks after holding drift > 1s
                        for (let s=0; s<2; s++) {
                            sparks.push({ x: this.x - cos*14, y: this.y - sin*14, vx:(Math.random()-0.5)*4, vy:(Math.random()-1.5)*4, life:30 });
                        }
                    }
                    // flame when boost ready
                    if(this.driftCharge > 60){
                        flames.push({ x: this.x - cos*18, y: this.y - sin*18, vx:-cos*0.2, vy:-sin*0.2, life:20, max:20 });
                    }
                } else {
                    // if we just released after long drift, give boost
                    if (prevHandbrake && !this.handbrake && (this.driftCharge||0) > 60) {
                        forward += 4; // boost
                        for(let f=0; f<30; f++){
                            flames.push({ x: this.x, y: this.y, vx:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*3, life:25, max:25 });
                        }
                    }
                    this.driftCharge = 0;
                }

                // === Convert back to world velocity ===
                this.vx =  cos * forward - sin * lateral;
                this.vy =  sin * forward + cos * lateral;

                // === Speed cap ===
                const speed = Math.hypot(this.vx, this.vy);
                if (speed > this.maxSpeed) {
                    this.vx *= this.maxSpeed / speed;
                    this.vy *= this.maxSpeed / speed;
                }

                // === Update position ===
                this.x += this.vx;
                this.y += this.vy;

                // Track / canvas bounds
                this.checkTrackBounds();
            }

            checkTrackBounds() {
                // Simple boundary check - slow down if hitting grass
                if (!this.isOnTrack()) {
                    this.vx *= 0.8;
                    this.vy *= 0.8;
                }
                
                // Keep in canvas bounds
                if (this.x < 20) { this.x = 20; this.vx = Math.abs(this.vx) * 0.5; }
                if (this.x > canvas.width - 20) { this.x = canvas.width - 20; this.vx = -Math.abs(this.vx) * 0.5; }
                if (this.y < 20) { this.y = 20; this.vy = Math.abs(this.vy) * 0.5; }
                if (this.y > canvas.height - 20) { this.y = canvas.height - 20; this.vy = -Math.abs(this.vy) * 0.5; }
            }

            isOnTrack() {
                // Whole canvas is playable field now
                return true;
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.heading);

                // Car body main
                ctx.fillStyle = this.color;
                ctx.fillRect(-this.h / 2, -this.w / 2, this.h, this.w);
                // Roof
                ctx.fillStyle = "#e57373";
                ctx.fillRect(-this.h/4, -this.w/4, this.h/2, this.w/2);
                // Front bumper
                ctx.fillStyle = "#b71c1c";
                ctx.fillRect(this.h/2-2, -this.w/2, 2, this.w);

                // Car details
                ctx.fillStyle = "#222";
                ctx.fillRect(2, -this.w / 2 + 2, this.h / 3, this.w - 4); // Windshield
                
                // Wheels
                ctx.fillStyle = "#111";
                ctx.fillRect(-this.h / 2 + 3, -this.w / 2 - 1, 4, 2);
                ctx.fillRect(-this.h / 2 + 3, this.w / 2 - 1, 4, 2);
                ctx.fillRect(this.h / 2 - 7, -this.w / 2 - 1, 4, 2);
                ctx.fillRect(this.h / 2 - 7, this.w / 2 - 1, 4, 2);

                // Drift effect
                if (this.driftAmount > 30) {
                    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                    for (let i = 0; i < 3; i++) {
                        ctx.fillRect(-this.h / 2 - 5 - i * 3, -2, 3, 1);
                    }
                }

                ctx.restore();
            }
        }

        // ----- Soccer Ball -----
        class Ball {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.radius = 12;
                this.vx = 0;
                this.vy = 0;
            }

            update() {
                // Apply friction
                this.vx *= 0.98;
                this.vy *= 0.98;

                // Update position
                this.x += this.vx;
                this.y += this.vy;

                // Bounce off field boundaries, allowing for goals
                const goalH = 120;
                const goalTop = (canvas.height - goalH) / 2;
                const goalBottom = goalTop + goalH;
                const inGoalMouthY = this.y > goalTop && this.y < goalBottom;

                if (this.x - this.radius < 20 && !inGoalMouthY) { this.x = 20 + this.radius; this.vx *= -0.6; }
                if (this.x + this.radius > canvas.width - 20 && !inGoalMouthY) { this.x = canvas.width - 20 - this.radius; this.vx *= -0.6; }
                if (this.y - this.radius < 20) { this.y = 20 + this.radius; this.vy *= -0.6; }
                if (this.y + this.radius > canvas.height - 20) { this.y = canvas.height - 20 - this.radius; this.vy *= -0.6; }
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
        }

        // ----- Field Drawing -----
        function drawField() {
            ctx.fillStyle = "#2d5a2d"; // grass
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Goal dimensions
            const goalH = 120;
            const goalDepth = 20;
            const goalTop = (canvas.height - goalH) / 2;
            const goalBottom = goalTop + goalH;
            const postWidth = 4;

            // === LEFT GOAL (Player 2 scores here) - OUTSIDE the field ===
            // Goal area background
            ctx.fillStyle = "rgba(198,40,40,0.3)";
            ctx.fillRect(0, goalTop, 20, goalH);
            
            // Goal posts (outside the boundary)
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, goalTop - postWidth, postWidth, postWidth); // top back post
            ctx.fillRect(0, goalBottom, postWidth, postWidth); // bottom back post
            ctx.fillRect(20 - postWidth, goalTop - postWidth, postWidth, postWidth); // top front post
            ctx.fillRect(20 - postWidth, goalBottom, postWidth, postWidth); // bottom front post
            
            // Goal crossbars
            ctx.fillRect(0, goalTop - postWidth, 20, postWidth); // top crossbar
            ctx.fillRect(0, goalBottom, 20, postWidth); // bottom crossbar

            // === RIGHT GOAL (Player 1 scores here) - OUTSIDE the field ===
            // Goal area background
            ctx.fillStyle = "rgba(41,98,255,0.3)";
            ctx.fillRect(canvas.width - 20, goalTop, 20, goalH);
            
            // Goal posts (outside the boundary)
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(canvas.width - postWidth, goalTop - postWidth, postWidth, postWidth); // top back post
            ctx.fillRect(canvas.width - postWidth, goalBottom, postWidth, postWidth); // bottom back post
            ctx.fillRect(canvas.width - 20, goalTop - postWidth, postWidth, postWidth); // top front post
            ctx.fillRect(canvas.width - 20, goalBottom, postWidth, postWidth); // bottom front post
            
            // Goal crossbars
            ctx.fillRect(canvas.width - 20, goalTop - postWidth, 20, postWidth); // top crossbar
            ctx.fillRect(canvas.width - 20, goalBottom, 20, postWidth); // bottom crossbar

            // Field lines (drawn after goals so they appear on top)
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 4;
            ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40); // outer lines

            // Halfway line
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 20);
            ctx.lineTo(canvas.width / 2, canvas.height - 20);
            ctx.stroke();

            // Center circle
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
            ctx.stroke();

            // === PENALTY AREAS (18-yard box) ===
            const penaltyWidth = 80;
            const penaltyHeight = 200;
            const penaltyTop = (canvas.height - penaltyHeight) / 2;
            
            // Left penalty area
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(20, penaltyTop, penaltyWidth, penaltyHeight);
            
            // Right penalty area  
            ctx.strokeRect(canvas.width - 20 - penaltyWidth, penaltyTop, penaltyWidth, penaltyHeight);
            
            // === GOAL AREAS (6-yard box) - Same width as goal ===
            const goalAreaWidth = 30;
            const goalAreaHeight = goalH; // Match the goal height exactly
            const goalAreaTop = goalTop; // Align with goal position
            
            // Left goal area
            ctx.strokeRect(20, goalAreaTop, goalAreaWidth, goalAreaHeight);
            
            // Right goal area
            ctx.strokeRect(canvas.width - 20 - goalAreaWidth, goalAreaTop, goalAreaWidth, goalAreaHeight);
        }

        // ----- Initialize Entities -----
        // Control maps
        const player1Controls = { forward:"KeyW", back:"KeyS", left:"KeyA", right:"KeyD", brake:"Space" };
        const player2Controls = { forward:"ArrowUp", back:"ArrowDown", left:"ArrowLeft", right:"ArrowRight", brake:"ShiftRight" };

        const player  = new Car(100, canvas.height / 2, "#c62828", player1Controls);
        const player2 = new Car(canvas.width - 100, canvas.height / 2, "#2962ff", player2Controls);

        const players = [player, player2];

        let ball = new Ball(canvas.width / 2, canvas.height / 2);

        function resetBall() {
            ball.x = canvas.width / 2;
            ball.y = canvas.height / 2;
            ball.vx = 0;
            ball.vy = 0;
        }

        function startCelebration(goalSide) {
            celebrating = true;
            celebrateTimer = 0;
            if(goalSide === "left") scoreP2 += 1; else scoreP1 += 1;
            updateUI();

            // push all cars away from goal direction
            players.forEach(car=>{
               car.vx = goalSide === "left" ? 1 : -1 * 10;
               car.vy = (Math.random()*2-1)*6;
            });

            // Confetti particles
            confetti = [];
            const originX = ball.x;
            const originY = ball.y;
            for (let i = 0; i < 150; i++) {
                confetti.push({
                    x: originX,
                    y: originY,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8 - 3,
                    color: `hsl(${Math.random()*360}, 80%, 60%)`,
                    life: Math.random() * 60 + 40
                });
            }
        }

        function detectGoal() {
            const goalWidth = 120;
            const goalHeight = 20;
            
            // Left goal (Player 2 scores)
            if (ball.x - ball.radius < goalHeight && 
                ball.y > canvas.height / 2 - goalWidth / 2 && 
                ball.y < canvas.height / 2 + goalWidth / 2) {
                scoreP2++;
                startCelebration('left');
                if (isHost) {
                    sendGameState();
                }
            }
            
            // Right goal (Player 1 scores)
            if (ball.x + ball.radius > canvas.width - goalHeight && 
                ball.y > canvas.height / 2 - goalWidth / 2 && 
                ball.y < canvas.height / 2 + goalWidth / 2) {
                scoreP1++;
                startCelebration('right');
                if (isHost) {
                    sendGameState();
                }
            }
        }

        function detectGoalPractice() {
            const goalWidth = 120;
            const goalHeight = 20;
            
            // Check if ball entered either goal in practice mode
            if ((ball.x - ball.radius < goalHeight || ball.x + ball.radius > canvas.width - goalHeight) && 
                ball.y > canvas.height / 2 - goalWidth / 2 && 
                ball.y < canvas.height / 2 + goalWidth / 2) {
                
                // Just reset ball position for practice
                setTimeout(() => {
                    resetBall();
                }, 500);
            }
        }

        function handleCarBallCollision(car) {
            const dx = ball.x - car.x;
            const dy = ball.y - car.y;
            const dist = Math.hypot(dx, dy);
            const minDist = ball.radius + Math.max(car.w, car.h) / 2;
            if (dist < minDist) {
                const overlap = minDist - dist + 0.1;
                const nx = dx / dist;
                const ny = dy / dist;
                // Push ball out of collision
                ball.x += nx * overlap;
                ball.y += ny * overlap;
                // Apply impulse based on car velocity
                ball.vx += car.vx * 0.5 + nx * 2;
                ball.vy += car.vy * 0.5 + ny * 2;
                return true;
            }
            return false;
        }

        function updateConfetti() {
            for (let i = confetti.length - 1; i >= 0; i--) {
                const p = confetti[i];
                p.vy += 0.15; // gravity
                p.x += p.vx;
                p.y += p.vy;
                p.life--;
                if (p.life <= 0) confetti.splice(i, 1);
            }
        }

        function drawConfetti() {
            confetti.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 3, 3);
            });
        }

        // Add new function below handleCarBallCollision
        function handleCarCarCollisions() {
            for (let i = 0; i < players.length; i++) {
                for (let j = i + 1; j < players.length; j++) {
                    const a = players[i];
                    const b = players[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.hypot(dx, dy);
                    const ra = Math.max(a.w, a.h) / 2;
                    const rb = Math.max(b.w, b.h) / 2;
                    const minDist = ra + rb;
                    if (dist < minDist && dist !== 0) {
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const overlap = minDist - dist;

                        // Separate cars
                        a.x -= nx * overlap / 2;
                        a.y -= ny * overlap / 2;
                        b.x += nx * overlap / 2;
                        b.y += ny * overlap / 2;

                        // Simple elastic impulse
                        const relVx = a.vx - b.vx;
                        const relVy = a.vy - b.vy;
                        const relDot = relVx * nx + relVy * ny;
                        if (relDot < 0) {
                            const restitution = 0.8;
                            const impulse = -(1 + restitution) * relDot / 2;
                            a.vx += nx * impulse;
                            a.vy += ny * impulse;
                            b.vx -= nx * impulse;
                            b.vy -= ny * impulse;
                        }
                    }
                }
            }
        }

        // ----- Setup & Game Loop -----
        function gameLoop() {
            // Clear and draw
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawField();

            if (gameState === "practice" || gameState === "multiplayer") {
                if (!celebrating) {
                    // Normal gameplay
                    if (singlePlayerMode || isHost) {
                        ball.update();
                    }

                    const hits = [];
                    
                    // Update cars based on mode
                    if (singlePlayerMode) {
                        // Only update player 1 in practice mode
                        player.update();
                        if (handleCarBallCollision(player)) hits.push(player);
                    } else {
                        // Update both players in multiplayer
                        players.forEach(car => {
                            car.update();
                            if (handleCarBallCollision(car)) hits.push(car);
                        });
                        handleCarCarCollisions();
                    }

                    // Multi-car collision recoil
                    if (hits.length > 1) {
                        hits.forEach(car => {
                            const dx = car.x - ball.x;
                            const dy = car.y - ball.y;
                            const dist = Math.hypot(dx, dy) || 1;
                            const nx = dx / dist;
                            const ny = dy / dist;
                            car.vx += nx * 4;
                            car.vy += ny * 4;
                        });
                    }
                    
                    if ((singlePlayerMode || isHost) && gameState === "multiplayer") {
                        detectGoal();
                    }
                    
                    // Goal detection for practice mode
                    if (singlePlayerMode && gameState === "practice") {
                        detectGoalPractice();
                    }
                    
                    updateAllParticles();
                } else {
                    // Celebration mode
                    celebrateTimer += 16;
                    
                    // Move exploding car
                    const scoringCar = scoreP1 > scoreP2 ? player : player2;
                    scoringCar.x += scoringCar.vx;
                    scoringCar.y += scoringCar.vy;
                    scoringCar.vx *= 0.95;
                    scoringCar.vy *= 0.95;

                    updateConfetti();
                    updateAllParticles();

                    if (celebrateTimer >= CELEBRATION_MS) {
                        celebrating = false;
                        resetBall();
                        
                        if (singlePlayerMode) {
                            // Reset to practice position
                            player.x = canvas.width / 2;
                            player.y = canvas.height / 2;
                            player.vx = player.vy = 0;
                            player.heading = -Math.PI / 2;
                        } else {
                            // Reset car positions for multiplayer
                            player.x = 100;
                            player.y = canvas.height / 2;
                            player.vx = player.vy = 0;
                            player.heading = 0;

                            player2.x = canvas.width - 100;
                            player2.y = canvas.height / 2;
                            player2.vx = player2.vy = 0;
                            player2.heading = Math.PI;
                        }
                        
                        if (isHost && gameState === "multiplayer") {
                            sendGameState();
                        }
                    }
                }

                // Send game state periodically if host in multiplayer
                if (isHost && !celebrating && gameState === "multiplayer") {
                    sendGameState();
                }
            }

            updateUI();
            
            // Draw everything
            drawTyreMarks();
            drawSmoke();
            
            // Draw cars based on mode
            if (singlePlayerMode) {
                player.draw();
            } else {
                players.forEach(car => car.draw());
            }
            
            drawSparks();
            drawFlames();
            ball.draw();
            drawConfetti();

            requestAnimationFrame(gameLoop);
        }

        function sendGameState() {
            if (isHost && connected && gameState === "multiplayer") {
                sendMessage({
                    type: 'gameState',
                    state: {
                        ball: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy },
                        player1: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, heading: player.heading },
                        player2: { x: player2.x, y: player2.y, vx: player2.vx, vy: player2.vy, heading: player2.heading },
                        scoreP1: scoreP1,
                        scoreP2: scoreP2,
                        celebrating: celebrating
                    }
                });
            }
        }

        // ----- Particle Updates -----
        let smoke = [];
        let tyreMarks = [];
        let sparks = [];
        let flames = [];

        function updateParticles(arr) {
            for (let i = arr.length-1; i>=0; i--) {
                const p = arr[i];
                p.x += p.vx || 0;
                p.y += p.vy || 0;
                p.life--;
                if (p.alpha!==undefined) p.alpha = p.life/60;
                if (p.life<=0) arr.splice(i,1);
            }
        }

        function drawSmoke() {
            smoke.forEach(p=> {
                ctx.fillStyle = `rgba(200,200,200,${p.alpha})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
                ctx.fill();
            });
        }

        function drawTyreMarks() {
            tyreMarks.forEach(t=> {
                ctx.strokeStyle = `rgba(50,50,50,${t.life/200})`;
                ctx.lineWidth =2;
                ctx.beginPath();
                ctx.moveTo(t.x, t.y);
                ctx.lineTo(t.x+1, t.y+1);
                ctx.stroke();
            });
        }

        function drawSparks() {
            sparks.forEach(s=> {
                ctx.fillStyle = `rgba(255,${200+Math.random()*55|0},0,${s.life/30})`;
                ctx.fillRect(s.x, s.y,2,2);
            });
        }

        function drawFlames() {
            flames.forEach(f=>{
                const a = f.life / f.max;
                ctx.fillStyle = `rgba(255,${150+Math.random()*80|0},0,${a})`;
                ctx.beginPath();
                ctx.arc(f.x, f.y, 5*(a), 0, Math.PI*2);
                ctx.fill();
            });
        }

        function updateAllParticles() {
            updateParticles(smoke);
            updateParticles(tyreMarks);
            updateParticles(sparks);
            updateParticles(flames);
        }

        initWebSocket();

        gameLoop();

        function positionScoreboard() {
            const canvasEl = document.getElementById("game");
            const sb = document.getElementById("scoreBoard");
            if (!canvasEl || !sb) return;
            // Get canvas position relative to viewport
            const rect = canvasEl.getBoundingClientRect();
            // Place scoreboard centered horizontally (handled by CSS) and just above the canvas
            const spacing = 10; // gap between scoreboard and canvas
            sb.style.top = `${rect.top - sb.offsetHeight - spacing}px`;
        }

        // ----- Initialize Game -----
        window.addEventListener("load", () => {
            positionScoreboard();
            initWebSocket();
            gameLoop();
        });

        window.addEventListener("resize", positionScoreboard);

        // After scores update (in case layout changes), reposition
        const originalUpdateUI = updateUI;
        updateUI = function () {
            originalUpdateUI();
            positionScoreboard();
        };
