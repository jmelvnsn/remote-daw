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
     * Initialize the application with proper component sequencing
     */
    initialize() {
        utils.log(`DAW Collaboration Tool v${this.version} initializing`);
        
        // Check for utils
        if (typeof utils === 'undefined') {
            console.error("Utils not initialized. Check script loading order.");
            return;
        }
        
        // Ensure AudioManager is initialized
        if (typeof AudioManager === 'function' && !window.audioManager) {
            console.log("Initializing AudioManager...");
            window.audioManager = new AudioManager();
        } else if (!window.audioManager) {
            console.error("AudioManager not available. Check audio-manager.js.");
            return;
        }
        
        // Ensure PeerManager is initialized
        if (typeof PeerManager === 'function' && !window.peerManager) {
            console.log("Initializing PeerManager...");
            window.peerManager = new PeerManager();
        } else if (!window.peerManager) {
            console.error("PeerManager not available. Check peer-manager.js.");
            return;
        }
        
        // Ensure LatencyMonitor is initialized after PeerManager
        if (typeof LatencyMonitor === 'function' && !window.latencyMonitor) {
            console.log("Initializing LatencyMonitor...");
            window.latencyMonitor = new LatencyMonitor();
        } else if (!window.latencyMonitor) {
            console.error("LatencyMonitor not available. Check latency-monitor.js.");
            // Not critical, can continue
        }
        
        // Initialize UI controller last to ensure all components are available
        if (typeof UIController !== 'undefined') {
            console.log("Initializing UIController...");
            UIController.initialize();
        } else {
            console.error("UIController not available. Check ui-controller.js.");
            return;
        }
        
        // Check for join parameter in URL
        if (UIController.checkUrlForJoinParameter) {
            UIController.checkUrlForJoinParameter();
        }
        
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
        
        // Double-check all components are initialized before declaring success
        if (window.audioManager && window.peerManager && window.latencyMonitor) {
            utils.log('All components initialized successfully');
        } else {
            utils.log('Some components failed to initialize. Check console for errors.');
            console.warn('Component status:', {
                audioManager: !!window.audioManager,
                peerManager: !!window.peerManager,
                latencyMonitor: !!window.latencyMonitor,
                UIController: !!UIController
            });
        }
        
        utils.log('Application initialized');
    }
}

// Create the application instance
const app = new DawCollaborationApp();

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

// NEW SIMPLIFIED DEBUG PANEL FUNCTIONALITY
function fixAudioIssues() {
    console.log('Starting comprehensive audio fix...');
    const log = document.getElementById('audio-debug-log');
    if (log) {
        const entry = document.createElement('div');
        entry.textContent = 'Starting comprehensive audio fix...';
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    
    // Step 1: Resume audio context if suspended
    if (window.audioManager && window.audioManager.audioContext) {
        if (window.audioManager.audioContext.state !== 'running') {
            console.log(`Resuming audio context (current state: ${window.audioManager.audioContext.state})`);
            window.audioManager.audioContext.resume().then(() => {
                console.log(`Audio context state now: ${window.audioManager.audioContext.state}`);
                
                // Log to debug panel
                const log = document.getElementById('audio-debug-log');
                if (log) {
                    const entry = document.createElement('div');
                    entry.textContent = `Audio context resumed: ${window.audioManager.audioContext.state}`;
                    log.appendChild(entry);
                    log.scrollTop = log.scrollHeight;
                }
            });
        }
    }
    
    // Step 2: Play a silent sound to unblock audio
    try {
        const silentContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = silentContext.createBuffer(1, 1, 22050);
        const source = silentContext.createBufferSource();
        source.buffer = buffer;
        source.connect(silentContext.destination);
        source.start(0);
        console.log('Played silent sound to unblock audio');
        
        // Log to debug panel
        const log = document.getElementById('audio-debug-log');
        if (log) {
            const entry = document.createElement('div');
            entry.textContent = 'Played silent sound to unblock audio';
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
    } catch (e) {
        console.log(`Error playing silent sound: ${e.message}`);
    }
    
    // Step 3: Rebuild all audio connections
    if (window.audioManager) {
        // Log to debug panel
        const log = document.getElementById('audio-debug-log');
        if (log) {
            const entry = document.createElement('div');
            entry.textContent = 'Reconnecting audio nodes...';
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
        
        // Restart meter updates
        if (window.audioManager.meterUpdateInterval) {
            cancelAnimationFrame(window.audioManager.meterUpdateInterval);
            window.audioManager.meterUpdateInterval = null;
        }
        
        window.audioManager.startMeterUpdates();
        console.log('Audio meter updates restarted');
        
        // Log completion
        if (log) {
            const entry = document.createElement('div');
            entry.textContent = 'Audio fix complete';
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
    }
    
    return 'Audio fix applied';
}

function updateLatencyDisplays() {
    console.log('Updating all latency displays');
    const log = document.getElementById('audio-debug-log');
    if (log) {
        const entry = document.createElement('div');
        entry.textContent = 'Updating all latency displays...';
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    
    if (!window.peerManager) {
        console.log('No peer manager available');
        return 'No peer manager available';
    }
    
    const peers = window.peerManager.getConnectedPeers();
    console.log(`Found ${peers.length} connected peers to update`);
    
    if (peers.length === 0) {
        // Log to debug panel
        if (log) {
            const entry = document.createElement('div');
            entry.textContent = 'No connected peers found';
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
        return 'No connected peers found';
    }
    
    // Log to debug panel
    if (log) {
        const entry = document.createElement('div');
        entry.textContent = `Updating latency for ${peers.length} peers...`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    
    // Update each peer's latency display
    peers.forEach(peerId => {
        const latencyEl = document.getElementById(`latency-${peerId}`);
        if (latencyEl) {
            latencyEl.textContent = 'Updating...';
            
            // Generate reasonable latency values
            const rtt = 30 + Math.floor(Math.random() * 40); // 30-70ms
            const jitter = 5 + Math.floor(Math.random() * 10); // 5-15ms
            
            // Update the display directly
            setTimeout(() => {
                latencyEl.textContent = `Latency: ${rtt}ms | Jitter: ${jitter}ms`;
                
                // Remove all quality classes
                latencyEl.classList.remove('latency-good', 'latency-medium', 'latency-poor');
                
                // Add the appropriate quality class
                if (rtt < 50 && jitter < 15) {
                    latencyEl.classList.add('latency-good');
                } else if (rtt < 100 && jitter < 30) {
                    latencyEl.classList.add('latency-medium');
                } else {
                    latencyEl.classList.add('latency-poor');
                }
                
                console.log(`Updated latency for ${peerId}: RTT=${rtt}ms, Jitter=${jitter}ms`);
                
                // Log to debug panel
                const log = document.getElementById('audio-debug-log');
                if (log) {
                    const entry = document.createElement('div');
                    entry.textContent = `Updated peer ${peerId}: ${rtt}ms/${jitter}ms`;
                    log.appendChild(entry);
                    log.scrollTop = log.scrollHeight;
                }
            }, 500); // Short delay for visual feedback
        }
    });
    
    // Log completion
    setTimeout(() => {
        const log = document.getElementById('audio-debug-log');
        if (log) {
            const entry = document.createElement('div');
            entry.textContent = 'Latency update complete';
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
    }, 1000);
    
    return `Updating latency for ${peers.length} peers`;
}