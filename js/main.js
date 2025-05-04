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