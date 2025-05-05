/**
 * UI Controller for DAW Collaboration Tool
 * Handles UI updates and event handling
 */

class UIController {
    /**
     * Initialize the UI controller
     */
    static initialize() {
        // Audio settings elements
        this.audioInputSelect = utils.$('#audioInputSelect');
        this.refreshDevicesBtn = utils.$('#refreshDevicesBtn');
        this.sampleRateSelect = utils.$('#sampleRateSelect');
        this.bufferSizeSelect = utils.$('#bufferSizeSelect');
        this.bitDepthSelect = utils.$('#bitDepthSelect');
        
        // Button elements
        this.startAudioBtn = utils.$('#startAudioBtn');
        this.changeDeviceBtn = utils.$('#changeDeviceBtn');
        this.createSessionBtn = utils.$('#createSessionBtn');
        this.joinSessionBtn = utils.$('#joinSessionBtn');
        
        // Status and input elements
        this.sessionIdInput = utils.$('#sessionIdInput');
        this.shareUrlInput = utils.$('#shareUrlInput');
        this.copyLinkBtn = utils.$('#copyLinkBtn');
        this.connectionStatus = utils.$('#connectionStatus');
        this.myPeerId = utils.$('#myPeerId');
        this.peerList = utils.$('#peerList');
        this.remoteMeterContainer = null;
        
        // Add warning for low buffer sizes
        const warningElement = document.createElement('div');
        warningElement.className = 'buffer-warning';
        warningElement.textContent = 'Warning: Very low buffer sizes may cause audio glitches. Use only with high-performance systems and low-latency audio interfaces.';
        this.bufferSizeSelect.parentNode.appendChild(warningElement);
        
        // Show warning when low buffer sizes are selected
        this.bufferSizeSelect.addEventListener('change', function() {
            const value = parseInt(this.value);
            if (value < 128) {
                this.classList.add('low-latency');
            } else {
                this.classList.remove('low-latency');
            }
        });
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Initialize UI state
        this.updateUIState('initial');
        
        // Debug button
        const debugBtn = document.createElement('button');
        debugBtn.textContent = 'Debug Audio';
        debugBtn.style.marginTop = '10px';
        debugBtn.addEventListener('click', () => {
            audioManager.debugAudioInput();
        });
        document.querySelector('.controls').appendChild(debugBtn);
        
        // Add UI debug button
        const uiDebugBtn = document.createElement('button');
        uiDebugBtn.textContent = 'Debug UI';
        uiDebugBtn.style.marginTop = '10px';
        uiDebugBtn.style.marginLeft = '5px';
        uiDebugBtn.addEventListener('click', () => {
            this.debugUI();
        });
        document.querySelector('.controls').appendChild(uiDebugBtn);
        
        utils.log('UI Controller initialized');
    }
    
    /**
     * Debug UI elements
     * Helps troubleshoot issues with the UI
     */
    static debugUI() {
        console.log('=== UI Debug Information ===');
        
        // Check meters container
        const metersContainer = utils.$('.meters');
        console.log('Meters container:', metersContainer);
        
        // Check local meter
        const localMeter = utils.$('#localMeter');
        console.log('Local meter element:', localMeter);
        if (localMeter) {
            console.log('Local meter value:', localMeter.value);
        }
        
        // Check remote meters container
        console.log('Remote meter container:', this.remoteMeterContainer);
        
        // Check peer elements
        const peerList = utils.$('#peerList');
        console.log('Peer list element:', peerList);
        console.log('Peer list children:', peerList ? peerList.children.length : 0);
        
        // Check for remote meter elements
        const meterElements = document.querySelectorAll('meter');
        console.log('Total meter elements:', meterElements.length);
        meterElements.forEach((meter, index) => {
            console.log(`Meter ${index} id:`, meter.id, 'value:', meter.value);
        });
        
        // Check for latency elements
        const latencyElements = document.querySelectorAll('.latency-info');
        console.log('Total latency info elements:', latencyElements.length);
        latencyElements.forEach((span, index) => {
            console.log(`Latency span ${index} id:`, span.id, 'text:', span.textContent);
        });
        
        // Log connected peers
        if (window.peerManager) {
            const connectedPeers = window.peerManager.getConnectedPeers();
            console.log('Connected peers:', connectedPeers);
            
            // Check if each connected peer has a meter
            connectedPeers.forEach(peerId => {
                const peerMeter = utils.$(`#remoteMeter-${peerId}`);
                const peerLatency = utils.$(`#latency-${peerId}`);
                console.log(`Peer ${peerId} has meter:`, !!peerMeter, 'has latency element:', !!peerLatency);
            });
        }
        
        // Check latency monitor if available
        if (window.latencyMonitor) {
            window.latencyMonitor.debugLatencyMonitor();
        }
        
        utils.log('UI debugging information logged to console');
    }
    
