/**
 * Peer Manager for DAW Collaboration Tool
 * Handles PeerJS connection establishment and management
 */

class PeerManager {
    constructor() {
        this.peer = null;
        this.connections = {};
        this.calls = {};
        this.peerId = null;
        this.isConnected = false;
        this.statsIntervals = {}; // For tracking stats monitoring intervals
    }
    
    /**
     * Initialize the PeerJS connection with enhanced configuration
     * @param {boolean} isCreator Whether this peer is creating a new session
     * @returns {Promise} Promise that resolves when peer is initialized
     */
    initPeer(isCreator = true) {
        return new Promise((resolve, reject) => {
            try {
                // If already initialized, destroy first
                if (this.peer) {
                    this.peer.destroy();
                }
                
                // Generate a custom ID if creating a session, otherwise use random ID
                const customId = isCreator ? `daw-${utils.generateRandomId(8)}` : null;
                
                // Enhanced ICE server configuration
                const enhancedIceServers = [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    // Add more STUN servers for redundancy
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' }
                ];
                
                // Create a new Peer with enhanced configuration
                this.peer = new Peer(customId, {
                    debug: 2,
                    config: {
                        iceServers: enhancedIceServers,
                        iceTransportPolicy: 'all',
                        bundlePolicy: 'max-bundle',
                        rtcpMuxPolicy: 'require',
                        iceCandidatePoolSize: 10  // Faster connection establishment
                    }
                });
                
                // When peer is initialized
                this.peer.on('open', (id) => {
                    this.peerId = id;
                    utils.log(`Session created with ID: ${id}`);
                    
                    // Update UI
                    utils.$('#myPeerId').textContent = `Your Session ID: ${id}`;
                    utils.$('#sessionIdInput').value = isCreator ? id : utils.$('#sessionIdInput').value;
                    utils.$('#connectionStatus').textContent = `Status: Session created with ID: ${id}`;
                    
                    this.isConnected = true;
                    resolve(id);
                });
                
                // When a connection is received
                this.peer.on('connection', (conn) => {
                    this.handleConnection(conn);
                });
                
                // When a call is received
                this.peer.on('call', (call) => {
                    this.handleIncomingCall(call);
                });
                
                // Handle errors
                this.peer.on('error', (err) => {
                    utils.log(`Peer error: ${err.type} - ${err.message}`);
                    utils.$('#connectionStatus').textContent = `Error: ${err.type}`;
                    
                    if (err.type === 'peer-unavailable') {
                        utils.showNotification('Peer not found. Check the Session ID and try again.', 'error');
                    }
                    
                    reject(err);
                });
                
                // Handle disconnection
                this.peer.on('disconnected', () => {
                    utils.log('Peer disconnected');
                    utils.$('#connectionStatus').textContent = 'Status: Disconnected';
                    this.isConnected = false;
                });
                
                // Handle closure
                this.peer.on('close', () => {
                    utils.log('Peer connection closed');
                    utils.$('#connectionStatus').textContent = 'Status: Disconnected';
                    this.isConnected = false;
                });
                
            } catch (error) {
                utils.log(`Error initializing peer: ${error.message}`);
                reject(error);
            }
        });
    }
    
