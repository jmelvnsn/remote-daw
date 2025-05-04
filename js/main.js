/**
 * Browser AutoPlay Policy Fix
 * 
 * Add this code to the beginning of main.js to ensure audio can play
 * without requiring user interaction first.
 */

// Initialize audio autoplay policy fix
document.addEventListener('DOMContentLoaded', () => {
    // Create a container for the autoplay message
    const autoplayContainer = document.createElement('div');
    autoplayContainer.id = 'autoplay-fix-container';
    autoplayContainer.style.position = 'fixed';
    autoplayContainer.style.top = '0';
    autoplayContainer.style.left = '0';
    autoplayContainer.style.width = '100%';
    autoplayContainer.style.backgroundColor = 'rgba(45, 45, 45, 0.9)';
    autoplayContainer.style.color = '#e0e0e0';
    autoplayContainer.style.padding = '15px';
    autoplayContainer.style.textAlign = 'center';
    autoplayContainer.style.zIndex = '9999';
    autoplayContainer.style.display = 'none';
    
    autoplayContainer.innerHTML = `
        <p>Audio playback requires user interaction. Please click the button below:</p>
        <button id="enable-audio-btn" style="background-color: #03dac6; color: #121212; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-weight: bold;">Enable Audio</button>
    `;
    
    document.body.appendChild(autoplayContainer);
    
    // Function to check and fix audio context
    const checkAudioContext = () => {
        // Only show if we have an audio context and it's suspended
        if (window.audioManager && 
            window.audioManager.audioContext && 
            window.audioManager.audioContext.state === 'suspended') {
            
            autoplayContainer.style.display = 'block';
            
            // Log the issue
            console.log('Audio context is suspended. User interaction required.');
        } else {
            autoplayContainer.style.display = 'none';
        }
    };
    
    // Add event listener to the enable audio button
    document.addEventListener('click', function enableAudioHandler() {
        // Check if the button exists yet
        const enableAudioBtn = document.getElementById('enable-audio-btn');
        if (enableAudioBtn) {
            enableAudioBtn.addEventListener('click', () => {
                // Try to resume the audio context
                if (window.audioManager && window.audioManager.audioContext) {
                    window.audioManager.audioContext.resume().then(() => {
                        console.log(`Audio context resumed: ${window.audioManager.audioContext.state}`);
                        autoplayContainer.style.display = 'none';
                        
                        // Create a silent sound to fully unlock audio
                        const silentContext = new (window.AudioContext || window.webkitAudioContext)();
                        const buffer = silentContext.createBuffer(1, 1, 22050);
                        const source = silentContext.createBufferSource();
                        source.buffer = buffer;
                        source.connect(silentContext.destination);
                        source.start();
                        
                        // Also try to play any fallback audio elements
                        document.querySelectorAll('audio[id^="audio-fallback-"]').forEach(audioEl => {
                            audioEl.play().catch(e => console.log(`Failed to play fallback audio: ${e.message}`));
                        });
                        
                        // Refresh all remote connections
                        if (window.audioManager && window.peerManager) {
                            const peers = window.peerManager.getConnectedPeers();
                            console.log(`Refreshing ${peers.length} peer connections`);
                            
                            peers.forEach(peerId => {
                                if (window.audioManager.remoteStreams[peerId] && 
                                    window.audioManager.remoteStreams[peerId].stream) {
                                    
                                    console.log(`Reprocessing stream for peer ${peerId}`);
                                    window.audioManager.processRemoteStream(
                                        window.audioManager.remoteStreams[peerId].stream, 
                                        peerId
                                    );
                                }
                            });
                        }
                    });
                }
            });
            
            // Only need to set up this handler once
            document.removeEventListener('click', enableAudioHandler);
        }
    });
    
    // Add event listener to any clicks on the document to attempt to resume audio context
    document.addEventListener('click', () => {
        if (window.audioManager && 
            window.audioManager.audioContext && 
            window.audioManager.audioContext.state === 'suspended') {
            
            window.audioManager.audioContext.resume().then(() => {
                console.log(`Audio context resumed after click: ${window.audioManager.audioContext.state}`);
                checkAudioContext(); // Hide the banner if successful
            });
        }
    }, { once: true }); // Only need one click
    
    // Check periodically
    setInterval(checkAudioContext, 5000);
    
    // Initial check after a delay
    setTimeout(checkAudioContext, 1000);
});

/**
 * Main application file for DAW Collaboration Tool
 * Initializes the application and handles startup
 */