    /**
     * Attach event listeners to UI elements
     */
    static attachEventListeners() {
        // Refresh devices button
        this.refreshDevicesBtn.addEventListener('click', () => {
            audioManager.enumerateDevices();
            utils.log('Audio devices refreshed');
        });
        
        // Start audio button
        this.startAudioBtn.addEventListener('click', async () => {
            try {
                this.updateUIState('loading');
                await audioManager.initAudio();
                this.updateUIState('audio_ready');
            } catch (error) {
                utils.log(`Error starting audio: ${error.message}`);
                this.updateUIState('error', error.message);
            }
        });
        
        // Change device button
        this.changeDeviceBtn.addEventListener('click', async () => {
            try {
                // Switch back to device selection mode
                await audioManager.stopAudio();
                this.updateUIState('initial');
                utils.log('Audio stopped. Select a new device.');
            } catch (error) {
                utils.log(`Error stopping audio: ${error.message}`);
                this.updateUIState('error', error.message);
            }
        });
        
        // Create session button
        this.createSessionBtn.addEventListener('click', async () => {
            try {
                this.updateUIState('connecting');
                await peerManager.initPeer(true);
                this.updateUIState('session_created');
                this.updateShareUrl();
            } catch (error) {
                utils.log(`Error creating session: ${error.message}`);
                this.updateUIState('error', error.message);
            }
        });
        
        // Join session button
        this.joinSessionBtn.addEventListener('click', async () => {
            try {
                const remotePeerId = this.sessionIdInput.value.trim();
                if (!remotePeerId) {
                    utils.showNotification('Please enter a Session ID to join', 'error');
                    return;
                }
                
                this.updateUIState('connecting');
                
                // Initialize peer if not already done
                if (!peerManager.peer) {
                    await peerManager.initPeer(false);
                }
                
                // Connect to the remote peer
                await peerManager.connectToPeer(remotePeerId);
                this.updateUIState('connected');
                
            } catch (error) {
                utils.log(`Error joining session: ${error.message}`);
                this.updateUIState('error', error.message);
            }
        });
        
        // Copy link button
        this.copyLinkBtn.addEventListener('click', () => {
            this.copyShareLinkToClipboard();
        });
        
        // Audio input select - enable start button when device is selected
        this.audioInputSelect.addEventListener('change', () => {
            this.startAudioBtn.disabled = !this.audioInputSelect.value;
        });
        
        // Session ID input - enable join button when text is entered
        this.sessionIdInput.addEventListener('input', () => {
            if (audioManager.localStream) {
                this.joinSessionBtn.disabled = !this.sessionIdInput.value.trim();
            }
        });
        
        // Window beforeunload event - clean up connections
        window.addEventListener('beforeunload', () => {
            peerManager.disconnect();
            audioManager.stop();
        });
    }
    
