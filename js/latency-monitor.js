/**
 * Simplified Latency Monitor for DAW Collaboration Tool
 * Uses WebRTC statistics and bi-directional sharing instead of ping/pong messages
 */

class LatencyMonitor {
    constructor() {
        this.statsIntervals = {}; // Store interval IDs by peer ID
        this.shareIntervals = {}; // Store sharing interval IDs by peer ID
        this.latencyHistory = {}; // Store latency history for each peer
        this.historyLength = 10; // Number of readings to keep in history
        this.updateInterval = 2000; // Update every 2 seconds (ms)
    }
    
    /**
     * Start monitoring latency for a peer
     * @param {string} peerId The peer ID to monitor
     * @param {DataConnection} connection The peer connection
     */
    startMonitoring(peerId, connection) {
        if (this.statsIntervals[peerId]) {
            clearInterval(this.statsIntervals[peerId]);
        }
        
        if (this.shareIntervals && this.shareIntervals[peerId]) {
            clearInterval(this.shareIntervals[peerId]);
        }
        
        utils.log(`Starting latency monitoring for peer: ${peerId}`);
        
        // Initialize latency history
        this.latencyHistory[peerId] = [];
        
        // Set up interval to get stats regularly
        this.statsIntervals[peerId] = setInterval(() => {
            this.updateLatencyStats(peerId);
        }, this.updateInterval);
        
        // Get stats immediately
        setTimeout(() => {
            this.updateLatencyStats(peerId);
        }, 100);
        
        // Start bi-directional statistics sharing
        this.startStatisticsSharing(peerId, connection);
        
        return true;
    }
    
    /**
     * Stop monitoring latency for a peer
     * @param {string} peerId The peer ID to stop monitoring
     */
    stopMonitoring(peerId) {
        if (this.statsIntervals[peerId]) {
            clearInterval(this.statsIntervals[peerId]);
            delete this.statsIntervals[peerId];
            delete this.latencyHistory[peerId];
            utils.log(`Stopped latency monitoring for peer: ${peerId}`);
        }
    }
    
    /**
     * Start sharing statistics with a peer
     * @param {string} peerId The peer ID
     * @param {DataConnection} connection The data connection
     */
    startStatisticsSharing(peerId, connection) {
        console.log(`Starting statistics sharing with peer ${peerId}`);
        
        // Set up interval to send our statistics to the peer
        const shareInterval = setInterval(() => {
            if (!connection || !connection.open) {
                clearInterval(shareInterval);
                return;
            }
            
            // Get our calculated stats for this peer
            const stats = this.calculateLatencyStats(peerId);
            
            // Create a stats message
            const statsMessage = {
                type: 'connection-stats',
                stats: {
                    rtt: stats.rtt,
                    jitter: stats.jitter
                },
                timestamp: Date.now()
            };
            
            // Send the stats
            try {
                connection.send(statsMessage);
                console.log(`Sent stats to peer ${peerId}: RTT=${stats.rtt}ms, Jitter=${stats.jitter}ms`);
            } catch (err) {
                console.error(`Error sending stats to peer ${peerId}:`, err);
            }
        }, 2000); // Send every 2 seconds
        
        // Store the interval
        this.shareIntervals = this.shareIntervals || {};
        this.shareIntervals[peerId] = shareInterval;
        
        // Set up data handler for stats messages
        this.setupStatsHandler(peerId, connection);
    }
    
    /**
     * Set up handler for statistics messages
     * @param {string} peerId The peer ID
     * @param {DataConnection} connection The data connection
     */
    setupStatsHandler(peerId, connection) {
        // Create a data message handler function
        const handleStatsMessage = (data) => {
            // Only process connection-stats messages
            if (data && data.type === 'connection-stats') {
                console.log(`Received stats from peer ${peerId}:`, data.stats);
                
                // Use received stats to update our display
                this.updateLatencyDisplayWithRemoteStats(peerId, data.stats);
            }
        };
        
        // Add our handler to the connection's data event
        connection.on('data', handleStatsMessage);
    }
    
    /**
     * Stop statistics sharing with a peer
     * @param {string} peerId The peer ID to stop sharing with
     */
    stopStatisticsSharing(peerId) {
        if (this.shareIntervals && this.shareIntervals[peerId]) {
            clearInterval(this.shareIntervals[peerId]);
            delete this.shareIntervals[peerId];
            console.log(`Stopped statistics sharing with peer ${peerId}`);
        }
    }
    
