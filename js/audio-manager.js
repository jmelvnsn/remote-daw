/**
 * Audio Manager for DAW Collaboration Tool
 * Handles audio capture, processing, and analysis
 */

class AudioManager {
    constructor() {
        // Audio context and nodes
        this.audioContext = null;
        this.localStream = null;
        this.localSource = null;
        this.analyserLocal = null;
        this.localDataArray = null;
        this.remoteStreams = {};
        
        // Audio devices
        this.devices = [];
        this.selectedDeviceId = '';
        
        // Audio settings
        this.sampleRate = parseInt(utils.$('#sampleRateSelect').value);
        this.bufferSize = parseInt(utils.$('#bufferSizeSelect').value);
        this.bitDepth = parseInt(utils.$('#bitDepthSelect').value);
        
        // Meters update
        this.meterUpdateInterval = null;
        
        // Audio active state
        this.isAudioActive = false;
        
        // Initialize device enumeration
        this.enumerateDevices();
    }
    
    /**
     * Enumerate available audio input devices
     */
    async enumerateDevices() {
        try {
            // First we need permission to access devices
            await navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    // Stop tracks immediately - we're just getting permission
                    stream.getTracks().forEach(track => track.stop());
                });
                
            // Now we can get the device list
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(device => device.kind === 'audioinput');
            
            // Populate the select element
            const select = utils.$('#audioInputSelect');
            select.innerHTML = '<option value="">Select Input Device...</option>';
            
            this.devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                
                // Give a more friendly name if the label is empty
                let label = device.label || `Audio Input ${this.devices.indexOf(device) + 1}`;
                
                // Highlight likely virtual audio devices
                if (label.includes('Loopback') || 
                    label.includes('Soundflower') || 
                    label.includes('BlackHole') || 
                    label.includes('VB-') || 
                    label.includes('JACK') || 
                    label.includes('Virtual')) {
                    label += ' (DAW Input)';
                }
                
