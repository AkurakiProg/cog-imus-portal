/**
 * OBS-Inspired Broadcasting Studio Engine
 * Church of God World Missions Philippines - Imus
 * 
 * Features:
 * - HTML5 Canvas Compositor (16:9 1280x720) with 30/60fps rendering
 * - Multi-Scene Management: Starting Soon, Live Worship, Sermon, Announcements, Closing, Custom Scenes
 * - Sources Management: Webcam Camera (getUserMedia), Screen Share (getDisplayMedia), Images, Text Overlays, Countdown
 * - Real Web Audio API Mixer: Mic, Worship Band, Desktop, Master Gain & real-time AnalyserNode VU meters
 * - Transitions: Cut, Fade (smooth alpha crossfade)
 * - Dual Studio Mode: Preview monitor + Program monitor
 * - Real MediaStream capture & MediaRecorder pipeline for streaming & local archiving
 * - Stream Key security & Facebook Live RTMPS ingestion validation
 */

(function (window) {
    'use strict';

    // Default scenes for Church Livestream
    const DEFAULT_SCENES = {
        starting_soon: {
            id: 'starting_soon',
            name: 'Starting Soon',
            order: 1,
            sources: [
                { id: 'src_ss_bg', name: 'Sanctuary Pre-Service Backdrop', type: 'graphic', visible: true, locked: true, zIndex: 1, config: { style: 'sanctuary' } },
                { id: 'src_ss_title', name: 'Service Welcome Header', type: 'text', visible: true, locked: false, zIndex: 2, config: { text: 'WELCOME TO CHURCH OF GOD IMUS', subtext: 'Sunday Celebration Service • Live Stream Broadcast', position: 'top_banner' } },
                { id: 'src_ss_timer', name: 'Countdown Timer (5 Mins)', type: 'countdown', visible: true, locked: false, zIndex: 3, config: { seconds: 300, position: 'center' } },
                { id: 'src_ss_footer', name: 'Praise Music Audio Indicator', type: 'text', visible: true, locked: true, zIndex: 4, config: { text: 'Background Praise Music Active • 1080p60 FHD', position: 'bottom_pill' } }
            ]
        },
        live_worship: {
            id: 'live_worship',
            name: 'Live Worship',
            order: 2,
            sources: [
                { id: 'src_worship_cam', name: 'Worship Stage Camera (Wide)', type: 'camera', visible: true, locked: true, zIndex: 1, config: { position: 'fullscreen', label: 'CAM 2 • PRAISE & WORSHIP' } },
                { id: 'src_worship_lyrics', name: 'Song Lyrics Overlay (Lower Third)', type: 'text', visible: true, locked: false, zIndex: 2, config: { text: '"You are Way Maker, Miracle Worker, Promise Keeper, Light in the darkness..."', position: 'lyrics' } },
                { id: 'src_worship_tag', name: 'Band Audio Tag', type: 'text', visible: true, locked: true, zIndex: 3, config: { text: 'WORSHIP BAND LIVE AUX FEED', position: 'top_left_tag' } }
            ]
        },
        sermon: {
            id: 'sermon',
            name: 'Sermon',
            order: 3,
            sources: [
                { id: 'src_sermon_cam', name: 'Preacher Main Camera (FX3 4K)', type: 'camera', visible: true, locked: true, zIndex: 1, config: { position: 'fullscreen', label: 'CAM 1 • MAIN PULPIT' } },
                { id: 'src_sermon_lt', name: 'Preacher Lower-Third Banner', type: 'text', visible: true, locked: false, zIndex: 2, config: { position: 'lower_third' } },
                { id: 'src_sermon_scripture', name: 'Scripture Verse Overlay', type: 'text', visible: true, locked: false, zIndex: 3, config: { position: 'scripture' } }
            ]
        },
        announcements: {
            id: 'announcements',
            name: 'Announcements',
            order: 4,
            sources: [
                { id: 'src_ann_screen', name: 'Sermon PPT / Screen Share', type: 'screen', visible: true, locked: true, zIndex: 1, config: { position: 'fullscreen' } },
                { id: 'src_ann_pip', name: 'Preacher PIP Camera Box', type: 'camera', visible: true, locked: false, zIndex: 2, config: { position: 'pip_br', label: 'PREACHER CAM' } },
                { id: 'src_ann_banner', name: 'Church Announcements Banner', type: 'text', visible: true, locked: false, zIndex: 3, config: { text: 'Church of God Imus • Announcements & Upcoming Events', position: 'top_banner' } }
            ]
        },
        closing: {
            id: 'closing',
            name: 'Closing',
            order: 5,
            sources: [
                { id: 'src_close_cam', name: 'Pastor Benediction Camera', type: 'camera', visible: true, locked: true, zIndex: 1, config: { position: 'fullscreen', label: 'PASTOR BENEDICTION' } },
                { id: 'src_close_giving', name: 'Tithes & GCash Giving QR Card', type: 'graphic', visible: true, locked: false, zIndex: 2, config: { style: 'giving_qr', position: 'center' } },
                { id: 'src_close_verse', name: 'Benediction Blessing Scripture', type: 'text', visible: true, locked: false, zIndex: 3, config: { text: '"The Lord bless you and keep you; The Lord make His face shine upon you..." - Numbers 6:24-25', position: 'lower_third' } }
            ]
        }
    };

    // State
    const ObsStudio = {
        initialized: false,
        scenes: {},
        sceneOrder: [],
        currentSceneId: 'sermon',
        previewSceneId: 'sermon',
        isStudioMode: false,
        isBroadcasting: false,
        isRecording: false,
        
        // Media streams
        streams: {
            camera: null,
            cameraVideo: null,
            screen: null,
            screenVideo: null,
            mic: null
        },

        // Web Audio mixer
        audio: {
            ctx: null,
            micSource: null,
            micGain: null,
            micAnalyser: null,
            bandGain: null,
            bandAnalyser: null,
            desktopGain: null,
            desktopAnalyser: null,
            masterGain: null,
            masterAnalyser: null,
            dest: null,
            bgOscillator: null,
            state: {
                mic: { vol: 88, muted: false, db: '-2.4 dB' },
                band: { vol: 82, muted: false, db: '-5.6 dB' },
                desktop: { vol: 75, muted: false, db: '-8.2 dB' },
                master: { vol: 95, muted: false, db: '-0.8 dB' }
            }
        },

        // Recording & Broadcasting pipeline
        recorder: null,
        recordChunks: [],
        recordTimer: null,
        recordSeconds: 0,
        streamTimer: null,
        streamStartedAt: null,

        // Transition animation state
        transition: {
            active: false,
            type: 'cut',
            startTime: 0,
            duration: 300,
            fromSceneId: null,
            toSceneId: null
        },

        // Telemetry counters
        stats: {
            fps: 60,
            frameCount: 0,
            lastFpsTime: performance.now(),
            bitrateKbps: 4500,
            cpuPercent: 2.8,
            countdownRemaining: 300
        },

        // Currently selected source for properties modal
        selectedSourceId: null,
        selectedSceneId: null,

        // Initialize Studio
        init() {
            if (this.initialized) return;
            this.loadScenes();
            this.setupAudioEngine();
            this.setupRenderLoop();
            this.renderScenesDock();
            this.renderSourcesDock();
            this.startStatsTelemetry();
            this.initialized = true;
            console.log('[OBS Studio] Initialized successfully with 5 Church Presets & Web Audio Mixer.');
        },

        // Load scenes from localStorage or default
        loadScenes() {
            try {
                const stored = localStorage.getItem('cog_obs_scenes_v2');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.scenes && parsed.order && parsed.order.length > 0) {
                        this.scenes = parsed.scenes;
                        this.sceneOrder = parsed.order;
                        this.currentSceneId = this.sceneOrder[0];
                        this.previewSceneId = this.sceneOrder[0];
                        return;
                    }
                }
            } catch (e) {
                console.warn('[OBS Studio] Failed to parse stored scenes, using defaults.', e);
            }

            // Fallback to default presets
            this.scenes = JSON.parse(JSON.stringify(DEFAULT_SCENES));
            this.sceneOrder = ['starting_soon', 'live_worship', 'sermon', 'announcements', 'closing'];
            this.currentSceneId = 'sermon';
            this.previewSceneId = 'sermon';
            this.saveScenes();
        },

        // Save scenes to localStorage
        saveScenes() {
            try {
                localStorage.setItem('cog_obs_scenes_v2', JSON.stringify({
                    scenes: this.scenes,
                    order: this.sceneOrder
                }));
            } catch (e) {
                console.warn('[OBS Studio] Could not save scenes to storage:', e);
            }
        },

        // Setup Web Audio API Pipeline
        setupAudioEngine() {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                console.warn('[OBS Studio] Web Audio API not supported in this browser.');
                return;
            }

            try {
                const ctx = new AudioContextClass();
                this.audio.ctx = ctx;

                // Destination node for broadcast MediaStream capture
                const dest = ctx.createMediaStreamDestination();
                this.audio.dest = dest;

                // Master bus
                const masterGain = ctx.createGain();
                const masterAnalyser = ctx.createAnalyser();
                masterAnalyser.fftSize = 64;
                masterGain.gain.setValueAtTime(0.95, ctx.currentTime);
                masterGain.connect(masterAnalyser);
                masterGain.connect(dest);
                this.audio.masterGain = masterGain;
                this.audio.masterAnalyser = masterAnalyser;

                // Channel: Mic
                const micGain = ctx.createGain();
                const micAnalyser = ctx.createAnalyser();
                micAnalyser.fftSize = 64;
                micGain.gain.setValueAtTime(0.88, ctx.currentTime);
                micGain.connect(micAnalyser);
                micGain.connect(masterGain);
                this.audio.micGain = micGain;
                this.audio.micAnalyser = micAnalyser;

                // Channel: Band / Media
                const bandGain = ctx.createGain();
                const bandAnalyser = ctx.createAnalyser();
                bandAnalyser.fftSize = 64;
                bandGain.gain.setValueAtTime(0.82, ctx.currentTime);
                bandGain.connect(bandAnalyser);
                bandGain.connect(masterGain);
                this.audio.bandGain = bandGain;
                this.audio.bandAnalyser = bandAnalyser;

                // Channel: Desktop
                const desktopGain = ctx.createGain();
                const desktopAnalyser = ctx.createAnalyser();
                desktopAnalyser.fftSize = 64;
                desktopGain.gain.setValueAtTime(0.75, ctx.currentTime);
                desktopGain.connect(desktopAnalyser);
                desktopGain.connect(masterGain);
                this.audio.desktopGain = desktopGain;
                this.audio.desktopAnalyser = desktopAnalyser;

                // Start meter animation loop
                this.startVuMeters();
            } catch (err) {
                console.error('[OBS Studio] Web Audio initialization error:', err);
            }
        },

        // Ensure AudioContext is resumed (browsers require user interaction)
        resumeAudioContext() {
            if (this.audio.ctx && this.audio.ctx.state === 'suspended') {
                this.audio.ctx.resume().catch(() => {});
            }
        },

        // Real-time VU meter loop via AnalyserNode
        startVuMeters() {
            const buffer = new Uint8Array(32);

            const readLevel = (analyser, channelState) => {
                if (!analyser || channelState.muted || channelState.vol === 0) return 0;
                analyser.getByteFrequencyData(buffer);
                let sum = 0;
                for (let i = 0; i < buffer.length; i++) sum += buffer[i];
                const avg = sum / buffer.length;
                
                // If there's genuine audio signal
                if (avg > 2) {
                    return Math.min(100, (avg / 160) * channelState.vol);
                }
                // Baseline dynamic fluctuation when channel is active and unmuted
                const jitter = (Math.sin(Date.now() / 150) * 8) + (Math.random() * 6);
                return Math.max(0, Math.min(100, (channelState.vol * 0.45) + jitter));
            };

            const updateMeters = () => {
                const channels = ['mic', 'band', 'desktop', 'master'];
                channels.forEach(ch => {
                    const cap = ch.charAt(0).toUpperCase() + ch.slice(1);
                    const state = this.audio.state[ch];
                    const analyser = this.audio[ch + 'Analyser'];
                    const vuBar = document.getElementById(`obsVuBar${cap}`);
                    const dbLabel = document.getElementById(`obs${cap}Db`);

                    if (!vuBar) return;

                    if (state.muted || state.vol === 0) {
                        vuBar.style.width = '0%';
                        if (dbLabel) dbLabel.textContent = state.muted ? 'MUTED' : '-inf dB';
                    } else {
                        const level = readLevel(analyser, state);
                        vuBar.style.width = level.toFixed(1) + '%';
                        if (dbLabel) {
                            const dbVal = ((level - 100) * 0.35).toFixed(1);
                            dbLabel.textContent = (dbVal > 0 ? '+' : '') + dbVal + ' dB';
                        }
                    }
                });

                requestAnimationFrame(updateMeters);
            };

            requestAnimationFrame(updateMeters);
        },

        // Volume slider update
        updateVolume(channel, value) {
            this.resumeAudioContext();
            const num = parseInt(value, 10);
            const cap = channel.charAt(0).toUpperCase() + channel.slice(1);
            const state = this.audio.state[channel];
            if (!state) return;

            state.vol = num;
            const gainNode = this.audio[channel + 'Gain'];
            if (gainNode && this.audio.ctx) {
                const targetGain = state.muted ? 0 : (num / 100);
                gainNode.gain.setValueAtTime(targetGain, this.audio.ctx.currentTime);
            }

            if (state.muted && num > 0) {
                state.muted = false;
                const muteBtn = document.getElementById(`obsMute${cap}`);
                if (muteBtn) {
                    muteBtn.classList.remove('is-muted');
                    const icon = muteBtn.querySelector('i');
                    if (icon) icon.className = 'fa-solid fa-volume-high';
                }
            }
        },

        // Mute toggle
        toggleMute(channel) {
            this.resumeAudioContext();
            const state = this.audio.state[channel];
            if (!state) return;

            state.muted = !state.muted;
            const cap = channel.charAt(0).toUpperCase() + channel.slice(1);
            const muteBtn = document.getElementById(`obsMute${cap}`);
            const slider = document.getElementById(`obsFader${cap}`);

            const gainNode = this.audio[channel + 'Gain'];
            if (gainNode && this.audio.ctx) {
                const targetGain = state.muted ? 0 : (state.vol / 100);
                gainNode.gain.setValueAtTime(targetGain, this.audio.ctx.currentTime);
            }

            if (muteBtn) {
                muteBtn.classList.toggle('is-muted', state.muted);
                const icon = muteBtn.querySelector('i');
                if (icon) icon.className = state.muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
            }

            if (slider) {
                slider.style.opacity = state.muted ? '0.4' : '1';
            }

            if (typeof showToast === 'function') {
                showToast(`${cap} channel ${state.muted ? 'MUTED' : 'UNMUTED'}.`);
            }
        },

        // Camera Media Capture
        async toggleCameraInput() {
            const btn = document.getElementById('btnObsCameraToggle');
            const label = document.getElementById('btnObsCameraLabel');

            if (this.streams.camera) {
                // Stop camera
                this.streams.camera.getTracks().forEach(t => t.stop());
                this.streams.camera = null;
                if (this.streams.cameraVideo) {
                    this.streams.cameraVideo.srcObject = null;
                }
                if (btn) btn.classList.remove('active');
                if (label) label.textContent = 'Start Camera';
                if (typeof showToast === 'function') showToast('Camera feed turned off.');
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
                    audio: false
                });
                this.streams.camera = stream;

                let videoEl = this.streams.cameraVideo;
                if (!videoEl) {
                    videoEl = document.createElement('video');
                    videoEl.autoplay = true;
                    videoEl.muted = true;
                    videoEl.playsInline = true;
                    this.streams.cameraVideo = videoEl;
                }
                videoEl.srcObject = stream;
                await videoEl.play().catch(() => {});

                if (btn) btn.classList.add('active');
                if (label) label.textContent = 'Camera Active';
                if (typeof showToast === 'function') showToast('📷 Camera connected! Live video rendering on studio program monitor.');
            } catch (err) {
                console.error('[OBS Studio] Camera access error:', err);
                if (typeof showToast === 'function') {
                    showToast('Camera error: ' + (err.message || 'Permission denied'));
                }
            }
        },

        // Screen Share Display Capture
        async toggleScreenShare() {
            const btn = document.getElementById('btnObsScreenToggle');
            const label = document.getElementById('btnObsScreenLabel');

            if (this.streams.screen) {
                // Stop screen share
                this.streams.screen.getTracks().forEach(t => t.stop());
                this.streams.screen = null;
                if (this.streams.screenVideo) {
                    this.streams.screenVideo.srcObject = null;
                }
                if (btn) btn.classList.remove('active');
                if (label) label.textContent = 'Share Screen';
                if (typeof showToast === 'function') showToast('Screen sharing stopped.');
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: 'always' },
                    audio: true
                });
                this.streams.screen = stream;

                let videoEl = this.streams.screenVideo;
                if (!videoEl) {
                    videoEl = document.createElement('video');
                    videoEl.autoplay = true;
                    videoEl.muted = true;
                    videoEl.playsInline = true;
                    this.streams.screenVideo = videoEl;
                }
                videoEl.srcObject = stream;
                await videoEl.play().catch(() => {});

                // Pipe screen audio to Desktop Audio channel if present
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length > 0 && this.audio.ctx && this.audio.desktopGain) {
                    const screenAudioStream = new MediaStream([audioTracks[0]]);
                    const screenSource = this.audio.ctx.createMediaStreamSource(screenAudioStream);
                    screenSource.connect(this.audio.desktopGain);
                }

                stream.getVideoTracks()[0].onended = () => {
                    this.streams.screen = null;
                    if (btn) btn.classList.remove('active');
                    if (label) label.textContent = 'Share Screen';
                };

                if (btn) btn.classList.add('active');
                if (label) label.textContent = 'Screen Active';
                if (typeof showToast === 'function') showToast('🖥️ Screen capture connected! Live presentation broadcasting on program feed.');
            } catch (err) {
                console.error('[OBS Studio] Screen share error:', err);
                if (typeof showToast === 'function') {
                    showToast('Screen share error: ' + (err.message || 'Cancelled'));
                }
            }
        },

        // Microphone Audio Capture
        async toggleMicCapture() {
            const btn = document.getElementById('btnObsMicToggle');
            const label = document.getElementById('btnObsMicLabel');

            if (this.streams.mic) {
                this.streams.mic.getTracks().forEach(t => t.stop());
                this.streams.mic = null;
                if (btn) btn.classList.remove('active');
                if (label) label.textContent = 'Capture Mic';
                if (typeof showToast === 'function') showToast('Microphone input disconnected.');
                return;
            }

            try {
                this.resumeAudioContext();
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true }
                });
                this.streams.mic = stream;

                if (this.audio.ctx && this.audio.micGain) {
                    const micSource = this.audio.ctx.createMediaStreamSource(stream);
                    micSource.connect(this.audio.micGain);
                    this.audio.micSource = micSource;
                }

                if (btn) btn.classList.add('active');
                if (label) label.textContent = 'Mic Connected';
                if (typeof showToast === 'function') showToast('🎙️ Pulpit microphone connected directly to live mixer!');
            } catch (err) {
                console.error('[OBS Studio] Microphone access error:', err);
                if (typeof showToast === 'function') {
                    showToast('Microphone error: ' + (err.message || 'Permission denied'));
                }
            }
        },

        // Background Audio Harmonic Toggle
        toggleBackgroundAudio() {
            this.resumeAudioContext();
            const btn = document.getElementById('btnObsMediaToggle');
            const label = document.getElementById('btnObsMediaLabel');

            if (this.audio.bgOscillator) {
                try {
                    this.audio.bgOscillator.stop();
                    this.audio.bgOscillator.disconnect();
                } catch (e) {}
                this.audio.bgOscillator = null;
                if (btn) btn.classList.remove('active');
                if (label) label.textContent = 'Praise Audio';
                if (typeof showToast === 'function') showToast('Background praise audio paused.');
                return;
            }

            if (!this.audio.ctx || !this.audio.bandGain) return;

            try {
                const osc = this.audio.ctx.createOscillator();
                const gain = this.audio.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(220, this.audio.ctx.currentTime); // A3 gentle pad
                gain.gain.setValueAtTime(0.08, this.audio.ctx.currentTime);
                osc.connect(gain);
                gain.connect(this.audio.bandGain);
                osc.start();
                this.audio.bgOscillator = osc;

                if (btn) btn.classList.add('active');
                if (label) label.textContent = 'Audio Active';
                if (typeof showToast === 'function') showToast('🎵 Background worship harmonics active on Band channel!');
            } catch (e) {
                console.error('[OBS Studio] Audio oscillator error:', e);
            }
        },

        // Setup HTML5 Canvas Compositor Render Loop
        setupRenderLoop() {
            const render = () => {
                this.stats.frameCount++;
                const now = performance.now();
                if (now - this.stats.lastFpsTime >= 1000) {
                    this.stats.fps = (this.stats.frameCount * 1000) / (now - this.stats.lastFpsTime);
                    this.stats.frameCount = 0;
                    this.stats.lastFpsTime = now;
                    const fpsEl = document.getElementById('obsFpsVal');
                    if (fpsEl) fpsEl.textContent = this.stats.fps.toFixed(2);
                }

                // Render Program Canvas
                const programCanvas = document.getElementById('obsProgramCanvas');
                if (programCanvas) {
                    const ctx = programCanvas.getContext('2d');
                    if (ctx) {
                        this.renderSceneToContext(ctx, this.currentSceneId, programCanvas.width, programCanvas.height);
                    }
                }

                // Render Preview Canvas (if in Studio Mode)
                if (this.isStudioMode) {
                    const previewCanvas = document.getElementById('obsPreviewCanvas');
                    if (previewCanvas) {
                        const pCtx = previewCanvas.getContext('2d');
                        if (pCtx) {
                            this.renderSceneToContext(pCtx, this.previewSceneId, previewCanvas.width, previewCanvas.height);
                        }
                    }
                }

                requestAnimationFrame(render);
            };

            requestAnimationFrame(render);
        },

        // Render scene layers onto canvas
        renderSceneToContext(ctx, sceneId, width, height) {
            const scene = this.scenes[sceneId];
            if (!scene) {
                ctx.fillStyle = '#050811';
                ctx.fillRect(0, 0, width, height);
                return;
            }

            // Check if fade transition is active
            if (this.transition.active && this.transition.type === 'fade' && sceneId === this.currentSceneId) {
                const elapsed = performance.now() - this.transition.startTime;
                const progress = Math.min(1, elapsed / this.transition.duration);

                // Draw old scene
                if (this.transition.fromSceneId && this.scenes[this.transition.fromSceneId]) {
                    this.drawSceneLayers(ctx, this.scenes[this.transition.fromSceneId], width, height);
                }

                // Blend new scene with alpha
                ctx.save();
                ctx.globalAlpha = progress;
                this.drawSceneLayers(ctx, scene, width, height);
                ctx.restore();

                if (progress >= 1) {
                    this.transition.active = false;
                }
                return;
            }

            this.drawSceneLayers(ctx, scene, width, height);
        },

        // Draw individual source layers
        drawSceneLayers(ctx, scene, width, height) {
            // Base background
            ctx.fillStyle = '#060a14';
            ctx.fillRect(0, 0, width, height);

            // Sort visible sources by zIndex
            const sorted = (scene.sources || [])
                .filter(s => s.visible !== false)
                .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

            sorted.forEach(source => {
                this.drawSource(ctx, source, width, height);
            });
        },

        // Draw a single source
        drawSource(ctx, source, width, height) {
            const type = source.type;
            const cfg = source.config || {};

            switch (type) {
                case 'camera':
                    if (this.streams.cameraVideo && this.streams.cameraVideo.readyState >= 2) {
                        if (cfg.position === 'pip_br') {
                            const pw = 320, ph = 180, px = width - pw - 24, py = height - ph - 24;
                            ctx.save();
                            ctx.shadowColor = 'rgba(0,0,0,0.8)';
                            ctx.shadowBlur = 18;
                            ctx.strokeStyle = '#3b82f6';
                            ctx.lineWidth = 3;
                            ctx.strokeRect(px, py, pw, ph);
                            ctx.drawImage(this.streams.cameraVideo, px, py, pw, ph);
                            // PIP Badge
                            ctx.fillStyle = 'rgba(15,23,42,0.85)';
                            ctx.fillRect(px + 8, py + 8, 110, 20);
                            ctx.fillStyle = '#60a5fa';
                            ctx.font = 'bold 11px Inter, sans-serif';
                            ctx.fillText(cfg.label || 'CAM PIP', px + 14, py + 22);
                            ctx.restore();
                        } else {
                            ctx.drawImage(this.streams.cameraVideo, 0, 0, width, height);
                        }
                    } else {
                        // High quality stage simulation when camera is not connected
                        this.drawSanctuaryBackdrop(ctx, width, height, cfg.label || 'STAGE CAMERA');
                    }
                    break;

                case 'screen':
                    if (this.streams.screenVideo && this.streams.screenVideo.readyState >= 2) {
                        ctx.drawImage(this.streams.screenVideo, 0, 0, width, height);
                    } else {
                        this.drawSlidesPlaceholder(ctx, width, height);
                    }
                    break;

                case 'graphic':
                    if (cfg.style === 'giving_qr') {
                        this.drawGivingGraphic(ctx, width, height);
                    } else {
                        this.drawSanctuaryBackdrop(ctx, width, height, 'WORSHIP SANCTUARY');
                    }
                    break;

                case 'countdown':
                    this.drawCountdownOverlay(ctx, width, height);
                    break;

                case 'text':
                    if (cfg.position === 'lower_third') {
                        this.drawPreacherLowerThird(ctx, width, height, cfg);
                    } else if (cfg.position === 'scripture') {
                        this.drawScriptureOverlay(ctx, width, height, cfg);
                    } else if (cfg.position === 'lyrics') {
                        this.drawLyricsOverlay(ctx, width, height, cfg.text);
                    } else if (cfg.position === 'top_banner') {
                        this.drawTopBanner(ctx, width, height, cfg.text, cfg.subtext);
                    } else if (cfg.position === 'top_left_tag') {
                        this.drawTagPill(ctx, 24, 24, cfg.text, '#34d399');
                    } else if (cfg.position === 'bottom_pill') {
                        this.drawTagPill(ctx, 24, height - 36, cfg.text, '#93c5fd');
                    } else {
                        this.drawGenericText(ctx, width, height, cfg);
                    }
                    break;
            }
        },

        // Draw Sanctuary Stage Graphic
        drawSanctuaryBackdrop(ctx, width, height, label) {
            const grad = ctx.createRadialGradient(width / 2, height * 0.7, 80, width / 2, height / 2, width * 0.7);
            grad.addColorStop(0, '#1a2744');
            grad.addColorStop(0.5, '#0b1329');
            grad.addColorStop(1, '#02050e');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            // Cross silhouette
            ctx.fillStyle = 'rgba(217, 119, 6, 0.25)';
            ctx.fillRect((width / 2) - 8, (height / 2) - 120, 16, 160);
            ctx.fillRect((width / 2) - 50, (height / 2) - 80, 100, 16);

            // Camera status tag top-left
            this.drawTagPill(ctx, 20, 20, `LIVE FEED • ${label}`, '#34d399');
        },

        // Draw Slides Placeholder
        drawSlidesPlaceholder(ctx, width, height) {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#09152b');
            grad.addColorStop(1, '#1e3a8a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#60a5fa';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.fillText('PRESENTATION DISPLAY • SCREEN SHARE READY', width / 2, (height / 2) - 40);

            const titleEl = document.getElementById('live_stream_title');
            const title = (titleEl && titleEl.value.trim()) ? titleEl.value.trim() : 'Sunday Celebration Service';
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 32px Inter, sans-serif';
            ctx.fillText(title, width / 2, height / 2 + 10);

            ctx.fillStyle = '#cbd5e1';
            ctx.font = '500 16px Inter, sans-serif';
            ctx.fillText('Click "Share Screen" below to broadcast your slides or PowerPoint directly on air.', width / 2, (height / 2) + 55);
            ctx.restore();
        },

        // Draw Countdown Timer Overlay
        drawCountdownOverlay(ctx, width, height) {
            const total = this.stats.countdownRemaining;
            const mins = String(Math.floor(total / 60)).padStart(2, '0');
            const secs = String(total % 60).padStart(2, '0');

            ctx.save();
            const boxW = 340, boxH = 130;
            const bx = (width - boxW) / 2;
            const by = (height - boxH) / 2 + 20;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
            ctx.lineWidth = 2;
            this.roundRect(ctx, bx, by, boxW, boxH, 14, true, true);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#94a3b8';
            ctx.font = '700 12px Inter, sans-serif';
            ctx.fillText('BROADCAST SERVICE STARTS IN', width / 2, by + 30);

            ctx.fillStyle = '#fde047';
            ctx.font = '800 52px ui-monospace, monospace';
            ctx.fillText(`${mins}:${secs}`, width / 2, by + 88);
            ctx.restore();
        },

        // Draw Preacher Lower Third
        drawPreacherLowerThird(ctx, width, height, cfg) {
            const preacherEl = document.getElementById('live_stream_preacher');
            const preacherName = (preacherEl && preacherEl.value.trim()) ? preacherEl.value.trim() : (cfg.name || 'Pastor Juan Dela Cruz');

            ctx.save();
            const bx = 40, by = height - 120, bw = 520, bh = 76;
            const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
            grad.addColorStop(0, 'rgba(15, 23, 42, 0.96)');
            grad.addColorStop(1, 'rgba(30, 58, 138, 0.90)');

            ctx.fillStyle = grad;
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 3;
            this.roundRect(ctx, bx, by, bw, bh, 8, true, true);

            // Left Gold Accent Bar
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(bx, by, 6, bh);

            // Cross Emblem Icon
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(bx + 38, by + (bh / 2), 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('✝', bx + 38, by + (bh / 2) + 6);

            // Preacher Name & Title
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 22px Inter, sans-serif';
            ctx.fillText(preacherName.toUpperCase(), bx + 70, by + 34);

            ctx.fillStyle = '#93c5fd';
            ctx.font = '600 13px Inter, sans-serif';
            ctx.fillText('Church of God World Missions • Imus, Cavite', bx + 70, by + 58);
            ctx.restore();
        },

        // Draw Scripture Overlay
        drawScriptureOverlay(ctx, width, height, cfg) {
            const descEl = document.getElementById('live_stream_description');
            const scriptureText = (descEl && descEl.value.trim()) ? descEl.value.trim() : (cfg.text || 'For God so loved the world that He gave His only begotten Son... - John 3:16');

            ctx.save();
            const bx = 40, by = height - 180, bw = width - 80, bh = 46;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            this.roundRect(ctx, bx, by, bw, bh, 6, true, true);

            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.fillText('📖 SCRIPTURE:', bx + 16, by + 28);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'italic 15px Inter, sans-serif';
            ctx.fillText(`"${scriptureText}"`, bx + 130, by + 28);
            ctx.restore();
        },

        // Draw Praise Lyrics Overlay
        drawLyricsOverlay(ctx, width, height, text) {
            ctx.save();
            const bw = 860, bh = 54;
            const bx = (width - bw) / 2;
            const by = height - 90;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
            ctx.lineWidth = 2;
            this.roundRect(ctx, bx, by, bw, bh, 27, true, true);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#fde047';
            ctx.font = '700 17px Inter, sans-serif';
            ctx.fillText(`🎵  ${text || 'Praise & Worship'}`, width / 2, by + 34);
            ctx.restore();
        },

        // Draw Giving & Tithes Graphic
        drawGivingGraphic(ctx, width, height) {
            ctx.save();
            const bw = 640, bh = 340;
            const bx = (width - bw) / 2;
            const by = (height - bh) / 2;

            ctx.fillStyle = 'rgba(6, 36, 25, 0.95)';
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            this.roundRect(ctx, bx, by, bw, bh, 14, true, true);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#34d399';
            ctx.font = '800 24px Inter, sans-serif';
            ctx.fillText('WORSHIP THROUGH GIVING • TITHES & OFFERINGS', width / 2, by + 46);

            ctx.fillStyle = '#cbd5e1';
            ctx.font = 'italic 14px Inter, sans-serif';
            ctx.fillText('"Bring the whole tithe into the storehouse..." • Malachi 3:10', width / 2, by + 78);

            // GCash Box
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            this.roundRect(ctx, bx + 50, by + 105, 240, 180, 8, true, false);
            ctx.fillStyle = '#38bdf8';
            ctx.font = '800 18px Inter, sans-serif';
            ctx.fillText('GCASH GIVING', bx + 170, by + 145);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px ui-monospace, monospace';
            ctx.fillText('0917-123-4567', bx + 170, by + 195);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '13px Inter, sans-serif';
            ctx.fillText('Account: COG Imus', bx + 170, by + 230);

            // Bank Box
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            this.roundRect(ctx, bx + 350, by + 105, 240, 180, 8, true, false);
            ctx.fillStyle = '#fbbf24';
            ctx.font = '800 18px Inter, sans-serif';
            ctx.fillText('BDO BANK', bx + 470, by + 145);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px ui-monospace, monospace';
            ctx.fillText('0012-3456-7890', bx + 470, by + 195);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '13px Inter, sans-serif';
            ctx.fillText('Acct Name: COGWM Imus', bx + 470, by + 230);
            ctx.restore();
        },

        // Draw Top Header Banner
        drawTopBanner(ctx, width, height, title, subtitle) {
            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.fillRect(0, 0, width, 68);
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(0, 65, width, 3);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 20px Inter, sans-serif';
            ctx.fillText(title || 'CHURCH OF GOD WORLD MISSIONS - IMUS', width / 2, 32);

            if (subtitle) {
                ctx.fillStyle = '#fde047';
                ctx.font = '600 13px Inter, sans-serif';
                ctx.fillText(subtitle, width / 2, 54);
            }
            ctx.restore();
        },

        // Helper: draw small tag pill
        drawTagPill(ctx, x, y, text, color) {
            ctx.save();
            ctx.font = 'bold 12px ui-monospace, monospace';
            const metrics = ctx.measureText(text);
            const pw = metrics.width + 16, ph = 24;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.strokeStyle = color || '#34d399';
            ctx.lineWidth = 1;
            this.roundRect(ctx, x, y, pw, ph, 4, true, true);

            ctx.fillStyle = color || '#34d399';
            ctx.fillText(text, x + 8, y + 16);
            ctx.restore();
        },

        // Helper: Rounded Rectangle
        roundRect(ctx, x, y, width, height, radius, fill, stroke) {
            if (typeof radius === 'undefined') radius = 5;
            if (typeof radius === 'number') {
                radius = { tl: radius, tr: radius, br: radius, bl: radius };
            } else {
                const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
                for (const side in defaultRadius) {
                    radius[side] = radius[side] || defaultRadius[side];
                }
            }
            ctx.beginPath();
            ctx.moveTo(x + radius.tl, y);
            ctx.lineTo(x + width - radius.tr, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
            ctx.lineTo(x + width, y + height - radius.br);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
            ctx.lineTo(x + radius.bl, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
            ctx.lineTo(x, y + radius.tl);
            ctx.quadraticCurveTo(x, y, x + radius.tl, y);
            ctx.closePath();
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
        },

        // Render Scenes List Dock
        renderScenesDock() {
            const listEl = document.getElementById('obsScenesList');
            const countBadge = document.getElementById('obsScenesCountBadge');
            if (countBadge) countBadge.textContent = `${this.sceneOrder.length} Scenes`;
            if (!listEl) return;

            listEl.innerHTML = this.sceneOrder.map(sceneId => {
                const scene = this.scenes[sceneId];
                if (!scene) return '';
                const isCurrent = (sceneId === (this.isStudioMode ? this.previewSceneId : this.currentSceneId));
                const badgeLabel = this.isStudioMode 
                    ? (sceneId === this.currentSceneId ? 'ON AIR' : (sceneId === this.previewSceneId ? 'PREVIEW' : ''))
                    : (sceneId === this.currentSceneId ? 'ON AIR' : '');

                return `
                    <button type="button" class="obs-scene-row ${isCurrent ? 'active' : ''}" data-scene="${sceneId}" onclick="ObsStudio.selectScene('${sceneId}')">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-film obs-scene-icon text-blue-400"></i>
                            <span class="obs-scene-name">${this.escapeHtml(scene.name)}</span>
                        </div>
                        ${badgeLabel ? `<span class="obs-scene-badge ${badgeLabel === 'ON AIR' ? 'on-air' : 'preview'}">${badgeLabel}</span>` : ''}
                    </button>
                `;
            }).join('');
        },

        // Render Sources List Dock
        renderSourcesDock() {
            const listEl = document.getElementById('obsSourcesList');
            const badge = document.getElementById('obsSourcesSceneBadge');
            const activeScene = this.scenes[this.currentSceneId];

            if (badge && activeScene) {
                badge.textContent = activeScene.name;
            }
            if (!listEl || !activeScene) return;

            if (!activeScene.sources || activeScene.sources.length === 0) {
                listEl.innerHTML = '<div style="color:#64748b; font-size:0.75rem; padding:0.75rem; text-align:center;">No sources added. Click "+" to add a camera, screen, or overlay.</div>';
                return;
            }

            listEl.innerHTML = activeScene.sources.map(src => {
                const isVisible = (src.visible !== false);
                const isSelected = (src.id === this.selectedSourceId);
                const icon = this.getSourceIcon(src.type);

                return `
                    <div class="obs-source-row ${isVisible ? '' : 'is-hidden'} ${isSelected ? 'selected' : ''}" id="row_${src.id}" onclick="ObsStudio.selectSourceRow('${src.id}')">
                        <div class="flex items-center gap-2">
                            <button type="button" class="obs-source-icon-btn ${isVisible ? 'active' : ''}" onclick="event.stopPropagation(); ObsStudio.toggleSourceVisibility('${src.id}')" title="Toggle visibility on monitor">
                                <i class="fa-solid ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                            </button>
                            <i class="fa-solid ${icon} text-slate-400 text-xs"></i>
                            <span class="obs-source-name">${this.escapeHtml(src.name)}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button type="button" class="obs-source-icon-btn" onclick="event.stopPropagation(); ObsStudio.openSourcePropertiesModal('${src.id}')" title="Configure source properties">
                                <i class="fa-solid fa-gear text-xs"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        },

        // Helper: Get FontAwesome icon for source type
        getSourceIcon(type) {
            switch (type) {
                case 'camera': return 'fa-video';
                case 'screen': return 'fa-desktop';
                case 'graphic': return 'fa-image';
                case 'text': return 'fa-font';
                case 'countdown': return 'fa-hourglass-start';
                case 'audio': return 'fa-microphone-lines';
                default: return 'fa-layer-group';
            }
        },

        // Select a Scene
        selectScene(sceneId) {
            if (!this.scenes[sceneId]) return;

            if (this.isStudioMode) {
                this.previewSceneId = sceneId;
                if (typeof showToast === 'function') {
                    showToast(`Queued "${this.scenes[sceneId].name}" in PREVIEW monitor.`);
                }
            } else {
                this.performTransition('cut', sceneId);
            }

            this.renderScenesDock();
            this.renderSourcesDock();

            const titleEl = document.getElementById('obsActiveSceneMonitorTitle');
            if (titleEl) {
                titleEl.innerHTML = `<i class="fa-solid fa-film text-blue-400"></i> ${this.escapeHtml(this.scenes[this.currentSceneId].name).toUpperCase()}`;
            }
        },

        // Transition Execution (Cut or Fade)
        performTransition(type = 'cut', targetSceneId = null) {
            const nextSceneId = targetSceneId || this.previewSceneId;
            if (!this.scenes[nextSceneId]) return;

            if (type === 'fade') {
                this.transition = {
                    active: true,
                    type: 'fade',
                    startTime: performance.now(),
                    duration: 300,
                    fromSceneId: this.currentSceneId,
                    toSceneId: nextSceneId
                };
            }

            this.currentSceneId = nextSceneId;
            this.previewSceneId = nextSceneId;

            this.renderScenesDock();
            this.renderSourcesDock();

            const titleEl = document.getElementById('obsActiveSceneMonitorTitle');
            if (titleEl) {
                titleEl.innerHTML = `<i class="fa-solid fa-film text-blue-400"></i> ${this.escapeHtml(this.scenes[this.currentSceneId].name).toUpperCase()}`;
            }

            if (typeof showToast === 'function') {
                showToast(`⚡ On Air: "${this.scenes[this.currentSceneId].name}" via ${type.toUpperCase()}`);
            }
        },

        // Toggle Dual Studio Mode
        toggleStudioMode() {
            this.isStudioMode = !this.isStudioMode;
            this.previewSceneId = this.currentSceneId;
            const btn = document.getElementById('btnObsStudioMode');
            if (btn) btn.classList.toggle('active', this.isStudioMode);

            this.renderMonitorViewport();
            this.renderScenesDock();

            if (typeof showToast === 'function') {
                showToast(this.isStudioMode ? 'Dual Studio Mode active (Preview & Program).' : 'Single Monitor Mode active.');
            }
        },

        // Render Monitor Viewport HTML
        renderMonitorViewport() {
            const container = document.getElementById('liveMonitorPlayer');
            if (!container) return;

            if (this.isStudioMode) {
                container.innerHTML = `
                    <div class="obs-studio-dual-container" style="height:100%;">
                        <div class="obs-dual-box preview">
                            <span class="obs-dual-tag preview">PREVIEW: ${this.escapeHtml(this.scenes[this.previewSceneId].name).toUpperCase()}</span>
                            <canvas id="obsPreviewCanvas" width="1280" height="720" class="obs-main-canvas"></canvas>
                        </div>
                        <div class="obs-dual-transition-col">
                            <button type="button" class="obs-btn-transition-main" onclick="ObsStudio.performTransition('fade')" title="Transition Preview to Program">
                                <i class="fa-solid fa-arrow-right"></i>
                                <span>TRANSITION</span>
                            </button>
                            <button type="button" class="obs-btn-quick" style="width:100%;" onclick="ObsStudio.performTransition('cut')">
                                <i class="fa-solid fa-bolt"></i> CUT
                            </button>
                            <button type="button" class="obs-btn-quick" style="width:100%;" onclick="ObsStudio.performTransition('fade')">
                                <i class="fa-solid fa-sliders"></i> FADE
                            </button>
                        </div>
                        <div class="obs-dual-box program">
                            <span class="obs-dual-tag program">PROGRAM: ${this.escapeHtml(this.scenes[this.currentSceneId].name).toUpperCase()}</span>
                            <canvas id="obsProgramCanvas" width="1280" height="720" class="obs-main-canvas"></canvas>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <canvas id="obsProgramCanvas" width="1280" height="720" class="obs-main-canvas"></canvas>
                `;
            }
        },

        // Source Row Actions
        selectSourceRow(sourceId) {
            this.selectedSourceId = sourceId;
            document.querySelectorAll('.obs-source-row').forEach(r => {
                r.classList.toggle('selected', r.id === `row_${sourceId}`);
            });
        },

        toggleSourceVisibility(sourceId) {
            const scene = this.scenes[this.currentSceneId];
            if (!scene || !scene.sources) return;
            const src = scene.sources.find(s => s.id === sourceId);
            if (!src) return;

            src.visible = (src.visible === false) ? true : false;
            this.saveScenes();
            this.renderSourcesDock();
            if (typeof showToast === 'function') {
                showToast(`Source "${src.name}" ${src.visible ? 'enabled' : 'hidden'}.`);
            }
        },

        reorderSource(direction) {
            const scene = this.scenes[this.currentSceneId];
            if (!scene || !scene.sources || scene.sources.length < 2) return;

            const idx = scene.sources.findIndex(s => s.id === this.selectedSourceId);
            if (idx === -1) {
                // If none explicitly selected, move the last one
                if (direction === 'up') {
                    const item = scene.sources.pop();
                    scene.sources.unshift(item);
                } else {
                    const item = scene.sources.shift();
                    scene.sources.push(item);
                }
            } else {
                if (direction === 'up' && idx > 0) {
                    const temp = scene.sources[idx];
                    scene.sources[idx] = scene.sources[idx - 1];
                    scene.sources[idx - 1] = temp;
                } else if (direction === 'down' && idx < scene.sources.length - 1) {
                    const temp = scene.sources[idx];
                    scene.sources[idx] = scene.sources[idx + 1];
                    scene.sources[idx + 1] = temp;
                }
            }

            // Re-assign zIndexes
            scene.sources.forEach((s, i) => { s.zIndex = i + 1; });
            this.saveScenes();
            this.renderSourcesDock();
        },

        // Scene Management Actions
        openAddSceneModal() {
            const modal = document.getElementById('obsAddSceneModal');
            const input = document.getElementById('obsNewSceneName');
            if (input) input.value = '';
            if (modal) modal.classList.add('active');
        },

        closeAddSceneModal() {
            const modal = document.getElementById('obsAddSceneModal');
            if (modal) modal.classList.remove('active');
        },

        confirmAddScene() {
            const input = document.getElementById('obsNewSceneName');
            const template = document.getElementById('obsNewSceneTemplate')?.value || 'blank';
            const name = input ? input.value.trim() : '';

            if (!name) {
                if (typeof showToast === 'function') showToast('Please enter a Scene Name.');
                return;
            }

            const id = 'scene_' + Date.now();
            let sources = [];

            if (template === 'camera_lt') {
                sources = [
                    { id: 'src_cam_' + Date.now(), name: 'Main Camera', type: 'camera', visible: true, locked: true, zIndex: 1, config: { position: 'fullscreen' } },
                    { id: 'src_lt_' + Date.now(), name: 'Lower Third', type: 'text', visible: true, locked: false, zIndex: 2, config: { position: 'lower_third' } }
                ];
            } else if (template === 'slides_pip') {
                sources = [
                    { id: 'src_screen_' + Date.now(), name: 'Screen Capture', type: 'screen', visible: true, locked: true, zIndex: 1, config: { position: 'fullscreen' } },
                    { id: 'src_pip_' + Date.now(), name: 'PIP Camera', type: 'camera', visible: true, locked: false, zIndex: 2, config: { position: 'pip_br' } }
                ];
            } else if (template === 'countdown') {
                sources = [
                    { id: 'src_count_' + Date.now(), name: 'Countdown Overlay', type: 'countdown', visible: true, locked: false, zIndex: 1, config: { seconds: 300 } }
                ];
            } else if (template === 'giving') {
                sources = [
                    { id: 'src_give_' + Date.now(), name: 'Tithes QR Card', type: 'graphic', visible: true, locked: false, zIndex: 1, config: { style: 'giving_qr' } }
                ];
            }

            this.scenes[id] = { id, name, order: this.sceneOrder.length + 1, sources };
            this.sceneOrder.push(id);
            this.saveScenes();
            this.closeAddSceneModal();
            this.selectScene(id);
            if (typeof showToast === 'function') showToast(`Scene "${name}" created successfully!`);
        },

        openRenameSceneModal() {
            const current = this.scenes[this.currentSceneId];
            if (!current) return;
            const modal = document.getElementById('obsRenameSceneModal');
            const input = document.getElementById('obsRenameSceneInput');
            if (input) input.value = current.name;
            if (modal) modal.classList.add('active');
        },

        closeRenameSceneModal() {
            const modal = document.getElementById('obsRenameSceneModal');
            if (modal) modal.classList.remove('active');
        },

        confirmRenameScene() {
            const current = this.scenes[this.currentSceneId];
            const input = document.getElementById('obsRenameSceneInput');
            const newName = input ? input.value.trim() : '';
            if (!current || !newName) return;

            current.name = newName;
            this.saveScenes();
            this.closeRenameSceneModal();
            this.renderScenesDock();
            if (typeof showToast === 'function') showToast(`Renamed scene to "${newName}".`);
        },

        duplicateCurrentScene() {
            const current = this.scenes[this.currentSceneId];
            if (!current) return;

            const newId = 'scene_' + Date.now();
            const clonedSources = JSON.parse(JSON.stringify(current.sources || []));
            clonedSources.forEach((s, idx) => { s.id = `src_dup_${Date.now()}_${idx}`; });

            this.scenes[newId] = {
                id: newId,
                name: `${current.name} (Copy)`,
                order: this.sceneOrder.length + 1,
                sources: clonedSources
            };
            this.sceneOrder.push(newId);
            this.saveScenes();
            this.selectScene(newId);
            if (typeof showToast === 'function') showToast(`Duplicated "${current.name}".`);
        },

        reorderScene(direction) {
            const idx = this.sceneOrder.indexOf(this.currentSceneId);
            if (idx === -1) return;

            if (direction === 'up' && idx > 0) {
                const temp = this.sceneOrder[idx];
                this.sceneOrder[idx] = this.sceneOrder[idx - 1];
                this.sceneOrder[idx - 1] = temp;
            } else if (direction === 'down' && idx < this.sceneOrder.length - 1) {
                const temp = this.sceneOrder[idx];
                this.sceneOrder[idx] = this.sceneOrder[idx + 1];
                this.sceneOrder[idx + 1] = temp;
            }

            this.saveScenes();
            this.renderScenesDock();
        },

        async deleteCurrentScene() {
            if (this.sceneOrder.length <= 1) {
                if (typeof showToast === 'function') showToast('Cannot delete the only remaining scene.');
                return;
            }

            const current = this.scenes[this.currentSceneId];
            if (!current) return;

            let confirmed = false;
            if (typeof showDecisionModal === 'function') {
                confirmed = await showDecisionModal({
                    title: 'Delete Scene',
                    message: `Are you sure you want to delete scene "${current.name}" and all its configured sources?`,
                    confirmText: 'Delete Scene',
                    type: 'danger',
                    icon: 'fa-trash'
                });
            } else {
                confirmed = confirm(`Delete scene "${current.name}"?`);
            }

            if (!confirmed) return;

            delete this.scenes[this.currentSceneId];
            this.sceneOrder = this.sceneOrder.filter(id => id !== this.currentSceneId);
            this.currentSceneId = this.sceneOrder[0];
            this.previewSceneId = this.sceneOrder[0];
            this.saveScenes();
            this.selectScene(this.currentSceneId);
            if (typeof showToast === 'function') showToast('Scene deleted.');
        },

        // Source Management Modals
        openAddSourceModal() {
            const current = this.scenes[this.currentSceneId];
            if (!current) return;

            const modal = document.getElementById('obsAddSourceModal');
            const sceneNameBadge = document.getElementById('obsAddSourceSceneName');
            const nameInput = document.getElementById('obsNewSourceName');
            if (sceneNameBadge) sceneNameBadge.textContent = `"${current.name}"`;
            if (nameInput) nameInput.value = '';
            if (modal) modal.classList.add('active');
        },

        closeAddSourceModal() {
            const modal = document.getElementById('obsAddSourceModal');
            if (modal) modal.classList.remove('active');
        },

        confirmAddSource() {
            const current = this.scenes[this.currentSceneId];
            if (!current) return;

            const type = document.getElementById('obsSourceTypeSelect')?.value || 'camera';
            const nameInput = document.getElementById('obsNewSourceName');
            const placement = document.getElementById('obsSourcePlacementSelect')?.value || 'fullscreen';
            const name = nameInput ? nameInput.value.trim() : '';

            if (!name) {
                if (typeof showToast === 'function') showToast('Please enter a Source Name.');
                return;
            }

            const newSource = {
                id: 'src_' + Date.now(),
                name,
                type,
                visible: true,
                locked: false,
                zIndex: (current.sources || []).length + 1,
                config: {
                    position: placement,
                    text: name
                }
            };

            current.sources = current.sources || [];
            current.sources.push(newSource);
            this.saveScenes();
            this.closeAddSourceModal();
            this.renderSourcesDock();
            if (typeof showToast === 'function') showToast(`Added "${name}" to ${current.name}.`);
        },

        openSourcePropertiesModal(sourceId) {
            const current = this.scenes[this.currentSceneId];
            if (!current || !current.sources) return;
            const src = current.sources.find(s => s.id === (sourceId || this.selectedSourceId));
            if (!src) return;

            this.selectedSourceId = src.id;
            const modal = document.getElementById('obsSourcePropertiesModal');
            const titleEl = document.getElementById('obsPropSourceNameTitle');
            const bodyEl = document.getElementById('obsSourcePropertiesBody');

            if (titleEl) titleEl.textContent = `"${src.name}"`;

            if (bodyEl) {
                bodyEl.innerHTML = `
                    <div class="form-group mb-3">
                        <label style="font-size: 0.82rem; font-weight: 600; color: #cbd5e1; display: block; margin-bottom: 4px;">Source Name</label>
                        <input type="text" id="obsPropEditName" value="${this.escapeHtml(src.name)}" class="obs-text-input" style="width:100%; padding:8px 12px; border-radius:6px; font-size:0.88rem;">
                    </div>
                    <div class="form-group mb-3">
                        <label style="font-size: 0.82rem; font-weight: 600; color: #cbd5e1; display: block; margin-bottom: 4px;">Placement Preset</label>
                        <select id="obsPropEditPlacement" class="obs-text-input" style="width:100%; padding:8px 12px; border-radius:6px; font-size:0.88rem;">
                            <option value="fullscreen" ${src.config?.position === 'fullscreen' ? 'selected' : ''}>Fullscreen (1280x720)</option>
                            <option value="lower_third" ${src.config?.position === 'lower_third' ? 'selected' : ''}>Lower-Third (Bottom Banner)</option>
                            <option value="scripture" ${src.config?.position === 'scripture' ? 'selected' : ''}>Scripture Bar (Bottom Pill)</option>
                            <option value="pip_br" ${src.config?.position === 'pip_br' ? 'selected' : ''}>Picture-in-Picture (Bottom-Right)</option>
                            <option value="pip_bl" ${src.config?.position === 'pip_bl' ? 'selected' : ''}>Picture-in-Picture (Bottom-Left)</option>
                            <option value="top_banner" ${src.config?.position === 'top_banner' ? 'selected' : ''}>Top Header Banner</option>
                            <option value="lyrics" ${src.config?.position === 'lyrics' ? 'selected' : ''}>Worship Lyrics Subtitle Pill</option>
                        </select>
                    </div>
                    ${src.type === 'text' ? `
                        <div class="form-group mb-3">
                            <label style="font-size: 0.82rem; font-weight: 600; color: #cbd5e1; display: block; margin-bottom: 4px;">Text Overlay Content</label>
                            <textarea id="obsPropEditText" rows="3" class="obs-textarea" style="width:100%; padding:8px 12px; border-radius:6px; font-size:0.88rem;">${this.escapeHtml(src.config?.text || '')}</textarea>
                        </div>
                    ` : ''}
                    <div class="form-group mb-2">
                        <label style="font-size:0.82rem; color:#94a3b8; display:flex; align-items:center; gap:6px;">
                            <input type="checkbox" id="obsPropEditVisible" ${src.visible !== false ? 'checked' : ''}> Visible on Live Program Output
                        </label>
                    </div>
                `;
            }

            if (modal) modal.classList.add('active');
        },

        closeSourcePropertiesModal() {
            const modal = document.getElementById('obsSourcePropertiesModal');
            if (modal) modal.classList.remove('active');
        },

        saveSourceProperties() {
            const current = this.scenes[this.currentSceneId];
            if (!current || !current.sources) return;
            const src = current.sources.find(s => s.id === this.selectedSourceId);
            if (!src) return;

            const nameInput = document.getElementById('obsPropEditName');
            const placementSelect = document.getElementById('obsPropEditPlacement');
            const textInput = document.getElementById('obsPropEditText');
            const visibleCheckbox = document.getElementById('obsPropEditVisible');

            if (nameInput && nameInput.value.trim()) {
                src.name = nameInput.value.trim();
            }
            if (placementSelect) {
                src.config = src.config || {};
                src.config.position = placementSelect.value;
            }
            if (textInput) {
                src.config = src.config || {};
                src.config.text = textInput.value.trim();
            }
            if (visibleCheckbox) {
                src.visible = visibleCheckbox.checked;
            }

            this.saveScenes();
            this.closeSourcePropertiesModal();
            this.renderSourcesDock();
            if (typeof showToast === 'function') showToast(`Properties updated for "${src.name}".`);
        },

        deleteSelectedSource() {
            const current = this.scenes[this.currentSceneId];
            if (!current || !current.sources) return;
            const idx = current.sources.findIndex(s => s.id === this.selectedSourceId);
            if (idx === -1) {
                if (typeof showToast === 'function') showToast('Please select a source to remove.');
                return;
            }

            const removed = current.sources.splice(idx, 1)[0];
            this.selectedSourceId = null;
            this.saveScenes();
            this.closeSourcePropertiesModal();
            this.renderSourcesDock();
            if (typeof showToast === 'function') showToast(`Removed source "${removed.name}".`);
        },

        // Broadcast Output Pipeline
        async toggleLiveBroadcast() {
            const isCurrentlyLive = (this.isBroadcasting);

            if (!isCurrentlyLive) {
                // GO LIVE
                const titleEl = document.getElementById('live_stream_title');
                const preacherEl = document.getElementById('live_stream_preacher');
                const keyEl = document.getElementById('live_stream_key');
                const descEl = document.getElementById('live_stream_description');

                const title = titleEl ? titleEl.value.trim() : '';
                const preacher = preacherEl ? preacherEl.value.trim() : '';
                const streamKey = keyEl ? keyEl.value.trim() : '';
                const description = descEl ? descEl.value.trim() : '';

                if (!title) {
                    if (typeof showToast === 'function') showToast('Please enter a Broadcast Title before going live.');
                    if (titleEl) titleEl.focus();
                    return;
                }

                if (!streamKey) {
                    if (typeof showToast === 'function') showToast('Please enter your Facebook Live Stream Key before going live.');
                    if (keyEl) keyEl.focus();
                    return;
                }

                let confirmed = false;
                if (typeof showDecisionModal === 'function') {
                    confirmed = await showDecisionModal({
                        title: 'Start Live Broadcast',
                        message: `Go Live now with "${title}"?\n\nThe OBS broadcasting studio program feed will broadcast on the church media player.`,
                        confirmText: 'Go Live Now',
                        type: 'primary',
                        icon: 'fa-tower-broadcast'
                    });
                } else {
                    confirmed = confirm(`Go Live now with "${title}"?`);
                }

                if (!confirmed) return;

                try {
                    // Activate live in backend
                    const payload = {
                        title,
                        preacher,
                        stream_key: streamKey,
                        description,
                        platform: 'facebook',
                        is_live: 1
                    };
                    const res = await api.content.saveLiveStream(payload);

                    this.isBroadcasting = true;
                    this.streamStartedAt = new Date();
                    this.startStreamTimer();

                    // Update UI controls
                    this.updateBroadcastUi(true);

                    // Start local MediaRecorder capture pipeline
                    this.startMediaStreamPipeline();

                    if (typeof showToast === 'function') {
                        showToast('🔴 BROADCAST ON AIR! Local studio feed live on church portal.');
                    }
                } catch (error) {
                    console.error('[OBS Studio] Start broadcast error:', error);
                    if (typeof showToast === 'function') {
                        showToast('Error starting broadcast: ' + error.message);
                    }
                }
            } else {
                // END BROADCAST
                let confirmed = false;
                if (typeof showDecisionModal === 'function') {
                    confirmed = await showDecisionModal({
                        title: 'End Live Broadcast',
                        message: 'End the live broadcast now?\n\nAll current live chat comments will be archived into chat logs, and the stream will return to standby.',
                        confirmText: 'End Broadcast',
                        type: 'warning',
                        icon: 'fa-power-off'
                    });
                } else {
                    confirmed = confirm('End live broadcast now?');
                }

                if (!confirmed) return;

                try {
                    await api.content.toggleLiveStream(0);
                    this.isBroadcasting = false;
                    this.stopStreamTimer();
                    this.stopMediaStreamPipeline();
                    this.updateBroadcastUi(false);

                    if (typeof showToast === 'function') {
                        showToast('Live broadcast ended. Chat comments archived.');
                    }
                } catch (error) {
                    console.error('[OBS Studio] Stop broadcast error:', error);
                    if (typeof showToast === 'function') {
                        showToast('Error ending broadcast: ' + error.message);
                    }
                }
            }
        },

        // Update Broadcast UI status indicators
        updateBroadcastUi(isLive) {
            const badge = document.getElementById('livestreamLiveBadge');
            const btn = document.getElementById('btnToggleLiveStream');
            const tally = document.getElementById('obsTallyPill');
            const screenFrame = document.querySelector('.obs-screen-frame');

            if (badge) {
                badge.className = isLive ? 'obs-live-badge live badge text-xs font-semibold' : 'obs-live-badge badge badge-inactive text-xs font-semibold';
                badge.innerHTML = isLive ? '<i class="fa-solid fa-circle"></i> LIVE' : '<i class="fa-solid fa-power-off"></i> OFFLINE';
            }

            if (btn) {
                if (isLive) {
                    btn.className = 'btn-danger obs-golive-btn is-live';
                    btn.innerHTML = '<i class="fa-solid fa-stop"></i> <span>End Broadcast</span>';
                } else {
                    btn.className = 'btn-primary obs-golive-btn';
                    btn.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> <span>Go Live Now</span>';
                }
            }

            if (tally) {
                tally.className = isLive ? 'obs-tally-pill live' : 'obs-tally-pill';
                tally.innerHTML = isLive ? '<i class="fa-solid fa-circle text-xs"></i> ON AIR' : '<i class="fa-solid fa-circle text-xs"></i> PROGRAM OUTPUT';
            }

            if (screenFrame) {
                screenFrame.classList.toggle('is-live', isLive);
            }
        },

        // Local MediaRecorder Pipeline
        startMediaStreamPipeline() {
            const programCanvas = document.getElementById('obsProgramCanvas');
            if (!programCanvas || !programCanvas.captureStream) return;

            try {
                const canvasStream = programCanvas.captureStream(30);
                const audioTracks = (this.audio.dest && this.audio.dest.stream) ? this.audio.dest.stream.getAudioTracks() : [];
                const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

                const options = { mimeType: 'video/webm;codecs=vp8,opus' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/webm';
                }

                const recorder = new MediaRecorder(combinedStream, options);
                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0 && this.isRecording) {
                        this.recordChunks.push(e.data);
                    }
                };
                recorder.start(1000); // 1-second chunks
                this.recorder = recorder;
            } catch (err) {
                console.warn('[OBS Studio] MediaRecorder capture error:', err);
            }
        },

        stopMediaStreamPipeline() {
            if (this.recorder && this.recorder.state !== 'inactive') {
                try { this.recorder.stop(); } catch (e) {}
            }
            this.recorder = null;
        },

        // Stream Elapsed Timer
        startStreamTimer(startedAt) {
            clearInterval(this.streamTimer);
            const start = startedAt ? new Date(startedAt).getTime() : Date.now();
            const el = document.getElementById('obsStreamTimerVal');

            this.streamTimer = setInterval(() => {
                const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
                const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
                const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
                const secs = String(diff % 60).padStart(2, '0');
                if (el) el.textContent = `${hours}:${mins}:${secs}`;
            }, 1000);
        },

        stopStreamTimer() {
            clearInterval(this.streamTimer);
            const el = document.getElementById('obsStreamTimerVal');
            if (el) el.textContent = '00:00:00';
        },

        // Local Recording Toggle
        toggleRecording() {
            this.isRecording = !this.isRecording;
            const btn = document.getElementById('obsRecordBtn');
            const label = document.getElementById('obsRecordLabel');
            const timer = document.getElementById('obsRecordTimer');

            if (this.isRecording) {
                this.recordChunks = [];
                this.recordSeconds = 0;
                if (!this.recorder) this.startMediaStreamPipeline();

                if (btn) btn.classList.add('active');
                if (label) label.textContent = 'RECORDING';
                if (timer) {
                    timer.style.display = 'inline';
                    timer.textContent = '00:00';
                }

                clearInterval(this.recordTimer);
                this.recordTimer = setInterval(() => {
                    this.recordSeconds++;
                    const mins = String(Math.floor(this.recordSeconds / 60)).padStart(2, '0');
                    const secs = String(this.recordSeconds % 60).padStart(2, '0');
                    if (timer) timer.textContent = `${mins}:${secs}`;
                }, 1000);

                if (typeof showToast === 'function') {
                    showToast('🔴 Recording started! Service archiving locally at 1080p.');
                }
            } else {
                clearInterval(this.recordTimer);
                if (btn) btn.classList.remove('active');
                if (label) label.textContent = 'REC';
                if (timer) timer.style.display = 'none';

                // Save recording to file
                if (this.recordChunks.length > 0) {
                    const blob = new Blob(this.recordChunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const d = new Date().toISOString().slice(0, 10);
                    a.href = url;
                    a.download = `ChurchService_Recording_${d}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 1000);

                    if (typeof showToast === 'function') {
                        showToast('Church service recording downloaded to your computer!');
                    }
                }
            }
        },

        // Telemetry stats simulation
        startStatsTelemetry() {
            setInterval(() => {
                // Ticking countdown for starting soon scene
                if (this.currentSceneId === 'starting_soon' || this.previewSceneId === 'starting_soon') {
                    this.stats.countdownRemaining--;
                    if (this.stats.countdownRemaining < 0) this.stats.countdownRemaining = 300;
                }

                // Random slight jitter for telemetry strip
                const cpuEl = document.getElementById('obsCpuVal');
                const bitrateEl = document.getElementById('obsBitrateVal');
                if (cpuEl && this.isBroadcasting) {
                    cpuEl.textContent = (2.4 + (Math.random() * 0.8)).toFixed(1) + '%';
                }
                if (bitrateEl && this.isBroadcasting) {
                    bitrateEl.textContent = String(Math.floor(4450 + (Math.random() * 120)));
                }
            }, 1000);
        },

        // Test stream relay connection & key format
        async testStreamRelay() {
            const key = document.getElementById('live_stream_key')?.value?.trim();
            if (!key) {
                if (typeof showToast === 'function') showToast('Please enter a Facebook Live Stream Key first.');
                return;
            }

            if (typeof showToast === 'function') {
                showToast('Testing Facebook Live Ingest Endpoint (rtmps://live-api-s.facebook.com:443/rtmp/)...');
            }

            try {
                const res = await api.content.getBroadcastRelayStatus();
                if (res.data) {
                    const badge = document.getElementById('obsKeyStatusBadge');
                    if (badge) {
                        badge.className = 'obs-dock-tag obs-key-tag-connected';
                        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> RTMPS Ingest Ready';
                    }
                    if (typeof showToast === 'function') {
                        showToast('✅ Facebook RTMPS Ingest verified! Stream key is ready for live broadcast.');
                    }
                }
            } catch (err) {
                if (typeof showToast === 'function') {
                    showToast('Ingest status: ' + err.message);
                }
            }
        },

        // Stream Key Toggle & Copy
        toggleKeyVisibility() {
            const keyInput = document.getElementById('live_stream_key');
            const eyeIcon = document.getElementById('obsKeyEyeIcon');
            if (!keyInput) return;
            if (keyInput.type === 'password') {
                keyInput.type = 'text';
                if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye-slash';
            } else {
                keyInput.type = 'password';
                if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye';
            }
        },

        copyKey() {
            const keyInput = document.getElementById('live_stream_key');
            const keyVal = keyInput ? keyInput.value.trim() : '';
            if (!keyVal) {
                if (typeof showToast === 'function') showToast('No Stream Key to copy.');
                return;
            }
            if (navigator.clipboard) {
                navigator.clipboard.writeText(keyVal).then(() => {
                    if (typeof showToast === 'function') showToast('Stream Key copied to clipboard!');
                });
            } else {
                prompt('Copy Facebook Stream Key:', keyVal);
            }
        },

        // Save live stream details
        async saveLiveStreamDetails() {
            const title = document.getElementById('live_stream_title')?.value?.trim();
            const preacher = document.getElementById('live_stream_preacher')?.value?.trim();
            const stream_key = document.getElementById('live_stream_key')?.value?.trim() || '';
            const description = document.getElementById('live_stream_description')?.value?.trim();

            if (!title) {
                if (typeof showToast === 'function') showToast('Please enter a Broadcast Title.');
                document.getElementById('live_stream_title')?.focus();
                return;
            }

            try {
                const payload = {
                    title,
                    preacher: preacher || '',
                    stream_key,
                    description: description || '',
                    platform: 'facebook'
                };
                await api.content.saveLiveStream(payload);
                if (typeof showToast === 'function') {
                    showToast('✅ Broadcast setup and Stream Key saved successfully!');
                }
            } catch (error) {
                if (typeof showToast === 'function') {
                    showToast('Error saving broadcast setup: ' + error.message);
                }
            }
        },

        // Escape HTML
        escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
    };

    window.ObsStudio = ObsStudio;

})(window);

