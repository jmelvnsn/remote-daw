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