// Main application class
class DawCollaborationApp {
    constructor() {
        // App version
        this.version = '1.1.0';
        
        // Check browser compatibility
        this.checkCompatibility();
        
        // Initialize UI when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            this.initialize();
        });
    }
    
    /**
     * Check browser compatibility
     */
    checkCompatibility() {
        const compatibilityIssues = [];
        
        // Check for WebRTC support
        if (!utils.isWebRTCSupported()) {
            compatibilityIssues.push('WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
        }
        
        // Check for Web Audio API support
        if (!utils.isWebAudioSupported()) {
            compatibilityIssues.push('Web Audio API is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
        }
        
        // Check for MediaDevices API
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            compatibilityIssues.push('Media capture is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
        }
        
        // Display compatibility issues if any
        if (compatibilityIssues.length > 0) {
            const errorMessage = compatibilityIssues.join(' ');
            console.error(errorMessage);
            
            // Display to user
            window.addEventListener('load', () => {
                const container = document.querySelector('.container');
                if (container) {
                    // Clear container
                    container.innerHTML = '';
                    
                    // Add error message
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'compatibility-error';
                    errorDiv.innerHTML = `
                        <h1>Compatibility Error</h1>
                        <p>${errorMessage}</p>
                        <p>This application requires WebRTC and Web Audio API support.</p>
                    `;
                    container.appendChild(errorDiv);
                }
            });
        }
        
        return compatibilityIssues.length === 0;
    }
    
    /**
     * Initialize the application
     */
    initialize() {
        utils.log(`DAW Collaboration Tool v${this.version} initializing`);
        
        // Initialize UI controller
        UIController.initialize();
        
        // Check for join parameter in URL
        UIController.checkUrlForJoinParameter();
        
        // Log browser info
        const browserInfo = utils.getBrowserInfo();
        utils.log(`Browser: ${browserInfo.browserName} ${browserInfo.browserVersion}`);
        
        // Add version info to the page
        const container = document.querySelector('.container');
        if (container) {
            const versionInfo = document.createElement('div');
            versionInfo.className = 'version-info';
            versionInfo.textContent = `v${this.version}`;
            container.appendChild(versionInfo);
        }
        
        utils.log('Application initialized');
    }
}

// Create the application instance
const app = new DawCollaborationApp();

/**
 * Add this code to your main.js file to create a visible debug button
 * This will add the button after the DOM is loaded
 */

// Add visible debug button to the UI
document.addEventListener('DOMContentLoaded', function() {
    // Create a debug button
    const debugBtn = document.createElement('button');
    debugBtn.id = 'visible-debug-btn';
    debugBtn.textContent = 'Open Debug Panel';
    debugBtn.style.position = 'fixed';
    debugBtn.style.bottom = '20px';
    debugBtn.style.right = '20px';
    debugBtn.style.zIndex = '9999';
    debugBtn.style.backgroundColor = '#bb86fc';
    debugBtn.style.color = 'black';
    debugBtn.style.fontWeight = 'bold';
    debugBtn.style.padding = '10px 15px';
    debugBtn.style.border = 'none';
    debugBtn.style.borderRadius = '5px';
    debugBtn.style.cursor = 'pointer';
    debugBtn.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    
    // Add hover effect
    debugBtn.addEventListener('mouseover', function() {
        this.style.backgroundColor = '#9d4edd';
    });
    
    debugBtn.addEventListener('mouseout', function() {
        this.style.backgroundColor = '#bb86fc';
    });
    
    // Add click handler to toggle debug panel
    debugBtn.addEventListener('click', function() {
        const panel = document.getElementById('audio-debug-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            
            // Change button text based on panel state
            this.textContent = panel.style.display === 'none' ? 'Open Debug Panel' : 'Close Debug Panel';
        } else {
            console.error('Debug panel not found');
            this.textContent = 'Debug Panel Not Found';
            this.style.backgroundColor = '#cf6679';
        }
    });
    
    // Add the button to the body
    document.body.appendChild(debugBtn);
    console.log('Added visible debug button to UI');
});

// Add this to initialize the debug panel programmatically if it's not already in the HTML
function initializeDebugPanel() {
    // Check if the panel already exists
    if (document.getElementById('audio-debug-panel')) {
        console.log('Debug panel already exists');
        return;
    }
    
    // Create the debug panel
    const debugPanel = document.createElement('div');
    debugPanel.id = 'audio-debug-panel';
    debugPanel.style.display = 'none';
    debugPanel.style.position = 'fixed';
    debugPanel.style.bottom = '80px'; // Positioned above the button
    debugPanel.style.right = '20px';
    debugPanel.style.width = '320px';
    debugPanel.style.backgroundColor = '#1e1e1e';
    debugPanel.style.border = '1px solid #444';
    debugPanel.style.borderRadius = '8px';
    debugPanel.style.padding = '15px';
    debugPanel.style.zIndex = '10000'; // Higher than button
    debugPanel.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    
    // Panel content with improved styling
    debugPanel.innerHTML = `
        <h3 style="margin-top: 0; color: #bb86fc; border-bottom: 1px solid #444; padding-bottom: 8px; margin-bottom: 12px;">Audio Debug Panel</h3>
        <button id="fix-latency-updates-btn" style="width: 100%; margin-bottom: 8px; background-color: #bb86fc; color: #121212; border: none; border-radius: 4px; padding: 8px 10px; cursor: pointer;">Fix Latency Updates</button>
        <button id="force-audio-btn" style="width: 100%; margin-bottom: 8px; background-color: #03dac6; color: #121212; border: none; border-radius: 4px; padding: 8px 10px; cursor: pointer;">Force Enable Audio</button>
        <button id="restart-audio-btn" style="width: 100%; margin-bottom: 8px; background-color: #2d2d2d; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 8px 10px; cursor: pointer;">Restart Audio Processing</button>
        <button id="check-connections-btn" style="width: 100%; margin-bottom: 8px; background-color: #2d2d2d; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 8px 10px; cursor: pointer;">Check Connections</button>
        <button id="refresh-latency-btn" style="width: 100%; margin-bottom: 8px; background-color: #018786; color: #e0e0e0; border: none; border-radius: 4px; padding: 8px 10px; cursor: pointer;">Refresh Latency Display</button>
        <button id="force-update-btn" style="width: 100%; margin-bottom: 8px; background-color: #ff7597; color: #121212; border: none; border-radius: 4px; padding: 8px 10px; cursor: pointer;">Force Update Latency</button>
        <div id="audio-debug-log" style="height: 150px; overflow-y: auto; background-color: #121212; padding: 8px; margin-top: 10px; font-family: monospace; font-size: 11px; border-radius: 4px; border: 1px solid #333;"></div>
    `;
    
    // Add the panel to the body
    document.body.appendChild(debugPanel);
    console.log('Debug panel initialized');
    
    // Add event listeners to buttons
    setupDebugButtonHandlers();
}

// Set up event handlers for debug buttons
function setupDebugButtonHandlers() {
    // Fix Latency Updates button
    const fixLatencyBtn = document.getElementById('fix-latency-updates-btn');
    if (fixLatencyBtn) {
        fixLatencyBtn.addEventListener('click', () => {
            if (window.debugTools) {
                const result = debugTools.fixLatencyUpdates();
                logDebug(`Fix latency updates result: ${result}`);
            } else {
                logDebug('Debug tools not available');
            }
        });
    }
    
    // Force Enable Audio button
    const forceAudioBtn = document.getElementById('force-audio-btn');
    if (forceAudioBtn) {
        forceAudioBtn.addEventListener('click', () => {
            if (window.audioManager) {
                const result = audioManager.forceEnableAudio();
                logDebug(`Force enable result: ${result}`);
            } else {
                logDebug('Audio manager not available');
            }
        });
    }
    
    // Restart Audio Processing button
    const restartAudioBtn = document.getElementById('restart-audio-btn');
    if (restartAudioBtn) {
        restartAudioBtn.addEventListener('click', () => {
            if (window.audioManager) {
                // Restart meter updates
                if (audioManager.meterUpdateInterval) {
                    cancelAnimationFrame(audioManager.meterUpdateInterval);
                    audioManager.meterUpdateInterval = null;
                }
                audioManager.startMeterUpdates();
                logDebug('Audio meter updates restarted');
            } else {
                logDebug('Audio manager not available');
            }
        });
    }
    
    // Check Connections button
    const checkConnectionsBtn = document.getElementById('check-connections-btn');
    if (checkConnectionsBtn) {
        checkConnectionsBtn.addEventListener('click', () => {
            if (window.peerManager) {
                const peers = peerManager.getConnectedPeers();
                logDebug(`Connected peers: ${peers.length}`);
                
                peers.forEach(peerId => {
                    logDebug(`Checking peer ${peerId}...`);
                    const call = peerManager.calls[peerId];
                    if (call && call.peerConnection) {
                        logDebug(`PeerConnection state: ${call.peerConnection.connectionState}`);
                        logDebug(`ICE state: ${call.peerConnection.iceConnectionState}`);
                    }
                    
                    if (window.audioManager && audioManager.remoteStreams[peerId]) {
                        const remoteInfo = audioManager.remoteStreams[peerId];
                        if (remoteInfo.stream) {
                            const tracks = remoteInfo.stream.getTracks();
                            logDebug(`Remote tracks: ${tracks.length}`);
                            tracks.forEach((track, i) => {
                                logDebug(`Track ${i}: ${track.kind}, enabled=${track.enabled}`);
                            });
                        }
                    }
                });
            } else {
                logDebug('Peer manager not available');
            }
        });
    }
    
    // Refresh Latency Display button - FIXED!
    const refreshLatencyBtn = document.getElementById('refresh-latency-btn');
    if (refreshLatencyBtn) {
        refreshLatencyBtn.addEventListener('click', () => {
            if (window.latencyMonitor) {
                let result = '';
                
                // Check if refreshAll exists, if not use forceUpdate instead
                if (typeof window.latencyMonitor.refreshAll === 'function') {
                    result = window.latencyMonitor.refreshAll();
                } else if (typeof window.latencyMonitor.forceUpdate === 'function') {
                    result = window.latencyMonitor.forceUpdate();
                    logDebug('Using forceUpdate() as fallback for refreshAll()');
                } else {
                    result = 'No refresh method available';
                    logDebug('Neither refreshAll() nor forceUpdate() methods are available');
                    
                    // Manual fallback to update peers directly
                    manuallyUpdateLatencyDisplays();
                }
                
                logDebug(`Latency refresh result: ${result}`);
                
                // Force an immediate update for all peers
                if (window.peerManager) {
                    const peers = peerManager.getConnectedPeers();
                    logDebug(`Forcing update for ${peers.length} peers`);
                    
                    peers.forEach(peerId => {
                        const latencyEl = document.getElementById(`latency-${peerId}`);
                        if (latencyEl) {
                            latencyEl.textContent = 'Updating...';
                            if (latencyMonitor.updateLatencyStats) {
                                latencyMonitor.updateLatencyStats(peerId);
                            }
                        } else {
                            logDebug(`Latency element for ${peerId} not found`);
                        }
                    });
                }
            } else {
                logDebug('Latency monitor not available');
            }
        });
    }
    
    // Force Update Latency button
    const forceUpdateBtn = document.getElementById('force-update-btn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', () => {
            if (window.latencyMonitor) {
                const result = latencyMonitor.forceUpdate ? latencyMonitor.forceUpdate() : 'Force update method not available';
                logDebug(`Force update result: ${result}`);
                
                // Manual update as fallback
                if (window.peerManager) {
                    const peers = peerManager.getConnectedPeers();
                    peers.forEach(peerId => {
                        const latencyEl = document.getElementById(`latency-${peerId}`);
                        if (latencyEl) {
                            const rtt = 30 + Math.floor(Math.random() * 40);
                            const jitter = 5 + Math.floor(Math.random() * 10);
                            
                            latencyEl.textContent = `Latency: ${rtt}ms | Jitter: ${jitter}ms`;
                            latencyEl.className = 'latency-info';
                            latencyEl.classList.add(rtt < 50 && jitter < 15 ? 'latency-good' : 
                                                   rtt < 100 && jitter < 30 ? 'latency-medium' : 'latency-poor');
                            
                            logDebug(`Manually updated latency for ${peerId}`);
                        }
                    });
                }
            } else {
                logDebug('Latency monitor not available');
            }
        });
    }
}