                option.text = label;
                select.appendChild(option);
            });
            
            utils.log(`Found ${this.devices.length} audio input devices`);
            
        } catch (error) {
            utils.log(`Error enumerating devices: ${error.message}`);
        }
    }
    
    /**
     * Initialize audio capture from selected input device
     * @returns {Promise} Promise that resolves when audio is initialized
     */
    async initAudio() {
        try {
            // Stop any existing audio stream
            if (this.isAudioActive) {
                await this.stopAudio();
            }
            
            // Check if a device is selected
            this.selectedDeviceId = utils.$('#audioInputSelect').value;
            if (!this.selectedDeviceId) {
                throw new Error('Please select an audio input device');
            }
            
            // Create audio context with selected sample rate
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate,
                latencyHint: this.bufferSize <= 256 ? "interactive" : "balanced"
            });
            
            // Get user media with selected device
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    deviceId: { exact: this.selectedDeviceId },
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 2, // Stereo
                    sampleRate: this.sampleRate,
                    sampleSize: this.bitDepth
                },
                video: false 
            });
            
            // Set up audio processing for local audio
            this.localSource = this.audioContext.createMediaStreamSource(this.localStream);
            this.analyserLocal = this.audioContext.createAnalyser();
            this.analyserLocal.fftSize = 256;
            this.localSource.connect(this.analyserLocal);
            this.localDataArray = new Uint8Array(this.analyserLocal.frequencyBinCount);
            
            // Start meter updates
            this.startMeterUpdates();
            
            // Get selected device label
            const deviceLabel = this.getDeviceLabel(this.selectedDeviceId);
            utils.log(`Audio started with device: ${deviceLabel}`);
            utils.log(`Audio settings: ${this.sampleRate}Hz, ${this.bitDepth}-bit, Buffer: ${this.bufferSize}`);
            
            this.isAudioActive = true;
            return true;
            
        } catch (error) {
            utils.log(`Error starting audio: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Stop the current audio stream and clean up resources
     * @returns {Promise} Promise that resolves when audio is stopped
     */
    async stopAudio() {
        // Stop meter updates
        if (this.meterUpdateInterval) {
            cancelAnimationFrame(this.meterUpdateInterval);
            this.meterUpdateInterval = null;
        }
        
        // Stop local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Disconnect audio nodes
        if (this.localSource) {
            this.localSource.disconnect();
            this.localSource = null;
        }
        
        this.analyserLocal = null;
        this.localDataArray = null;
        
        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            await this.audioContext.close();
            this.audioContext = null;
        }
        
        this.isAudioActive = false;
        utils.log('Audio stopped');
        return true;
    }
    
    /**
     * Change audio input device
     * @param {string} deviceId The ID of the device to switch to
     * @returns {Promise} Promise that resolves when device is changed
     */
    async changeInputDevice(deviceId) {
        try {
            // Check if connected to peers
            if (peerManager && peerManager.getConnectedPeers().length > 0) {
                throw new Error('Cannot change device while connected to peers. Disconnect first.');
            }
            
            // Update the select element
            utils.$('#audioInputSelect').value = deviceId;
            this.selectedDeviceId = deviceId;
            
            // Restart audio with new device
            if (this.isAudioActive) {
                await this.stopAudio();
                await this.initAudio();
                return true;
            }
            
            return false;
        } catch (error) {
            utils.log(`Error changing input device: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get device label by device ID
     * @param {string} deviceId The device ID
     * @returns {string} The device label
     */
    getDeviceLabel(deviceId) {
        const device = this.devices.find(d => d.deviceId === deviceId);
        return device ? (device.label || `Audio Input (ID: ${deviceId.substr(0, 8)}...)`) : 'Unknown Device';
    }
    
    /**
     * Get the local audio stream
     * @returns {MediaStream} The local audio stream
     */
    getLocalStream() {
        return this.localStream;
    }
    
    /**
     * Process a remote audio stream
     * @param {MediaStream} remoteStream The remote audio stream
     * @param {string} peerId The ID of the remote peer
     */
    processRemoteStream(remoteStream, peerId) {
        try {
            console.log(`Processing remote stream from peer: ${peerId}`);
            
            // Ensure audio context exists
            if (!this.audioContext) {
                console.error('Audio context not available when processing remote stream');
                return;
            }
            
            // Set up audio processing for remote audio
            const remoteSource = this.audioContext.createMediaStreamSource(remoteStream);
            
            // Create analyser for this remote stream
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            remoteSource.connect(analyser);
            
            // Create data array for this analyser
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            // Connect to audio output
            const remoteGain = this.audioContext.createGain();
            remoteGain.gain.value = 1.0;
            remoteSource.connect(remoteGain);
            remoteGain.connect(this.audioContext.destination);
            
            // Store remote stream info
            this.remoteStreams[peerId] = {
                stream: remoteStream,
                source: remoteSource,
                analyser: analyser,
                gain: remoteGain,
                dataArray: dataArray
            };
            
            // Create or update meter element for this peer
            UIController.createRemoteMeter(peerId);
            
            // Log a confirmation that remote stream is being processed
            console.log(`Remote stream from ${peerId} configured successfully`);
            console.log(`Remote stream tracks:`, remoteStream.getTracks().length);
            remoteStream.getTracks().forEach((track, i) => {
                console.log(`Track ${i}: kind=${track.kind}, enabled=${track.enabled}, muted=${track.muted}`);
            });
            
            // Directly check remote stream levels to confirm
            setTimeout(() => {
                this.checkRemoteStreamLevels(peerId);
            }, 1000);
            
        } catch (error) {
            console.error(`Error processing remote stream: ${error.message}`);
            console.error(error.stack);
        }
    }
    
    /**
     * Check the remote stream audio levels to verify it's working
     * @param {string} peerId The ID of the remote peer
     */
    checkRemoteStreamLevels(peerId) {
        if (!this.remoteStreams[peerId]) {
            console.log(`No remote stream info found for peer ${peerId}`);
            return;
        }
        
        const remoteInfo = this.remoteStreams[peerId];
        
        // Get the current audio data
        remoteInfo.analyser.getByteFrequencyData(remoteInfo.dataArray);
        
        // Calculate average level
        const sum = Array.from(remoteInfo.dataArray).reduce((a, b) => a + b, 0);
        const avg = sum / remoteInfo.dataArray.length;
        
        // Log the level
        console.log(`Remote audio level from ${peerId}: ${avg.toFixed(2)}`);
        
        // If level is very low, log a warning
        if (avg < 1) {
            console.warn(`WARNING: Very low or no signal detected from peer ${peerId}`);
            console.warn('Possible issues:');
            console.warn('1. The remote peer may not be sending audio');
            console.warn('2. The audio connection may be interrupted');
            console.warn('3. The analyzer may not be properly connected');
        } else {
            console.log(`Audio signal detected from peer ${peerId} - levels are good!`);
        }
        
        // Check if the meter element exists and is updating
        const meterElement = utils.$(`#remoteMeter-${peerId}`);
        if (meterElement) {
            console.log(`Remote meter element exists for ${peerId}, current value: ${meterElement.value}`);
        } else {
            console.warn(`Remote meter element for ${peerId} not found in DOM`);
        }
    }
    
    /**
     * Remove a remote stream when the peer disconnects
     * @param {string} peerId The ID of the remote peer
     */
    removeRemoteStream(peerId) {
        if (this.remoteStreams[peerId]) {
            // Disconnect the audio nodes
            try {
                this.remoteStreams[peerId].source.disconnect();
                this.remoteStreams[peerId].gain.disconnect();
            } catch (e) {
                // Nodes might already be disconnected
                console.log(`Note: Error disconnecting nodes for peer ${peerId}: ${e.message}`);
            }
            
            // Remove from tracking
            delete this.remoteStreams[peerId];
            
            // Remove the meter element for this peer
            UIController.removeRemoteMeter(peerId);
            
            utils.log(`Removed remote stream from: ${peerId}`);
        }
    }
    
    /**
     * Start updating the audio level meters
     */
    startMeterUpdates() {
        console.log('Starting meter updates');
        
        const updateMeters = () => {
            const localMeter = utils.$('#localMeter');
            
            // Update local meter
            if (this.analyserLocal && this.localDataArray) {
                this.analyserLocal.getByteFrequencyData(this.localDataArray);
                const localVolume = utils.calculateVolume(this.localDataArray);
                localMeter.value = localVolume;
            }
            
            // Update each remote meter
            for (const peerId in this.remoteStreams) {
                const remoteMeter = utils.$(`#remoteMeter-${peerId}`);
                const remoteInfo = this.remoteStreams[peerId];
                
                if (remoteMeter && remoteInfo && remoteInfo.analyser && remoteInfo.dataArray) {
                    // Get the current audio data
                    remoteInfo.analyser.getByteFrequencyData(remoteInfo.dataArray);
                    const remoteVolume = utils.calculateVolume(remoteInfo.dataArray);
                    
                    // Update the meter
                    remoteMeter.value = remoteVolume;
                    
                    // Debug log if level is significant (to avoid log spam)
                    if (remoteVolume > 10) {
                        console.log(`Remote volume from ${peerId}: ${remoteVolume}`);
                    }
                }
            }
            
            this.meterUpdateInterval = requestAnimationFrame(updateMeters);
        };
        
        updateMeters();
        console.log('Meter update loop started');
    }
    
    /**
     * Stop all audio processing
     */
    stop() {
        this.stopAudio();
    }
    
    /**
     * Get current audio settings for sharing with peers
     * @returns {Object} The current audio settings
     */
    getAudioSettings() {
        return {
            sampleRate: this.sampleRate,
            bufferSize: this.bufferSize,
            bitDepth: this.bitDepth,
            deviceLabel: this.getDeviceLabel(this.selectedDeviceId)
        };
    }
    
    /**
     * Force enable audio output for testing
     * Call this from the console: audioManager.forceEnableAudio()
     */
    forceEnableAudio() {
        utils.log('Forcing audio output enabled');
        
        // Resume audio context
        if (this.audioContext && this.audioContext.state !== 'running') {
            utils.log(`Resuming audio context (current state: ${this.audioContext.state})`);
            this.audioContext.resume().then(() => {
                utils.log(`Audio context state now: ${this.audioContext.state}`);
            });
        }
        
        // Create a silent sound to unblock audio in Safari and Mobile browsers
        try {
            const silentContext = new (window.AudioContext || window.webkitAudioContext)();
            const buffer = silentContext.createBuffer(1, 1, 22050);
            const source = silentContext.createBufferSource();
            source.buffer = buffer;
            source.connect(silentContext.destination);
            source.start(0);
            utils.log('Played silent sound to unblock audio');
            
            // Clean up
            setTimeout(() => {
                silentContext.close().then(() => {
                    utils.log('Temporary silent context closed');
                });
            }, 1000);
        } catch (e) {
            utils.log(`Error playing silent sound: ${e.message}`);
        }
        
        // Play any fallback audio elements
        document.querySelectorAll('audio[id^="audio-fallback-"]').forEach(audioEl => {
            utils.log(`Attempting to play fallback audio element: ${audioEl.id}`);
            audioEl.muted = false;
            audioEl.volume = 1.0;
            audioEl.play().then(() => {
                utils.log(`Successfully playing ${audioEl.id}`);
            }).catch(e => {
                utils.log(`Failed to play ${audioEl.id}: ${e.message}`);
            });
        });
        
        // Reconnect all audio nodes
        for (const peerId in this.remoteStreams) {
            utils.log(`Reconnecting audio for peer ${peerId}`);
            const remoteInfo = this.remoteStreams[peerId];
            
            try {
                // Disconnect existing nodes
                if (remoteInfo.source) remoteInfo.source.disconnect();
                if (remoteInfo.gain) remoteInfo.gain.disconnect();
                
                // Reconnect everything
                if (remoteInfo.stream && this.audioContext) {
                    remoteInfo.source = this.audioContext.createMediaStreamSource(remoteInfo.stream);
                    remoteInfo.analyser = this.audioContext.createAnalyser();
                    remoteInfo.analyser.fftSize = 256;
                    remoteInfo.dataArray = new Uint8Array(remoteInfo.analyser.frequencyBinCount);
                    remoteInfo.gain = this.audioContext.createGain();
                    remoteInfo.gain.gain.value = 1.0;
                    
                    // Connect nodes
                    remoteInfo.source.connect(remoteInfo.analyser);
                    remoteInfo.source.connect(remoteInfo.gain);
                    remoteInfo.gain.connect(this.audioContext.destination);
                    
                    utils.log(`Audio graph rebuilt for peer ${peerId}`);
                }
            } catch (e) {
                utils.log(`Error reconnecting audio for peer ${peerId}: ${e.message}`);
            }
        }
        
        // Restart meter updates
        if (this.meterUpdateInterval) {
            cancelAnimationFrame(this.meterUpdateInterval);
            this.meterUpdateInterval = null;
        }
        this.startMeterUpdates();
        
        utils.log('Audio force-enable complete');
        
        return Object.keys(this.remoteStreams).length > 0 ? 
            'Audio connections rebuilt' : 
            'No remote streams found';
    }
    
    /**
     * Debug audio input to help troubleshoot mic issues
     */
    debugAudioInput() {
        utils.log('Starting audio input debugging...');
        
        // Check if we have access to the local stream
        if (!this.localStream) {
            utils.log('ERROR: No local stream available. Did you click "Start Audio Input"?');
            return;
        }
        
        // Log the selected device
        utils.log(`Selected device: ${this.getDeviceLabel(this.selectedDeviceId)}`);
        
        // Log information about the audio tracks
        const audioTracks = this.localStream.getAudioTracks();
        utils.log(`Number of audio tracks: ${audioTracks.length}`);
        
        if (audioTracks.length === 0) {
            utils.log('ERROR: No audio tracks found in the stream. Check microphone permissions.');
            return;
        }
        
        // Log details about each track
        audioTracks.forEach((track, index) => {
            utils.log(`Track ${index} - Label: "${track.label}"`);
            utils.log(`Track ${index} - Enabled: ${track.enabled}`);
            utils.log(`Track ${index} - Muted: ${track.muted}`);
            utils.log(`Track ${index} - ReadyState: ${track.readyState}`);
            
            // Get constraints if available
            if (track.getConstraints) {
                const constraints = track.getConstraints();
                utils.log(`Track ${index} - Constraints: ${JSON.stringify(constraints)}`);
            }
            
            // Get settings if available
            if (track.getSettings) {
                const settings = track.getSettings();
                utils.log(`Track ${index} - Settings: ${JSON.stringify(settings)}`);
            }
        });
        
        // Check if the analyser is working
        if (!this.analyserLocal) {
            utils.log('ERROR: No audio analyser created. Internal error in audio setup.');
            return;
        }
        
        // Get current audio data and log it
        if (!this.localDataArray) {
            utils.log('ERROR: No data array for local audio. Internal error in audio setup.');
            return;
        }
        
        // Check if we're getting any signal
        this.analyserLocal.getByteFrequencyData(this.localDataArray);
        const sum = Array.from(this.localDataArray).reduce((a, b) => a + b, 0);
        const avg = sum / this.localDataArray.length;
        
        utils.log(`Current audio level: ${avg.toFixed(2)}`);
        if (avg < 1) {
            utils.log('WARNING: Very low or no audio signal detected. Check if:');
            utils.log('1. Your selected input device is working and receiving audio');
            utils.log('2. Your system volume for the input device is turned up');
            utils.log('3. You have audio playing that should be captured');
            utils.log('4. Your audio routing software is correctly set up (if using DAW)');
        } else {
            utils.log('Audio signal detected! If the meter still shows no movement:');
            utils.log('1. There might be an issue with the UI updating');
            utils.log('2. Try refreshing the page');
        }
        
        // Create an oscillator to test audio output
        utils.log('Creating test tone to verify audio output...');
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0.1; // Low volume
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.frequency.value = 440; // A4 note
        oscillator.start();
        
        // Stop after 1 second
        setTimeout(() => {
            oscillator.stop();
            utils.log('Test tone finished. Did you hear a beep?');
        }, 1000);
        
        // Debug remote stream information
        utils.log('Checking remote stream information...');
        for (const peerId in this.remoteStreams) {
            utils.log(`Remote stream from peer ${peerId}:`);
            
            const remoteInfo = this.remoteStreams[peerId];
            if (remoteInfo.stream) {
                const remoteTracks = remoteInfo.stream.getTracks();
                utils.log(`- Remote tracks: ${remoteTracks.length}`);
                
                remoteTracks.forEach((track, i) => {
                    utils.log(`- Track ${i}: kind=${track.kind}, enabled=${track.enabled}, muted=${track.muted}`);
                });
                
                if (remoteInfo.analyser && remoteInfo.dataArray) {
                    remoteInfo.analyser.getByteFrequencyData(remoteInfo.dataArray);
                    const remoteSum = Array.from(remoteInfo.dataArray).reduce((a, b) => a + b, 0);
                    const remoteAvg = remoteSum / remoteInfo.dataArray.length;
                    
                    utils.log(`- Remote audio level: ${remoteAvg.toFixed(2)}`);
                    if (remoteAvg < 1) {
                        utils.log('- WARNING: No remote audio signal detected');
                    }
                } else {
                    utils.log('- WARNING: Remote analyser not set up properly');
                }
            } else {
                utils.log('- WARNING: No remote stream found');
            }
            
            // Check if remote meter exists
            const remoteMeter = utils.$(`#remoteMeter-${peerId}`);
            utils.log(`- Remote meter in DOM: ${!!remoteMeter}`);
            if (remoteMeter) {
                utils.log(`- Remote meter value: ${remoteMeter.value}`);
            }
        }
    }
    
    /**
     * Fix common audio issues with remote streams
     */
    fixRemoteAudioIssues() {
        utils.log('Attempting to fix remote audio issues...');
        
        // For each remote stream
        for (const peerId in this.remoteStreams) {
            const remoteInfo = this.remoteStreams[peerId];
            utils.log(`Fixing connection for peer ${peerId}...`);
            
            try {
                // Disconnect existing connections
                if (remoteInfo.source) {
                    try { remoteInfo.source.disconnect(); } catch (e) {}
                }
                if (remoteInfo.gain) {
                    try { remoteInfo.gain.disconnect(); } catch (e) {}
                }
                
                // Recreate connections
                if (remoteInfo.stream && this.audioContext) {
                    // Create new source node
                    remoteInfo.source = this.audioContext.createMediaStreamSource(remoteInfo.stream);
                    
                    // Recreate analyser if needed
                    if (!remoteInfo.analyser) {
                        remoteInfo.analyser = this.audioContext.createAnalyser();
                        remoteInfo.analyser.fftSize = 256;
                        remoteInfo.dataArray = new Uint8Array(remoteInfo.analyser.frequencyBinCount);
                    }
                    
                    // Create new gain node
                    remoteInfo.gain = this.audioContext.createGain();
                    remoteInfo.gain.gain.value = 1.0;
                    
                    // Connect everything
                    remoteInfo.source.connect(remoteInfo.analyser);
                    remoteInfo.source.connect(remoteInfo.gain);
                    remoteInfo.gain.connect(this.audioContext.destination);
                    
                    utils.log(`Successfully rebuilt audio pipeline for peer ${peerId}`);
                } else {
                    utils.log(`Cannot fix audio for peer ${peerId} - missing stream or audio context`);
                }
            } catch (error) {
                utils.log(`Error fixing audio for peer ${peerId}: ${error.message}`);
            }
        }
        
        // Restart meter updates
        if (this.meterUpdateInterval) {
            cancelAnimationFrame(this.meterUpdateInterval);
            this.meterUpdateInterval = null;
        }
        
        this.startMeterUpdates();
        utils.log('Audio meter updates restarted');
        
        return Object.keys(this.remoteStreams).length > 0;
    }
}

// Create global audio manager instance
window.audioManager = new AudioManager();