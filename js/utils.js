/**
 * Utility functions for DAW Collaboration Tool
 */

// DOM element selector helper
function $(selector) {
    return document.querySelector(selector);
}

// Log messages to the UI
function log(message) {
    const logContainer = $('#logContainer');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    console.log(message);
}

// Calculate volume from analyser data
function calculateVolume(dataArray) {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    return sum / dataArray.length;
}

// Generate a random string for session naming
function generateRandomId(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Format time in milliseconds to a readable format
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Check if WebRTC is supported in the current browser
function isWebRTCSupported() {
    return !!(navigator.mediaDevices && 
            navigator.mediaDevices.getUserMedia && 
            window.RTCPeerConnection);
}

// Check if the Web Audio API is supported
function isWebAudioSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
}

// Browser detection for specific handling
function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browserName = "Unknown";
    let browserVersion = "Unknown";
    
    if (userAgent.indexOf("Firefox") > -1) {
        browserName = "Firefox";
        browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)[1];
    } else if (userAgent.indexOf("Chrome") > -1) {
        browserName = "Chrome";
        browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)[1];
    } else if (userAgent.indexOf("Safari") > -1) {
        browserName = "Safari";
        browserVersion = userAgent.match(/Version\/([0-9.]+)/)[1];
    } else if (userAgent.indexOf("Edge") > -1) {
        browserName = "Edge";
        browserVersion = userAgent.match(/Edge\/([0-9.]+)/)[1];
    }
    
    return { browserName, browserVersion };
}

// Show a notification in the UI
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 5000);
}

// Export the utilities to be used by other modules
window.utils = {
    $,
    log,
    calculateVolume,
    generateRandomId,
    formatTime,
    isWebRTCSupported,
    isWebAudioSupported,
    getBrowserInfo,
    showNotification
};