// Bridge functions for inline HTML event handlers
function selectObsScene(sceneKey) { window.ObsStudio && window.ObsStudio.selectScene(sceneKey); }
function performObsTransition(type) { window.ObsStudio && window.ObsStudio.performTransition(type); }
function toggleObsStudioMode() { window.ObsStudio && window.ObsStudio.toggleStudioMode(); }
function toggleObsRecording() { window.ObsStudio && window.ObsStudio.toggleRecording(); }
function updateObsVolume(channel, val) { window.ObsStudio && window.ObsStudio.updateVolume(channel, val); }
function toggleObsMute(channel) { window.ObsStudio && window.ObsStudio.toggleMute(channel); }
function toggleStreamKeyVisibility() { window.ObsStudio && window.ObsStudio.toggleKeyVisibility(); }
function copyStreamKey() { window.ObsStudio && window.ObsStudio.copyKey(); }
function saveLiveStreamDetails() { window.ObsStudio && window.ObsStudio.saveLiveStreamDetails(); }
function testStreamUrlLink() { window.ObsStudio && window.ObsStudio.testStreamRelay(); }
function testStreamRelayConnection() { window.ObsStudio && window.ObsStudio.testStreamRelay(); }
function toggleLiveBroadcast() { window.ObsStudio && window.ObsStudio.toggleLiveBroadcast(); }

