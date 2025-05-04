# DAW Collaboration Tool

A web-based peer-to-peer real-time audio collaboration tool that allows musicians to collaborate remotely using their Digital Audio Workstations (DAWs).

## Features

- Real-time audio streaming between peers over WebRTC
- Multi-user support for group collaboration sessions
- Configurable audio settings (sample rate, buffer size, bit depth)
- Visual audio level meters for local and remote streams
- Real-time latency and jitter monitoring for connection quality assessment
- Simple and intuitive UI for easy connection
- Automated connection process using PeerJS
- Live connection status and activity log
- Audio troubleshooting tools and diagnostics

## How It Works

This application creates a peer-to-peer connection between two or more users, allowing them to share audio streams in real-time. The audio from each user's DAW is captured from their system's input and streamed to all connected peers.

### Signal Flow Diagram

```
┌──────────────────────────────────────────────┐
│                                              │
│               Your Computer                  │
│                                              │
│  ┌──────────┐       ┌─────────────────────┐  │
│  │          │       │                     │  │
│  │   DAW    ├──────►│  Audio Routing Tool │  │
│  │          │       │  (Loopback, etc.)   │  │
│  └──────────┘       └──────────┬──────────┘  │
│                                │             │
│                                ▼             │
│                      ┌───────────────────┐   │
│                      │  Browser:         │   │
│                      │  WebRTC & Web     │   │
│                      │  Audio API        │   │
│                      └─────────┬─────────┘   │
│                                │             │
└────────────────────────────────┼─────────────┘
                                 │              
                                 ▼              
                     ┌───────────────────────┐  
                     │   PeerJS Server       │  
                     │   (Connection Broker) │  
                     └─────────┬─────────────┘  
                               │                
                 ┌─────────────┴─────────────┐  
                 │                           │  
                 ▼                           ▼  
┌──────────────────────────────┐  ┌──────────────────────────────┐
│                              │  │                              │
│       Peer Computer 1        │  │       Peer Computer 2        │
│                              │  │                              │
│  ┌──────────────────────┐    │  │    ┌──────────────────────┐  │
│  │ Browser:             │    │  │    │ Browser:             │  │
│  │ WebRTC & Web Audio   │    │  │    │ WebRTC & Web Audio   │  │
│  └──────────┬───────────┘    │  │    └───────────┬──────────┘  │
│             │                │  │                │             │
│             ▼                │  │                ▼             │
│  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │                        │  │  │  │                        │  │
│  │ Computer Audio System  │  │  │  │ Computer Audio System  │  │
│  │                        │  │  │  │                        │  │
│  └────────────┬───────────┘  │  │  └───────────┬────────────┘  │
│               │              │  │              │               │
│               ▼              │  │              ▼               │
│      ┌─────────────────┐     │  │     ┌─────────────────┐      │
│      │                 │     │  │     │                 │      │
│      │  DAW / Speakers │     │  │     │  DAW / Speakers │      │
│      │                 │     │  │     │                 │      │
│      └─────────────────┘     │  │     └─────────────────┘      │
│                              │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘
```

### Technical Stack

- **WebRTC**: For peer-to-peer audio streaming
- **PeerJS**: Simplifies WebRTC connection establishment
- **Web Audio API**: For audio processing and visualization
- **HTML/CSS/JavaScript**: Front-end UI and application logic

## Setup and Usage

### Prerequisites

- A modern web browser with WebRTC support (Chrome, Firefox, Edge, Safari)
- Audio routing software to send your DAW's output to your system's input:
  - **macOS**: Loopback, Soundflower, BlackHole
  - **Windows**: JACK Audio, VB-Cable, ASIO Link Pro
  - **Linux**: JACK Audio, PulseAudio

### Running the Application

1. Clone or download this repository
2. Open the `index.html` file in your web browser
3. Configure audio settings based on your DAW's configuration
4. Click "Start Audio Input" to initialize audio capture
5. Create a new session or join an existing one using a Session ID
6. Share your Session ID with collaborators or use their ID to join

### DAW Setup

1. Configure your DAW to send its output to your system's input using audio routing software
2. Set your DAW's sample rate and buffer size to match the settings in the application
3. Create a separate track in your DAW to monitor the incoming audio from your collaborators