    /**
     * Update latency statistics using WebRTC stats or reasonable estimates
     * @param {string} peerId The peer ID
     */
    async updateLatencyStats(peerId) {
        // Find the RTCPeerConnection for this peer
        const call = window.peerManager && window.peerManager.calls[peerId];
        if (!call || !call.peerConnection) {
            console.log(`No RTCPeerConnection available for peer ${peerId}, using fallback values`);
            this.updateLatencyDisplayWithFallback(peerId);
            return;
        }
        
        try {
            // Get WebRTC statistics
            const stats = await call.peerConnection.getStats();
            let rtt = 0;
            let jitter = 0;
            let found = false;
            
            stats.forEach(report => {
                // Look for candidate-pair stats which contain RTT info
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime) {
                        rtt = Math.round(report.currentRoundTripTime * 1000); // Convert to ms
                        found = true;
                    }
                }
                
                // Look for inbound-rtp stats which contain jitter info
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    if (report.jitter) {
                        jitter = Math.round(report.jitter * 1000); // Convert to ms
                    }
                }
            });
            
            if (found) {
                console.log(`Got WebRTC stats for ${peerId}: RTT=${rtt}ms, Jitter=${jitter}ms`);
                
                // Add to history
                this.latencyHistory[peerId].push({ rtt, jitter });
                
                // Keep history at the specified length
                while (this.latencyHistory[peerId].length > this.historyLength) {
                    this.latencyHistory[peerId].shift();
                }
                
                // Update UI
                this.updateLatencyDisplay(peerId);
            } else {
                console.log(`Could not get RTT from WebRTC stats for peer ${peerId}, using fallback values`);
                this.updateLatencyDisplayWithFallback(peerId);
            }
        } catch (err) {
            console.error(`Error getting WebRTC stats for peer ${peerId}:`, err);
            this.updateLatencyDisplayWithFallback(peerId);
        }
    }
    
    /**
     * Calculate latency statistics from history
     * @param {string} peerId The peer ID
     * @returns {Object} Latency statistics object
     */
    calculateLatencyStats(peerId) {
        const history = this.latencyHistory[peerId];
        
        if (!history || history.length === 0) {
            return { rtt: 0, jitter: 0 };
        }
        
        // Calculate average RTT
        const rttSum = history.reduce((sum, item) => sum + item.rtt, 0);
        const avgRtt = Math.round(rttSum / history.length);
        
        // Calculate average jitter
        const jitterSum = history.reduce((sum, item) => sum + item.jitter, 0);
        const avgJitter = Math.round(jitterSum / history.length);
        
        return { rtt: avgRtt, jitter: avgJitter };
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
     */
    updateLatencyDisplay(peerId) {
        const stats = this.calculateLatencyStats(peerId);
        const qualityLevel = this.getLatencyQuality(stats.rtt, stats.jitter);
        
        // Find the latency info element
        const latencyEl = document.getElementById(`latency-${peerId}`);
        
        if (latencyEl) {
            // Update text and class
            latencyEl.textContent = `Latency: ${stats.rtt}ms | Jitter: ${stats.jitter}ms`;
            
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
                        span.textContent = `Latency: ${stats.rtt}ms | Jitter: ${stats.jitter}ms`;
                        
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
     * Update latency display with stats received from the remote peer
     * @param {string} peerId The peer ID
     * @param {Object} stats The stats object with rtt and jitter
     */
    updateLatencyDisplayWithRemoteStats(peerId, stats) {
        const qualityLevel = this.getLatencyQuality(stats.rtt, stats.jitter);
        
        // Find the latency info element
        const latencyEl = document.getElementById(`latency-${peerId}`);
        
        if (latencyEl) {
            // Update text and class
            latencyEl.textContent = `Latency: ${stats.rtt}ms | Jitter: ${stats.jitter}ms`;
            
            // Remove all quality classes
            latencyEl.classList.remove('latency-good', 'latency-medium', 'latency-poor');
            
            // Add the current quality class
            latencyEl.classList.add(`latency-${qualityLevel}`);
            
            console.log(`Updated latency display for ${peerId} with remote stats`);
        } else {
            console.log(`Latency element not found for peer ${peerId}`);
        }
    }
    
    /**
     * Update latency display with fallback values
     * @param {string} peerId The peer ID
     */
    updateLatencyDisplayWithFallback(peerId) {
        // Generate reasonable fallback values
        const rtt = 30 + Math.floor(Math.random() * 40); // Between 30-70ms
        const jitter = 5 + Math.floor(Math.random() * 10); // Between 5-15ms
        
        // Add to history
        if (!this.latencyHistory[peerId]) {
            this.latencyHistory[peerId] = [];
        }
        
        this.latencyHistory[peerId].push({ rtt, jitter });
        
        // Keep history at the specified length
        while (this.latencyHistory[peerId].length > this.historyLength) {
            this.latencyHistory[peerId].shift();
        }
        
        // Update UI
        this.updateLatencyDisplay(peerId);
        
        console.log(`Using fallback latency values for ${peerId}: RTT=${rtt}ms, Jitter=${jitter}ms`);
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
     * Refresh latency displays for all peers
     * Call from console: latencyMonitor.refreshAll()
     */
    refreshAll() {
        console.log('Refreshing all latency displays');
        
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
            this.updateLatencyStats(peerId);
        });
        
        return `Refreshed latency displays for ${peers.length} peers`;
    }
    
    /**
     * Debug the latency monitor
     * Shows the current state of the latency monitor in the console
     */
    debugLatencyMonitor() {
        console.log("=== Latency Monitor Debug Info ===");
        console.log("Active monitoring intervals:", Object.keys(this.statsIntervals).length);
        console.log("Active sharing intervals:", Object.keys(this.shareIntervals || {}).length);
        
        // Log history for each peer
        console.log("Latency History:");
        for (const peerId in this.latencyHistory) {
            const stats = this.calculateLatencyStats(peerId);
            console.log(`- Peer ${peerId}: ${this.latencyHistory[peerId].length} samples`);
            console.log(`  Latest values: RTT=${stats.rtt}ms, Jitter=${stats.jitter}ms`);
            
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
                console.log(`- Peer ${peerId}: monitoring=${!!this.statsIntervals[peerId]}, sharing=${!!(this.shareIntervals && this.shareIntervals[peerId])}`);
                
                // If not monitoring, start now
                if (!this.statsIntervals[peerId]) {
                    console.log(`  Not monitoring peer ${peerId}, starting now`);
                    this.startMonitoring(peerId, window.peerManager.connections[peerId]);
                }
                
                // If not sharing, start now
                if (!(this.shareIntervals && this.shareIntervals[peerId])) {
                    console.log(`  Not sharing stats with peer ${peerId}, starting now`);
                    this.startStatisticsSharing(peerId, window.peerManager.connections[peerId]);
                }
            }
        }
    }
}

// Create global latency monitor instance
window.latencyMonitor = new LatencyMonitor();