    /**
     * Update UI state based on application state
     * @param {string} state The current state
     * @param {string} message Optional message to display
     */
    static updateUIState(state, message = '') {
        // Check if user is joining from a shared link
        const isJoiningFromLink = window.location.search.includes('join=');
        
        switch (state) {
            case 'initial':
                // Initial state - only start audio button enabled if device selected
                this.startAudioBtn.disabled = !this.audioInputSelect.value;
                this.changeDeviceBtn.disabled = true;
                
                // If joining from a link, hide create session button
                if (isJoiningFromLink) {
                    this.createSessionBtn.style.display = 'none';
                } else {
                    this.createSessionBtn.style.display = 'inline-block';
                    this.createSessionBtn.disabled = true;
                }
                
                this.joinSessionBtn.disabled = true;
                this.audioInputSelect.disabled = false;
                this.refreshDevicesBtn.disabled = false;
                this.sampleRateSelect.disabled = false;
                this.bufferSizeSelect.disabled = false;
                this.bitDepthSelect.disabled = false;
                this.sessionIdInput.disabled = true;
                utils.$('.sharing-container').style.display = 'none';
                this.connectionStatus.textContent = 'Status: Select an audio input device';
                break;
                
            case 'loading':
                // Loading state - disable all buttons
                this.startAudioBtn.disabled = true;
                this.changeDeviceBtn.disabled = true;
                
                if (!isJoiningFromLink) {
                    this.createSessionBtn.disabled = true;
                }
                
                this.joinSessionBtn.disabled = true;
                this.audioInputSelect.disabled = true;
                this.refreshDevicesBtn.disabled = true;
                this.connectionStatus.textContent = 'Status: Starting audio...';
                break;
                
            case 'audio_ready':
                // Audio ready state - enable create/join buttons
                this.startAudioBtn.disabled = true;
                this.changeDeviceBtn.disabled = false;
                
                if (!isJoiningFromLink) {
                    this.createSessionBtn.disabled = false;
                }
                
                this.joinSessionBtn.disabled = !this.sessionIdInput.value.trim();
                this.audioInputSelect.disabled = true;
                this.refreshDevicesBtn.disabled = true;
                this.sampleRateSelect.disabled = true;
                this.bufferSizeSelect.disabled = true;
                this.bitDepthSelect.disabled = true;
                this.sessionIdInput.disabled = false;
                utils.$('.sharing-container').style.display = 'none';
                this.connectionStatus.textContent = 'Status: Audio ready. Create or join a session.';
                break;
                
            case 'connecting':
                // Connecting state - disable buttons during connection
                this.changeDeviceBtn.disabled = true;
                
                if (!isJoiningFromLink) {
                    this.createSessionBtn.disabled = true;
                }
                
                this.joinSessionBtn.disabled = true;
                this.sessionIdInput.disabled = true;
                utils.$('.sharing-container').style.display = 'none';
                this.connectionStatus.textContent = 'Status: Connecting...';
                break;
                
            case 'session_created':
                // Session created state
                this.changeDeviceBtn.disabled = true;
                
                if (!isJoiningFromLink) {
                    this.createSessionBtn.disabled = true;
                }
                
                this.joinSessionBtn.disabled = true;
                this.sessionIdInput.disabled = true;
                utils.$('.sharing-container').style.display = 'block';
                // Status is updated by the peer manager
                break;
                
            case 'connected':
                // Connected state
                this.changeDeviceBtn.disabled = true;
                
                if (!isJoiningFromLink) {
                    this.createSessionBtn.disabled = true;
                }
                
                this.joinSessionBtn.disabled = true;
                this.sessionIdInput.disabled = true;
                utils.$('.sharing-container').style.display = 'block';
                // Status is updated by the peer manager
                break;
                
            case 'error':
                // Error state - re-enable buttons as appropriate
                this.startAudioBtn.disabled = !this.audioInputSelect.value || audioManager.isAudioActive;
                this.changeDeviceBtn.disabled = !audioManager.isAudioActive;
                this.audioInputSelect.disabled = audioManager.isAudioActive;
                this.refreshDevicesBtn.disabled = audioManager.isAudioActive;
                
                if (!isJoiningFromLink) {
                    this.createSessionBtn.disabled = !audioManager.isAudioActive;
                }
                
                this.joinSessionBtn.disabled = !audioManager.isAudioActive || !this.sessionIdInput.value.trim();
                this.sessionIdInput.disabled = !audioManager.isAudioActive;
                this.connectionStatus.textContent = `Error: ${message}`;
                utils.showNotification(message, 'error');
                break;
        }
    }

