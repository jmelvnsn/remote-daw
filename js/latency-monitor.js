/**
 * Latency Monitor for DAW Collaboration Tool
 * Tracks real-time latency and jitter between peers
 */

class LatencyMonitor {
    constructor() {
        this.pingIntervals = {}; // Store interval IDs by peer ID
        this.pingHistory = {}; // Store ping history for each peer
        this.historyLength = 10; // Number of pings to keep in history
        this.pingInterval = 2000; // Ping every 2 seconds (ms)
        this.pendingPings = {}; // Track pending pings by ID
        this.initial = true; // First run flag
    }
    
    /**
     * Start monitoring latency for a peer
     * @param {string} peerId The peer ID to monitor
     * @param {DataConnection} connection The peer connection
     */
    startMonitoring(peerId, connection) {
        if (this.pingIntervals[peerId]) {
            return; // Already monitoring this peer
        }
        
        utils.log(`Starting latency monitoring for peer: ${peerId}`);
        
        // Initialize ping history
        this.pingHistory[peerId] = [];
        
        // Send pings at regular intervals
        this.pingIntervals[peerId] = setInterval(() => {
            this.sendPing(peerId, connection);
        }, this.pingInterval);
        
        // Also send an immediate ping to get values faster
        setTimeout(() => {
            this.sendPing(peerId, connection);
        }, 200);
        
        // Setup data handler for pings/pongs
        connection.on('data', (data) => {
            if (data && typeof data === 'object') {
                if (data.type === 'latency-ping') {
                    // Respond to ping with a pong
                    console.log(`Received ping from ${peerId} with ID ${data.pingId}`);
                    connection.send({
                        type: 'latency-pong',
                        pingId: data.pingId,
                        timestamp: data.timestamp
                    });
                } else if (data.type === 'latency-pong') {
                    // Process the pong
                    console.log(`Received pong from ${peerId} with ID ${data.pingId}`);
                    this.processPong(peerId, data);
                }
            }
        });
    }
    
    /**
     * Stop monitoring latency for a peer
     * @param {string} peerId The peer ID to stop monitoring
     */
    stopMonitoring(peerId) {
        if (this.pingIntervals[peerId]) {
            clearInterval(this.pingIntervals[peerId]);
            delete this.pingIntervals[peerId];
            delete this.pingHistory[peerId];
            
            // Clean up any pending pings for this peer
            for (const pingId in this.pendingPings) {
                if (this.pendingPings[pingId].peerId === peerId) {
                    delete this.pendingPings[pingId];
                }
            }
            
            utils.log(`Stopped latency monitoring for peer: ${peerId}`);
        }
    }
    
