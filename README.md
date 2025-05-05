# DAW Collaboration Tool

A web-based peer-to-peer real-time audio collaboration tool that allows musicians to collaborate remotely using their Digital Audio Workstations (DAWs).

## Overview

This application enables musicians to collaborate remotely by creating a peer-to-peer connection for real-time audio streaming. Using WebRTC technology through the PeerJS library, it establishes low-latency audio connections between collaborators, making remote music production and jamming possible.

## Features

- **Real-time audio streaming** between peers over WebRTC with minimal latency
- **Multi-user support** for collaborative sessions with multiple musicians
- **Configurable audio settings** (sample rate, buffer size, bit depth)
- **Visual audio level meters** for monitoring local and remote streams
- **Real-time latency and jitter monitoring** with color-coded quality indicators
- **Simple session sharing** via URL links
- **Browser-based solution** with no software installation required
- **Automated connection management** using PeerJS
- **Advanced debugging tools** for troubleshooting audio issues

## Detailed Signal Flow with Latency Analysis

The following diagram shows the complete signal flow from end to end, including all latency points:

```mermaid
flowchart TD
    subgraph "Local User Environment"
        DAW[DAW Output]
        VirtAudio[Virtual Audio Device]
        Browser[Browser Audio Capture]
        WebAudio[Web Audio Processing]
        WebRTC_Local[WebRTC Encoding]
        
        DAW -->|"0-2ms"| VirtAudio
        VirtAudio -->|"10-100ms Buffer Latency"| Browser
        Browser -->|"5-15ms"| WebAudio
        WebAudio -->|"5-50ms nBuffer Size Impact"| WebRTC_Local
    end
    
    subgraph "Network"
        PeerJS[PeerJS Signaling]
        Internet[Internet Routing]
        
        WebRTC_Local -->|"50-500ms One-time Setup"| PeerJS
        PeerJS -->|"Connection Establishment"| Internet
        Internet -->|"20-200ms Network Latency & Jitter"| WebRTC_Remote
    end
    
    subgraph "Remote User Environment"
        WebRTC_Remote[WebRTC Decoding]
        AudioProc[Audio Post-Processing]
        AudioOutput[Audio Output]
        Monitoring[Remote Monitoring]
        
        WebRTC_Remote -->|"5-20ms Decoding Delay"| AudioProc
        AudioProc -->|"Processing Effect"| AudioOutput
        AudioOutput -->|"5-30ms Output Buffer"| Monitoring
    end
    
    subgraph "Monitoring Systems"
        LatencyDisplay[Latency Monitor]
        JitterDisplay[Jitter Detection]
        QualityIndicator[Connection Quality]
        
        Internet -.->|"RTT Measurement"| LatencyDisplay
        Internet -.->|"Variance Analysis"| JitterDisplay
        LatencyDisplay -->|"Data Feed"| QualityIndicator
        JitterDisplay -->|"Data Feed"| QualityIndicator
    end
    
    classDef userSteps fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef networkSteps fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    classDef audioSteps fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef monitoringSteps fill:#fff8e1,stroke:#ff8f00,stroke-width:2px
    
    class DAW,VirtAudio,Browser,WebAudio,WebRTC_Local userSteps
    class PeerJS,Internet networkSteps
    class WebRTC_Remote,AudioProc,AudioOutput,Monitoring audioSteps
    class LatencyDisplay,JitterDisplay,QualityIndicator monitoringSteps
```

### Latency Analysis in the Audio Collaboration Pipeline

The DAW Collaboration Tool minimizes latency where possible, but several unavoidable latency points exist throughout the signal chain:

1. **Audio Driver Buffer** (10-100ms): The virtual audio device adds latency based on buffer size settings. Smaller buffers reduce latency but may introduce audio glitches.
   
2. **Browser Buffer Size** (5-50ms): Web Audio API processing creates latency proportional to the chosen buffer size. This is configurable in the application settings.
   
3. **Signaling Latency** (50-500ms): One-time connection setup delay through the PeerJS server. This only affects initial connection and does not impact the ongoing audio stream.
   
4. **Network Latency & Jitter** (20-200ms): The most significant variable factor, depends on:
   - Internet connection quality
   - Geographic distance between peers
   - Network congestion
   - Route efficiency
   
5. **Decoding Delay** (5-20ms): Time required to decode the received audio stream on the remote user's device.
   
