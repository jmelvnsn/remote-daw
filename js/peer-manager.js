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
    }
    
    /**
     * Initialize the PeerJS connection
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
                
                // Create a new Peer with the ID
                this.peer = new Peer(customId, {
                    debug: 2,
                    config: {
                        'iceServers': [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
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
     * Call a peer to establish audio streaming
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
                
                // Make the call with our local stream
                const call = this.peer.call(remotePeerId, audioManager.getLocalStream());
                this.calls[remotePeerId] = call;
                
                // Handle the call events
                call.on('stream', (remoteStream) => {
                    utils.log(`Received remote stream from: ${remotePeerId}`);
                    audioManager.processRemoteStream(remoteStream, remotePeerId);
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
            
            // Start latency monitoring
            latencyMonitor.startMonitoring(conn.peer, conn);
            
            // Send audio settings
            conn.send({
                type: 'audio-settings',
                settings: audioManager.getAudioSettings()
            });
        });
        
        // Handle data
        conn.on('data', (data) => {
            if (data.type === 'audio-settings') {
                utils.log(`Received audio settings from ${conn.peer}: ${JSON.stringify(data.settings)}`);
            } else if (data.type === 'chat') {
                utils.log(`${conn.peer}: ${data.message}`);
            }
            // Note: Latency ping/pong messages are handled by the LatencyMonitor
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
     * Handle an incoming call
     * @param {MediaConnection} call The media connection
     */
    handleIncomingCall(call) {
        utils.log(`Incoming call from: ${call.peer}`);
        
        // Store the call
        this.calls[call.peer] = call;
        
        // Answer the call with our local stream
        call.answer(audioManager.getLocalStream());
        
        // Handle the incoming stream
        call.on('stream', (remoteStream) => {
            utils.log(`Received remote stream from: ${call.peer}`);
            audioManager.processRemoteStream(remoteStream, call.peer);
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
     * Handle peer disconnection
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
        
        // Stop latency monitoring
        latencyMonitor.stopMonitoring(peerId);
        
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

// Create global peer manager instance
window.peerManager = new PeerManager();