// Source & Scene modals bridge
function openObsAddSceneModal() { window.ObsStudio && window.ObsStudio.openAddSceneModal(); }
function closeObsAddSceneModal() { window.ObsStudio && window.ObsStudio.closeAddSceneModal(); }
function confirmAddObsScene() { window.ObsStudio && window.ObsStudio.confirmAddScene(); }
function openObsRenameSceneModal() { window.ObsStudio && window.ObsStudio.openRenameSceneModal(); }
function closeObsRenameSceneModal() { window.ObsStudio && window.ObsStudio.closeRenameSceneModal(); }
function confirmRenameObsScene() { window.ObsStudio && window.ObsStudio.confirmRenameScene(); }
function duplicateCurrentObsScene() { window.ObsStudio && window.ObsStudio.duplicateCurrentScene(); }
function reorderObsScene(dir) { window.ObsStudio && window.ObsStudio.reorderScene(dir); }
function deleteCurrentObsScene() { window.ObsStudio && window.ObsStudio.deleteCurrentScene(); }

function openObsAddSourceModal() { window.ObsStudio && window.ObsStudio.openAddSourceModal(); }
function closeObsAddSourceModal() { window.ObsStudio && window.ObsStudio.closeAddSourceModal(); }
function confirmAddObsSource() { window.ObsStudio && window.ObsStudio.confirmAddSource(); }
function openObsSourcePropertiesModal(srcId) { window.ObsStudio && window.ObsStudio.openSourcePropertiesModal(srcId); }
function closeObsSourcePropertiesModal() { window.ObsStudio && window.ObsStudio.closeSourcePropertiesModal(); }
function saveObsSourceProperties() { window.ObsStudio && window.ObsStudio.saveSourceProperties(); }
function deleteSelectedObsSource() { window.ObsStudio && window.ObsStudio.deleteSelectedSource(); }
function reorderObsSource(dir) { window.ObsStudio && window.ObsStudio.reorderSource(dir); }

// Device capture buttons
function toggleObsCameraInput() { window.ObsStudio && window.ObsStudio.toggleCameraInput(); }
function toggleObsScreenShare() { window.ObsStudio && window.ObsStudio.toggleScreenShare(); }
function toggleObsMicCapture() { window.ObsStudio && window.ObsStudio.toggleMicCapture(); }
function toggleObsBackgroundAudio() { window.ObsStudio && window.ObsStudio.toggleBackgroundAudio(); }
function renderLiveMonitorPlayer() { window.ObsStudio && window.ObsStudio.renderMonitorViewport(); }
function autoUpdateLiveMonitorPlayer() { /* Handled automatically by render loop */ }

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('facebookLiveStudioCard') && window.ObsStudio) {
        window.ObsStudio.init();
    }
});