## Troubleshooting Audio Issues

### Common Problems and Solutions

1. **No audio is being sent or received**:
   - Check that your DAW's output is properly routed to your system's input
   - Ensure your browser has permission to access your audio input device
   - Click the "Debug Audio" button to see detailed information about audio routing
   - Press Alt+D to open the debug panel and click "Force Enable Audio"

2. **Can hear audio but levels aren't showing**:
   - Check that the audio level is high enough to register
   - Click "Fix Audio Issues" button that appears next to the peer in the connected peers list
   - In the debug panel (Alt+D), click "Restart Audio Processing"

3. **Can see connection is established but no audio is coming through**:
   - Browser autoplay policies may be blocking audio playback
   - Click anywhere on the page to enable audio, or click the "Enable Audio" banner if it appears
   - Try using the "Force Enable Audio" button in the debug panel

4. **Latency display shows "Measuring latency..." but never updates**:
   - Open the debug panel (Alt+D) and click "Fix Latency Display"
   - Try refreshing the page and reconnecting
   - Check browser console for any error messages

### Advanced Debugging Tools

The application includes several debugging tools to help diagnose and fix audio issues:

1. **Debug Audio Button**: Shows detailed information about audio devices and connections
2. **Debug UI Button**: Checks all UI elements are working properly
3. **Debug Panel** (Alt+D): Provides advanced tools for fixing audio and connection issues
4. **Fix Audio Issues**: Button that appears next to peer names when connection issues are detected

## Performance Considerations

For the best collaboration experience:

- Use a wired internet connection when possible
- Lower buffer sizes provide less latency but may introduce audio glitches
- Higher buffer sizes provide more stability but increase latency
- Consider using smaller sample rates (44.1 kHz) for better performance
- The number of simultaneous users affects performance - 3-5 users is recommended
- Latency values below 50ms are considered good for real-time collaboration
- Jitter values below 15ms indicate a stable connection

## Understanding Latency and Jitter

The application measures and displays two important metrics for audio quality:

- **Latency**: The round-trip time (in milliseconds) for audio to travel from one peer to another and back. Lower values mean more responsive collaboration.
- **Jitter**: The variation in latency (in milliseconds). Lower values indicate a more stable connection.

The latency display is color-coded:
- **Green**: Good connection (latency < 50ms, jitter < 15ms)
- **Amber**: Moderate connection (latency < 100ms, jitter < 30ms)
- **Red**: Poor connection (latency ≥ 100ms or jitter ≥ 30ms)

## Project Structure

```
daw-collaboration-app/
├── index.html                # Main HTML file
├── css/
│   └── styles.css            # Styles for the application
├── js/
│   ├── main.js               # Main application logic
│   ├── audio-manager.js      # Audio capture and processing
│   ├── peer-manager.js       # PeerJS connection handling
│   ├── ui-controller.js      # UI updates and event handling
│   ├── latency-monitor.js    # Connection quality monitoring
│   └── utils.js              # Utility functions
└── README.md                 # Project documentation
```

## Limitations

- Browser security restrictions require HTTPS for accessing audio devices in production environments
- Latency is dependent on network conditions and cannot match physical in-person collaboration
- Audio quality may be affected by bandwidth limitations
- Some browser-specific implementations may vary
- Browser autoplay policies may require user interaction before audio can play

## Future Enhancements

Planned features for future versions:

- Recording capabilities
- More detailed audio visualization
- Separate volume controls for each connected peer
- Text chat functionality
- Session persistence
- MIDI data transmission
- Multi-track mixing capabilities
- Direct integration with popular DAWs

## Troubleshooting Commands

You can run these commands in the browser console for advanced troubleshooting:

- `audioManager.forceEnableAudio()` - Forces audio playback to be enabled
- `audioManager.fixRemoteAudioIssues()` - Rebuilds audio processing pipelines for all peers
- `latencyMonitor.forcePingAll()` - Forces new latency measurements
- `latencyMonitor.debugLatencyMonitor()` - Shows detailed latency statistics
- `UIController.debugUI()` - Logs detailed information about UI elements

## License

This project is open source and available under the MIT License.

## Acknowledgements

- [PeerJS](https://peerjs.com/) for simplifying WebRTC connections
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) for audio processing capabilities