    /**
     * Send a ping to a peer
     * @param {string} peerId The peer ID to ping
     * @param {DataConnection} connection The peer connection
     */
    sendPing(peerId, connection) {
        if (!connection || !connection.open) {
            this.stopMonitoring(peerId);
            return;
        }
        
        // Generate a unique ping ID
        const pingId = `ping-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Store the ping
        this.pendingPings[pingId] = {
            timestamp: Date.now(),
            peerId: peerId
        };
        
        // Send the ping
        try {
            connection.send({
                type: 'latency-ping',
                pingId: pingId,
                timestamp: Date.now()
            });
            console.log(`Sent ping ${pingId} to peer ${peerId}`);
        } catch (err) {
            console.error(`Error sending ping to ${peerId}: ${err.message}`);
        }
    }
    
    /**
     * Process a pong response
     * @param {string} peerId The peer ID that sent the pong
     * @param {Object} data The pong data
     */
    processPong(peerId, data) {
        const now = Date.now();
        const pingId = data.pingId;
        
        // Check if we have a matching ping
        if (!this.pendingPings[pingId]) {
            console.log(`Received unknown pong ${pingId} from ${peerId}`);
            return; // Unknown ping ID
        }
        
        // Calculate round-trip time
        const rtt = now - this.pendingPings[pingId].timestamp;
        console.log(`Calculated RTT for ${peerId}: ${rtt}ms`);
        
        // Add to history
        if (!this.pingHistory[peerId]) {
            this.pingHistory[peerId] = [];
        }
        
        this.pingHistory[peerId].push(rtt);
        
        // Keep history at the specified length
        while (this.pingHistory[peerId].length > this.historyLength) {
            this.pingHistory[peerId].shift();
        }
        
        // Update UI
        this.updateLatencyDisplay(peerId);
        
        // Clean up
        delete this.pendingPings[pingId];
    }
    
    /**
     * Calculate current latency statistics
     * @param {string} peerId The peer ID
     * @returns {Object} Latency statistics object
     */
    calculateLatencyStats(peerId) {
        const history = this.pingHistory[peerId];
        
        if (!history || history.length === 0) {
            return { avg: 0, min: 0, max: 0, jitter: 0 };
        }
        
        // Calculate average
        const sum = history.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / history.length);
        
        // Min and max
        const min = Math.min(...history);
        const max = Math.max(...history);
        
        // Calculate jitter (variation in latency)
        let jitterSum = 0;
        for (let i = 1; i < history.length; i++) {
            jitterSum += Math.abs(history[i] - history[i-1]);
        }
        const jitter = history.length > 1 ? Math.round(jitterSum / (history.length - 1)) : 0;
        
        return { avg, min, max, jitter };
    }
    
    /**
     * Get the latency quality level based on latency value
     * @param {number} latency The latency in ms
     * @param {number} jitter The jitter in ms
     * @returns {string} The quality level: 'good', 'medium', or 'poor'
     */
    getLatencyQuality(latency, jitter) {
        if (latency < 50 && jitter < 15) {
            return 'good';
        } else if (latency < 100 && jitter < 30) {
            return 'medium';
        } else {
            return 'poor';
        }
    }
    
    /**
     * Update the latency display in the UI
     * @param {string} peerId The peer ID
     */
    updateLatencyDisplay(peerId) {
        // Calculate the statistics
        const stats = this.calculateLatencyStats(peerId);
        const qualityLevel = this.getLatencyQuality(stats.avg, stats.jitter);
        
        console.log(`Updating latency display for ${peerId}: ${JSON.stringify(stats)}`);
        
        // Find the latency info element
        const latencyEl = document.getElementById(`latency-${peerId}`);
        
        if (latencyEl) {
            // Update text and class
            latencyEl.textContent = `Latency: ${stats.avg}ms | Jitter: ${stats.jitter}ms`;
            
            // Remove all quality classes
            latencyEl.classList.remove('latency-good', 'latency-medium', 'latency-poor');
            
            // Add the current quality class
            latencyEl.classList.add(`latency-${qualityLevel}`);
            
            console.log(`Updated latency display for ${peerId}`);
        } else {
            console.error(`Could not find latency element for peer ${peerId} (looking for #latency-${peerId})`);
            
            // Try to find it with a more general selector
            const allLatencyElements = document.querySelectorAll('[id^="latency-"]');
            console.log(`Found ${allLatencyElements.length} latency elements in total`);
            
            // Attempt to recreate the element if needed
            const meterDiv = document.getElementById(`remoteMeterDiv-${peerId}`);
            if (meterDiv) {
                console.log(`Found meter div for ${peerId}, checking for latency element inside`);
                const labelEl = meterDiv.querySelector('label');
                
                if (labelEl) {
                    console.log(`Found label element, checking if it already has a latency span`);
                    let existingSpan = labelEl.querySelector(`#latency-${peerId}`);
                    
                    if (!existingSpan) {
                        console.log(`Creating new latency span for ${peerId}`);
                        existingSpan = document.createElement('span');
                        existingSpan.id = `latency-${peerId}`;
                        existingSpan.className = 'latency-info';
                        existingSpan.textContent = `Latency: ${stats.avg}ms | Jitter: ${stats.jitter}ms`;
                        existingSpan.classList.add(`latency-${qualityLevel}`);
                        labelEl.appendChild(document.createTextNode(' '));
                        labelEl.appendChild(existingSpan);
                        console.log(`Added new latency span to label`);
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
     * Debug the latency monitor
     * Shows the current state of the latency monitor in the console
     */
    debugLatencyMonitor() {
        console.log("=== Latency Monitor Debug Info ===");
        console.log("Active ping intervals:", Object.keys(this.pingIntervals).length);
        console.log("Pending pings:", Object.keys(this.pendingPings).length);
        
        // Log history for each peer
        console.log("Ping History:");
        for (const peerId in this.pingHistory) {
            const stats = this.calculateLatencyStats(peerId);
            console.log(`- Peer ${peerId}: ${this.pingHistory[peerId].length} samples`);
            console.log(`  Latest values: ${this.pingHistory[peerId].slice(-5).join(', ')}ms`);
            console.log(`  Stats: avg=${stats.avg}ms, min=${stats.min}ms, max=${stats.max}ms, jitter=${stats.jitter}ms`);
            
            // Check if the UI element exists
            const latencyEl = document.getElementById(`latency-${peerId}`);
            console.log(`  UI Element exists: ${!!latencyEl}`);
            if (latencyEl) {
                console.log(`  Current display: "${latencyEl.textContent}"`);
            }
        }
        
        // Check all connected peers
        if (window.peerManager) {
            const connectedPeers = window.peerManager.getConnectedPeers();
            console.log("Connected peers:", connectedPeers);
            
            // Check if we're monitoring all connected peers
            for (const peerId of connectedPeers) {
                console.log(`- Peer ${peerId}: monitoring=${!!this.pingIntervals[peerId]}`);
                
                // Force send a ping if we're monitoring but have no data
                if (this.pingIntervals[peerId] && 
                    (!this.pingHistory[peerId] || this.pingHistory[peerId].length === 0)) {
                    console.log(`  No data for peer ${peerId}, forcing a ping`);
                    this.sendPing(peerId, window.peerManager.connections[peerId]);
                }
            }
        }
    }
    
    /**
     * Force send pings to all connected peers
     * Call this from console: latencyMonitor.forcePingAll()
     */
    forcePingAll() {
        if (!window.peerManager) {
            console.error("Peer manager not available");
            return;
        }
        
        const peers = window.peerManager.getConnectedPeers();
        console.log(`Forcing pings to ${peers.length} peers`);
        
        peers.forEach(peerId => {
            const conn = window.peerManager.connections[peerId];
            if (conn && conn.open) {
                // Stop existing monitoring
                this.stopMonitoring(peerId);
                
                // Start fresh
                this.startMonitoring(peerId, conn);
                
                // Send immediate ping
                this.sendPing(peerId, conn);
                
                console.log(`Forced new ping to ${peerId}`);
            }
        });
        
        // Schedule debug output
        setTimeout(() => {
            this.debugLatencyMonitor();
        }, 3000);
        
        return `Sent forced pings to ${peers.length} peers`;
    }
}

// Create global latency monitor instance
window.latencyMonitor = new LatencyMonitor();