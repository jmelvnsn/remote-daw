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
            // Set up audio processing for remote audio
            const remoteSource = this.audioContext.createMediaStreamSource(remoteStream);
            
            // Create analyser for this remote stream
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            remoteSource.connect(analyser);
            
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
                dataArray: new Uint8Array(analyser.frequencyBinCount)
            };
            
            // Create or update meter element for this peer
            UIController.createRemoteMeter(peerId);
            
            utils.log(`Processing remote stream from: ${peerId}`);
            
        } catch (error) {
            utils.log(`Error processing remote stream: ${error.message}`);
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
        const updateMeters = () => {
            const localMeter = utils.$('#localMeter');
            
            if (this.analyserLocal) {
                this.analyserLocal.getByteFrequencyData(this.localDataArray);
                const localVolume = utils.calculateVolume(this.localDataArray);
                localMeter.value = localVolume;
            }
            
            // Update each remote meter
            for (const peerId in this.remoteStreams) {
                const remoteMeter = utils.$(`#remoteMeter-${peerId}`);
                if (remoteMeter && this.remoteStreams[peerId].analyser) {
                    this.remoteStreams[peerId].analyser.getByteFrequencyData(this.remoteStreams[peerId].dataArray);
                    const remoteVolume = utils.calculateVolume(this.remoteStreams[peerId].dataArray);
                    remoteMeter.value = remoteVolume;
                }
            }
            
            this.meterUpdateInterval = requestAnimationFrame(updateMeters);
        };
        
        updateMeters();
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
    }
}

// Create global audio manager instance
window.audioManager = new AudioManager();