    /**
     * Create or update a meter for a remote peer
     * This ensures latency display works properly with the simplified approach
     * @param {string} peerId The ID of the peer
     */
    static createRemoteMeter(peerId) {
        console.log(`Creating remote meter for peer: ${peerId}`);
        
        // Check if the container exists, if not create it
        if (!this.remoteMeterContainer) {
            const metersDiv = document.querySelector('.meters');
            console.log('Creating new remote meters container in:', metersDiv);
            
            this.remoteMeterContainer = document.createElement('div');
            this.remoteMeterContainer.id = 'remoteMeterContainer';
            this.remoteMeterContainer.className = 'remote-meters';
            metersDiv.appendChild(this.remoteMeterContainer);
            
            console.log('Remote meters container created:', this.remoteMeterContainer);
        }
        
        // Check if meter already exists for this peer
        if (document.getElementById(`remoteMeter-${peerId}`)) {
            console.log(`Remote meter for peer ${peerId} already exists, skipping creation`);
            return; // Already exists
        }
        
        // Create a new meter element
        const meterDiv = document.createElement('div');
        meterDiv.className = 'meter';
        meterDiv.id = `remoteMeterDiv-${peerId}`;
        
        // Create label element
        const label = document.createElement('label');
        
        // Use text node for the first part of the label
        const labelText = document.createTextNode(`Remote Audio (${peerId}): `);
        label.appendChild(labelText);
        
        // Create latency span element with a unique ID for targeting
        const latencySpan = document.createElement('span');
        latencySpan.id = `latency-${peerId}`;
        latencySpan.className = 'latency-info';
        latencySpan.textContent = 'Measuring latency...';
        
        // Append latency span to label
        label.appendChild(latencySpan);
        
        // Create meter element
        const meter = document.createElement('meter');
        meter.id = `remoteMeter-${peerId}`;
        meter.min = 0;
        meter.max = 100;
        meter.value = 0;
        
        // Assemble the meter div
        meterDiv.appendChild(label);
        meterDiv.appendChild(meter);
        this.remoteMeterContainer.appendChild(meterDiv);
        
        // Debug log
        console.log(`Created remote meter elements for peer ${peerId}:`);
        console.log(`- Meter div ID: remoteMeterDiv-${peerId}`);
        console.log(`- Meter element ID: remoteMeter-${peerId}`);
        console.log(`- Latency span ID: latency-${peerId}`);
        
        // Force an immediate latency update if latencyMonitor is available
        if (window.latencyMonitor) {
            setTimeout(() => {
                console.log(`Forcing latency update for peer ${peerId}`);
                window.latencyMonitor.updateLatencyStats(peerId);
            }, 500);
        }
    }
    
    /**
     * Remove a meter for a remote peer
     * @param {string} peerId The ID of the peer
     */
    static removeRemoteMeter(peerId) {
        console.log(`Removing remote meter for peer: ${peerId}`);
        
        const meterDiv = utils.$(`#remoteMeterDiv-${peerId}`);
        if (meterDiv) {
            meterDiv.remove();
            console.log(`Removed meter div for peer ${peerId}`);
        } else {
            console.log(`Meter div for peer ${peerId} not found`);
        }
        
        // If no remote meters left, remove the container
        if (this.remoteMeterContainer && this.remoteMeterContainer.children.length === 0) {
            this.remoteMeterContainer.remove();
            this.remoteMeterContainer = null;
            console.log('Removed remote meters container (no children left)');
        }
    }
    
    /**
     * Update the share URL input field with the current session link
     */
    static updateShareUrl() {
        if (peerManager.peerId) {
            const shareUrl = this.generateShareUrl(peerManager.peerId);
            this.shareUrlInput.value = shareUrl;
            utils.log(`Share URL created: ${shareUrl}`);
        }
    }
    
    /**
     * Generate a share URL for the given peer ID
     * @param {string} peerId The peer ID to share
     * @returns {string} The share URL
     */
    static generateShareUrl(peerId) {
        const url = new URL(window.location.href);
        url.searchParams.set('join', peerId);
        return url.toString();
    }
    
    /**
     * Copy the share link to the clipboard
     */
    static copyShareLinkToClipboard() {
        const shareUrl = this.shareUrlInput.value;
        
        if (!shareUrl) return;
        
        try {
            navigator.clipboard.writeText(shareUrl).then(() => {
                utils.showNotification('Link copied to clipboard!', 'info');
                utils.log('Share link copied to clipboard');
            }).catch(err => {
                utils.log(`Failed to copy link: ${err}`);
                this.fallbackCopy();
            });
        } catch (err) {
            utils.log(`Clipboard API not available: ${err}`);
            this.fallbackCopy();
        }
    }
    