    /**
     * Connect to a remote peer
     * @param {string} remotePeerId The ID of the remote peer
     * @returns {Promise} Promise that resolves when connection is established
     */
    connectToPeer(remotePeerId) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.peer) {
                    reject(new Error('Peer not initialized'));
                    return;
                }
                
                utils.log(`Connecting to peer: ${remotePeerId}`);
                
                // First create a data connection
                const conn = this.peer.connect(remotePeerId, {
                    reliable: true
                });
                
                // Handle connection events
                conn.on('open', () => {
                    this.handleConnection(conn);
                    
                    // Then create a media connection (call)
                    this.callPeer(remotePeerId).then(() => {
                        resolve(conn);
                    }).catch(reject);
                });
                
                conn.on('error', (err) => {
                    utils.log(`Connection error: ${err}`);
                    reject(err);
                });
                
            } catch (error) {
                utils.log(`Error connecting to peer: ${error.message}`);
                reject(error);
            }
        });
    }
    
    /**
     * Call a peer to establish audio streaming with optimized settings for low latency
     * @param {string} remotePeerId The ID of the remote peer
     * @returns {Promise} Promise that resolves when call is established
     */
    callPeer(remotePeerId) {
        return new Promise((resolve, reject) => {
            try {
                if (!audioManager.getLocalStream()) {
                    reject(new Error('Local stream not available'));
                    return;
                }
                
                utils.log(`Calling peer: ${remotePeerId}`);
                
                // Audio constraints optimized for low latency
                const audioConstraints = {
                    advanced: [
                        { googHighpassFilter: false },
                        { googEchoCancellation: false },
                        { googEchoCancellation2: false },
                        { googAutoGainControl: false },
                        { googAutoGainControl2: false },
                        { googNoiseSuppression: false },
                        { googNoiseSuppression2: false },
                        { googTypingNoiseDetection: false }
                    ]
                };
                
                // Make the call with optimized settings
                const call = this.peer.call(remotePeerId, audioManager.getLocalStream(), {
                    metadata: {
                        audioOnly: true,
                        sampleRate: audioManager.sampleRate,
                        bufferSize: audioManager.bufferSize,
                        // Add codec preferences for low latency
                        codecPreferences: ['opus', 'G722', 'PCMU', 'PCMA']
                    },
                    // SDP transform to prioritize audio and reduce latency
                    sdpTransform: (sdp) => {
                        // Prioritize audio packets
                        sdp = sdp.replace(/(m=audio.*\r\n)/g, '$1a=mid:0\r\na=priority:high\r\n');
                        
                        // Optimize for low latency audio
                        sdp = sdp.replace(/a=rtpmap:(\d+) opus\/48000\/2/g, 
                                          'a=rtpmap:$1 opus/48000/2\r\na=fmtp:$1 minptime=10;useinbandfec=1;stereo=1;maxaveragebitrate=128000;maxplaybackrate=48000;cbr=1;ptime=10');
                        
                        // Reduce packet size and buffer time
                        sdp = sdp.replace(/a=maxptime:.*\r\n/g, 'a=maxptime:20\r\n');
                        
                        // Disable video
                        sdp = sdp.replace(/m=video.*\r\n/g, '');
                        
                        // Ensure UDP is used (not TCP)
                        sdp = sdp.replace(/a=candidate:.*tcp.*\r\n/g, '');
                        
                        return sdp;
                    }
                });
                
                this.calls[remotePeerId] = call;
                
                // Configure adaptivity for jitter buffer
                if (call.peerConnection) {
                    // Set up dynamic adjustment of jitter buffer
                    this.setupAdaptiveJitterBuffer(call.peerConnection, remotePeerId);
                }
                
                // Handle the call events
                call.on('stream', (remoteStream) => {
                    utils.log(`Received remote stream from: ${remotePeerId}`);
                    
                    // Log detailed info about received tracks
                    const audioTracks = remoteStream.getAudioTracks();
                    utils.log(`Remote stream has ${audioTracks.length} audio tracks`);
                    
                    audioTracks.forEach((track, index) => {
                        utils.log(`Track ${index} - enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`);
                        
                        // Set track constraints for low latency
                        try {
                            track.applyConstraints(audioConstraints);
                            utils.log(`Applied low-latency constraints to track ${index}`);
                        } catch (e) {
                            utils.log(`Could not apply constraints to track ${index}: ${e.message}`);
                        }
                        
                        // Ensure tracks are enabled
                        if (!track.enabled) {
                            utils.log(`Enabling disabled track ${index}`);
                            track.enabled = true;
                        }
                    });
                    
                    // Ensure audio context is resumed
                    if (audioManager.audioContext && audioManager.audioContext.state !== 'running') {
                        utils.log(`Resuming suspended audio context (state: ${audioManager.audioContext.state})`);
                        audioManager.audioContext.resume().then(() => {
                            utils.log(`Audio context resumed successfully, now: ${audioManager.audioContext.state}`);
                            this.forceAudioProcess(remoteStream, remotePeerId);
                        });
                    } else {
                        this.forceAudioProcess(remoteStream, remotePeerId);
                    }
                    
                    resolve(call);
                });
                
                call.on('error', (err) => {
                    utils.log(`Call error: ${err}`);
                    reject(err);
                });
                
                call.on('close', () => {
                    utils.log(`Call with ${remotePeerId} closed`);
                    this.handlePeerDisconnection(remotePeerId);
                });
                
            } catch (error) {
                utils.log(`Error calling peer: ${error.message}`);
                reject(error);
            }
        });
    }
    
    /**
     * Handle an incoming connection
     * @param {DataConnection} conn The data connection
     */
    handleConnection(conn) {
        utils.log(`Connection established with: ${conn.peer}`);
        
        // Store the connection
        this.connections[conn.peer] = conn;
        
        // Handle connection opening
        conn.on('open', () => {
            utils.log(`Connection opened with: ${conn.peer}`);
            
            // Add to UI
            UIController.addPeerToList(conn.peer);
            utils.$('#connectionStatus').textContent = `Status: Connected to ${conn.peer}`;
            
            // Start latency monitoring with simplified approach
            if (window.latencyMonitor) {
                latencyMonitor.startMonitoring(conn.peer, conn);
            }
            
            // Send audio settings
            conn.send({
                type: 'audio-settings',
                settings: audioManager.getAudioSettings()
            });
        });
        
        // Handle data with global handler first
        conn.on('data', (data) => {
            // Log all incoming data for debugging
            console.log(`Data received from ${conn.peer}:`, data);
            
            // Check if data is valid
            if (!data || typeof data !== 'object' || !data.type) {
                console.log(`Invalid data received from ${conn.peer}`);
                return;
            }
            
            // First check for stats-update type
            if (data.type === 'stats-update') {
                console.log(`Received stats update from ${conn.peer}:`, data.stats);
                
                // Check if latencyMonitor exists
                if (window.latencyMonitor && data.stats) {
                    // Update the latency display
                    const rtt = data.stats.rtt || 50;
                    const jitter = data.stats.jitter || 10;
                    latencyMonitor.updateLatencyDisplay(conn.peer, rtt, jitter);
                }
                return;
            }
            
            // Try the global stats handler if available
            if (window.globalStatsHandler && window.globalStatsHandler(conn.peer, data)) {
                // Message was handled by the global handler, no need to process further
                return;
            }
            
            // Process other message types
            if (data.type === 'audio-settings') {
                utils.log(`Received audio settings from ${conn.peer}: ${JSON.stringify(data.settings)}`);
            } else if (data.type === 'chat') {
                utils.log(`${conn.peer}: ${data.message}`);
            } else {
                // Log unknown message types
                utils.log(`Received unknown message type from ${conn.peer}: ${data.type}`);
            }
        });
        
        // Handle connection closing
        conn.on('close', () => {
            utils.log(`Connection with ${conn.peer} closed`);
            this.handlePeerDisconnection(conn.peer);
        });
        
        // Handle connection errors
        conn.on('error', (err) => {
            utils.log(`Connection error with ${conn.peer}: ${err}`);
        });
    }
    
    /**
     * Handle an incoming call with optimized settings
     * @param {MediaConnection} call The media connection
     */
    handleIncomingCall(call) {
        utils.log(`Incoming call from: ${call.peer}`);
        
        // Store the call
        this.calls[call.peer] = call;
        
        // Audio constraints optimized for low latency
        const audioConstraints = {
            advanced: [
                { googHighpassFilter: false },
                { googEchoCancellation: false },
                { googEchoCancellation2: false },
                { googAutoGainControl: false },
                { googAutoGainControl2: false },
                { googNoiseSuppression: false },
                { googNoiseSuppression2: false },
                { googTypingNoiseDetection: false }
            ]
        };
        
        // Answer the call with optimized settings
        call.answer(audioManager.getLocalStream(), {
            sdpTransform: (sdp) => {
                // Prioritize audio packets
                sdp = sdp.replace(/(m=audio.*\r\n)/g, '$1a=mid:0\r\na=priority:high\r\n');
                
                // Optimize for low latency audio
                sdp = sdp.replace(/a=rtpmap:(\d+) opus\/48000\/2/g, 
                                'a=rtpmap:$1 opus/48000/2\r\na=fmtp:$1 minptime=10;useinbandfec=1;stereo=1;maxaveragebitrate=128000;maxplaybackrate=48000;cbr=1;ptime=10');
                
                // Reduce packet size and buffer time
                sdp = sdp.replace(/a=maxptime:.*\r\n/g, 'a=maxptime:20\r\n');
                
                // Disable video
                sdp = sdp.replace(/m=video.*\r\n/g, '');
                
                // Ensure UDP is used (not TCP)
                sdp = sdp.replace(/a=candidate:.*tcp.*\r\n/g, '');
                
                return sdp;
            }
        });
        
        // Configure adaptivity for jitter buffer
        if (call.peerConnection) {
            // Set up dynamic adjustment of jitter buffer
            this.setupAdaptiveJitterBuffer(call.peerConnection, call.peer);
        }
        
        // Handle the incoming stream
        call.on('stream', (remoteStream) => {
            utils.log(`Received remote stream from: ${call.peer}`);
            
            // Log detailed info about received tracks
            const audioTracks = remoteStream.getAudioTracks();
            utils.log(`Remote stream has ${audioTracks.length} audio tracks`);
            
            audioTracks.forEach((track, index) => {
                utils.log(`Track ${index} - enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`);
                
                // Set track constraints for low latency
                try {
                    track.applyConstraints(audioConstraints);
                    utils.log(`Applied low-latency constraints to track ${index}`);
                } catch (e) {
                    utils.log(`Could not apply constraints to track ${index}: ${e.message}`);
                }
                
                // Ensure tracks are enabled
                if (!track.enabled) {
                    utils.log(`Enabling disabled track ${index}`);
                    track.enabled = true;
                }
            });
            
            // Ensure audio context is resumed
            if (audioManager.audioContext && audioManager.audioContext.state !== 'running') {
                utils.log(`Resuming suspended audio context (state: ${audioManager.audioContext.state})`);
                audioManager.audioContext.resume().then(() => {
                    utils.log(`Audio context resumed successfully, now: ${audioManager.audioContext.state}`);
                    this.forceAudioProcess(remoteStream, call.peer);
                });
            } else {
                this.forceAudioProcess(remoteStream, call.peer);
            }
        });
        
        call.on('error', (err) => {
            utils.log(`Call error: ${err}`);
        });
        
        call.on('close', () => {
            utils.log(`Call with ${call.peer} closed`);
            this.handlePeerDisconnection(call.peer);
        });
    }
    
    /**
     * Set up adaptive jitter buffer based on network conditions
     * @param {RTCPeerConnection} peerConnection The WebRTC peer connection
     * @param {string} peerId The peer ID for logging
     */
    setupAdaptiveJitterBuffer(peerConnection, peerId) {
        // Initial buffer size based on audio settings
        let currentJitterBufferMs = 50; // Default starting point
        let previousJitter = 0;
        
        // Start monitoring stats
        const statsInterval = setInterval(() => {
            if (!peerConnection || peerConnection.connectionState !== 'connected') {
                clearInterval(statsInterval);
                return;
            }
            
            peerConnection.getStats().then(stats => {
                stats.forEach(report => {
                    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                        const currentJitter = report.jitter * 1000; // Convert to ms
                        const packetsLost = report.packetsLost || 0;
                        const packetsReceived = report.packetsReceived || 1;
                        const lossRate = packetsLost / (packetsLost + packetsReceived);
                        
                        utils.log(`Peer ${peerId} - Jitter: ${currentJitter.toFixed(2)}ms, Loss rate: ${(lossRate * 100).toFixed(2)}%`);
                        
                        // Adaptive buffer size calculation
                        // If jitter is increasing, increase buffer
                        if (currentJitter > previousJitter * 1.2) { // Jitter increased by 20%
                            currentJitterBufferMs = Math.min(200, currentJitterBufferMs * 1.5);
                            utils.log(`Increasing jitter buffer to ${currentJitterBufferMs.toFixed(2)}ms`);
                        } 
                        // If jitter is stable or decreasing and loss rate is low, decrease buffer
                        else if (currentJitter <= previousJitter && lossRate < 0.01) {
                            currentJitterBufferMs = Math.max(20, currentJitterBufferMs * 0.8);
                            utils.log(`Decreasing jitter buffer to ${currentJitterBufferMs.toFixed(2)}ms`);
                        }
                        
                        previousJitter = currentJitter;
                        
                        // Apply the new jitter buffer size
                        this.updateAudioProcessingForLatency(peerId, currentJitterBufferMs);
                    }
                });
            }).catch(e => {
                utils.log(`Error getting stats: ${e.message}`);
            });
        }, 2000);
        
        // Store the interval for cleanup
        this.statsIntervals = this.statsIntervals || {};
        this.statsIntervals[peerId] = statsInterval;
    }
    
    /**
     * Update audio processing based on current network conditions
     * @param {string} peerId The peer ID
     * @param {number} bufferMs The buffer size in milliseconds
     */
    updateAudioProcessingForLatency(peerId, bufferMs) {
        // Adjust audio processing parameters based on current network conditions
        const remoteInfo = audioManager.remoteStreams[peerId];
        if (remoteInfo && audioManager.audioContext) {
            try {
                // Calculate buffer size in samples based on sample rate
                const sampleRate = audioManager.audioContext.sampleRate;
                const bufferSize = Math.pow(2, Math.ceil(Math.log2(sampleRate * bufferMs / 1000)));
                
                // Log the adjustment
                utils.log(`Adjusting audio processing for peer ${peerId}: buffer=${bufferMs}ms (${bufferSize} samples)`);
                
                // In a production app, you would adjust Web Audio API nodes here
                // This is a simplified implementation
            } catch (e) {
                utils.log(`Error adjusting audio processing: ${e.message}`);
            }
        }
    }
    
    /**
     * New method to force proper audio processing
     * @param {MediaStream} remoteStream The remote audio stream
     * @param {string} peerId The ID of the remote peer
     */
    forceAudioProcess(remoteStream, peerId) {
        utils.log(`Forcing audio processing for peer: ${peerId}`);
        
        // First remove any existing stream for this peer
        if (audioManager.remoteStreams[peerId]) {
            try {
                if (audioManager.remoteStreams[peerId].source) {
                    audioManager.remoteStreams[peerId].source.disconnect();
                }
                if (audioManager.remoteStreams[peerId].gain) {
                    audioManager.remoteStreams[peerId].gain.disconnect();
                }
            } catch (e) {
                utils.log(`Error cleaning up old stream: ${e.message}`);
            }
        }
        
        // Create a working HTML5 audio element as a fallback/parallel path
        try {
            const audioEl = document.createElement('audio');
            audioEl.id = `audio-fallback-${peerId}`;
            audioEl.style.display = 'none';
            audioEl.srcObject = remoteStream;
            audioEl.autoplay = true;
            document.body.appendChild(audioEl);
            
            audioEl.onloadedmetadata = () => {
                utils.log(`Audio element ready for peer ${peerId}, playing...`);
                audioEl.play().catch(e => utils.log(`Error playing audio: ${e.message}`));
            };
            utils.log(`Created fallback audio element for peer ${peerId}`);
        } catch (e) {
            utils.log(`Error creating fallback audio element: ${e.message}`);
        }
        
        // Process through Web Audio API as well
        try {
            // We need to ensure the audio context is running
            if (audioManager.audioContext.state !== 'running') {
                utils.log(`Audio context still not running, attempting user interaction fix`);
                
                // Create and trigger a silent audio context - this can help with autoplay policies
                const silentContext = new (window.AudioContext || window.webkitAudioContext)();
                const silentBuffer = silentContext.createBuffer(1, 1, 22050);
                const silentSource = silentContext.createBufferSource();
                silentSource.buffer = silentBuffer;
                silentSource.connect(silentContext.destination);
                silentSource.start();
                
                // Now try to resume our main context again
                setTimeout(() => {
                    audioManager.audioContext.resume().then(() => {
                        utils.log(`Audio context resumed after silent sound`);
                        audioManager.processRemoteStream(remoteStream, peerId);
                        
                        // Force an update to the UI
                        setTimeout(() => {
                            const remoteMeter = utils.$(`#remoteMeter-${peerId}`);
                            if (remoteMeter) {
                                remoteMeter.value = 10; // Set a non-zero value to show activity
                                setTimeout(() => {
                                    remoteMeter.value = 0; // Reset back
                                }, 300);
                            }
                        }, 500);
                    });
                }, 200);
            } else {
                // Normal processing path
                audioManager.processRemoteStream(remoteStream, peerId);
            }
        } catch (e) {
            utils.log(`Error in forceAudioProcess: ${e.message}`);
        }
        
        // Set a verification check after a delay
        setTimeout(() => {
            this.verifyAudioConnection(peerId);
        }, 2000);
    }
    
    /**
     * Verify audio is working
     * @param {string} peerId The ID of the remote peer
     */
    verifyAudioConnection(peerId) {
        utils.log(`Verifying audio connection for peer: ${peerId}`);
        
        // Check if stream exists
        const remoteInfo = audioManager.remoteStreams[peerId];
        if (!remoteInfo) {
            utils.log(`Remote stream info not found for peer ${peerId}`);
            return;
        }
        
        // Check audio tracks
        if (remoteInfo.stream) {
            const audioTracks = remoteInfo.stream.getAudioTracks();
            if (audioTracks.length === 0) {
                utils.log(`WARNING: No audio tracks in remote stream for peer ${peerId}`);
                return;
            }
            
            // Check track status
            audioTracks.forEach((track, index) => {
                if (!track.enabled || track.muted || track.readyState !== 'live') {
                    utils.log(`WARNING: Track ${index} has issues - enabled: ${track.enabled}, muted: ${track.muted}, state: ${track.readyState}`);
                    
                    // Try to fix track
                    track.enabled = true;
                }
            });
        }
        
        // Check audio context state again
        if (audioManager.audioContext && audioManager.audioContext.state !== 'running') {
            utils.log(`WARNING: Audio context still not running! State: ${audioManager.audioContext.state}`);
            
            // Request user to interact with the page
            utils.showNotification(
                'Audio playback blocked. Please click anywhere on the page to enable audio.',
                'info'
            );
        }
        
        // Check if fallback audio element exists and is playing
        const fallbackEl = document.getElementById(`audio-fallback-${peerId}`);
        if (fallbackEl) {
            utils.log(`Fallback audio element status - paused: ${fallbackEl.paused}, muted: ${fallbackEl.muted}, readyState: ${fallbackEl.readyState}`);
            
            if (fallbackEl.paused) {
                utils.log(`Attempting to restart fallback audio playback`);
                fallbackEl.play().catch(e => utils.log(`Error playing fallback audio: ${e.message}`));
            }
        }
        
        // Check audio nodes
        if (remoteInfo.source && remoteInfo.gain && remoteInfo.analyser) {
            utils.log(`Audio nodes exist for peer ${peerId}`);
            
            // Check analyzer data to see if we're getting any signal
            if (remoteInfo.analyser && remoteInfo.dataArray) {
                remoteInfo.analyser.getByteFrequencyData(remoteInfo.dataArray);
                const sum = Array.from(remoteInfo.dataArray).reduce((a, b) => a + b, 0);
                const avg = sum / remoteInfo.dataArray.length;
                
                utils.log(`Remote audio level: ${avg.toFixed(2)}`);
                if (avg < 1) {
                    utils.log(`WARNING: No audio signal detected from peer ${peerId}`);
                    
                    // Try reconnecting audio nodes
                    try {
                        remoteInfo.source.disconnect();
                        remoteInfo.gain.disconnect();
                        
                        remoteInfo.source.connect(remoteInfo.analyser);
                        remoteInfo.source.connect(remoteInfo.gain);
                        remoteInfo.gain.connect(audioManager.audioContext.destination);
                        
                        utils.log(`Reconnected audio nodes for peer ${peerId}`);
                    } catch (e) {
                        utils.log(`Error reconnecting audio nodes: ${e.message}`);
                    }
                }
            }
        } else {
            utils.log(`WARNING: Audio nodes missing for peer ${peerId}`);
        }
        
        // Add a fix button to the UI
        this.addFixAudioButton(peerId);
    }
    
    /**
     * Add an emergency fix button
     * @param {string} peerId The ID of the remote peer
     */
    addFixAudioButton(peerId) {
        const peerItem = utils.$(`#peer-${peerId}`);
        if (!peerItem) return;
        
        // Check if button already exists
        if (utils.$(`#fix-audio-${peerId}`)) return;
        
        const fixBtn = document.createElement('button');
        fixBtn.id = `fix-audio-${peerId}`;
        fixBtn.textContent = 'Fix Audio';
        fixBtn.className = 'small-button';
        fixBtn.style.backgroundColor = '#cf6679';
        fixBtn.style.marginLeft = '5px';
        
        fixBtn.addEventListener('click', () => {
            utils.log(`Manual audio fix requested for peer ${peerId}`);
            
            // Try to resume audio context first
            if (audioManager.audioContext) {
                audioManager.audioContext.resume().then(() => {
                    utils.log(`Audio context resumed by user action`);
                });
            }
            
            // Try to play fallback audio
            const fallbackEl = document.getElementById(`audio-fallback-${peerId}`);
            if (fallbackEl) {
                fallbackEl.play().catch(e => utils.log(`Error playing fallback audio: ${e.message}`));
            }
            
            // Force stream reprocessing if we have the stream
            const call = this.calls[peerId];
            if (call && call.remoteStream) {
                this.forceAudioProcess(call.remoteStream, peerId);
            } else {
                utils.log(`Cannot find remote stream for peer ${peerId}`);
            }
        });
        
        peerItem.appendChild(fixBtn);
    }
    
    /**
     * Handle peer disconnection and cleanup all resources
     * @param {string} peerId The ID of the peer that disconnected
     */
    handlePeerDisconnection(peerId) {
        // Remove connections
        if (this.connections[peerId]) {
            delete this.connections[peerId];
        }
        
        // Remove calls
        if (this.calls[peerId]) {
            delete this.calls[peerId];
        }
        
        // Stop stats monitoring for adaptive jitter buffer
        if (this.statsIntervals && this.statsIntervals[peerId]) {
            clearInterval(this.statsIntervals[peerId]);
            delete this.statsIntervals[peerId];
        }
        
        // Stop latency monitoring
        if (window.latencyMonitor) {
            latencyMonitor.stopMonitoring(peerId);
        }
        
        // Remove from audio manager
        audioManager.removeRemoteStream(peerId);
        
        // Remove from UI
        UIController.removePeerFromList(peerId);
        
        // Update connection status if no peers left
        if (Object.keys(this.connections).length === 0) {
            utils.$('#connectionStatus').textContent = 'Status: No peers connected';
        }
    }

        /**
     * Send a message to all connected peers
     * @param {Object} message The message to send
     */
    sendToAllPeers(message) {
        for (const peerId in this.connections) {
            if (this.connections[peerId].open) {
                this.connections[peerId].send(message);
            }
        }
    }

        /**
     * Disconnect from all peers and close the connection
     */
    disconnect() {
        // Close all connections
        for (const peerId in this.connections) {
            if (this.connections[peerId].open) {
                this.connections[peerId].close();
            }
        }
        
        // Close all calls
        for (const peerId in this.calls) {
            this.calls[peerId].close();
        }
        
        // Stop all adaptive jitter buffer monitoring
        for (const peerId in this.statsIntervals) {
            clearInterval(this.statsIntervals[peerId]);
        }
        this.statsIntervals = {};
        
        // Clear connection tracking
        this.connections = {};
        this.calls = {};
        
        // Destroy the peer
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.isConnected = false;
        utils.log('Disconnected from all peers');
    }

    /**
     * Get the list of connected peer IDs
     * @returns {Array} Array of peer IDs
     */
    getConnectedPeers() {
        return Object.keys(this.connections);
    }
    
    /**
     * Check if connected to a specific peer
     * @param {string} peerId The ID of the peer
     * @returns {boolean} Whether connected to the peer
     */
    isConnectedToPeer(peerId) {
        return this.connections[peerId] && this.connections[peerId].open;
    }
}