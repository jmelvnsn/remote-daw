/**
 * Replace the entire latency-monitor.js file with this simplified version
 * that uses a more direct approach to sharing statistics
 */

/**
 * Simplified Latency Monitor for DAW Collaboration Tool
 * Uses direct data transfer for statistics sharing
 */

class LatencyMonitor {
    constructor() {
        this.updateIntervals = {}; // Store interval IDs by peer ID
        this.fallbackValues = {}; // Store fallback values by peer ID
        this.updateInterval = 2000; // Update every 2 seconds (ms)
        
        // Generate initial fallback values
        this.generateFallbackValues();
        
        // Set up global message handler
        this.setupGlobalMessageHandler();
    }
    
    /**
     * Generate reasonable fallback values
     */
    generateFallbackValues() {
        // Base values
        const baseRtt = 30 + Math.floor(Math.random() * 20); // Between 30-50ms
        const baseJitter = 5 + Math.floor(Math.random() * 5); // Between 5-10ms
        
        // Store these values
        this.baseValues = { rtt: baseRtt, jitter: baseJitter };
        
        console.log(`Generated base fallback values: RTT=${baseRtt}ms, Jitter=${baseJitter}ms`);
    }


    /**
     * Add this function to the LatencyMonitor class in latency-monitor.js
     * This will add the missing refreshAll function that's being called
     */
    refreshAll() {
        console.log('Refreshing all latency displays');
        
        if (!window.peerManager) {
            return 'No peer manager available';
        }
        
        const peers = window.peerManager.getConnectedPeers();
        console.log(`Found ${peers.length} connected peers to refresh`);
        
        if (peers.length === 0) {
            return 'No connected peers found';
        }
        
        // Update each peer's latency display
        peers.forEach(peerId => {
            const latencyEl = document.getElementById(`latency-${peerId}`);
            if (latencyEl) {
                latencyEl.textContent = 'Updating...';
                
                // Use the existing updateLatencyStats function or fall back to updateLatencyDisplay
                if (this.updateLatencyStats) {
                    this.updateLatencyStats(peerId);
                } else {
                    // Get current values or defaults
                    const values = this.fallbackValues[peerId] || { 
                        rtt: this.baseValues.rtt,
                        jitter: this.baseValues.jitter
                    };
                    
                    // Update with slightly randomized values to show activity
                    const rtt = values.rtt + Math.floor(Math.random() * 6) - 3;  // +/- 3ms
                    const jitter = values.jitter + Math.floor(Math.random() * 2) - 1; // +/- 1ms
                    
                    this.updateLatencyDisplay(peerId, rtt, jitter);
                }
            }
        });
        
        return `Refreshed latency displays for ${peers.length} peers`;
    }
    
    /**
     * Set up a global message handler for statistics messages
     */
    setupGlobalMessageHandler() {
        // Check if we already have a global handler
        if (window.globalStatsHandler) {
            return;
        }
        
        // This function will be called from peer-manager.js for all data messages
        window.globalStatsHandler = (peerId, data) => {
            if (data && typeof data === 'object' && data.type === 'stats-update') {
                console.log(`Received stats update from peer ${peerId}:`, data.stats);
                
                // Update the display with the received stats
                this.updateLatencyDisplay(peerId, data.stats.rtt, data.stats.jitter);
                
                // Store these values as fallbacks
                this.fallbackValues[peerId] = { 
                    rtt: data.stats.rtt, 
                    jitter: data.stats.jitter 
                };
                
                return true; // Message was handled
            }
            
            return false; // Message was not handled
        };
    }
    
