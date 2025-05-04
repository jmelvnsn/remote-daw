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
        
        utils.log('UI Controller initialized');
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
     * @param {string} peerId The ID of the peer
     */
    static createRemoteMeter(peerId) {
        // Check if the container exists, if not create it
        if (!this.remoteMeterContainer) {
            const metersDiv = utils.$('.meters');
            this.remoteMeterContainer = document.createElement('div');
            this.remoteMeterContainer.id = 'remoteMeterContainer';
            this.remoteMeterContainer.className = 'remote-meters';
            metersDiv.appendChild(this.remoteMeterContainer);
        }
        
        // Check if meter already exists for this peer
        if (utils.$(`#remoteMeter-${peerId}`)) {
            return; // Already exists
        }
        
        // Create a new meter element
        const meterDiv = document.createElement('div');
        meterDiv.className = 'meter';
        meterDiv.id = `remoteMeterDiv-${peerId}`;
        
        // Include latency info in the label
        const label = document.createElement('label');
        label.innerHTML = `Remote Audio (${peerId}): ${latencyMonitor.getLatencyHtml(peerId)}`;
        
        const meter = document.createElement('meter');
        meter.id = `remoteMeter-${peerId}`;
        meter.min = 0;
        meter.max = 100;
        meter.value = 0;
        
        meterDiv.appendChild(label);
        meterDiv.appendChild(meter);
        this.remoteMeterContainer.appendChild(meterDiv);
    }
    
    /**
     * Remove a meter for a remote peer
     * @param {string} peerId The ID of the peer
     */
    static removeRemoteMeter(peerId) {
        const meterDiv = utils.$(`#remoteMeterDiv-${peerId}`);
        if (meterDiv) {
            meterDiv.remove();
        }
        
        // If no remote meters left, remove the container
        if (this.remoteMeterContainer && this.remoteMeterContainer.children.length === 0) {
            this.remoteMeterContainer.remove();
            this.remoteMeterContainer = null;
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
        // Check if already in the list
        if (utils.$(`#peer-${peerId}`)) {
            return; // Already in the list
        }
        
        const peerItem = document.createElement('li');
        peerItem.className = 'peer-item';
        peerItem.id = `peer-${peerId}`;
        
        const peerInfo = document.createElement('div');
        peerInfo.textContent = `Peer: ${peerId}`;
        
        const disconnectBtn = document.createElement('button');
        disconnectBtn.textContent = 'Disconnect';
        disconnectBtn.addEventListener('click', () => {
            if (peerManager.isConnectedToPeer(peerId)) {
                peerManager.connections[peerId].close();
            }
            this.removePeerFromList(peerId);
        });
        
        peerItem.appendChild(peerInfo);
        peerItem.appendChild(disconnectBtn);
        this.peerList.appendChild(peerItem);
        
        // Create the remote meter for this peer if not already created
        this.createRemoteMeter(peerId);
    }
    
    /**
     * Remove a peer from the list in the UI
     * @param {string} peerId The ID of the peer
     */
    static removePeerFromList(peerId) {
        const peerItem = utils.$(`#peer-${peerId}`);
        if (peerItem) {
            peerItem.remove();
        }
        
        // Remove the remote meter for this peer
        this.removeRemoteMeter(peerId);
        
        // Update connection status if no peers left
        if (this.peerList.children.length === 0) {
            this.connectionStatus.textContent = 'Status: No peers connected';
        }
    }
}

// Initialize UI controller
window.UIController = UIController;