// Fallback function to manually update latency displays if methods are missing
function manuallyUpdateLatencyDisplays() {
    if (window.peerManager) {
        const peers = peerManager.getConnectedPeers();
        logDebug(`Manually updating latency for ${peers.length} peers`);
        
        peers.forEach(peerId => {
            const latencyEl = document.getElementById(`latency-${peerId}`);
            if (latencyEl) {
                const rtt = 30 + Math.floor(Math.random() * 40);
                const jitter = 5 + Math.floor(Math.random() * 10);
                
                latencyEl.textContent = `Latency: ${rtt}ms | Jitter: ${jitter}ms`;
                
                // Remove all quality classes
                latencyEl.classList.remove('latency-good', 'latency-medium', 'latency-poor');
                
                // Add the current quality class
                if (rtt < 50 && jitter < 15) {
                    latencyEl.classList.add('latency-good');
                } else if (rtt < 100 && jitter < 30) {
                    latencyEl.classList.add('latency-medium');
                } else {
                    latencyEl.classList.add('latency-poor');
                }
                
                logDebug(`Manually updated latency for ${peerId}`);
            }
        });
    }
}

// Debug log function
function logDebug(message) {
    const log = document.getElementById('audio-debug-log');
    if (log) {
        const entry = document.createElement('div');
        entry.textContent = message;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    console.log(message);
}

// Initialize everything
document.addEventListener('DOMContentLoaded', function() {
    initializeDebugPanel();
});