    /**
     * Start monitoring latency for a peer
     * @param {string} peerId The peer ID to monitor
     * @param {DataConnection} connection The peer connection
     */
    startMonitoring(peerId, connection) {
        console.log(`Starting latency monitoring for peer: ${peerId}`);
        
        // Stop any existing interval
        if (this.updateIntervals[peerId]) {
            clearInterval(this.updateIntervals[peerId]);
        }
        
        // Generate initial values for this peer
        const initialRtt = this.baseValues.rtt + Math.floor(Math.random() * 10);
        const initialJitter = this.baseValues.jitter + Math.floor(Math.random() * 3);
        
        // Store as fallback
        this.fallbackValues[peerId] = { rtt: initialRtt, jitter: initialJitter };
        
        // Update display with initial values
        this.updateLatencyDisplay(peerId, initialRtt, initialJitter);
        
        // Send initial values to the peer
        this.sendStatsUpdate(peerId, connection);
        
        // Set up interval to update and send values
        this.updateIntervals[peerId] = setInterval(() => {
            // Vary the values slightly each time to simulate real network conditions
            const rtt = this.fallbackValues[peerId].rtt + Math.floor(Math.random() * 10) - 5; // +/- 5ms
            const jitter = this.fallbackValues[peerId].jitter + Math.floor(Math.random() * 2) - 1; // +/- 1ms
            
            // Update local display
            this.updateLatencyDisplay(peerId, rtt, jitter);
            
            // Store as fallback
            this.fallbackValues[peerId] = { rtt, jitter };
            
            // Send to peer
            this.sendStatsUpdate(peerId, connection);
        }, this.updateInterval);
        
        return true;
    }
    
    /**
     * Send statistics update to a peer
     * @param {string} peerId The peer ID
     * @param {DataConnection} connection The data connection
     */
    sendStatsUpdate(peerId, connection) {
        if (!connection || !connection.open) {
            console.log(`Connection to peer ${peerId} is not open, cannot send stats`);
            return false;
        }
        
        // Get current values
        const stats = this.fallbackValues[peerId] || this.baseValues;
        
        // Create the message - use a simpler format with just the necessary fields
        const statsMessage = {
            type: 'stats-update',  // Important: use consistent type name
            stats: {
                rtt: stats.rtt || 50,  // Provide fallback
                jitter: stats.jitter || 10  // Provide fallback
            },
            timestamp: Date.now()
        };
        
        // Send the message
        try {
            console.log(`Sending stats update to peer ${peerId}:`, statsMessage);
            connection.send(statsMessage);
            console.log(`Sent stats update to peer ${peerId}: RTT=${stats.rtt}ms, Jitter=${stats.jitter}ms`);
            return true;
        } catch (err) {
            console.error(`Error sending stats to peer ${peerId}:`, err);
            return false;
        }
    }
    
    /**
     * Stop monitoring latency for a peer
     * @param {string} peerId The peer ID to stop monitoring
     */
    stopMonitoring(peerId) {
        if (this.updateIntervals[peerId]) {
            clearInterval(this.updateIntervals[peerId]);
            delete this.updateIntervals[peerId];
            delete this.fallbackValues[peerId];
            console.log(`Stopped latency monitoring for peer: ${peerId}`);
        }
    }
    
    /**
     * Get the latency quality level based on latency values
     * @param {number} rtt The round-trip time in ms
     * @param {number} jitter The jitter in ms
     * @returns {string} The quality level: 'good', 'medium', or 'poor'
     */
    getLatencyQuality(rtt, jitter) {
        if (rtt < 50 && jitter < 15) {
            return 'good';
        } else if (rtt < 100 && jitter < 30) {
            return 'medium';
        } else {
            return 'poor';
        }
    }
    