    /**
     * Fallback copy method for browsers that don't support clipboard API
     */
    static fallbackCopy() {
        this.shareUrlInput.select();
        try {
            document.execCommand('copy');
            utils.showNotification('Link copied to clipboard!', 'info');
        } catch (err) {
            utils.showNotification('Failed to copy. Please copy the link manually.', 'error');
        }
        // Deselect
        window.getSelection().removeAllRanges();
    }
    
    /**
     * Check for a join parameter in the URL and connect if present
     */
    static checkUrlForJoinParameter() {
        const url = new URL(window.location.href);
        const joinParam = url.searchParams.get('join');
        
        if (joinParam) {
            utils.log(`Join parameter found in URL: ${joinParam}`);
            this.sessionIdInput.value = joinParam;
            
            // Hide create session button if joining from a link
            this.createSessionBtn.style.display = 'none';
            
            // Show notification
            utils.showNotification('Session ID detected in URL. Click "Join Session" after starting your audio.', 'info');
            
            // Clear the parameter from the URL to prevent auto-joining on refresh
            url.searchParams.delete('join');
            window.history.replaceState({}, document.title, url.toString());
        }
    }
    
    /**
     * Add a peer to the list in the UI
     * @param {string} peerId The ID of the peer
     */
    static addPeerToList(peerId) {
        console.log(`Adding peer to list: ${peerId}`);
        
        // Check if already in the list
        if (utils.$(`#peer-${peerId}`)) {
            console.log(`Peer ${peerId} already in list, skipping`);
            return; // Already in the list
        }
        
        const peerItem = document.createElement('li');
        peerItem.className = 'peer-item';
        peerItem.id = `peer-${peerId}`;
        
        const peerInfo = document.createElement('div');
        peerInfo.textContent = `Peer: ${peerId}`;
        
        // Updated disconnect button event handler in UI-Controller.js
        // This goes in the addPeerToList method
        const disconnectBtn = document.createElement('button');
        disconnectBtn.textContent = 'Disconnect';
        disconnectBtn.addEventListener('click', () => {
            // Comprehensive disconnect operation
            if (peerManager) {
                // Close data connection if it exists
                if (peerManager.connections[peerId] && peerManager.connections[peerId].open) {
                    peerManager.connections[peerId].close();
                }
                
                // Close media connection if it exists
                if (peerManager.calls[peerId]) {
                    peerManager.calls[peerId].close();
                }
                
                // Remove remote stream from audio manager
                if (window.audioManager) {
                    audioManager.removeRemoteStream(peerId);
                }
                
                // Stop latency monitoring if active
                if (window.latencyMonitor) {
                    window.latencyMonitor.stopMonitoring(peerId);
                }
                
                // Remove fallback audio element if it exists
                const fallbackAudio = document.getElementById(`audio-fallback-${peerId}`);
                if (fallbackAudio) {
                    fallbackAudio.pause();
                    fallbackAudio.remove();
                }
                
                // Remove from UI list
                UIController.removePeerFromList(peerId);
                
                utils.log(`Peer ${peerId} disconnected successfully`);
            }
        });
        
        peerItem.appendChild(peerInfo);
        peerItem.appendChild(disconnectBtn);
        this.peerList.appendChild(peerItem);
        
        console.log(`Peer ${peerId} added to list`);
        
        // Create the remote meter for this peer if not already created
        this.createRemoteMeter(peerId);
    }
    
    /**
     * Remove a peer from the list in the UI
     * @param {string} peerId The ID of the peer
     */
    static removePeerFromList(peerId) {
        console.log(`Removing peer from list: ${peerId}`);
        
        const peerItem = utils.$(`#peer-${peerId}`);
        if (peerItem) {
            peerItem.remove();
            console.log(`Removed peer ${peerId} from list`);
        } else {
            console.log(`Peer ${peerId} not found in list`);
        }
        
        // Remove the remote meter for this peer
        this.removeRemoteMeter(peerId);
        
        // Update connection status if no peers left
        if (this.peerList.children.length === 0) {
            this.connectionStatus.textContent = 'Status: No peers connected';
            console.log('Updated connection status: No peers connected');
        }
    }
}

// Initialize UI controller
window.UIController = UIController;