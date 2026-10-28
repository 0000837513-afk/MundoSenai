/* ==========================================================================
           CONFIGURAÇÕES DAS DIFICULDADES
           ========================================================================== */
        const DIFICULDADES = {
            facil: { nome: 'Fácil', min: 1, max: 50 },
            normal: { nome: 'Normal', min: 1, max: 100 },
            dificil: { nome: 'Difícil', min: 1, max: 500 },
            extremo: { nome: 'Extremo', min: 1, max: 1000 }
        };

        const CUSTOM_TARGETS_KEY = 'adiviGames_customTargets';

        /* ESTADO DA APLICAÇÃO */
        let currentPlayer = '';
        let currentDifficultyKey = 'normal';
        let secretNumber = 0;
        let attemptsCount = 0;
        let historyArray = [];
        
        /* CONTROLE DE CRONÔMETRO */
        let timerInterval = null;
        let startTime = 0;
        let elapsedTime = 0;
        let isTimerRunning = false;

        /* WEB AUDIO API - EFEITOS SONOROS INTEGRADOS */
        const AudioFX = {
            ctx: null,
            init() {
                if (!this.ctx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) this.ctx = new AudioContext();
                }
            },
            playBeep(freq = 440, type = 'sine', duration = 0.1) {
                try {
                    this.init();
                    if (!this.ctx) return;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = type;
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + duration);
                } catch(e) {}
            },
            playWinFanfare() {
                const notes = [261, 329, 392, 523, 659];
                notes.forEach((freq, i) => {
                    setTimeout(() => this.playBeep(freq, 'triangle', 0.25), i * 80);
                });
            }
        };

        /* ==========================================================================
           INICIALIZAÇÃO DA APLICAÇÃO
           ========================================================================== */
        window.addEventListener('DOMContentLoaded', () => {
            // Verificar se já existe um jogador salvo no localStorage
            const savedPlayer = localStorage.getItem('adiviGames_playerName');
            if (savedPlayer) {
                currentPlayer = savedPlayer;
                showGameScreen();
            }

            renderLeaderboard(currentDifficultyKey);
            renderCustomTargets();
            renderPersonalGoals();

            document.getElementById('target-form').addEventListener('submit', addCustomTarget);
            document.getElementById('target-difficulty').value = currentDifficultyKey;
            document.getElementById('admin-target-list').addEventListener('click', (event) => {
                const removeButton = event.target.closest('[data-remove-target]');
                if (removeButton) removeCustomTarget(removeButton.dataset.removeTarget);
            });

            // Suporte para tecla ENTER no input do nome e do palpite
            document.getElementById('player-name-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submitPlayerName();
            });

            document.getElementById('guess-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') makeGuess();
            });
        });

        /* ==========================================================================
           TELA E GERENCIAMENTO DO JOGADOR
           ========================================================================== */
        function submitPlayerName() {
            const input = document.getElementById('player-name-input');
            const name = input.value.trim();

            if (!name) {
                input.focus();
                input.style.borderColor = '#f44336';
                return;
            }

            currentPlayer = name;
            localStorage.setItem('adiviGames_playerName', name);
            showGameScreen();
        }

        function changePlayer() {
            stopTimer();
            localStorage.removeItem('adiviGames_playerName');
            currentPlayer = '';
            document.getElementById('game-layout').classList.add('hidden');
            document.getElementById('screen-game').classList.add('hidden');
            document.getElementById('screen-welcome').classList.remove('hidden');
            document.getElementById('player-name-input').value = '';
        }

        function returnToStart() {
            stopTimer();
            document.getElementById('modal-victory').classList.add('hidden');
            document.getElementById('game-layout').classList.add('hidden');
            document.getElementById('screen-game').classList.add('hidden');
            document.getElementById('screen-welcome').classList.remove('hidden');
            document.getElementById('player-name-input').value = '';
            document.getElementById('new-record-tag').classList.add('hidden');
            document.getElementById('admin-status').innerText = '';
            document.getElementById('target-form').reset();
            document.getElementById('target-difficulty').value = currentDifficultyKey;
            currentPlayer = '';
            localStorage.removeItem('adiviGames_playerName');
            resetTimerDisplay();
        }

        function showGameScreen() {
            document.getElementById('screen-welcome').classList.add('hidden');
            document.getElementById('game-layout').classList.remove('hidden');
            document.getElementById('screen-game').classList.remove('hidden');
            document.getElementById('display-player-name').innerText = currentPlayer;
            
            // Iniciar nova partida
            setDifficulty('normal');
        }

        /* ==========================================================================
           LÓGICA DAS DIFICULDADES & RODADA
           ========================================================================== */
        function setDifficulty(key) {
            AudioFX.playBeep(600, 'sine', 0.05);
            currentDifficultyKey = key;

            // Atualizar botões visuais
            document.querySelectorAll('.diff-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`diff-${key}`).classList.add('active');

            // Atualizar label do range
            const diff = DIFICULDADES[key];
            document.getElementById('target-difficulty').value = key;
            renderLeaderboard(key);
            document.getElementById('range-label').innerHTML = 
                `<i class="fa-solid fa-hashtag"></i> Digite um número de ${diff.min} a ${diff.max}`;

            // Reiniciar partida
            restartRound();
        }

        function restartRound() {
            stopTimer();
            resetTimerDisplay();

            const diff = DIFICULDADES[currentDifficultyKey];
            secretNumber = Math.floor(Math.random() * (diff.max - diff.min + 1)) + diff.min;
            attemptsCount = 0;
            historyArray = [];

            // Reset de UI
            document.getElementById('attempts-display').innerText = '0';
            document.getElementById('guess-input').value = '';
            document.getElementById('history-list').innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted);">Nenhum chute ainda</span>';
            
            // Reset de Dicas
            document.getElementById('hint-main-text').innerText = 'Faça o seu primeiro palpite!';
            const badge = document.getElementById('hint-proximity-badge');
            badge.className = 'hint-proximity hidden';

            // Ocultar Modal se visível
            document.getElementById('modal-victory').classList.add('hidden');

            // Atualizar Recorde Atual
            updateRecordDisplay();

            document.getElementById('guess-input').focus();
        }

        /* ==========================================================================
           CRONÔMETRO
           ========================================================================== */
        function startTimer() {
            if (isTimerRunning) return;
            isTimerRunning = true;
            startTime = Date.now() - elapsedTime;

            timerInterval = setInterval(() => {
                elapsedTime = Date.now() - startTime;
                document.getElementById('timer-display').innerText = formatTime(elapsedTime);
            }, 50);
        }

        function stopTimer() {
            if (isTimerRunning) {
                elapsedTime = Date.now() - startTime;
                document.getElementById('timer-display').innerText = formatTime(elapsedTime);
            }
            isTimerRunning = false;
            clearInterval(timerInterval);
        }

        function resetTimerDisplay() {
            elapsedTime = 0;
            document.getElementById('timer-display').innerText = '00:00.0';
        }

        function formatTime(ms) {
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const tenths = Math.floor((ms % 1000) / 100);

            const pad = (n) => n.toString().padStart(2, '0');
            return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
        }

        /* ==========================================================================
           LÓGICA DO PALPITE & PROXIMIDADE
           ========================================================================== */
        function makeGuess() {
            const input = document.getElementById('guess-input');
            const guessVal = input.value.trim();
            const guess = parseInt(guessVal, 10);
            const diff = DIFICULDADES[currentDifficultyKey];

            // Validação simples
            if (isNaN(guess) || guess < diff.min || guess > diff.max) {
                AudioFX.playBeep(200, 'sawtooth', 0.15);
                document.getElementById('hint-main-text').innerText = `Digite um número válido (${diff.min} a ${diff.max})!`;
                input.value = '';
                return;
            }

            // Iniciar o cronômetro no primeiro chute válido
            if (!isTimerRunning && attemptsCount === 0) {
                startTimer();
            }

            attemptsCount++;
            document.getElementById('attempts-display').innerText = attemptsCount;

            // Calcular distância
            const distance = Math.abs(secretNumber - guess);
            const maxRange = diff.max - diff.min;
            const distancePercent = distance / maxRange;

            // Adicionar ao histórico
            historyArray.unshift(guess);
            renderHistory();

            input.value = '';
            input.focus();

            // Verificar se acertou
            if (guess === secretNumber) {
                handleVictory();
                return;
            }

            // Dica Maior/Menor
            const isHigher = secretNumber > guess;
            const directionText = isHigher ? 'O número secreto é MAIOR ⬆️' : 'O número secreto é MENOR ⬇️';
            document.getElementById('hint-main-text').innerText = directionText;

            // Determinar nível de proximidade
            let proxClass = '';
            let proxText = '';

            if (distancePercent <= 0.03 || distance <= 2) {
                proxClass = 'prox-muito-quente';
                proxText = '🔥 MUITO QUENTE!';
                AudioFX.playBeep(800, 'sine', 0.1);
            } else if (distancePercent <= 0.12) {
                proxClass = 'prox-quente';
                proxText = '☀️ QUENTE!';
                AudioFX.playBeep(650, 'sine', 0.08);
            } else if (distancePercent <= 0.35) {
                proxClass = 'prox-frio';
                proxText = '❄️ FRIO';
                AudioFX.playBeep(450, 'sine', 0.08);
            } else {
                proxClass = 'prox-muito-frio';
                proxText = '🧊 MUITO FRIO!';
                AudioFX.playBeep(300, 'sine', 0.08);
            }

            const badge = document.getElementById('hint-proximity-badge');
            badge.className = `hint-proximity ${proxClass}`;
            badge.innerText = proxText;
        }

        function renderHistory() {
            const container = document.getElementById('history-list');
            container.innerHTML = historyArray.map(num => `<span class="history-tag">${num}</span>`).join('');
        }

        function getCustomTargets() {
            try {
                const targets = JSON.parse(localStorage.getItem(CUSTOM_TARGETS_KEY) || '[]');
                if (!Array.isArray(targets)) return [];
                return targets.filter(target =>
                    target &&
                    typeof target.id === 'string' &&
                    typeof target.nome === 'string' &&
                    DIFICULDADES[target.difficultyKey] &&
                    Number.isFinite(target.timeMs) &&
                    Number.isInteger(target.tentativas) &&
                    target.tentativas > 0
                );
            } catch (error) {
                return [];
            }
        }

        function addCustomTarget(event) {
            event.preventDefault();

            const name = document.getElementById('target-name').value.trim();
            const difficultyKey = document.getElementById('target-difficulty').value;
            const timeSeconds = Number(document.getElementById('target-time').value);
            const targetAttempts = Number(document.getElementById('target-attempts').value);

            if (!name || !DIFICULDADES[difficultyKey] || !Number.isFinite(timeSeconds) || timeSeconds <= 0 || !Number.isInteger(targetAttempts) || targetAttempts <= 0) {
                document.getElementById('admin-status').innerText = 'Informe nome, dificuldade, tempo e tentativas válidas.';
                return;
            }

            const timeMs = Math.round(timeSeconds * 10) * 100;
            const target = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                nome: name,
                difficultyKey,
                timeMs,
                tentativas: targetAttempts
            };
            const targets = getCustomTargets();
            targets.push(target);

            try {
                localStorage.setItem(CUSTOM_TARGETS_KEY, JSON.stringify(targets));
            } catch (error) {
                document.getElementById('admin-status').innerText = 'Não foi possível salvar o desafio neste navegador.';
                return;
            }

            document.getElementById('target-form').reset();
            document.getElementById('target-difficulty').value = currentDifficultyKey;
            document.getElementById('admin-status').innerText = `Meta adicionada para ${DIFICULDADES[difficultyKey].nome}.`;
            renderCustomTargets();
            renderPersonalGoals();
            updateGoalDisplay();
        }

        function removeCustomTarget(targetId) {
            const targets = getCustomTargets().filter(target => target.id !== targetId);
            localStorage.setItem(CUSTOM_TARGETS_KEY, JSON.stringify(targets));
            document.getElementById('admin-status').innerText = 'Meta removida.';
            renderCustomTargets();
            renderPersonalGoals();
            updateGoalDisplay();
        }

        function renderLeaderboard(difficultyKey) {
            const body = document.getElementById('ranking-body');
            const recordsJson = currentPlayer ? localStorage.getItem(getStorageKey()) : null;
            let records = {};

            try {
                records = recordsJson ? JSON.parse(recordsJson) : {};
            } catch (error) {
                records = {};
            }

            const personalRecords = Object.keys(DIFICULDADES)
                .filter(key => records[key] && Number.isFinite(records[key].timeMs) && Number.isInteger(records[key].attempts))
                .map(key => ({ difficulty: DIFICULDADES[key].nome, ...records[key] }));

            if (personalRecords.length === 0) {
                const emptyRow = document.createElement('tr');
                const emptyCell = document.createElement('td');
                emptyCell.colSpan = 3;
                emptyCell.className = 'ranking-empty';
                emptyCell.innerText = currentPlayer ? 'Você ainda não tem recordes salvos.' : 'Entre no jogo para ver seus recordes.';
                emptyRow.append(emptyCell);
                body.replaceChildren(emptyRow);
                return;
            }

            const rows = personalRecords.map(record => {
                const row = document.createElement('tr');
                const difficultyCell = document.createElement('td');
                const timeCell = document.createElement('td');
                const attemptsCell = document.createElement('td');

                difficultyCell.innerText = record.difficulty;
                timeCell.innerText = record.timeFormatted || formatTime(record.timeMs);
                timeCell.className = 'ranking-time';
                attemptsCell.innerText = record.attempts;
                attemptsCell.className = 'ranking-attempts';

                row.append(difficultyCell, timeCell, attemptsCell);
                return row;
            });
            body.replaceChildren(...rows);
        }

        function renderCustomTargets() {
            const list = document.getElementById('admin-target-list');
            const targets = getCustomTargets().sort((first, second) =>
                first.timeMs - second.timeMs || first.tentativas - second.tentativas
            );

            if (targets.length === 0) {
                const emptyItem = document.createElement('li');
                emptyItem.className = 'admin-target-empty';
                emptyItem.innerText = 'Nenhuma meta configurada.';
                list.replaceChildren(emptyItem);
                return;
            }

            const items = targets.map(target => {
                const item = document.createElement('li');
                item.className = 'admin-target-item';

                const description = document.createElement('span');
                description.className = 'admin-target-description';
                description.innerText = `${target.nome} · ${DIFICULDADES[target.difficultyKey].nome} · ${formatTime(target.timeMs)} · ${target.tentativas} tent. ref.`;

                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'target-remove';
                removeButton.dataset.removeTarget = target.id;
                removeButton.setAttribute('aria-label', `Remover meta ${target.nome}`);
                removeButton.title = 'Remover meta';
                removeButton.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';

                item.append(description, removeButton);
                return item;
            });

            list.replaceChildren(...items);
        }

        function renderPersonalGoals() {
            const list = document.getElementById('personal-goals-list');
            if (!list) return;

            const targets = getCustomTargets().sort((first, second) =>
                first.timeMs - second.timeMs || first.tentativas - second.tentativas
            );

            if (targets.length === 0) {
                const emptyItem = document.createElement('li');
                emptyItem.className = 'personal-goal-empty';
                emptyItem.innerText = 'Nenhuma meta definida.';
                list.replaceChildren(emptyItem);
                return;
            }

            const items = targets.map(target => {
                const item = document.createElement('li');
                item.className = 'personal-goal-item';

                const name = document.createElement('span');
                name.className = 'personal-goal-name';
                name.innerText = `${target.nome} · ${DIFICULDADES[target.difficultyKey].nome}`;

                const details = document.createElement('span');
                details.className = 'personal-goal-details';
                details.innerText = `${formatTime(target.timeMs)} · ${target.tentativas} tent. ref.`;

                item.append(name, details);
                return item;
            });

            list.replaceChildren(...items);
        }

        /* ==========================================================================
           VITÓRIA & REGISTRO DE RECORDES
           ========================================================================== */
        function handleVictory() {
            stopTimer();
            AudioFX.playWinFanfare();
            startConfetti();

            const formattedTime = formatTime(elapsedTime);
            
            document.getElementById('final-time').innerText = formattedTime;
            document.getElementById('final-attempts').innerText = attemptsCount;

            const activeTargets = getCustomTargets();
            const beatenTargets = activeTargets.filter(target =>
                target.difficultyKey === currentDifficultyKey &&
                elapsedTime < target.timeMs
            );

            if (beatenTargets.length > 0) {
                const beatenIds = new Set(beatenTargets.map(target => target.id));
                const remainingTargets = activeTargets.filter(target => !beatenIds.has(target.id));
                localStorage.setItem(CUSTOM_TARGETS_KEY, JSON.stringify(remainingTargets));
                renderCustomTargets();
                renderPersonalGoals();
                updateGoalDisplay();
            }

            const nextTarget = getCustomTargets()
                .filter(target => target.difficultyKey === currentDifficultyKey)
                .sort((first, second) => first.timeMs - second.timeMs || first.tentativas - second.tentativas)[0];
            const victoryMessage = document.getElementById('victory-message');
            if (beatenTargets.length > 0) {
                const targetNames = beatenTargets.map(target => `"${target.nome}"`).join(', ');
                const nextTargetMessage = nextTarget
                    ? ` Próxima meta: "${nextTarget.nome}", faça menos que ${formatTime(nextTarget.timeMs)}.`
                    : ' Você concluiu todas as metas desta dificuldade!';
                victoryMessage.innerText = `Meta${beatenTargets.length > 1 ? 's' : ''} ${beatenTargets.length > 1 ? 'superadas' : 'superada'}: ${targetNames}.${nextTargetMessage}`;
            } else if (nextTarget) {
                victoryMessage.innerText = `Você acertou, mas ainda não superou a meta "${nextTarget.nome}". Para avançar, seu tempo precisa ser menor que ${formatTime(nextTarget.timeMs)}.`;
            } else {
                victoryMessage.innerText = 'Parabéns, você descobriu o número secreto!';
            }

            // Verificar e Salvar Recorde no LocalStorage
            const isNewRecord = checkAndSaveRecord(currentDifficultyKey, elapsedTime, attemptsCount);
            document.getElementById('victory-record-display').innerText = getPersonalRecordText(currentDifficultyKey);
            
            const recordTag = document.getElementById('new-record-tag');
            if (isNewRecord) {
                recordTag.classList.remove('hidden');
            } else {
                recordTag.classList.add('hidden');
            }

            document.getElementById('modal-victory').classList.remove('hidden');
        }

        function closeVictoryAndChangePlayer() {
            document.getElementById('modal-victory').classList.add('hidden');
            changePlayer();
        }

        /* LOCALSTORAGE PARA RECORDES */
        function getStorageKey() {
            return `adiviGames_records_${currentPlayer}`;
        }

        function checkAndSaveRecord(diffKey, timeMs, attempts) {
            const key = getStorageKey();
            const recordsJson = localStorage.getItem(key);
            let records = recordsJson ? JSON.parse(recordsJson) : {};

            const currentRecord = records[diffKey];
            let isBetter = false;

            // Um recorde é melhor se o tempo for menor. Se o tempo for igual, se tiver menos tentativas.
            if (!currentRecord) {
                isBetter = true;
            } else if (timeMs < currentRecord.timeMs) {
                isBetter = true;
            } else if (timeMs === currentRecord.timeMs && attempts < currentRecord.attempts) {
                isBetter = true;
            }

            if (isBetter) {
                records[diffKey] = {
                    timeMs: timeMs,
                    timeFormatted: formatTime(timeMs),
                    attempts: attempts
                };
                localStorage.setItem(key, JSON.stringify(records));
                updateRecordDisplay();
                renderLeaderboard(currentDifficultyKey);
                return true;
            }

            return false;
        }

        function updateRecordDisplay() {
            const key = getStorageKey();
            const recordsJson = localStorage.getItem(key);
            const display = document.getElementById('best-record-display');

            if (!recordsJson) {
                display.innerText = 'Nenhum';
                updateGoalDisplay();
                return;
            }

            const records = JSON.parse(recordsJson);
            const record = records[currentDifficultyKey];

            if (record) {
                display.innerText = `${record.timeFormatted} (${record.attempts} tent.)`;
            } else {
                display.innerText = 'Nenhum';
            }

            updateGoalDisplay();
        }

        function updateGoalDisplay() {
            const display = document.getElementById('personal-goal-display');
            if (!display) return;

            const goal = getCustomTargets()
                .filter(target => target.difficultyKey === currentDifficultyKey)
                .sort((first, second) => first.timeMs - second.timeMs || first.tentativas - second.tentativas)[0];

            display.innerText = goal
                ? `${goal.nome}: ${formatTime(goal.timeMs)} (${goal.tentativas} tent. ref.)`
                : 'Nenhuma meta definida';
        }

        function getPersonalRecordText(difficultyKey) {
            const recordsJson = localStorage.getItem(getStorageKey());
            if (!recordsJson) return 'Nenhum';

            try {
                const records = JSON.parse(recordsJson);
                const record = records[difficultyKey];
                return record ? `${record.timeFormatted} (${record.attempts} tent.)` : 'Nenhum';
            } catch (error) {
                return 'Nenhum';
            }
        }

        /* ==========================================================================
           EFEITO DE CONFETI EM CANVAS
           ========================================================================== */
        function startConfetti() {
            const canvas = document.getElementById('confetti-canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            const particles = [];
            const colors = ['#00e5ff', '#1e88e5', '#7b1fa2', '#9c27b0', '#ffffff', '#ffd700'];

            for (let i = 0; i < 120; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height - canvas.height,
                    size: Math.random() * 8 + 4,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    speedY: Math.random() * 4 + 2,
                    speedX: Math.random() * 2 - 1,
                    rotation: Math.random() * 360,
                    rotSpeed: Math.random() * 10 - 5
                });
            }

            let animationFrame;
            let duration = 0;

            function render() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                particles.forEach(p => {
                    p.y += p.speedY;
                    p.x += p.speedX;
                    p.rotation += p.rotSpeed;

                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    ctx.restore();
                });

                duration++;
                if (duration < 180) {
                    animationFrame = requestAnimationFrame(render);
                } else {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    cancelAnimationFrame(animationFrame);
                }
            }

            render();
        }