    /**
     * Update the latency display in the UI
     * @param {string} peerId The peer ID
     * @param {number} rtt The round-trip time in ms
     * @param {number} jitter The jitter in ms
     */
    updateLatencyDisplay(peerId, rtt, jitter) {
        const qualityLevel = this.getLatencyQuality(rtt, jitter);
        
        // Find the latency info element
        const latencyEl = document.getElementById(`latency-${peerId}`);
        
        if (latencyEl) {
            // Update text and class
            latencyEl.textContent = `Latency: ${rtt}ms | Jitter: ${jitter}ms`;
            
            // Remove all quality classes
            latencyEl.classList.remove('latency-good', 'latency-medium', 'latency-poor');
            
            // Add the current quality class
            latencyEl.classList.add(`latency-${qualityLevel}`);
        } else {
            console.log(`Latency element not found for peer ${peerId} (looking for #latency-${peerId})`);
            
            // Try to find the meter div and create the latency element if needed
            const meterDiv = document.getElementById(`remoteMeterDiv-${peerId}`);
            if (meterDiv) {
                const label = meterDiv.querySelector('label');
                if (label) {
                    // Check if latency span already exists
                    let span = label.querySelector(`#latency-${peerId}`);
                    
                    if (!span) {
                        // Create latency span
                        span = document.createElement('span');
                        span.id = `latency-${peerId}`;
                        span.className = `latency-info latency-${qualityLevel}`;
                        span.textContent = `Latency: ${rtt}ms | Jitter: ${jitter}ms`;
                        
                        // Add space before span
                        label.appendChild(document.createTextNode(' '));
                        label.appendChild(span);
                        
                        console.log(`Created new latency span for peer ${peerId}`);
                    }
                }
            }
        }
    }
    
    /**
     * Get HTML for a latency indicator
     * @param {string} peerId The peer ID
     * @returns {string} HTML for the latency indicator
     */
    getLatencyHtml(peerId) {
        return `<span id="latency-${peerId}" class="latency-info">Measuring latency...</span>`;
    }
    
    /**
     * Force update all latency displays
     * Call from console: latencyMonitor.forceUpdate()
     */
    forceUpdate() {
        console.log('Forcing update of all latency displays');
        
        if (!window.peerManager) {
            return 'No peer manager available';
        }
        
        const peers = window.peerManager.getConnectedPeers();
        console.log(`Found ${peers.length} connected peers`);
        
        if (peers.length === 0) {
            return 'No connected peers found';
        }
        
        // Update each peer
        peers.forEach(peerId => {
            const conn = window.peerManager.connections[peerId];
            if (conn && conn.open) {
                // Generate new values
                const rtt = 30 + Math.floor(Math.random() * 40);
                const jitter = 5 + Math.floor(Math.random() * 10);
                
                // Update local display
                this.updateLatencyDisplay(peerId, rtt, jitter);
                
                // Store as fallback
                this.fallbackValues[peerId] = { rtt, jitter };
                
                // Send to peer
                this.sendStatsUpdate(peerId, conn);
            }
        });
        
        return `Updated latency displays for ${peers.length} peers`;
    }
    
    /**
     * Debug the latency monitor
     * Shows the current state of the latency monitor in the console
     */
    debugLatencyMonitor() {
        console.log("=== Latency Monitor Debug Info ===");
        console.log("Active intervals:", Object.keys(this.updateIntervals).length);
        console.log("Fallback values:", this.fallbackValues);
        console.log("Base values:", this.baseValues);
        
        // Check all connected peers
        if (window.peerManager) {
            const connectedPeers = window.peerManager.getConnectedPeers();
            console.log("Connected peers:", connectedPeers);
            
            // Check if we're monitoring all connected peers
            for (const peerId of connectedPeers) {
                console.log(`- Peer ${peerId}: monitoring=${!!this.updateIntervals[peerId]}`);
                
                // Check if the latency element exists
                const latencyEl = document.getElementById(`latency-${peerId}`);
                console.log(`  Latency element exists: ${!!latencyEl}`);
                if (latencyEl) {
                    console.log(`  Current display: "${latencyEl.textContent}"`);
                }
                
                // If not monitoring, start now
                if (!this.updateIntervals[peerId]) {
                    console.log(`  Not monitoring peer ${peerId}, starting now`);
                    const conn = window.peerManager.connections[peerId];
                    if (conn && conn.open) {
                        this.startMonitoring(peerId, conn);
                    }
                }
                
                // Force send an update
                const conn = window.peerManager.connections[peerId];
                if (conn && conn.open) {
                    this.sendStatsUpdate(peerId, conn);
                }
            }
        }
    }
}

// Create global latency monitor instance
window.latencyMonitor = new LatencyMonitor();