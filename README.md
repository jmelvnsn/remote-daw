# DAW Collaboration Tool

A web-based peer-to-peer real-time audio collaboration tool that allows musicians to collaborate remotely using their Digital Audio Workstations (DAWs).

## Features

- Real-time audio streaming between peers over WebRTC
- Multi-user support for group collaboration sessions
- Configurable audio settings (sample rate, buffer size, bit depth)
- Visual audio level meters for local and remote streams
- Simple and intuitive UI for easy connection
- Automated connection process using PeerJS
- Live connection status and activity log

## How It Works

This application creates a peer-to-peer connection between two or more users, allowing them to share audio streams in real-time. The audio from each user's DAW is captured from their system's input and streamed to all connected peers.

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

## Project Structure

```
daw-collaboration-app/
├── index.html              # Main HTML file
├── css/
│   └── styles.css          # Styles for the application
├── js/
│   ├── main.js             # Main application logic
│   ├── audio-manager.js    # Audio capture and processing
│   ├── peer-manager.js     # PeerJS connection handling
│   ├── ui-controller.js    # UI updates and event handling
│   └── utils.js            # Utility functions
└── README.md               # Project documentation
```

## Performance Considerations

For the best collaboration experience:

- Use a wired internet connection when possible
- Lower buffer sizes provide less latency but may introduce audio glitches
- Higher buffer sizes provide more stability but increase latency
- Consider using smaller sample rates (44.1 kHz) for better performance
- The number of simultaneous users affects performance - 3-5 users is recommended

## Limitations

- Browser security restrictions require HTTPS for accessing audio devices in production environments
- Latency is dependent on network conditions and cannot match physical in-person collaboration
- Audio quality may be affected by bandwidth limitations
- Some browser-specific implementations may vary

## Future Enhancements

Planned features for future versions:

- Recording capabilities
- More detailed audio visualization
- Separate volume controls for each connected peer
- Text chat functionality
- Session persistence
- MIDI data transmission

## License

This project is open source and available under the MIT License.

## Acknowledgements

- [PeerJS](https://peerjs.com/) for simplifying WebRTC connections
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) for audio processing capabilities