6. **Output Buffer** (5-30ms): Final playback buffer adds small additional latency before audio reaches the output device.

**Total End-to-End Latency Range**: ~45-900ms (under typical conditions: 80-150ms)

The application's latency monitor continuously analyzes the connection quality and displays real-time metrics with color-coded indicators:
- **Green**: Good (<50ms round-trip, <15ms jitter)
- **Amber**: Moderate (<100ms round-trip, <30ms jitter)
- **Red**: Poor (≥100ms round-trip or ≥30ms jitter)

## How It Works

1. **Audio Routing**: Musicians route their DAW's audio output to a virtual audio device (like Loopback, BlackHole, VB-Cable, etc.)
2. **Browser Capture**: The application captures this audio through the browser's Web Audio API
3. **Peer Connection**: When a session is created, a unique session ID is generated through PeerJS
4. **Audio Streaming**: WebRTC establishes a direct peer-to-peer connection for low-latency audio streaming
5. **Real-time Monitoring**: Audio levels and network performance (latency/jitter) are constantly monitored
6. **Playback**: Incoming audio from remote peers is played through the local computer's audio output

## Technical Stack

- **WebRTC**: Core technology for peer-to-peer audio streaming
- **PeerJS**: Simplifies WebRTC connection establishment and session management
- **Web Audio API**: Handles audio capturing, processing, and visualization
- **JavaScript Modules**: Organized code structure for maintainability
- **HTML/CSS**: Responsive UI designed for musicians' workflow

## Setup and Usage

### Prerequisites

- A modern web browser with WebRTC support (Chrome, Firefox, Edge, Safari)
- Audio routing software to send your DAW's output to your system's input:
  - **macOS**: Loopback, BlackHole, Soundflower
  - **Windows**: VB-Cable, JACK Audio, ASIO Link Pro
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

## Performance Considerations

For the best collaboration experience:

- Use a wired internet connection when possible
- Lower buffer sizes provide less latency but may introduce audio glitches
- Higher buffer sizes provide more stability but increase latency
- Latency values below 50ms are considered good for real-time collaboration
- Jitter values below 15ms indicate a stable connection

## Troubleshooting

The application includes several built-in tools for diagnosing and fixing audio issues:

- **Debug Panel** (Alt+D or visible debug button): Advanced tools for fixing audio and connection issues
- **Audio Signal Verification**: Automatic detection of audio signal problems
- **Connection Quality Monitoring**: Visual indicators of network performance
- **Browser Console Logging**: Detailed diagnostic information

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
- Browser autoplay policies may require user interaction before audio can play

## License

This project is open source and available under the MIT License.

## Future Goals

### Latency Reduction Initiatives

1. **Native WebRTC Implementation**: Replace PeerJS with a custom WebRTC implementation to eliminate middleware latency and optimize for audio-specific use cases.

2. **WebTransport Integration**: Investigate WebTransport API as an alternative to WebRTC for potentially lower latency streaming once browser support matures.

3. **Optimized Codec Pipeline**: Implement advanced audio codecs with better compression-to-latency ratios and develop a streamlined encoding/decoding process.

4. **Predictive Jitter Buffering**: Create an AI-powered adaptive buffer that predicts network conditions to minimize buffer size while preventing dropouts.

5. **WebAssembly Processing**: Move critical audio processing to WebAssembly for near-native performance and reduced processing latency.

### VST/AU Plugin Development

1. **Native DAW Plugin**: Develop VST3 and AU plugins that integrate directly with DAWs, eliminating the need for virtual audio routing.

2. **Direct API Communication**: Create a cross-platform plugin that communicates directly with a lightweight server component, bypassing browser limitations.

3. **Integrated Monitoring**: Add built-in plugin monitoring with waveform visualization and latency compensation tools.

4. **Session Management**: Implement project-based session management that saves connection details with DAW projects.

5. **Multi-Channel Support**: Add support for multi-channel audio streams to enable more complex collaborative workflows.

The long-term vision is to reduce total end-to-end latency to under 30ms for users with quality internet connections while maintaining audio fidelity, and to create a seamless experience that integrates directly with musicians' existing DAW workflows without requiring additional audio routing software.

## Acknowledgements

- [PeerJS](https://peerjs.com/) for simplifying WebRTC connections
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) for audio processing capabilities